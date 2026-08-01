/**
 * GAS v2 - Core Aggregation Engine (Single Source of Truth)
 * 
 * すべての実績データは EventLog から取得・集計される。
 * UI層での計算を排除し、すべてここで完結させる。
 * (Phase 13 Step 1)
 */

function getEventLogSheet() {
  return null;
}

/**
 * EventLogの全データを取得し、キャッシュする
 */
function getAllEventLogs() {
  return [];
}


// ==========================================
// 集計エンジン (Aggregation Engine)
// UI層の計算を完全に排除するための集計メソッド群
// ==========================================

/**
 * ブロック（エリア）ごとの集計
 */
function aggregateByBlock(tenantId, branchId) {
  let ss = null;
  if (typeof getSS === 'function') {
    ss = getSS();
  }
  if (!ss) return [];

  const sheets = ss.getSheets();
  const blockStats = [];

  const excludeSheets = [];
  if (typeof CONFIG !== 'undefined' && CONFIG.get) {
    excludeSheets.push(
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
      "EventLog",
      "TraceLog",
      "名簿",
      "受渡要請履歴",
      "原本"
    );
  }

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (excludeSheets.indexOf(sheetName) !== -1 || sheet.isSheetHidden()) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    let doneCount = 0;
    let lat = null;
    let lng = null;

    values.forEach(r => {
      const isComplete = r[3] === true || r[3] === 'true';
      if (isComplete) {
        doneCount += 1;
        if (r[8] && typeof r[8] === 'string' && r[8].indexOf(',') !== -1) {
          const parts = r[8].split(',');
          lat = parseFloat(parts[0]) || lat;
          lng = parseFloat(parts[1]) || lng;
        }
      }
    });

    blockStats.push({
      name: sheetName,
      done: doneCount,
      total: lastRow - 1,
      lat: lat,
      lng: lng,
      lastUpdated: 0
    });
  });

  return blockStats;
}

/**
 * 個人別配布枚数ランキング
 */
function getRankingDataCore() {
  const logs = getAllEventLogs();
  const staffRanking = {};
  
  logs.forEach(log => {
    if (log.actionType !== "distribute") return;
    const staffName = log.meta && log.meta.staffName ? log.meta.staffName : log.userId;
    if (!staffName || staffName === "UNKNOWN") return;
    
    if (!staffRanking[staffName]) {
      staffRanking[staffName] = 0;
    }
    staffRanking[staffName] += log.count;
  });
  
  const rankingList = Object.entries(staffRanking)
    .map(([name, count]) => ({ name: name, count: count }))
    .sort((a, b) => b.count - a.count);
    
  return rankingList;
}

/**
 * 配送証跡統計
 */
function getDeliveryStatsCore() {
  const logs = getAllEventLogs();
  
  let totalCompleted = 0;
  let withGPS = 0;
  let withPhoto = 0;
  let lastSyncAt = 0;
  let activeStaffs = {};
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  logs.forEach(log => {
    if (log.actionType !== "distribute") return;
    
    totalCompleted++;
    if (log.lat && log.lng) withGPS++;
    if (log.meta && log.meta.photoUrl) withPhoto++;
    if (log.timestamp > lastSyncAt) lastSyncAt = log.timestamp;
    
    if (log.timestamp >= todayStart.getTime()) {
      activeStaffs[log.userId] = true;
    }
  });
  
  const lastSyncStr = lastSyncAt > 0 ? Utilities.formatDate(new Date(lastSyncAt), "JST", "MM/dd HH:mm") : "";
  
  return {
    success: true,
    totalCompleted: totalCompleted,
    withGPS: withGPS,
    withPhoto: withPhoto,
    pending: totalCompleted - withGPS,
    lastSyncAt: lastSyncStr,
    activeStaffCount: Object.keys(activeStaffs).length
  };
}
