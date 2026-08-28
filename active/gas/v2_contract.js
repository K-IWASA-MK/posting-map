/**
 * POSTING MAP - Minimal Stripe Contract Management (GAS v2)
 *
 * 責務：
 * - 契約管理スプレッドシート(SSOT)のCRUD
 * - Stripe Webhookイベントからの決済ステータス更新 (Event Fetch代替検証を含む)
 * - 契約・利用状態に基づくアクセス判定 (evaluateContractAccess)
 */

const SHEET_NAME_CONTRACT = "契約管理";

/**
 * 契約管理シートを取得。存在しない場合はヘッダー付きで初期化。
 */
function ensureContractSheet() {
  const ss = typeof getSS === 'function' ? getSS() : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;

  let sheet = ss.getSheetByName(SHEET_NAME_CONTRACT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_CONTRACT);
    const headers = [
      "契約ID", "支部名", "Stripe Customer ID", "Stripe Subscription ID",
      "支払状態", "利用状態", "未払い開始日", "利用停止日", "最終決済日", "次回決済日", "更新日時"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Default initial row for existing users (Grace period/fallback)
    const now = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
    sheet.appendRow([
      "DEFAULT", "システムデフォルト", "", "",
      "PAID", "ACTIVE", "", "", now, "", now
    ]);
  }
  return sheet;
}

/**
 * StripeのSecret Keyを取得する
 */
function getStripeSecretKey() {
  return PropertiesService.getScriptProperties().getProperty("STRIPE_SECRET_KEY") || "";
}

/**
 * Stripe APIへEventを直接照会し、真正性を確認する (Event Fetch代替検証)
 */
