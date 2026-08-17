/**
 * Business Layer - Distribution Repository
 * 
 * Target Domain: Distribution Management
 * Owner Layer: Business Layer
 * Responsibility: 配布実績のシャドー書き込みおよび統計・ランキングデータアクセス
 */

if (typeof DistributionRepository === 'undefined') {
  DistributionRepository = class DistributionRepository {
    constructor() {
      // Data source access via Infrastructure Adapter
    }

    static getInstance() {
      if (!DistributionRepository.instance) {
        DistributionRepository.instance = new DistributionRepository();
      }
      return DistributionRepository.instance;
    }

    getSS() {
      if (typeof SpreadsheetAdapter !== 'undefined' && typeof SpreadsheetAdapter.getSS === 'function') {
        return SpreadsheetAdapter.getSS();
      } else if (typeof getSS === 'function') {
        return getSS();
      }
      return null;
    }

    updateLegacyAreaSheet(data, event, isComplete) {
      const ss = this.getSS();
      if (!ss) return false;

      const legacySheetName = data.legacySheetName || data.areaName;
      const legacySheet = ss.getSheetByName(legacySheetName);

      if (legacySheet) {
        const rowNum = parseInt(data.rowId, 10);
        let completedAt = "";
        if (typeof Utilities !== 'undefined' && typeof Utilities.formatDate === 'function') {
          completedAt = Utilities.formatDate(new Date(event.timestamp), "JST", "MM/dd HH:mm");
        } else {
          completedAt = new Date(event.timestamp).toISOString();
        }

        legacySheet.getRange(rowNum, 4, 1, 5).setValues([[
          isComplete,
          isComplete ? completedAt : "",
          isComplete ? (parseFloat(data.count) || 0) : "",
          isComplete ? (data.staffName || "") : "",
          isComplete ? (data.userId || data.staffId || "") : ""
        ]]);

        if (!isComplete) {
          legacySheet.getRange(rowNum, 9, 1, 2).setValues([["", ""]]);
        }
        return true;
      }
      return false;
    }

    fetchDeliveryStats() {
      const ss = this.getSS();
      if (!ss) return { totalDistributed: 0, areasCount: 0 };

      const sheets = ss.getSheets();
      let totalDistributed = 0;
      let areasCount = 0;

      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const name = sheet.getName();
        if (name === "名簿" || name === "TraceLog" || name === "__SYSTEM_CACHE__" || name === "保有チラシ枚数" || name === "原本") {
          continue;
        }

        areasCount++;
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
          const values = sheet.getRange(2, 4, lastRow - 1, 3).getValues();
          for (let j = 0; j < values.length; j++) {
            if (values[j][0] === true) {
              totalDistributed += parseFloat(values[j][2]) || 0;
            }
          }
        }
      }

      return {
        totalDistributed: totalDistributed,
        areasCount: areasCount
      };
    }

    fetchRankingData() {
      const ss = this.getSS();
      if (!ss) return [];

      const sheet = ss.getSheetByName("配布実績");
      if (!sheet) return [];

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      // A: rowId, B: cityName, C: townName, D: completedAt, E: count, F: staffId, G: staffName
      const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const staffMap = {};

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const rawCompletedAt = row[3];
        const count = parseFloat(row[4]) || 0;
        const staffId = row[5] ? String(row[5]).trim() : "";
        const staffName = row[6] ? String(row[6]).trim() : "";

        // 必須条件: completedAt が存在、staffId が存在、count > 0
        if (!rawCompletedAt || !staffId || count <= 0) continue;

        // 日時正規化処理（Date型または文字列からミリ秒タイムスタンプへ安全にパース）
        let timeVal = 0;
        if (rawCompletedAt instanceof Date && !isNaN(rawCompletedAt.getTime())) {
          timeVal = rawCompletedAt.getTime();
        } else if (typeof rawCompletedAt === 'string') {
          const trimmedDate = rawCompletedAt.trim();
          if (trimmedDate !== "") {
            const parsed = Date.parse(trimmedDate.replace(/-/g, '/'));
            if (!isNaN(parsed)) {
              timeVal = parsed;
            }
          }
        } else if (typeof rawCompletedAt === 'number' && rawCompletedAt > 0) {
          timeVal = rawCompletedAt;
        }

        if (!staffMap[staffId]) {
          staffMap[staffId] = {
            staffId: staffId,
            name: staffName || staffId,
            count: 0,
            latestTimestamp: timeVal
          };
        }

        staffMap[staffId].count += count;

        // staffName は completedAt が最新のレコードを採用
        if (timeVal > staffMap[staffId].latestTimestamp) {
          staffMap[staffId].latestTimestamp = timeVal;
          if (staffName) {
            staffMap[staffId].name = staffName;
          }
        }
      }

      const list = Object.values(staffMap);

      // ソート: ① count 降順, ② 同数時は staffId 昇順
      list.sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.staffId.localeCompare(b.staffId);
      });

      return list.map((item, index) => ({
        rank: index + 1,
        staffId: item.staffId,
        name: item.name,
        count: item.count
      }));
    }
  };
  DistributionRepository.instance = null;
}
