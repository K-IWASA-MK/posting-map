/**
 * POSTING MAP - Tier 1 Service (Generation 2)
 * エリア Tier 1 (市町村一覧) 専用サービス
 * 責務: スプレッドシート(SSOT)からの Tier 1 市町村サマリー (name, done, total) 取得
 * ルール: SSOT 配列出現順の100%維持 (sort() / localeCompare() 全面禁止)
 */
(function(global) {
  class Tier1Service {
    constructor() {}

    static getInstance() {
      if (!Tier1Service.instance) {
        Tier1Service.instance = new Tier1Service();
      }
      return Tier1Service.instance;
    }

    getCityName(areaName) {
      if (!areaName) return null;
      if (areaName.indexOf('四日市') === 0) return '四日市市';
      if (areaName.indexOf('鈴鹿') === 0) return '鈴鹿市';
      if (areaName.indexOf('亀山') === 0) return '亀山市';
      if (areaName.indexOf('桑名') === 0) return '桑名市';
      if (areaName.indexOf('いなべ') === 0) return 'いなべ市';
      if (areaName.indexOf('東員') === 0) return '東員町';
      if (areaName.indexOf('菰野') === 0) return '菰野町';
      if (areaName.indexOf('朝日') === 0) return '朝日町';
      if (areaName.indexOf('川越') === 0) return '川越町';

      const match = areaName.match(/^[^市町\(\d]+(?:市|町)/);
      if (match) return match[0];
      return null;
    }

    getTier1() {
      try {
        let areaSummary = [];
        if (typeof AreaService !== 'undefined' && AreaService.getInstance) {
          const appData = AreaService.getInstance().getAppData();
          if (appData && Array.isArray(appData.areas)) {
            areaSummary = appData.areas;
          }
        }

        // SSOT (スプレッドシート) の出現順を100%維持して Tier 1 リストを生成
        const cityList = [];
        const cityMap = {};

        areaSummary.forEach(s => {
          const cName = this.getCityName(s.name);
          if (!cName) return;
          if (!cityMap[cName]) {
            const item = { name: cName, done: 0, total: 0 };
            cityMap[cName] = item;
            cityList.push(item);
          }
          cityMap[cName].done += s.done || 0;
          cityMap[cName].total += s.total || 0;
        });

        // sort() / localeCompare() は一切行わず、出現順そのままの配列を返す
        // progress は含めず name, done, total のみ
        return {
          success: true,
          cities: cityList
        };
      } catch (err) {
        return {
          success: false,
          cities: [],
          message: err.message
        };
      }
    }
  }

  Tier1Service.instance = null;
  global.Tier1Service = Tier1Service;

  global.getTier1 = function() {
    return Tier1Service.getInstance().getTier1();
  };
})(this);
