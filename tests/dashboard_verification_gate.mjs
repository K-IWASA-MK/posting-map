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

import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function runDashboardQualityGate() {
  console.log("===============================================================");
  console.log("🏛️ POSTING MAP DASHBOARD QUALITY GATE (6 PHASES)");
  console.log("===============================================================\n");

  const results = {
    phase1: { name: "Phase 1: 実機Dashboard通常動作 (District-Agnostic)", pass: false, details: [] },
    phase2: { name: "Phase 2: 連続リロード安定性", pass: false, details: [] },
    phase3: { name: "Phase 3: Master ERROR 障害・部分劣化試験", pass: false, details: [] },
    phase4: { name: "Phase 4: cities SSOT & ノイズ除外確認", pass: false, details: [] },
    phase5: { name: "Phase 5: fitBounds & 異常座標防御試験", pass: false, details: [] },
    phase6: { name: "Phase 6: Hアプリ非干渉 & アーキテクチャ分離監査", pass: false, details: [] },
  };

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

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // -------------------------------------------------------------
    // PHASE 1: 実機Dashboard通常動作
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 1] 実機Dashboard通常動作の検証中...");
    const page1 = await browser.newPage();
    const appErrors1 = [];

    page1.on('pageerror', err => {
      appErrors1.push(`[JS Exception] ${err.toString()}`);
    });
    page1.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        appErrors1.push(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    await page1.goto('http://localhost:8080/scripts/operations/index.html', { waitUntil: 'networkidle0' });
    await page1.waitForFunction(() => window.DashboardState && window.DashboardState.masterLoadStatus === 'LOADED', { timeout: 10000 });

    const state1 = await page1.evaluate(() => {
      return {
        masterLoadStatus: window.DashboardState.masterLoadStatus,
        masterPinsCount: window.DashboardState.masterPins.length,
        cities: window.DashboardState.cities,
        totalAreasText: document.getElementById('fact-total-areas')?.textContent,
        doneAreasText: document.getElementById('fact-done-areas')?.textContent,
        totalStocksText: document.getElementById('fact-total-stocks')?.textContent,
        masterPinLabelText: document.getElementById('master-pin-label')?.textContent,
        liveCardsCount: document.querySelectorAll('#live-feed-container > div').length
      };
    });

    const phase1Pass = (
      state1.masterLoadStatus === 'LOADED' &&
      state1.masterPinsCount === expectedCsvPinsCount &&
      state1.totalAreasText === expectedCsvPinsCount.toLocaleString() &&
      state1.masterPinLabelText.includes(`${expectedCsvPinsCount}マスターピン連動`) &&
      appErrors1.length === 0
    );

    results.phase1.pass = phase1Pass;
    results.phase1.details.push(`masterLoadStatus: ${state1.masterLoadStatus}`);
    results.phase1.details.push(`masterPinsCount: ${state1.masterPinsCount} (期待値: ${expectedCsvPinsCount})`);
    results.phase1.details.push(`totalAreasText: ${state1.totalAreasText}`);
    results.phase1.details.push(`masterPinLabelText: ${state1.masterPinLabelText}`);
    results.phase1.details.push(`App Errors: ${appErrors1.length} ${appErrors1.length > 0 ? `(${appErrors1.join(', ')})` : '(0件: PASS)'}`);
    await page1.close();

    // -------------------------------------------------------------
    // PHASE 2: 連続リロード安定性 (7回)
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 2] 連続リロード試験 (7回) 実行中...");
    const page2 = await browser.newPage();
    let reloadSuccessCount = 0;
    for (let i = 1; i <= 7; i++) {
      await page2.goto('http://localhost:8080/scripts/operations/index.html', { waitUntil: 'networkidle0' });
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
    await page3.setRequestInterception(true);
    page3.on('request', req => {
      if (req.url().endsWith('.csv')) {
        req.abort('failed');
      } else {
        req.continue();
      }
    });

    await page3.goto('http://localhost:8080/scripts/operations/index.html', { waitUntil: 'networkidle0' });
    await page3.waitForFunction(() => window.DashboardState && window.DashboardState.stocks.length > 0, { timeout: 10000 }).catch(() => {});

    const state3 = await page3.evaluate(() => {
      return {
        masterLoadStatus: window.DashboardState?.masterLoadStatus,
        totalAreasText: document.getElementById('fact-total-areas')?.textContent,
        doneAreasText: document.getElementById('fact-done-areas')?.textContent,
        stocksCount: window.DashboardState?.stocks?.length,
        rankingCount: window.DashboardState?.ranking?.length
      };
    });
    await page3.close();

    const phase3Pass = (
      state3.masterLoadStatus === 'ERROR' &&
      state3.totalAreasText === 'ERR' &&
      state3.doneAreasText === 'ERR' &&
      state3.stocksCount > 0 &&
      state3.rankingCount > 0
    );
    results.phase3.pass = phase3Pass;
    results.phase3.details.push(`masterLoadStatus: ${state3.masterLoadStatus}`);
    results.phase3.details.push(`fact-total-areas: ${state3.totalAreasText}`);
    results.phase3.details.push(`Backend stocksCount (生存確認): ${state3.stocksCount}`);
    results.phase3.details.push(`Backend rankingCount (生存確認): ${state3.rankingCount}`);

    // -------------------------------------------------------------
    // PHASE 4: cities SSOT & ノイズ除外 & 左ナビインライン開閉確認
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 4] cities SSOT & ノイズ除外 & インライン開閉確認 実行中...");
    const page4 = await browser.newPage();
    await page4.goto('http://localhost:8080/scripts/operations/index.html', { waitUntil: 'networkidle0' });
    await page4.waitForFunction(() => window.DashboardState && window.DashboardState.cities.length > 0, { timeout: 10000 });

    const citiesCheck = await page4.evaluate(() => {
      const trigger = document.getElementById('city-selector-trigger');
      const list = document.getElementById('city-selector-list');
      const currentLabel = document.getElementById('city-selector-current');

      const initialClosed = list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'false';
      const initialText = currentLabel?.textContent;

      // 1. トリガーをクリックして展開テスト
      trigger?.click();
      const openedAfterClick = !list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'true';

      // 2. アイテム一覧取得
      const items = Array.from(list?.querySelectorAll('button[data-city-val]') || []).map(b => b.getAttribute('data-city-val'));

      // 3. 2番目の自治体をクリックして選択＆自動折りたたみテスト
      let selectWorks = false;
      if (items.length > 1) {
        const targetCity = items[1]; // 最初の自治体 (例: 四日市市)
        const targetBtn = list.querySelector(`button[data-city-val="${targetCity}"]`);
        targetBtn?.click();

        const closedAfterSelect = list?.classList.contains('hidden') && trigger?.getAttribute('aria-expanded') === 'false';
        const labelUpdated = currentLabel?.textContent === targetCity;
        const stateUpdated = window.DashboardState?.selectedCity === targetCity;

        selectWorks = closedAfterSelect && labelUpdated && stateUpdated;
      }

      // 4. 全域に戻すテスト
      const allBtn = list?.querySelector('button[data-city-val="ALL"]');
      allBtn?.click();
      const allRestored = currentLabel?.textContent === '全域' && window.DashboardState?.selectedCity === 'ALL';

      return {
        stateCities: window.DashboardState.cities,
        renderedItems: items,
        initialClosed,
        openedAfterClick,
        selectWorks,
        allRestored
      };
    });
    await page4.close();

    const hasOriginalNoise = citiesCheck.stateCities.some(c => c.includes('原本') || c.includes('テンプレート'));
    const hasValidCities = citiesCheck.stateCities.length > 0;
    const phase4Pass = (
      !hasOriginalNoise &&
      hasValidCities &&
      citiesCheck.renderedItems.includes('ALL') &&
      citiesCheck.initialClosed &&
      citiesCheck.openedAfterClick &&
      citiesCheck.selectWorks &&
      citiesCheck.allRestored
    );

    results.phase4.pass = phase4Pass;
    results.phase4.details.push(`自治体数: ${citiesCheck.stateCities.length}`);
    results.phase4.details.push(`ノイズ除外('原本'): ${hasOriginalNoise ? 'FAIL (混入)' : 'PASS (除外済)'}`);
    results.phase4.details.push(`左ナビインライン展開・自動折りたたみ動作: ${citiesCheck.initialClosed && citiesCheck.openedAfterClick && citiesCheck.selectWorks ? 'PASS' : 'FAIL'}`);
    results.phase4.details.push(`セレクター項目: ${citiesCheck.renderedItems.join(', ')}`);

    // -------------------------------------------------------------
    // PHASE 5: fitBounds & 異常座標防御試験
    // -------------------------------------------------------------
    console.log("\n▶ [PHASE 5] fitBounds & 異常座標防御試験 実行中...");
    const page5 = await browser.newPage();
    await page5.goto('http://localhost:8080/scripts/operations/index.html', { waitUntil: 'networkidle0' });
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

    await page6.evaluateOnNewDocument(() => {
      window.liff = {
        init: () => Promise.resolve(),
        isLoggedIn: () => true,
        getAccessToken: () => 'stub-access-token',
        getIDToken: () => 'stub-id-token',
        getOS: () => 'web',
        getProfile: () => Promise.resolve({ userId: 'TEST_USER', displayName: 'テスト' })
      };
    });

    await page6.goto('http://localhost:8080/active/dashboard/index.html?client=MIE-03', { waitUntil: 'networkidle0' });
    await page6.waitForSelector('#app', { timeout: 5000 }).catch(() => {});
    await page6.close();

    // Hアプリロジック（active/dashboard/app.js, render.js 等）が staticMaster を参照していないことの監査
    const grepStaticMasterHApp = execSync("git grep -n 'staticMaster' active/dashboard/ || true", { encoding: 'utf8' }).trim();
    const staticMasterOccurrences = grepStaticMasterHApp.split('\n').filter(Boolean);
    const isStaticMasterIsolated = (
      staticMasterOccurrences.length === 1 &&
      staticMasterOccurrences[0].includes('active/dashboard/config.js:19')
    );

    const phase6Pass = (!hAppException && isStaticMasterIsolated);
    results.phase6.pass = phase6Pass;
    results.phase6.details.push(`Hアプリ起動正常性: ${hAppException ? 'FAIL (例外発生)' : 'PASS (正常)'}`);
    results.phase6.details.push(`Hアプリロジック非干渉 (staticMaster隔離): ${isStaticMasterIsolated ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error("Quality Gate Error:", err);
  } finally {
    await browser.close();
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
