/**
 * POSTING MAP - Tier 1 Service (Generation 2)
 * エリア Tier 1 (市町村一覧) 専用サービス
 * 責務: スプレッドシート(SSOT)からの Tier 1 市町村サマリー取得
 * 基準変更: MIE03_ADDRESS_MASTER city_name 直接参照化
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

    getTier1() {
      try {
        const cityTotals = {};
        const cityDoneMap = {};

        // 1. スプレッドシート SSOT から自治体別 total および done を動的算出
        if (typeof getSS === 'function') {
          const ss = getSS();
          if (ss) {
            const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
            const distSheet = ss.getSheetByName("配布実績");

            if (masterSheet) {
              const masterData = masterSheet.getDataRange().getValues();
              if (masterData.length > 1) {
                const header = masterData[0].map(h => String(h || "").toLowerCase().trim());
                let rowIdIdx = header.findIndex(h => h === 'rowid' || h === 'id');
                if (rowIdIdx === -1) rowIdIdx = 0;

                let cityIdx = header.findIndex(h => h === 'city_name' || h === 'city' || h === 'municipality');
                if (cityIdx === -1) cityIdx = 1; // CSV/Sheet SSOT 標準: 列1 (city_name)

                const rowCityMap = {};
                for (let i = 1; i < masterData.length; i++) {
                  const row = masterData[i];
                  const rId = parseInt(row[rowIdIdx], 10);
                  const cityName = String(row[cityIdx] || "").trim();

                  if (cityName) {
                    cityTotals[cityName] = (cityTotals[cityName] || 0) + 1;
                    if (!isNaN(rId)) {
                      rowCityMap[rId] = cityName;
                    }
                  }
                }

                // 配布実績シートからの完了集計
                if (distSheet) {
                  const distLr = distSheet.getLastRow();
                  if (distLr > 0) {
                    const distValues = distSheet.getRange(1, 1, distLr, 4).getValues();
                    const completedRowIds = new Set(
                      distValues
                        .filter(r => r[0] && r[3] !== "" && r[3] !== null)
                        .map(r => parseInt(r[0], 10))
                        .filter(id => !isNaN(id))
                    );

                    completedRowIds.forEach(rowId => {
                      const cityName = rowCityMap[rowId];
                      if (cityName) {
                        cityDoneMap[cityName] = (cityDoneMap[cityName] || 0) + 1;
                      }
                    });
                  }
                }
              }
            }
          }
        }

        // 2. 表示順序SSOT (getMunicipalityOrder) に基づき自治体リストを動的生成
        let orderedCities = [];
        if (typeof getMunicipalityOrder === 'function') {
          orderedCities = getMunicipalityOrder();
        } else {
          orderedCities = Object.keys(cityTotals);
        }

        // 順序リストに含まれない自治体がもしあれば末尾に追加
        Object.keys(cityTotals).forEach(cName => {
          if (!orderedCities.includes(cName)) {
            orderedCities.push(cName);
          }
        });

        const cities = orderedCities.map(cityName => ({
          name: cityName,
          total: cityTotals[cityName] || 0,
          done: cityDoneMap[cityName] || 0
        }));

        return {
          success: true,
          cities: cities
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
