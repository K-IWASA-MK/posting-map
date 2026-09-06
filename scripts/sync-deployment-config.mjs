import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const deploymentPath = path.join(rootDir, 'deployment.json');
const targetConfigPath = path.join(rootDir, 'active', 'dashboard', 'config.js');

if (!fs.existsSync(deploymentPath)) {
  console.error('❌ [Sync Config Error] deployment.json not found at:', deploymentPath);
  process.exit(1);
}

let deploymentData;
try {
  deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
} catch (err) {
  console.error('❌ [Sync Config Error] Failed to parse deployment.json:', err.message);
  process.exit(1);
}

const resources = deploymentData?.resources || {};
const webAppUrl = resources.webAppUrl;
const productionLiffUrl = resources.productionLiffUrl;

if (!webAppUrl || typeof webAppUrl !== 'string') {
  console.error('❌ [Sync Config Error] resources.webAppUrl is missing or invalid in deployment.json');
  process.exit(1);
}

if (!productionLiffUrl || typeof productionLiffUrl !== 'string') {
  console.error('❌ [Sync Config Error] resources.productionLiffUrl is missing or invalid in deployment.json');
  process.exit(1);
}

let liffId;
try {
  const parsedUrl = new URL(productionLiffUrl);
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  liffId = segments[0];
} catch (err) {
  console.error('❌ [Sync Config Error] Failed to parse productionLiffUrl URL:', err.message);
  process.exit(1);
}

if (!liffId) {
  console.error(`❌ [Sync Config Error] Could not extract liffId from productionLiffUrl: "${productionLiffUrl}"`);
  process.exit(1);
}

const configContent = `window.PMS_CLIENT_CONFIG = {
  version: "1.0.1",
  status: "ACTIVE_DEVELOPMENT",
  environment: "production",
  api: {
    gasWebAppUrl: "${webAppUrl}"
  },
  staticMaster: {
    addressCsvFilename: "address_master.csv",
    boundariesGeojsonFilename: "boundaries.geojson"
  },
  line: {
    liffId: "${liffId}"
  },
  features: {
    photoUpload: true,
    gpsTracking: true
  }
};
`;

fs.writeFileSync(targetConfigPath, configContent, 'utf8');

console.log('✅ [Sync Config] active/dashboard/config.js successfully synchronized from deployment.json:');
console.log(`   - webAppUrl: ${webAppUrl}`);
console.log(`   - liffId: ${liffId} (derived from ${productionLiffUrl})`);
console.log('   - spreadsheetId: [OMITTED - District-Agnostic]');
