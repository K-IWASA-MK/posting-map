/**
 * Business Layer - GPS Model Module
 * 
 * Domain: GPS / Photo Domain
 * Layer: Business Layer
 * Responsibility: GPS座標・写真保存に関する Value Object の定義
 */

if (typeof GPSRecordModel === 'undefined') {
  GPSRecordModel = class GPSRecordModel {
    constructor(params) {
      this.staffId = params.staffId || '';
      this.staffName = params.staffName || '';
      this.areaName = params.areaName || '';
      this.rowId = params.rowId || null;
      this.latitude = params.latitude || 0;
      this.longitude = params.longitude || 0;
      this.photoFileId = params.photoFileId || '';
      this.photoUrl = params.photoUrl || '';
      this.completedAt = params.completedAt || '';
      this.count = params.count || 0;
      this.isDone = params.isDone || false;
    }
  };
}
