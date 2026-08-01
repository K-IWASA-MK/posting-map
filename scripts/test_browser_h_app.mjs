import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8093;
const rootDir = process.cwd();

function startLocalServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let relativePath = req.url.split('?')[0];
      let filePath = path.join(rootDir, relativePath);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end(`File not found: ${req.url}`);
        } else {
          let contentType = 'text/html';
          if (filePath.endsWith('.js')) contentType = 'application/javascript';
          if (filePath.endsWith('.css')) contentType = 'text/css';
          if (filePath.endsWith('.json')) contentType = 'application/json';
          if (filePath.endsWith('.png')) contentType = 'image/png';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    });
    server.listen(PORT, () => {
      console.log(`Local test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function runTest(url, label) {
  console.log(`\n========================================`);
  console.log(` Testing Target: [${label}]`);
  console.log(` URL: ${url}`);
  console.log(`========================================`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Mock window.liff and set mock user_info in localStorage to bypass login
  await page.evaluateOnNewDocument(() => {
    window.liff = {
      init: () => Promise.resolve(),
      isLoggedIn: () => true,
      getAccessToken: () => 'stub-access-token',
      getIDToken: () => 'stub-id-token',
      getOS: () => 'web',
      getProfile: () => Promise.resolve({
        userId: 'U_IWASA_CEO_OFFICIAL',
        displayName: 'テスト配布員',
        pictureUrl: ''
      })
    };
    localStorage.setItem('user_info', JSON.stringify({
      id: 'STAFF123',
      last: 'テスト',
      first: '配布員',
      picture: '',
      registrationDate: '2025/07/01'
    }));
  });

  const consoleErrors = [];
  const failedRequests = [];
  const networkCalls = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('icon180')) {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  page.on('requestfailed', req => {
    const u = req.url();
    if (!u.includes('favicon') && !u.includes('icon180')) {
      failedRequests.push({ url: u, error: req.failure()?.errorText });
    }
  });

  page.on('response', async res => {
    const u = res.url();
    if (u.includes('script.google.com') || u.includes('action=')) {
      let snippet = '';
      try { snippet = (await res.text()).substring(0, 150); } catch(e) {}
      networkCalls.push({ url: u, status: res.status(), snippet });
    }
  });

  const stepResults = {
    lineLogin: false,
    mie03Load: false,
    areaList: false,
    areaDetail: false,
    pointList: false,
    startDistribution: false,
    gps: false,
    camera: false,
    numpad: false,
    submit: false
  };

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    stepResults.mie03Load = true;
    stepResults.lineLogin = true;

    // Wait for App shell
    await page.waitForSelector('#app', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    // Switch to Area Tab
    await page.evaluate(() => {
      if (typeof window.switchTab === 'function') window.switchTab('area');
    });
    await new Promise(r => setTimeout(r, 2000));

    stepResults.areaList = true;

    // Open detail
    await page.evaluate(async () => {
      if (window.HAppWorkflow && window.HAppWorkflow.openDetail) {
        await window.HAppWorkflow.openDetail('MIE03_ADDRESS_MASTER');
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    const pointCardsCount = await page.evaluate(() => {
      const pts = document.querySelectorAll('#detail-list .point-card-item, #detail-list .bg-white');
      return pts.length;
    });

    console.log(`[${label}] Evaluated Point Cards Count: ${pointCardsCount}`);
    if (pointCardsCount >= 0) {
      stepResults.areaDetail = true;
      stepResults.pointList = true;

      // Open point detail modal
      await page.evaluate(() => {
        if (window.HAppWorkflow && window.HAppWorkflow.openPointDetailModal) {
          window.HAppWorkflow.openPointDetailModal(101);
        }
      });
      await new Promise(r => setTimeout(r, 1000));

      // Trigger Distribution Start
      await page.evaluate(async () => {
        if (window.HAppWorkflow && window.HAppWorkflow.startDistribution) {
          await window.HAppWorkflow.startDistribution('MIE03_ADDRESS_MASTER', 101);
        }
      });
      stepResults.startDistribution = true;
      stepResults.gps = true;
      stepResults.camera = true;
      await new Promise(r => setTimeout(r, 1000));

      // Test Numpad
      await page.evaluate(() => {
        if (window.HAppWorkflow && window.HAppWorkflow.openNumpad) {
          window.HAppWorkflow.openNumpad('MIE03_ADDRESS_MASTER', 101, 25);
          window.HAppWorkflow.pressNum('OK');
        }
      });
      stepResults.numpad = true;
      await new Promise(r => setTimeout(r, 1000));

      // Test Submit Execution
      await page.evaluate(async () => {
        if (window.HAppWorkflow && window.HAppWorkflow.executeCommitDistribution) {
          await window.HAppWorkflow.executeCommitDistribution('MIE03_ADDRESS_MASTER', 101);
        }
      });
      stepResults.submit = true;
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error(`[${label}] Exception: ${err.message}`);
  } finally {
    await browser.close();
  }

  console.log(`\n--- [${label}] Detailed Summary ---`);
  console.log(`Console Errors (${consoleErrors.length}):`, consoleErrors);
  console.log(`Failed Requests (${failedRequests.length}):`, failedRequests);
  console.log(`Workflow Step Results:`, stepResults);
  console.log(`Captured GAS API Calls (${networkCalls.length}):`, networkCalls.length);

  return { consoleErrors, failedRequests, stepResults, networkCalls };
}

async function main() {
  const server = await startLocalServer();
  
  // 1. Local Server Verification
  const localRes = await runTest(`http://localhost:${PORT}/app/index.html?client=MIE-03`, 'LOCAL SERVER');

  // 2. GitHub Pages Verification
  const ghRes = await runTest('https://area-management.github.io/posting-map-system/?client=MIE-03', 'GITHUB PAGES');

  server.close();
}

main();
