/**
 * POSTING MAP OS - Data Migration Layer
 * Phase 13 Step 1: Legacy to EventLog Migration
 */

/**
 * 既存のエリア別シート（「四日市市〇〇町」など）から完了データを抽出し、
 * 唯一の真実となる「EventLog」シートへ一括移行（バッチ移行）を行う。
 * 移行完了後、旧シートはアーカイブ（読み取り専用）として保護される。
 */
function runMigrationToEventLog() {
  const ss = getSS();
  let eventLogSheet = ss.getSheetByName(CONFIG.get("SHEETS.EVENTLOG"));
  
  // EventLogシートが存在しなければ作成
  if (!eventLogSheet) {
    eventLogSheet = ss.insertSheet(CONFIG.get("SHEETS.EVENTLOG"));
    // ヘッダー行の初期化
    eventLogSheet.appendRow([
      "id", 
      "timestamp", 
      "tenantId", 
      "branchId", 
      "prefectureId", 
      "blockId", 
      "userId", 
      "actionType", 
      "count", 
      "lat", 
      "lng", 
      "meta"
    ]);
    // ヘッダーの装飾（任意）
    eventLogSheet.getRange("A1:L1").setFontWeight("bold").setBackground("#f3f4f6");
    eventLogSheet.setFrozenRows(1);
  }

  // 移行対象外のシステムシート一覧
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

  const sheets = ss.getSheets();
  let allLogs = [];
  let processedSheetsCount = 0;
  
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    
    // システムシートや非表示シートはスキップ
    if (excludeSheets.indexOf(sheetName) !== -1 || sheet.isSheetHidden()) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // D列(完了フラグ)〜J列(写真URL)までを取得
    // D(0)=isDone, E(1)=completedAt, F(2)=count, G(3)=staffName, H(4)=staffId, I(5)=gps, J(6)=photoUrl
    const data = sheet.getRange(2, 4, lastRow - 1, 7).getValues();
    
    // getCityName は v2_api.gs 等に存在する前提
    let cityName = "UNKNOWN";
    try {
      cityName = getCityName(sheetName);
    } catch(e) {
      cityName = "UNKNOWN";
    }

    data.forEach((row, i) => {
      const isDone = row[0] === true || row[0] === 'TRUE';
      
      if (isDone) {
        const completedAtStr = row[1];
        let timestamp = Date.now();
        if (completedAtStr) {
          // "MM/dd HH:mm" 形式から現在の年のタイムスタンプを推測する簡易ロジック
          // より厳密にはDate.parseが必要だが、ここではフォールバックとして現在時刻を利用
          const parsed = new Date(new Date().getFullYear() + "/" + completedAtStr);
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed.getTime();
          }
        }
        
        const count = parseFloat(row[2]) || 0;
        const staffName = row[3];
        const staffId = row[4];
        const gps = row[5] ? String(row[5]).trim() : '';
        const photoUrl = row[6] ? String(row[6]).trim() : '';

        let lat = 0, lng = 0;
        if (gps) {
          const parts = gps.split(',');
          if (parts.length === 2) {
            lat = parseFloat(parts[0]) || 0;
            lng = parseFloat(parts[1]) || 0;
          }
        }

        // UUID生成（Utilities.getUuid()を利用）
        const id = Utilities.getUuid();
        
        // メタデータの構築
        const metaObj = {
          legacyRow: i + 2,
          staffName: staffName,
          photoUrl: photoUrl
        };

        allLogs.push([
          id,
          timestamp,
          "DEFAULT_TENANT", // tenantId
          cityName,         // branchId（今回は市名を支部と仮定）
          CONFIG.get("DEFAULT_PREFECTURE") || "MIE", // prefectureId
          sheetName,        // blockId（エリア名）
          staffId || "UNKNOWN",
          "distribute",     // actionType
          count,
          lat,
          lng,
          JSON.stringify(metaObj)
        ]);
      }
    });

    // 旧シートのアーカイブ化（読み取り専用化）
    try {
      let protection = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
      if (!protection) {
        protection = sheet.protect().setDescription(`Archive: Legacy Data migrated to ${CONFIG.get("SHEETS.EVENTLOG")}`);
      }
      // 全ユーザーの編集権限を削除（オーナーのみ編集可）
      const me = Session.getEffectiveUser();
      protection.addEditor(me);
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }
      
      // シート名に [Archive] プレフィックスをつける（オプション）
      // sheet.setName("[Archived] " + sheetName);
      
    } catch (e) {
      console.warn("Protection failed for sheet: " + sheetName, e);
    }
    
    processedSheetsCount++;
  });

  // EventLogへ一括書き込み
  if (allLogs.length > 0) {
    const startRow = eventLogSheet.getLastRow() + 1;
    // 配列を1000件ずつのバッチに分割して書き込み
    const batchSize = 1000;
    for (let i = 0; i < allLogs.length; i += batchSize) {
      const batch = allLogs.slice(i, i + batchSize);
      eventLogSheet.getRange(startRow + i, 1, batch.length, 12).setValues(batch);
    }
  }

  const resultMsg = `Migration Success! Processed ${processedSheetsCount} sheets. Migrated ${allLogs.length} events to EventLog.`;
  console.log(resultMsg);
  return resultMsg;
}
