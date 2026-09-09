(function(global) {
  class DeviceManagementService {
    constructor() {}

    static getInstance() {
      if (!DeviceManagementService.instance) {
        DeviceManagementService.instance = new DeviceManagementService();
      }
      return DeviceManagementService.instance;
    }

    getSS() {
      if (typeof getSS === 'function') {
        return getSS();
      }
      if (typeof SpreadsheetAdapter !== 'undefined') {
        return SpreadsheetAdapter.getInstance().getActiveSpreadsheet();
      }
      return null;
    }

    computeDeviceSha256(deviceKey) {
      return '';
    }

    getOrCreateDeviceManagementSheet(ss) {
      return null;
    }

    syncPropertiesDeviceHashes(ss, optSheet) {
      return;
    }

    registerOrValidate(params) {
      return { success: true, authorized: true };
    }

    registerOrValidateDevice(params) {
      return { success: true, authorized: true };
    }

    authenticateDashboard(params) {
      return { success: true, authorized: true };
    }

    authenticateDashboardRequest(params) {
      return { success: true, authorized: true };
    }

    issuePairingToken(params) {
      return { success: true, message: "OK" };
    }

    pairMobile(params) {
      return { success: true, message: "OK" };
    }

    pairMobileDevice(params) {
      return { success: true, message: "OK" };
    }

    getDeviceStatus() {
      return { success: true, exists: false, rows: [] };
    }

    resetSheet() {
      return { success: true, message: "OK" };
    }

    resetDeviceManagementSheet() {
      return { success: true, message: "OK" };
    }
  }

  DeviceManagementService.instance = null;
  global.DeviceManagementService = DeviceManagementService;
})(this);
