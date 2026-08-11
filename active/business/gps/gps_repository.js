/**
 * Business Layer - GPS Repository Module
 *
 * Domain: GPS / Photo Domain
 * Layer: Business Layer
 * Responsibility: Google Drive への写真保存、指定エリアシートへの GPS・写真情報書き込み、EventLog 記録
 */

if (typeof GPSRepository === 'undefined') {
  GPSRepository = class GPSRepository {
    constructor() {
      this.driveAdapter = (typeof DriveAdapter !== 'undefined') ? new DriveAdapter() : null;
      this.spreadsheetAdapter = (typeof SpreadsheetAdapter !== 'undefined') ? new SpreadsheetAdapter() : null;
    }

    static getInstance() {
      if (!GPSRepository.instance) {
        GPSRepository.instance = new GPSRepository();
      }
      return GPSRepository.instance;
    }

    savePhotoToDrive(data, rowIdNum) {
      if (!data.photoData || data.photoData.indexOf("data:image") !== 0) {
        return { success: false };
      }
      try {
        const folderId = (typeof getStorageFolderId === 'function') ? getStorageFolderId() : null;
        if (!folderId) return { success: false };
        const folder = DriveApp.getFolderById(folderId);
        const now = new Date();
        const yyyyMMdd = Utilities.formatDate(now, "JST", "yyyyMMdd");
        const HHmmss = Utilities.formatDate(now, "JST", "HHmmss");

        // Sanitize staffName
        let safeStaffName = data.staffName ? String(data.staffName) : "Unknown";
        safeStaffName = safeStaffName.replace(/[\\/:*?"<>|\s　]/g, "_");

        const fileName = `${rowIdNum}_${safeStaffName}_${yyyyMMdd}_${HHmmss}.jpg`;
        const base64Data = data.photoData.split(",")[1];
        const decoded = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(decoded, "image/jpeg", fileName);
        const file = folder.createFile(blob);
        return { success: true, fileId: file.getId() };
      } catch (driveErr) {
        console.error("Google Drive Save Error:", driveErr);
        return { success: false };
      }
    }

    checkExistingStatus(rowIdNum) {
      try {
        if (typeof getSS !== 'function') return null;
        const ss = getSS();
        const sheet = ss.getSheetByName("配布実績");
        if (!sheet) return null;

        const finder = sheet.getRange("A:A").createTextFinder(String(rowIdNum)).matchEntireCell(true);
        const cell = finder.findNext();
        if (cell) {
           const row = cell.getRow();
           const gpsStatus = sheet.getRange(row, 7).getValue() === "OK" ? "OK" : "NO";
           const photoStatus = sheet.getRange(row, 8).getValue() === "OK" ? "OK" : "NO";
           return { found: true, rowNum: row, gpsStatus, photoStatus };
        }
      } catch (e) {
        console.error("checkExistingStatus error:", e);
      }
      return null;
    }

    updateSheetRecordAndLog(data, rowIdNum, gpsStatus, photoStatus, existing) {
      const isComplete = data.isDone === 'true' || data.isDone === true;
      const actType = isComplete ? "photo" : "revert_photo";
      const actCount = isComplete ? (parseFloat(data.count) || 1) : -(parseFloat(data.count) || 1);
      const timestamp = Date.now();

      let finalGpsStatus = gpsStatus;

      let ss = null;
      if (typeof getSS === 'function') {
        ss = getSS();
      }

      // 1. Update EventLog for GPS
      if (ss && isComplete && gpsStatus !== "OK") {
         const latNum = Number(data.latitude);
         const lngNum = Number(data.longitude);
         const isValidGps = typeof data.latitude !== "undefined" && data.latitude !== null && data.latitude !== "" &&
                            typeof data.longitude !== "undefined" && data.longitude !== null && data.longitude !== "" &&
                            !Number.isNaN(latNum) && Number.isFinite(latNum) && latNum !== 0 &&
                            !Number.isNaN(lngNum) && Number.isFinite(lngNum) && lngNum !== 0;

         if (isValidGps) {
           const eventLogSheet = ss.getSheetByName("EventLog");
           if (eventLogSheet) {
             try {
               const eventId = Utilities.getUuid();
               const tenantId = data.tenantId || ((typeof CONFIG !== 'undefined' && CONFIG.get) ? CONFIG.get("DEFAULT_TENANT_ID") : "DEFAULT_TENANT");
               const branchId = data.branchId || ((typeof CONFIG !== 'undefined' && CONFIG.get) ? CONFIG.get("DEFAULT_BRANCH_ID", tenantId) : "DEFAULT_BRANCH");

               const meta = JSON.stringify({
                  rowId: rowIdNum,
                  staffName: data.staffName,
                  source: "updateRecordWithGPSPhoto"
               });

               eventLogSheet.appendRow([
                 eventId,
                 timestamp,
                 tenantId,
                 branchId,
                 data.prefectureId || "MIE",
                 data.blockId || data.areaName || "",
                 data.userId || data.staffId || "",
                 actType,
                 actCount,
                 latNum,
                 lngNum,
                 meta
               ]);
               finalGpsStatus = "OK";
             } catch(e) {
               console.error("EventLog append error:", e);
               finalGpsStatus = "NO";
             }
           }
         } else {
           finalGpsStatus = "NO";
         }
      }

      // 2. Update 配布実績 Spreadsheet
      const completedAt = Utilities.formatDate(new Date(timestamp), "JST", "yyyy/MM/dd HH:mm:ss");
      const countVal = parseFloat(data.count) || 0;
      let updateSuccess = false;
      let targetRow = existing ? existing.rowNum : null;

      if (ss) {
        try {
          const sheet = ss.getSheetByName("配布実績");
          if (sheet) {
            if (!targetRow) {
               const finder = sheet.getRange("A:A").createTextFinder(String(rowIdNum)).matchEntireCell(true);
               const cell = finder.findNext();
               if (cell) targetRow = cell.getRow();
            }
            if (targetRow) {
              if (isComplete) {
                sheet.getRange(targetRow, 4, 1, 5).setValues([[completedAt, countVal, data.staffName || "", finalGpsStatus, photoStatus]]);
              } else {
                sheet.getRange(targetRow, 4, 1, 5).setValues([["", "", "", "", ""]]); // Revert (Clear D to H)
              }
              updateSuccess = true;
            }
          }
        } catch(e) {
          updateSuccess = false;
        }
      }

      if (!updateSuccess) return { success: false, message: "Spreadsheet record update failed or row not found" };
      return { success: true, rowId: rowIdNum, count: countVal, gpsStatus: finalGpsStatus, photoStatus: photoStatus, timestamp: completedAt };
    }
  };
  GPSRepository.instance = null;
}
