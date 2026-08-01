/**
 * Business Layer - Flyer Model Module
 * 
 * Domain: Flyer Domain
 * Layer: Business Layer
 * Responsibility: チラシ保管在庫 Value Object の定義
 */

if (typeof FlyerStockModel === 'undefined') {
  FlyerStockModel = class FlyerStockModel {
    constructor(params) {
      this.id = params.id || '';
      this.staffId = params.staffId || '';
      this.staffName = params.staffName || '';
      this.location = params.location || '';
      this.count = params.count || 0;
      this.updatedAt = params.updatedAt || '';
    }
  };
}
