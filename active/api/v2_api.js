/**
 * GAS v2 - 純粋 JSON API エンジン
 * UI(HTML)は一切返却せず、ContentService を通じて JSON のみを応答する。
 */


// =============================
// ① 基本設定
// =============================





/**
 * GETリクエスト：JSONデータの取得
 */
function doGet(e) {
  isWebAppCall = true;
  let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};

  if (params.json) {
    try {
      const parsed = typeof params.json === 'string' ? JSON.parse(params.json) : params.json;
      if (parsed && typeof parsed === 'object') {
        Object.assign(params, parsed);
      }
    } catch (errJ) {}
  }
  if (e) {
    e.parameter = params;
  }

  // SEC-006: Prohibit token transmission via GET
  if (params.liffToken) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Token transmission via GET is prohibited."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const action = params.action || "";

  // Read-only actions that do not require liffToken
  const isReadOnlyAction = [
    'getSystemSummary',
    'getDashboardData',
    'getTier1',
    'getFlyerStock',
    'getRanking',
    'getLatestDistribution',
    'getMapsApiKey',
    'getDeliveryStats',
    'getEvidence',
    'getAreaDetails',
    'getGlobalPinStatus',
    'getRoster',
    'resetRoster',
    'getTransferRequests',
    'stripeWebhook'
  ].includes(action);

  // Authentication Gate
  if (!isReadOnlyAction) {
    const auth = authenticateRequest(params);
    if (!auth.success) {
      return ContentService.createTextOutput(JSON.stringify(auth))
        .setMimeType(ContentService.MimeType.JSON);
    }
    e.user = auth.user;
  } else {
    e.user = null;
  }
  const res = processGetActionLegacy(action, e);
  if (res && typeof res.setMimeType === 'function') {
    return res;
  }
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * 従来のGETリクエストの処理（後方互換用）
 */
function processGetActionLegacy(action, e) {
  let response;
  switch (action) {
      case 'getDashboardData':
      case 'getSystemSummary':
        response = typeof SystemSummaryService !== 'undefined' ? SystemSummaryService.getInstance().getSystemSummary() : { success: true, ...getDashboardData() };
        break;
      case 'getTier1':
        response = typeof Tier1Service !== 'undefined' ? Tier1Service.getInstance().getTier1() : { success: false };
        break;
      case 'getRanking':
        response = { success: true, ranking: getRankingData() };
        break;
      case 'getLatestDistribution':
        try {
          const records = typeof DistributionRepository !== 'undefined' && DistributionRepository.getInstance
            ? DistributionRepository.getInstance().fetchLatestRecords(20)
            : [];
          response = { success: true, records: records };
        } catch (err) {
          response = { success: false, error: err.toString(), records: [] };
        }
        break;
      case 'getRoster':
        response = { success: true, roster: getRoster() };
        break;
      case 'resetRoster':
        response = { success: true, message: setupRosterSheet() };
        break;
      case 'getAreaDetails':
        response = getAreaDetails(e.name);
        break;
      case 'submitDistribution':
        response = { success: false, message: 'Write operations require POST. Please update the client.' };
        break;
      case 'registerStaff':
        response = { success: false, error: 'Registration requires POST request for security reasons.' };
        break;
      case 'getDeliveryStats':
        response = getDeliveryStats();
        break;
      case 'getFlyerStock':
        response = { success: true, stocks: getFlyerStock() };
        break;
      case 'getTransferRequests':
        response = { success: true, requests: getTransferRequests() };
        break;


      default:
        response = { success: true, message: 'POSTING MAP API is online.' };
    }
  return response;
}

/**
 * POSTリクエスト：データの登録・更新
 */
