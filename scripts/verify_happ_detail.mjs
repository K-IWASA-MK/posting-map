import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8196;
const rootDir = process.cwd();

function startServer() {
  const server = http.createServer((req, res) => {
    let relativePath = req.url.split('?')[0];
    if (relativePath.startsWith('/app/')) {
      relativePath = relativePath.replace('/app/', '/active/dashboard/');
    } else if (relativePath === '/app' || relativePath === '/index.html' || relativePath === '/') {
      relativePath = '/index.html';
    } else if (relativePath.startsWith('/business/')) {
      relativePath = relativePath.replace('/business/', '/active/business/');
    } else if (relativePath.startsWith('/data/')) {
      relativePath = relativePath;
    }
    let filePath = path.join(rootDir, relativePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end(`Not found: ${req.url}`);
      } else {
        let ct = 'text/html; charset=utf-8';
        if (filePath.endsWith('.js')) ct = 'application/javascript; charset=utf-8';
        if (filePath.endsWith('.css')) ct = 'text/css; charset=utf-8';
        if (filePath.endsWith('.json')) ct = 'application/json; charset=utf-8';
        if (filePath.endsWith('.png')) ct = 'image/png';
        if (filePath.endsWith('.csv')) ct = 'text/plain; charset=utf-8';
        res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
        res.end(data);
      }
    });
  });
  return new Promise(r => server.listen(PORT, () => r(server)));
}

async function verifyHApp() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0.0'
  });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[CONSOLE ${msg.type().toUpperCase()}]`, msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

  await page.route('**/sdk.js', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.liff = {
          init: () => Promise.resolve(),
          isLoggedIn: () => true,
          getAccessToken: () => 'test-token',
          getIDToken: () => 'test-id',
          getOS: () => 'ios',
          getProfile: () => Promise.resolve({ userId: 'U_TEST', displayName: '配布員A' })
        };
      `
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('user_info', JSON.stringify({
      id: 'STAFF_MIE',
      last: '三重',
      first: '配布員',
      picture: ''
    }));
  });

  console.log('Navigating to H-App on local test server...');
  await page.goto(`http://localhost:${PORT}/app/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  console.log('Waiting for Google Maps SDK and data population...');
  try {
    await page.waitForFunction(() => typeof window.google !== 'undefined' && typeof window.google.maps !== 'undefined', { timeout: 15000 });
    console.log('✅ Google Maps SDK detected!');
    await page.waitForTimeout(2000); // マーカー描画待機
  } catch (e) {
    console.warn('Timeout waiting for Google Maps SDK:', e.message);
  }

  const checkData = await page.evaluate(async () => {
    let pinsCount = 0;
    let citiesList = [];
    if (window.AddressMasterService) {
      try {
        const pins = await window.AddressMasterService.getInstance().getAll();
        pinsCount = pins.length;
        const cities = await window.AddressMasterService.getInstance().getCities();
        citiesList = cities.map(c => ({ name: c.name, count: c.count }));
      } catch (e) {
        console.error('AddressMasterService error:', e);
      }
    }
    
    const cfg = window.PMS_CLIENT_CONFIG || {};

    const headerCount = document.getElementById('header-count')?.textContent?.trim();
    const headerPct = document.getElementById('header-pct')?.textContent?.trim();
    const hasGoogleMaps = typeof window.google !== 'undefined' && typeof window.google.maps !== 'undefined';
    const mapElement = document.getElementById('main-map');
    const mapChildren = mapElement ? mapElement.childElementCount : 0;

    return {
      pinsCount,
      citiesList,
      liffId: cfg.line?.liffId,
      gasUrl: cfg.api?.gasWebAppUrl,
      headerCount,
      headerPct,
      hasGoogleMaps,
      mapChildren
    };
  });

  console.log('\n=== H-APP RUNTIME VERIFICATION RESULTS ===');
  console.log('Configuration LIFF ID:     ', checkData.liffId);
  console.log('Configuration GAS URL:     ', checkData.gasUrl);
  console.log('Loaded Master Pins Count:  ', checkData.pinsCount);
  console.log('Header Count Element Text: ', checkData.headerCount);
  console.log('Header Percent Text:       ', checkData.headerPct);
  console.log('Google Maps SDK Loaded:    ', checkData.hasGoogleMaps);
  console.log('Map Children Count:        ', checkData.mapChildren);
  console.log('Recognized Cities List:    ', checkData.citiesList);

  const screenshotPath = '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/86cabfb8-f2bd-4741-b0ff-7d9fbf18dddf/scratch/happ_mie03_restored.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved verification screenshot to: ${screenshotPath}`);

  console.log('Switching to page-areas (Map / Area view)...');
  await page.evaluate(() => {
    if (typeof switchPage === 'function') switchPage('page-areas');
  });
  await page.waitForTimeout(2000);

  const areaScreenshotPath = '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/86cabfb8-f2bd-4741-b0ff-7d9fbf18dddf/scratch/happ_mie03_map_view.png';
  await page.screenshot({ path: areaScreenshotPath, fullPage: true });
  console.log(`Saved Map/Area screenshot to: ${areaScreenshotPath}`);

  await browser.close();
  server.close();

  if (checkData.pinsCount <= 0) {
    throw new Error(`Pins count must be positive, got ${checkData.pinsCount}`);
  }
  if (checkData.headerCount === '(  0/0)' || checkData.headerCount === '( 0/ 0)') {
    throw new Error(`Header count is still 0/0! Got: ${checkData.headerCount}`);
  }
  if (!checkData.hasGoogleMaps) {
    throw new Error(`Google Maps SDK failed to load!`);
  }
  console.log('\n✅ All H-App Runtime Assertions Passed: Map & Header fully restored!');
}

verifyHApp().catch(err => {
  console.error('\n❌ H-App Verification Failed:', err.message);
  process.exit(1);
});
