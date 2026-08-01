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
  }).listen(8082);

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
      getProfile: async () => ({ userId: 'U1234', displayName: 'TestUser', pictureUrl: 'https://example.com/pic.jpg' }),
      ready: Promise.resolve()
    };
    localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: 'S005' }));
  });

  await page.route('https://script.google.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, cities: [], areas: [], stats: {done:0,total:1}, id: "S005" }) });
  });

  await page.goto('http://localhost:8082/index.html');
  
  // Wait for loadData to complete and #app to be visible
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.classList.contains('hidden') && !app.classList.contains('opacity-0');
  }, { timeout: 10000 });
  
  console.log("App is visible.");

  // Inject diagnostic CSS
  await page.addStyleTag({ content: `
    * { outline: 1px solid red !important; }
    html, body, #app { background: white !important; }
  `});

  // Switch to settings
  await page.evaluate(() => {
    window.switchPage('settings');
  });
  
  // Wait for switchPage transition (300ms + RAF)
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const settings = document.getElementById("page-settings");
    const app = document.getElementById("app");
    const loading = document.getElementById("loading");
    const gateway = document.getElementById("screen-gateway");
    return {
      settingsDisplay: window.getComputedStyle(settings).display,
      settingsOpacity: window.getComputedStyle(settings).opacity,
      settingsHeight: settings.offsetHeight,
      appDisplay: window.getComputedStyle(app).display,
      appOpacity: window.getComputedStyle(app).opacity,
      loadingDisplay: window.getComputedStyle(loading).display,
      loadingOpacity: window.getComputedStyle(loading).opacity,
      loadingZIndex: window.getComputedStyle(loading).zIndex,
      gatewayDisplay: window.getComputedStyle(gateway).display,
      gatewayOpacity: window.getComputedStyle(gateway).opacity,
      gatewayZIndex: window.getComputedStyle(gateway).zIndex,
    };
  });

  console.log("METRICS:", JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: 'diagnostic_screenshot2.png' });
  console.log("Screenshot saved to diagnostic_screenshot2.png");

  await browser.close();
  server.close();
  process.exit(0);
})();
