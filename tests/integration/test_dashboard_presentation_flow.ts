import * as fs from "fs";
import * as path from "path";
import { DashboardDataRuntime } from "../../src/platform/dashboard-data-runtime/DashboardDataRuntime";
import { DashboardPresentationRuntime } from "../../src/platform/dashboard-presentation-runtime/DashboardPresentationRuntime";
import { PresentationIntegrityVerifier } from "../../src/platform/dashboard-presentation-runtime/validation/PresentationIntegrityVerifier";
import { DeploymentAdapter } from "../../src/platform/dashboard-presentation-runtime/adapters/DeploymentAdapter";
import { DeploymentResult } from "../../src/platform/dashboard-presentation-runtime/adapters/DeploymentResult";
import { PublicDashboardDataContract } from "../../src/platform/dashboard-presentation-runtime/contract/PresentationContract";
import { PostingMapPathResolver } from "../../src/shared/PostingMapPathResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockCloudDeploymentAdapter implements DeploymentAdapter {
  public lastDeployedArtifact: PublicDashboardDataContract | null = null;

  public async deploy(artifact: PublicDashboardDataContract, districtName: string): Promise<DeploymentResult> {
    this.lastDeployedArtifact = artifact;
    return {
      success: true,
      provider: "MockCloudStorage",
      location: `https://storage.googleapis.com/posting-map-public/${districtName}/public-dashboard-data.json`
    };
  }
}

