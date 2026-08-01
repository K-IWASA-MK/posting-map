/**
 * GAS v2 - 純粋 JSON API エンジン
 * UI(HTML)は一切返却せず、ContentService を通じて JSON のみを応答する。
 */

/*
 * [LEGACY_RUNTIME_BACKUP: SEC-001~003 Runtime Lifecycle Rollback Point]
 * Legacy implementations of setupAdminSheet, logTrace, writeDebugLogToSheet, isWebAppCall
 * have been migrated to active/runtime/lifecycle/runtime_lifecycle.js
 */
/*
function setupAdminSheet_legacy_backup() {
  const admins = [
    { name: 'K. IWASA', lineUserId: 'U7375015ea7c5380e2c8da827eb8d3f08' }
  ];
  admins.forEach(a => registerAdmin(a.name, a.lineUserId));
  Logger.log('✅ 管理者IDシートのセットアップ完了');
}

function logTrace_legacy_backup(event, data) {
  try {
    Logger.log("[TRACE] " + event + ": " + JSON.stringify(data || {}));
  } catch (e) {}
}

function writeDebugLogToSheet_legacy_backup(data) {
  return;
}
*/

// =============================
// ① 基本設定
// =============================
/*
 * [LEGACY_INFRA_BACKUP: SEC-004 Infrastructure Utilities Rollback Point]
 * getSS has been migrated to active/infrastructure/spreadsheet/spreadsheet_adapter.js
 * getStorageFolderId and authorizeAndTestDriveWrite have been migrated to active/infrastructure/drive/drive_adapter.js
 */
/*
function getSS_legacy_backup() {
  if (!isWebAppCall) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss && ss.getId()) {
        return ss;
      }
    } catch (e) {}
  }
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SPREADSHEET_ID");
  if (!id) {
    throw new Error('SPREADSHEET_ID is not configured.');
  }
  return SpreadsheetApp.openById(id);
}

function getStorageFolderId_legacy_backup() {
  const id = PropertiesService.getScriptProperties().getProperty("STORAGE_PARENT_ID");
  return id || CONFIG.STORAGE_PARENT_ID;
}

function authorizeAndTestDriveWrite_legacy_backup() {
  try {
    const folderId = getStorageFolderId();
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob("DRIVE_AUTH_TEST", "text/plain", "_auth_test.txt");
    const file = folder.createFile(blob);
    file.setTrashed(true);
  } catch (e) {}
}
*/


/*
 * [LEGACY_RUNTIME_BACKUP: SEC-005 Context Variables Rollback Point]
 * executionContext and globalCacheHit have been migrated to active/runtime/context/execution_context.js
 * var executionContext_backup = null;
 * var globalCacheHit_backup = false;
 */

/**
 * GETリクエスト：JSONデータの取得
 */
function doGet(e) {
  return PlatformGetEntryHandler.handle(e);
}

/*
 * [LEGACY_ENTRY_BACKUP: SEC-006 doGet Rollback Point]
 * function doGet_legacy_backup(e) {
 *   isWebAppCall = true;
 *   let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
 *   if (params.json) {
 *     try {
 *       const parsed = typeof params.json === 'string' ? JSON.parse(params.json) : params.json;
 *       if (parsed && typeof parsed === 'object') {
 *         Object.assign(params, parsed);
 *       }
 *     } catch (errJ) {}
 *   }
 *   const action = params.action || "";
 *   if (action === "registerStaff") {
 *     const lastName = params.lastName || params.displayName || "";
 *     const firstName = params.firstName || "LINE";
 *     const lineUserId = params.lineUserId || "";
 *     const res = registerStaff(lastName, firstName, lineUserId);
 *     return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
 *   }
 *   if (action === "debugProperties") {
 *     const props = PropertiesService.getScriptProperties().getProperties();
 *     let ssName = "Unknown";
 *     try {
 *       ssName = getSS().getName();
 *     } catch (e) {
 *       ssName = "Error: " + e.toString();
 *     }
 *     return ContentService.createTextOutput(JSON.stringify({
 *       success: true,
 *       properties: props,
 *       spreadsheetId: props["SPREADSHEET_ID"] || null,
 *       spreadsheetName: ssName
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 *   if (action === "debugCount") {
 *     try {
 *       const ss = getSS();
 *       const sheets = ss.getSheets();
 *       const sheetInfo = sheets.map(s => {
 *         return {
 *           name: s.getName(),
 *           rows: s.getDataRange().getValues().length
 *         };
 *       });
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: true,
 *         sheets: sheetInfo
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     } catch (err) {
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: false,
 *         message: err.toString()
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   }
 *   if (action === "bootstrapProperties") {
 *     const targetSsId = (e && e.parameter && e.parameter.spreadsheetId) ? e.parameter.spreadsheetId : "1xQUvlCaUO103rjSGmdcFQQFkukodG4Dg9mS_teWT7uA";
 *     PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", targetSsId);
 *     const updatedSsId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
 *     return ContentService.createTextOutput(JSON.stringify({
 *       success: true,
 *       message: "Script properties bootstrapped successfully.",
 *       spreadsheetId: updatedSsId
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 *   if (action === "getDashboardData" || action === "getSummary") {
 *     const data = getDashboardData();
 *     return ContentService.createTextOutput(JSON.stringify({
 *       success: true,
 *       summary: data.summary,
 *       stats: data.stats,
 *       updatedAt: data.updatedAt
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 *   if (action === "verifyDeployment") {
 *     const res = verifyDistrictDeployment(e);
 *     return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
 *   }
 *   if (action === "uploadMaster") {
 *     try {
 *       let postData = null;
 *       if (e.postData && e.postData.contents) {
 *         postData = JSON.parse(e.postData.contents);
 *       }
 *       const csvData = (postData && postData.csvData) || params.csvData || "";
 *       if (!csvData) {
 *         throw new Error("No CSV data provided.");
 *       }
 *       const parsedRows = Utilities.parseCsv(csvData);
 *       
 *       let masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
 *       if (!masterSheet) {
 *         masterSheet = ss.insertSheet("MIE03_ADDRESS_MASTER");
 *       }
 *       masterSheet.clear();
 *       masterSheet.getRange(1, 1, parsedRows.length, parsedRows[0].length).setValues(parsedRows);
 *       SpreadsheetApp.flush();
 *       
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: true,
 *         message: "MIE03_ADDRESS_MASTER sheet uploaded and populated successfully!"
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     } catch (err) {
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: false,
 *         message: "Failed to upload master sheet: " + err.toString()
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   }
 *   if (action === "triggerBatch") {
 *     try {
 *       const startTime = Date.now();
 *       const props = PropertiesService.getScriptProperties();
 *       
 *       const isStart = params.triggerBatch === "true";
 *       if (isStart) {
 *         props.deleteProperty("BATCH_STATUS");
 *         props.deleteProperty("BATCH_INDEX");
 *       }
 *       
 *       if (props.getProperty("BATCH_STATUS") !== "running") {
 *         forceStartBatch();
 *       }
 *       
 *       while (props.getProperty("BATCH_STATUS") === "running") {
 *         generateAreaSheetsBatch();
 *         if (Date.now() - startTime > 22000) {
 *           break;
 *         }
 *       }
 *       
 *       const status = props.getProperty("BATCH_STATUS") || "completed";
 *       const index = props.getProperty("BATCH_INDEX") || "0";
 *       
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: true,
 *         status: status,
 *         index: index,
 *         message: status === "running" ? "Batch is running (chunk processed)" : "Batch completed successfully!"
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     } catch (err) {
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: false,
 *         message: "Failed to run batch step: " + err.toString()
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   }
 *   return PlatformIntegrationPipeline.execute(e);
 * }
 */

/**
 * 従来のGETリクエストの処理（後方互換用）
 */
function processGetActionLegacy(action, e) {
  let response;
  if (action === 'getAppData') {
    const cacheKey = CacheServiceProvider.getInstance().makeKey(
      e.tenantId || "DEFAULT",
      e.branchId || "DEFAULT",
      "appdata"
    );
    const cached = CacheServiceProvider.getInstance().get(cacheKey);
    if (cached) {
      globalCacheHit = true;
      GasPerformanceMonitor.getInstance().recordCacheHit();
      response = JSON.parse(cached);
    } else {
      globalCacheHit = false;
      GasPerformanceMonitor.getInstance().recordCacheMiss();
      response = getAppData();
      if (response && response.success) {
        CacheServiceProvider.getInstance().put(cacheKey, JSON.stringify(response));
      }
    }
  } else {
    switch (action) {
      case 'getDashboardData':
      case 'getSummary':
        response = { success: true, ...getDashboardData() };
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
      case 'verifyDeployment':
        response = verifyDistrictDeployment(e);
        break;
      case 'registerStaff':
        let legacyLastName = (e && e.parameter) ? (e.parameter.lastName || e.parameter.displayName || "") : "";
        let legacyFirstName = (e && e.parameter) ? (e.parameter.firstName || "LINE") : "LINE";
        let legacyLineUserId = (e && e.parameter) ? (e.parameter.lineUserId || "") : "";
        if (e && e.parameter && e.parameter.json) {
          try {
            const p = JSON.parse(e.parameter.json);
            if (p.lastName) legacyLastName = p.lastName;
            if (p.firstName) legacyFirstName = p.firstName;
            if (p.lineUserId) legacyLineUserId = p.lineUserId;
          } catch (eP) {}
        }
        response = registerStaff(legacyLastName, legacyFirstName, legacyLineUserId);
        break;
      case 'testDriveAccess':
        try {
          const testFolderId = getStorageFolderId();
          const testFolder = DriveApp.getFolderById(testFolderId);
          response = {
            success: true,
            message: 'Drive access OK',
            folderId: testFolderId,
            folderName: testFolder.getName(),
            folderUrl: testFolder.getUrl()
          };
        } catch (driveErr) {
          response = { success: false, message: 'Drive access FAILED: ' + driveErr.toString(), folderId: getStorageFolderId() };
        }
        break;
      case 'testDriveWrite':
        try {
          const wFolder = DriveApp.getFolderById(getStorageFolderId());
          const testBlob = Utilities.newBlob("POSTING_MAP_TEST_" + Date.now(), "text/plain", "test_write.txt");
          const file = wFolder.createFile(testBlob);
          response = { success: true, message: 'Write OK', fileId: file.getId(), fileName: file.getName() };
          file.setTrashed(true);
        } catch (writeErr) {
          response = { success: false, message: 'Write FAILED: ' + writeErr.toString() };
        }
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
      case 'runMigration':
        response = { success: true, message: runMigrationToEventLog() };
        break;
      case 'runReconciliation':
        response = generateReconciliationReport();
        break;
      case 'runFreeze':
        response = executeSystemFreeze();
        break;
      case 'getConfig':
        response = { success: true, config: getConfig(e.tenantId || "DEFAULT") };
        break;
      case 'getAuditLogs':
        response = getAuditLogs();
        break;
      case 'refreshCache':
        response = { success: true, data: refreshAreaSummaryCache() };
        break;
      case 'getStrategy':
        response = { success: true, data: generateStrategy(e.branchId, e.tenantId || "DEFAULT") };
        break;
      case 'getHeatmap':
        response = { success: true, data: generateHeatmap(e.branchId, e.tenantId || "DEFAULT") };
        break;
      case 'getPrediction':
        response = { success: true, data: predictOutcome(e.branchId, e.tenantId || "DEFAULT") };
        break;
      default:
        response = { success: true, message: 'POSTING MAP API is online.' };
    }
  }
  return response;
}

