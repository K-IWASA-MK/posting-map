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
  }).listen(8084);

  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.addInitScript(() => {
    window.liff = {
      init: async () => {},
      isLoggedIn: () => true,
      login: () => {},
      getProfile: async () => ({ userId: 'U1234', displayName: 'TestUser', pictureUrl: 'https://example.com/pic.jpg' }),
      isInClient: () => true,
      ready: Promise.resolve()
    };
    localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: 'S005' }));
  });

  await page.route('https://script.google.com/**', route => {
    route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ 
        success: true, 
        areas: [{ id: "A1", name: "Area1" }],
        cities: [], 
        stats: {done:0,total:1}, 
        id: "S005",
        config: { targetAreas: [] }
      }) 
    });
  });

  await page.goto('http://localhost:8084/index.html');
  
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.classList.contains('hidden');
  }, { timeout: 10000 });

  await page.evaluate(() => {
    window.switchPage('settings');
  });
  
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const settings = document.getElementById("page-settings");
    const app = document.getElementById("app");
    const content = document.getElementById("content");
    const vc = document.getElementById("view-container");
    const body = document.body;
    return {
      settingsHeight: settings.offsetHeight,
      contentHeight: content.offsetHeight,
      vcHeight: vc.offsetHeight,
      bodyHeight: body.offsetHeight,
      appHeight: app.offsetHeight,
      settingsDisplay: window.getComputedStyle(settings).display,
      contentOverflowY: window.getComputedStyle(content).overflowY
    };
  });
  
  console.log("METRICS:", JSON.stringify(metrics, null, 2));

  await browser.close();
  server.close();
  process.exit(0);
})();
