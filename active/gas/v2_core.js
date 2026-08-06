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