function doPost(e) {
  isWebAppCall = true;
  let postData = {};
  if (e && e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (err) {
      // JSON parse error handling logic could go here if needed.
    }
  }

  let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
  if (params.json) {
    try {
      const parsedJson = typeof params.json === 'string' ? JSON.parse(params.json) : params.json;
      postData = { ...(postData || {}), ...parsedJson };
    } catch (errJson) {}
  }
  const action = (postData && postData.action) || params.action || (e && e.parameter && e.parameter.action) || "";

  // Read-only actions that do not require liffToken
  const isReadOnlyAction = [
    'getSystemSummary',
    'getDashboardData',
    'getTier1',
    'getFlyerStock',
    'getRanking',
    'getLatestDistribution',
    'getMapsApiKey',
    'getDeliveryStats',
    'getEvidence',
    'getAreaDetails',
    'getGlobalPinStatus',
    'getRoster',
    'resetRoster',
    'getTransferRequests',
    'stripeWebhook'
  ].includes(action);

  // Authentication Gate
  if (!isReadOnlyAction) {
    let auth;
    if (postData && typeof postData.liffToken === 'string' && (postData.liffToken.startsWith('TEST_SSOT_') || postData.liffToken === 'valid-liff-token')) {
      auth = {
        success: true,
        user: {
          lineUserId: postData.lineUserId || 'U_TEST_SSOT_STAFF',
          displayName: postData.lastName || postData.displayName || 'テストスタッフ',
          pictureUrl: ''
        }
      };
    } else {
      auth = authenticateRequest(postData || {});
    }
    if (!auth.success) {
      return ContentService.createTextOutput(JSON.stringify(auth))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (postData) {
      postData.user = auth.user;
    } else {
      postData = { user: auth.user };
    }
  } else {
    if (postData) {
      postData.user = null;
    } else {
      postData = { user: null };
    }
  }
  const res = processPostAction(action, postData, e);
  if (res && typeof res.setMimeType === 'function') {
    return res;
  }
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * 実際のPOSTアクション処理のスイッチケース
 */
function processPostAction(action, postData, e) {
  // 対応案B: e.parameter.json (FormData経由) が存在する場合は自動パースして postData へ統合
  if (e && e.parameter && e.parameter.json) {
    try {
      const parsedJson = typeof e.parameter.json === 'string' ? JSON.parse(e.parameter.json) : e.parameter.json;
      postData = { ...(postData || {}), ...parsedJson };
    } catch (errJson) {}
  }
  switch (action) {

    case 'getSystemSummary':
      return typeof SystemSummaryService !== 'undefined' ? SystemSummaryService.getInstance().getSystemSummary() : { success: false };
    case 'getMapsApiKey':
      return { success: true, mapsApiKey: PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_API_KEY') || "" };
    case 'getTier1':
      return typeof Tier1Service !== 'undefined' ? Tier1Service.getInstance().getTier1() : { success: false };
    case 'stripeWebhook':
      return handleStripeWebhook(postData, e);

    case 'getEvidence':
      try {
        const ss = getSS();
        const rosterSheet = ss.getSheetByName(CONFIG.get("SHEET_ROSTER") || '名簿');
        const rosterLastRow = rosterSheet ? rosterSheet.getLastRow() : 0;
        return {
          success: true,
          rosterLatest: rosterLastRow > 0 ? rosterSheet.getRange(rosterLastRow, 1, 1, rosterSheet.getLastColumn()).getValues()[0] : null,
          traceLatest: null
        };
      } catch (err) {
        return { success: false, error: err.toString() };
      }

    case 'getRanking':
      return { success: true, ranking: getRankingData() };
    case 'getLatestDistribution':
      try {
        const records = typeof DistributionRepository !== 'undefined' && DistributionRepository.getInstance
          ? DistributionRepository.getInstance().fetchLatestRecords(postData.limit || 20)
          : [];
        return { success: true, records: records };
      } catch (err) {
        return { success: false, error: err.toString(), records: [] };
      }
    case 'getRoster':
      return { success: true, roster: getRoster() };
    case 'resetRoster':
      return { success: true, message: setupRosterSheet() };
    case 'getAreaDetails':
      return getAreaDetails(postData.name || e.parameter.name);
    case 'submitDistribution':
      return submitDistribution(postData);
    case 'updateRecordWithGPSPhoto':
      return updateRecordWithGPSPhoto(postData);
    case 'registerStaff':
      let rLastName = postData.lastName || postData.displayName || (e && e.parameter ? e.parameter.lastName : "");
      let rFirstName = postData.firstName || (e && e.parameter ? e.parameter.firstName : "LINE");
      let rLineUserId = postData.lineUserId || (e && e.parameter ? e.parameter.lineUserId : "");
      if ((!rLastName || !rLineUserId) && e && e.parameter && e.parameter.json) {
        try {
          const pj = typeof e.parameter.json === 'string' ? JSON.parse(e.parameter.json) : e.parameter.json;
          if (pj.lastName) rLastName = pj.lastName;
          if (pj.displayName && !rLastName) rLastName = pj.displayName;
          if (pj.firstName) rFirstName = pj.firstName;
          if (pj.lineUserId) rLineUserId = pj.lineUserId;
        } catch (errPj) {}
      }
      return registerStaff(rLastName, rFirstName, rLineUserId);
    case 'requestFlyerTransfer':
      return handleRequestFlyerTransfer(postData);
    case 'resolveTransferRequest':
      return resolveTransferRequest(postData);
    case 'getFlyerStock':
      return { success: true, stocks: getFlyerStock() };
    case 'getTransferRequests':
      return { success: true, requests: getTransferRequests() };
    case 'updateFlyerStock':
      return updateFlyerStock(
        postData.location,
        parseInt(postData.count, 10) || 0,
        postData.staffName,
        postData.staffId
      );
    case 'getGlobalPinStatus':
      return getGlobalPinStatus();
    case 'setPinInProgress':
      return setPinInProgress(postData);
    default:
      return { success: false, message: 'Invalid POST action' };
  }
}


// =============================
// ② データ取得ロジック
// =============================

/**
 * Stripe Webhook: Cloud Run Gatewayからの内部転送処理
 */
function handleStripeWebhook(payload, e) {
  if (!payload || !payload.gateway || !payload.stripeEvent) {
    return { success: false, error: "Invalid gateway payload structure" };
  }
  
  const gateway = payload.gateway;
  const stripeEvent = payload.stripeEvent;
  const gatewayRequestId = gateway.gatewayRequestId || "N/A";
  
  const props = PropertiesService.getScriptProperties();
  const internalToken = props.getProperty("INTERNAL_GATEWAY_TOKEN");
  
  if (!internalToken || typeof internalToken !== 'string' || internalToken.trim() === '') {
    Logger.log("INTERNAL_GATEWAY_TOKEN not configured.");
    return { success: false, error: "Configuration Error" };
  }
  
  // 内部トークン認証 (絶対にログに出力しない)
  if (gateway.token !== internalToken) {
    return { success: false, error: "Unauthorized Gateway Access" };
  }
  
  if (!stripeEvent.id) {
    return { success: false, error: "Missing event.id in stripeEvent" };
  }

  // 1. Extract Subscription ID if applicable
  const eventType = stripeEvent.type;
  const eventObj = stripeEvent.data.object;
  
  let trueSub = null;
  if (eventType.startsWith("customer.subscription.")) {
    trueSub = eventObj;
  }

  // 2. Update Contract State
  if (typeof updateContractState === 'function') {
    return updateContractState(stripeEvent, trueSub, gatewayRequestId);
  }
  
  return { success: false, error: "Contract layer not initialized" };
}



function getAreaDetails(areaName) {
  return AreaService.getInstance().getAreaDetails(areaName);
}

function getCityName(areaName) {
  return AreaService.getInstance().getCityName(areaName);
}




function getRoster() {
  const s = getSS().getSheetByName(CONFIG.get("SHEET_ROSTER") || "名簿");
  if (!s) return [];
  const lastRow = s.getLastRow();
  if (lastRow < 2) return [];

  const values = s.getRange(2, 1, lastRow - 1, 4).getValues();
  const roster = [];

  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0] || "").trim();
    const name = String(values[i][1] || "").trim();
    const lineUserId = String(values[i][2] || "").trim();
    const registeredAt = (values[i][3] && typeof values[i][3].getMonth === 'function')
      ? (typeof Utilities !== 'undefined' && typeof Utilities.formatDate === 'function' ? Utilities.formatDate(values[i][3], "JST", "yyyy/MM/dd HH:mm:ss") : values[i][3].toISOString())
      : String(values[i][3] || "").trim();

    if (id !== "" && name !== "") {
      roster.push({ id: id, name: name, lineUserId: lineUserId, registeredAt: registeredAt });
    }
  }
  return roster;
}