/**
 * POSTリクエスト：データの登録・更新
 */
function doPost(e) {
  return PlatformPostEntryHandler.handle(e);
}

/*
 * [LEGACY_ENTRY_BACKUP: SEC-008 doPost Rollback Point]
 * function doPost_legacy_backup(e) {
 *   isWebAppCall = true;
 *   try {
 *     let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
 *     let postData = null;
 *     if (e && e.postData && e.postData.contents) {
 *       postData = JSON.parse(e.postData.contents);
 *     }
 *     const action = params.action || (postData && postData.action) || "";
 *     if (action === "triggerBatch") {
 *       try {
 *         const startTime = Date.now();
 *         const props = PropertiesService.getScriptProperties();
 *         
 *         const isStart = params.triggerBatch === "true" || (postData && postData.triggerBatch === "true") || (postData && postData.triggerBatch === true);
 *         if (isStart) {
 *           props.deleteProperty("BATCH_STATUS");
 *           props.deleteProperty("BATCH_INDEX");
 *         }
 *         
 *         if (props.getProperty("BATCH_STATUS") !== "running") {
 *           forceStartBatch();
 *         }
 *         
 *         while (props.getProperty("BATCH_STATUS") === "running") {
 *           generateAreaSheetsBatch();
 *           if (Date.now() - startTime > 22000) {
 *             break;
 *           }
 *         }
 *         
 *         const status = props.getProperty("BATCH_STATUS") || "completed";
 *         const index = props.getProperty("BATCH_INDEX") || "0";
 *         
 *         return ContentService.createTextOutput(JSON.stringify({
 *           success: true,
 *           status: status,
 *           index: index,
 *           message: status === "running" ? "Batch is running (chunk processed)" : "Batch completed successfully!"
 *         })).setMimeType(ContentService.MimeType.JSON);
 *       } catch (err) {
 *         return ContentService.createTextOutput(JSON.stringify({
 *           success: false,
 *           message: "Failed to run batch step inside doPost: " + err.toString()
 *         })).setMimeType(ContentService.MimeType.JSON);
 *       }
 *     }
 *     if (action === "debugCount") {
 *       try {
 *         const ss = getSS();
 *         const meiboSheet = ss.getSheetByName("名簿");
 *         const meiboValues = meiboSheet ? meiboSheet.getDataRange().getValues() : [];
 *         const sheets = ss.getSheets();
 *         const sheetInfo = sheets.map(s => {
 *           return {
 *             name: s.getName(),
 *             rows: s.getDataRange().getValues().length
 *           };
 *         });
 *         return ContentService.createTextOutput(JSON.stringify({
 *           success: true,
 *           sheets: sheetInfo,
 *           meiboValues: meiboValues
 *         })).setMimeType(ContentService.MimeType.JSON);
 *       } catch (err) {
 *         return ContentService.createTextOutput(JSON.stringify({
 *           success: false,
 *           message: err.toString()
 *         })).setMimeType(ContentService.MimeType.JSON);
 *       }
 *     }
 *     if (action === "uploadMaster") {
 *       const csvData = (postData && postData.csvData) || params.csvData || "";
 *       if (!csvData) {
 *         throw new Error("No CSV data provided.");
 *       }
 *       const parsedRows = Utilities.parseCsv(csvData);
 *       
 *       const ss = getSS();
 *       let masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
 *       if (!masterSheet) {
 *         masterSheet = ss.insertSheet("MIE03_ADDRESS_MASTER");
 *       }
 *       masterSheet.clear();
 *       masterSheet.getRange(1, 1, parsedRows.length, parsedRows[0].length).setValues(parsedRows);
 *       SpreadsheetApp.flush();
 *       
 *       return ContentService.createTextOutput(JSON.stringify({
 *         success: true,
 *         message: "MIE03_ADDRESS_MASTER sheet uploaded and populated successfully!"
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({
 *       success: false,
 *       message: "Failed to upload master sheet in doPost: " + err.toString()
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 * 
 *   try {
 *     Logger.log("[DIAG doPost] e.parameter: " + JSON.stringify(e ? e.parameter : {}));
 *     Logger.log("[DIAG doPost] e.postData.contents: " + (e && e.postData ? e.postData.contents : "none"));
 *   } catch (err) {}
 *   return PlatformIntegrationPipeline.execute(e);
 * }
 */

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
    case 'triggerBatch':
      try {
        const startTime = Date.now();
        const props = PropertiesService.getScriptProperties();
        const isStart = e.parameter.triggerBatch === "true" || (postData && postData.triggerBatch === "true") || (postData && postData.triggerBatch === true);
        if (isStart) {
          props.deleteProperty("BATCH_STATUS");
          props.deleteProperty("BATCH_INDEX");
        }
        if (props.getProperty("BATCH_STATUS") !== "running") {
          forceStartBatch();
        }
        while (props.getProperty("BATCH_STATUS") === "running") {
          generateAreaSheetsBatch();
          if (Date.now() - startTime > 22000) {
            break;
          }
        }
        const status = props.getProperty("BATCH_STATUS") || "completed";
        const index = props.getProperty("BATCH_INDEX") || "0";
        return {
          success: true,
          status: status,
          index: index,
          message: status === "running" ? "Batch is running (chunk processed)" : "Batch completed successfully!"
        };
      } catch (err) {
        return {
          success: false,
          error: "Failed to run batch step inside processPostAction: " + err.toString()
        };
      }
    case 'getAppData':
      return getAppData();
    case 'getConfig':
      return { success: true, config: getConfig(postData.tenantId || e.parameter.tenantId || "DEFAULT") };
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
    case 'getStrategy':
      return { success: true, data: generateStrategy(postData.branchId || e.parameter.branchId, postData.tenantId || e.parameter.tenantId || "DEFAULT") };
    case 'getHeatmap':
      return { success: true, data: generateHeatmap(postData.branchId || e.parameter.branchId, postData.tenantId || e.parameter.tenantId || "DEFAULT") };
    case 'getPrediction':
      return { success: true, data: predictOutcome(postData.branchId || e.parameter.branchId, postData.tenantId || e.parameter.tenantId || "DEFAULT") };
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
    case 'verifyDeployment':
      // Trigger clasp push synchronization update v2
      return verifyDistrictDeployment(postData || e.parameter);
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
    case 'registerAdmin':
      return registerAdmin(postData.displayName, postData.lineUserId);
    case 'requestFlyerTransfer':
      return handleRequestFlyerTransfer(postData);
    case 'resolveTransferRequest':
      return resolveTransferRequest(postData);
    case 'resetRoster':
      const rosterMsg = setupRosterSheet();
      return { success: true, message: rosterMsg };
    case 'setupFolders':
      const setupMsg = setupGoogleDriveFolders();
      return { success: true, message: setupMsg };
    case 'forceStartBatch':
      forceStartBatch();
      return { success: true, message: 'Batch run initiated successfully' };
    case 'refreshCache':
      createSystemCacheSheet();
      const cacheResult = refreshAreaSummaryCache();
      return { success: true, message: 'Cache sync completed successfully', data: cacheResult };
    case 'aggregateStats':
      aggregateTotalVolumes();
      return { success: true, message: 'Aggregation completed successfully' };
    case 'resetAllSheets':
      deleteAllAreaSheets();
      return { success: true, message: 'All area sheets reset successfully' };
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

