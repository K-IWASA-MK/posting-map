/**
 * POSTING MAP - System Summary Service (Generation 2)
 * ヘッダー専用 System Summary Service
 * 責務: 全体件数(total), 配布完了数(done), 配布率(percent), ONLINE状態(online) の計算と提供 (SSOT準拠)
 */
(function(global) {
  class SystemSummaryService {
    constructor() {}

    static getInstance() {
      if (!SystemSummaryService.instance) {
        SystemSummaryService.instance = new SystemSummaryService();
      }
      return SystemSummaryService.instance;
    }

    getSystemSummary() {
      try {
        let totalDone = 0;
        let totalPoints = 0;

        // SSOT: CONFIG から総件数を動的に取得（フォールバック: 858）
        if (typeof CONFIG !== 'undefined' && CONFIG.get) {
          totalPoints = Number(CONFIG.get("DENOMINATOR_UNITS")) || 858;
        } else {
          totalPoints = 858;
        }

        // SSOT: __SYSTEM_CACHE__ または高速データソースから完了件数を取得（全シート巡回は絶対禁止）
        try {
          if (typeof getSS === 'function') {
            const ss = getSS();
            if (ss) {
              const cacheSheet = ss.getSheetByName("__SYSTEM_CACHE__");
              if (cacheSheet) {
                const lastRow = cacheSheet.getLastRow();
                if (lastRow >= 2) {
                  const doneValues = cacheSheet.getRange(2, 2, lastRow - 1, 1).getValues();
                  doneValues.forEach(r => {
                    totalDone += Number(r[0]) || 0;
                  });
                }
              }
            }
          }
        } catch (e) {
          totalDone = 0;
        }

        const percent = totalPoints > 0 ? Math.round((totalDone / totalPoints) * 100) : 0;

        return {
          success: true,
          total: totalPoints,
          done: totalDone,
          percent: percent,
          online: true,
          mapsApiKey: PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_API_KEY') || ""
        };
      } catch (err) {
        return {
          success: false,
          total: 858,
          done: 0,
          percent: 0,
          online: true,
          message: err.message
        };
      }
    }
  }

  SystemSummaryService.instance = null;
  global.SystemSummaryService = SystemSummaryService;

  global.getSystemSummary = function() {
    return SystemSummaryService.getInstance().getSystemSummary();
  };
})(this);
