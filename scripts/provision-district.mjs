import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('🚀 Starting district provisioning pipeline...');

  // 1. Read local CSV
  const csvPath = path.join(rootDir, 'data', 'address_master.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Master CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    console.error('❌ Master CSV is empty or has no data rows');
    process.exit(1);
  }

  const header = lines[0].split(',');
  const rowIdIdx = header.indexOf('rowId');
  const cityIdx = header.indexOf('city_name');
  const townIdx = header.indexOf('town_name');

  if (rowIdIdx === -1 || cityIdx === -1 || townIdx === -1) {
    console.error('❌ Master CSV header missing required columns (rowId, city_name, town_name)');
    process.exit(1);
  }

  const addresses = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length >= 3) {
      addresses.push({
        rowId: parseInt(cols[rowIdIdx], 10) || i,
        cityName: cols[cityIdx] || '',
        townName: cols[townIdx] || ''
      });
    }
  }

  console.log(`📊 Loaded ${addresses.length} address master records from CSV.`);

  // 2. Read deployment config for SSOT webAppUrl
  const deploymentPath = path.join(rootDir, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ deployment.json not found at: ${deploymentPath}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const webAppUrl = deployment?.resources?.webAppUrl;
  if (!webAppUrl) {
    console.error('❌ webAppUrl not found in deployment.json');
    process.exit(1);
  }

  console.log(`🌐 Target GAS WebApp URL: ${webAppUrl}`);

  // 3. Post to GAS WebApp
  const payload = {
    action: 'provisionDistrict',
    addresses: addresses
  };

  console.log('⏳ Sending provisionDistrict request to GAS...');
  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });

  if (!response.ok) {
    console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Provisioning Result:', JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error('❌ Provisioning failed inside GAS:', result.message);
    process.exit(1);
  }

  console.log(`🎉 Successfully provisioned district! Count: ${result.count}, Month: ${result.month}`);
}

main().catch(err => {
  console.error('❌ Fatal error during provisioning:', err);
  process.exit(1);
});