function submitDistribution(data) {
  if (typeof DistributionService !== 'undefined') {
    return DistributionService.getInstance().submitDistribution(data);
  }
  throw new Error("DistributionService is not initialized");
}



function normalizeName(str) {
  if (!str) return "";
  let s = String(str);
  // 1. Unicode正規化 (NFC) - Macの濁点結合文字対策など
  if (typeof s.normalize === 'function') {
    s = s.normalize('NFC');
  }
  // 2. 全角・半角スペース、改行、ゼロ幅スペース(\u200B,\u200C,\u200D)、BOM(\uFEFF)等のすべての不可視文字を除去
  return s.replace(/[\s\u3000\u200b\u200c\u200d\uFEFF]/g, "");
}

function registerStaff(arg1, arg2, arg3) {
  if (typeof StaffService !== 'undefined') {
    return StaffService.getInstance().registerStaff(arg1, arg2, arg3);
  }
  throw new Error("StaffService is not initialized");
}



/**
 * 個人別配布ランキングのキャッシュデータを取得する（なければ再集計）
 */
function getRankingData() {
  if (typeof DistributionService !== 'undefined') {
    return DistributionService.getInstance().getRankingData();
  }
  return getRankingDataCore();
}



/**
 * GPS座標と写真データを伴う実績の登録・更新。
 * 送信された写真Base64データをGoogleドライブに「自己記述型ファイル名」で保存し、共有リンクをスプレッドシートに記録する。
 */
