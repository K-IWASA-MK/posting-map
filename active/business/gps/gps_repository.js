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

    savePhotoToDrive(data) {
      if (!data.photoData || data.photoData.indexOf("data:image") !== 0) {
        return "";
      }
      try {
        const folderId = (typeof getStorageFolderId === 'function') ? getStorageFolderId() : null;
        if (!folderId) return "";
        const folder = DriveApp.getFolderById(folderId);
        const now = new Date();
        const timeStr = Utilities.formatDate(now, "JST", "HHmm");
        const safeStaffName = data.staffName ? data.staffName.replace(/[\s　]/g, "") : "Unknown";
        const legacySheetName = data.legacySheetName || data.areaName || "UnknownArea";
        const fileName = `[${legacySheetName}]_${safeStaffName}_${timeStr}.jpg`;
        const base64Data = data.photoData.split(",")[1];
        const decoded = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(decoded, "image/jpeg", fileName);
        const file = folder.createFile(blob);
        return file.getId();
      } catch (driveErr) {
        console.error("Google Drive Save Error:", driveErr);
        return "";
      }
    }

    updateSheetRecordAndLog(data, photoUrl) {
      const isComplete = data.isDone === 'true' || data.isDone === true;
      const actType = isComplete ? "photo" : "revert_photo";
      const actCount = isComplete ? (parseFloat(data.count) || 1) : -(parseFloat(data.count) || 1);

      const event = {
        id: Utilities.getUuid(),
        timestamp: Date.now(),
        tenantId: data.tenantId || ((typeof CONFIG !== 'undefined' && CONFIG.get) ? CONFIG.get("DEFAULT_TENANT_ID") : "DEFAULT_TENANT"),
        branchId: data.branchId || ((typeof CONFIG !== 'undefined' && CONFIG.get) ? CONFIG.get("DEFAULT_BRANCH_ID", data.tenantId) : "DEFAULT_BRANCH"),
        prefectureId: data.prefectureId || "MIE",
        blockId: data.blockId || data.areaName,
        userId: data.userId || data.staffId,
        actionType: actType,
        count: actCount,
        lat: data.lat || data.latitude || 0,
        lng: data.lng || data.longitude || 0,
        meta: data.meta || { 
          photoUrl: photoUrl || data.photoUrl,
          legacyRow: data.rowId, 
          staffName: data.staffName,
          legacySheetName: data.legacySheetName || data.areaName
        }
      };

      let ss = null;
      if (typeof getSS === 'function') {
        ss = getSS();
      }

      if (ss) {
        const legacySheetName = data.legacySheetName || data.areaName || "UnknownArea";
        const legacySheet = ss.getSheetByName(legacySheetName);
        
        if (legacySheet) {
          const rowNum = parseInt(data.rowId || data.legacyRow, 10);
          const completedAt = Utilities.formatDate(new Date(event.timestamp), "JST", "MM/dd HH:mm");
          legacySheet.getRange(rowNum, 4, 1, 5).setValues([[
            isComplete,
            isComplete ? completedAt : "",
            isComplete ? (parseFloat(data.count) || 0) : "",
            isComplete ? (data.staffName || "") : "",
            isComplete ? (data.userId || data.staffId || "") : ""
          ]]);

          if (isComplete) {
            const gpsStr = (event.lat && event.lng) ? `${event.lat},${event.lng}` : "";
            legacySheet.getRange(rowNum, 9).setValue(gpsStr);
            if (photoUrl) {
              legacySheet.getRange(rowNum, 10).setValue(photoUrl);
            }
          } else {
            legacySheet.getRange(rowNum, 9, 1, 2).setValues([["", ""]]);
          }
        }
      }

      return { success: true, status: "ok", id: event.id };
    }
  };
  GPSRepository.instance = null;
}
