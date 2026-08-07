/**
 * POSTING MAP - Tier 3 Service (Generation 2)
 * エリア Tier 3 (住所一覧) 専用サービス
 * 責務: 指定町名配下の個別住所データ (最小項目) をオンデマンド取得
 * ルール: SSOT 配列出現順の100%維持 (sort() / localeCompare() 全面禁止)、UIロジックの排除
 */
(function(global) {
  class Tier3Service {
    constructor() {}

    static getInstance() {
      if (!Tier3Service.instance) {
        Tier3Service.instance = new Tier3Service();
      }
      return Tier3Service.instance;
    }

    getTier3(cityName, townName) {
      try {
        if (!townName) {
          return { success: false, cityName: cityName || '', townName: '', points: [], message: 'townName is required' };
        }

        // 全体エリア名 (例: 四日市市_相生町 もしくは 相生町)
        let fullAreaName = townName;
        if (cityName && !townName.includes(cityName)) {
          fullAreaName = `${cityName}_${townName}`;
        }

        let rawPoints = [];
        if (typeof AreaService !== 'undefined' && AreaService.getInstance) {
          const areaSvc = AreaService.getInstance();
          // リポジトリより該当エリアの詳細住所ポイントを取得
          const res = areaSvc.getAreaDetails(fullAreaName) || areaSvc.getAreaDetails(townName);
          if (res && res.success && Array.isArray(res.points)) {
            rawPoints = res.points;
          }
        }

        // UI非依存・最小限の必要プロパティのみを抽出（SSOT出現順100%保持）
        const points = rawPoints.map((p, idx) => ({
          rowId: p.rowId || (idx + 1),
          address: p.address || p.repAddress || '',
          repAddress: p.repAddress || '',
          done: p.done ? true : false,
          isDone: p.isDone ? true : false,
          staffId: p.staffId || '',
          staffName: p.staffName || '',
          timestamp: p.timestamp || '',
          lat: p.lat || null,
          lng: p.lng || null
        }));

        // sort() / localeCompare() は一切行わず、出現順そのままの配列を返す
        return {
          success: true,
          cityName: cityName || '',
          townName: townName,
          fullAreaName: fullAreaName,
          points: points
        };
      } catch (err) {
        return {
          success: false,
          cityName: cityName || '',
          townName: townName || '',
          points: [],
          message: err.message
        };
      }
    }
  }

  Tier3Service.instance = null;
  global.Tier3Service = Tier3Service;

  global.getTier3 = function(cityName, townName) {
    return Tier3Service.getInstance().getTier3(cityName, townName);
  };
})(this);
