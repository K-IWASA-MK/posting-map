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

    getAppData() {
      let blocks = [];
      let totalDone = 0;

      try {
        blocks = this.repository.findAllBlocks();
      } catch (e) {
        blocks = [];
      }

      let cachedMaster = {};
      try {
        const dashboardData = this.repository.getDashboardDataCached();
        if (dashboardData && dashboardData.summary) {
          dashboardData.summary.forEach(item => {
            cachedMaster[item.name] = item;
          });
        }
      } catch (e) {}

      const areas = [];
      blocks.forEach(b => {
        if (b.name.includes("MASTER") || b.name.includes("DATABASE") || b.name.includes("EXPORT")) return;
        const master = cachedMaster[b.name] || {};
        const total = master.total || 100;
        totalDone += b.done;
        areas.push({
          name: b.name,
          progress: total > 0 ? Math.round((b.done / total) * 100) : 0,
          done: b.done,
          total: total,
          repAddress: master.repAddress || "",
          lat: b.lat || master.lat || null,
          lng: b.lng || master.lng || null
        });
      });

      Object.keys(cachedMaster).forEach(areaName => {
        if (areaName.includes("MASTER") || areaName.includes("DATABASE") || areaName.includes("EXPORT")) return;
        if (!blocks.find(b => b.name === areaName)) {
          const master = cachedMaster[areaName];
          areas.push({
            name: areaName,
            progress: 0,
            done: 0,
            total: master.total || 0,
            repAddress: master.repAddress || "",
            lat: master.lat || null,
            lng: master.lng || null
          });
        }
      });

      const denominator = (typeof CONFIG !== 'undefined' && CONFIG.get) ? (CONFIG.get("DENOMINATOR_UNITS") || 0) : 0;
      const stats = { done: totalDone, total: denominator };
      const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_API_KEY') || "";

      const cityMap = {};
      areas.forEach(a => {
        const cityName = this.getCityName(a.name);
        if (!cityMap[cityName]) cityMap[cityName] = { name: cityName, done: 0, total: 0 };
        cityMap[cityName].done += a.done || 0;
        cityMap[cityName].total += a.total || 0;
      });

      const cities = Object.values(cityMap).map(c => {
        c.progress = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
        return c;
      });

      return {
        success: true,
        branchName: this.repository.getSpreadsheetName(),
        areas: areas,
        cities: cities,
        stats: stats,
        apiKey: apiKey
      };
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
