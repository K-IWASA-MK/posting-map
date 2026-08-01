/**
 * Business Layer - Distribution Repository
 * 
 * Target Domain: Distribution Management
 * Owner Layer: Business Layer
 * Responsibility: 配布実績のシャドー書き込み、EventLog記録および統計・ランキングデータアクセス
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

    logEvent(event) {
      return true;
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
        if (name === "名簿" || name === "EventLog" || name === "TraceLog" || name === "__SYSTEM_CACHE__" || name === "チラシ保管庫" || name === "原本") {
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
      if (typeof v2_core !== 'undefined' && typeof v2_core.getRankingData === 'function') {
        return v2_core.getRankingData();
      }
      const ss = this.getSS();
      if (!ss) return [];

      const eventLogSheet = ss.getSheetByName("EventLog");
      if (!eventLogSheet) return [];

      const lastRow = eventLogSheet.getLastRow();
      if (lastRow < 2) return [];

      const values = eventLogSheet.getRange(2, 1, lastRow - 1, 12).getValues();
      const rankingMap = {};

      for (let i = 0; i < values.length; i++) {
        const userId = values[i][5];
        const count = parseFloat(values[i][7]) || 0;
        const actionType = values[i][6];

        if (!userId) continue;
        if (!rankingMap[userId]) {
          rankingMap[userId] = { userId: userId, totalCount: 0 };
        }

        if (actionType === "distribute") {
          rankingMap[userId].totalCount += count;
        } else if (actionType === "revert_distribute") {
          rankingMap[userId].totalCount += count; // count is already negative for revert
        }
      }

      const rankingList = Object.keys(rankingMap).map(k => rankingMap[k]);
      rankingList.sort((a, b) => b.totalCount - a.totalCount);
      return rankingList;
    }
  };
  DistributionRepository.instance = null;
}
