/**
 * Business Layer - Area Model Module
 * 
 * Domain: Area Domain
 * Layer: Business Layer
 * Responsibility: Area データ構造および Value Object の定義
 */

if (typeof AreaModel === 'undefined') {
  AreaModel = class AreaModel {
    constructor(params) {
      this.name = params.name || '';
      this.progress = params.progress || 0;
      this.done = params.done || 0;
      this.total = params.total || 0;
      this.repAddress = params.repAddress || '';
      this.lat = params.lat || null;
      this.lng = params.lng || null;
    }
  };
}

if (typeof AreaPointModel === 'undefined') {
  AreaPointModel = class AreaPointModel {
    constructor(params) {
      this.rowId = params.rowId;
      this.address = params.address || '';
      this.memo = params.memo || '';
      this.isDone = params.isDone || false;
      this.completedAt = params.completedAt || '';
      this.count = params.count || 0;
      this.staffName = params.staffName || '';
      this.staffId = params.staffId || '';
      this.gps = params.gps || '';
      this.photoUrl = params.photoUrl || '';
    }
  };
}

if (typeof CityAreaModel === 'undefined') {
  CityAreaModel = class CityAreaModel {
    constructor(params) {
      this.name = params.name || '';
      this.done = params.done || 0;
      this.total = params.total || 0;
      this.progress = params.progress || 0;
    }
  };
}
