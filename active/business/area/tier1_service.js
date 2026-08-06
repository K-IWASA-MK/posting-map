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
        const cities = getMunicipalityOrder();
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
