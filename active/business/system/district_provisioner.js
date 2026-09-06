/**
 * POSTING MAP - District Provisioner (Generation 2)
 * 責務: 新地区作成時の「CSV → 原本5種 → 当月5種」一括生成、および月替わり自動生成
 * 
 * 【厳格な制約】
 * 1. 責務は「原本5種生成」「CSVエリア展開」「当月5種生成（原本からの複製）」「月次トリガー管理」のみ。
 * 2. MonthlySheetResolverとは完全に責務分離する（Resolverは参照解決SSOT、Provisionerが生成SSOT）。
 * 3. 前月シートは一切削除せず、履歴として保持する。
 * 4. SYSTEM_INFO、端末管理は月次化対象外・固定保護。
 * 5. 地区名・自治体名・件数はコードにハードコードせず、CSVおよびSpreadsheetから動的に決定する。
 */
(function(global) {
  class DistrictProvisioner {
    constructor() {
      this.masterNames = {
        distribution: "配布実績の原本",
        staff: "名簿の原本",
        flyer: "保有チラシ枚数の原本",
        transfer: "受渡要請履歴の原本",
        pin: "PinStatusの原本"
      };

      this.prefixes = {
        distribution: "配布実績",
        staff: "名簿",
        flyer: "保有チラシ枚数",
        transfer: "受渡要請履歴",
        pin: "PinStatus"
      };
    }

    static getInstance() {
      if (!DistrictProvisioner.instance) {
        DistrictProvisioner.instance = new DistrictProvisioner();
      }
      return DistrictProvisioner.instance;
    }

    getSS() {
      if (typeof getSS === 'function') {
        return getSS();
      } else if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.getActiveSpreadsheet === 'function') {
        return SpreadsheetApp.getActiveSpreadsheet();
      }
      throw new Error("SpreadsheetApp is unavailable");
    }

    /**
     * 新地区作成時の一括プロビジョニング
     * address_master.csv のデータを受け取り、原本5種 ➔ 当月5種 を一括生成する
     * 
     * @param {Array<Object>} addresses - CSVからパースしたエリア配列 [{ rowId, cityName, townName }, ...]
     * @return {Object} 結果オブジェクト { success: true, count: number, month: string }
     */
    provisionNewDistrict(addresses, options) {
      const ss = this.getSS();
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);

      try {
        if (typeof DeviceManagementService !== 'undefined' && DeviceManagementService.getInstance) {
          const devService = DeviceManagementService.getInstance();
          if (typeof devService.getOrCreateDeviceManagementSheet === 'function') {
            devService.getOrCreateDeviceManagementSheet(ss);
          }
        }

        const sysInfoResult = (typeof SystemInfoService !== 'undefined' && SystemInfoService.getInstance)
          ? SystemInfoService.getInstance().syncSystemInfo(options)
          : this.createOrSyncSystemInfo(ss, options);

        this.createMasterSheets(ss, addresses);

        const monthResult = this.rolloverMonthlySheets();

        SpreadsheetApp.flush();

        const types = ['distribution', 'staff', 'flyer', 'transfer', 'pin'];
        const monthlySheets = types.map(t => `${this.prefixes[t]}${monthResult.month}`);

        const allSheets = [
          "SYSTEM_INFO",
          "端末管理",
          ...Object.values(this.masterNames),
          ...monthlySheets
        ];

        return {
          success: true,
          message: "All 12 district sheets provisioned successfully.",
          districtName: sysInfoResult.districtName,
          sheets: allSheets,
          totalSheetsCount: allSheets.length,
          count: Array.isArray(addresses) ? addresses.length : 0,
          month: monthResult.month
        };
      } finally {
        lock.releaseLock();
      }
    }

    createOrSyncSystemInfo(ss, options) {
      if (typeof SystemInfoService !== 'undefined' && SystemInfoService.getInstance) {
        return SystemInfoService.getInstance().syncSystemInfo(options);
      }
      const opts = options || {};
      const sheetName = "SYSTEM_INFO";
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      const districtName = ss.getName();

      let contractedCount = 2;
      let deviceSummary = "PC-01, PC-02 / MOBILE-01, MOBILE-02";
      if (typeof DeviceManagementService !== 'undefined' && DeviceManagementService.getInstance) {
        const devStatus = DeviceManagementService.getInstance().getDeviceStatus();
        if (devStatus && devStatus.contractedPlanCount) {
          contractedCount = devStatus.contractedPlanCount;
        }
        if (devStatus && Array.isArray(devStatus.rows) && devStatus.rows.length > 0) {
          const pcs = devStatus.rows.map(r => r.pcDeviceId).filter(Boolean);
          const mobs = devStatus.rows.map(r => r.mobileDeviceId).filter(Boolean);
          if (pcs.length > 0 || mobs.length > 0) {
            deviceSummary = `${pcs.join(', ')} / ${mobs.join(', ')}`;
          }
        }
      }

      const baseUrl = opts.baseUrl || "https://postingmap.jp";
      const hAppUrl = `${baseUrl}/`;
      const dashboardUrl = `${baseUrl}/active/manager/`;

      let liffUrl = opts.productionLiffUrl || "";
      let liffId = opts.liffId || "";
      if (!liffId && liffUrl) {
        const match = String(liffUrl).match(/liff\.line\.me\/([^/?#]+)/i);
        if (match && match[1]) {
          liffId = match[1];
        }
      }
      if (!liffId && typeof PropertiesService !== 'undefined') {
        try {
          const props = PropertiesService.getScriptProperties();
          liffId = props.getProperty("LINE_LIFF_ID") || props.getProperty("LIFF_ID") || "";
          if (liffId && !liffUrl) {
            liffUrl = `https://liff.line.me/${liffId}`;
          }
        } catch (e) {}
      }

      const headers = [["項目", "内容"]];
      const rows = [
        ["地区コード", districtName],
        ["地区名", districtName],
        ["HアプリURL", hAppUrl],
        ["Dashboard URL", dashboardUrl],
        ["LIFFアプリ名", `POSTING MAP ${districtName}`],
        ["LIFF ID", liffId],
        ["LIFF URL", liffUrl],
        ["Endpoint URL", hAppUrl],
        ["Dashboard契約数", contractedCount],
        ["Dashboard端末", deviceSummary],
        ["状態", "ACTIVE"]
      ];

      const currentLr = sheet.getLastRow();
      if (currentLr >= 2) {
        sheet.getRange(2, 1, currentLr - 1, 2).clearContent();
      }

      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange("A1:B1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      sheet.getRange(`A2:A${rows.length + 1}`).setFontWeight("bold");
      sheet.setFrozenRows(1);

      return {
        success: true,
        sheet: sheetName,
        districtName: districtName,
        contractedCount: contractedCount,
        deviceSummary: deviceSummary,
        rowCount: rows.length
      };
    }
    /**
     * 原本5種の生成・初期化
     */
    createMasterSheets(ss, addresses) {
      // 1. 配布実績の原本 (全エリアを展開)
      this.createDistributionMaster(ss, addresses);

      // 2. 名簿の原本 (ヘッダーのみ、0行)
      this.createStaffMaster(ss);

      // 3. 保有チラシ枚数の原本 (ヘッダーのみ、0行)
      this.createFlyerMaster(ss);

      // 4. 受渡要請履歴の原本 (ヘッダーのみ、0行)
      this.createTransferMaster(ss);

      // 5. PinStatusの原本 (ヘッダーのみ、0行)
      this.createPinMaster(ss);
    }

    /**
     * 配布実績の原本
     * A〜O列: [ID, 市町村, 町域, 配布完了日時, 配布枚数, 担当者ID, 担当者名, GPS, 写真, 緯度, 経度, GPS日時, 写真ファイルID, 写真URL, 写真日時]
     */
    createDistributionMaster(ss, addresses) {
      const masterName = this.masterNames.distribution;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }

      const headers = [
        ["ID", "市町村", "町域", "配布完了日時", "配布枚数", "担当者ID", "担当者名", "GPS", "写真", "緯度", "経度", "GPS日時", "写真ファイルID", "写真URL", "写真日時"]
      ];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      sheet.getRange("A1:O1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);

      if (Array.isArray(addresses) && addresses.length > 0) {
        const rows = addresses.map((addr, idx) => {
          const rowId = addr.rowId !== undefined ? addr.rowId : (idx + 1);
          const city = addr.cityName || addr.city_name || "";
          const town = addr.townName || addr.town_name || "";
          return [rowId, city, town, "", "", "", "", "", "", "", "", "", "", "", ""];
        });

        // 既存の古い行があればクリア
        const currentLr = sheet.getLastRow();
        if (currentLr >= 2) {
          sheet.getRange(2, 1, currentLr - 1, 15).clearContent();
        }

        // CSVから動的展開
        sheet.getRange(2, 1, rows.length, 15).setValues(rows);
      }
    }

    /**
     * 名簿の原本
     * A〜D列: [ID, 名前, LINE_USER_ID, 登録日時]
     */
    createStaffMaster(ss) {
      const masterName = this.masterNames.staff;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["ID", "名前", "LINE_USER_ID", "登録日時"]];
      sheet.getRange(1, 1, 1, 4).setValues(headers);
      sheet.getRange("A1:D1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * 保有チラシ枚数の原本
     * A〜F列: [ID, 担当者ID, 担当者名, 保管場所, 保有枚数, 最終更新日時]
     */
    createFlyerMaster(ss) {
      const masterName = this.masterNames.flyer;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["ID", "担当者ID", "担当者名", "保管場所", "保有枚数", "最終更新日時"]];
      sheet.getRange(1, 1, 1, 6).setValues(headers);
      sheet.getRange("A1:F1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * 受渡要請履歴の原本
     * A〜G列: [日時, 要請者, 要請者ID, 保管者, 保管者ID, 連絡方法, 連絡先]
     */
    createTransferMaster(ss) {
      const masterName = this.masterNames.transfer;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["日時", "要請者", "要請者ID", "保管者", "保管者ID", "連絡方法", "連絡先"]];
      sheet.getRange(1, 1, 1, 7).setValues(headers);
      sheet.getRange("A1:G1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * PinStatusの原本
     * A〜B列: [rowId, status]
     */
    createPinMaster(ss) {
      const masterName = this.masterNames.pin;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["rowId", "status"]];
      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange("A1:B1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * 原本5種から当月5種を生成・複製する
     * 過去月シートは履歴として保持し、絶対に削除しない。
     * 新月は原本から新規生成し、0から開始する。
     * 
     * @param {string} [targetMonth] - 生成対象年月 (YYYY-MM)。未指定時は現在月。
     * @return {Object} 結果 { success: true, month: string, created: string[] }
     */
    rolloverMonthlySheets(targetMonth) {
      const ss = this.getSS();
      const month = targetMonth || (
        typeof MonthlySheetResolver !== 'undefined' && MonthlySheetResolver.getInstance
          ? MonthlySheetResolver.getInstance().getCurrentMonth()
          : Utilities.formatDate(new Date(), "JST", "yyyy-MM")
      );

      const createdSheets = [];
      const types = ['distribution', 'staff', 'flyer', 'transfer', 'pin'];

      types.forEach(type => {
        const prefix = this.prefixes[type];
        const masterName = this.masterNames[type];
        const monthlyName = `${prefix}${month}`;

        let currentMonthly = ss.getSheetByName(monthlyName);
        if (!currentMonthly) {
          const masterSheet = ss.getSheetByName(masterName);
          if (!masterSheet) {
            throw new Error(`Master template sheet "${masterName}" does not exist. Run provisionNewDistrict first.`);
          }

          // 原本から複製
          currentMonthly = masterSheet.copyTo(ss);
          currentMonthly.setName(monthlyName);

          // 配布実績の場合、原本に記録がある場合でも当月は未完了（初期状態0%）から開始する
          if (type === 'distribution') {
            const lr = currentMonthly.getLastRow();
            if (lr >= 2) {
              // D〜O列 (完了日時、枚数、担当者、GPS、写真等) をクリア
              currentMonthly.getRange(2, 4, lr - 1, 12).clearContent();
            }
          }

          createdSheets.push(monthlyName);
        }
      });

      return {
        success: true,
        month: month,
        created: createdSheets
      };
    }

    /**
     * 毎月1日 0:00 JST に rolloverMonthlySheets を実行する時間主導型トリガーを設定
     */
    setupMonthlyTrigger() {
      if (typeof deleteTriggers === 'function') {
        deleteTriggers("rolloverMonthlySheetsDailyCheck");
      }
      ScriptApp.newTrigger("rolloverMonthlySheetsDailyCheck")
        .timeBased()
        .everyDays(1)
        .atHour(0)
        .create();
      console.log("rolloverMonthlySheetsDailyCheck trigger set: daily at 0:00 AM JST");
    }
  }

  DistrictProvisioner.instance = null;
  global.DistrictProvisioner = DistrictProvisioner;
})(this);
