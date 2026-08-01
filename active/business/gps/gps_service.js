/**
 * Business Layer - GPS Service Module
 * 
 * Domain: GPS / Photo Domain
 * Layer: Business Layer
 * Responsibility: GPS・写真保存に関する業務フロー統括、排他制御、およびシステムログ管理
 */

if (typeof GPSService === 'undefined') {
  GPSService = class GPSService {
    constructor() {
      this.repository = GPSRepository.getInstance();
    }

    static getInstance() {
      if (!GPSService.instance) {
        GPSService.instance = new GPSService();
      }
      return GPSService.instance;
    }

    updateRecordWithGPSPhoto(data) {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);
      } catch (e) {
        console.error("[GPSService] Lock timeout error:", e);
        return { success: false, message: "サーバーが混雑しています。時間をおいて再度お試しください。" };
      }

      try {
        console.log("[GPSService] Start processing GPS/Photo record update for staff:", data ? data.staffName : "Unknown");
        
        let photoUrl = "";
        const isComplete = data.isDone === 'true' || data.isDone === true;
        if (isComplete && data.photoData) {
          console.log("[GPSService] Uploading photo to Google Drive...");
          photoUrl = this.repository.savePhotoToDrive(data);
          console.log("[GPSService] Photo upload complete, fileId/url:", photoUrl);
        }

        console.log("[GPSService] Updating Spreadsheet record & EventLog...");
        const result = this.repository.updateSheetRecordAndLog(data, photoUrl);
        console.log("[GPSService] GPS/Photo record update completed successfully.");
        
        return result;
      } catch (e) {
        console.error("[GPSService] Error processing updateRecordWithGPSPhoto:", e);
        return { success: false, message: e.toString() };
      } finally {
        lock.releaseLock();
      }
    }
  };
  GPSService.instance = null;
}
