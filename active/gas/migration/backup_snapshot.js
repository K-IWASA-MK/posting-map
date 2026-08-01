/**
 * POSTING MAP OS - Data Migration Layer
 * Phase 13 Step 1.5: Pre-migration Snapshot & Rollback
 */

/**
 * 移行前に現在の全エリアシートのデータをJSON形式でバックアップする
 * 目的: 移行失敗時に完全に元の状態に戻せるようにする
 */
function createPreMigrationSnapshot() {
  const ss = getSS();
  const sheets = ss.getSheets();
  const excludeSheets = [
    CONFIG.get("SHEET_GUIDE"),
    CONFIG.get("SHEET_ROSTER"),
    CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"),
    CONFIG.get("SHEET_DISTRICT"),
    CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"),
    CONFIG.get("SHEET_MANUAL"),
    CONFIG.get("SHEET_SYSTEM_CACHE"),
    CONFIG.get("SHEET_STORAGE"),
    CONFIG.get("SHEET_ADMIN"),
    CONFIG.get("SHEETS.EVENTLOG")
  ];

  let snapshotData = {
    timestamp: new Date().toISOString(),
    sheets: {}
  };

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (excludeSheets.indexOf(sheetName) !== -1 || sheet.isSheetHidden()) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // ヘッダーを含めて全データを取得
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    snapshotData.sheets[sheetName] = data;
  });

  // JSONファイルとしてGoogle DriveのSTORAGEフォルダに保存
  try {
    const folderId = getStorageFolderId();
    const folder = DriveApp.getFolderById(folderId);
    
    const timeStr = Utilities.formatDate(new Date(), "JST", "yyyyMMdd_HHmmss");
    const fileName = `[BACKUP]_PostingMap_Legacy_${timeStr}.json`;
    
    const blob = Utilities.newBlob(JSON.stringify(snapshotData), "application/json", fileName);
    const file = folder.createFile(blob);
    
    console.log(`Snapshot created successfully: ${file.getName()} (ID: ${file.getId()})`);
    return { success: true, fileId: file.getId(), fileName: file.getName() };
  } catch (e) {
    console.error("Snapshot creation failed:", e);
    return { success: false, error: e.toString() };
  }
}

/**
 * [緊急時用] スナップショットから旧シートの状態を復元する
 * ※取り扱いに注意してください
 */
function rollbackFromSnapshot(fileId) {
  if (!fileId) throw new Error("Rollback requires a snapshot file ID.");
  
  const file = DriveApp.getFileById(fileId);
  const data = JSON.parse(file.getBlob().getDataAsString());
  const ss = getSS();

  Object.keys(data.sheets).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) return; // 存在しないシートは復元しない

    // 保護の解除
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(p => {
      if (p.getDescription().indexOf('Archive') !== -1) {
        p.remove();
      }
    });

    // データの復元
    const sheetData = data.sheets[sheetName];
    sheet.clearContents();
    sheet.getRange(1, 1, sheetData.length, sheetData[0].length).setValues(sheetData);
  });
  
  // EventLogシートのリネーム（退避）
  const eventLogSheet = ss.getSheetByName(CONFIG.get("SHEETS.EVENTLOG"));
  if (eventLogSheet) {
    eventLogSheet.setName(`${CONFIG.get("SHEETS.EVENTLOG")}_RolledBack_` + Utilities.formatDate(new Date(), "JST", "MMdd_HHmm"));
  }

  console.log("Rollback completed successfully.");
}
