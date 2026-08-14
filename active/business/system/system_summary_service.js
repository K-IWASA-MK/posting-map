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

        // SSOT: 配布実績シートからユニーク完了件数を取得
        try {
          if (typeof getSS === 'function') {
            const ss = getSS();
            if (ss) {
              const distSheet = ss.getSheetByName("配布実績");
              if (distSheet) {
                const lastRow = distSheet.getLastRow();
                if (lastRow > 0) {
                  const values = distSheet.getRange(1, 1, lastRow, 4).getValues();
                  const uniqueCompleted = new Set(
                    values
                      .filter(r => r[0] && r[3] !== "" && r[3] !== null)
                      .map(r => parseInt(r[0], 10))
                      .filter(id => !isNaN(id))
                  );
                  totalDone = uniqueCompleted.size;
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
          online: true
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
