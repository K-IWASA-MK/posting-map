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

        // SSOT: AreaService リポジトリ/ブロックから最新の完了件数を算出
        if (typeof AreaService !== 'undefined' && AreaService.getInstance) {
          const areaSvc = AreaService.getInstance();
          if (areaSvc.repository && typeof areaSvc.repository.findAllBlocks === 'function') {
            const blocks = areaSvc.repository.findAllBlocks() || [];
            blocks.forEach(b => {
              totalDone += b.done || 0;
            });
          }
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
