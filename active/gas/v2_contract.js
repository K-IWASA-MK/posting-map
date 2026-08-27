/**
 * GAS v2 - Contract State & Synchronization Layer
 * 
 * 責務：
 * - Stripeの契約状態（Subscription）をPOSTING MAPシステム内へ同期。
 * - Access Controlの判定元となるステータスを管理。
 * - Idempotency（冪等性）とイベント順序の制御。
 */

// デフォルトの安全な初期状態
const DEFAULT_CONTRACT_STATE = {
  contractId: "",
  stripeCustomerId: "",
  stripeSubscriptionId: "",
  customerEmail: "",
  productId: "",
  priceId: "",
  status: "active",       // 初期状態は既存の動作を壊さないようactiveとする
  accessEnabled: true,    // デフォルト利用可能
  currentPeriodStart: 0,
  currentPeriodEnd: 0,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  lastStripeEventId: "",
  lastStripeEventCreated: 0,
  lastSyncedAt: 0
};

/**
 * 現在のContract Stateを取得する
 * PropertiesService (STRIPE_CONTRACT_STATE) をSSOTとする
 */
function getContractState() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("STRIPE_CONTRACT_STATE");
  if (!raw) {
    return JSON.parse(JSON.stringify(DEFAULT_CONTRACT_STATE));
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    Logger.log("Contract State Parse Error: " + e.toString());
    return JSON.parse(JSON.stringify(DEFAULT_CONTRACT_STATE));
  }
}

/**
 * Contract Stateを保存する
 */
function saveContractState(state) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("STRIPE_CONTRACT_STATE", JSON.stringify(state));
}

/**
 * 契約状態(Stripe Status)からシステム利用権限(accessEnabled)を判定する
 */
function evaluateAccess(status) {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  if (s === "active" || s === "trialing" || s === "past_due") {
    return true;
  }
  return false;
}

/**
 * Stripe Eventを受信し、状態をアトミックに更新する
 * @param {Object} stripeEvent StripeからのOriginal Eventオブジェクト
 * @param {Object} subscription StripeからのSubscriptionオブジェクト (存在する場合)
 * @param {String} gatewayRequestId Cloud LoggingとGAS Auditを相関させる一意なID
 */
function updateContractState(stripeEvent, subscription, gatewayRequestId = "") {
  const lock = LockService.getScriptLock();
  try {
    // 競合防止のため10秒待機
    lock.waitLock(10000);
  } catch (e) {
    Logger.log("Contract State Update Lock Timeout");
    return { success: false, message: "System is busy, lock timeout." };
  }

  try {
    const currentState = getContractState();
    const eventId = String(stripeEvent.id || "");
    const eventCreated = parseInt(stripeEvent.created, 10) || 0;
    
    // Idempotency: 同一イベントの二重処理防止
    if (currentState.lastStripeEventId === eventId) {
      return { success: true, message: "Ignored: Duplicate event ID", state: currentState };
    }
    
    // Event Ordering: 古いイベントによる巻き戻し防止
    if (eventCreated < currentState.lastStripeEventCreated && currentState.lastStripeEventCreated !== 0) {
      return { success: true, message: "Ignored: Older event", state: currentState };
    }
    
    const newState = JSON.parse(JSON.stringify(currentState));
    newState.lastStripeEventId = eventId;
    newState.lastStripeEventCreated = eventCreated;
    newState.lastSyncedAt = Math.floor(Date.now() / 1000);
    
    // Subscription情報がある場合は優先反映
    if (subscription && typeof subscription === "object" && subscription.id) {
      newState.stripeSubscriptionId = String(subscription.id);
      newState.stripeCustomerId = String(subscription.customer || "");
      newState.status = String(subscription.status || "");
      newState.currentPeriodStart = parseInt(subscription.current_period_start, 10) || 0;
      newState.currentPeriodEnd = parseInt(subscription.current_period_end, 10) || 0;
      newState.cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
      newState.canceledAt = subscription.canceled_at ? parseInt(subscription.canceled_at, 10) : null;
      
      if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
        const item = subscription.items.data[0];
        if (item.plan) {
          newState.productId = String(item.plan.product || "");
          newState.priceId = String(item.plan.id || "");
        }
      }
      
      // Access判定
      newState.accessEnabled = evaluateAccess(newState.status);
    }
    
    // 状態を保存
    saveContractState(newState);
    
    // 監査ログ書き込み
    writeAuditLog(currentState, newState, stripeEvent, gatewayRequestId);
    
    return { success: true, state: newState };
  } catch (e) {
    Logger.log("updateContractState Error: " + e.toString());
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 監査ログを記録する
 */
function writeAuditLog(oldState, newState, event, gatewayRequestId = "") {
  try {
    const ss = typeof getSS === 'function' ? getSS() : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    
    let sheetName = "__SYSTEM_CONTRACT_AUDIT__";
    let s = ss.getSheetByName(sheetName);
    const headers = [
      "Timestamp", "Gateway Request ID", "Event ID", "Event Type", "Event Created", 
      "Old Status", "New Status", "Old Access", "New Access", 
      "Subscription ID", "Customer ID", "Sync Result", "Error / Reason"
    ];
    
    if (!s) {
      s = ss.insertSheet(sheetName);
      s.getRange(1, 1, 1, headers.length).setValues([headers]);
      s.hideSheet(); // 隠しシート化
    }
    
    const timestamp = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
    
    s.appendRow([
      timestamp,
      gatewayRequestId,
      String(event.id || ""),
      String(event.type || ""),
      parseInt(event.created, 10) || 0,
      oldState.status,
      newState.status,
      oldState.accessEnabled,
      newState.accessEnabled,
      newState.stripeSubscriptionId,
      newState.stripeCustomerId,
      "SUCCESS",
      ""
    ]);
  } catch (e) {
    Logger.log("Contract Audit Log Error: " + e.toString());
  }
}