function fetchStripeEventValid(eventId) {
  const secretKey = getStripeSecretKey();
  if (!secretKey || !eventId) return null;

  try {
    const url = `https://api.stripe.com/v1/events/${eventId}`;
    const options = {
      method: "get",
      headers: {
        "Authorization": `Bearer ${secretKey}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    return null;
  } catch (err) {
    Logger.log("fetchStripeEventValid Error: " + err.toString());
    return null;
  }
}

/**
 * Stripe APIへSubscription情報を直接照会する
 */
function fetchStripeSubscription(subscriptionId) {
  const secretKey = getStripeSecretKey();
  if (!secretKey || !subscriptionId) return null;

  try {
    const url = `https://api.stripe.com/v1/subscriptions/${subscriptionId}`;
    const options = {
      method: "get",
      headers: {
        "Authorization": `Bearer ${secretKey}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    return null;
  } catch (err) {
    Logger.log("fetchStripeSubscription Error: " + err.toString());
    return null;
  }
}

/**
 * Webhookで受信したStripe Eventを処理し、契約状態を更新する
 */
function handleStripeWebhookContractUpdate(rawEvent, gatewayRequestId = "") {
  const eventId = rawEvent.id;
  if (!eventId) return { success: false, error: "Missing event.id" };

  // 1. 重複イベント（冪等性）の簡易チェック
  const props = PropertiesService.getScriptProperties();
  const lastEventId = props.getProperty("LAST_STRIPE_EVENT_ID");
  if (lastEventId === eventId) {
    return { success: true, message: "Ignored: Duplicate event ID" };
  }

  // 2. Event Fetch 代替検証
  const verifiedEvent = fetchStripeEventValid(eventId);
  if (!verifiedEvent) {
    return { success: false, error: "Invalid or unauthorized Stripe Event" };
  }

  // 正常に検証できたらIDを保存
  props.setProperty("LAST_STRIPE_EVENT_ID", eventId);

  const eventType = verifiedEvent.type;
  const eventObj = verifiedEvent.data.object;

  let subscriptionId = "";
  let customerId = "";

  if (eventType.startsWith("invoice.")) {
    subscriptionId = eventObj.subscription || "";
    customerId = eventObj.customer || "";
  } else if (eventType.startsWith("customer.subscription.")) {
    subscriptionId = eventObj.id || "";
    customerId = eventObj.customer || "";
  }

  if (!subscriptionId && !customerId) {
    return { success: true, message: "No subscription or customer ID. Ignored." };
  }

  const sheet = ensureContractSheet();
  if (!sheet) return { success: false, error: "Sheet not found" };

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  
  const colSubId = headers.indexOf("Stripe Subscription ID");
  const colCustId = headers.indexOf("Stripe Customer ID");
  const colPayStatus = headers.indexOf("支払状態");
  const colUseStatus = headers.indexOf("利用状態");
  const colUnpaidStart = headers.indexOf("未払い開始日");
  const colSuspendDate = headers.indexOf("利用停止日");
  const colLastPay = headers.indexOf("最終決済日");
  const colUpdate = headers.indexOf("更新日時");

  let targetRowIndex = -1;

  // 既存のSubscription ID または Customer ID で行を検索
  for (let i = 1; i < values.length; i++) {
    const rowSubId = values[i][colSubId] || "";
    const rowCustId = values[i][colCustId] || "";
    
    if (subscriptionId && rowSubId === subscriptionId) {
      targetRowIndex = i;
      break;
    }
    if (customerId && rowCustId === customerId) {
      targetRowIndex = i;
      break;
    }
    // テスト・初期セットアップ時はDEFAULT行を使用
    if (values[i][headers.indexOf("契約ID")] === "DEFAULT") {
      targetRowIndex = i;
    }
  }

  if (targetRowIndex === -1) {
    return { success: true, message: "Matching contract not found. Ignored." };
  }

  const now = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
  const today = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");
  const rowNum = targetRowIndex + 1;

  if (eventType === "invoice.paid" || eventType === "invoice.payment_succeeded") {
    sheet.getRange(rowNum, colPayStatus + 1).setValue("PAID");
    sheet.getRange(rowNum, colUseStatus + 1).setValue("ACTIVE");
    sheet.getRange(rowNum, colUnpaidStart + 1).setValue("");
    sheet.getRange(rowNum, colSuspendDate + 1).setValue("");
    sheet.getRange(rowNum, colLastPay + 1).setValue(now);
    sheet.getRange(rowNum, colUpdate + 1).setValue(now);
    
    // Customer/Sub IDを保管（もし空なら）
    if (subscriptionId) sheet.getRange(rowNum, colSubId + 1).setValue(subscriptionId);
    if (customerId) sheet.getRange(rowNum, colCustId + 1).setValue(customerId);

  } else if (eventType === "invoice.payment_failed") {
    sheet.getRange(rowNum, colPayStatus + 1).setValue("FAILED");
    const currentUnpaid = sheet.getRange(rowNum, colUnpaidStart + 1).getValue();
    if (!currentUnpaid) {
      sheet.getRange(rowNum, colUnpaidStart + 1).setValue(today);
    }
    sheet.getRange(rowNum, colUpdate + 1).setValue(now);
    // 利用状態(ACTIVE)は月末まで維持するため変更しない
  }

  return { success: true, event: eventType, processed: true };
}

/**
 * 契約・利用状態の判定（API呼び出しガード用）
 */
function evaluateContractAccess() {
  const sheet = ensureContractSheet();
  if (!sheet) return true; // Fail-safe: allow if sheet missing to not break sys

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return true; 

  const headers = values[0];
  const colUseStatus = headers.indexOf("利用状態");

  // ここではテナント/組織の判定を省略し、代表1行目の利用状態を見る（最小構成）
  for (let i = 1; i < values.length; i++) {
    const status = String(values[i][colUseStatus] || "").toUpperCase();
    if (status === "ACTIVE") return true; 
  }
  
  // すべてSUSPENDEDなら利用不可
  return false;
}

/**
 * 毎月1日に実行。前月未払いのユーザーをSUSPENDEDへ変更する。
 */
function checkMonthlyPaymentStatus() {
  const sheet = ensureContractSheet();
  if (!sheet) return;

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;

  const headers = values[0];
  const colSubId = headers.indexOf("Stripe Subscription ID");
  const colPayStatus = headers.indexOf("支払状態");
  const colUseStatus = headers.indexOf("利用状態");
  const colSuspendDate = headers.indexOf("利用停止日");
  const colUpdate = headers.indexOf("更新日時");

  const now = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
  const today = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");

  for (let i = 1; i < values.length; i++) {
    const payStatus = String(values[i][colPayStatus] || "").toUpperCase();
    const useStatus = String(values[i][colUseStatus] || "").toUpperCase();
    const subId = String(values[i][colSubId] || "");

    if (payStatus === "FAILED" && useStatus !== "SUSPENDED") {
      // StripeをSSOTとする: スプレッドシートだけでなく、Stripe側の状態も最新確認する
      let shouldSuspend = true;
      if (subId) {
        const subData = fetchStripeSubscription(subId);
        // Stripe上でアクティブ（支払い済み）になっていれば停止しない
        if (subData && (subData.status === "active" || subData.status === "trialing")) {
          shouldSuspend = false;
        }
      }

      if (shouldSuspend) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, colUseStatus + 1).setValue("SUSPENDED");
        sheet.getRange(rowNum, colSuspendDate + 1).setValue(today);
        sheet.getRange(rowNum, colUpdate + 1).setValue(now);
        Logger.log(`Contract row ${rowNum} suspended due to unpaid status at month-end.`);
      }
    }
  }
}
