import * as fs from "fs";
import * as path from "path";
import { DashboardDataRuntime } from "../../src/platform/dashboard-data-runtime/DashboardDataRuntime";
import { SchemaValidator } from "../../src/platform/dashboard-data-runtime/validation/SchemaValidator";
import { PostingMapPathResolver } from "../../src/shared/PostingMapPathResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Dashboard Data Runtime Foundation Integration Test...\n");

  const localWorkspaceRoot = path.join(__dirname, "..", "..", "..", "..");
  const pathResolver = new PostingMapPathResolver(localWorkspaceRoot);
  const districtName = "TEST-DISTRICT-1";
  const districtId = "TEST-DST-01";

  const branchDir = pathResolver.getBranchDirectory(districtName);

  const researchPath = path.join(branchDir, "election-research-result.json");
  const deploymentPath = path.join(branchDir, "deployment.json");
  const activationPath = path.join(branchDir, "activation.json");
  const dashboardDataPath = path.join(branchDir, "dashboard-data.json");

  const registryPath = pathResolver.getAssetRegistryPath();

  let originalRegistryContent: string = "";

  // 1. Setup Environment
  if (!fs.existsSync(branchDir)) {
    fs.mkdirSync(branchDir, { recursive: true });
  }

  if (fs.existsSync(registryPath)) {
    originalRegistryContent = fs.readFileSync(registryPath, "utf-8");
  }

  const mockResearch = {
    district: {
      id: districtId,
      name: districtName
    },
    municipalities: [
      {
        name: "自治体A",
        electionHistory: [
          { type: "衆議院", year: 2024, turnout: 55.4 },
          { type: "参議院", year: 2022, turnout: 52.1 }
        ]
      },
      {
        name: "自治体B",
        electionHistory: [
          { type: "衆議院", year: 2024, turnout: 58.9 }
        ]
      }
    ],
    metadata: {
      source: "Election Master",
      version: "v1",
      generatedBy: "AIOS ElectionResearchRuntime",
      generatedAt: new Date().toISOString()
    }
  };

  const mockDeployment = {
    district: {
      id: districtId,
      name: districtName
    },
    resources: {
      spreadsheetId: "ss-123456",
      storageFolderId: "fld-123456",
      scriptId: "scr-123456",
      webAppUrl: "https://script.google.com/macros/s/123/exec",
      gas: {
        mode: "REGISTER_ONLY",
        scriptId: "scr-123456",
        webAppUrl: "https://script.google.com/macros/s/123/exec"
      }
    },
    provisioning: {
      templateVersion: "v1",
      createdAt: Date.now(),
      createdBy: "aios-provisioner@platform.postingmap",
      status: "READY",
      transactionId: "prov-999-999"
    }
  };

  const mockActivation = {
    district: {
      id: districtId,
      name: districtName
    },
    status: "ACTIVE",
    runtime: {
      version: "v1",
      activatedBy: "AIOS"
    },
    checks: {
      line: {
        status: "PASS",
        details: {
          loginChannel: "POSTING MAP Login",
          messagingChannel: "POSTING MAP Msg API",
          adminChannel: "POSTING MAP Admin"
        }
      },
      gas: {
        status: "PASS",
        details: {
          spreadsheetId: "ss-123456",
          health: "PASS"
        }
      },
      dashboard: {
        status: "PASS"
      }
    },
    activatedAt: Date.now(),
    audit: {
      transactionId: "act-999-999",
      createdBy: "aios-activator@platform.postingmap"
    }
  };

  const mockRegistry = {
    updatedAt: Date.now(),
    schemaVersion: 1,
    templates: {
      spreadsheetId: "tpl-ss-id",
      scriptId: "tpl-scr-id",
      webAppUrl: "https://script.google.com/exec",
      version: "v1",
      projectName: "テンプレート",
      lastUpdated: new Date().toISOString()
    },
    masters: {
      global: {},
      districts: {
        [districtId]: {
          spreadsheetId: "ss-123456",
          storageFolderId: "fld-123456",
          gasScriptId: "scr-123456"
        }
      }
    },
    dashboard: { assets: [] },
    storage: { rootFolderId: "root-folder-123" }
  };

  try {
    // Write test inputs
    fs.writeFileSync(researchPath, JSON.stringify(mockResearch, null, 2), "utf-8");
    fs.writeFileSync(deploymentPath, JSON.stringify(mockDeployment, null, 2), "utf-8");
    fs.writeFileSync(activationPath, JSON.stringify(mockActivation, null, 2), "utf-8");
    fs.writeFileSync(registryPath, JSON.stringify(mockRegistry, null, 2), "utf-8");

    // ==========================================
    // 1. Normal Case Test
    // ==========================================
    {
      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-TEST-DASH-001",
        districtName
      };

      const result = await runtime.processEvent(event);
      assert(result.success === true, "Normal case run should succeed.");
      assert(result.event !== undefined, "Output event should be returned.");
      assert(result.event!.type === "DASHBOARD_DATA_COMPLETED", "Output event type matches.");
      assert(result.event!.outputFile === `03_BRANCH/${districtName}/dashboard-data.json`, "Output path matches.");

      assert(fs.existsSync(dashboardDataPath), "dashboard-data.json file must exist.");
      const output = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));

      // Verify Contract Structures
      assert(output.metadata !== undefined, "Metadata must exist.");
      assert(output.metadata.schemaVersion === "v1", "Schema version must be v1.");
      assert(output.metadata.sourceHash !== "", "Source hash must be generated.");
      assert(output.metadata.executionId.startsWith("dashboard-runtime-"), "Execution ID follows naming rule.");
      
      assert(output.districts.length === 1, "Expected exactly 1 district.");
      assert(output.districts[0].id === districtId, "District ID must match.");
      assert(output.districts[0].status === "ACTIVE", "District status must match activation status.");

      assert(output.municipalities.length === 2, "Expected 2 municipalities.");
      assert(output.municipalities[0].name === "自治体A", "First municipality name matches.");
      assert(output.municipalities[0].historyCount === 2, "自治体A history count matches.");

      assert(output.turnoutComparison.length === 3, "Expected 3 turnout comparison items.");
      assert(output.turnoutComparison[0].municipalityName === "自治体A", "First turnout item belongs to 自治体A.");
      assert(output.turnoutComparison[0].turnout === 55.4, "Turnout percentage matches.");

      assert(output.branchStatus.length === 1, "Expected 1 branchStatus entry.");
      assert(output.branchStatus[0].provisioningStatus === "READY", "Provisioning status matches.");
      assert(output.branchStatus[0].activationStatus === "ACTIVE", "Activation status matches.");
      assert(output.branchStatus[0].lineCheck === "PASS", "Line check matches.");

      assert(output.assetStatus.length === 1, "Expected 1 assetStatus entry.");
      assert(output.assetStatus[0].spreadsheetId === "ss-123456", "Spreadsheet ID matches.");
      assert(output.assetStatus[0].inRegistry === true, "Should resolve as registered.");

      console.log("   ✓ Normal Case validation passed.");
    }

    // ==========================================
    // 2. Missing Input Test
    // ==========================================
    {
      fs.unlinkSync(activationPath); // Delete activation file to trigger missing input error
      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-TEST-DASH-002",
        districtName
      };

      const result = await runtime.processEvent(event);
      assert(result.success === false, "Should fail when activation.json is missing.");
      assert(result.error !== undefined && result.error.includes("Missing required input"), "Should mention missing input in error message.");

      // Restore activation for next tests
      fs.writeFileSync(activationPath, JSON.stringify(mockActivation, null, 2), "utf-8");
      console.log("   ✓ Missing Input validation passed.");
    }

    // ==========================================
    // 3. Invalid Schema Test
    // ==========================================
    {
      // Corrupt schema of deploymentJson
      const corruptedDeployment = { ...mockDeployment, resources: "CORRUPTED_STRING_INSTEAD_OF_OBJECT" };
      fs.writeFileSync(deploymentPath, JSON.stringify(corruptedDeployment, null, 2), "utf-8");

      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-TEST-DASH-003",
        districtName
      };

      const result = await runtime.processEvent(event);
      assert(result.success === false, "Should fail with corrupted deployment schema.");
      assert(result.error !== undefined && result.error.includes("Invalid schema in deployment.json"), "Should report deployment schema validation error.");

      // Restore deployment for next tests
      fs.writeFileSync(deploymentPath, JSON.stringify(mockDeployment, null, 2), "utf-8");
      console.log("   ✓ Invalid Schema validation passed.");
    }

    // ==========================================
    // 4. Empty Dataset Test
    // ==========================================
    {
      const emptyResearch = {
        district: { id: districtId, name: districtName },
        municipalities: [],
        metadata: mockResearch.metadata
      };
      fs.writeFileSync(researchPath, JSON.stringify(emptyResearch, null, 2), "utf-8");

      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-TEST-DASH-004",
        districtName
      };

      const result = await runtime.processEvent(event);
      assert(result.success === true, "Should succeed even with empty datasets.");
      const output = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));
      assert(output.municipalities.length === 0, "Municipalities array must be empty.");
      assert(output.turnoutComparison.length === 0, "TurnoutComparison array must be empty.");

      // Restore research
      fs.writeFileSync(researchPath, JSON.stringify(mockResearch, null, 2), "utf-8");
      console.log("   ✓ Empty Dataset validation passed.");
    }

    // ==========================================
    // 5. Hash Verification Test
    // ==========================================
    {
      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-TEST-DASH-005",
        districtName
      };

      // First run hash
      let result = await runtime.processEvent(event);
      assert(result.success === true, "Run 1 success");
      const hash1 = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8")).metadata.sourceHash;

      // Second run with same inputs
      result = await runtime.processEvent(event);
      assert(result.success === true, "Run 2 success");
      const hash2 = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8")).metadata.sourceHash;
      assert(hash1 === hash2, "Hashes must be identical for identical inputs (determinism).");

      // Modify deployment file slightly
      const modifiedDeployment = {
        ...mockDeployment,
        provisioning: { ...mockDeployment.provisioning, transactionId: "prov-999-MODIFIED" }
      };
      fs.writeFileSync(deploymentPath, JSON.stringify(modifiedDeployment, null, 2), "utf-8");

      // Third run with modified input
      result = await runtime.processEvent(event);
      assert(result.success === true, "Run 3 success");
      const hash3 = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8")).metadata.sourceHash;
      assert(hash1 !== hash3, "Hashes must differ if input content changed.");

      // Restore deployment
      fs.writeFileSync(deploymentPath, JSON.stringify(mockDeployment, null, 2), "utf-8");
      console.log("   ✓ Hash Verification validation passed.");
    }

    // ==========================================
    // 6. Contract Version Test
    // ==========================================
    {
      // A. Verify normal v1 validation
      const validContract = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));
      let valResult = SchemaValidator.validateDashboardData(validContract);
      assert(valResult.valid === true, "Valid v1 contract must pass.");

      // B. Future version rejected
      const futureContract = {
        ...validContract,
        metadata: { ...validContract.metadata, schemaVersion: "v2" }
      };
      valResult = SchemaValidator.validateDashboardData(futureContract);
      assert(valResult.valid === false, "Future schema version (v2) must be rejected.");
      assert(valResult.errors.some(e => e.includes("Unsupported or future schema version")), "Error message must report version issue.");

      // C. Unknown field allowed
      const contractWithUnknownField = {
        ...validContract,
        someNewFutureMetadataProperty: "test-value",
        metadata: {
          ...validContract.metadata,
          anotherExtraField: 12345
        }
      };
      valResult = SchemaValidator.validateDashboardData(contractWithUnknownField);
      assert(valResult.valid === true, "Unknown/extra properties must be allowed for future compatibility.");

      console.log("   ✓ Contract Version validation passed.");
    }

    console.log("\n==========================================");
    console.log("🎉 DASHBOARD DATA RUNTIME INTEGRATION TEST PASSED");
    console.log("==========================================\n");

  } finally {
    // Cleanup
    if (fs.existsSync(researchPath)) fs.unlinkSync(researchPath);
    if (fs.existsSync(deploymentPath)) fs.unlinkSync(deploymentPath);
    if (fs.existsSync(activationPath)) fs.unlinkSync(activationPath);
    if (fs.existsSync(dashboardDataPath)) fs.unlinkSync(dashboardDataPath);
    if (originalRegistryContent) {
      fs.writeFileSync(registryPath, originalRegistryContent, "utf-8");
    } else if (fs.existsSync(registryPath)) {
      fs.unlinkSync(registryPath);
    }
  }
}

runTest().catch((err) => {
  console.error("❌ Test execution failed with error:", err);
  process.exit(1);
});
