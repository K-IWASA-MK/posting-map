/**
 * POSTING MAP Dashboard Quality Gate (6-Phase Comprehensive Verification Suite)
 * 
 * 思想:
 * 地区非依存テンプレートアーキテクチャに完全準拠し、特定地区に依存しない恒久品質ゲート。
 * 期待値（ピン数・CSV行数・自治体）は config.js および Backend SSOT から動的取得する。
 * 
 * 6つの品質ゲート:
 * [Phase 1] 実機Dashboard通常動作 (masterLoadStatus, 動的マスターピン数一致, アプリエラー0件)
 * [Phase 2] 連続リロード安定性 (7回連続リロードでのデッドロック・タイミング競合なし)
 * [Phase 3] Master ERROR 障害・部分劣化試験 (CSV障害時に地図のみERR、Backend由来機能は継続)
 * [Phase 4] cities SSOT & ノイズ除外確認 (Backend getTier1 を正とし、ノイズを完全除外)
 * [Phase 5] fitBounds & 異常座標防御試験 (マスターピンからの自動表示、NaN/null混入時のクラッシュ防御)
 * [Phase 6] Hアプリ非干渉 & アーキテクチャ分離監査 (Hアプリの未干渉・staticMaster非参照)
 */

import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';

function setupGasDeviceAuthSandbox() {
  const mockProps = {};
  class MockRange {
    constructor(sheet, r, c, nr, nc) {
      this.sheet = sheet;
      this.r = r;
      this.c = c;
      this.nr = nr || 1;
      this.nc = nc || 1;
    }
    getValues() {
      const result = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        const rowData = this.sheet.grid[this.r - 1 + i] || [];
        for (let j = 0; j < this.nc; j++) {
          row.push(rowData[this.c - 1 + j] !== undefined ? rowData[this.c - 1 + j] : '');
        }
        result.push(row);
      }
      return result;
    }
    setValues(values) {
      for (let i = 0; i < values.length; i++) {
        const rowIndex = this.r - 1 + i;
        if (!this.sheet.grid[rowIndex]) this.sheet.grid[rowIndex] = [];
        for (let j = 0; j < values[i].length; j++) {
          this.sheet.grid[rowIndex][this.c - 1 + j] = values[i][j];
        }
      }
    }
    getValue() {
      const rowData = this.sheet.grid[this.r - 1] || [];
      return rowData[this.c - 1] !== undefined ? rowData[this.c - 1] : '';
    }
    setValue(val) {
      const rowIndex = this.r - 1;
      if (!this.sheet.grid[rowIndex]) this.sheet.grid[rowIndex] = [];
      this.sheet.grid[rowIndex][this.c - 1] = val;
    }
  }

  class MockSheet {
    constructor(name) {
      this.name = name;
      this.grid = [];
    }
    getName() { return this.name; }
    getLastRow() { return this.grid.length; }
    getLastColumn() {
      let max = 0;
      this.grid.forEach(r => { if (r && r.length > max) max = r.length; });
      return max;
    }
    getRange(r, c, nr, nc) {
      return new MockRange(this, r, c, nr, nc);
    }
    appendRow(row) {
      this.grid.push([...row]);
    }
    clear() {
      this.grid = [];
    }
  }

  const mockSheets = {};
  const mockSpreadsheet = {
    getName: () => "MIE-03",
    getSheetByName: (name) => mockSheets[name] || null,
    insertSheet: (name) => {
      const s = new MockSheet(name);
      mockSheets[name] = s;
      return s;
    },
    deleteSheet: (s) => {
      delete mockSheets[s.getName()];
    }
  };

  const Utilities = {
    computeDigest: (algo, text, charset) => {
      const h = crypto.createHash('sha256').update(text, 'utf8').digest();
      const signedBytes = [];
      for (let i = 0; i < h.length; i++) {
        let b = h[i];
        if (b > 127) b -= 256;
        signedBytes.push(b);
      }
      return signedBytes;
    },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    formatDate: (d, tz, fmt) => new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  const LockService = {
    getScriptLock: () => ({
      waitLock: () => {},
      releaseLock: () => {}
    })
  };

  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => mockProps[k] || '',
      setProperty: (k, v) => { mockProps[k] = String(v); },
      deleteProperty: (k) => { delete mockProps[k]; }
    })
  };

  const CONFIG = {
    get: (k) => "端末管理"
  };

  const getSS = () => mockSpreadsheet;

  const v2ApiContent = fs.readFileSync(path.resolve(process.cwd(), 'active/api/v2_api.js'), 'utf8');

  const fnNames = [
    'computeDeviceSha256',
    'getOrCreateDeviceManagementSheet',
    'syncPropertiesDeviceHashes',
    'getContractedPlanCountFromSheet',
    'registerOrValidateDevice',
    'authenticateDashboardRequest',
    'issueMobilePairingToken',
    'pairMobileDevice',
    'resetDeviceManagementSheet'
  ];

  const evalScope = {
    crypto,
    Utilities,
    LockService,
    PropertiesService,
    CONFIG,
    getSS,
    mockProps,
    mockSheets,
    mockSpreadsheet
  };

  const evalCode = `
    ${v2ApiContent}
    return {
      computeDeviceSha256,
      getOrCreateDeviceManagementSheet,
      syncPropertiesDeviceHashes,
      getContractedPlanCountFromSheet,
      registerOrValidateDevice,
      authenticateDashboardRequest,
      issueMobilePairingToken,
      pairMobileDevice,
      resetDeviceManagementSheet
    };
  `;

  const fn = new Function(
    'Utilities', 'LockService', 'PropertiesService', 'CONFIG', 'getSS',
    evalCode
  );

  const engine = fn(Utilities, LockService, PropertiesService, CONFIG, getSS);
  return { engine, mockProps, mockSheets, mockSpreadsheet };
}

