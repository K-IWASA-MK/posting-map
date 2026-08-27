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
const seenEvents = new Set();

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
  
  if (seenEvents.has(eventId)) {
    console.log(`[${gatewayRequestId}] Ignored: Idempotency cache hit for ${eventId}`);
    return res.status(200).json({ received: true });
  }
  seenEvents.add(eventId);
  
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
      console.log(`[${gatewayRequestId}] Handling 302 redirect to: ${redirectUrl}`);
      
      try {
        const finalResponse = await axios.get(redirectUrl, {
          timeout: 15000 // 15 seconds timeout
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
      console.log(`[${gatewayRequestId}] No redirect from GAS? Status: ${response.status}`);
      const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      console.log(`[${gatewayRequestId}] GAS Response body: ${bodyStr ? bodyStr.substring(0,200) : ''}`);
      require('fs').writeFileSync('gas_error.html', bodyStr);
      return res.status(200).json({ received: true });
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
