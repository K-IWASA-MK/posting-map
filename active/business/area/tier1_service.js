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

        // __SYSTEM_CACHE__ から自治体別 done を高速集計 (getSystemSummary と同じ方式 / 全シート巡回絶対禁止)
        const cityDoneMap = {};
        try {
          if (typeof getSS === 'function') {
            const ss = getSS();
            if (ss) {
              const cacheSheet = ss.getSheetByName("__SYSTEM_CACHE__");
              if (cacheSheet) {
                const lastRow = cacheSheet.getLastRow();
                if (lastRow >= 2) {
                  // 1列目: エリア名, 2列目: 完了数
                  const rows = cacheSheet.getRange(2, 1, lastRow - 1, 2).getValues();
                  rows.forEach(r => {
                    const areaName = String(r[0] || "").trim();
                    const doneCount = Number(r[1]) || 0;
                    if (!areaName) return;
                    const cityName = typeof getCityName === 'function' ? getCityName(areaName) : null;
                    if (cityName) {
                      cityDoneMap[cityName] = (cityDoneMap[cityName] || 0) + doneCount;
                    }
                  });
                }
              }
            }
          }
        } catch (e) {
          // キャッシュアクセス失敗時は安全フォールバック
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
