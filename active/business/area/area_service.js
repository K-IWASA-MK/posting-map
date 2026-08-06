/**
 * Business Layer - Area Service Module
 * 
 * Domain: Area Domain
 * Layer: Business Layer
 * Responsibility: Area トランザクション管理、エリア・都市別データ集計サービス
 */

if (typeof AreaService === 'undefined') {
  AreaService = class AreaService {
    constructor() {
      this.repository = AreaRepository.getInstance();
    }

    static getInstance() {
      if (!AreaService.instance) {
        AreaService.instance = new AreaService();
      }
      return AreaService.instance;
    }

    getCityName(areaName) {
      if (!areaName) return 'その他';
      if (areaName.indexOf('四日市') === 0) return '四日市市';
      if (areaName.indexOf('鈴鹿') === 0) return '鈴鹿市';
      if (areaName.indexOf('亀山') === 0) return '亀山市';
      const match = areaName.match(/^[^市町\(\d]+(?:市|町)/);
      if (match) return match[0];
      return areaName + '市';
    }



    getAreaDetails(areaName) {
      return this.repository.findAreaPoints(areaName);
    }

    getCityAreaDetails(cityName) {
      const result = this.repository.findCityAreaDetails(cityName, this.getCityName.bind(this));
      if (!result.success) return result;
      return {
        success: true,
        details: result.details
      };
    }
  };
  AreaService.instance = null;
}
