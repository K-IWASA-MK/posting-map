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
            const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
            const distSheet = ss.getSheetByName("配布実績");
            if (masterSheet) {
              const masterLr = masterSheet.getLastRow();
              if (masterLr > 1) {
                const masterData = masterSheet.getRange(2, 1, masterLr - 1, 3).getValues();
                const completedRowIds = new Set();
                if (distSheet) {
                  const distLr = distSheet.getLastRow();
                  if (distLr > 0) {
                    const distValues = distSheet.getRange(1, 1, distLr, 4).getValues();
                    distValues.forEach(r => {
                      if (r[0] && r[3] !== "" && r[3] !== null) {
                        const id = parseInt(r[0], 10);
                        if (!isNaN(id)) completedRowIds.add(id);
                      }
                    });
                  }
                }

                const townMap = {};
                const townOrder = [];
                masterData.forEach(r => {
                  const rId = parseInt(r[0], 10);
                  const tName = String(r[1] || "").trim();
                  const cName = String(r[2] || "").trim();
                  if (cName === cityName && tName) {
                    if (!townMap[tName]) {
                      townMap[tName] = {
                        name: this.getTownName(tName, cityName) || tName,
                        fullName: tName,
                        done: 0,
                        total: 0,
                        repAddress: tName
                      };
                      townOrder.push(tName);
                    }
                    townMap[tName].total += 1;
                    if (completedRowIds.has(rId)) {
                      townMap[tName].done += 1;
                    }
                  }
                });

                townOrder.forEach(tName => {
                  areas.push(townMap[tName]);
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
