/**
 * GAS v2 - 純粋 JSON API エンジン
 * UI(HTML)は一切返却せず、ContentService を通じて JSON のみを応答する。
 * Version: 2.2.0-modular
 */


// =============================
// ① 基本設定
// =============================

function getMonthlySheet(type) {
  if (typeof MonthlySheetResolver !== 'undefined' && MonthlySheetResolver.getInstance) {
    return MonthlySheetResolver.getInstance().getCurrentSheet(type);
  }
  return null;
}





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
    const regResult = DeviceManagementService.getInstance().registerOrValidate(params);
    return ContentService.createTextOutput(JSON.stringify(regResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'resetDeviceManagement') {
    const rstResult = DeviceManagementService.getInstance().resetSheet();
    return ContentService.createTextOutput(JSON.stringify(rstResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getDeviceStatus') {
    const statusResult = DeviceManagementService.getInstance().getDeviceStatus();
    return ContentService.createTextOutput(JSON.stringify(statusResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (isDashboardAction) {
    const dashAuth = DeviceManagementService.getInstance().authenticateDashboard(params);
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
        response = { success: true, ranking: DistributionService.getInstance().getRankingData() };
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
        response = { success: true, roster: StaffService.getInstance().getRoster() };
        break;
      case 'resetRoster':
        response = { success: true, message: setupRosterSheet() };
        break;
      case 'resetDeviceManagement':
        response = DeviceManagementService.getInstance().resetSheet();
        break;
      case 'getAreaDetails':
        response = AreaService.getInstance().getAreaDetails(e.name);
        break;
      case 'submitDistribution':
        response = { success: false, message: 'Write operations require POST. Please update the client.' };
        break;
      case 'registerStaff':
        response = { success: false, error: 'Registration requires POST request for security reasons.' };
        break;
      case 'getDeliveryStats':
        response = DistributionService.getInstance().getDeliveryStats();
        break;
      case 'getFlyerStock':
        response = { success: true, stocks: FlyerService.getInstance().getFlyerStock() };
        break;
      case 'getTransferRequests':
        response = { success: true, requests: TransferService.getInstance().getTransferRequests() };
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
    const regResult = DeviceManagementService.getInstance().registerOrValidate(postData || params || {});
    return ContentService.createTextOutput(JSON.stringify(regResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'resetDeviceManagement') {
    const rstResult = DeviceManagementService.getInstance().resetSheet();
    return ContentService.createTextOutput(JSON.stringify(rstResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getDeviceStatus') {
    const statusResult = DeviceManagementService.getInstance().getDeviceStatus();
    return ContentService.createTextOutput(JSON.stringify(statusResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'issueMobilePairingToken') {
    const issueResult = DeviceManagementService.getInstance().issuePairingToken(postData || params || {});
    return ContentService.createTextOutput(JSON.stringify(issueResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'pairMobileDevice') {
    const pairResult = DeviceManagementService.getInstance().pairMobile(postData || params || {});
    return ContentService.createTextOutput(JSON.stringify(pairResult))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'provisionDistrict') {
    const addresses = (postData && postData.addresses) || (params && params.addresses);
    let result;
    if (typeof DistrictProvisioner !== 'undefined' && DistrictProvisioner.getInstance) {
      result = DistrictProvisioner.getInstance().provisionNewDistrict(addresses);
    } else {
      result = { success: false, message: 'DistrictProvisioner not available' };
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (isDashboardAction) {
    const dashAuth = DeviceManagementService.getInstance().authenticateDashboard(postData || params || {});
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
        const rosterSheet = getMonthlySheet('staff');
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
      return { success: true, ranking: DistributionService.getInstance().getRankingData() };
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
      return { success: true, roster: StaffService.getInstance().getRoster() };
    case 'resetRoster':
      return { success: true, message: setupRosterSheet() };
    case 'resetDeviceManagement':
      return DeviceManagementService.getInstance().resetSheet();
    case 'getAreaDetails':
      return AreaService.getInstance().getAreaDetails(postData.name || (e && e.parameter ? e.parameter.name : ""));
    case 'submitDistribution':
      return DistributionService.getInstance().submitDistribution(postData);
    case 'updateRecordWithGPSPhoto':
      return GPSService.getInstance().updateRecordWithGPSPhoto(postData);
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
      return StaffService.getInstance().registerStaff(rLastName, rFirstName, rLineUserId);
    case 'requestFlyerTransfer':
      return TransferService.getInstance().requestFlyerTransfer(postData);
    case 'resolveTransferRequest':
      return TransferService.getInstance().resolveTransferRequest(postData);
    case 'getFlyerStock':
      return { success: true, stocks: FlyerService.getInstance().getFlyerStock() };
    case 'getTransferRequests':
      return { success: true, requests: TransferService.getInstance().getTransferRequests() };
    case 'updateFlyerStock':
      return FlyerService.getInstance().updateFlyerStock(
        postData.location,
        parseInt(postData.count, 10) || 0,
        postData.staffName,
        postData.staffId
      );
    case 'getGlobalPinStatus':
      return PinStatusService.getInstance().getStatus();
    case 'setPinInProgress':
      return PinStatusService.getInstance().setInProgress(postData);
    case 'provisionDistrict':
      return typeof DistrictProvisioner !== 'undefined' && DistrictProvisioner.getInstance
        ? DistrictProvisioner.getInstance().provisionNewDistrict(postData && postData.addresses)
        : { success: false, message: 'DistrictProvisioner not available' };
    default:
      return { success: false, message: 'Invalid POST action' };
  }
}
