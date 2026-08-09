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

  // Authentication Gate
  const auth = authenticateRequest(params);
  if (!auth.success) {
    return ContentService.createTextOutput(JSON.stringify(auth))
      .setMimeType(ContentService.MimeType.JSON);
  }
  e.user = auth.user;
  const action = params.action || "";
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
      case 'getTier2':
        {
          const targetCity = (e && e.parameter && (e.parameter.cityName || e.parameter.city)) ? (e.parameter.cityName || e.parameter.city) : (typeof postData !== 'undefined' && postData ? postData.cityName : null);
          response = typeof Tier2Service !== 'undefined' ? Tier2Service.getInstance().getTier2(targetCity) : { success: false };
        }
        break;
      case 'getTier3':
        {
          const targetCity = (e && e.parameter && (e.parameter.cityName || e.parameter.city)) ? (e.parameter.cityName || e.parameter.city) : (typeof postData !== 'undefined' && postData ? postData.cityName : null);
          const targetTown = (e && e.parameter && (e.parameter.townName || e.parameter.town)) ? (e.parameter.townName || e.parameter.town) : (typeof postData !== 'undefined' && postData ? postData.townName : null);
          response = typeof Tier3Service !== 'undefined' ? Tier3Service.getInstance().getTier3(targetCity, targetTown) : { success: false };
        }
        break;
      case 'getRanking':
        response = { success: true, ranking: getRankingData() };
        break;
      case 'getRoster':
        response = { success: true, roster: getRoster() };
        break;
      case 'getAreaDetails':
        response = getAreaDetails(e.name);
        break;
      case 'getCityAreaDetails':
        response = getCityAreaDetails(e.cityName);
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

  const action = params.action || (postData && postData.action) || "";

  // Authentication Gate
  const auth = authenticateRequest(postData || {});
  if (!auth.success) {
    // getMapsApiKey のみ未ログインでも通過を許可する (バイパス)
    if (action !== 'getMapsApiKey') {
      return ContentService.createTextOutput(JSON.stringify(auth))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  if (postData) {
    postData.user = auth.user;
  } else {
    postData = { user: auth.user };
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
    case 'getTier2':
      return typeof Tier2Service !== 'undefined' ? Tier2Service.getInstance().getTier2(postData ? postData.cityName : null) : { success: false };
    case 'getTier3':
      return typeof Tier3Service !== 'undefined' ? Tier3Service.getInstance().getTier3(postData ? postData.cityName : null, postData ? postData.townName : null) : { success: false };

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
    case 'getRoster':
      return { success: true, roster: getRoster() };
    case 'getAreaDetails':
      return getAreaDetails(postData.name || e.parameter.name);
    case 'getCityAreaDetails':
      return getCityAreaDetails(postData.cityName || e.parameter.cityName);
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
    case 'updateFlyerStock':
      return updateFlyerStock(
        postData.location,
        parseInt(postData.count, 10) || 0,
        postData.staffName,
        postData.staffId
      );
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

function getCityAreaDetails(cityName) {
  return AreaService.getInstance().getCityAreaDetails(cityName);
}



function getRoster() {
  const s = getSS().getSheetByName(CONFIG.get("SHEET_ROSTER"));
  if (!s) return [];
  const lastRow = s.getLastRow();
  if (lastRow < 2) return [];
  
  const values = s.getRange(2, 1, lastRow - 1, 3).getValues();
  const roster = [];
  
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0] || "").trim();
    const name = String(values[i][1] || "").trim();
    
    if (id !== "" && name !== "") {
      roster.push({ id: id, name: name });
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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "システムが混雑しています。時間をおいて再度お試しください。" };
  }

  try {
    const ss = getSS();
    let sheetName = "受渡要請履歴";
    let s = ss.getSheetByName(sheetName);
    if (!s) {
      s = ss.insertSheet(sheetName);
      s.getRange(1, 1, 1, 8).setValues([["日時", "要請者", "要請者ID", "保管者", "保管者ID", "地区", "在庫枚数", "状態"]]);
    }

    const now = new Date();
    const requestTime = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm:ss");

    s.appendRow([
      requestTime,
      data.requestUserName,
      data.requestUserId,
      data.holderName,
      data.holderUserId,
      data.requestArea,
      data.stockCount,
      "申請中"
    ]);

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



// 受渡要請履歴の取得 API
function getTransferRequests() {
  const ss = getSS();
  const sheetName = "受渡要請履歴";
  const s = ss.getSheetByName(sheetName);
  if (!s) return [];
  const lastRow = s.getLastRow();
  if (lastRow < 2) return [];
  const values = s.getRange(2, 1, lastRow - 1, 8).getValues();
  return values.map((r, i) => ({
    rowNumber: i + 2, // 行番号（更新用）
    requestTime: (r[0] && typeof r[0].getMonth === 'function') ? Utilities.formatDate(r[0], "JST", "yyyy/MM/dd HH:mm:ss") : String(r[0] || ''),
    requesterName: r[1],
    requesterId: r[2],
    holderName: r[3],
    holderId: r[4],
    areaName: r[5],
    count: parseFloat(r[6]) || 0,
    status: r[7] || "申請中"
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