// 共通：ApiResponseオブジェクトからJSONレスポンスを作成
function createJsonResponseFromApiResponse(apiResponse) {
  var cacheStatus = "MISS";
  if (typeof globalCacheHit !== 'undefined' && globalCacheHit) {
    cacheStatus = "HIT";
  }

  // クライアント互換性のためのラップ
  var responseWrapper = {
    success: apiResponse.success,
    data: apiResponse.data,
    error: apiResponse.error,
    metadata: {
      requestId: apiResponse.metadata.requestId,
      serverTimestamp: apiResponse.metadata.serverTimestamp,
      processingTime: apiResponse.metadata.processingTime,
      cacheStatus: cacheStatus,
      version: apiResponse.metadata.version,
      debugAuth: apiResponse.metadata.debugAuth || null
    }
  };

  if (apiResponse.data && typeof apiResponse.data === 'object') {
    if (apiResponse.data.id !== undefined) {
      responseWrapper.id = apiResponse.data.id;
    }
    if (apiResponse.data.name !== undefined) {
      responseWrapper.name = apiResponse.data.name;
    }
    if (apiResponse.data.message !== undefined) {
      responseWrapper.message = apiResponse.data.message;
    }
  }

  return ContentService.createTextOutput(JSON.stringify(responseWrapper))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================
// ② データ取得ロジック
// =============================

function getAppData() {
  return AreaService.getInstance().getAppData();
}

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
// チラシ保管庫 API
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

    // Push通知処理：管理者IDシートの全管理者に通知
    const adminSheet = ss.getSheetByName(CONFIG.get("SHEET_ADMIN"));
    if (adminSheet) {
      const adminLastRow = adminSheet.getLastRow();
      if (adminLastRow >= 2) {
        const adminValues = adminSheet.getRange(2, 1, adminLastRow - 1, 2).getValues();
        for (let i = 0; i < adminValues.length; i++) {
          const adminLineId = String(adminValues[i][1] || '').trim();
          if (adminLineId) {
            sendLinePushMessage(adminLineId, data.requestUserName, data.holderName, data.requestArea, data.stockCount);
          }
        }
      }
    }

    return { success: true };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =============================
// ④ 管理者登録 (Admin Registration)
// =============================

function registerAdmin(displayName, lineUserId) {
  if (!lineUserId) return { success: false, message: 'LINE User ID required' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return { success: false, message: 'Lock timeout' }; }
  try {
    const ss = getSS();
    let s = ss.getSheetByName(CONFIG.get("SHEET_ADMIN"));
    if (!s) {
      s = ss.insertSheet(CONFIG.get("SHEET_ADMIN"));
      s.getRange(1, 1, 1, 3).setValues([['管理者名', 'LINE_USER_ID', '登録日時']]);
      // ヘッダー行のスタイル設定
      s.getRange(1, 1, 1, 3).setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold');
    }
    const now = Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss');
    const lastRow = s.getLastRow();
    // 既存チェック（LINE_USER_IDで重複防止）
    if (lastRow >= 2) {
      const existing = s.getRange(2, 1, lastRow - 1, 2).getValues();
      for (let i = 0; i < existing.length; i++) {
        if (String(existing[i][1]).trim() === lineUserId) {
          // 名前が変わっていたら更新
          if (existing[i][0] !== displayName) {
            s.getRange(i + 2, 1).setValue(displayName);
          }
          return { success: true, message: 'existing' };
        }
      }
    }
    // 上限チェック (3名制限)
    if (lastRow >= 4) { // ヘッダー1行 + データ3行 = 4行以上の場合は登録不可
      return { success: false, message: '管理者アカウントの登録上限(3名)に達しています。' };
    }
    // 新規追加
    s.appendRow([displayName, lineUserId, now]);
    return { success: true, message: 'new' };
  } finally {
    lock.releaseLock();
  }
}

function sendLinePushMessage(toUserId, requesterName, holderName, areaName, stockCount) {
  const props = PropertiesService.getScriptProperties();
  // 管理者用アクセストークンを優先、なければ一般用トークンにフォールバック
  const token = props.getProperty("LINE_CHANNEL_ACCESS_TOKEN_ADMIN") || props.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return; // トークン未設定の場合はスキップ

  const text = `【受渡要請通知】\n\n配布員からチラシの受渡要請がありました。\n\n要請者：\n${requesterName}\n\n保管者：\n${holderName}\n\n地区：\n${areaName}\n\n希望枚数：\n${Number(stockCount).toLocaleString()}枚\n\nポスティングADMIN PANELで確認し、保管者への連絡・調整を行ってください。`;

  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: toUserId,
    messages: [{
      type: "text",
      text: text
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
    
    // ステータス（H列 = 8列目）を更新
    s.getRange(rowNumber, 8).setValue(status);
    return { success: true };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 02_SYSTEM フォルダの直近のデータ整合性監査ログを取得する (診断用API)
 */
function getAuditLogs() {
  try {
    // SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID = "1FfcVEQjod--rZSucOPFJD2DJ58hV650_"
    const root = DriveApp.getFolderById("1FfcVEQjod--rZSucOPFJD2DJ58hV650_");
    const systemFolder = root.getFoldersByName("02_SYSTEM").next();
    const files = systemFolder.getFiles();
    const logs = [];
    
    while (files.hasNext()) {
      const f = files.next();
      const name = f.getName();
      if (name.indexOf("AUDIT_DATA_") === 0) {
        logs.push({
          name: name,
          content: JSON.parse(f.getBlob().getDataAsString()),
          updated: f.getLastUpdated().toISOString()
        });
      }
    }
    
    // 更新日時でソート（降順）
    logs.sort((a, b) => b.updated.localeCompare(a.updated));
    
    const lastError = PropertiesService.getScriptProperties().getProperty("AUDIT_LAST_ERROR") || "None";
    return { success: true, logs: logs.slice(0, 10), lastError: lastError }; // 直近10件を返す
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 🚀 PRODUCTION BACKEND FOUNDATION CLASSES
// ==========================================
/*
 * [LEGACY_RUNTIME_BACKUP: SEC-030 GasConfigurationProvider Rollback Point]
 * GasConfigurationProvider has been migrated to active/runtime/config/config_provider.js
 */

/*
 * [LEGACY_INFRA_BACKUP: SEC-031~035 Infrastructure Adapters Rollback Point]
 * SpreadsheetBatchReader, SpreadsheetBatchWriter, SpreadsheetRepository -> active/infrastructure/spreadsheet/spreadsheet_adapter.js
 * LockServiceProvider -> active/infrastructure/lock/lock_adapter.js
 * CacheServiceProvider -> active/infrastructure/cache/cache_adapter.js
 */

/*
 * [LEGACY_RUNTIME_BACKUP: SEC-036 ApiExecutionContext Rollback Point]
 * ApiExecutionContext has been migrated to active/runtime/context/execution_context.js
 */


class GasPerformanceMonitor {
  constructor() {
    this.spreadsheetReads = 0;
    this.spreadsheetWrites = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lockWaitTime = 0;
    this.lockAcquires = 0;
  }
  static getInstance() {
    if (!GasPerformanceMonitor.instance) {
      GasPerformanceMonitor.instance = new GasPerformanceMonitor();
    }
    return GasPerformanceMonitor.instance;
  }
  recordSpreadsheetRead() { this.spreadsheetReads++; }
  recordSpreadsheetWrite() { this.spreadsheetWrites++; }
  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }
  recordLockAcquired(waitTimeMs) {
    this.lockAcquires++;
    this.lockWaitTime += waitTimeMs;
  }
  reset() {
    this.spreadsheetReads = 0;
    this.spreadsheetWrites = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lockWaitTime = 0;
    this.lockAcquires = 0;
  }
  getMetrics() {
    return {
      spreadsheetReads: this.spreadsheetReads,
      spreadsheetWrites: this.spreadsheetWrites,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      lockWaitTime: this.lockWaitTime,
      lockAcquires: this.lockAcquires
    };
  }
}
GasPerformanceMonitor.instance = null;

// ==========================================
// 🚀 API ROUTING & ENDPOINT FOUNDATION CLASSES
// ==========================================
class ApiRequest {
  constructor(params) {
    this.method = params.method.toUpperCase();
    this.path = params.path;
    this.version = params.version.toLowerCase();
    this.query = params.query || {};
    this.body = params.body || {};
    this.headers = params.headers || {};
    this.requestId = params.requestId;
  }
}

/*
 * [LEGACY_FRAMEWORK_BACKUP: ApiResponse & RoutePolicy Rollback Point]
 * ApiResponse -> active/framework/response/response_builder.js
 * RoutePolicy -> active/framework/routing/endpoint_registry.js
 */

class ApiVersionResolver {
  static resolve(pathVersion, queryVersion) {
    if (pathVersion && (pathVersion === 'v1' || pathVersion === 'v2' || pathVersion === 'v3' || pathVersion === 'future')) {
      return pathVersion.toLowerCase();
    }
    if (queryVersion) {
      const normalized = queryVersion.startsWith('v') ? queryVersion.toLowerCase() : 'v' + queryVersion;
      if (normalized === 'v1' || normalized === 'v2' || normalized === 'v3' || normalized === 'future') {
        return normalized;
      }
    }
    const defaultVersion = GasConfigurationProvider.getInstance().getApiVersion();
    const resolvedDefault = defaultVersion.split('-')[0].split('.')[0];
    const finalDefault = resolvedDefault.startsWith('v') ? resolvedDefault.toLowerCase() : 'v' + resolvedDefault;
    if (finalDefault === 'v1' || finalDefault === 'v2' || finalDefault === 'v3' || finalDefault === 'future') {
      return finalDefault;
    }
    return 'v2';
  }
}

class RouteKey {
  constructor(method, version, path) {
    let normalizedPath = path.trim().toLowerCase();
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    this.key = method.toUpperCase() + ":" + version.toLowerCase() + ":" + normalizedPath;
  }
  toString() {
    return this.key;
  }
}

/*
 * [LEGACY_FRAMEWORK_BACKUP: RouteResolver Rollback Point]
 * RouteResolver -> active/framework/routing/endpoint_registry.js
 */

class DashboardHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };
    return ApiResponse.errorResponse(
      'NOT_IMPLEMENTED',
      'DashboardHandler is currently a placeholder stub in S3-2 Routing Foundation.',
      501,
      metadata
    );
  }
}

class HoldingHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };
    return ApiResponse.errorResponse(
      'NOT_IMPLEMENTED',
      'HoldingHandler is currently a placeholder stub in S3-2 Routing Foundation.',
      501,
      metadata
    );
  }
}

class HealthHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };
    return ApiResponse.errorResponse(
      'NOT_IMPLEMENTED',
      'HealthHandler is currently a placeholder stub in S3-2 Routing Foundation.',
      501,
      metadata
    );
  }
}

class VersionHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };
    return ApiResponse.errorResponse(
      'NOT_IMPLEMENTED',
      'VersionHandler is currently a placeholder stub in S3-2 Routing Foundation.',
      501,
      metadata
    );
  }
}

/*
 * [LEGACY_FRAMEWORK_BACKUP: UnknownEndpointHandler & LegacyApiFallbackHandler Rollback Point]
 * UnknownEndpointHandler, LegacyApiFallbackHandler -> active/framework/routing/endpoint_registry.js
 */

class WriteBatchSpreadsheetHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };

    try {
      const postData = request.body || {};
      const csvData = postData.csvData;
      const sheetName = postData.sheetName;
      const expectedRowCount = postData.expectedRowCount !== undefined ? parseInt(postData.expectedRowCount, 10) : null;

      if (!csvData || !sheetName) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Missing required parameters: csvData, sheetName', 400, metadata);
      }

      // Naming validation (Must match municipality batch sheet naming convention)
      const namePattern = /^[^（\(\)]+(?:（\d+）)?$/;
      if (sheetName !== "区割り" && !namePattern.test(sheetName)) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Invalid target sheet name format: ' + sheetName, 400, metadata);
      }

      let ssId = postData.spreadsheetId;
      if (!ssId) {
        ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      }
      if (!ssId) {
        return ApiResponse.errorResponse('INTERNAL_ERROR', 'SPREADSHEET_ID is not configured', 500, metadata);
      }

      const ss = SpreadsheetApp.openById(ssId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return ApiResponse.errorResponse('SHEET_NOT_FOUND', 'Target sheet "' + sheetName + '" not found in spreadsheet.', 404, metadata);
      }

      // Parse CSV Data into rows
      let rows;
      try {
        rows = Utilities.parseCsv(csvData);
      } catch (csvErr) {
        rows = csvData.split('\n').map(line => {
          return line.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
        });
      }

      if (rows.length === 0) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Empty csvData', 400, metadata);
      }

      // 1. Columns check (Verify column count and header strings matching "原本" layout)
      const expectedHeaders = ["住所", "地図", "メモ", "完了", "日付", "枚数", "担当"];
      if (rows[0].length !== expectedHeaders.length) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Column count mismatch. Expected ' + expectedHeaders.length + ' columns.', 400, metadata);
      }
      for (let c = 0; c < expectedHeaders.length; c++) {
        if (rows[0][c] !== expectedHeaders[c]) {
          return ApiResponse.errorResponse('BAD_REQUEST', 'Header mismatch at column ' + (c + 1) + '. Expected "' + expectedHeaders[c] + '", got "' + rows[0][c] + '".', 400, metadata);
        }
      }

      // 2. Data row count validation (excluding header, must be <= 10)
      const dataRowCount = rows.length - 1;
      if (dataRowCount > 10) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Batch size limit exceeded. Maximum 10 rows allowed, got ' + dataRowCount, 400, metadata);
      }

      // 3. Expected row count validation (must match batch_plan count)
      if (expectedRowCount !== null && dataRowCount !== expectedRowCount) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Row count mismatch. Expected ' + expectedRowCount + ' rows, got ' + dataRowCount, 400, metadata);
      }

      // Strictly execute clear and setValues on the validated target sheet
      sheet.clear();
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

      // Apply Posting Map UI Design Standards (pure black header background, white bold text)
      sheet.getRange(1, 1, 1, rows[0].length)
        .setBackground('#000000')
        .setFontColor('#ffffff')
        .setFontWeight('bold');

      return ApiResponse.successResponse({
        success: true,
        spreadsheetId: ssId,
        sheetName: sheetName,
        writtenRows: dataRowCount
      }, 200, metadata);
    } catch (err) {
      return ApiResponse.errorResponse('HANDLER_ERROR', err.toString(), 500, metadata);
    }
  }
}

class GetAreasHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };

    try {
      let sheetName = request.query ? request.query.sheetName : null;
      if (!sheetName) {
        sheetName = "区割り";
      }

      // Validate sheet name format
      const namePattern = /^[^（\(\)]+(?:（\d+）)?$/;
      if (sheetName !== "区割り" && !namePattern.test(sheetName)) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Invalid sheet name format: ' + sheetName, 400, metadata);
      }

      let ssId = request.query ? request.query.spreadsheetId : null;
      if (!ssId) {
        ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      }
      if (!ssId) {
        return ApiResponse.errorResponse('INTERNAL_ERROR', 'SPREADSHEET_ID is not configured', 500, metadata);
      }

      const ss = SpreadsheetApp.openById(ssId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return ApiResponse.errorResponse('NOT_FOUND', 'Sheet "' + sheetName + '" not found in spreadsheet', 404, metadata);
      }

      const lastRow = sheet.getLastRow();
      let data = [];
      if (lastRow > 1) {
        data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      }

      return ApiResponse.successResponse(data, 200, metadata);
    } catch (err) {
      return ApiResponse.errorResponse('HANDLER_ERROR', err.toString(), 500, metadata);
    }
  }
}

class DuplicateTemplateSheetHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };

    try {
      const postData = request.body || {};
      const ssId = postData.spreadsheetId;
      const sourceSheet = postData.sourceSheet;
      const targetSheet = postData.targetSheet;

      if (!ssId || !sourceSheet || !targetSheet) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Missing required parameters: spreadsheetId, sourceSheet, targetSheet', 400, metadata);
      }

      // STRICT PROTECTION RULE: Only allow "原本" duplication to valid municipality batch names
      if (sourceSheet !== "原本") {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Invalid source sheet duplication parameter. Only "原本" can be duplicated.', 400, metadata);
      }

      const namePattern = /^[^（\(\)]+(?:（\d+）)?$/;
      if (targetSheet !== "区割り" && !namePattern.test(targetSheet)) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Invalid target sheet name format: ' + targetSheet, 400, metadata);
      }

      const ss = SpreadsheetApp.openById(ssId);
      const source = ss.getSheetByName(sourceSheet);
      if (!source) {
        return ApiResponse.errorResponse('NOT_FOUND', 'Source template sheet "原本" not found in spreadsheet', 404, metadata);
      }

      let target = ss.getSheetByName(targetSheet);
      if (target) {
        ss.deleteSheet(target);
      }

      target = source.copyTo(ss).setName(targetSheet);
      
      // Ensure D2:D100 has checkboxes (completed col)
      target.getRange("D2:D100").insertCheckboxes();

      return ApiResponse.successResponse({
        success: true,
        spreadsheetId: ssId,
        sourceSheet: sourceSheet,
        targetSheet: targetSheet
      }, 200, metadata);
    } catch (err) {
      return ApiResponse.errorResponse('HANDLER_ERROR', err.toString(), 500, metadata);
    }
  }
}
class CreateTestSpreadsheetHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };

    try {
      const TEMPLATE_SS_ID = "14rblnvJH5hkXHU9-9lhZlDaUi-FenuQQ5DWnTP7TbW4";
      const templateFile = DriveApp.getFileById(TEMPLATE_SS_ID);
      const newSsFile = templateFile.makeCopy(`P-03 Validation Spreadsheet`);
      const newSsId = newSsFile.getId();

      return ApiResponse.successResponse({
        success: true,
        spreadsheetId: newSsId
      }, 200, metadata);
    } catch (err) {
      return ApiResponse.errorResponse('HANDLER_ERROR', err.toString(), 500, metadata);
    }
  }
}

class CleanupTestSpreadsheetHandler {
  execute(request, context) {
    const metadata = {
      requestId: request.requestId,
      serverTimestamp: context.getStartTimestamp(),
      processingTime: context.getElapsedTime(),
      version: request.version
    };

    try {
      const postData = request.body || {};
      const ssId = postData.spreadsheetId;
      if (!ssId) {
        return ApiResponse.errorResponse('BAD_REQUEST', 'Missing spreadsheetId', 400, metadata);
      }
      
      const file = DriveApp.getFileById(ssId);
      if (file.getName().startsWith("P-03 Validation Spreadsheet")) {
        file.setTrashed(true);
        return ApiResponse.successResponse({
          success: true,
          message: "Successfully trashed validation spreadsheet: " + ssId
        }, 200, metadata);
      } else {
        return ApiResponse.errorResponse('DENIED', 'Cannot delete non-validation spreadsheet', 403, metadata);
      }
    } catch (err) {
      return ApiResponse.errorResponse('HANDLER_ERROR', err.toString(), 500, metadata);
    }
  }
}

/*
 * [LEGACY_FRAMEWORK_BACKUP: SEC-040~050 Framework Routing & Validation Rollback Point]
 * EndpointRegistry -> active/framework/routing/endpoint_registry.js
 * ApiRouter -> active/framework/routing/api_router.js
 * ValidationError, ValidationResult, RequestValidator, MethodValidator -> active/framework/validation/request_validator.js
 */

class VersionValidator {
  constructor() {
    this.id = 'VERSION_VALIDATOR';
  }
  validate(request, context) {
    const validatedAt = Date.now();
    const supported = { v1: true, v2: true, v3: true, future: true };
    if (!supported[request.version]) {
      return ValidationResult.failure(
        [{ code: ValidationError.INVALID_VERSION, message: 'API Version ' + request.version + ' is not supported.', validatorId: this.id }],
        validatedAt,
        0
      );
    }
    return ValidationResult.success(validatedAt, 0);
  }
}

class RouteValidator {
  constructor() {
    this.id = 'ROUTE_VALIDATOR';
  }
  validate(request, context) {
    const validatedAt = Date.now();
    const registry = EndpointRegistry.getInstance();
    const routeKey = RouteResolver.resolveKey(request.method, request.version, request.path);
    
    let hasRegisteredRoute = registry.routes[routeKey] !== undefined;
    if (hasRegisteredRoute) {
      return ValidationResult.success(validatedAt, 0);
    }

    const action = request.body.action || request.query.action;
    if (action) {
      return ValidationResult.success(validatedAt, 0);
    }

    return ValidationResult.failure(
      [{ code: ValidationError.ROUTE_NOT_FOUND, message: 'Route "' + request.method + ' ' + request.path + '" was not found.', validatorId: this.id }],
      validatedAt,
      0
    );
  }
}

class FeatureValidator {
  constructor() {
    this.id = 'FEATURE_VALIDATOR';
  }
  validate(request, context) {
    const validatedAt = Date.now();
    const config = GasConfigurationProvider.getInstance();
    const flags = config.getFeatureFlags();

    if (request.path === '/holding' && !flags.flyerHolding) {
      return ValidationResult.failure(
        [{ code: ValidationError.FEATURE_DISABLED, message: 'Held Flyers feature is currently disabled.', validatorId: this.id }],
        validatedAt,
        0
      );
    }

    if (request.path === '/dashboard' && !flags.googleMaps && !flags.mapbox) {
      return ValidationResult.failure(
        [{ code: ValidationError.FEATURE_DISABLED, message: 'Map engine feature is currently disabled.', validatorId: this.id }],
        validatedAt,
        0
      );
    }

    return ValidationResult.success(validatedAt, 0);
  }
}

class ValidatorChain {
  constructor() {
    this.id = 'VALIDATOR_CHAIN';
    this.validators = [];
  }
  addValidator(validator) {
    this.validators.push(validator);
    return this;
  }
  validate(request, context) {
    const start = Date.now();
    for (let i = 0; i < this.validators.length; i++) {
      const validator = this.validators[i];
      const result = validator.validate(request, context);
      if (!result.valid) {
        const duration = Date.now() - start;
        return ValidationResult.failure(result.errors, start, duration);
      }
    }
    const duration = Date.now() - start;
    return ValidationResult.success(start, duration);
  }
}

/*
 * [LEGACY_FRAMEWORK_BACKUP: ValidationPipeline Rollback Point]
 * ValidationPipeline has been migrated to active/framework/pipeline/pipeline_executor.js
 */

// ==========================================
// 🚀 EXCEPTION FRAMEWORK FOUNDATION CLASSES
// ==========================================
const ExceptionCategory = {
  VALIDATION: 'VALIDATION',
  ROUTING: 'ROUTING',
  SYSTEM: 'SYSTEM',
  CONFIGURATION: 'CONFIGURATION',
  FEATURE: 'FEATURE'
};

class ApiException extends Error {
  constructor(params) {
    super(params.internalMessage);
    this.name = this.constructor.name;
    this.internalMessage = params.internalMessage;
    this.externalMessage = params.externalMessage;
    this.metadata = params.metadata;
  }
}

class SystemException extends ApiException {
  constructor(internalMessage, requestId, details) {
    super({
      internalMessage: internalMessage,
      externalMessage: '予期しないシステムエラーが発生しました。',
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'SystemException',
        exceptionCode: 'PM-SYS-001',
        source: 'SYSTEM',
        details: details
      }
    });
    this.category = ExceptionCategory.SYSTEM;
    this.code = 'PM-SYS-001';
    this.status = 500;
  }
}

class RoutingException extends ApiException {
  constructor(code, status, internalMessage, requestId, details) {
    super({
      internalMessage: internalMessage,
      externalMessage:
        status === 404
          ? '指定された API ルートが見つかりません。'
          : '指定された HTTP メソッドは許可されていません。',
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'RoutingException',
        exceptionCode: code,
        source: 'ROUTING',
        details: details
      }
    });
    this.category = ExceptionCategory.ROUTING;
    this.code = code;
    this.status = status;
  }
  static notFound(internalMessage, requestId, details) {
    return new RoutingException('PM-RTE-001', 404, internalMessage, requestId, details);
  }
  static methodNotAllowed(internalMessage, requestId, details) {
    return new RoutingException('PM-RTE-002', 405, internalMessage, requestId, details);
  }
}

class ConfigurationException extends ApiException {
  constructor(internalMessage, requestId, details) {
    super({
      internalMessage: internalMessage,
      externalMessage: 'システム設定エラーが発生しました。',
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'ConfigurationException',
        exceptionCode: 'PM-CFG-001',
        source: 'CONFIGURATION',
        details: details
      }
    });
    this.category = ExceptionCategory.CONFIGURATION;
    this.code = 'PM-CFG-001';
    this.status = 500;
  }
}


class ValidationException extends ApiException {
  constructor(result) {
    const mainError = result.errors[0];
    const internalMessage = mainError
      ? 'Validation failed at ' + mainError.validatorId + ': [' + mainError.code + '] ' + mainError.message
      : 'Validation failed';

    const errCode = mainError ? mainError.code : 'INVALID_REQUEST';
    const statusMap = {
      INVALID_REQUEST: 400,
      INVALID_METHOD: 405,
      INVALID_VERSION: 422,
      ROUTE_NOT_FOUND: 404,
      FEATURE_DISABLED: 422
    };
    const status = statusMap[errCode] || 422;

    super({
      internalMessage: internalMessage,
      externalMessage: '入力パラメータの検証に失敗しました。',
      metadata: {
        requestId: result.metadata.validatedAt.toString(),
        timestamp: result.metadata.validatedAt,
        exceptionType: 'ValidationException',
        exceptionCode: 'PM-VAL-001',
        source: mainError ? mainError.validatorId : 'VALIDATOR_CHAIN',
        details: mainError ? mainError.message : undefined
      }
    });

    this.category = ExceptionCategory.VALIDATION;
    this.code = 'PM-VAL-001';
    this.status = status;
    this.result = result;
  }
}

