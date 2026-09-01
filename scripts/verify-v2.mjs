import { chromium } from 'playwright';
import fs from 'fs';

async function runVerification() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()} (${msg.location().url})`);
    console.log(`[PAGE CONSOLE] [${msg.type()}] ${msg.text()} (${msg.location().url})`);
  });
  page.on('pageerror', err => {
    logs.push(`[PAGE ERROR] ${err.message}`);
    console.error(`[PAGE ERROR] ${err.message}`);
  });
  page.on('response', response => {
    if (response.status() === 404) {
      logs.push(`[NETWORK 404] ${response.url()}`);
      console.log(`[NETWORK 404] ${response.url()}`);
    }
  });

  try {
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3000/active/dashboard/?client=MIE-03', { waitUntil: 'networkidle' });
    
    // Wait for the app to initialize
    await page.waitForTimeout(5000);

    const screenshotPath = '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/1c439a69-baf3-4df1-837e-90453333a7f1/scratch/verification-result.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Check for any major errors
    const errorLogs = logs.filter(l => l.includes('ERROR') || l.includes('error'));
    if (errorLogs.length > 0) {
      console.log('⚠️ Errors detected in console logs:');
      errorLogs.forEach(l => console.log(l));
    } else {
      console.log('✅ No errors detected in console logs.');
    }

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await browser.close();
  }
}

runVerification();