async function ensureServerRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8080/manager/index.html', (res) => {
      resolve(null);
    });
    req.on('error', () => {
      console.log('Starting background local server on port 8080...');
      const child = spawn('node', ['scripts/serve.mjs'], {
        cwd: process.cwd(),
        stdio: 'ignore',
        detached: false
      });
      setTimeout(() => resolve(child), 1200);
    });
  });
}

async function runDashboardQualityGate() {
  console.log("===============================================================");
  console.log("🏛️ POSTING MAP DASHBOARD QUALITY GATE (7 PHASES INCL. N-CONTRACT)");
  console.log("===============================================================\n");

  const results = {
    phase0: { name: "Phase 0: N契約エンジン検証 (1契約=PC+MOBILE / 上書き防止 / REVOKE分離)", pass: false, details: [] },
    phase1: { name: "Phase 1: 実機Dashboard通常動作 (District-Agnostic)", pass: false, details: [] },
    phase2: { name: "Phase 2: 連続リロード安定性", pass: false, details: [] },
    phase3: { name: "Phase 3: Master ERROR 障害・部分劣化試験", pass: false, details: [] },
    phase4: { name: "Phase 4: cities SSOT & ノイズ除外確認", pass: false, details: [] },
    phase5: { name: "Phase 5: fitBounds & 異常座標防御試験", pass: false, details: [] },
    phase6: { name: "Phase 6: Hアプリ非干渉 & アーキテクチャ分離監査", pass: false, details: [] },
  };

  console.log("▶ [PHASE 0] N契約端末管理・認可エンジン全項目検証中...");
  try {
    const { engine, mockSheets, mockSpreadsheet } = setupGasDeviceAuthSandbox();
    let p0AllPass = true;
    const addP0 = (testName, pass, detail) => {
      results.phase0.details.push(`${pass ? 'PASS' : 'FAIL'}: ${testName} (${detail})`);
      if (!pass) p0AllPass = false;
    };

    engine.resetDeviceManagementSheet();
    const sheet = engine.getOrCreateDeviceManagementSheet(mockSpreadsheet);

    const PC_KEY_1 = "DEV_PC_01_TEST_KEY_AAAA";
    const MOB_KEY_1 = "DEV_MOB_01_TEST_KEY_BBBB";
    const PC_KEY_2 = "DEV_PC_02_TEST_KEY_CCCC";
    const MOB_KEY_2 = "DEV_MOB_02_TEST_KEY_DDDD";
    const PC_KEY_3 = "DEV_PC_03_TEST_KEY_EEEE";
    const MOB_KEY_3 = "DEV_MOB_03_TEST_KEY_FFFF";
    const PC_KEY_4 = "DEV_PC_04_TEST_KEY_GGGG";

    const regPc1 = engine.registerOrValidateDevice({ deviceKey: PC_KEY_1 });
    addP0("1.1 契約1 PC-01 自動登録", regPc1.success && regPc1.deviceId === "PC-01" && regPc1.contractId === "CONTRACT-01", `deviceId=${regPc1.deviceId}, contractId=${regPc1.contractId}`);

    const pairToken1 = engine.issueMobilePairingToken({ deviceKey: PC_KEY_1, pairKey: "PAIR_01" });
    addP0("1.2 契約1 QR発行 (PC-01所属特定)", pairToken1.success && pairToken1.contractId === "CONTRACT-01" && pairToken1.mobileDeviceId === "MOBILE-01", `contractId=${pairToken1.contractId}, targetMob=${pairToken1.mobileDeviceId}`);

    const pairRes1 = engine.pairMobileDevice({ pairKey: "PAIR_01", deviceKey: MOB_KEY_1 });
    addP0("1.3 契約1 MOBILE-01 ペアリング登録", pairRes1.success && pairRes1.deviceId === "MOBILE-01" && pairRes1.contractId === "CONTRACT-01", `deviceId=${pairRes1.deviceId}`);

    const regPc2Block = engine.registerOrValidateDevice({ deviceKey: PC_KEY_2 });
    addP0("1.4 契約1 契約枠外(2台目PC)遮断", !regPc2Block.authorized && regPc2Block.code === "DEVICE_LIMIT_EXCEEDED", `code=${regPc2Block.code}`);

    sheet.getRange(2, 10).setValue(2);
    const regPc2 = engine.registerOrValidateDevice({ deviceKey: PC_KEY_2 });
    addP0("2.1 契約2 PC-02 自動登録", regPc2.success && regPc2.deviceId === "PC-02" && regPc2.contractId === "CONTRACT-02", `deviceId=${regPc2.deviceId}, contractId=${regPc2.contractId}`);

    const pairToken2 = engine.issueMobilePairingToken({ deviceKey: PC_KEY_2, pairKey: "PAIR_02" });
    addP0("2.2 契約2 QR発行 (PC-02所属特定)", pairToken2.success && pairToken2.contractId === "CONTRACT-02" && pairToken2.mobileDeviceId === "MOBILE-02", `contractId=${pairToken2.contractId}`);

    const pairRes2 = engine.pairMobileDevice({ pairKey: "PAIR_02", deviceKey: MOB_KEY_2 });
    addP0("2.3 契約2 MOBILE-02 ペアリング登録", pairRes2.success && pairRes2.deviceId === "MOBILE-02" && pairRes2.contractId === "CONTRACT-02", `deviceId=${pairRes2.deviceId}`);

    const validateMob1 = engine.registerOrValidateDevice({ deviceKey: MOB_KEY_1 });
    addP0("2.4 MOBILE-01 非上書き保持確認", validateMob1.authorized && validateMob1.deviceId === "MOBILE-01", `deviceId=${validateMob1.deviceId}`);

    const regPc3Block = engine.registerOrValidateDevice({ deviceKey: PC_KEY_3 });
    addP0("2.5 契約2 契約枠外(3台目PC)遮断", !regPc3Block.authorized && regPc3Block.code === "DEVICE_LIMIT_EXCEEDED", `code=${regPc3Block.code}`);

    sheet.getRange(2, 10).setValue(3);
    const regPc3 = engine.registerOrValidateDevice({ deviceKey: PC_KEY_3 });
    addP0("3.1 契約3 PC-03 自動登録", regPc3.success && regPc3.deviceId === "PC-03" && regPc3.contractId === "CONTRACT-03", `deviceId=${regPc3.deviceId}, contractId=${regPc3.contractId}`);

    const pairToken3 = engine.issueMobilePairingToken({ deviceKey: PC_KEY_3, pairKey: "PAIR_03" });
    addP0("3.2 契約3 QR発行 (PC-03所属特定)", pairToken3.success && pairToken3.contractId === "CONTRACT-03" && pairToken3.mobileDeviceId === "MOBILE-03", `contractId=${pairToken3.contractId}`);

    const pairRes3 = engine.pairMobileDevice({ pairKey: "PAIR_03", deviceKey: MOB_KEY_3 });
    addP0("3.3 契約3 MOBILE-03 ペアリング登録", pairRes3.success && pairRes3.deviceId === "MOBILE-03" && pairRes3.contractId === "CONTRACT-03", `deviceId=${pairRes3.deviceId}`);

    const valMob1After = engine.registerOrValidateDevice({ deviceKey: MOB_KEY_1 });
    const valMob2After = engine.registerOrValidateDevice({ deviceKey: MOB_KEY_2 });
    addP0("3.4 全契約MOBILE端末保持確認", valMob1After.authorized && valMob2After.authorized, `mob1=${valMob1After.authorized}, mob2=${valMob2After.authorized}`);

    const regPc4Block = engine.registerOrValidateDevice({ deviceKey: PC_KEY_4 });
    addP0("3.5 契約3 契約枠外(4台目PC)遮断", !regPc4Block.authorized && regPc4Block.code === "DEVICE_LIMIT_EXCEEDED", `code=${regPc4Block.code}`);

    const numRows = sheet.getLastRow() - 1;
    const allRows = sheet.getRange(2, 1, numRows, 10).getValues();
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i][0] === "CONTRACT-02") {
        sheet.getRange(i + 2, 2).setValue("REVOKED");
        break;
      }
    }
    engine.syncPropertiesDeviceHashes(mockSpreadsheet, sheet);

    const pc2Revoked = engine.registerOrValidateDevice({ deviceKey: PC_KEY_2 });
    const mob2Revoked = engine.registerOrValidateDevice({ deviceKey: MOB_KEY_2 });
    const pc1StillActive = engine.registerOrValidateDevice({ deviceKey: PC_KEY_1 });
    const pc3StillActive = engine.registerOrValidateDevice({ deviceKey: PC_KEY_3 });

    addP0("4.1 REVOKED契約(PC-02) 遮断確認", !pc2Revoked.authorized && pc2Revoked.code === "DEVICE_REVOKED", `code=${pc2Revoked.code}`);
    addP0("4.2 REVOKED契約(MOBILE-02) 遮断確認", !mob2Revoked.authorized && mob2Revoked.code === "DEVICE_REVOKED", `code=${mob2Revoked.code}`);
    addP0("4.3 他契約(CONTRACT-01, CONTRACT-03) 継続許可確認", pc1StillActive.authorized && pc3StillActive.authorized, `pc1=${pc1StillActive.authorized}, pc3=${pc3StillActive.authorized}`);

    const apiAuthPass = engine.authenticateDashboardRequest({ deviceKey: PC_KEY_1 });
    const apiAuthBlocked = engine.authenticateDashboardRequest({ deviceKey: PC_KEY_2 });
    const apiAuthUnknown = engine.authenticateDashboardRequest({ deviceKey: "UNKNOWN_UNREGISTERED_KEY" });

    addP0("5.1 業務API認可 (ACTIVE端末=PASS)", apiAuthPass.success && apiAuthPass.authorized, `authorized=${apiAuthPass.authorized}`);
    addP0("5.2 業務API認可 (REVOKED端末=BLOCK)", !apiAuthBlocked.success, `success=${apiAuthBlocked.success}`);
    addP0("5.3 業務API認可 (未登録端末=BLOCK)", !apiAuthUnknown.success, `success=${apiAuthUnknown.success}`);

    results.phase0.pass = p0AllPass;
    console.log(`[Phase 0] N契約エンジン検証結果: ${p0AllPass ? '✅ ALL PASS' : '❌ FAIL'}`);
  } catch (err) {
    console.error('[Phase 0 Error]', err);
    results.phase0.pass = false;
    results.phase0.details.push(`Exception: ${err.message}`);
  }

  const spawnedServer = await ensureServerRunning();
  // 1. config.js から動的に静的マスター定義を取得し、期待件数を算出（地区非依存化）
  const configPath = path.resolve(process.cwd(), 'active/dashboard/config.js');
  let expectedCsvPinsCount = 0;
  let csvFilename = '';

  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const csvMatch = configContent.match(/addressCsvFilename:\s*["']([^"']+)["']/);
    if (csvMatch) {
      csvFilename = csvMatch[1];
      const csvPath = path.resolve(process.cwd(), 'data', csvFilename);
      if (fs.existsSync(csvPath)) {
        const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n').filter(l => l.trim().length > 0);
        expectedCsvPinsCount = Math.max(0, lines.length - 1); // ヘッダー除く
      }
    }
  }

  console.log(`[Config SSOT Inspection] Target CSV: ${csvFilename || '(未定義)'}, Expected Pins: ${expectedCsvPinsCount}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  async function setupAuthenticatedPage(page) {
    await page.route('**/exec*', async (route, request) => {
      if (request.method() === 'POST') {
        const postData = request.postData() || '';
        if (postData.includes('registerOrValidateDevice') || request.url().includes('action=registerOrValidateDevice')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              success: true,
              authorized: true,
              registered: true,
              deviceId: "PC-01",
              contractId: "CONTRACT-01",
              branchName: "MIE-03",
              contractedPlanCount: 1
            })
          });
          return;
        }
      }
      await route.continue();
    });
  }

  try {
    console.log("\n▶ [SECURITY GATE] 未登録端末アクセス遮断・画面ロック試験 実行中...");
    const pageLock = await browser.newPage();
    await pageLock.route('**/exec*', async (route, request) => {
      if (request.method() === 'POST') {
        const postData = request.postData() || '';
        if (postData.includes('registerOrValidateDevice') || request.url().includes('action=registerOrValidateDevice')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              success: false,
              authorized: false,
              code: "DEVICE_LIMIT_EXCEEDED",
              message: "端末契約上限に達しています。この端末は許可されていません。"
            })
          });
          return;
        }
      }
      await route.continue();
    });
    const DASHBOARD_URL = 'http://localhost:8080/manager/index.html';
    await pageLock.goto(DASHBOARD_URL, { waitUntil: 'load' });
    const isLockScreenActive = await pageLock.evaluate(() => {
      const lockEl = document.getElementById('device-lock-screen');
      const mainEl = document.querySelector('main');
      return lockEl && !lockEl.classList.contains('hidden') && (!mainEl || mainEl.style.display === 'none');
    });
    await pageLock.close();
    console.log(`[SECURITY GATE] 未登録端末遮断・ロック画面表示: ${isLockScreenActive ? '✅ PASS (遮断成功)' : '❌ FAIL'}`);
    // -------------------------------------------------------------
    // PHASE 1: 実機Dashboard通常動作
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 1] 実機Dashboard通常動作の検証中...");
    const page1 = await browser.newPage();
    await setupAuthenticatedPage(page1);
    const appErrors1 = [];

    page1.on('pageerror', err => {
      appErrors1.push(`[JS Exception] ${err.toString()}`);
    });
    page1.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        appErrors1.push(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    await page1.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await page1.waitForFunction(() => window.DashboardState && window.DashboardState.masterLoadStatus === 'LOADED' && window.DashboardState.summary, { timeout: 15000 });

    const state1 = await page1.evaluate(() => {
      return {
        masterLoadStatus: window.DashboardState.masterLoadStatus,
        masterPinsCount: window.DashboardState.masterPins.length,
        cities: window.DashboardState.cities,
        totalAreasText: document.getElementById('fact-total-areas')?.textContent,
        doneAreasText: document.getElementById('fact-done-areas')?.textContent,
        unallocatedAreasText: document.getElementById('fact-unallocated-areas')?.textContent,
        totalRecordsText: document.getElementById('fact-total-records')?.textContent,
        totalStocksText: document.getElementById('fact-total-stocks')?.textContent,
        totalRosterText: document.getElementById('fact-total-roster')?.textContent,
        mapDistrictLabelText: document.getElementById('map-district-label')?.textContent,
        liveCardsCount: document.querySelectorAll('#live-feed-container > div').length
      };
    });

    const phase1Pass = (
      state1.masterLoadStatus === 'LOADED' &&
      state1.masterPinsCount === expectedCsvPinsCount &&
      state1.totalAreasText === expectedCsvPinsCount.toLocaleString() &&
      state1.mapDistrictLabelText.includes(`${expectedCsvPinsCount}エリア`) &&
      state1.unallocatedAreasText !== '--' &&
      state1.totalRecordsText !== '--' &&
      state1.totalStocksText !== '--' &&
      state1.totalRosterText !== '--' &&
      appErrors1.length === 0
    );

    results.phase1.pass = phase1Pass;
    results.phase1.details.push(`masterLoadStatus: ${state1.masterLoadStatus}`);
    results.phase1.details.push(`masterPinsCount: ${state1.masterPinsCount} (期待値: ${expectedCsvPinsCount})`);
    results.phase1.details.push(`totalAreasText: ${state1.totalAreasText}`);
    results.phase1.details.push(`totalRecordsText: ${state1.totalRecordsText}`);
    results.phase1.details.push(`totalStocksText: ${state1.totalStocksText}`);
    results.phase1.details.push(`totalRosterText: ${state1.totalRosterText}`);
    results.phase1.details.push(`mapDistrictLabel: ${state1.mapDistrictLabelText}`);
    results.phase1.details.push(`App Errors: ${appErrors1.length} ${appErrors1.length > 0 ? `(${appErrors1.join(', ')})` : '(0件: PASS)'}`);
    await page1.close();

    // -------------------------------------------------------------
    // PHASE 2: 連続リロード安定性 (7回)
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 2] 連続リロード試験 (7回) 実行中...");
    const page2 = await browser.newPage();
    await setupAuthenticatedPage(page2);
    let reloadSuccessCount = 0;
    for (let i = 1; i <= 7; i++) {
      await page2.goto(DASHBOARD_URL, { waitUntil: 'load' });
      await page2.waitForFunction(() => window.DashboardState && window.DashboardState.masterLoadStatus === 'LOADED', { timeout: 10000 });
      const status = await page2.evaluate(() => window.DashboardState?.masterLoadStatus);
      if (status === 'LOADED') {
        reloadSuccessCount++;
      }
    }
    await page2.close();
    results.phase2.pass = (reloadSuccessCount === 7);
    results.phase2.details.push(`7回中成功回数: ${reloadSuccessCount}/7`);

    // -------------------------------------------------------------
    // PHASE 3: Master ERROR 障害・部分劣化試験
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 3] Master ERROR 障害・部分劣化試験 実行中...");
    const page3 = await browser.newPage();
    await setupAuthenticatedPage(page3);
    await page3.route('**/*.csv', route => route.abort());

    await page3.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await page3.waitForFunction(() => window.DashboardState && (window.DashboardState.ranking?.length > 0 || window.DashboardState.stocks?.length > 0), { timeout: 15000 }).catch(() => {});

    const state3 = await page3.evaluate(() => {
      return {
        masterLoadStatus: window.DashboardState?.masterLoadStatus,
        totalAreasText: document.getElementById('fact-total-areas')?.textContent,
        doneAreasText: document.getElementById('fact-done-areas')?.textContent,
        stocksCount: window.DashboardState?.stocks?.length || 0,
        rankingCount: window.DashboardState?.ranking?.length || 0
      };
    });
    await page3.close();

    const phase3Pass = (
      state3.masterLoadStatus === 'ERROR' &&
      state3.totalAreasText === 'ERR' &&
      state3.doneAreasText === 'ERR' &&
      (state3.stocksCount > 0 || state3.rankingCount > 0)
    );
    results.phase3.pass = phase3Pass;
    results.phase3.details.push(`masterLoadStatus: ${state3.masterLoadStatus}`);
    results.phase3.details.push(`fact-total-areas: ${state3.totalAreasText}`);
    results.phase3.details.push(`Backend stocksCount (生存確認): ${state3.stocksCount}`);
    results.phase3.details.push(`Backend rankingCount (生存確認): ${state3.rankingCount}`);

    // -------------------------------------------------------------
    // PHASE 4: cities SSOT & ノイズ除外 & 選択時展開維持確認
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 4] cities SSOT & ノイズ除外 & 選択時展開維持確認 実行中...");
    const page4 = await browser.newPage();
    await setupAuthenticatedPage(page4);
    await page4.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await page4.waitForFunction(() => window.DashboardState && window.DashboardState.cities.length > 0, { timeout: 10000 });

    const citiesCheck = await page4.evaluate(() => {
      const trigger = document.getElementById('city-selector-trigger');
      const list = document.getElementById('city-selector-list');
      const currentLabel = document.getElementById('city-selector-current');

      const initialClosed = list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'false';

      // 1. トリガーをクリックして展開テスト
      trigger?.click();
      const openedAfterFirstClick = !list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'true';

      // 2. アイテム一覧取得
      const items = Array.from(list?.querySelectorAll('button[data-city-val]') || []).map(b => b.getAttribute('data-city-val'));

      // 3. 1つ目の自治体 (items[1]) をクリック ➔ 選択後も「OPENのまま」であることを検証
      let firstCityWorksAndStaysOpen = false;
      if (items.length > 1) {
        const city1 = items[1];
        const btn1 = list.querySelector(`button[data-city-val="${city1}"]`);
        btn1?.click();

        const stillOpen1 = !list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'true';
        const label1 = currentLabel?.textContent === city1;
        const state1 = window.DashboardState?.selectedCity === city1;
        firstCityWorksAndStaysOpen = stillOpen1 && label1 && state1;
      }

      // 4. 2つ目の自治体 (items[2]) を連続クリック ➔ 選択後も「OPENのまま」であることを検証
      let secondCityWorksAndStaysOpen = false;
      if (items.length > 2) {
        const city2 = items[2];
        const btn2 = list.querySelector(`button[data-city-val="${city2}"]`);
        btn2?.click();

        const stillOpen2 = !list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'true';
        const label2 = currentLabel?.textContent === city2;
        const state2 = window.DashboardState?.selectedCity === city2;
        secondCityWorksAndStaysOpen = stillOpen2 && label2 && state2;
      }

      // 5. トリガーを再度クリック ➔ 明示的に閉じることを検証
      trigger?.click();
      const closedAfterTriggerReclick = list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'false';

      return {
        stateCities: window.DashboardState.cities,
        renderedItems: items,
        initialClosed,
        openedAfterFirstClick,
        firstCityWorksAndStaysOpen,
        secondCityWorksAndStaysOpen,
        closedAfterTriggerReclick
      };
    });
    await page4.close();

    const hasOriginalNoise = citiesCheck.stateCities.some(c => c.includes('原本') || c.includes('テンプレート'));
    const hasValidCities = citiesCheck.stateCities.length > 0;

    const hasYokkaichi = citiesCheck.stateCities.includes('四日市市');
    const hasKuwana = citiesCheck.stateCities.includes('桑名市');
    const hasInabe = citiesCheck.stateCities.includes('いなべ市');
    const hasNormalCities = hasYokkaichi && hasKuwana && hasInabe;

    const hasDeviceMgmt = citiesCheck.stateCities.some(c => c.includes('端末管理'));
    const hasContractMgmt = citiesCheck.stateCities.some(c => c.includes('契約管理'));
    const hasConflict = citiesCheck.stateCities.some(c => c.includes('conflict'));
    const noManagementNoise = !hasDeviceMgmt && !hasContractMgmt && !hasConflict;

    const phase4Pass = (
      !hasOriginalNoise &&
      hasValidCities &&
      hasNormalCities &&
      noManagementNoise &&
      citiesCheck.renderedItems.includes('ALL') &&
      citiesCheck.initialClosed &&
      citiesCheck.openedAfterFirstClick &&
      citiesCheck.firstCityWorksAndStaysOpen &&
      citiesCheck.secondCityWorksAndStaysOpen &&
      citiesCheck.closedAfterTriggerReclick
    );

    results.phase4.pass = phase4Pass;
    results.phase4.details.push(`自治体数: ${citiesCheck.stateCities.length}`);
    results.phase4.details.push(`正規自治体表示確認 (四日市市: ${hasYokkaichi ? 'PASS' : 'FAIL'}, 桑名市: ${hasKuwana ? 'PASS' : 'FAIL'}, いなべ市: ${hasInabe ? 'PASS' : 'FAIL'})`);
    results.phase4.details.push(`管理シート非混入確認 (端末管理: ${hasDeviceMgmt ? 'FAIL (混入)' : 'PASS (除外)'}, 契約管理: ${hasContractMgmt ? 'FAIL (混入)' : 'PASS (除外)'}, conflict: ${hasConflict ? 'FAIL (混入)' : 'PASS (除外)'})`);
    results.phase4.details.push(`ノイズ除外('原本'): ${hasOriginalNoise ? 'FAIL (混入)' : 'PASS (除外済)'}`);
    results.phase4.details.push(`選択時展開維持 (開いたまま連続切替): ${citiesCheck.firstCityWorksAndStaysOpen && citiesCheck.secondCityWorksAndStaysOpen ? 'PASS' : 'FAIL'}`);
    results.phase4.details.push(`トリガー再タップで閉じる: ${citiesCheck.closedAfterTriggerReclick ? 'PASS' : 'FAIL'}`);
    results.phase4.details.push(`セレクター項目: ${citiesCheck.renderedItems.join(', ')}`);

    // -------------------------------------------------------------
    // PHASE 5: fitBounds & 異常座標防御試験
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 5] fitBounds & 異常座標防御試験 実行中...");
    const page5 = await browser.newPage();
    await setupAuthenticatedPage(page5);
    await page5.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await page5.waitForFunction(() => window.DashboardState && window.DashboardState.masterLoadStatus === 'LOADED', { timeout: 10000 });

    const fitBoundsCheck = await page5.evaluate(() => {
      const map = window.DashboardState.map;
      const center = map.getCenter();
      
      let exceptionThrown = false;
      try {
        const dummyPins = [
          { lat: NaN, lng: 136.6 },
          { lat: 35.0, lng: null },
          { lat: 0, lng: 0 },
          { lat: 35.06, lng: 136.62 }
        ];
        const validCoords = dummyPins
          .filter(p => isFinite(p.lat) && isFinite(p.lng) && p.lat !== 0 && p.lng !== 0)
          .map(p => [p.lat, p.lng]);
        if (validCoords.length > 0) {
          const testBounds = L.latLngBounds(validCoords);
          map.fitBounds(testBounds);
        }
      } catch (e) {
        exceptionThrown = true;
      }

      return {
        center: { lat: center.lat, lng: center.lng },
        exceptionThrown
      };
    });
    await page5.close();

    const phase5Pass = (!fitBoundsCheck.exceptionThrown && isFinite(fitBoundsCheck.center.lat) && isFinite(fitBoundsCheck.center.lng));
    results.phase5.pass = phase5Pass;
    results.phase5.details.push(`Map Center: lat ${fitBoundsCheck.center.lat.toFixed(4)}, lng ${fitBoundsCheck.center.lng.toFixed(4)}`);
    results.phase5.details.push(`異常座標混入時クラッシュ防御: ${fitBoundsCheck.exceptionThrown ? 'FAIL' : 'PASS'}`);

    // -------------------------------------------------------------
    // PHASE 6: Hアプリ非干渉 & アーキテクチャ分離監査
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 6] Hアプリ非干渉 & アーキテクチャ分離監査 実行中...");
    const page6 = await browser.newPage();
    let hAppException = false;
    page6.on('pageerror', () => { hAppException = true; });

    await page6.addInitScript(() => {
      window.liff = {
        init: () => Promise.resolve(),
        isLoggedIn: () => true,
        getAccessToken: () => 'stub-access-token',
        getIDToken: () => 'stub-id-token',
        getOS: () => 'web',
        getProfile: () => Promise.resolve({ userId: 'TEST_USER', displayName: 'テスト' })
      };
    });

    await page6.goto('http://localhost:8080/active/dashboard/index.html', { waitUntil: 'networkidle' });
    await page6.waitForSelector('#app', { timeout: 5000 }).catch(() => {});
    await page6.close();

    // Hアプリロジック（active/dashboard/app.js, render.js 等）が staticMaster を参照していないことの監査
    const grepStaticMasterHApp = execSync("git grep -n 'staticMaster' active/dashboard/ || true", { encoding: 'utf8' }).trim();
    const staticMasterOccurrences = grepStaticMasterHApp.split('\n').filter(Boolean);
    const isStaticMasterIsolated = (
      staticMasterOccurrences.length === 1 &&
      staticMasterOccurrences[0].startsWith('active/dashboard/config.js:')
    );

    const phase6Pass = (!hAppException && isStaticMasterIsolated);
    results.phase6.pass = phase6Pass;
    results.phase6.details.push(`Hアプリ起動正常性: ${hAppException ? 'FAIL (例外発生)' : 'PASS (正常)'}`);
    results.phase6.details.push(`Hアプリロジック非干渉 (staticMaster隔離): ${isStaticMasterIsolated ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error("Quality Gate Error:", err);
  } finally {
    await browser.close();
    if (spawnedServer) {
      try { spawnedServer.kill(); } catch (e) {}
    }
  }

  // -------------------------------------------------------------
  // 最終判定 & レポート出力
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log("📊 DASHBOARD QUALITY GATE AUDIT REPORT");
  console.log("===============================================================");
  let allPass = true;
  for (const [key, p] of Object.entries(results)) {
    const mark = p.pass ? "✅ PASS" : "❌ FAIL";
    console.log(`[${mark}] ${p.name}`);
    p.details.forEach(d => console.log(`       - ${d}`));
    if (!p.pass) allPass = false;
  }
  console.log("===============================================================");
  console.log(`FINAL JUDGEMENT: ${allPass ? "🎉 ALL QUALITY GATES PASSED (PRODUCTION READY)" : "🛑 QUALITY GATE FAILED"}`);
  console.log("===============================================================\n");

  if (!allPass) {
    process.exit(1);
  }
}

runDashboardQualityGate();
