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
  }).listen(8086);

  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();

  // Intercept real SDK to not overwrite mock
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

  await page.goto('http://localhost:8086/index.html');
  
  // Wait for #app to become visible
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.classList.contains('hidden') && !app.classList.contains('opacity-0');
  }, { timeout: 10000 });

  // Switch to settings
  await page.evaluate(() => {
    window.switchPage('settings');
  });

  await page.waitForTimeout(1000); // Wait for animations to finish

  await page.screenshot({ path: '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/0011dc8c-0d04-4974-b697-be1efc50f396/screenshot_final.png' });
  console.log("Screenshot saved.");

  await browser.close();
  server.close();
  process.exit(0);
})();
