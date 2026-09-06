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
      throw new Error("Active spreadsheet unavailable");
    }

    computeDeviceSha256(deviceKey) {
      if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) return '';
      try {
        const rawDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, deviceKey.trim(), Utilities.Charset.UTF_8);
        let hexHash = '';
        for (let i = 0; i < rawDigest.length; i++) {
          let byte = rawDigest[i];
          if (byte < 0) byte += 256;
          let hex = byte.toString(16);
          if (hex.length === 1) hex = '0' + hex;
          hexHash += hex;
        }
        return hexHash;
      } catch (e) {
        return '';
      }
    }

    getOrCreateDeviceManagementSheet(ss) {
      const targetSs = ss || this.getSS();
      const sheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function' && CONFIG.get("SHEET_DEVICE_MANAGEMENT")) || "端末管理";
      let sheet = targetSs.getSheetByName(sheetName);
      const targetHeaders = ["contractId", "status", "pcDeviceId", "pcDeviceHash", "mobileDeviceId", "mobileDeviceHash", "registeredAt", "updatedAt", "memo", "contractedPlanCount"];

      if (!sheet) {
        sheet = targetSs.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
        const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
        sheet.appendRow(["CONTRACT-01", "ACTIVE", "PC-01", "", "MOBILE-01", "", nowStr, nowStr, "契約01 (PC-01 / MOBILE-01)", 2]);
        sheet.appendRow(["CONTRACT-02", "ACTIVE", "PC-02", "", "MOBILE-02", "", nowStr, nowStr, "契約02 (PC-02 / MOBILE-02)", 2]);
        return sheet;
      }

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow >= 1 && lastCol >= 1) {
        const currentHeaders = sheet.getRange(1, 1, 1, Math.min(lastCol, targetHeaders.length)).getValues()[0];
        if (currentHeaders[0] !== "contractId") {
          let pc01 = '', pc02 = '', mob01 = '', planCount = 1;
          if (lastRow >= 2) {
            const oldValues = sheet.getRange(2, 1, 1, Math.min(lastCol, 8)).getValues()[0];
            planCount = parseInt(oldValues[1], 10) || 1;
            pc01 = String(oldValues[2] || '').trim();
            pc02 = String(oldValues[3] || '').trim();
            mob01 = String(oldValues[4] || '').trim();
          }
          sheet.clear();
          sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
          const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
          sheet.appendRow(["CONTRACT-01", "ACTIVE", "PC-01", pc01, "MOBILE-01", mob01, nowStr, nowStr, "契約01 (旧データ引継)", planCount]);
          if (planCount >= 2 || pc02) {
            sheet.appendRow(["CONTRACT-02", "ACTIVE", "PC-02", pc02, "MOBILE-02", "", nowStr, nowStr, "契約02 (旧データ引継)", ""]);
          }
        }
      }
      return sheet;
    }

    syncPropertiesDeviceHashes(ss, optSheet) {
      try {
        const targetSs = ss || this.getSS();
        const sheet = optSheet || this.getOrCreateDeviceManagementSheet(targetSs);
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) {
          PropertiesService.getScriptProperties().setProperty('COCKPIT_DEVICE_HASHES', '');
          return;
        }
        const numRows = lastRow - 1;
        const values = sheet.getRange(2, 1, numRows, 6).getValues();
        const activeHashes = [];
        for (let i = 0; i < values.length; i++) {
          const status = String(values[i][1] || '').trim().toUpperCase();
          if (status === 'ACTIVE') {
            const pcHash = String(values[i][3] || '').trim();
            const mobHash = String(values[i][5] || '').trim();
            if (pcHash) activeHashes.push(pcHash);
            if (mobHash) activeHashes.push(mobHash);
          }
        }
        PropertiesService.getScriptProperties().setProperty('COCKPIT_DEVICE_HASHES', activeHashes.join(','));
      } catch (e) {}
    }

    getContractedPlanCountFromSheet(sheet) {
      try {
        if (sheet.getLastRow() >= 2) {
          const val = parseInt(sheet.getRange(2, 10).getValue(), 10);
          if (!isNaN(val) && val > 0) return Math.max(val, 2);
        }
      } catch (e) {}
      return 2;
    }

    getDeviceStatus() {
      const ss = this.getSS();
      const sheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function' && CONFIG.get("SHEET_DEVICE_MANAGEMENT")) || "端末管理";
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { success: true, exists: false, rows: [] };
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2) return { success: true, exists: true, rows: [] };
      const rows = sheet.getRange(2, 1, lastRow - 1, Math.min(lastCol, 10)).getValues();
      return {
        success: true,
        exists: true,
        contractedPlanCount: this.getContractedPlanCountFromSheet(sheet),
        rows: rows.map(r => ({
          contractId: String(r[0] || ''),
          status: String(r[1] || ''),
          pcDeviceId: String(r[2] || ''),
          hasPcHash: !!String(r[3] || '').trim(),
          mobileDeviceId: String(r[4] || ''),
          hasMobileHash: !!String(r[5] || '').trim(),
          memo: String(r[8] || ''),
          contractedPlanCount: r[9]
        }))
      };
    }

    registerOrValidate(payload) {
      const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey || payload.token);
      if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
        return {
          success: false,
          authorized: false,
          code: "MISSING_DEVICE_KEY",
          message: "端末キーが必要です。"
        };
      }

      const clientHash = this.computeDeviceSha256(deviceKey);
      if (!clientHash) {
        return {
          success: false,
          authorized: false,
          code: "INVALID_DEVICE_KEY",
          message: "無効な端末キーです。"
        };
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (e) {
        return {
          success: false,
          authorized: false,
          code: "LOCK_TIMEOUT",
          message: "システムが混雑しています。再度お試しください。"
        };
      }

      try {
        const ss = this.getSS();
        const sheet = this.getOrCreateDeviceManagementSheet(ss);
        const branchName = ss.getName();
        const contractedPlanCount = this.getContractedPlanCountFromSheet(sheet);

        let lastRow = sheet.getLastRow();
        if (lastRow < 2) {
          const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
          sheet.appendRow(["CONTRACT-01", "ACTIVE", "PC-01", "", "MOBILE-01", "", nowStr, nowStr, "契約01 (PC-01 / MOBILE-01)", contractedPlanCount]);
          sheet.appendRow(["CONTRACT-02", "ACTIVE", "PC-02", "", "MOBILE-02", "", nowStr, nowStr, "契約02 (PC-02 / MOBILE-02)", contractedPlanCount]);
          lastRow = sheet.getLastRow();
        }

        const numRows = lastRow - 1;
        const rows = sheet.getRange(2, 1, numRows, 10).getValues();

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const contractId = String(r[0] || '').trim();
          const status = String(r[1] || '').trim().toUpperCase();
          const pcId = String(r[2] || '').trim();
          const pcHash = String(r[3] || '').trim();
          const mobId = String(r[4] || '').trim();
          const mobHash = String(r[5] || '').trim();

          if (clientHash === pcHash) {
            if (status !== 'ACTIVE') {
              return {
                success: false,
                authorized: false,
                code: "DEVICE_REVOKED",
                message: "この契約または端末は無効化されています。"
              };
            }
            this.syncPropertiesDeviceHashes(ss, sheet);
            return {
              success: true,
              authorized: true,
              deviceId: pcId,
              contractId: contractId,
              branchName: branchName,
              contractedPlanCount: contractedPlanCount
            };
          }

          if (clientHash === mobHash) {
            if (status !== 'ACTIVE') {
              return {
                success: false,
                authorized: false,
                code: "DEVICE_REVOKED",
                message: "この契約または端末は無効化されています。"
              };
            }
            this.syncPropertiesDeviceHashes(ss, sheet);
            return {
              success: true,
              authorized: true,
              deviceId: mobId,
              contractId: contractId,
              branchName: branchName,
              contractedPlanCount: contractedPlanCount
            };
          }
        }

        const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

        for (let planIdx = 1; planIdx <= contractedPlanCount; planIdx++) {
          const targetContractId = "CONTRACT-" + String(planIdx).padStart(2, '0');
          const targetPcId = "PC-" + String(planIdx).padStart(2, '0');
          const targetMobId = "MOBILE-" + String(planIdx).padStart(2, '0');

          let foundRowIndex = -1;
          let foundRowData = null;

          for (let i = 0; i < rows.length; i++) {
            if (String(rows[i][0] || '').trim() === targetContractId) {
              foundRowIndex = i + 2;
              foundRowData = rows[i];
              break;
            }
          }

          if (foundRowIndex > 0) {
            const rowStatus = String(foundRowData[1] || '').trim().toUpperCase();
            const existingPcHash = String(foundRowData[3] || '').trim();

            if (rowStatus === 'ACTIVE' && !existingPcHash) {
              sheet.getRange(foundRowIndex, 3).setValue(targetPcId);
              sheet.getRange(foundRowIndex, 4).setValue(clientHash);
              sheet.getRange(foundRowIndex, 8).setValue(nowStr);
              sheet.getRange(foundRowIndex, 9).setValue(targetPcId + " auto-registered (" + nowStr + ")");
              this.syncPropertiesDeviceHashes(ss, sheet);
              return {
                success: true,
                authorized: true,
                registered: true,
                deviceId: targetPcId,
                contractId: targetContractId,
                branchName: branchName,
                contractedPlanCount: contractedPlanCount
              };
            }
          } else {
            sheet.appendRow([targetContractId, "ACTIVE", targetPcId, clientHash, targetMobId, "", nowStr, nowStr, targetPcId + " auto-registered (" + nowStr + ")", ""]);
            this.syncPropertiesDeviceHashes(ss, sheet);
            return {
              success: true,
              authorized: true,
              registered: true,
              deviceId: targetPcId,
              contractId: targetContractId,
              branchName: branchName,
              contractedPlanCount: contractedPlanCount
            };
          }
        }

        return {
          success: false,
          authorized: false,
          code: "DEVICE_LIMIT_EXCEEDED",
          message: "端末契約上限に達しています。この端末は許可されていません。",
          contractedPlanCount: contractedPlanCount
        };
      } catch (err) {
        return {
          success: false,
          authorized: false,
          code: "SERVER_ERROR",
          message: err.toString()
        };
      } finally {
        lock.releaseLock();
      }
    }

    authenticateDashboard(payload) {
      const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey || payload.token);
      if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "Unauthorized: Dashboard terminal authorization required"
        };
      }

      const clientHash = this.computeDeviceSha256(deviceKey);
      if (!clientHash) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "Unauthorized: Dashboard terminal authorization required"
        };
      }

      const props = PropertiesService.getScriptProperties();
      let registeredHashesRaw = props.getProperty('COCKPIT_DEVICE_HASHES') || '';

      if (!registeredHashesRaw) {
        try {
          const ss = this.getSS();
          this.syncPropertiesDeviceHashes(ss);
          registeredHashesRaw = props.getProperty('COCKPIT_DEVICE_HASHES') || '';
        } catch (e) {}
      }

      if (!registeredHashesRaw) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "Unauthorized: Dashboard terminal authorization required"
        };
      }

      const registeredList = registeredHashesRaw.split(',').map(h => h.trim()).filter(Boolean);
      if (registeredList.includes(clientHash)) {
        return { success: true, authorized: true };
      }

      return {
        success: false,
        code: "UNAUTHORIZED",
        message: "Unauthorized: Dashboard terminal authorization required"
      };
    }

    issuePairingToken(payload) {
      const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey || payload.token);
      if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "PC端末の認証が必要です。"
        };
      }

      const clientHash = this.computeDeviceSha256(deviceKey);
      if (!clientHash) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "無効な端末キーです。"
        };
      }

      const pairKey = payload && payload.pairKey ? String(payload.pairKey).trim() : '';
      if (!pairKey) {
        return {
          success: false,
          code: "INVALID_PAIR_KEY",
          message: "ペアリングキーが必要です。"
        };
      }

      const ss = this.getSS();
      const sheet = this.getOrCreateDeviceManagementSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "契約情報が見つかりません。"
        };
      }

      const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      let matchedContractId = '';
      let matchedMobileId = '';

      for (let i = 0; i < rows.length; i++) {
        const contractId = String(rows[i][0] || '').trim();
        const status = String(rows[i][1] || '').trim().toUpperCase();
        const pcHash = String(rows[i][3] || '').trim();
        const mobId = String(rows[i][4] || '').trim();

        if (status === 'ACTIVE' && pcHash === clientHash) {
          matchedContractId = contractId;
          matchedMobileId = mobId || ("MOBILE-" + contractId.replace("CONTRACT-", ""));
          break;
        }
      }

      if (!matchedContractId) {
        return {
          success: false,
          code: "UNAUTHORIZED",
          message: "認証済みの契約PC端末からのみQRコードを発行できます。"
        };
      }

      const props = PropertiesService.getScriptProperties();
      const expiresAt = Date.now() + 35000;
      props.setProperty('MOBILE_PAIRING_KEY', pairKey);
      props.setProperty('MOBILE_PAIRING_EXPIRES', String(expiresAt));
      props.setProperty('MOBILE_PAIRING_CONTRACT_ID', matchedContractId);
      props.setProperty('MOBILE_PAIRING_DEVICE_ID', matchedMobileId);

      return {
        success: true,
        contractId: matchedContractId,
        mobileDeviceId: matchedMobileId
      };
    }

    pairMobile(payload) {
      const pairKey = payload && payload.pairKey ? String(payload.pairKey).trim() : '';
      const deviceKey = payload && (payload.deviceKey || payload.cockpitDeviceKey);

      if (!pairKey || !deviceKey) {
        return {
          success: false,
          code: "MISSING_PARAMS",
          message: "ペアリングキーと端末キーが必要です。"
        };
      }

      const clientHash = this.computeDeviceSha256(deviceKey);
      if (!clientHash) {
        return {
          success: false,
          code: "INVALID_DEVICE_KEY",
          message: "無効な端末キーです。"
        };
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (e) {
        return {
          success: false,
          code: "LOCK_TIMEOUT",
          message: "システムが混雑しています。再度お試しください。"
        };
      }

      try {
        const props = PropertiesService.getScriptProperties();
        const storedPairKey = props.getProperty('MOBILE_PAIRING_KEY') || '';
        const storedExpires = parseInt(props.getProperty('MOBILE_PAIRING_EXPIRES') || '0', 10);
        const targetContractId = props.getProperty('MOBILE_PAIRING_CONTRACT_ID') || '';
        const targetMobileId = props.getProperty('MOBILE_PAIRING_DEVICE_ID') || '';

        if (!storedPairKey || storedPairKey !== pairKey || Date.now() > storedExpires || !targetContractId) {
          return {
            success: false,
            code: "EXPIRED_PAIR_KEY",
            message: "QRコードの有効期限（30秒）が切れているか無効です。PC画面で再発行してください。"
          };
        }

        const ss = this.getSS();
        const sheet = this.getOrCreateDeviceManagementSheet(ss);
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) {
          return {
            success: false,
            code: "CONTRACT_NOT_FOUND",
            message: "契約情報が見つかりません。"
          };
        }

        const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
        let targetRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          const contractId = String(rows[i][0] || '').trim();
          const status = String(rows[i][1] || '').trim().toUpperCase();
          if (contractId === targetContractId && status === 'ACTIVE') {
            targetRowIndex = i + 2;
            break;
          }
        }

        if (targetRowIndex < 0) {
          return {
            success: false,
            code: "CONTRACT_INACTIVE",
            message: "対象の契約が無効化されているか存在しません。"
          };
        }

        const nowStr = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");
        const mobileDeviceId = targetMobileId || ("MOBILE-" + targetContractId.replace("CONTRACT-", ""));

        sheet.getRange(targetRowIndex, 5).setValue(mobileDeviceId);
        sheet.getRange(targetRowIndex, 6).setValue(clientHash);
        sheet.getRange(targetRowIndex, 8).setValue(nowStr);
        sheet.getRange(targetRowIndex, 9).setValue(mobileDeviceId + " registered via QR (" + nowStr + ")");

        this.syncPropertiesDeviceHashes(ss, sheet);

        props.deleteProperty('MOBILE_PAIRING_KEY');
        props.deleteProperty('MOBILE_PAIRING_EXPIRES');
        props.deleteProperty('MOBILE_PAIRING_CONTRACT_ID');
        props.deleteProperty('MOBILE_PAIRING_DEVICE_ID');

        return {
          success: true,
          authorized: true,
          deviceId: mobileDeviceId,
          contractId: targetContractId,
          message: "スマホ端末の登録が完了しました。"
        };
      } catch (err) {
        return {
          success: false,
          code: "SERVER_ERROR",
          message: err.toString()
        };
      } finally {
        lock.releaseLock();
      }
    }

    resetSheet() {
      if (typeof isWebAppCall !== 'undefined' && isWebAppCall) {
        return {
          success: false,
          code: "FORBIDDEN",
          message: "resetSheet is disabled from external Web App calls."
        };
      }
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (e) {
        return { success: false, message: "Lock timeout" };
      }
      try {
        const ss = this.getSS();
        const sheetName = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function' && CONFIG.get("SHEET_DEVICE_MANAGEMENT")) || "端末管理";
        let sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          ss.deleteSheet(sheet);
        }
        sheet = this.getOrCreateDeviceManagementSheet(ss);
        PropertiesService.getScriptProperties().deleteProperty('COCKPIT_DEVICE_HASHES');
        PropertiesService.getScriptProperties().deleteProperty('COCKPIT_DEVICE_TOKEN_HASH');
        PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_KEY');
        PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_EXPIRES');
        PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_CONTRACT_ID');
        PropertiesService.getScriptProperties().deleteProperty('MOBILE_PAIRING_DEVICE_ID');
        return { success: true, message: "Device management sheet reset successfully" };
      } catch (err) {
        return { success: false, message: err.toString() };
      } finally {
        lock.releaseLock();
      }
    }

    registerOrValidateDevice(payload) { return this.registerOrValidate(payload); }
    authenticateDashboardRequest(payload) { return this.authenticateDashboard(payload); }
    issueMobilePairingToken(payload) { return this.issuePairingToken(payload); }
    pairMobileDevice(payload) { return this.pairMobile(payload); }
    resetDeviceManagementSheet() { return this.resetSheet(); }
  }

  DeviceManagementService.instance = null;
  global.DeviceManagementService = DeviceManagementService;
})(this);
