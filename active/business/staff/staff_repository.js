/**
 * Business Layer - Staff Repository
 * 
 * Target Domain: Staff Management
 * Owner Layer: Business Layer
 * Responsibility: 名簿スプレッドシート（A:ID, B:名前, C:アプリ名, D:LINE_USER_ID）に対するデータ操作
 */

if (typeof StaffRepository === 'undefined') {
  StaffRepository = class StaffRepository {
    constructor() {
      // Data source access via Infrastructure Adapter
    }

    static getInstance() {
      if (!StaffRepository.instance) {
        StaffRepository.instance = new StaffRepository();
      }
      return StaffRepository.instance;
    }

    getRosterSheet() {
      let ss = null;
      if (typeof SpreadsheetAdapter !== 'undefined' && typeof SpreadsheetAdapter.getSS === 'function') {
        ss = SpreadsheetAdapter.getSS();
      } else if (typeof getSS === 'function') {
        ss = getSS();
      }
      if (!ss) return null;

      const sheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function')
        ? (CONFIG.get("SHEET_ROSTER") || '名簿')
        : '名簿';
      return ss.getSheetByName(sheetName);
    }

    findByLineUserId(lineUserId) {
      if (!lineUserId) return null;
      const sheet = this.getRosterSheet();
      if (!sheet) return null;

      const lastRow = sheet.getLastRow();
      if (lastRow < 1) return null;

      const values = sheet.getRange(1, 1, lastRow, 4).getValues();
      const cleanTargetId = String(lineUserId).trim();

      for (let i = 1; i < values.length; i++) {
        const rowLineUserId = String(values[i][3] || "").trim();
        if (rowLineUserId === cleanTargetId) {
          return new Staff({
            id: String(values[i][0] || "").trim(),
            name: String(values[i][1] || "").trim(),
            appName: String(values[i][2] || "").trim(),
            lineUserId: rowLineUserId
          });
        }
      }
      return null;
    }

    findByNameAndApp(name, appName) {
      if (!name) return null;
      const sheet = this.getRosterSheet();
      if (!sheet) return null;

      const lastRow = sheet.getLastRow();
      if (lastRow < 1) return null;

      const values = sheet.getRange(1, 1, lastRow, 4).getValues();
      const normName = typeof normalizeName === 'function' ? normalizeName(name) : String(name).trim();
      const normApp = typeof normalizeName === 'function' ? normalizeName(appName || "LINE") : String(appName || "LINE").trim();

      for (let i = 1; i < values.length; i++) {
        const rowId = typeof normalizeName === 'function' ? normalizeName(values[i][0]) : String(values[i][0] || "").trim();
        const rowName = typeof normalizeName === 'function' ? normalizeName(values[i][1]) : String(values[i][1] || "").trim();
        const rowAppName = typeof normalizeName === 'function' ? normalizeName(values[i][2]) : String(values[i][2] || "").trim();

        if (rowName === normName && rowAppName === normApp && rowId !== "") {
          return {
            rowIndex: i + 1,
            staff: new Staff({
              id: String(values[i][0] || "").trim(),
              name: String(values[i][1] || "").trim(),
              appName: String(values[i][2] || "").trim(),
              lineUserId: String(values[i][3] || "").trim()
            })
          };
        }
      }
      return null;
    }

    updateLineUserIdAtRow(rowIndex, lineUserId) {
      const sheet = this.getRosterSheet();
      if (!sheet || rowIndex < 1) return false;
      sheet.getRange(rowIndex, 4).setValue(String(lineUserId).trim());
      return true;
    }

    insertNewStaff(staff) {
      const sheet = this.getRosterSheet();
      if (!sheet) throw new Error("Roster sheet not found");

      const lastRow = sheet.getLastRow();
      let values = [];
      if (lastRow >= 1) {
        values = sheet.getRange(1, 1, lastRow, 4).getValues();
      }

      let maxIdNum = 0;
      let prefix = "S";
      let paddingWidth = 3;
      let targetRow = 0;
      let foundEmptyRow = false;

      for (let i = 1; i < values.length; i++) {
        const valId = typeof normalizeName === 'function' ? normalizeName(values[i][0]) : String(values[i][0] || "").trim();
        const valName = typeof normalizeName === 'function' ? normalizeName(values[i][1]) : String(values[i][1] || "").trim();
        const valAppName = typeof normalizeName === 'function' ? normalizeName(values[i][2]) : String(values[i][2] || "").trim();

        if (valId !== "") {
          const match = valId.match(/^([A-Za-z]*)(0*)(\d+)$/);
          if (match) {
            const currentPrefix = match[1];
            const zeros = match[2];
            const numStr = match[3];
            const idNum = parseInt(numStr, 10);
            
            if (!isNaN(idNum) && idNum > maxIdNum) {
              maxIdNum = idNum;
              prefix = currentPrefix;
              paddingWidth = (zeros + numStr).length;
            }
          } else {
            const idNum = parseInt(valId, 10);
            if (!isNaN(idNum) && idNum > maxIdNum) {
              maxIdNum = idNum;
              prefix = "";
              paddingWidth = 0;
            }
          }
        }

        if (!foundEmptyRow && valId === "" && valName === "" && valAppName === "") {
          targetRow = i + 1;
          foundEmptyRow = true;
        }
      }

      if (!foundEmptyRow) {
        targetRow = values.length + 1;
      }

      const nextIdNum = maxIdNum + 1;
      let newId = "";
      if (paddingWidth > 0) {
        newId = prefix + String(nextIdNum).padStart(paddingWidth, '0');
      } else {
        newId = prefix + nextIdNum;
      }

      const cleanName = String(staff.name || "").trim();
      const cleanAppName = String(staff.appName || "LINE").trim();
      const cleanLineUserId = String(staff.lineUserId || "").trim();

      sheet.getRange(targetRow, 1, 1, 4).setValues([[newId, cleanName, cleanAppName, cleanLineUserId]]);
      SpreadsheetApp.flush();

      return new Staff({
        id: newId,
        name: cleanName,
        appName: cleanAppName,
        lineUserId: cleanLineUserId
      });
    }
  };
  StaffRepository.instance = null;
}