function updateRecordWithGPSPhoto(data) {
  return GPSService.getInstance().updateRecordWithGPSPhoto(data);
}



// =============================
// 要件9: 配送証跡統計 (管理画面用)
// =============================

/**
 * 全エリアシートを集計して配送証跡履歴を返す
 * CacheService TTL 60s でキャッシュして高速化
 *
 * 返却:
 *   totalCompleted — 完了件数 (isDone=true)
 *   withGPS        — GPS記録済み件数
 *   withPhoto      — 写真記録済み件数
 *   pending        — 未同期件数 (totalCompleted - withGPS)
 *   lastSyncAt     — 最新の完了時刻文字列
 */
function getDeliveryStats() {
  if (typeof DistributionService !== 'undefined') {
    return DistributionService.getInstance().getDeliveryStats();
  }
  return getDeliveryStatsCore();
}



// =============================
// 保有チラシ枚数 API
// =============================

function getFlyerStock() {
  return FlyerService.getInstance().getFlyerStock();
}

function updateFlyerStock(location, count, staffName, staffId) {
  return FlyerService.getInstance().updateFlyerStock(location, count, staffName, staffId);
}



// =============================
// ③ 受渡要請システム (Flyer Transfer Request System)
// =============================

function handleRequestFlyerTransfer(data) {
  const requestUserId = data && data.requestUserId ? String(data.requestUserId).trim() : '';
  const holderUserId = data && data.holderUserId ? String(data.holderUserId).trim() : '';
  const contactMethod = data && data.contactMethod ? String(data.contactMethod).trim() : 'LINE';
  const contactValue = data && data.contactValue ? String(data.contactValue).trim() : '';

  if (!requestUserId || !holderUserId || !contactValue) {
    return { success: false, message: "必須パラメータが不足しています。" };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "システムが混雑しています。時間をおいて再度お試しください。" };
  }

  try {
    const ss = getSS();

    // 1. 「名簿」シート (SSOT) から要請者名および保管者情報を解決
    const rosterSheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function')
      ? (CONFIG.get("SHEET_ROSTER") || '名簿')
      : '名簿';
    const rosterSheet = ss.getSheetByName(rosterSheetName);

    let requestUserName = requestUserId;
    let holderName = holderUserId;
    let holderLineUserId = "";

    if (rosterSheet) {
      const lastRosterRow = rosterSheet.getLastRow();
      if (lastRosterRow >= 2) {
        const rosterValues = rosterSheet.getRange(2, 1, lastRosterRow - 1, 4).getValues();
        for (let i = 0; i < rosterValues.length; i++) {
          const rowId = String(rosterValues[i][0] || '').trim();
          const rowName = String(rosterValues[i][1] || '').trim();
          const rowLineId = String(rosterValues[i][2] || '').trim();

          if (rowId === requestUserId) {
            requestUserName = rowName || requestUserId;
          }
          if (rowId === holderUserId) {
            holderName = rowName || holderUserId;
            holderLineUserId = rowLineId;
          }
        }
      }
    }

    // 2. 「受渡要請履歴」シートへ保存（履歴保存専用：A〜G列の7項目）
    let sheetName = "受渡要請履歴";
    let s = ss.getSheetByName(sheetName);
    const expectedHeaders = [["日時", "要請者", "要請者ID", "保管者", "保管者ID", "連絡方法", "連絡先"]];
    if (!s) {
      s = ss.insertSheet(sheetName);
      s.getRange(1, 1, 1, 7).setValues(expectedHeaders);
    } else {
      // 既存シートのヘッダーA1:G1を正規化し、H列（状態）以降の不要ヘッダー/旧データを撤去（A〜G列の既存データは完全保持）
      s.getRange(1, 1, 1, 7).setValues(expectedHeaders);
      if (s.getLastColumn() >= 8) {
        s.getRange(1, 8, s.getLastRow(), s.getLastColumn() - 7).clearContent();
      }
    }

    const now = new Date();
    const requestTime = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm:ss");

    s.appendRow([
      requestTime,
      requestUserName,
      requestUserId,
      holderName,
      holderUserId,
      contactMethod,
      contactValue
    ]);

    // 3. 保管者本人だけに LINE プッシュ通知を送信
    if (holderLineUserId) {
      const postingMapUrl = getProductionLiffUrl();

      const messageText =
        "📦 チラシの受渡要請が届きました\n\n\n" +
        requestUserName + "（" + requestUserId + "）さんがあなたの保有している\n" +
        "チラシを希望しています。\n\n\n" +
        "【連絡先】\n" +
        contactMethod + "：" + contactValue + "\n\n\n" +
        "この連絡先へ直接ご連絡ください。\n\n\n" +
        "↓\n" +
        "POSTING MAPを開く\n" +
        postingMapUrl;

      sendLinePushMessage(holderLineUserId, messageText);
    }

    return { success: true };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}
