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
    'getGlobalPinStatus'
  ].includes(action);

  const isDashboardAction = [
    'getRoster',
    'getTransferRequests'
  ].includes(action);

  if (action === 'registerOrValidateDevice') {
    const regResult = registerOrValidateDevice(params);
    return ContentService.createTextOutput(JSON.stringify(regResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'resetDeviceManagement') {
    const rstResult = resetDeviceManagementSheet();
    return ContentService.createTextOutput(JSON.stringify(rstResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (isDashboardAction) {
    const dashAuth = authenticateDashboardRequest(params);
    if (!dashAuth.success) {
      return ContentService.createTextOutput(JSON.stringify(dashAuth))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (!isReadOnlyAction) {
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
      case 'resetDeviceManagement':
        response = resetDeviceManagementSheet();
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
  let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
  let postData = null;
  if (e && e.postData && e.postData.contents) {
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (errP) {}
  }
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
    'getGlobalPinStatus'
  ].includes(action);

  const isDashboardAction = [
    'getRoster',
    'getTransferRequests'
  ].includes(action);

  if (action === 'registerOrValidateDevice') {
    const regResult = registerOrValidateDevice(postData || params || {});
    return ContentService.createTextOutput(JSON.stringify(regResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'resetDeviceManagement') {
    const rstResult = resetDeviceManagementSheet();
    return ContentService.createTextOutput(JSON.stringify(rstResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'issueMobilePairingToken') {
    const issueResult = issueMobilePairingToken(postData || params || {});
    return ContentService.createTextOutput(JSON.stringify(issueResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'pairMobileDevice') {
    const pairResult = pairMobileDevice(postData || params || {});
    return ContentService.createTextOutput(JSON.stringify(pairResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (isDashboardAction) {
    const dashAuth = authenticateDashboardRequest(postData || params || {});
    if (!dashAuth.success) {
      return ContentService.createTextOutput(JSON.stringify(dashAuth))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (!isReadOnlyAction) {
    const auth = authenticateRequest(postData || {});
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
    case 'resetDeviceManagement':
      return resetDeviceManagementSheet();
    case 'getAreaDetails':
      return getAreaDetails(postData.name || e.parameter.name);
    case 'submitDistribution':
      return submitDistribution(postData);
    case 'updateRecordWithGPSPhoto':
      return updateRecordWithGPSPhoto(postData);
    case 'registerStaff':
      let rLastName = postData.lastName || postData.displayName || (e && e.parameter ? e.parameter.lastName : "");
      let rFirstName = postData.firstName || (e && e.parameter ? e.parameter.firstName : "LINE");
      let rLineUserId = (postData && postData.user && postData.user.lineUserId) ? postData.user.lineUserId : "";
      if (!rLastName && e && e.parameter && e.parameter.json) {
        try {
          const pj = typeof e.parameter.json === 'string' ? JSON.parse(e.parameter.json) : e.parameter.json;
          if (pj.lastName) rLastName = pj.lastName;
          if (pj.displayName && !rLastName) rLastName = pj.displayName;
          if (pj.firstName) rFirstName = pj.firstName;
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
  const ss = getSS();
  const sheetName = (typeof CONFIG !== 'undefined' && CONFIG.get) ? (CONFIG.get("SHEET_STORAGE") || "保有チラシ枚数") : "保有チラシ枚数";
  if (!ss || !ss.getSheetByName(sheetName)) {
    return [];
  }
  return FlyerService.getInstance().getFlyerStock();
}

function updateFlyerStock(location, count, staffName, staffId) {
  const ss = getSS();
  const sheetName = (typeof CONFIG !== 'undefined' && CONFIG.get) ? (CONFIG.get("SHEET_STORAGE") || "保有チラシ枚数") : "保有チラシ枚数";
  if (!ss || !ss.getSheetByName(sheetName)) {
    return { success: false, code: "SHEET_NOT_READY", message: "「保有チラシ枚数」シートが準備されていません（整理期間中）" };
  }
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
    if (!s) {
      return {
        success: false,
        code: "SHEET_NOT_READY",
        message: "「受渡要請履歴」シートが準備されていません。"
      };
    }
    const expectedHeaders = [["日時", "要請者", "要請者ID", "保管者", "保管者ID", "連絡方法", "連絡先"]];
    s.getRange(1, 1, 1, 7).setValues(expectedHeaders);
    if (s.getLastColumn() >= 8) {
      s.getRange(1, 8, s.getLastRow(), s.getLastColumn() - 7).clearContent();
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
      return { success: false, code: "SHEET_NOT_READY", message: "PinStatus sheet unavailable" };
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

function computeDeviceSha256(deviceKey) {
  if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) return '';
  try {
    const rawDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, deviceKey.trim(), Utilities.Charset.UTF_8);
    let hexHash = '';
    for (let i = 0; i < rawDigest.length; i++) {
      let byte = rawDigest[i];
      if (byte < 0) byte += 256;
      let hex = byte.toString(16);
      if (hex.length === 1) hex = '0' + hex;
      hexHash += hex;
    }
    return hexHash;
  } catch (e) {
    return '';
  }
}

function getOrCreateDeviceManagementSheet(ss) {
  const sheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function' && CONFIG.get("SHEET_DEVICE_MANAGEMENT")) || "端末管理";
  let sheet = ss.getSheetByName(sheetName);
  const targetHeaders = ["contractId", "status", "pcDeviceId", "pcDeviceHash", "mobileDeviceId", "mobileDeviceHash", "registeredAt", "updatedAt", "memo", "contractedPlanCount"];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
    sheet.appendRow(["CONTRACT-01", "ACTIVE", "PC-01", "", "MOBILE-01", "", nowStr, nowStr, "契約01 (基本プラン)", 1]);
    return sheet;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow >= 1 && lastCol >= 1) {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.min(lastCol, targetHeaders.length)).getValues()[0];
    if (currentHeaders[0] !== "contractId") {
      let pc01 = '', pc02 = '', mob01 = '', planCount = 1;
      if (lastRow >= 2) {
        const oldValues = sheet.getRange(2, 1, 1, Math.min(lastCol, 8)).getValues()[0];
        planCount = parseInt(oldValues[1], 10) || 1;
        pc01 = String(oldValues[2] || '').trim();
        pc02 = String(oldValues[3] || '').trim();
        mob01 = String(oldValues[4] || '').trim();
      }
      sheet.clear();
      sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
      const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
      sheet.appendRow(["CONTRACT-01", "ACTIVE", "PC-01", pc01, "MOBILE-01", mob01, nowStr, nowStr, "契約01 (旧データ引継)", planCount]);
      if (planCount >= 2 || pc02) {
        sheet.appendRow(["CONTRACT-02", "ACTIVE", "PC-02", pc02, "MOBILE-02", "", nowStr, nowStr, "契約02 (旧データ引継)", ""]);
      }
    }
  }
  return sheet;
}

function syncPropertiesDeviceHashes(ss, optSheet) {
  try {
    const sheet = optSheet || getOrCreateDeviceManagementSheet(ss || getSS());
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      PropertiesService.getScriptProperties().setProperty('COCKPIT_DEVICE_HASHES', '');
      return;
    }
    const numRows = lastRow - 1;
    const values = sheet.getRange(2, 1, numRows, 6).getValues();
    const activeHashes = [];
    for (let i = 0; i < values.length; i++) {
      const status = String(values[i][1] || '').trim().toUpperCase();
      if (status === 'ACTIVE') {
        const pcHash = String(values[i][3] || '').trim();
        const mobHash = String(values[i][5] || '').trim();
        if (pcHash) activeHashes.push(pcHash);
        if (mobHash) activeHashes.push(mobHash);
      }
    }
    PropertiesService.getScriptProperties().setProperty('COCKPIT_DEVICE_HASHES', activeHashes.join(','));
  } catch (e) {}
}

function getContractedPlanCountFromSheet(sheet) {
  try {
    if (sheet.getLastRow() >= 2) {
      const val = parseInt(sheet.getRange(2, 10).getValue(), 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (e) {}
  return 1;
}

function registerOrValidateDevice(payload) {
  const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey || payload.token);
  if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
    return {
      success: false,
      authorized: false,
      code: "MISSING_DEVICE_KEY",
      message: "端末キーが必要です。"
    };
  }

  const clientHash = computeDeviceSha256(deviceKey);
  if (!clientHash) {
    return {
      success: false,
      authorized: false,
      code: "INVALID_DEVICE_KEY",
      message: "無効な端末キーです。"
    };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return {
      success: false,
      authorized: false,
      code: "LOCK_TIMEOUT",
      message: "システムが混雑しています。再度お試しください。"
    };
  }

  try {
    const ss = getSS();
    const sheet = getOrCreateDeviceManagementSheet(ss);
    const branchName = ss.getName();
    const contractedPlanCount = getContractedPlanCountFromSheet(sheet);

    let lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
      sheet.appendRow(["CONTRACT-01", "ACTIVE", "PC-01", "", "MOBILE-01", "", nowStr, nowStr, "契約01 (基本プラン)", contractedPlanCount]);
      lastRow = sheet.getLastRow();
    }

    const numRows = lastRow - 1;
    const rows = sheet.getRange(2, 1, numRows, 10).getValues();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const contractId = String(r[0] || '').trim();
      const status = String(r[1] || '').trim().toUpperCase();
      const pcId = String(r[2] || '').trim();
      const pcHash = String(r[3] || '').trim();
      const mobId = String(r[4] || '').trim();
      const mobHash = String(r[5] || '').trim();

      if (clientHash === pcHash) {
        if (status !== 'ACTIVE') {
          return {
            success: false,
            authorized: false,
            code: "DEVICE_REVOKED",
            message: "この契約または端末は無効化されています。"
          };
        }
        syncPropertiesDeviceHashes(ss, sheet);
        return {
          success: true,
          authorized: true,
          deviceId: pcId,
          contractId: contractId,
          branchName: branchName,
          contractedPlanCount: contractedPlanCount
        };
      }

      if (clientHash === mobHash) {
        if (status !== 'ACTIVE') {
          return {
            success: false,
            authorized: false,
            code: "DEVICE_REVOKED",
            message: "この契約または端末は無効化されています。"
          };
        }
        syncPropertiesDeviceHashes(ss, sheet);
        return {
          success: true,
          authorized: true,
          deviceId: mobId,
          contractId: contractId,
          branchName: branchName,
          contractedPlanCount: contractedPlanCount
        };
      }
    }

    const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    for (let planIdx = 1; planIdx <= contractedPlanCount; planIdx++) {
      const targetContractId = "CONTRACT-" + String(planIdx).padStart(2, '0');
      const targetPcId = "PC-" + String(planIdx).padStart(2, '0');
      const targetMobId = "MOBILE-" + String(planIdx).padStart(2, '0');

      let foundRowIndex = -1;
      let foundRowData = null;

      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0] || '').trim() === targetContractId) {
          foundRowIndex = i + 2;
          foundRowData = rows[i];
          break;
        }
      }

      if (foundRowIndex > 0) {
        const rowStatus = String(foundRowData[1] || '').trim().toUpperCase();
        const existingPcHash = String(foundRowData[3] || '').trim();

        if (rowStatus === 'ACTIVE' && !existingPcHash) {
          sheet.getRange(foundRowIndex, 3).setValue(targetPcId);
          sheet.getRange(foundRowIndex, 4).setValue(clientHash);
          sheet.getRange(foundRowIndex, 8).setValue(nowStr);
          sheet.getRange(foundRowIndex, 9).setValue(targetPcId + " auto-registered (" + nowStr + ")");
          syncPropertiesDeviceHashes(ss, sheet);
          return {
            success: true,
            authorized: true,
            registered: true,
            deviceId: targetPcId,
            contractId: targetContractId,
            branchName: branchName,
            contractedPlanCount: contractedPlanCount
          };
        }
      } else {
        sheet.appendRow([targetContractId, "ACTIVE", targetPcId, clientHash, targetMobId, "", nowStr, nowStr, targetPcId + " auto-registered (" + nowStr + ")", ""]);
        syncPropertiesDeviceHashes(ss, sheet);
        return {
          success: true,
          authorized: true,
          registered: true,
          deviceId: targetPcId,
          contractId: targetContractId,
          branchName: branchName,
          contractedPlanCount: contractedPlanCount
        };
      }
    }

    return {
      success: false,
      authorized: false,
      code: "DEVICE_LIMIT_EXCEEDED",
      message: "端末契約上限に達しています。この端末は許可されていません。",
      contractedPlanCount: contractedPlanCount
    };
  } catch (err) {
    return {
      success: false,
      authorized: false,
      code: "SERVER_ERROR",
      message: err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

function authenticateDashboardRequest(payload) {
  const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey || payload.token);
  if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized: Dashboard terminal authorization required"
    };
  }

  const clientHash = computeDeviceSha256(deviceKey);
  if (!clientHash) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized: Dashboard terminal authorization required"
    };
  }

  const props = PropertiesService.getScriptProperties();
  let registeredHashesRaw = props.getProperty('COCKPIT_DEVICE_HASHES') || '';

  if (!registeredHashesRaw) {
    try {
      const ss = getSS();
      syncPropertiesDeviceHashes(ss);
      registeredHashesRaw = props.getProperty('COCKPIT_DEVICE_HASHES') || '';
    } catch (e) {}
  }

  if (!registeredHashesRaw) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized: Dashboard terminal authorization required"
    };
  }

  const registeredList = registeredHashesRaw.split(',').map(h => h.trim()).filter(Boolean);
  if (registeredList.includes(clientHash)) {
    return { success: true, authorized: true };
  }

  return {
    success: false,
    code: "UNAUTHORIZED",
    message: "Unauthorized: Dashboard terminal authorization required"
  };
}

function issueMobilePairingToken(payload) {
  const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey || payload.token);
  if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "PC端末の認証が必要です。"
    };
  }

  const clientHash = computeDeviceSha256(deviceKey);
  if (!clientHash) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "無効な端末キーです。"
    };
  }

  const pairKey = payload && payload.pairKey ? String(payload.pairKey).trim() : '';
  if (!pairKey) {
    return {
      success: false,
      code: "INVALID_PAIR_KEY",
      message: "ペアリングキーが必要です。"
    };
  }

  const ss = getSS();
  const sheet = getOrCreateDeviceManagementSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "契約情報が見つかりません。"
    };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  let matchedContractId = '';
  let matchedMobileId = '';

  for (let i = 0; i < rows.length; i++) {
    const contractId = String(rows[i][0] || '').trim();
    const status = String(rows[i][1] || '').trim().toUpperCase();
    const pcHash = String(rows[i][3] || '').trim();
    const mobId = String(rows[i][4] || '').trim();

    if (status === 'ACTIVE' && pcHash === clientHash) {
      matchedContractId = contractId;
      matchedMobileId = mobId || ("MOBILE-" + contractId.replace("CONTRACT-", ""));
      break;
    }
  }

  if (!matchedContractId) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "認証済みの契約PC端末からのみQRコードを発行できます。"
    };
  }

  const props = PropertiesService.getScriptProperties();
  const expiresAt = Date.now() + 35000;
  props.setProperty('MOBILE_PAIRING_KEY', pairKey);
  props.setProperty('MOBILE_PAIRING_EXPIRES', String(expiresAt));
  props.setProperty('MOBILE_PAIRING_CONTRACT_ID', matchedContractId);
  props.setProperty('MOBILE_PAIRING_DEVICE_ID', matchedMobileId);

  return {
    success: true,
    contractId: matchedContractId,
    mobileDeviceId: matchedMobileId
  };
}