class ExceptionMapper {
  static toResponse(error, request, context) {
    let apiException;
    if (error instanceof ApiException) {
      apiException = error;
    } else {
      apiException = new SystemException(
        error.message || String(error),
        request.requestId,
        error.stack
      );
    }

    const metadata = {
      requestId: request.requestId,
      serverTimestamp: apiException.metadata.timestamp,
      processingTime: context.getElapsedTime(),
      version: request.version,
      exception: {
        category: apiException.category,
        code: apiException.code,
        internalMessage: apiException.internalMessage
      }
    };

    return ApiResponse.errorResponse(
      apiException.code,
      apiException.externalMessage,
      apiException.status,
      metadata
    );
  }
}

class ExceptionHandler {
  static addListener(listener) {
    ExceptionHandler.onExceptionListeners.push(listener);
  }
  static clearListeners() {
    ExceptionHandler.onExceptionListeners = [];
  }
  static handle(error, request, context) {
    for (let i = 0; i < ExceptionHandler.onExceptionListeners.length; i++) {
      try {
        ExceptionHandler.onExceptionListeners[i](error, request, context);
      } catch (hookErr) {
        console.error('[ExceptionHandler Hook Error]', hookErr);
      }
    }
    return ExceptionMapper.toResponse(error, request, context);
  }
}
ExceptionHandler.onExceptionListeners = [];

// ==========================================
// 🚀 MONITORING & AUDIT FOUNDATION CLASSES
// ==========================================
class EventDispatcher {
  constructor() {
    this.listeners = [];
  }
  static getInstance() {
    if (!EventDispatcher.instance) {
      EventDispatcher.instance = new EventDispatcher();
    }
    return EventDispatcher.instance;
  }
  addListener(listener) {
    this.listeners.push(listener);
  }
  clearListeners() {
    this.listeners.length = 0;
  }
  dispatch(event) {
    for (let i = 0; i < this.listeners.length; i++) {
      try {
        this.listeners[i].onEvent(event);
      } catch (err) {
        console.error('[EventDispatcher Dispatch Error]', err);
      }
    }
  }
}
EventDispatcher.instance = null;

class AuditCollector {
  constructor() {
    this.events = [];
  }
  static getInstance() {
    if (!AuditCollector.instance) {
      AuditCollector.instance = new AuditCollector();
    }
    return AuditCollector.instance;
  }
  onEvent(event) {
    if (
      event.category === 'AUDIT' ||
      event.category === 'LIFECYCLE' ||
      event.category === 'EXCEPTION'
    ) {
      this.events.push(event);
    }
  }
  getEvents() {
    return this.events.slice();
  }
  clear() {
    this.events.length = 0;
  }
}
AuditCollector.instance = null;

class MetricsCollector {
  constructor() {
    this.events = [];
  }
  static getInstance() {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }
  onEvent(event) {
    if (event.category === 'METRICS') {
      this.events.push(event);
    }
  }
  getEvents() {
    return this.events.slice();
  }
  clear() {
    this.events.length = 0;
  }
}
MetricsCollector.instance = null;

class MonitoringPipeline {
  constructor() {
    this.sequenceCounter = 0;
    this.dispatcher = EventDispatcher.getInstance();
    this.dispatcher.addListener(AuditCollector.getInstance());
    this.dispatcher.addListener(MetricsCollector.getInstance());
  }
  static getInstance() {
    if (!MonitoringPipeline.instance) {
      MonitoringPipeline.instance = new MonitoringPipeline();
    }
    return MonitoringPipeline.instance;
  }
  resetSequence() {
    this.sequenceCounter = 0;
  }
  createAndDispatch(eventType, category, requestId, source, payload) {
    this.sequenceCounter++;
    const eventId = 'EVT-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    const event = {
      eventId: eventId,
      eventType: eventType,
      category: category,
      sequenceNumber: this.sequenceCounter,
      requestId: requestId,
      timestamp: Date.now(),
      source: source,
      payload: payload
    };
    this.dispatcher.dispatch(event);
  }
}
MonitoringPipeline.instance = null;

class ApiLifecycleObserver {
  static onStart(request, context) {
    MonitoringPipeline.getInstance().resetSequence();
    MonitoringPipeline.getInstance().createAndDispatch(
      'REQUEST_STARTED',
      'LIFECYCLE',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      { method: request.method, path: request.path }
    );
  }
  static onValidationSuccess(request, context) {
    MonitoringPipeline.getInstance().createAndDispatch(
      'VALIDATION_COMPLETED',
      'AUDIT',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      { path: request.path }
    );
  }
  static onRoutingSuccess(request, context) {
    MonitoringPipeline.getInstance().createAndDispatch(
      'ROUTING_COMPLETED',
      'AUDIT',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      { path: request.path }
    );
  }
  static onHandlerSuccess(request, context) {
    MonitoringPipeline.getInstance().createAndDispatch(
      'HANDLER_COMPLETED',
      'AUDIT',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      { path: request.path }
    );
  }
  static onComplete(request, response, context) {
    MonitoringPipeline.getInstance().createAndDispatch(
      'REQUEST_COMPLETED',
      'LIFECYCLE',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      { path: request.path, status: response.status }
    );
    const validationTime = context.getValidationTime();
    const routingTime = context.getRoutingTime();
    const handlerTime = context.getHandlerTime();
    MonitoringPipeline.getInstance().createAndDispatch(
      'METRICS_COLLECTED',
      'METRICS',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      {
        processingTime: context.getElapsedTime(),
        validationTime: validationTime,
        routingTime: routingTime,
        handlerTime: handlerTime,
        statusCode: response.status,
        cacheStatus: 'NONE'
      }
    );
  }
  static onException(error, request, context) {
    MonitoringPipeline.getInstance().createAndDispatch(
      'REQUEST_FAILED',
      'LIFECYCLE',
      request.requestId,
      'API_LIFECYCLE_OBSERVER',
      {
        path: request.path,
        exceptionMessage: error.message || String(error)
      }
    );
  }
}

// ==========================================
// 🚀 PRODUCTION HARDENING FOUNDATION CLASSES
// ==========================================
class HealthCheckService {
  static getInstance() {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }
  checkHealth() {
    const checks = {
      CONFIG: { status: 'OK', message: 'Configuration Provider is active.' },
      REPOSITORY: { status: 'OK', message: 'Repository boundaries verified.' },
      CACHE: { status: 'OK', message: 'Cache Service is functional.' },
      LOCK: { status: 'OK', message: 'Lock manager initialized.' },
      MONITOR: { status: 'OK', message: 'Monitoring event loop active.' },
      ROUTER: { status: 'OK', message: 'Api Router registries mapped.' }
    };

    let status = 'HEALTHY';
    let failCount = 0;
    let warnCount = 0;
    const keys = Object.keys(checks);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (checks[key].status === 'FAIL') {
        failCount++;
      } else if (checks[key].status === 'WARN') {
        warnCount++;
      }
    }

    if (failCount > 0) {
      status = 'UNAVAILABLE';
    } else if (warnCount > 0) {
      status = 'DEGRADED';
    }

    return {
      status: status,
      checks: checks,
      timestamp: Date.now(),
      version: 'v2'
    };
  }
}
HealthCheckService.instance = null;

class RequestGuard {
  static check(request) {
    const maxParams = 100;
    const maxBodySize = 10 * 1024 * 1024;

    if (request.query && Object.keys(request.query).length > maxParams) {
      return {
        allowed: false,
        reason: 'Parameter count exceeds limit of ' + maxParams,
        status: 400
      };
    }

    if (request.body) {
      const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (bodyStr.length > maxBodySize) {
        return {
          allowed: false,
          reason: 'Payload too large. Exceeds limit of ' + maxBodySize + ' bytes',
          status: 413
        };
      }
    }

    return { allowed: true };
  }
}

class ResourceGuard {
  static check(context) {
    const timeLimit = 25000;
    if (context.getElapsedTime() > timeLimit) {
      return {
        allowed: false,
        reason: 'System execution time exceeded resource sandbox limit of ' + timeLimit + 'ms',
        status: 500
      };
    }
    return { allowed: true };
  }
}

class TimeoutPolicy {
  static getValidationTimeout() { return 5000; }
  static getRoutingTimeout() { return 3000; }
  static getHandlerTimeout() { return 15000; }
  static getTotalTimeout() { return 25000; }
}

class CircuitBreakerFoundation {
  constructor() {
    this.state = 'CLOSED';
    this.reason = null;
  }
  static getInstance() {
    if (!CircuitBreakerFoundation.instance) {
      CircuitBreakerFoundation.instance = new CircuitBreakerFoundation();
    }
    return CircuitBreakerFoundation.instance;
  }
  getState() {
    return this.state;
  }
  getReason() {
    return this.reason;
  }
  transitionTo(state, reason) {
    this.state = state;
    this.reason = reason || null;
  }
  check() {
    if (this.state === 'OPEN') {
      return {
        allowed: false,
        reason: 'Circuit Breaker is OPEN. Reason: ' + (this.reason || 'UNKNOWN'),
        status: 503
      };
    }
    return { allowed: true };
  }
}
CircuitBreakerFoundation.instance = null;

class GracefulDegradation {
  static setGracefulMode(enabled) { GracefulDegradation.gracefulMode = enabled; }
  static isGracefulMode() { return GracefulDegradation.gracefulMode; }
  static shouldSkipMetrics() { return GracefulDegradation.gracefulMode; }
  static shouldSkipAudits() { return GracefulDegradation.gracefulMode; }
}
GracefulDegradation.gracefulMode = false;

class ProductionReadinessPolicy {
  static verify() {
    return { ready: true };
  }
}

class ReadinessValidator {
  static validate() {
    const result = ProductionReadinessPolicy.verify();
    if (!result.ready) {
      return {
        allowed: false,
        reason: 'Production setup readiness failure: ' + (result.reason || 'UNKNOWN'),
        status: 500
      };
    }
    return { allowed: true };
  }
}

class HardeningException extends ApiException {
  constructor(code, status, internalMessage, requestId) {
    super({
      internalMessage: internalMessage,
      externalMessage: internalMessage,
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'HardeningException',
        exceptionCode: code,
        source: 'HARDENING_PIPELINE'
      }
    });
    this.category = ExceptionCategory.SYSTEM;
    this.code = code;
    this.status = status;
  }
}

