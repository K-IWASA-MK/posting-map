import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const deploymentPath = path.join(rootDir, 'deployment.json');

if (!fs.existsSync(deploymentPath)) {
  console.error('❌ Error: deployment.json missing!');
  process.exit(1);
}

let deploymentData;
try {
  deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
} catch (e) {
  console.error(`❌ Error: Failed to parse deployment.json: ${e.message}`);
  process.exit(1);
}

const ssotUrl = deploymentData?.resources?.webAppUrl;
const ssotLiffUrl = deploymentData?.resources?.productionLiffUrl;

if (!ssotUrl) {
  console.error('❌ Error: webAppUrl not found in deployment.json!');
  process.exit(1);
}

if (!ssotLiffUrl) {
  console.error('❌ Error: productionLiffUrl not found in deployment.json!');
  process.exit(1);
}

let ssotLiffId;
try {
  const parsedUrl = new URL(ssotLiffUrl);
  ssotLiffId = parsedUrl.pathname.split('/').filter(Boolean)[0];
} catch (e) {
  console.error(`❌ Error: Invalid productionLiffUrl: ${ssotLiffUrl}`);
  process.exit(1);
}

console.log(`[SSOT Validator] Target SSOT WebApp URL: ${ssotUrl}`);
console.log(`[SSOT Validator] Target SSOT LIFF ID:    ${ssotLiffId} (from ${ssotLiffUrl})`);

let hasMismatch = false;

const activeConfigPath = path.join(rootDir, 'active', 'dashboard', 'config.js');
if (!fs.existsSync(activeConfigPath)) {
  console.error(`❌ Missing active/dashboard/config.js! Run 'npm run sync:config' first.`);
  hasMismatch = true;
} else {
  const configContent = fs.readFileSync(activeConfigPath, 'utf8');

  if (!configContent.includes(ssotUrl)) {
    console.error(`❌ Mismatch in active/dashboard/config.js: gasWebAppUrl does not match SSOT URL!`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: active/dashboard/config.js matches SSOT WebApp URL.`);
  }

  if (!configContent.includes(ssotLiffId)) {
    console.error(`❌ Mismatch in active/dashboard/config.js: liffId does not match SSOT LIFF ID!`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: active/dashboard/config.js matches SSOT LIFF ID.`);
  }

  if (configContent.includes('spreadsheetId')) {
    console.error(`❌ Policy Violation: active/dashboard/config.js contains spreadsheetId (must remain district-agnostic).`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: active/dashboard/config.js is free of spreadsheetId.`);
  }
}

const appJsPath = path.join(rootDir, 'active', 'dashboard', 'app.js');
if (fs.existsSync(appJsPath)) {
  const appContent = fs.readFileSync(appJsPath, 'utf8');
  if (appContent.includes('https://script.google.com/macros/s/')) {
    console.error(`❌ Hardcoded GAS Endpoint in active/dashboard/app.js: Found script.google.com fallback!`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: active/dashboard/app.js has no hardcoded GAS fallback URL.`);
  }
}

const rootIndexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(rootIndexPath)) {
  const indexContent = fs.readFileSync(rootIndexPath, 'utf8');
  if (!indexContent.includes('./active/dashboard/config.js')) {
    console.error(`❌ Configuration error in index.html: Does not load ./active/dashboard/config.js!`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: index.html loads ./active/dashboard/config.js.`);
  }

  if (indexContent.includes('2010941735-GRLuqPic')) {
    console.error(`❌ Hardcoded LIFF ID in index.html: Found static 2010941735-GRLuqPic!`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: index.html has no hardcoded LIFF ID.`);
  }
}

const clientsDir = path.join(rootDir, 'clients');
if (fs.existsSync(clientsDir)) {
  const clients = fs.readdirSync(clientsDir);
  for (const client of clients) {
    const configPath = path.join(clientsDir, client, 'config.js');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      if (!content.includes(ssotUrl)) {
        console.error(`❌ Mismatch in clients/${client}/config.js: gasWebAppUrl does not match SSOT!`);
        hasMismatch = true;
      }
    }
  }
}

if (hasMismatch) {
  console.error('\n🔴 SSOT Validation FAILED: Discrepancies found.');
  process.exit(1);
} else {
  console.log('\n🟢 SSOT Validation PASSED: All active endpoints are synchronized with deployment.json SSOT.');
  process.exit(0);
}
