/**
 * Platform Layer - HTTP GET Entry Handler
 * 
 * Section: SEC-006 Platform Entry
 * Owner Layer: Platform Layer
 * Responsibility: GAS doGet エントリポイントからのパラメータ受領と既存処理への薄い移譲
 */

const PlatformGetEntryHandler = {
  /**
   * HTTP GET リクエストの受領と処理委譲
   * @param {Object} e - GAS HTTP GET event object
   * @returns {GoogleAppsScript.Content.TextOutput}
   */
  handle: function(e) {
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
    const action = params.action || "";
    
    if (action === "registerStaff") {
      const lastName = params.lastName || params.displayName || "";
      const firstName = params.firstName || "LINE";
      const lineUserId = params.lineUserId || "";
      const res = registerStaff(lastName, firstName, lineUserId);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "debugProperties") {
      const props = PropertiesService.getScriptProperties().getProperties();
      let ssName = "Unknown";
      try {
        ssName = getSS().getName();
      } catch (e) {
        ssName = "Error: " + e.toString();
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        properties: props,
        spreadsheetId: props["SPREADSHEET_ID"] || null,
        spreadsheetName: ssName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "debugCount") {
      try {
        const ss = getSS();
        const sheets = ss.getSheets();
        const sheetInfo = sheets.map(s => {
          return {
            name: s.getName(),
            rows: s.getDataRange().getValues().length
          };
        });
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          sheets: sheetInfo
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (action === "bootstrapProperties") {
      const targetSsId = (e && e.parameter && e.parameter.spreadsheetId) ? e.parameter.spreadsheetId : "1xQUvlCaUO103rjSGmdcFQQFkukodG4Dg9mS_teWT7uA";
      PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", targetSsId);
      const updatedSsId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Script properties bootstrapped successfully.",
        spreadsheetId: updatedSsId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "getDashboardData" || action === "getSummary") {
      const data = getDashboardData();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        summary: data.summary,
        stats: data.stats,
        updatedAt: data.updatedAt
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "verifyDeployment") {
      const res = verifyDistrictDeployment(e);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "uploadMaster") {
      try {
        let postData = null;
        if (e.postData && e.postData.contents) {
          postData = JSON.parse(e.postData.contents);
        }
        const csvData = (postData && postData.csvData) || params.csvData || "";
        if (!csvData) {
          throw new Error("No CSV data provided.");
        }
        const parsedRows = Utilities.parseCsv(csvData);
        
        const ss = getSS();
        let masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
        if (!masterSheet) {
          masterSheet = ss.insertSheet("MIE03_ADDRESS_MASTER");
        }
        masterSheet.clear();
        masterSheet.getRange(1, 1, parsedRows.length, parsedRows[0].length).setValues(parsedRows);
        SpreadsheetApp.flush();
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "MIE03_ADDRESS_MASTER sheet uploaded and populated successfully!"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Failed to upload master sheet: " + err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (action === "triggerBatch") {
      try {
        const startTime = Date.now();
        const props = PropertiesService.getScriptProperties();
        
        const isStart = params.triggerBatch === "true";
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
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          status: status,
          index: index,
          message: status === "running" ? "Batch is running (chunk processed)" : "Batch completed successfully!"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Failed to run batch step: " + err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return PlatformIntegrationPipeline.execute(e);
  }
};
