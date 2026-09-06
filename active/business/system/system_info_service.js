/**
 * POSTING MAP - System Info Service
 * SYSTEM_INFO を実態から再生成する SSOT 同期サービス。
 */
(function(global) {
  class SystemInfoService {
    static getInstance() {
      if (!SystemInfoService.instance) {
        SystemInfoService.instance = new SystemInfoService();
      }
      return SystemInfoService.instance;
    }

    getSS() {
      if (typeof getSS === 'function') return getSS();
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet) {
        return SpreadsheetApp.getActiveSpreadsheet();
      }
      throw new Error('Active spreadsheet unavailable');
    }

    getConfigProperty(key) {
      try {
        return PropertiesService.getScriptProperties().getProperty(key) || '';
      } catch (e) {
        return '';
      }
    }

    getLiffConfig(options) {
      const opts = options || {};
      const liffUrl = opts.productionLiffUrl || this.getConfigProperty('PRODUCTION_LIFF_URL') || this.getConfigProperty('LINE_LIFF_URL') || '';
      let liffId = opts.liffId || this.getConfigProperty('LINE_LIFF_ID') || this.getConfigProperty('LIFF_ID') || '';
      if (!liffId && liffUrl) {
        const match = String(liffUrl).match(/liff\.line\.me\/([^/?#]+)/i);
        if (match && match[1]) {
          liffId = match[1];
        }
      }
      return { url: liffUrl, id: liffId };
    }

    getDeviceSnapshot(ss) {
      if (typeof DeviceManagementService === 'undefined' || !DeviceManagementService.getInstance) {
        return { contractedPlanCount: 2, activeContractCount: 0, pcDeviceIds: [], mobileDeviceIds: [] };
      }
      const result = DeviceManagementService.getInstance().getDeviceStatus();
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const activeRows = rows.filter(row => String(row.status || '').toUpperCase() === 'ACTIVE');
      return {
        contractedPlanCount: Number(result.contractedPlanCount || 2),
        activeContractCount: activeRows.length,
        pcDeviceIds: activeRows.map(row => row.pcDeviceId).filter(Boolean),
        mobileDeviceIds: activeRows.map(row => row.mobileDeviceId).filter(Boolean)
      };
    }

    syncSystemInfo(options) {
      const opts = options || {};
      const token = opts.provisioningToken;
      const tokenCheck = typeof verifyProvisioningToken === 'function'
        ? verifyProvisioningToken(token)
        : { success: false, code: "UNAUTHORIZED", message: "verifyProvisioningToken unavailable" };
      if (!tokenCheck.success) {
        return tokenCheck;
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const ss = this.getSS();
        let sheet = ss.getSheetByName('SYSTEM_INFO');
        if (!sheet) sheet = ss.insertSheet('SYSTEM_INFO');

        const device = this.getDeviceSnapshot(ss);
        const liff = this.getLiffConfig(opts);
        const baseUrl = opts.baseUrl || 'https://postingmap.jp';
        const districtName = ss.getName();
        const dashboardUrl = `${baseUrl}/active/manager/`;
        const hAppUrl = `${baseUrl}/`;
        const deviceSummary = (device.pcDeviceIds.length > 0 || device.mobileDeviceIds.length > 0)
          ? `${device.pcDeviceIds.join(', ')} / ${device.mobileDeviceIds.join(', ')}`
          : 'PC-01, PC-02 / MOBILE-01, MOBILE-02';

        const values = [
          ['項目', '内容'],
          ['地区コード', districtName],
          ['地区名', districtName],
          ['HアプリURL', hAppUrl],
          ['Dashboard URL', dashboardUrl],
          ['LIFFアプリ名', `POSTING MAP ${districtName}`],
          ['LIFF ID', liff.id],
          ['LIFF URL', liff.url],
          ['Endpoint URL', hAppUrl],
          ['Dashboard契約数', device.contractedPlanCount || 2],
          ['Dashboard端末', deviceSummary],
          ['状態', 'ACTIVE']
        ];

        sheet.clear();
        sheet.getRange(1, 1, values.length, 2).setValues(values);
        sheet.getRange('A1:B1').setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
        sheet.getRange(`A2:A${values.length}`).setFontWeight('bold');
        sheet.setFrozenRows(1);
        SpreadsheetApp.flush();

        return {
          success: true,
          sheetName: 'SYSTEM_INFO',
          districtName: districtName,
          dashboardUrl: dashboardUrl,
          hAppUrl: hAppUrl,
          liffUrl: liff.url,
          liffId: liff.id,
          contractedPlanCount: device.contractedPlanCount || 2,
          deviceSummary: deviceSummary,
          status: 'ACTIVE'
        };
      } finally {
        lock.releaseLock();
      }
    }
  }

  SystemInfoService.instance = null;
  global.SystemInfoService = SystemInfoService;
})(this);
