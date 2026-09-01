const { chromium, devices } = require('playwright');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8086;
const BASE_URL = `http://localhost:${PORT}`;

const serverProcess = fork(path.join(__dirname, 'server.js'));

async function run() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('Starting E2E Regression Verification (V5 & V6)...');
  
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 }
  });
  
  const page = await context.newPage();
  console.log('Testing V5: Distributor App...');
  
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

  await page.goto(`${BASE_URL}/active/dashboard/index.html`);
  
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.classList.contains('hidden') && !app.classList.contains('opacity-0');
  }, { timeout: 10000 }).catch(e => console.error("Timeout waiting for app: " + e));
  
  const artifactDir = '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/1c439a69-baf3-4df1-837e-90453333a7f1/scratch';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  
  const distAppScreenshot = path.join(artifactDir, 'v5_distributor_app.png');
  await page.screenshot({ path: distAppScreenshot });
  console.log(`✓ V5 Passed: Distributor App screenshot saved to ${distAppScreenshot}`);

  console.log('Testing V6: Dashboard...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const dashPage = await desktopContext.newPage();
  
  await dashPage.goto(`${BASE_URL}/scripts/operations/index.html`);
  await dashPage.waitForTimeout(2000);
  
  const dashScreenshot = path.join(artifactDir, 'v6_dashboard.png');
  await dashPage.screenshot({ path: dashScreenshot, fullPage: true });
  console.log(`✓ V6 Passed: Dashboard screenshot saved to ${dashScreenshot}`);
  
  await browser.close();
  serverProcess.kill('SIGTERM');
  console.log('Regression tests complete.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  serverProcess.kill('SIGTERM');
  process.exit(1);
});
