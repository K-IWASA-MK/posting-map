/**
 * POSTING MAP
 * Phase 34: Registry Integrity Verification Test
 */

const assert = require('assert');
const RegistryManager = require('../development/registry-manager');

function runTest() {
  console.log(`==================================================`);
  console.log(`🧪 Running Registry Integrity & Validation Tests`);
  console.log(`==================================================\n`);

  // 1. Force rebuild first to ensure registry.json matches clients/ state
  console.log("Rebuilding registry from clients/ folder...");
  RegistryManager.rebuildRegistry();

  // 2. Execute validation
  console.log("Running validation scan...");
  const report = RegistryManager.validateRegistry();

  if (report.success) {
    console.log("✓ Validation PASS: Registry structure is sound, no duplicates or missing config files detected.");
  } else {
    console.error("❌ Validation FAIL: Errors found in registry structure:");
    report.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 3. Simple schema property checks
  const reg = JSON.parse(require('fs').readFileSync(RegistryManager.getRegistryPath(), 'utf8'));
  assert.ok(reg.updatedAt, "Registry must contain 'updatedAt'");
  assert.equal(reg.schemaVersion, 1, "Registry schema version must be 1");
  assert.ok(Array.isArray(reg.districts), "Registry districts must be an array");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL REGISTRY INTEGRITY TESTS PASSED`);
  console.log(`==================================================`);
}

runTest();
