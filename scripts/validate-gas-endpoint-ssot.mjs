import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const deploymentPath = path.join(rootDir, 'deployment.json');

if (!fs.existsSync(deploymentPath)) {
  console.error('❌ Error: deployment.json missing!');
  process.exit(1);
}

const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const ssotUrl = deploymentData?.resources?.webAppUrl;

if (!ssotUrl) {
  console.error('❌ Error: webAppUrl not found in deployment.json!');
  process.exit(1);
}

console.log(`[SSOT Validator] Target SSOT WebApp URL: ${ssotUrl}`);

let hasMismatch = false;

// 1. Check app/index.html fallback
const appIndexPath = path.join(rootDir, 'app', 'index.html');
if (fs.existsSync(appIndexPath)) {
  const content = fs.readFileSync(appIndexPath, 'utf8');
  if (!content.includes(ssotUrl)) {
    console.error(`❌ Mismatch in app/index.html: Fallback URL does not match SSOT!`);
    hasMismatch = true;
  } else {
    console.log(`✅ PASS: app/index.html matches SSOT URL.`);
  }
}

// 2. Check clients/*/config.js
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
      } else {
        console.log(`✅ PASS: clients/${client}/config.js matches SSOT URL.`);
      }
    }
  }
}

// 3. Check active/dashboard/clients/*/config.js
const activeClientsDir = path.join(rootDir, 'active', 'dashboard', 'clients');
if (fs.existsSync(activeClientsDir)) {
  const clients = fs.readdirSync(activeClientsDir);
  for (const client of clients) {
    const configPath = path.join(activeClientsDir, client, 'config.js');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      if (!content.includes(ssotUrl)) {
        console.error(`❌ Mismatch in active/dashboard/clients/${client}/config.js: gasWebAppUrl does not match SSOT!`);
        hasMismatch = true;
      } else {
        console.log(`✅ PASS: active/dashboard/clients/${client}/config.js matches SSOT URL.`);
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
