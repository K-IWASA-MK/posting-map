const { webkit, devices } = require('playwright');
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
  }).listen(8089);

  const browser = await webkit.launch({ headless: true });
  const iPhone = devices['iPhone 13'];

  const testCases = [
    { name: "Number ID", id: 12345, expectCrash: false },
    { name: "String ID", id: "S005", expectCrash: false },
    { name: "No ID (empty string)", id: "", expectCrash: false },
    { name: "null ID", id: null, expectCrash: false },
    { name: "undefined ID", id: undefined, expectCrash: false }
  ];

  for (const tc of testCases) {
    const context = await browser.newContext({ ...iPhone, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let crashed = false;
    page.on('pageerror', err => {
      console.log(`[${tc.name}] ERROR: ${err.message}`);
      crashed = true;
    });

    await page.route('https://static.line-scdn.net/liff/edge/2/sdk.js', route => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'console.log("Mock LIFF");' });
    });

    await page.addInitScript((testId) => {
      window.liff = {
        init: async () => {}, isLoggedIn: () => true, login: () => {}, isInClient: () => true, ready: Promise.resolve(),
        getProfile: async () => ({ userId: 'U1234', displayName: 'TestUser', pictureUrl: 'https://example.com/pic.jpg' })
      };
      localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: testId }));
    }, tc.id);

    await page.route('https://script.google.com/**', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, areas: [], cities: [], stats: {done:0,total:1}, id: tc.id, config: { targetAreas: [] } }) });
    });

    await page.goto('http://localhost:8089/index.html');
    await page.waitForFunction(() => { const app = document.getElementById('app'); return app && !app.classList.contains('hidden'); }, { timeout: 5000 }).catch(()=>null);
    await page.evaluate(() => { window.switchPage('settings'); }).catch(()=>null);
    await page.waitForTimeout(500);

    const childCount = await page.evaluate(() => {
      const container = document.getElementById("settings-content");
      return container ? container.childElementCount : -1;
    });

    console.log(`[${tc.name}] childElementCount: ${childCount}, crashed: ${crashed}`);
    await context.close();
  }

  await browser.close();
  server.close();
  process.exit(0);
})();