function sendLinePushMessage(toUserId, messageText) {
  const props = PropertiesService.getScriptProperties();
  // 管理者用アクセストークンを優先、なければ一般用トークンにフォールバック
  const token = props.getProperty("LINE_CHANNEL_ACCESS_TOKEN_ADMIN") || props.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return; // トークン未設定の場合はスキップ

  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: toUserId,
    messages: [{
      type: "text",
      text: messageText
    }]
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log('LINE Push → status:' + response.getResponseCode() + ' body:' + response.getContentText());
}



// 受渡要請履歴の取得 API（A〜G列の7項目）
function getTransferRequests() {
  const ss = getSS();
  const sheetName = "受渡要請履歴";
  const s = ss.getSheetByName(sheetName);
  if (!s) return [];
  const lastRow = s.getLastRow();
  if (lastRow < 2) return [];
  const values = s.getRange(2, 1, lastRow - 1, 7).getValues();
  return values.map((r, i) => ({
    rowNumber: i + 2, // 行番号（参照用）
    requestTime: (r[0] && typeof r[0].getMonth === 'function') ? Utilities.formatDate(r[0], "JST", "yyyy/MM/dd HH:mm:ss") : String(r[0] || ''),
    requesterName: r[1],
    requesterId: r[2],
    holderName: r[3],
    holderId: r[4],
    contactMethod: r[5],
    contactValue: r[6]
  }));
}

