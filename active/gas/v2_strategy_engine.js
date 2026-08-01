/**
 * GAS v2 - AI Strategic Engine (Decision Engine)
 * - Phase 15: Strategic Engine OS
 * - データ（EventLog, Turnout, GeoMap）を元に戦略優先度を算出する
 */

function generateStrategy(branchId, tenantId = "DEFAULT") {
  const cache = CacheService.getScriptCache().get("STRATEGY_" + branchId);
  if (cache) return JSON.parse(cache);

  const eventLog = getEventLogForBranch(branchId);
  const turnoutData = getTurnoutData(branchId);
  const geoMap = getGeoMap(branchId);

  const blocks = geoMap.blocks;

  const strategy = blocks.map(block => {
    const delivery = eventLog.filter(e => e.blockId === block.id).length;
    const turnout = turnoutData[block.id] || 0;

    // ------------------------
    // STRATEGY SCORE ENGINE
    // ------------------------
    const penetrationRate = delivery / (block.target || 100);
    const opportunityScore = (1 - turnout) * (1 - penetrationRate);

    let priority = "LOW";
    if (opportunityScore > 0.7) priority = "HIGH";
    else if (opportunityScore > 0.4) priority = "MID";

    return {
      blockId: block.id,
      name: block.name,
      delivery,
      turnout,
      penetrationRate,
      opportunityScore,
      priority
    };
  });

  const result = {
    branchId,
    summary: summarizeStrategy(strategy),
    map: strategy
  };

  CacheService.getScriptCache().put("STRATEGY_" + branchId, JSON.stringify(result), 300);

  return result;
}

function summarizeStrategy(strategy) {
  const high = strategy.filter(s => s.priority === "HIGH").length;
  const mid = strategy.filter(s => s.priority === "MID").length;
  const low = strategy.filter(s => s.priority === "LOW").length;

  return {
    HIGH_PRIORITY_AREAS: high,
    MID_PRIORITY_AREAS: mid,
    LOW_PRIORITY_AREAS: low,
    TOTAL_BLOCKS: strategy.length
  };
}

// ==========================================
// REALTIME CACHE INVALIDATION (OS Hook)
// ==========================================

function invalidateStrategyCache(branchId) {
  CacheService.getScriptCache().remove("TURNOUT_" + branchId);
  CacheService.getScriptCache().remove("STRATEGY_" + branchId);
  CacheService.getScriptCache().remove("PREDICTION_" + branchId);
}

function onNewEventLogEntry(branchId) {
  invalidateStrategyCache(branchId);
}

// ==========================================
// DATA CONNECTORS (血管)
// ==========================================

function getGeoMap(branchId) {
  const config = CONFIG.get("DISTRICT_MAP");
  return {
    blocks: config[branchId] || []
  };
}

function getTurnoutData(branchId) {
  const cache = CacheService.getScriptCache().get("TURNOUT_" + branchId);
  if (cache) return JSON.parse(cache);

  const sheet = SpreadsheetApp.getActive().getSheetByName("Turnout");
  if (!sheet) return {}; // シートが存在しない場合は空オブジェクトを返す

  const values = sheet.getDataRange().getValues();
  const result = {};

  values.slice(1).forEach(row => {
    const [id, rate, bId] = row;
    if (bId === branchId) {
      result[id] = Number(rate || 0);
    }
  });

  CacheService.getScriptCache().put(
    "TURNOUT_" + branchId,
    JSON.stringify(result),
    300
  );

  return result;
}

function getEventLogForBranch(branchId) {
  // branchId が未定義、またはEventLogの仕様によってフィルタが不要な場合はgetAllEventLogs()をそのまま返す等の調整も可能
  return getAllEventLogs().filter(e => e.branchId === branchId || !e.branchId); // 一旦fallbackとして全て対象にする等の安全網（※EventLog側のスキーマにbranchIdが含まれている前提）
}
