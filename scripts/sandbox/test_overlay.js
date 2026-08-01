const { chromium, devices } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

(async () => {
  const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'active/mobile', req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) filePath = path.join(__dirname, req.url.split('?')[0]);
    fs.readFile(filePath, (err, content) => {
      if (err) { res.writeHead(404); res.end('Not Found'); }
      else { res.writeHead(200, { 'Content-Type': mimeTypes[String(path.extname(filePath)).toLowerCase()] || 'application/octet-stream' }); res.end(content, 'utf-8'); }
    });
  }).listen(8081);

  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.liff = {
      init: async () => {},
      isLoggedIn: () => true,
      login: () => {},
      getProfile: async () => ({ userId: 'U1234', displayName: 'Test', pictureUrl: '' }),
      ready: Promise.resolve()
    };
    localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: 'S005' }));
  });

  await page.route('https://script.google.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, cities: [], areas: [], stats: {done:0,total:1}, id: "S005" }) });
  });

  await page.goto('http://localhost:8081/index.html');
  await page.waitForTimeout(2000); // Wait for loadData to run and app to show

  console.log("Forcing #app visibility if not visible...");
  // DO NOT force app visibility, let's see what happens naturally. We just trigger the switchPage.
  await page.evaluate(() => {
    window.switchPage('settings', true);
  });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const el = document.getElementById("page-settings");
    const app = document.getElementById("app");
    const loading = document.getElementById("loading");
    return {
      settingsDisplay: el ? window.getComputedStyle(el).display : null,
      settingsOpacity: el ? window.getComputedStyle(el).opacity : null,
      settingsOffsetHeight: el ? el.offsetHeight : null,
      appDisplay: app ? window.getComputedStyle(app).display : null,
      appOpacity: app ? window.getComputedStyle(app).opacity : null,
      loadingDisplay: loading ? window.getComputedStyle(loading).display : null,
      loadingOpacity: loading ? window.getComputedStyle(loading).opacity : null,
    };
  });

  console.log("METRICS:", JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: 'diagnostic_screenshot.png' });
  console.log("Screenshot saved to diagnostic_screenshot.png");

  await browser.close();
  server.close();
  process.exit(0);
})();