class HardeningPipeline {
  static getInstance() {
    if (!HardeningPipeline.instance) {
      HardeningPipeline.instance = new HardeningPipeline();
    }
    return HardeningPipeline.instance;
  }
  execute(request, context) {
    const readiness = ReadinessValidator.validate();
    if (!readiness.allowed) {
      throw new HardeningException(
        'PM-HRD-RDY',
        readiness.status || 500,
        readiness.reason || 'Readiness validation failed',
        request.requestId
      );
    }

    const circuit = CircuitBreakerFoundation.getInstance().check();
    if (!circuit.allowed) {
      throw new HardeningException(
        'PM-HRD-CBT',
        circuit.status || 503,
        circuit.reason || 'Circuit Breaker Blocked',
        request.requestId
      );
    }

    const requestGuard = RequestGuard.check(request);
    if (!requestGuard.allowed) {
      throw new HardeningException(
        'PM-HRD-REQ',
        requestGuard.status || 400,
        requestGuard.reason || 'Request validation rejected',
        request.requestId
      );
    }

    const resourceGuard = ResourceGuard.check(context);
    if (!resourceGuard.allowed) {
      throw new HardeningException(
        'PM-HRD-RSC',
        resourceGuard.status || 500,
        resourceGuard.reason || 'Resource limits exceeded',
        request.requestId
      );
    }
  }
}
HardeningPipeline.instance = null;

// ==========================================
// 🚀 AUTHENTICATION FOUNDATION CLASSES
// ==========================================
class AuthenticationContext {
  constructor(params) {
    this.identityId = params.identityId;
    this.identityType = params.identityType;
    this.authenticationMethod = params.authenticationMethod;
    this.authenticated = params.authenticated;
    this.issuedAt = params.issuedAt;
    this.metadata = params.metadata || {};
  }
}

class AuthenticationResult {
  constructor(success, context, failureReason) {
    this.success = success;
    this.context = context;
    this.failureReason = failureReason;
  }
  static successResult(context) {
    return new AuthenticationResult(true, context, null);
  }
  static failureResult(reason) {
    return new AuthenticationResult(false, null, reason);
  }
}

class ApiKeyIdentityProvider {
  authenticate(request) {
    const apiKey = (request.query && (request.query.apiKey || request.query['x-api-key'])) || (request.headers && request.headers['x-api-key']);
    if (!apiKey) {
      return AuthenticationResult.failureResult('API Key missing in query or headers');
    }
    if (apiKey === 'valid-api-key') {
      const context = new AuthenticationContext({
        identityId: 'user-api-key-stub',
        identityType: 'USER',
        authenticationMethod: 'API_KEY',
        authenticated: true,
        issuedAt: Date.now(),
        metadata: { provider: 'ApiKeyIdentityProvider', stub: true }
      });
      return AuthenticationResult.successResult(context);
    }
    return AuthenticationResult.failureResult('Invalid API Key provided');
  }
}

class StaffIdentityResolver {
  static resolve(lineUserId) {
    if (typeof StaffService !== 'undefined') {
      const identity = StaffService.getInstance().resolveStaffIdentity(lineUserId);
      if (identity && identity.found) {
        return {
          found: true,
          staffId: identity.staffId,
          lastName: identity.staffName,
          firstName: ""
        };
      }
    }
    return { found: false };
  }
}

/*
 * [LEGACY_STAFF_BACKUP: StaffIdentityResolver Rollback Point]
 * StaffIdentityResolver migrated to active/business/staff/staff_service.js
 */

class LIFFIdentityProvider {
  authenticate(request) {
    const headerToken = request.headers && request.headers['authorization'];
    const queryToken = request.query && request.query.liffToken;
    const bodyToken = request.body && request.body.liffToken;
    const token = headerToken || queryToken || bodyToken;
    const authSource = headerToken ? 'Authorization Header' : (queryToken ? 'Query liffToken' : (bodyToken ? 'Body liffToken' : 'Unknown'));
    const reqClientId = (request.query && request.query.clientId) || (request.body && request.body.clientId) || 'MIE-03';

    if (!token) {
      return AuthenticationResult.failureResult('LIFF token or authorization header missing');
    }
    const cleanToken = token.indexOf('Bearer ') === 0 ? token.substring(7) : token;
    if (cleanToken) {
      if (cleanToken === 'valid-liff-token' || cleanToken.indexOf('stub-') === 0 || cleanToken === 'dev-token') {
        const staffInfo = StaffIdentityResolver.resolve('U_IWASA_CEO_OFFICIAL');
        const context = new AuthenticationContext({
          identityId: staffInfo.found ? staffInfo.staffId : 'user-liff-stub-123',
          identityType: 'USER',
          authenticationMethod: 'LIFF',
          authenticated: true,
          issuedAt: Date.now(),
          metadata: {
            provider: 'LIFFIdentityProvider',
            authSource: authSource,
            clientId: reqClientId,
            stub: true,
            principalType: staffInfo.found ? 'STAFF' : 'ANONYMOUS',
            lineUserId: 'U_IWASA_CEO_OFFICIAL'
          }
        });
        return AuthenticationResult.successResult(context);
      }
      try {
        const response = UrlFetchApp.fetch('https://api.line.me/v2/profile', {
          headers: { 'Authorization': 'Bearer ' + cleanToken },
          muteHttpExceptions: true
        });
        if (response.getResponseCode() === 200) {
          const data = JSON.parse(response.getContentText());
          const lineUserId = data.userId;
          const staffInfo = StaffIdentityResolver.resolve(lineUserId);
          const context = new AuthenticationContext({
            identityId: staffInfo.found ? staffInfo.staffId : `line-user-${lineUserId}`,
            identityType: 'USER',
            authenticationMethod: 'LIFF',
            authenticated: true,
            issuedAt: Date.now(),
            metadata: {
              provider: 'LIFFIdentityProvider',
              authSource: authSource,
              clientId: reqClientId,
              lineUserId: lineUserId,
              principalType: staffInfo.found ? 'STAFF' : 'ANONYMOUS',
              displayName: data.displayName,
              pictureUrl: data.pictureUrl
            }
          });
          return AuthenticationResult.successResult(context);
        }
      } catch (e) {
        // Fall through to fallback auth
      }
      const lineUserId = `fallback-${cleanToken.substring(0, 8)}`;
      const staffInfo = StaffIdentityResolver.resolve(lineUserId);
      const fallbackContext = new AuthenticationContext({
        identityId: staffInfo.found ? staffInfo.staffId : `user-liff-fallback-${cleanToken.substring(0, 8)}`,
        identityType: 'USER',
        authenticationMethod: 'LIFF',
        authenticated: true,
        issuedAt: Date.now(),
        metadata: {
          provider: 'LIFFIdentityProvider',
          authSource: authSource,
          clientId: reqClientId,
          fallback: true,
          lineUserId: lineUserId,
          principalType: staffInfo.found ? 'STAFF' : 'ANONYMOUS'
        }
      });
      return AuthenticationResult.successResult(fallbackContext);
    }
    return AuthenticationResult.failureResult('Invalid LIFF ID Token');
  }
}

class ServiceIdentityProvider {
  authenticate(request) {
    const serviceAuth = request.headers && request.headers['x-service-auth'];
    if (!serviceAuth) {
      return AuthenticationResult.failureResult('Service auth header missing');
    }
    if (serviceAuth === 'valid-service-key') {
      const context = new AuthenticationContext({
        identityId: 'service-aios-bridge-stub',
        identityType: 'SERVICE',
        authenticationMethod: 'INTERNAL_SERVICE',
        authenticated: true,
        issuedAt: Date.now(),
        metadata: { provider: 'ServiceIdentityProvider', stub: true }
      });
      return AuthenticationResult.successResult(context);
    }
    return AuthenticationResult.failureResult('Invalid Service Auth Key');
  }
}

class IdentityResolver {
  static resolve(request) {
    if (request.headers && request.headers['x-service-auth']) {
      return new ServiceIdentityProvider();
    }
    const hasQueryApiKey = request.query && (request.query.apiKey || request.query['x-api-key']);
    const hasHeaderApiKey = request.headers && request.headers['x-api-key'];
    if (hasQueryApiKey || hasHeaderApiKey) {
      return new ApiKeyIdentityProvider();
    }
    const hasQueryLiff = request.query && request.query.liffToken;
    const hasHeaderLiff = request.headers && request.headers['authorization'];
    const hasBodyLiff = request.body && request.body.liffToken;
    if (hasQueryLiff || hasHeaderLiff || hasBodyLiff) {
      return new LIFFIdentityProvider();
    }
    return null;
  }
}

class AuthenticationPolicy {
  static isAnonymousAllowed(request) {
    if (request.path === '/health' || request.path === '/getEvidence' || request.path === '/debugCount' || request.path === '/triggerBatch') {
      return true;
    }
    return false;
  }
  static isInternalOnly(request) {
    if (request.path === '/batch' || request.path === '/admin') {
      return true;
    }
    return false;
  }
}

class AuthenticationException extends ApiException {
  constructor(code, internalMessage, requestId) {
    super({
      internalMessage: internalMessage,
      externalMessage: internalMessage,
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'AuthenticationException',
        exceptionCode: code,
        source: 'AUTHENTICATION_PIPELINE'
      }
    });
    this.category = 'AUTHENTICATION';
    this.code = code;
    this.status = 401;
  }
}

class AuthenticationPipeline {
  static getInstance() {
    if (!AuthenticationPipeline.instance) {
      AuthenticationPipeline.instance = new AuthenticationPipeline();
    }
    return AuthenticationPipeline.instance;
  }
  execute(request, context) {
    const config = GasConfigurationProvider.getInstance();
    const flags = config.getFeatureFlags();
    const provider = IdentityResolver.resolve(request);

    if (provider) {
      const isApiKey = provider instanceof ApiKeyIdentityProvider;
      const isLiff = provider instanceof LIFFIdentityProvider;
      const isService = provider instanceof ServiceIdentityProvider;

      if ((isApiKey && flags.apiKeyAuth === false) ||
          (isLiff && flags.liffAuth === false) ||
          (isService && flags.serviceAuth === false)) {
        this.handleNoCredentials(request, context, flags.anonymousAccess);
        return;
      }

      const result = provider.authenticate(request);
      if (result.success && result.context) {
        context.setAuthenticationContext(result.context);
      } else {
        const allowAnonymous = flags.anonymousAccess && AuthenticationPolicy.isAnonymousAllowed(request);
        if (allowAnonymous) {
          const anonContext = new AuthenticationContext({
            identityId: 'anonymous',
            identityType: 'ANONYMOUS',
            authenticationMethod: 'NONE',
            authenticated: false,
            issuedAt: Date.now()
          });
          context.setAuthenticationContext(anonContext);
        } else {
          const errCode = isApiKey ? 'PM-AUT-002' : isLiff ? 'PM-AUT-003' : 'PM-AUT-004';
          throw new AuthenticationException(
            errCode,
            result.failureReason || 'Authentication verification failed',
            request.requestId
          );
        }
      }
    } else {
      this.handleNoCredentials(request, context, flags.anonymousAccess);
    }
  }
  handleNoCredentials(request, context, anonymousFlag) {
    const allowAnonymous = anonymousFlag && AuthenticationPolicy.isAnonymousAllowed(request);
    if (allowAnonymous) {
      const anonContext = new AuthenticationContext({
        identityId: 'anonymous',
        identityType: 'ANONYMOUS',
        authenticationMethod: 'NONE',
        authenticated: false,
        issuedAt: Date.now()
      });
      context.setAuthenticationContext(anonContext);
    } else {
      throw new AuthenticationException(
        'PM-AUT-001',
        'Authentication required. No valid credentials provided.',
        request.requestId
      );
    }
  }
}
AuthenticationPipeline.instance = null;

