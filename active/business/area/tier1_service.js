/**
 * POSTING MAP - Tier 1 Service (Generation 2)
 * エリア Tier 1 (市町村一覧) 専用サービス
 * 責務: 実在スプレッドシート(SSOT)からの Tier 1 市町村サマリー取得
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

        // 1. スプレッドシートから実在するエリアシートおよび配布実績の集計
        if (typeof getSS === 'function') {
          const ss = getSS();
          if (ss) {
            const excludeSheets = [
              "名簿", "原本", "保有チラシ枚数", "受渡要請履歴", "管理者ID",
              "__SYSTEM_CACHE__", "📥 集計用マスターデータ", "郵便番号", "区割り",
              "初めての方「使い方ガイド」", "📖 らくらくマニュアル", "らくらくマニュアル", "📄 活動報告書",
              "__TEMP_ADDRESSES__", "TraceLog", "配布実績", "PinStatus"
            ];

            const sheets = ss.getSheets();
            sheets.forEach(sheet => {
              const sName = sheet.getName();
              if (excludeSheets.includes(sName) || sheet.isSheetHidden()) return;
              if (sName.includes("MASTER") || sName.includes("DATABASE") || sName.includes("EXPORT")) return;

              const lastRow = sheet.getLastRow();
              if (lastRow < 2) return;

              const baseCity = sName.replace(/\(\d+\)$/, '').trim();
              const count = lastRow - 1;
              cityTotals[baseCity] = (cityTotals[baseCity] || 0) + count;

              // D2:D11 の範囲から isDone を集計
              const targetRange = sheet.getRange(2, 4, Math.min(count, 10), 1);
              const isDoneValues = targetRange.getValues();
              let sheetDone = 0;
              isDoneValues.forEach(row => {
                const val = row[0];
                if (val === true || val === 'true' || (typeof val === 'string' && val.toLowerCase() === 'true')) {
                  sheetDone++;
                }
              });
              cityDoneMap[baseCity] = (cityDoneMap[baseCity] || 0) + sheetDone;
            });
          }
        }

        // 2. 表示順序SSOT (getMunicipalityOrder) に基づき自治体リストを動的生成
        let orderedCities = [];
        if (typeof getMunicipalityOrder === 'function') {
          orderedCities = getMunicipalityOrder();
        } else {
          orderedCities = [];
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
