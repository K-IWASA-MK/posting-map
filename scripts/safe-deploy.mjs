import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function runStep(description, command) {
  console.log(`\n🚀 [Safe Deploy Step] ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n🛑 [Hard Stop] ${description} failed.`);
    process.exit(1);
  }
}

function getDeploymentId() {
  const deploymentJsonPath = resolve(process.cwd(), 'deployment.json');
  try {
    const data = JSON.parse(readFileSync(deploymentJsonPath, 'utf8'));
    if (!data.deploymentId) {
      throw new Error('deploymentId is missing in deployment.json');
    }
    return data.deploymentId;
  } catch (err) {
    console.error(`\n🛑 [Hard Stop] Failed to read deployment.json: ${err.message}`);
    process.exit(1);
  }
}

// 1. Preflight SSOT Check
runStep('Preflight SSOT Check', 'npm run check:ssot');

// 2. Resolve Deployment ID & Execute clasp deploy
const deploymentId = getDeploymentId();
console.log(`\n📌 Target Deployment ID: ${deploymentId}`);
runStep('Executing clasp deploy with fixed Deployment ID', `npx clasp deploy -i ${deploymentId}`);

// 3. Post-deploy Verification
runStep('Post-deploy Verification', 'npm run verify:gas');

console.log('\n✅ [Safe Deploy Complete] Production GAS deployment and verification succeeded.');
