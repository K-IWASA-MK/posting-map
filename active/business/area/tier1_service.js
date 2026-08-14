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
        const cityTotals = {
          "四日市市": 304,
          "桑名市": 97,
          "いなべ市": 96,
          "桑名郡木曽岬町": 13,
          "員弁郡東員町": 44,
          "三重郡菰野町": 149,
          "三重郡朝日町": 61,
          "三重郡川越町": 94
        };

        // 配布実績シート SSOT から自治体別 done を算出
        const cityDoneMap = {};
        try {
          if (typeof getSS === 'function') {
            const ss = getSS();
            if (ss) {
              const distSheet = ss.getSheetByName("配布実績");
              const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
              if (distSheet && masterSheet) {
                const distLr = distSheet.getLastRow();
                const masterLr = masterSheet.getLastRow();
                if (distLr > 0 && masterLr > 1) {
                  const masterData = masterSheet.getRange(2, 1, masterLr - 1, 3).getValues();
                  const rowCityMap = {};
                  masterData.forEach(r => {
                    const rId = parseInt(r[0], 10);
                    if (!isNaN(rId)) {
                      rowCityMap[rId] = String(r[2] || "").trim();
                    }
                  });

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
        } catch (e) {
          // 安全フォールバック
        }

        const orderedCities = getMunicipalityOrder();
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
