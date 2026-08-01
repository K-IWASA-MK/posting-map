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
  }).listen(8087);

  const browser = await webkit.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();

  await page.route('https://static.line-scdn.net/liff/edge/2/sdk.js', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'console.log("Mock LIFF");' });
  });

  await page.addInitScript(() => {
    window.liff = {
      init: async () => {}, isLoggedIn: () => true, login: () => {}, isInClient: () => true, ready: Promise.resolve(),
      getProfile: async () => ({ userId: 'U1234', displayName: 'TestUser', pictureUrl: 'https://example.com/pic.jpg' })
    };
    localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: 'S005' }));
  });

  await page.route('https://script.google.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, areas: [{ id: "A1", name: "Area1" }], cities: [], stats: {done:0,total:1}, id: "S005", config: { targetAreas: [] } }) });
  });

  await page.goto('http://localhost:8087/index.html');
  
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.classList.contains('hidden') && !app.classList.contains('opacity-0');
  }, { timeout: 10000 });

  await page.evaluate(() => { window.switchPage('settings'); });

  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const vc = document.getElementById("view-container");
    const content = document.getElementById("content");
    const settings = document.getElementById("page-settings");
    return {
      vcHeight: vc ? vc.offsetHeight : -1,
      contentHeight: content ? content.offsetHeight : -1,
      settingsHeight: settings ? settings.offsetHeight : -1,
    };
  });
  
  console.log("WEBKIT METRICS:", metrics);

  await page.screenshot({ path: '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/0011dc8c-0d04-4974-b697-be1efc50f396/screenshot_webkit.png' });

  await browser.close();
  server.close();
  process.exit(0);
})();