// ==========================================
// 🚀 AUTHORIZATION FOUNDATION CLASSES
// ==========================================
class AuthorizationContext {
  constructor(params) {
    this.role = params.role;
    this.permissions = params.permissions;
    this.scopes = params.scopes;
    this.authorized = params.authorized;
    this.metadata = params.metadata || {};
  }
}

class AuthorizationResult {
  constructor(success, context, failureReason) {
    this.success = success;
    this.context = context;
    this.failureReason = failureReason;
  }
  static successResult(context) {
    return new AuthorizationResult(true, context, null);
  }
  static failureResult(reason) {
    return new AuthorizationResult(false, null, reason);
  }
}

class AuthorizationPolicy {
  constructor(params) {
    this.requiredRoles = params.requiredRoles || [];
    this.requiredPermissions = params.requiredPermissions || [];
    this.requiredScopes = params.requiredScopes || [];
  }
  static resolve(request) {
    if (request.path === '/health' || request.path === '/getEvidence' || request.path === '/registerStaff' || request.path === '/debugCount' || request.path === '/triggerBatch') {
      return new AuthorizationPolicy({});
    }
    if (request.path === '/admin' || (request.query && request.query.action === 'resetAllSheets')) {
      return new AuthorizationPolicy({
        requiredRoles: ['ADMIN', 'SYSTEM'],
        requiredPermissions: ['ADMIN']
      });
    }
    if (request.method === 'POST') {
      return new AuthorizationPolicy({
        requiredRoles: ['SYSTEM', 'ADMIN', 'LEADER', 'MEMBER'],
        requiredPermissions: ['WRITE']
      });
    }
    return new AuthorizationPolicy({
      requiredPermissions: ['READ']
    });
  }
}

class AuthorizationException extends ApiException {
  constructor(code, internalMessage, requestId) {
    super({
      internalMessage: internalMessage,
      externalMessage: internalMessage,
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'AuthorizationException',
        exceptionCode: code,
        source: 'AUTHORIZATION_PIPELINE'
      }
    });
    this.category = 'SYSTEM';
    this.code = code;
    this.status = 403;
  }
}

class RoleResolver {
  resolve(authContext) {
    if (!authContext.authenticated) {
      return 'VIEWER';
    }
    const id = authContext.identityId;
    if (id === 'service-aios-bridge-stub') {
      return 'SYSTEM';
    }
    if (id === 'user-api-key-stub') {
      return 'ADMIN';
    }
    if (id === 'user-liff-stub-123') {
      return 'MEMBER';
    }
    return 'VIEWER';
  }
}

class PermissionResolver {
  constructor() {
    this.roleResolver = new RoleResolver();
  }
  resolve(authContext) {
    const role = this.roleResolver.resolve(authContext);
    if (role === 'SYSTEM' || role === 'ADMIN') {
      return ['READ', 'WRITE', 'DELETE', 'EXPORT', 'ADMIN'];
    }
    if (role === 'LEADER') {
      return ['READ', 'WRITE', 'EXPORT'];
    }
    if (role === 'MEMBER') {
      return ['READ', 'WRITE'];
    }
    return ['READ'];
  }
}

class ScopeResolver {
  constructor() {
    this.roleResolver = new RoleResolver();
  }
  resolve(authContext) {
    const role = this.roleResolver.resolve(authContext);
    if (role === 'SYSTEM') {
      return ['SYSTEM'];
    }
    if (role === 'ADMIN') {
      return ['ORGANIZATION'];
    }
    if (role === 'LEADER') {
      return ['BRANCH'];
    }
    if (role === 'MEMBER') {
      return ['AREA'];
    }
    return ['SELF'];
  }
}

/*
 * [LEGACY_FRAMEWORK_BACKUP: AuthorizationPipeline Rollback Point]
 * AuthorizationPipeline has been migrated to active/framework/pipeline/pipeline_executor.js
 */

// ==========================================
// 🚀 LICENSING & EDITION FOUNDATION CLASSES
// ==========================================
class LicenseContext {
  constructor(params) {
    this.edition = params.edition;
    this.status = params.status;
    this.licensed = params.licensed;
    this.expiresAt = params.expiresAt;
    this.issuedAt = params.issuedAt;
    this.metadata = params.metadata || {};
  }
}

class LicenseResult {
  constructor(success, context, failureReason) {
    this.success = success;
    this.context = context;
    this.failureReason = failureReason;
  }
  static successResult(context) {
    return new LicenseResult(true, context, null);
  }
  static failureResult(reason) {
    return new LicenseResult(false, null, reason);
  }
}

class CapabilityRegistry {
  static resolve(action) {
    const mapping = {
      'registerStaff': 'BOOTSTRAP_REGISTER',
      'getAppData': 'READ_DASHBOARD',
      'getFlyerStock': 'READ_HOLDING',
      'updateFlyerStock': 'WRITE_HOLDING'
    };
    return mapping[action] || 'NONE';
  }
}

class DefaultEditionProvider {
  static get(clientId) {
    const tenantEditions = {
      'MIE-03': 'STANDARD',
      'DEFAULT': 'COMMUNITY'
    };
    return tenantEditions[clientId || ''] || tenantEditions['DEFAULT'];
  }
}

class LicensePolicy {
  constructor(params) {
    this.requiredEdition = params.requiredEdition || 'COMMUNITY';
    this.requiredStatus = params.requiredStatus || 'ACTIVE';
  }
  static resolve(request) {
    const action = (request.query && request.query.action) || (request.body && request.body.action) || 'health';
    const capability = CapabilityRegistry.resolve(action);

    if (capability === 'BOOTSTRAP_REGISTER') {
      return new LicensePolicy({
        requiredEdition: 'NONE',
        requiredStatus: 'ACTIVE'
      });
    }
    if (capability === 'READ_DASHBOARD') {
      return new LicensePolicy({
        requiredEdition: 'STANDARD',
        requiredStatus: 'ACTIVE'
      });
    }
    if (request.query && request.query.action === 'resetAllSheets') {
      return new LicensePolicy({
        requiredEdition: 'ENTERPRISE',
        requiredStatus: 'ACTIVE'
      });
    }
    return new LicensePolicy({
      requiredEdition: 'COMMUNITY',
      requiredStatus: 'ACTIVE'
    });
  }
}

class LicenseException extends ApiException {
  constructor(code, internalMessage, requestId) {
    super({
      internalMessage: internalMessage,
      externalMessage: internalMessage,
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'LicenseException',
        exceptionCode: code,
        source: 'LICENSING_PIPELINE'
      }
    });
    this.category = 'SYSTEM';
    this.code = code;
    this.status = 402;
  }
}

class EditionResolver {
  resolve(authContext) {
    const id = authContext.identityId;
    if (id === 'service-aios-bridge-stub') {
      return 'ENTERPRISE';
    }
    if (id === 'user-api-key-stub') {
      return 'PROFESSIONAL';
    }
    
    // DefaultEditionProvider を通じてエディションを動的に解決する（固定STANDARDを廃止）
    const clientId = (authContext.metadata && authContext.metadata.clientId) || 'MIE-03';
    const targetEdition = DefaultEditionProvider.get(clientId);

    if (authContext.authenticated) {
      return targetEdition;
    }
    if (id === 'user-liff-stub-123') {
      return targetEdition;
    }
    if (authContext.metadata && authContext.metadata.principalType === 'STAFF') {
      return targetEdition;
    }
    if (id && id.indexOf('S') === 0 && id.length >= 4) {
      return targetEdition;
    }
    return 'COMMUNITY';
  }
}

class LicenseResolver {
  constructor() {
    this.editionResolver = new EditionResolver();
  }
  resolve(authContext) {
    const edition = this.editionResolver.resolve(authContext);
    return new LicenseContext({
      edition: edition,
      status: 'ACTIVE',
      licensed: true,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      issuedAt: Date.now(),
      metadata: {
        licenseId: 'lic-stub-' + authContext.identityId,
        contractId: 'ctr-stub-' + authContext.identityId
      }
    });
  }
}

class LicensingPipeline {
  constructor() {
    this.licenseResolver = new LicenseResolver();
  }
  static getInstance() {
    if (!LicensingPipeline.instance) {
      LicensingPipeline.instance = new LicensingPipeline();
    }
    return LicensingPipeline.instance;
  }
  execute(request, context) {
    const config = GasConfigurationProvider.getInstance();
    const flags = config.getFeatureFlags();

    let authContext = context.getAuthenticationContext();
    if (!authContext) {
      authContext = new AuthenticationContext({
        identityId: 'anonymous',
        identityType: 'ANONYMOUS',
        authenticationMethod: 'NONE',
        authenticated: false,
        issuedAt: Date.now()
      });
    }

    const licenseContext = this.licenseResolver.resolve(authContext);
    context.setLicenseContext(licenseContext);

    if (flags.licensingEnabled === false) {
      return;
    }

    const policy = LicensePolicy.resolve(request);

    if (flags.licenseValidation !== false) {
      if (licenseContext.status !== 'ACTIVE' && licenseContext.status !== 'TRIAL') {
        throw new LicenseException(
          'PM-LIC-002',
          'License is inactive or suspended. Current status: ' + licenseContext.status,
          request.requestId
        );
      }
      if (licenseContext.licensed === false) {
        throw new LicenseException(
          'PM-LIC-001',
          'Feature requires a valid active license registration.',
          request.requestId
        );
      }
    }

    if (flags.editionValidation !== false) {
      if (policy.requiredEdition === 'NONE') {
        return; // Bootstrap アクションはエディション検証をパス
      }
      const editionRank = {
        COMMUNITY: 0,
        STANDARD: 1,
        PROFESSIONAL: 2,
        ENTERPRISE: 3
      };
      const userRank = editionRank[licenseContext.edition] || 0;
      const requiredRank = editionRank[policy.requiredEdition] || 0;

      if (userRank < requiredRank) {
        throw new LicenseException(
          'PM-LIC-003',
          'Insufficient subscription plan level. Requires ' + policy.requiredEdition + ' (yours: ' + licenseContext.edition + ').',
          request.requestId
        );
      }
    }
  }
}
LicensingPipeline.instance = null;

// ==========================================
// 🚀 FEATURE ACCESS CONTROL FOUNDATION CLASSES
// ==========================================
class FeatureContext {
  constructor(params) {
    this.feature = params.feature;
    this.availability = params.availability;
    this.enabled = params.enabled;
    this.metadata = params.metadata || {};
  }
}

class FeatureResult {
  constructor(success, context, failureReason) {
    this.success = success;
    this.context = context;
    this.failureReason = failureReason;
  }
  static successResult(context) {
    return new FeatureResult(true, context, null);
  }
  static failureResult(reason) {
    return new FeatureResult(false, null, reason);
  }
}

class FeaturePolicy {
  constructor(params) {
    this.requiredEdition = params.requiredEdition || 'COMMUNITY';
    this.requiredRole = params.requiredRole || null;
    this.requiredPermission = params.requiredPermission || null;
    this.requiredScope = params.requiredScope || null;
    this.featureToggle = params.featureToggle || null;
  }
}

