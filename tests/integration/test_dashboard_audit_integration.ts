import * as fs from "fs";
import * as path from "path";
import { DashboardDataRuntime } from "../../src/platform/dashboard-data-runtime/DashboardDataRuntime";
import { DashboardAuditPublisher } from "../../src/platform/dashboard-data-runtime/audit/DashboardAuditPublisher";
import { ExecutionLedgerAdapter } from "../../src/platform/dashboard-data-runtime/audit/ExecutionLedgerAdapter";
import { DashboardDataIntegrityVerifier } from "../../src/platform/dashboard-data-runtime/audit/DashboardDataIntegrityVerifier";
import { ExecutionLedgerRegistry } from "../../../../sdk/ExecutionLedgerRegistry";
import { PostingMapPathResolver } from "../../src/shared/PostingMapPathResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Dashboard Data Audit Integration Integration Test...\n");

  const localWorkspaceRoot = path.join(__dirname, "..", "..", "..", "..");
  const pathResolver = new PostingMapPathResolver(localWorkspaceRoot);
  const districtName = "TEST-DISTRICT-AUDIT";
  const districtId = "TEST-DST-AUDIT";

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
    district: { id: districtId, name: districtName },
    municipalities: [
      {
        name: "自治体X",
        electionHistory: [{ type: "衆議院", year: 2024, turnout: 60.1 }]
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
    district: { id: districtId, name: districtName },
    resources: {
      spreadsheetId: "ss-audit-1",
      storageFolderId: "fld-audit-1",
      scriptId: "scr-audit-1",
      webAppUrl: "https://script.google.com/macros/s/audit/exec",
      gas: {
        mode: "REGISTER_ONLY",
        scriptId: "scr-audit-1",
        webAppUrl: "https://script.google.com/macros/s/audit/exec"
      }
    },
    provisioning: {
      templateVersion: "v1",
      createdAt: Date.now(),
      createdBy: "aios-provisioner@platform.postingmap",
      status: "READY",
      transactionId: "prov-audit-999"
    }
  };

  const mockActivation = {
    district: { id: districtId, name: districtName },
    status: "ACTIVE",
    runtime: { version: "v1", activatedBy: "AIOS" },
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
        details: { spreadsheetId: "ss-audit-1", health: "PASS" }
      },
      dashboard: { status: "PASS" }
    },
    activatedAt: Date.now(),
    audit: {
      transactionId: "act-audit-999",
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
          spreadsheetId: "ss-audit-1",
          storageFolderId: "fld-audit-1",
          gasScriptId: "scr-audit-1"
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

    {
      DashboardAuditPublisher.clear();
      const state = {
        eventCaptured: false,
        registeredInRegistry: false
      };

      // Subscribe ExecutionLedgerAdapter to direct event bus
      DashboardAuditPublisher.subscribe((event) => {
        state.eventCaptured = true;
        // Verify format
        assert(event.eventType === "DASHBOARD_DATA_GENERATED", "Event type must match");
        assert(event.lineage.sources.length === 4, "Expected 4 lineage sources");

        // Convert and register in platform ExecutionLedgerRegistry
        try {
          ExecutionLedgerAdapter.registerEvent(event);
          state.registeredInRegistry = true;
        } catch (e: any) {
          console.error("Ledger registration failed:", e);
        }
      });

      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-AUDIT-001",
        districtName
      };

      const result = await runtime.processEvent(event);
      assert(result.success === true, "Execution should succeed.");
      assert(state.eventCaptured === true, "Audit Event must have been published.");
      assert(state.registeredInRegistry === true, "Audit Event must be successfully registered in ExecutionLedgerRegistry.");

      // Verify outputs and read record (which is mapped to ledgerId in registry)
      const output = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));
      const executionId = output.metadata.executionId;
      
      const hashCode = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash = hash & hash;
        }
        return hash;
      };
      const ledgerId = `ledger-${Math.abs(hashCode(executionId))}`;

      const record = ExecutionLedgerRegistry.get(ledgerId);
      if (!record) {
        throw new Error(`Record not found in registry for ledgerId: ${ledgerId} (executionId: ${executionId})`);
      }
      assert(record.capabilityId === "DashboardDataRuntime", "CapabilityId maps correctly.");
      assert(record.auditTrail.some(a => a.startsWith("outputHash:")), "Audit trail contains outputHash.");

      console.log("   ✓ Normal Audit Flow passed.");
    }

    // ==========================================
    // 2. Hash Integrity Test
    // ==========================================
    {
      const output = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));
      const sourceHash = output.metadata.sourceHash;

      // Verify using checker
      const verResult = DashboardDataIntegrityVerifier.verify({
        outputPath: dashboardDataPath,
        expectedSourceHash: sourceHash,
        expectedSchemaVersion: "v1"
      });
      assert(verResult.valid === true, "Integrity verification should pass for unaltered output.");

      // Modify outputHash in file to simulate corruption
      const corruptedOutput = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));
      corruptedOutput.lineage.outputHash = "ALTERED_OUTPUT_HASH_STRING";
      fs.writeFileSync(dashboardDataPath, JSON.stringify(corruptedOutput, null, 2), "utf-8");

      const verCorrupted = DashboardDataIntegrityVerifier.verify({
        outputPath: dashboardDataPath,
        expectedSourceHash: sourceHash,
        expectedSchemaVersion: "v1"
      });
      assert(verCorrupted.valid === false, "Verifier must reject altered/corrupted outputHash.");
      assert(verCorrupted.errors.some(e => e.includes("Output hash mismatch")), "Verifier should report output hash mismatch.");

      // Re-generate valid output for subsequent tests
      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      await runtime.processEvent({
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-AUDIT-001",
        districtName
      });

      console.log("   ✓ Hash Integrity validation passed.");
    }

    // ==========================================
    // 3. Missing Ledger (Non-blocking) Test
    // ==========================================
    {
      DashboardAuditPublisher.clear();
      // Setup a faulty publisher subscriber that throws a simulated error
      DashboardAuditPublisher.subscribe(() => {
        throw new Error("Simulated Ledger Storage Unavailable Error");
      });

      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-AUDIT-002",
        districtName
      };

      const result = await runtime.processEvent(event);
      // Main process should not be failed or blocked by audit failure
      assert(result.success === true, "Generation process must succeed even if audit subscriber fails (Non-blocking).");
      assert(fs.existsSync(dashboardDataPath), "Output file should be written successfully.");

      console.log("   ✓ Missing Ledger (Non-blocking) validation passed.");
    }

    // ==========================================
    // 4. Replay Test (Determinism)
    // ==========================================
    {
      DashboardAuditPublisher.clear();
      const runtime = new DashboardDataRuntime(localWorkspaceRoot);
      const event = {
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-AUDIT-REPLAY",
        districtName
      };

      // Run 1
      const res1 = await runtime.processEvent(event);
      assert(res1.success === true, "Run 1 success");
      const out1 = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));

      // Run 2
      const res2 = await runtime.processEvent(event);
      assert(res2.success === true, "Run 2 success");
      const out2 = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));

      // Verify identity
      assert(out1.metadata.sourceHash === out2.metadata.sourceHash, "sourceHash must be identical across replays.");
      assert(out1.lineage.outputHash === out2.lineage.outputHash, "outputHash must be identical across replays.");
      assert(JSON.stringify(out1.lineage.sources) === JSON.stringify(out2.lineage.sources), "Lineage sources list must be identical.");

      console.log("   ✓ Replay (Determinism) validation passed.");
    }

    console.log("\n==========================================");
    console.log("🎉 AUDIT INTEGRATION INTEGRATION TEST PASSED");
    console.log("==========================================\n");

  } finally {
    // Teardown
    if (fs.existsSync(researchPath)) fs.unlinkSync(researchPath);
    if (fs.existsSync(deploymentPath)) fs.unlinkSync(deploymentPath);
    if (fs.existsSync(activationPath)) fs.unlinkSync(activationPath);
    if (fs.existsSync(dashboardDataPath)) fs.unlinkSync(dashboardDataPath);
    if (originalRegistryContent) {
      fs.writeFileSync(registryPath, originalRegistryContent, "utf-8");
    } else if (fs.existsSync(registryPath)) {
      fs.unlinkSync(registryPath);
    }
    DashboardAuditPublisher.clear();
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
