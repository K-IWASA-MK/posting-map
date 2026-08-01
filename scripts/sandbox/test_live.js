const { webkit, devices } = require('playwright');

(async () => {
  const browser = await webkit.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.addInitScript(() => {
    // Mock user_info so it doesn't force a login redirect
    localStorage.setItem('user_info', JSON.stringify({ last: 'Test', first: '', id: 'S005' }));
  });

  await page.goto('https://k-iwasa-mk.github.io/posting-map-system-dev/active/mobile/index.html');
  
  // Wait for #app to become visible
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.classList.contains('hidden');
  }, { timeout: 10000 });

  await page.evaluate(() => { window.switchPage('settings'); });

  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const vc = document.getElementById("view-container");
    const content = document.getElementById("content");
    const settings = document.getElementById("page-settings");
    const loading = document.getElementById("loading");
    const gw = document.getElementById("screen-gateway");
    return {
      vcHeight: vc ? vc.offsetHeight : -1,
      contentHeight: content ? content.offsetHeight : -1,
      settingsHeight: settings ? settings.offsetHeight : -1,
      loadingDisplay: window.getComputedStyle(loading).display,
      gwDisplay: window.getComputedStyle(gw).display
    };
  });
  
  console.log("LIVE WEBKIT METRICS:", metrics);

  await page.screenshot({ path: '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/0011dc8c-0d04-4974-b697-be1efc50f396/screenshot_live.png' });

  await browser.close();
  process.exit(0);
})();
