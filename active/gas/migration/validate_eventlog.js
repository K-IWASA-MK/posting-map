/**
 * POSTING MAP OS - Data Migration Layer
 * Phase 13 Step 1.5: EventLog Validation
 */

/**
 * 移行後のEventLogデータが正しいか、旧シートと比較検証する
 */
function validateEventLogMigration() {
  const ss = getSS();
  const eventLogSheet = ss.getSheetByName(CONFIG.get("SHEETS.EVENTLOG"));
  
  if (!eventLogSheet) {
    console.error("EventLog sheet not found.");
    return false;
  }

  const lastRow = eventLogSheet.getLastRow();
  if (lastRow < 2) {
    console.warn("EventLog is empty.");
    return false;
  }

  const logs = eventLogSheet.getRange(2, 1, lastRow - 1, 12).getValues();
  
  let errors = [];
  let totalLogs = logs.length;
  let uniqueIds = new Set();
  
  let legacyCounts = getLegacyCompletionCounts(ss);
  let eventLogCountsByBlock = {};

  logs.forEach((row, index) => {
    const id = row[0];
    const timestamp = row[1];
    const tenantId = row[2];
    const branchId = row[3];
    const prefectureId = row[4];
    const blockId = row[5];
    const actionType = row[7];
    const rowNum = index + 2;

    // 1. 重複ID検査
    if (uniqueIds.has(id)) {
      errors.push(`Row ${rowNum}: Duplicate ID found -> ${id}`);
    } else {
      uniqueIds.add(id);
    }

    // 2. null/空値チェック
    if (!id || !timestamp || !tenantId || !branchId || !prefectureId || !blockId || !actionType) {
      errors.push(`Row ${rowNum}: Missing critical fields. branchId=${branchId}, blockId=${blockId}`);
    }

    // 3. 件数チェックのための集計
    if (actionType === "distribute") {
      if (!eventLogCountsByBlock[blockId]) eventLogCountsByBlock[blockId] = 0;
      eventLogCountsByBlock[blockId]++;
    }
  });

  // 4. 件数一致チェック
  Object.keys(legacyCounts).forEach(blockId => {
    const legacyCount = legacyCounts[blockId];
    const newCount = eventLogCountsByBlock[blockId] || 0;
    
    if (legacyCount !== newCount) {
      errors.push(`Mismatch in block ${blockId}: Legacy= ${legacyCount}, EventLog= ${newCount}`);
    }
  });

  if (errors.length > 0) {
    console.error(`Validation Failed! Found ${errors.length} errors.`);
    errors.slice(0, 50).forEach(err => console.error(err));
    return { success: false, errors: errors };
  } else {
    console.log(`Validation Passed! Total EventLogs: ${totalLogs}`);
    return { success: true, totalLogs: totalLogs };
  }
}

/**
 * 検証用: 旧シートの完了件数を数える
 */
function getLegacyCompletionCounts(ss) {
  const excludeSheets = [
    CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"), 
    CONFIG.get("SHEET_STORAGE"), CONFIG.get("SHEET_ADMIN"), CONFIG.get("SHEETS.EVENTLOG")
  ];
  
  let counts = {};
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (excludeSheets.indexOf(sheetName) !== -1 || sheet.isSheetHidden()) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // D列 (完了フラグ)
    const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
    let count = 0;
    data.forEach(row => {
      if (row[0] === true || row[0] === 'TRUE') {
        count++;
      }
    });
    
    if (count > 0) {
      counts[sheetName] = count;
    }
  });
  
  return counts;
}
