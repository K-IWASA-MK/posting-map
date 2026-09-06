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

    getLiffConfig() {
      const liffUrl = this.getConfigProperty('PRODUCTION_LIFF_URL');
      const fallback = 'https://liff.line.me/2010941735-GRLuqPic';
      const url = liffUrl || fallback;
      let liffId = '';
      try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        liffId = parts[0] || '';
      } catch (e) {}
      return { url: url, id: liffId };
    }

    getDeviceSnapshot(ss) {
      if (typeof DeviceManagementService === 'undefined' || !DeviceManagementService.getInstance) {
        return { contractedPlanCount: 0, activeContractCount: 0, pcDeviceIds: [], mobileDeviceIds: [] };
      }
      const result = DeviceManagementService.getInstance().getDeviceStatus();
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const activeRows = rows.filter(row => String(row.status || '').toUpperCase() === 'ACTIVE');
      return {
        contractedPlanCount: Number(result.contractedPlanCount || 0),
        activeContractCount: activeRows.length,
        pcDeviceIds: activeRows.map(row => row.pcDeviceId).filter(Boolean),
        mobileDeviceIds: activeRows.map(row => row.mobileDeviceId).filter(Boolean)
      };
    }

    syncSystemInfo() {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const ss = this.getSS();
        let sheet = ss.getSheetByName('SYSTEM_INFO');
        if (!sheet) sheet = ss.insertSheet('SYSTEM_INFO');

        const device = this.getDeviceSnapshot(ss);
        const liff = this.getLiffConfig();
        const now = Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss');
        const values = [
          ['key', 'value'],
          ['districtName', ss.getName()],
          ['dashboardUrl', 'https://postingmap.jp/active/manager/'],
          ['hAppUrl', 'https://postingmap.jp/'],
          ['liffUrl', liff.url],
          ['liffId', liff.id],
          ['contractedPlanCount', device.contractedPlanCount],
          ['activeContractCount', device.activeContractCount],
          ['pcDeviceIds', device.pcDeviceIds.join(', ')],
          ['mobileDeviceIds', device.mobileDeviceIds.join(', ')],
          ['syncedAt', now]
        ];

        sheet.clear();
        sheet.getRange(1, 1, values.length, 2).setValues(values);
        sheet.getRange('A1:B1').setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
        sheet.setFrozenRows(1);
        sheet.autoResizeColumns(1, 2);
        SpreadsheetApp.flush();

        return {
          success: true,
          sheetName: 'SYSTEM_INFO',
          districtName: ss.getName(),
          dashboardUrl: 'https://postingmap.jp/active/manager/',
          hAppUrl: 'https://postingmap.jp/',
          liffUrl: liff.url,
          liffId: liff.id,
          contractedPlanCount: device.contractedPlanCount,
          activeContractCount: device.activeContractCount,
          pcDeviceIds: device.pcDeviceIds,
          mobileDeviceIds: device.mobileDeviceIds,
          syncedAt: now
        };
      } finally {
        lock.releaseLock();
      }
    }
  }

  SystemInfoService.instance = null;
  global.SystemInfoService = SystemInfoService;
})(this);
