const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

const app = express();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const INTERNAL_GATEWAY_TOKEN = process.env.INTERNAL_GATEWAY_TOKEN;
const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;

if (!endpointSecret || !INTERNAL_GATEWAY_TOKEN || !GAS_WEBAPP_URL || !process.env.STRIPE_SECRET_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

// In-memory idempotency cache (Note: Resets on Cloud Run instance restart.
// Full persistent idempotency is handled by GAS).
const EVENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EVENT_CACHE_MAX_SIZE = 10000;
const seenEvents = new Map();

/**
 * 有効期限切れ (TTL超過) および上限件数超過エントリの削除
 * JavaScript Map は挿入順を保持するため、先頭から順に走査・削除 (FIFO)
 * @param {number} now 
 */
function pruneSeenEvents(now = Date.now()) {
  // 1. TTL 超過エントリを古い順に削除
  for (const [eventId, seenAt] of seenEvents) {
    if (now - seenAt >= EVENT_CACHE_TTL_MS) {
      seenEvents.delete(eventId);
    } else {
      break; // 挿入順のため、以降のエントリはこれより新しい
    }
  }

  // 2. 最大件数超過時、最古のエントリから削除 (FIFO)
  while (seenEvents.size > EVENT_CACHE_MAX_SIZE) {
    const oldestEventId = seenEvents.keys().next().value;
    if (oldestEventId === undefined) {
      break;
    }
    seenEvents.delete(oldestEventId);
  }
}

/**
 * Event ID の重複チェック & キャッシュ登録
 * 重複時は Map の順序を崩さないよう更新・再挿入を行わない
 * @param {string} eventId 
 * @returns {boolean} 重複している場合は true、新規の場合は false
 */
function isDuplicateEvent(eventId) {
  const now = Date.now();
  const seenAt = seenEvents.get(eventId);

  // 重複ヒット時: TTL 内なら true を返し、順序を維持（delete/set しない）
  if (seenAt !== undefined) {
    if (now - seenAt < EVENT_CACHE_TTL_MS) {
      return true;
    }
    // TTL 超過していた場合は古いエントリを削除して再登録へ
    seenEvents.delete(eventId);
  }

  // 新規登録時のみ set を行う (FIFO の最古順を正確に保つ)
  seenEvents.set(eventId, now);
  pruneSeenEvents(now);
  return false;
}

/**
 * GAS 302 リダイレクト先 URL の厳格なバリデーション (SSRF / Open Redirect 防御)
 * @param {string} redirectUrl 
 * @returns {URL|null} 有効な場合はパースされた URL オブジェクト、無効な場合は null
 */
function validateGasRedirectUrl(redirectUrl) {
  if (!redirectUrl || typeof redirectUrl !== 'string') {
    return null;
  }
  try {
    const parsed = new URL(redirectUrl);
    
    // 1. HTTPS プロトコルのみ許可
    if (parsed.protocol !== 'https:') {
      return null;
    }
    
    // 2. ホスト名の完全一致検証 (script.googleusercontent.com)
    if (parsed.hostname !== 'script.googleusercontent.com') {
      return null;
    }
    
    // 3. ポート番号検証 (デフォルト 443 のみ)
    if (parsed.port !== '' && parsed.port !== '443') {
      return null;
    }
    
    // 4. ユーザー情報 (userinfo) の禁止
    if (parsed.username !== '' || parsed.password !== '') {
      return null;
    }
    
    return parsed;
  } catch (err) {
    return null;
  }
}

// 1. Receive Raw Body for Signature Verification
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const gatewayRequestId = require('crypto').randomUUID();

  let event;
  try {
    // 2. Stripe Signature Verification
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`[${gatewayRequestId}] Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventId = event.id;
  
  if (isDuplicateEvent(eventId)) {
    console.log(`[${gatewayRequestId}] Ignored: Idempotency cache hit for ${eventId}`);
    return res.status(200).json({ received: true });
  }
  
  console.log(`[${gatewayRequestId}] Received valid Stripe event: ${eventId}`);

  // 4. GAS Forwarding Payload construction
  const payload = {
    action: "stripeWebhook",
    gateway: {
      verified: true,
      token: INTERNAL_GATEWAY_TOKEN,
      gatewayRequestId: gatewayRequestId
    },
    stripeEvent: event // Original Event unmodified
  };

  try {
    console.log(`[${gatewayRequestId}] Forwarding to GAS...`);
    
    // 5. Explicit 302 Redirect Handling
    let response;
    try {
      const targetUrl = GAS_WEBAPP_URL.includes('?') ? `${GAS_WEBAPP_URL}&action=stripeWebhook` : `${GAS_WEBAPP_URL}?action=stripeWebhook`;
      response = await axios.post(targetUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      });
    } catch (err) {
      console.error(`[${gatewayRequestId}] Network Error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to contact GAS' });
    }

    if (response.status === 302) {
      const redirectUrl = response.headers.location;
      if (!redirectUrl) {
        console.error(`[${gatewayRequestId}] 302 response missing Location header`);
        return res.status(500).json({ error: 'Missing Location header in GAS 302 redirect' });
      }

      // SSRF / Open Redirect 防御: URL を検証
      const parsedRedirectUrl = validateGasRedirectUrl(redirectUrl);
      if (!parsedRedirectUrl) {
        console.error(`[${gatewayRequestId}] Invalid or disallowed redirect URL from GAS`);
        return res.status(500).json({ error: 'Invalid redirect URL from GAS' });
      }

      console.log(`[${gatewayRequestId}] Handling 302 redirect to: ${parsedRedirectUrl.origin}${parsedRedirectUrl.pathname}`);
      
      try {
        const finalResponse = await axios.get(parsedRedirectUrl.toString(), {
          timeout: 15000, // 15 seconds timeout
          maxRedirects: 0, // 多段リダイレクトを遮断
          validateStatus: status => status === 200
        });
        console.log(`[${gatewayRequestId}] GAS Response: ${JSON.stringify(finalResponse.data)}`);
        
        // Ensure GAS processing was actually successful
        if (finalResponse.data && finalResponse.data.success === true) {
          return res.status(200).json({ received: true });
        } else {
          console.error(`[${gatewayRequestId}] GAS processing failed or returned invalid response: ${JSON.stringify(finalResponse.data)}`);
          return res.status(500).json({ error: 'GAS processing failed' });
        }
      } catch (err) {
        console.error(`[${gatewayRequestId}] Failed to fetch GAS GET endpoint: ${err.message}`);
        return res.status(500).json({ error: 'Failed to complete GAS flow' });
      }
      
    } else {
      console.error(`[${gatewayRequestId}] Unexpected response status from GAS: ${response.status}`);
      return res.status(500).json({ error: 'Unexpected response from GAS' });
    }

  } catch (error) {
    console.error(`[${gatewayRequestId}] Internal Forward Failure: ${error.message}`);
    // If we fail internally after verifying, we might still return 200 so Stripe doesn't retry endlessly,
    // or return 500 if we want Stripe to retry. We return 500 to leverage Stripe retries.
    return res.status(500).json({ error: 'Internal Forwarding Error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Cloud Run Stripe Gateway listening on port ${PORT}`);
});