async function runTest() {
  console.log("🧪 Running Dashboard Presentation Runtime Foundation Test...\n");

  const localWorkspaceRoot = path.join(__dirname, "..", "..", "..", "..");
  const pathResolver = new PostingMapPathResolver(localWorkspaceRoot);
  const districtName = "TEST-DISTRICT-PRESENTATION";
  const districtId = "TEST-DST-PRES";

  const branchDir = pathResolver.getBranchDirectory(districtName);

  const researchPath = path.join(branchDir, "election-research-result.json");
  const deploymentPath = path.join(branchDir, "deployment.json");
  const activationPath = path.join(branchDir, "activation.json");
  const dashboardDataPath = path.join(branchDir, "dashboard-data.json");
  const publicDataPath = path.join(branchDir, "public-dashboard-data.json");

  const registryPath = pathResolver.getAssetRegistryPath();

  let originalRegistryContent: string = "";

  // Setup environment
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
        name: "自治体A",
        electionHistory: [{ type: "衆議院", year: 2024, turnout: 68.5 }]
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
      spreadsheetId: "ss-pres-1",
      storageFolderId: "fld-pres-1",
      scriptId: "scr-pres-1",
      webAppUrl: "https://script.google.com/macros/s/pres/exec",
      gas: {
        mode: "REGISTER_ONLY",
        scriptId: "scr-pres-1",
        webAppUrl: "https://script.google.com/macros/s/pres/exec"
      }
    },
    provisioning: {
      templateVersion: "v1",
      createdAt: Date.now(),
      createdBy: "aios-provisioner@platform.postingmap",
      status: "READY",
      transactionId: "prov-pres-999"
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
        details: { spreadsheetId: "ss-pres-1", health: "PASS" }
      },
      dashboard: { status: "PASS" }
    },
    activatedAt: Date.now(),
    audit: {
      transactionId: "act-pres-999",
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
          spreadsheetId: "ss-pres-1",
          storageFolderId: "fld-pres-1",
          gasScriptId: "scr-pres-1"
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

    // Pre-requisite: Generate dashboard-data.json using DashboardDataRuntime
    const dataRuntime = new DashboardDataRuntime(localWorkspaceRoot);
    const dataResult = await dataRuntime.processEvent({
      type: "DASHBOARD_DATA_REQUESTED",
      missionId: "MIS-PRES-PRE",
      districtName
    });
    assert(dataResult.success === true, "DashboardDataRuntime pre-requisite must succeed");

    const intermediateData = JSON.parse(fs.readFileSync(dashboardDataPath, "utf-8"));
    const sourceHash = intermediateData.metadata.sourceHash;
    const outputHash = intermediateData.lineage.outputHash;

    // ==========================================
    // 1. Normal Compiler Flow & 3-Stage Chain Test
    // ==========================================
    {
      const presentationRuntime = new DashboardPresentationRuntime(localWorkspaceRoot);
      const res = await presentationRuntime.processEvent({
        type: "DASHBOARD_PRESENTATION_REQUESTED",
        missionId: "MIS-PRES-001",
        districtName,
        expectedSourceHash: sourceHash
      });

      assert(res.success === true, "Presentation compile must succeed");
      assert(fs.existsSync(publicDataPath), "public-dashboard-data.json must exist");

      // Verify 3-Stage Integrity Chain in output file
      const publicData = JSON.parse(fs.readFileSync(publicDataPath, "utf-8"));
      assert(publicData.lineage.sourceHash === sourceHash, "Lineage sourceHash must match initial sourceHash");
      assert(publicData.lineage.outputHash === outputHash, "Lineage outputHash must match intermediate outputHash");
      assert(!!publicData.metadata.presentationHash, "presentationHash must be generated");

      // Verify integrity using verifier
      const verResult = PresentationIntegrityVerifier.verify({
        outputPath: publicDataPath,
        expectedOutputHash: outputHash
      });
      assert(verResult.valid === true, "Verifier should confirm file integrity");

      console.log("   ✓ Normal Compiler & 3-Stage Integrity Chain verified.");
    }

    // ==========================================
    // 2. Deterministic Hash Verification
    // ==========================================
    {
      const presentationRuntime = new DashboardPresentationRuntime(localWorkspaceRoot);

      // Run A
      const resA = await presentationRuntime.processEvent({
        type: "DASHBOARD_PRESENTATION_REQUESTED",
        missionId: "MIS-PRES-REPLAY-A",
        districtName,
        expectedSourceHash: sourceHash
      });
      const hashA = resA.event?.presentationHash;

      // Run B
      const resB = await presentationRuntime.processEvent({
        type: "DASHBOARD_PRESENTATION_REQUESTED",
        missionId: "MIS-PRES-REPLAY-B",
        districtName,
        expectedSourceHash: sourceHash
      });
      const hashB = resB.event?.presentationHash;

      assert(hashA === hashB, "presentationHash must be identical across replays with identical inputs.");
      console.log("   ✓ Deterministic presentationHash verified.");
    }

    // ==========================================
    // 3. Invalid Input Isolation Test
    // ==========================================
    {
      const presentationRuntime = new DashboardPresentationRuntime(localWorkspaceRoot);

      // Run with mismatching sourceHash
      const resBadHash = await presentationRuntime.processEvent({
        type: "DASHBOARD_PRESENTATION_REQUESTED",
        missionId: "MIS-PRES-BADHASH",
        districtName,
        expectedSourceHash: "WRONG_SOURCE_HASH_VALUE_STRING"
      });
      assert(resBadHash.success === false, "Should fail when expectedSourceHash does not match.");
      assert(resBadHash.error?.includes("integrity check failed") === true, "Error message must report integrity failure.");

      // Run with missing file
      fs.unlinkSync(dashboardDataPath);
      const resMissingFile = await presentationRuntime.processEvent({
        type: "DASHBOARD_PRESENTATION_REQUESTED",
        missionId: "MIS-PRES-MISSING",
        districtName,
        expectedSourceHash: sourceHash
      });
      assert(resMissingFile.success === false, "Should fail when input dashboard-data.json does not exist.");

      console.log("   ✓ Invalid Input Isolation verified.");
    }

    // ==========================================
    // 4. Adapter Swapping Test
    // ==========================================
    {
      // Re-generate intermediate file first
      await dataRuntime.processEvent({
        type: "DASHBOARD_DATA_REQUESTED",
        missionId: "MIS-PRES-PRE",
        districtName
      });

      const cloudAdapter = new MockCloudDeploymentAdapter();
      const presentationRuntime = new DashboardPresentationRuntime(localWorkspaceRoot, cloudAdapter);

      const res = await presentationRuntime.processEvent({
        type: "DASHBOARD_PRESENTATION_REQUESTED",
        missionId: "MIS-PRES-CLOUD",
        districtName,
        expectedSourceHash: sourceHash
      });

      assert(res.success === true, "Swapped adapter deploy should succeed");
      assert(res.event?.publicUrl.startsWith("https://storage.googleapis.com/") === true, "URL must reflect swapped provider location");
      assert(cloudAdapter.lastDeployedArtifact !== null, "Artifact must have been sent to the swapped adapter");
      assert(cloudAdapter.lastDeployedArtifact?.lineage.outputHash === outputHash, "Lineage checks passed inside swapped artifact");

      console.log("   ✓ Adapter Swapping (Plugin-ready points) verified.");
    }

    console.log("\n==========================================");
    console.log("🎉 DASHBOARD PRESENTATION RUNTIME PASSED");
    console.log("==========================================\n");

  } finally {
    // Teardown
    if (fs.existsSync(researchPath)) fs.unlinkSync(researchPath);
    if (fs.existsSync(deploymentPath)) fs.unlinkSync(deploymentPath);
    if (fs.existsSync(activationPath)) fs.unlinkSync(activationPath);
    if (fs.existsSync(dashboardDataPath)) fs.unlinkSync(dashboardDataPath);
    if (fs.existsSync(publicDataPath)) fs.unlinkSync(publicDataPath);
    if (originalRegistryContent) {
      fs.writeFileSync(registryPath, originalRegistryContent, "utf-8");
    } else if (fs.existsSync(registryPath)) {
      fs.unlinkSync(registryPath);
    }
  }
}

runTest().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
