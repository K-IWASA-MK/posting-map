/**
 * POSTING MAP
 * Integration Regression Test: AssetRegistry Retrieval Integrity Check
 */

const assert = require('assert');
const AssetRegistryService = require('../development/AssetRegistryService');

function runTest() {
  console.log("🧪 Running AssetRegistry Core Integration Tests...\n");

  try {
    // 1. Load Templates
    console.log("1. Testing Template spreadsheet/script resolution...");
    const templateSheet = AssetRegistryService.getTemplateSpreadsheet();
    const templateGas = AssetRegistryService.getTemplateGAS();
    console.log(`   ✓ Resolved Template Spreadsheet ID: ${templateSheet}`);
    console.log(`   ✓ Resolved Template GAS Script ID: ${templateGas.scriptId}`);
    assert.strictEqual(typeof templateSheet, 'string', "Template spreadsheet ID should be a string.");
    assert.strictEqual(typeof templateGas.scriptId, 'string', "Template GAS script ID should be a string.");

    // 2. Load Storage Config
    console.log("2. Testing Storage configuration resolution...");
    const storageRoot = AssetRegistryService.getStorageRoot();
    console.log(`   ✓ Resolved Storage Root Folder ID: ${storageRoot}`);
    assert.strictEqual(typeof storageRoot, 'string', "Storage root folder ID should be a string.");

    // 2.5. Load Master Reference Data
    console.log("2.5. Testing Master Reference data resolution...");
    const postalMaster = AssetRegistryService.getPostalMaster();
    const addressMaster = AssetRegistryService.getAddressMaster();
    
    assert.ok(postalMaster, "Postal Master should be registered.");
    assert.ok(addressMaster, "Address Master should be registered.");
    console.log(`   ✓ Resolved Postal Master ID: ${postalMaster.fileId} (${postalMaster.name})`);
    console.log(`   ✓ Resolved Address Master ID: ${addressMaster.fileId} (${addressMaster.name})`);
    assert.strictEqual(typeof postalMaster.fileId, 'string', "Postal Master fileId should be a string.");
    assert.strictEqual(typeof addressMaster.fileId, 'string', "Address Master fileId should be a string.");

    // 3. Load Branch Assets (MIE-04 and MIE-05)
    console.log("3. Testing Branch/District specific asset resolution...");
    const mie05 = AssetRegistryService.getDistrictAssets("MIE-05");
    const mie04 = AssetRegistryService.getDistrictAssets("MIE-04");
    
    assert.ok(mie05, "MIE-05 should be registered.");
    assert.ok(mie04, "MIE-04 should be registered.");
    console.log(`   ✓ MIE-05 Storage: ${mie05.storageFolderId}, Spreadsheet: ${mie05.spreadsheetId}`);
    console.log(`   ✓ MIE-04 Storage: ${mie04.storageFolderId}, Spreadsheet: ${mie04.spreadsheetId}`);

    console.log("\n==========================================");
    console.log("🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY");
    console.log("==========================================");

  } catch (e) {
    console.error(`\n❌ Integration test failed: ${e.message}`);
    process.exit(1);
  }
}

runTest();
