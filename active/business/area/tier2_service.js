/**
 * POSTING MAP - Tier 2 Service (Generation 2)
 * エリア Tier 2 (町名・地区一覧) 専用サービス
 * 責務: 指定市町村配下の地区サマリー (name, fullName, done, total, repAddress) をオンデマンド取得
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

    getTownName(areaName, cityName) {
      if (!areaName) return '';
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

        const areas = [];
        if (typeof getSS === 'function') {
          const ss = getSS();
          if (ss) {
            const cacheSheet = ss.getSheetByName("__SYSTEM_CACHE__");
            if (cacheSheet) {
              const lastRow = cacheSheet.getLastRow();
              if (lastRow >= 2) {
                // 1列目: エリア名, 2列目: 完了数, 3列目: 合計数, 4列目: 代表住所
                const rows = cacheSheet.getRange(2, 1, lastRow - 1, 4).getValues();
                rows.forEach(r => {
                  const areaName = String(r[0] || "").trim();
                  const doneCount = Number(r[1]) || 0;
                  const totalCount = Number(r[2]) || 0;
                  const repAddr = String(r[3] || "").trim();
                  if (!areaName) return;

                  const targetCity = typeof getCityName === 'function' ? getCityName(areaName) : null;
                  if (targetCity === cityName) {
                    areas.push({
                      name: this.getTownName(areaName, cityName) || areaName,
                      fullName: areaName,
                      done: doneCount,
                      total: totalCount,
                      repAddress: repAddr
                    });
                  }
                });
              }
            }
          }
        }

        return {
          success: true,
          cityName: cityName,
          areas: areas
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
