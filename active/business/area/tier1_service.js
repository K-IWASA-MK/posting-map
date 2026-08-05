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
        const ss = typeof getSS === 'function' ? getSS() : SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) throw new Error("Spreadsheet not found");

        const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
        if (!masterSheet) {
          throw new Error("MIE03_ADDRESS_MASTER sheet not found");
        }

        const data = masterSheet.getDataRange().getValues();
        if (data.length <= 1) {
          return { success: true, cities: [] };
        }

        const header = data[0];
        const cityIdx = header.indexOf('city_name');
        if (cityIdx === -1) {
          throw new Error("city_name column not found in SSOT");
        }

        const cityList = [];

        // 858件の元データを読み込み、B列（city_name）で一意のリストを作成
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const cityName = row[cityIdx];
          if (cityName && cityName.trim() !== "") {
            const cleanName = cityName.trim();
            if (!cityList.includes(cleanName)) {
              cityList.push(cleanName);
            }
          }
        }

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
