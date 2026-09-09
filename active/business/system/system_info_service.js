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

    getLiffConfig(options, existingSheet) {
      const opts = options || {};
      let liffUrl = opts.productionLiffUrl || opts.liffUrl || this.getConfigProperty('PRODUCTION_LIFF_URL') || this.getConfigProperty('LINE_LIFF_URL') || '';
      let liffId = opts.liffId || this.getConfigProperty('LINE_LIFF_ID') || this.getConfigProperty('LIFF_ID') || '';

      if ((!liffUrl || !liffId) && existingSheet) {
        try {
          const lastRow = existingSheet.getLastRow();
          if (lastRow > 1) {
            const data = existingSheet.getRange(1, 1, lastRow, 2).getValues();
            for (let i = 0; i < data.length; i++) {
              const row = data[i];
              if (row[0] === 'LIFF URL' && row[1] && !liffUrl) liffUrl = String(row[1]).trim();
              if (row[0] === 'LIFF ID' && row[1] && !liffId) liffId = String(row[1]).trim();
            }
          }
        } catch (e) {}
      }

      if (!liffId && liffUrl) {
        const match = String(liffUrl).match(/liff\.line\.me\/([^/?#]+)/i);
        if (match && match[1]) {
          liffId = match[1];
        }
      }

      if (opts.productionLiffUrl || opts.liffUrl) {
        try {
          const props = PropertiesService.getScriptProperties();
          if (props) {
            if (liffUrl) props.setProperty('PRODUCTION_LIFF_URL', liffUrl);
            if (liffId) props.setProperty('LINE_LIFF_ID', liffId);
          }
        } catch (e) {}
      }

      return { url: liffUrl, id: liffId };
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

        const liff = this.getLiffConfig(opts, sheet);
        const baseUrl = opts.baseUrl || 'https://postingmap.jp';
        const districtName = ss.getName();
        const dashboardUrl = `${baseUrl}/active/manager/`;
        const hAppUrl = `${baseUrl}/`;

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
