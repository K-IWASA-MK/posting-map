/**
 * POSTING MAP OS - Data Migration Layer
 * Phase 13 Step 1.5: Reconciliation Report
 */

/**
 * 🟡 Phase B：Reconciliation（比較・照合）
 * 旧シートとEventLogの差分レポートを生成する
 */
function generateReconciliationReport() {
  const ss = getSS();
  let eventLogSheet = ss.getSheetByName(CONFIG.get("SHEETS.EVENTLOG"));
  
  if (!eventLogSheet) {
    console.log("EventLog sheet not found. Creating it now...");
    eventLogSheet = ss.insertSheet(CONFIG.get("SHEETS.EVENTLOG"));
    eventLogSheet.appendRow([
      "id", "timestamp", "tenantId", "branchId", "prefectureId", 
      "blockId", "userId", "actionType", "count", "lat", "lng", "meta"
    ]);
    eventLogSheet.getRange("A1:L1").setFontWeight("bold").setBackground("#f3f4f6");
    eventLogSheet.setFrozenRows(1);
  }

  // 1. EventLogからブロック(エリア)ごとの実績数を集計
  const lastRowLog = eventLogSheet.getLastRow();
  let eventLogCountsByBlock = {};
  if (lastRowLog >= 2) {
    const logs = eventLogSheet.getRange(2, 1, lastRowLog - 1, 12).getValues();
    logs.forEach(row => {
      const blockId = row[5];
      const actionType = row[7];
      if (actionType === "distribute" || actionType === "photo") {
        if (!eventLogCountsByBlock[blockId]) eventLogCountsByBlock[blockId] = 0;
        eventLogCountsByBlock[blockId]++;
      } else if (actionType === "revert_distribute" || actionType === "revert_photo") {
        if (!eventLogCountsByBlock[blockId]) eventLogCountsByBlock[blockId] = 0;
        eventLogCountsByBlock[blockId]--;
      }
    });
  }

  // 2. 旧エリアシートから実績数を集計
  const excludeSheets = [
    CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
    CONFIG.get("SHEET_STORAGE"), CONFIG.get("SHEET_ADMIN"), CONFIG.get("SHEETS.EVENTLOG")
  ];
  
  let legacyCountsByBlock = {};
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (excludeSheets.indexOf(sheetName) !== -1 || sheet.isSheetHidden()) return;

    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
      let count = 0;
      data.forEach(row => {
        if (row[0] === true || row[0] === 'TRUE' || row[0] === 1) {
          count++;
        }
      });
      if (count > 0) {
        legacyCountsByBlock[sheetName] = count;
      }
    }
  });

  // 3. 比較レポートの生成
  let report = {
    generatedAt: new Date().toISOString(),
    totalDiscrepancies: 0,
    details: []
  };

  // 全ブロックのリストを作成（ユニーク）
  let allBlocks = new Set([
    ...Object.keys(eventLogCountsByBlock),
    ...Object.keys(legacyCountsByBlock)
  ]);

  allBlocks.forEach(blockId => {
    const evCount = eventLogCountsByBlock[blockId] || 0;
    const legCount = legacyCountsByBlock[blockId] || 0;
    const diff = Math.abs(evCount - legCount);

    if (diff > 0) {
      report.totalDiscrepancies++;
      report.details.push({
        blockId: blockId,
        legacyCount: legCount,
        eventLogCount: evCount,
        difference: diff
      });
    }
  });

  // レポートをJSONとしてDriveに保存
  try {
    const folderId = getStorageFolderId();
    const folder = DriveApp.getFolderById(folderId);
    const timeStr = Utilities.formatDate(new Date(), "JST", "yyyyMMdd_HHmmss");
    const fileName = `[REPORT]_Reconciliation_${timeStr}.json`;
    
    const blob = Utilities.newBlob(JSON.stringify(report, null, 2), "application/json", fileName);
    const file = folder.createFile(blob);
    
    console.log(`Reconciliation Report Generated: ${file.getName()}`);
    if (report.totalDiscrepancies === 0) {
      console.log("✅ PERFECT MATCH: データの完全一致が確認されました。Phase Cへ進めます。");
    } else {
      console.warn(`⚠️ DISCREPANCY FOUND: ${report.totalDiscrepancies} 件のエリアで不一致があります。`);
    }

    return { 
      success: true, 
      fileId: file.getId(), 
      discrepancies: report.totalDiscrepancies,
      match: report.totalDiscrepancies === 0
    };
  } catch (e) {
    console.error("Report generation failed:", e);
    return { success: false, error: e.toString() };
  }
}
