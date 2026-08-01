/**
 * Phase 2-C Freeze: システム凍結処理
 */
function executeSystemFreeze() {
  const ss = getSS();
  const timeStr = Utilities.formatDate(new Date(), "JST", "yyyyMMdd");
  
  // 1. スナップショット用フォルダの作成
  const parentFolderId = getStorageFolderId();
  let parentFolder;
  if (parentFolderId) {
    parentFolder = DriveApp.getFolderById(parentFolderId);
  } else {
    parentFolder = DriveApp.getRootFolder();
  }
  
  // フォルダが存在しない場合は作成
  let snapFolder;
  const folders = parentFolder.getFoldersByName(`posting-map-snapshot`);
  if (folders.hasNext()) {
    const pSnapFolder = folders.next();
    const subFolders = pSnapFolder.getFoldersByName(timeStr);
    snapFolder = subFolders.hasNext() ? subFolders.next() : pSnapFolder.createFolder(timeStr);
  } else {
    snapFolder = parentFolder.createFolder(`posting-map-snapshot`).createFolder(timeStr);
  }

  // 2. Reconciliation最終実行（件数比較）
  const reconResult = generateReconciliationReport();
  if (!reconResult.match) {
    return {
      success: false,
      message: "Freeze aborted: Discrepancies found.",
      discrepancies: reconResult.discrepancies
    };
  }

  // 3. データバックアップ (Legacy Sheets & EventLog)
  const snapshotData = {
    timestamp: new Date().toISOString(),
    eventLog: [],
    legacySheets: {}
  };

  const sheets = ss.getSheets();
  let eventLogCount = 0;
  let legacyCount = 0;

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    if (sheetName === CONFIG.get("SHEETS.EVENTLOG")) {
      snapshotData.eventLog = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
      eventLogCount = lastRow - 1; // excluding header
    } else {
      // 互換のためすべてバックアップ
      snapshotData.legacySheets[sheetName] = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
      // 旧シートの実績数をカウント
      const excludeSheets = [CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"), CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"), CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"), CONFIG.get("SHEET_STORAGE"), CONFIG.get("SHEET_ADMIN")];
      if (excludeSheets.indexOf(sheetName) === -1 && !sheet.isSheetHidden()) {
        const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
        data.forEach(row => {
          if (row[0] === true || row[0] === 'TRUE' || row[0] === 1) legacyCount++;
        });
      }
    }
  });

  const blob = Utilities.newBlob(JSON.stringify(snapshotData), "application/json", `PostingMap_Snapshot_${timeStr}.json`);
  snapFolder.createFile(blob);

  // 4. システム状態をFreezeに更新 (PropertiesService)
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SYSTEM_STATE', 'FROZEN');
  props.setProperty('MODE', 'READ_ONLY_PREPARATION');

  // 5. 結果のロギングと返却
  return {
    success: true,
    systemState: "FROZEN",
    mode: "READ_ONLY_PREPARATION",
    freezeDate: new Date().toISOString(),
    eventLogCount: eventLogCount,
    legacyCount: legacyCount,
    discrepancies: reconResult.discrepancies,
    snapshotFolderId: snapFolder.getId()
  };
}
