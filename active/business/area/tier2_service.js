/**
 * POSTING MAP - Tier 2 Service (Generation 2)
 * エリア Tier 2 (町名一覧) 専用サービス
 * 責務: 指定市町村配下の町名サマリー (name, done, total) をオンデマンド取得
 * ルール: SSOT 配列出現順の100%維持 (sort() / localeCompare() 全面禁止)
 */
(function(global) {
  class Tier2Service {
    constructor() {}

    static getInstance() {
      if (!Tier2Service.instance) {
        Tier2Service.instance = new Tier2Service();
      }
      return Tier2Service.instance;
    }

    getCityName(areaName) {
      if (!areaName) return 'その他';
      if (areaName.indexOf('四日市') === 0) return '四日市市';
      if (areaName.indexOf('鈴鹿') === 0) return '鈴鹿市';
      if (areaName.indexOf('亀山') === 0) return '亀山市';
      const match = areaName.match(/^[^市町\(\d]+(?:市|町)/);
      if (match) return match[0];
      return areaName + '市';
    }

    getTownName(areaName, cityName) {
      if (!areaName) return '';
      // 市町村プレフィックスを外した純粋な町名
      if (cityName && areaName.indexOf(cityName) === 0) {
        let town = areaName.substring(cityName.length).replace(/^[_\s\-\(\)]+/, '');
        return town || areaName;
      }
      return areaName;
    }

    getTier2(cityName) {
      try {
        if (!cityName) {
          return { success: false, cityName: '', areas: [], message: 'cityName is required' };
        }

        let areaSummary = [];
        if (typeof AreaService !== 'undefined' && AreaService.getInstance) {
          const appData = AreaService.getInstance().getAppData();
          if (appData && Array.isArray(appData.areas)) {
            areaSummary = appData.areas;
          }
        }

        // 指定された cityName 配下のエリアのみを抽出し、町名サマリーを生成（SSOT出現順100%保持）
        const townList = [];

        areaSummary.forEach(s => {
          const cName = this.getCityName(s.name);
          if (cName === cityName) {
            const rawTownName = this.getTownName(s.name, cityName);
            townList.push({
              name: rawTownName || s.name,
              fullName: s.name,
              done: s.done || 0,
              total: s.total || 0
            });
          }
        });

        // sort() / localeCompare() は一切行わず、出現順そのままの配列を返す
        // progress は含めず name, done, total のみ
        return {
          success: true,
          cityName: cityName,
          areas: townList
        };
      } catch (err) {
        return {
          success: false,
          cityName: cityName || '',
          areas: [],
          message: err.message
        };
      }
    }
  }

  Tier2Service.instance = null;
  global.Tier2Service = Tier2Service;

  global.getTier2 = function(cityName) {
    return Tier2Service.getInstance().getTier2(cityName);
  };
})(this);