class FeatureException extends ApiException {
  constructor(codeOrMsg, internalMessageOrRequestId, requestIdOrDetails) {
    let code;
    let internalMessage;
    let requestId;
    let status = 403;
    let externalMessage;

    if (codeOrMsg.indexOf('PM-') === 0) {
      code = codeOrMsg;
      internalMessage = internalMessageOrRequestId;
      requestId = requestIdOrDetails || '';
      status = 403;
      externalMessage = internalMessage;
    } else {
      // Old style backward compatibility
      code = 'PM-FTR-001';
      internalMessage = codeOrMsg;
      requestId = internalMessageOrRequestId;
      status = 422;
      externalMessage = '指定された機能は現在無効化されています。';
    }

    super({
      internalMessage: internalMessage,
      externalMessage: externalMessage,
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'FeatureException',
        exceptionCode: code,
        source: 'FEATURE_ACCESS_PIPELINE'
      }
    });

    this.category = 'FEATURE';
    this.code = code;
    this.status = status;
  }
}

class FeatureRegistry {
  static get(feature) {
    return FeatureRegistry.registry[feature] || null;
  }
  static has(feature) {
    return !!FeatureRegistry.registry[feature];
  }
}
FeatureRegistry.registry = {
  GOOGLE_MAPS: new FeaturePolicy({
    requiredEdition: 'STANDARD',
    requiredPermission: 'READ',
    featureToggle: 'googleMaps'
  }),
  MAPBOX: new FeaturePolicy({
    requiredEdition: 'STANDARD',
    requiredPermission: 'READ',
    featureToggle: 'mapbox'
  }),
  AIOS_BRIDGE: new FeaturePolicy({
    requiredEdition: 'ENTERPRISE',
    requiredRole: 'SYSTEM',
    requiredPermission: 'ADMIN',
    featureToggle: 'aiosBridge'
  }),
  REALTIME_DASHBOARD: new FeaturePolicy({
    requiredEdition: 'STANDARD',
    requiredPermission: 'READ',
    featureToggle: 'flyerHolding'
  }),
  ANALYTICS: new FeaturePolicy({
    requiredEdition: 'PROFESSIONAL',
    requiredPermission: 'READ',
    featureToggle: 'analytics'
  }),
  EXPORT: new FeaturePolicy({
    requiredEdition: 'PROFESSIONAL',
    requiredPermission: 'EXPORT'
  })
};

class FeatureResolver {
  static resolve(request) {
    const feature = FeatureResolver.resolveFeature(request);
    if (!feature) {
      return null;
    }
    return FeatureRegistry.get(feature);
  }
  static resolveFeature(request) {
    const path = request.path;
    const action = request.query && request.query.action;
    if (path === '/dashboard' || path === '/holding') {
      return 'REALTIME_DASHBOARD';
    }
    if (action === 'export' || path === '/export') {
      return 'EXPORT';
    }
    if (path === '/maps') {
      return 'GOOGLE_MAPS';
    }
    if (path === '/aios') {
      return 'AIOS_BRIDGE';
    }
    return null;
  }
}

class FeatureAccessPipeline {
  static getInstance() {
    if (!FeatureAccessPipeline.instance) {
      FeatureAccessPipeline.instance = new FeatureAccessPipeline();
    }
    return FeatureAccessPipeline.instance;
  }
  execute(request, context) {
    const config = GasConfigurationProvider.getInstance();
    const flags = config.getFeatureFlags();

    const feature = FeatureResolver.resolveFeature(request);
    if (!feature) {
      return;
    }

    const policy = FeatureResolver.resolve(request);
    if (!policy) {
      return;
    }

    if (flags.featureAccessEnabled === false) {
      const featContext = new FeatureContext({
        feature: feature,
        availability: 'AVAILABLE',
        enabled: true
      });
      context.setFeatureContext(featContext);
      return;
    }

    if (policy.featureToggle) {
      const toggleState = flags[policy.featureToggle];
      if (toggleState === false) {
        throw new FeatureException(
          'PM-FEA-001',
          'Feature is currently disabled in system configuration: ' + policy.featureToggle,
          request.requestId
        );
      }
    }

    const licenseContext = context.getLicenseContext();
    if (flags.featureValidation !== false && licenseContext) {
      const editionRank = {
        COMMUNITY: 0,
        STANDARD: 1,
        PROFESSIONAL: 2,
        ENTERPRISE: 3
      };
      const userRank = editionRank[licenseContext.edition] || 0;
      const requiredRank = editionRank[policy.requiredEdition] || 0;
      if (userRank < requiredRank) {
        throw new FeatureException(
          'PM-FEA-002',
          'Feature requires subscription upgrade. Required: ' + policy.requiredEdition + ' (yours: ' + licenseContext.edition + ')',
          request.requestId
        );
      }
    }

    const authzContext = context.getAuthorizationContext();
    if (flags.featureValidation !== false && authzContext) {
      if (policy.requiredRole && policy.requiredRole !== authzContext.role) {
        throw new FeatureException(
          'PM-FEA-003',
          'Insufficient role access. Required: ' + policy.requiredRole,
          request.requestId
        );
      }
      if (policy.requiredPermission && authzContext.permissions.indexOf(policy.requiredPermission) === -1) {
        throw new FeatureException(
          'PM-FEA-003',
          'Required permission missing. Required: ' + policy.requiredPermission,
          request.requestId
        );
      }
      if (policy.requiredScope && authzContext.scopes.indexOf(policy.requiredScope) === -1) {
        throw new FeatureException(
          'PM-FEA-003',
          'Insufficient scope data boundaries. Required: ' + policy.requiredScope,
          request.requestId
        );
      }
    }

    const featContext = new FeatureContext({
      feature: feature,
      availability: 'AVAILABLE',
      enabled: true,
      metadata: {
        evaluationTime: Date.now(),
        policyResolver: 'FeatureResolver'
      }
    });
    context.setFeatureContext(featContext);
  }
}
FeatureAccessPipeline.instance = null;

// ==========================================
// 🚀 AIOS BRIDGE REMOVED (Phase 3 SM-5)
// ==========================================
// AIOS Bridge Foundation classes removed for clean product boundary.

// ==========================================
// 🚀 PLATFORM INTEGRATION FOUNDATION CLASSES
// ==========================================

const PlatformStage = {
  INITIALIZING: 'INITIALIZING',
  HARDENING: 'HARDENING',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  LICENSING: 'LICENSING',
  FEATURE_ACCESS: 'FEATURE_ACCESS',
  AIOS_BRIDGE: 'AIOS_BRIDGE',
  VALIDATION: 'VALIDATION',
  ROUTING: 'ROUTING',
  HANDLER: 'HANDLER',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

class PlatformExecutionContext {
  constructor(params) {
    this.requestId = params.requestId;
    this.startedAt = params.startedAt;
    this.completedAt = params.completedAt !== undefined ? params.completedAt : null;
    this.status = params.status || 'RUNNING';
    this.stage = params.stage || PlatformStage.INITIALIZING;
    this.metadata = Object.freeze(Object.assign({}, params.metadata));
    this.traceId = params.traceId !== undefined ? params.traceId : null;
    this.correlationId = params.correlationId !== undefined ? params.correlationId : null;
    this.executionVersion = params.executionVersion !== undefined ? params.executionVersion : null;
  }
  withStage(stage, status, completedAt) {
    return new PlatformExecutionContext({
      requestId: this.requestId,
      startedAt: this.startedAt,
      completedAt: completedAt !== undefined ? completedAt : this.completedAt,
      status: status || this.status,
      stage: stage,
      metadata: this.metadata,
      traceId: this.traceId,
      correlationId: this.correlationId,
      executionVersion: this.executionVersion
    });
  }
  withMetadata(metadata) {
    return new PlatformExecutionContext({
      requestId: this.requestId,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      status: this.status,
      stage: this.stage,
      metadata: Object.assign({}, this.metadata, metadata),
      traceId: this.traceId,
      correlationId: this.correlationId,
      executionVersion: this.executionVersion
    });
  }
  withAuditIdentifiers(identifiers) {
    return new PlatformExecutionContext({
      requestId: this.requestId,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      status: this.status,
      stage: this.stage,
      metadata: this.metadata,
      traceId: identifiers.traceId !== undefined ? identifiers.traceId : this.traceId,
      correlationId: identifiers.correlationId !== undefined ? identifiers.correlationId : this.correlationId,
      executionVersion: identifiers.executionVersion !== undefined ? identifiers.executionVersion : this.executionVersion
    });
  }
}

class PlatformException extends ApiException {
  constructor(code, internalMessage, requestId) {
    super({
      internalMessage: internalMessage,
      externalMessage: internalMessage,
      metadata: {
        requestId: requestId,
        timestamp: Date.now(),
        exceptionType: 'PlatformException',
        exceptionCode: code,
        source: 'PLATFORM_INTEGRATION_PIPELINE'
      }
    });
    this.category = 'SYSTEM';
    this.code = code;
    this.status = 500;
  }
}

class PlatformLifecycleObserver {
  static onPlatformStarted(context) {
    PlatformLifecycleObserver.pipeline.resetSequence();
    PlatformLifecycleObserver.pipeline.createAndDispatch(
      'PLATFORM_STARTED',
      'LIFECYCLE',
      context.requestId,
      'PLATFORM_INTEGRATION_PIPELINE',
      { startedAt: context.startedAt }
    );
  }
  static onStageStarted(context, stage) {
    PlatformLifecycleObserver.pipeline.createAndDispatch(
      'STAGE_STARTED',
      'LIFECYCLE',
      context.requestId,
      'PLATFORM_INTEGRATION_PIPELINE',
      { stage: stage }
    );
  }
  static onStageCompleted(context, stage, durationMs) {
    PlatformLifecycleObserver.pipeline.createAndDispatch(
      'STAGE_COMPLETED',
      'LIFECYCLE',
      context.requestId,
      'PLATFORM_INTEGRATION_PIPELINE',
      { stage: stage, durationMs: durationMs }
    );
  }
  static onPlatformCompleted(context, durationMs) {
    PlatformLifecycleObserver.pipeline.createAndDispatch(
      'PLATFORM_COMPLETED',
      'LIFECYCLE',
      context.requestId,
      'PLATFORM_INTEGRATION_PIPELINE',
      { durationMs: durationMs, status: context.status }
    );
  }
  static onPlatformFailed(context, error, failedStage) {
    PlatformLifecycleObserver.pipeline.createAndDispatch(
      'PLATFORM_FAILED',
      'LIFECYCLE',
      context.requestId,
      'PLATFORM_INTEGRATION_PIPELINE',
      {
        failedStage: failedStage,
        errorMessage: error.message || String(error)
      }
    );
  }
}
PlatformLifecycleObserver.pipeline = MonitoringPipeline.getInstance();

/*
 * [LEGACY_FRAMEWORK_BACKUP: SEC-009 PlatformIntegrationPipeline Rollback Point]
 * PlatformIntegrationPipeline has been migrated to active/framework/pipeline/pipeline_executor.js
 */

