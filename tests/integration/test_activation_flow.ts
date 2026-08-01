import * as fs from "fs";
import * as path from "path";
import { ActivationRuntime, ActivationEvent } from "../../src/platform/activation-runtime/ActivationRuntime";
import { ActivationStage } from "../../src/platform/activation-runtime/ActivationStage";
import { PostingMapPathResolver } from "../../src/shared/PostingMapPathResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Activation Runtime Foundation Integration Test...\n");

  const localWorkspaceRoot = path.join(__dirname, "..", "..", "..", "..");
  const pathResolver = new PostingMapPathResolver(localWorkspaceRoot);

  const branchDir = pathResolver.getBranchDirectory("東京第18区");
  const deploymentJsonPath = path.join(branchDir, "deployment.json");
  const activationJsonPath = path.join(branchDir, "activation.json");
  
  const registryPath = pathResolver.getAssetRegistryPath();

  let originalRegistryContent: string = "";

  // 1. Setup
  if (!fs.existsSync(branchDir)) {
    fs.mkdirSync(branchDir, { recursive: true });
  }

  const mockDeployment = {
    gas: {
      scriptId: "158Avw8hAtZx-MOCK_SCRIPT_ID",
      webAppUrl: "https://script.google.com/macros/s/MOCK_WEBAPP_URL/exec"
    }
  };
  fs.writeFileSync(deploymentJsonPath, JSON.stringify(mockDeployment, null, 2), "utf-8");

  if (fs.existsSync(registryPath)) {
    originalRegistryContent = fs.readFileSync(registryPath, "utf-8");
    const registryObj = JSON.parse(originalRegistryContent);
    if (!registryObj.masters) registryObj.masters = {};
    if (!registryObj.masters.districts) registryObj.masters.districts = {};
    
    registryObj.masters.districts["TOKYO-18"] = {
      spreadsheetId: "1_NEW_CLONED_SPREADSHEET_ID_HERE",
      storageFolderId: "1_NEW_CREATED_STORAGE_FOLDER_ID_HERE",
      gasScriptId: "158Avw8hAtZx-MOCK_SCRIPT_ID"
    };
    fs.writeFileSync(registryPath, JSON.stringify(registryObj, null, 2), "utf-8");
  }

  try {
    // Test Case 1: Normal Flow
    {
      const runtime = new ActivationRuntime(localWorkspaceRoot);
      const event: ActivationEvent = {
        type: "PROVISIONING_COMPLETED",
        missionId: "MIS-TEST-ACT-001",
        districtName: "東京第18区",
        districtId: "TOKYO-18",
        spreadsheetId: "1_NEW_CLONED_SPREADSHEET_ID_HERE",
        storageFolderId: "1_NEW_CREATED_STORAGE_FOLDER_ID_HERE",
        occurredAt: new Date().toISOString()
      };

      const res = await runtime.processEvent(event);
      assert(res.success === true, "Normal flow execution should succeed");
      assert(res.stage === ActivationStage.ACTIVE, "Stage should be ACTIVE");
      assert(fs.existsSync(activationJsonPath) === true, "activation.json must be written");

      const activationObj = JSON.parse(fs.readFileSync(activationJsonPath, "utf-8"));
      assert(activationObj.status === "ACTIVE", "Status in JSON must be ACTIVE");
      assert(activationObj.runtime.version === "v1", "Runtime version must be v1");
      assert(activationObj.runtime.activatedBy === "AIOS", "ActivatedBy must be AIOS");
      assert(activationObj.checks.line.status === "PASS", "LINE check must be PASS");
      assert(activationObj.checks.gas.status === "PASS", "GAS check must be PASS");
      assert(activationObj.checks.dashboard.status === "PASS", "Dashboard check must be PASS");
      assert(typeof activationObj.audit.transactionId === "string" && activationObj.audit.transactionId.startsWith("act-"), "TransactionId should be valid string starting with act-");

      console.log("   ✓ State machine transitions READY -> ACTIVE successfully.");
      console.log("   ✓ activation.json generated with valid runtime and check statuses.");
    }

    // Test Case 2: GAS URL invalid
    {
      const badDeployment = {
        gas: {
          scriptId: "158Avw8hAtZx-MOCK_SCRIPT_ID",
          webAppUrl: "https://script.google.com/macros/s/MOCK_WEBAPP_URL/exec_failed"
        }
      };
      fs.writeFileSync(deploymentJsonPath, JSON.stringify(badDeployment, null, 2), "utf-8");

      const runtime = new ActivationRuntime(localWorkspaceRoot);
      const event: ActivationEvent = {
        type: "PROVISIONING_COMPLETED",
        missionId: "MIS-TEST-ACT-002",
        districtName: "東京第18区",
        districtId: "TOKYO-18",
        spreadsheetId: "1_NEW_CLONED_SPREADSHEET_ID_HERE",
        storageFolderId: "1_NEW_CREATED_STORAGE_FOLDER_ID_HERE",
        occurredAt: new Date().toISOString()
      };

      const res = await runtime.processEvent(event);
      assert(res.success === false, "Execution should fail on bad GAS URL");
      assert(res.stage === ActivationStage.FAILED, "Stage should transition to FAILED");
      assert(res.error === "GAS WebApp Connection check failed.", "Should report connection failure");

      const activationObj = JSON.parse(fs.readFileSync(activationJsonPath, "utf-8"));
      assert(activationObj.status === "FAILED", "Status should be saved as FAILED in JSON");
      assert(activationObj.error === "GAS WebApp Connection check failed.", "Failure cause should be recorded");

      console.log("   ✓ GAS connection failure path and FAILED state transition verified.");
    }

    // Test Case 3: Registry alignment missing
    {
      // GAS URL を正常値に戻す
      const mockDeployment = {
        gas: {
          scriptId: "158Avw8hAtZx-MOCK_SCRIPT_ID",
          webAppUrl: "https://script.google.com/macros/s/MOCK_WEBAPP_URL/exec"
        }
      };
      fs.writeFileSync(deploymentJsonPath, JSON.stringify(mockDeployment, null, 2), "utf-8");

      const runtime = new ActivationRuntime(localWorkspaceRoot);
      const event: ActivationEvent = {
        type: "PROVISIONING_COMPLETED",
        missionId: "MIS-TEST-ACT-003",
        districtName: "東京第18区",
        districtId: "TOKYO-999_NOT_EXIST",
        spreadsheetId: "1_NEW_CLONED_SPREADSHEET_ID_HERE",
        storageFolderId: "1_NEW_CREATED_STORAGE_FOLDER_ID_HERE",
        occurredAt: new Date().toISOString()
      };

      const res = await runtime.processEvent(event);
      assert(res.success === false, "Execution should fail on unaligned districtId");
      assert(res.stage === ActivationStage.FAILED, "Stage should transition to FAILED");
      assert(res.error === "AssetRegistry alignment check failed.", "Should report registry alignment failure");

      const activationObj = JSON.parse(fs.readFileSync(activationJsonPath, "utf-8"));
      assert(activationObj.status === "FAILED", "Status should be saved as FAILED in JSON");

      console.log("   ✓ Registry mapping failure path and FAILED state transition verified.");
    }

    console.log("\n==========================================");
    console.log("🎉 ACTIVATION RUNTIME TEST PASSED");
    console.log("==========================================\n");

  } finally {
    // クリーンアップ
    if (fs.existsSync(deploymentJsonPath)) {
      fs.unlinkSync(deploymentJsonPath);
    }
    if (fs.existsSync(activationJsonPath)) {
      fs.unlinkSync(activationJsonPath);
    }
    if (originalRegistryContent) {
      fs.writeFileSync(registryPath, originalRegistryContent, "utf-8");
    }
  }
}

runTest().catch(err => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
