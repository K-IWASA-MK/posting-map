/**
 * Business Layer - Area Repository Module
 * 
 * Domain: Area Domain
 * Layer: Business Layer
 * Responsibility: エリア情報、ポイントデータ、都市データの取得とデータ構造マッピング
 */

if (typeof AreaRepository === 'undefined') {
  AreaRepository = class AreaRepository {
    constructor() {
      this.spreadsheetAdapter = (typeof SpreadsheetAdapter !== 'undefined') ? new SpreadsheetAdapter() : null;
      this.cacheProvider = (typeof CacheServiceProvider !== 'undefined') ? CacheServiceProvider.getInstance() : null;
    }

    static getInstance() {
      if (!AreaRepository.instance) {
        AreaRepository.instance = new AreaRepository();
      }
      return AreaRepository.instance;
    }

    getSpreadsheetName() {
      if (typeof getSS === 'function') {
        const ss = getSS();
        if (ss) {
          return ss.getName().split(/[ \u3000]/)[0] || "支部";
        }
      }
      return "支部";
    }

    findAllBlocks() {
      if (typeof aggregateByBlock === 'function') {
        try {
          return aggregateByBlock("DEFAULT_TENANT", null);
        } catch (e) {
          return [];
        }
      }
      return [];
    }

    getDashboardDataCached() {
      if (typeof getDashboardData === 'function') {
        try {
          return getDashboardData();
        } catch (e) {}
      }
      return null;
    }

    findAreaPoints(areaName) {
      if (!areaName) return { success: false, message: "Area name required" };
      
      let ss = null;
      if (typeof getSS === 'function') {
        ss = getSS();
      }
      if (!ss) return { success: false, message: "Spreadsheet inaccessible" };

      const s = ss.getSheetByName(areaName);
      if (!s) return { success: false, message: "Area not found" };

      const lastRow = s.getLastRow();
      if (lastRow < 2) return { success: true, points: [] };

      const values = s.getRange(2, 1, lastRow - 1, 10).getValues();
      const points = values.map((r, i) => {
        const isComplete = r[3] === true || r[3] === 'true';
        const completedAtStr = (r[4] && typeof r[4].getMonth === 'function')
          ? Utilities.formatDate(r[4], "JST", "MM/dd HH:mm")
          : (r[4] ? String(r[4]).trim() : "");

        return {
          rowId: i + 2,
          address: r[0] || "",
          memo: r[2] || "",
          isDone: isComplete,
          completedAt: completedAtStr,
          count: parseFloat(r[5]) || 0,
          staffName: r[6] || "",
          staffId: r[7] || "",
          gps: r[8] || "",
          photoUrl: r[9] || ""
        };
      });

      return { success: true, points: points };
    }

    findCityAreaDetails(cityName, getCityNameFn) {
      if (!cityName) return { success: false, message: "City name required" };
      let ss = null;
      if (typeof getSS === 'function') {
        ss = getSS();
      }
      if (!ss) return { success: false, message: "Spreadsheet inaccessible" };

      const sheets = ss.getSheets();
      const details = {};

      const excludeSheets = [];
      if (typeof CONFIG !== 'undefined' && CONFIG.get) {
        excludeSheets.push(
          CONFIG.get("SHEET_GUIDE"),
          CONFIG.get("SHEET_ROSTER"),
          CONFIG.get("SHEET_TEMPLATE"),
          CONFIG.get("SHEET_POSTAL"),
          CONFIG.get("SHEET_DISTRICT"),
          CONFIG.get("SHEET_MASTER_EXPORT"),
          CONFIG.get("SHEET_REPORT"),
          CONFIG.get("SHEET_MANUAL"),
          CONFIG.get("SHEET_SYSTEM_CACHE"),
          CONFIG.get("SHEET_STORAGE")
        );
      }

      sheets.forEach(sheet => {
        const sheetName = sheet.getName();
        if (excludeSheets.indexOf(sheetName) !== -1 || sheet.isSheetHidden()) return;

        if (getCityNameFn(sheetName) === cityName) {
          const lastRow = sheet.getLastRow();
          if (lastRow < 2) {
            details[sheetName] = [];
            return;
          }
          const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
          const points = values.map((r, i) => {
            const isComplete = r[3] === true || r[3] === 'true';
            const completedAtStr = (r[4] && typeof r[4].getMonth === 'function')
              ? Utilities.formatDate(r[4], "JST", "MM/dd HH:mm")
              : (r[4] ? String(r[4]).trim() : "");

            return {
              rowId: i + 2,
              address: r[0] || "",
              memo: r[2] || "",
              isDone: isComplete,
              completedAt: completedAtStr,
              count: parseFloat(r[5]) || 0,
              staffName: r[6] || "",
              staffId: r[7] || "",
              gps: r[8] || "",
              photoUrl: r[9] || ""
            };
          });
          details[sheetName] = points;
        }
      });

      return { success: true, details: details };
    }
  };
  AreaRepository.instance = null;
}