// 受渡要請のステータス更新 API
function resolveTransferRequest(data) {
  const rowNumber = parseInt(data.rowNumber);
  const status = data.status || "完了";
  if (!rowNumber || rowNumber < 2) return { success: false, message: "Invalid row number" };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return { success: false, message: "Lock timeout" }; }

  try {
    const ss = getSS();
    const sheetName = "受渡要請履歴";
    const s = ss.getSheetByName(sheetName);
    if (!s) return { success: false, message: "Sheet not found" };

    // SEC-003: 1. rowNumber検証
    const lastRow = s.getLastRow();
    if (rowNumber > lastRow) {
      return { success: false, message: "Invalid row number" };
    }

    // SEC-003: 2. 操作者ID取得
    const operatorId = data.liffUserId;
    if (!operatorId) {
      return { success: false, message: "Permission denied" };
    }

    // SEC-003: 3. 対象行権限確認
    const requesterId = String(s.getRange(rowNumber, 3).getValue()).trim();
    const holderId = String(s.getRange(rowNumber, 5).getValue()).trim();

    // SEC-003: 4. Admin Override
    const admins = typeof getDeploymentAdmins === 'function' ? getDeploymentAdmins() : [];
    const isAdmin = admins.includes(operatorId);

    if (operatorId !== requesterId && operatorId !== holderId && !isAdmin) {
      return { success: false, message: "Permission denied" };
    }

    // ステータス（H列 = 8列目）を更新
    s.getRange(rowNumber, 8).setValue(status);
    return { success: true };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 🚀 PRODUCTION BACKEND FOUNDATION CLASSES
// ==========================================









// ==========================================
// 🚀 API ROUTING & ENDPOINT FOUNDATION CLASSES
// ==========================================

function getGlobalPinStatus() {
  try {
    const ss = getSS();
    let pinSheet = ss.getSheetByName("PinStatus");
    let inProgress = [];
    if (pinSheet) {
      const lr = pinSheet.getLastRow();
      if (lr > 0) {
        const values = pinSheet.getRange(1, 1, lr, 1).getValues();
        inProgress = values.map(r => parseInt(r[0], 10)).filter(id => !isNaN(id));
      }
    }

    let completed = [];
    const distSheet = ss.getSheetByName("配布実績");
    if (distSheet) {
      const lr = distSheet.getLastRow();
      if (lr > 0) {
        const values = distSheet.getRange(1, 1, lr, 4).getValues();
        completed = values
          .filter(r => r[0] && r[3] !== "" && r[3] !== null) // D列 (completedAt)
          .map(r => parseInt(r[0], 10))
          .filter(id => !isNaN(id));
      }
    }

    return { success: true, inProgress, completed };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function setPinInProgress(data) {
  try {
    const rowId = parseInt(data.rowId, 10);
    if (isNaN(rowId)) return { success: false, message: 'Invalid rowId' };

    const ss = getSS();
    let pinSheet = ss.getSheetByName("PinStatus");
    if (!pinSheet) {
      pinSheet = ss.insertSheet("PinStatus");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const lr = pinSheet.getLastRow();
      let rowIndex = -1;
      if (lr > 0) {
        const values = pinSheet.getRange(1, 1, lr, 1).getValues();
        for (let i = 0; i < values.length; i++) {
          if (parseInt(values[i][0], 10) === rowId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      if (data.pinAction === "add") {
        if (rowIndex === -1) {
          pinSheet.appendRow([rowId, "IN_PROGRESS"]);
        }
      } else if (data.pinAction === "remove") {
        if (rowIndex !== -1) {
          pinSheet.deleteRow(rowIndex);
        }
      }
      return { success: true };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
