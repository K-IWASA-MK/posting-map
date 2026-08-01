/**
 * Platform Layer - HTTP POST Entry Handler
 * 
 * Section: SEC-008 Platform Entry
 * Owner Layer: Platform Layer
 * Responsibility: GAS doPost エントリポイントからのデータ受領と既存処理への薄い移譲
 */

const PlatformPostEntryHandler = {
  /**
   * HTTP POST リクエストの受領と処理委譲
   * @param {Object} e - GAS HTTP POST event object
   * @returns {GoogleAppsScript.Content.TextOutput}
   */
  handle: function(e) {
    isWebAppCall = true;
    try {
      let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
      let postData = null;
      if (e && e.postData && e.postData.contents) {
        postData = JSON.parse(e.postData.contents);
      }
      const action = params.action || (postData && postData.action) || "";
      if (action === "triggerBatch") {
        try {
          const startTime = Date.now();
          const props = PropertiesService.getScriptProperties();
          
          const isStart = params.triggerBatch === "true" || (postData && postData.triggerBatch === "true") || (postData && postData.triggerBatch === true);
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
            message: "Failed to run batch step inside doPost: " + err.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      if (action === "debugCount") {
        try {
          const ss = getSS();
          const meiboSheet = ss.getSheetByName("名簿");
          const meiboValues = meiboSheet ? meiboSheet.getDataRange().getValues() : [];
          const sheets = ss.getSheets();
          const sheetInfo = sheets.map(s => {
            return {
              name: s.getName(),
              rows: s.getDataRange().getValues().length
            };
          });
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            sheets: sheetInfo,
            meiboValues: meiboValues
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: err.toString()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      if (action === "uploadMaster") {
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
      }
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Failed to upload master sheet in doPost: " + err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
      Logger.log("[DIAG doPost] e.parameter: " + JSON.stringify(e ? e.parameter : {}));
      Logger.log("[DIAG doPost] e.postData.contents: " + (e && e.postData ? e.postData.contents : "none"));
    } catch (err) {}
    return PlatformIntegrationPipeline.execute(e);
  }
};
