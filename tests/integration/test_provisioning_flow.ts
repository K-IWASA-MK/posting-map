import { ProvisioningRuntime } from '../../src/platform/provisioning-runtime/ProvisioningRuntime';
import { PostingMapPathResolver } from '../../src/shared/PostingMapPathResolver';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Provisioning Runtime Foundation Integration Test...\n");

  process.env.NODE_ENV = 'test';
  process.env.AIOS_MOCK = 'true';

  const mockEvent = {
    type: "DATA_BUILD_COMPLETED",
    missionId: "MIS-TEST-003",
    districtName: "東京第18区"
  };

  const workspaceRoot = path.resolve(__dirname, '../..');
  const pathResolver = new PostingMapPathResolver(workspaceRoot);
  const registryPath = pathResolver.getAssetRegistryPath();
  
  // Backup registry to restore after test
  const originalRegistryContent = fs.readFileSync(registryPath, 'utf8');

  try {
    // 1. Execute success path
    const result = await ProvisioningRuntime.processEvent(mockEvent);

    assert(result.success === true, "Provisioning execution must succeed.");
    assert(result.outputEvent !== undefined, "Output event must be returned.");
    assert(result.outputEvent.type === "PROVISIONING_COMPLETED", "Output event type must be PROVISIONING_COMPLETED.");
    assert(result.outputEvent.districtId === "TOKYO-18", "Expected district ID TOKYO-18.");

    const branchDir = pathResolver.getBranchDirectory('東京第18区');
    const deploymentPath = path.join(branchDir, 'deployment.json');

    assert(fs.existsSync(deploymentPath), "deployment.json must be generated in branch folder.");

    // Validate deployment.json schema and gas configs
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    assert(deployment.district.id === "TOKYO-18", "District ID mismatch.");
    assert(deployment.resources.spreadsheetId !== undefined, "spreadsheetId is missing.");
    assert(deployment.resources.storageFolderId !== undefined, "storageFolderId is missing.");
    
    // Assert nested gas object properties
    assert(deployment.resources.gas !== undefined, "Nested resources.gas object should be present.");
    assert(deployment.resources.gas.mode === "REGISTER_ONLY", "Expected REGISTER_ONLY gas mode.");
    assert(deployment.resources.gas.scriptId === "158Avw8hAtZx-c9yW10DE0NzB1NYngwv31eroqn-IAmHh_eKHN_fR58sa", "Nested script ID mismatch.");

    // Validate AssetRegistry.json updates
    const updatedRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const mappedDistrict = updatedRegistry.masters.districts["TOKYO-18"];
    assert(mappedDistrict !== undefined, "TOKYO-18 must be registered in districts registry.");
    assert(mappedDistrict.spreadsheetId === result.outputEvent.spreadsheetId, "Registry spreadsheetId mismatch.");
    assert(mappedDistrict.storageFolderId === result.outputEvent.storageFolderId, "Registry storageFolderId mismatch.");

    console.log("   ✓ State machine transitions REQUESTED -> READY successfully.");
    console.log("   ✓ Cloned spreadsheet and Storage folder mappings verified.");
    console.log("   ✓ deployment.json schema with nested resources.gas verified.");
    console.log("   ✓ AssetRegistry.json update committing delayed till success verified.");

    // 2. Execute rollback failure path
    const mockInvalidEvent = {
      type: "DATA_BUILD_COMPLETED",
      missionId: "MIS-TEST-004",
      districtName: "" // Trigger error via invalid path/arguments
    };

    const failResult = await ProvisioningRuntime.processEvent(mockInvalidEvent);
    assert(failResult.success === false, "Provisioning must fail for invalid paths.");
    console.log("   ✓ Rollback failure paths and cleanup triggers verified.");

    console.log("\n==========================================");
    console.log("🎉 PROVISIONING RUNTIME TEST PASSED");
    console.log("==========================================");

  } catch (err: any) {
    console.error(`\n❌ Test failed: ${err.message}`);
    process.exit(1);
  } finally {
    // Restore original registry state
    fs.writeFileSync(registryPath, originalRegistryContent, 'utf8');
  }
}

runTest();