function pairMobileDevice(payload) {
  const pairKey = payload && payload.pairKey ? String(payload.pairKey).trim() : '';
  const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey);

  if (!pairKey || !deviceKey) {
    return {
      success: false,
      code: "MISSING_PARAMS",
      message: "ペアリングキーと端末キーが必要です。"
    };
  }

  const clientHash = computeDeviceSha256(deviceKey);
  if (!clientHash) {
    return {
      success: false,
      code: "INVALID_DEVICE_KEY",
      message: "無効な端末キーです。"
    };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return {
      success: false,
      code: "LOCK_TIMEOUT",
      message: "システムが混雑しています。再度お試しください。"
    };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const storedPairKey = props.getProperty('MOBILE_PAIRING_KEY') || '';
    const storedExpires = parseInt(props.getProperty('MOBILE_PAIRING_EXPIRES') || '0', 10);
    const targetContractId = props.getProperty('MOBILE_PAIRING_CONTRACT_ID') || '';
    const targetMobileId = props.getProperty('MOBILE_PAIRING_DEVICE_ID') || '';

    if (!storedPairKey || storedPairKey !== pairKey || Date.now() > storedExpires || !targetContractId) {
      return {
        success: false,
        code: "EXPIRED_PAIR_KEY",
        message: "QRコードの有効期限（30秒）が切れているか無効です。PC画面で再発行してください。"
      };
    }

    const ss = getSS();
    const sheet = getOrCreateDeviceManagementSheet(ss);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: false,
        code: "CONTRACT_NOT_FOUND",
        message: "契約情報が見つかりません。"
      };
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    let targetRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const contractId = String(rows[i][0] || '').trim();
      const status = String(rows[i][1] || '').trim().toUpperCase();
      if (contractId === targetContractId && status === 'ACTIVE') {
        targetRowIndex = i + 2;
        break;
      }
    }

    if (targetRowIndex < 0) {
      return {
        success: false,
        code: "CONTRACT_INACTIVE",
        message: "対象の契約が無効化されているか存在しません。"
      };
    }

    const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
    const mobileDeviceId = targetMobileId || ("MOBILE-" + targetContractId.replace("CONTRACT-", ""));

    sheet.getRange(targetRowIndex, 5).setValue(mobileDeviceId);
    sheet.getRange(targetRowIndex, 6).setValue(clientHash);
    sheet.getRange(targetRowIndex, 8).setValue(nowStr);
    sheet.getRange(targetRowIndex, 9).setValue(mobileDeviceId + " registered via QR (" + nowStr + ")");

    syncPropertiesDeviceHashes(ss, sheet);

    props.deleteProperty('MOBILE_PAIRING_KEY');
    props.deleteProperty('MOBILE_PAIRING_EXPIRES');
    props.deleteProperty('MOBILE_PAIRING_CONTRACT_ID');
    props.deleteProperty('MOBILE_PAIRING_DEVICE_ID');

    return {
      success: true,
      authorized: true,
      deviceId: mobileDeviceId,
      contractId: targetContractId,
      message: "スマホ端末の登録が完了しました。"
    };
  } catch (err) {
    return {
      success: false,
      code: "SERVER_ERROR",
      message: err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

function resetDeviceManagementSheet() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Lock timeout" };
  }
  try {
    const ss = getSS();
    const sheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function' && CONFIG.get("SHEET_DEVICE_MANAGEMENT")) || "端末管理";
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      ss.deleteSheet(sheet);
    }
    sheet = getOrCreateDeviceManagementSheet(ss);
    PropertiesService.getScriptProperties().deleteProperty('COCKPIT_DEVICE_HASHES');
    PropertiesService.getScriptProperties().deleteProperty('COCKPIT_DEVICE_TOKEN_HASH');
    PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_KEY');
    PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_EXPIRES');
    PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_CONTRACT_ID');
    PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_DEVICE_ID');
    return { success: true, message: "Device management sheet reset successfully" };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}
