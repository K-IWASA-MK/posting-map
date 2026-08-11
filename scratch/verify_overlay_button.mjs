import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8095;
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

async function runVerification() {
  const server = await startLocalServer();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    console.log('PAGE LOG:', text);
  });
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.error('REQUEST FAILED:', req.url(), req.failure()?.errorText));

  // Request interception to mock GAS Web App calls
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('script.google.com/macros/s/')) {
      const postData = request.postData();
      let action = '';
      if (url.includes('?')) {
        try {
          const urlObj = new URL(url);
          action = urlObj.searchParams.get('action');
        } catch (e) {}
      }
      if (!action) {
        try {
          if (postData) {
            const parsed = JSON.parse(postData);
            action = parsed.action;
          }
        } catch (e) {}
      }

      console.log(`[MOCK GAS API] Intercepted call: action=${action}`);

      let mockResponse = {};
      if (action === 'getSystemSummary') {
        mockResponse = { success: true, total: 858, done: 0 };
      } else if (action === 'getMapsApiKey') {
        mockResponse = { success: true, mapsApiKey: 'MOCK_KEY' };
      } else if (action === 'getRanking') {
        mockResponse = [];
      } else if (action === 'registerStaff') {
        mockResponse = { success: true, staffId: 'STAFF123' };
      } else {
        mockResponse = { success: true };
      }

      request.respond({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(mockResponse)
      });
    } else {
      request.continue();
    }
  });

  // Inject window.google and liff mocks
  await page.evaluateOnNewDocument(() => {
    const mockLiff = {
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
    Object.defineProperty(window, 'liff', {
      value: mockLiff,
      writable: false,
      configurable: false
    });
    localStorage.setItem('user_info', JSON.stringify({
      id: 'STAFF123',
      last: 'テスト',
      first: '配布員',
      picture: '',
      registrationDate: '2025/07/01'
    }));

    // Synchronously intercept initMainMap to hijack OverlayView before render.js runs it
    let originalInit = null;
    Object.defineProperty(window, 'initMainMap', {
      configurable: true,
      set: function(val) {
        originalInit = val;
      },
      get: function() {
        return () => {
          if (window.google && window.google.maps) {
            window.google.maps.OverlayView = function() {
              this.setMap = (m) => {
                if (m) {
                  setTimeout(() => {
                    if (this.onAdd) this.onAdd();
                    if (this.draw) this.draw();
                  }, 50);
                } else {
                  if (this.onRemove) this.onRemove();
                }
              };
              this.getPanes = () => ({
                overlayMouseTarget: document.body
              });
              this.getProjection = () => ({
                fromLatLngToDivPixel: () => ({ x: 100, y: 100 })
              });
            };
          }
          if (originalInit) {
            originalInit();
          }
        };
      }
    });
  });

  try {
    const url = `http://localhost:${PORT}/active/dashboard/index.html?client=MIE-03`;
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });

    // Wait for the Google Maps markers to be initialized
    console.log("Waiting for window.masterMarkers to load...");
    await page.waitForFunction(() => window.masterMarkers && window.masterMarkers.length > 0, { timeout: 15000 });

    // --- CASE 1: Tap A -> A becomes BLUE ---
    console.log("\n--- [CASE 1] Triggering click on Marker[0] ---");
    await page.evaluate(() => {
      google.maps.event.trigger(window.masterMarkers[0], 'click');
      google.maps.event.trigger(window.mainMapInstance, 'idle');
    });

    // Wait for overlay element to render in document
    console.log("Waiting for .input-operation-btn to render...");
    await page.waitForSelector('.input-operation-btn', { timeout: 5000 });

    // Click the input operation button
    console.log("Clicking .input-operation-btn...");
    await page.evaluate(() => {
      document.querySelector('.input-operation-btn').click();
    });

    // Wait for transition
    await new Promise(r => setTimeout(r, 500));

    // Verify detail-modal is shown
    const isModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('detail-modal');
      return modal && !modal.classList.contains('opacity-0') && !modal.classList.contains('pointer-events-none');
    });

    if (isModalVisible) {
      console.log("PASS: #detail-modal is successfully displayed.");
    } else {
      throw new Error("FAIL: #detail-modal is not displayed or remains hidden.");
    }

    // Check displayed town name in the address label (🏠)
    const displayedAddress = await page.evaluate(() => {
      const label = document.querySelector('#detail-modal-content div.inline-flex');
      return label ? label.textContent.trim() : '';
    });
    console.log(`Displayed Address in Modal: ${displayedAddress}`);
    if (displayedAddress.includes('相生町')) {
      console.log("PASS: The displayed address matches the town name of Marker[0] (相生町).");
    } else {
      throw new Error(`FAIL: Displayed address does not contain town name. Got: "${displayedAddress}"`);
    }

    // Take screenshot for visual evidence
    const screenshotPath = path.join(rootDir, 'docs/evidence/spatial-validation/overlay_binding_screenshot.png');
    console.log(`Taking screenshot: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath });
    console.log("Screenshot captured successfully.");

  } catch (err) {
    console.error(`Exception: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
    console.log("Overlay binding verification finished.");
  }
}

runVerification();
