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
  }).listen(8090);

  const browser = await webkit.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({ ...iPhone, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  page.on('console', msg => { if (!msg.text().includes('Mock LIFF') && !msg.text().includes('[DEBUG]')) console.log('BROWSER CONSOLE:', msg.text()) });
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.route('https://static.line-scdn.net/liff/edge/2/sdk.js', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'console.log("Mock LIFF");' });
  });

  await page.addInitScript(() => {
    window.liff = {
      init: async () => {}, isLoggedIn: () => true, login: () => {}, isInClient: () => true, ready: Promise.resolve(),
      getProfile: async () => ({ userId: 'U1234', displayName: 'TestUser', pictureUrl: 'https://example.com/pic.jpg' })
    };
    localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: 12345 }));
  });

  await page.route('https://script.google.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, areas: [{ id: "A1", name: "Area1" }], cities: [], stats: {done:0,total:1}, id: 12345, config: { targetAreas: [] } }) });
  });

  await page.goto('http://localhost:8090/index.html');
  await page.waitForFunction(() => { const app = document.getElementById('app'); return app && !app.classList.contains('hidden'); }, { timeout: 5000 });
  await page.evaluate(() => { window.switchPage('settings'); });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const pageEl = document.querySelector('#page-settings');
    const contentEl = document.querySelector('#settings-content');
    const pageStyle = window.getComputedStyle(pageEl);
    
    const pageMetrics = {
      display: pageStyle.display,
      visibility: pageStyle.visibility,
      opacity: pageStyle.opacity,
      position: pageStyle.position,
      overflow: pageStyle.overflow,
      height: pageEl.offsetHeight,
      width: pageEl.offsetWidth,
      rect: pageEl.getBoundingClientRect(),
      childCount: pageEl.childElementCount,
      htmlLength: pageEl.innerHTML.length
    };
    
    let contentMetrics = null;
    if (contentEl) {
      contentMetrics = {
        childCount: contentEl.childElementCount,
        htmlLength: contentEl.innerHTML.length,
        rect: contentEl.getBoundingClientRect()
      };
    }
    
    const allPages = [];
    document.querySelectorAll('[id^="page-"]').forEach(el => {
      allPages.push({
        id: el.id,
        display: window.getComputedStyle(el).display,
        className: el.className
      });
    });

    return {
      page: pageMetrics,
      content: contentMetrics,
      allPages: allPages
    };
  });

  console.log("=== #page-settings Metrics ===");
  console.table(metrics.page);
  console.log("=== #settings-content Metrics ===");
  console.table(metrics.content);
  console.log("=== All Pages State ===");
  console.table(metrics.allPages);

  await browser.close();
  server.close();
  process.exit(0);
})();
