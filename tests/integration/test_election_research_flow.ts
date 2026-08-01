import * as fs from "fs";
import * as path from "path";
import { ElectionResearchRuntime, ResearchRequestedEvent } from "../../src/platform/election-research-runtime/ElectionResearchRuntime";
import { ResearchValidator } from "../../src/platform/election-research-runtime/ResearchValidator";
import { PostingMapPathResolver } from "../../src/shared/PostingMapPathResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Election Research Foundation Integration Test...\n");

  const localWorkspaceRoot = path.join(__dirname, "..", "..", "..", "..");
  const pathResolver = new PostingMapPathResolver(localWorkspaceRoot);
  
  // Test Case 1: Tokyo 18th normal resolution and event compilation
  {
    const runtime = new ElectionResearchRuntime(localWorkspaceRoot);
    const event: ResearchRequestedEvent = {
      type: "RESEARCH_REQUESTED",
      missionId: "MIS-TEST-RES-001",
      districtName: "東京第18区"
    };

    const res = await runtime.processEvent(event);
    assert(res.success === true, "Tokyo 18th research resolution should succeed.");
    assert(res.event !== undefined, "Completed event must be returned.");
    
    const outputEvent = res.event!;
    assert(outputEvent.type === "ELECTION_RESEARCH_COMPLETED", "Event type must be ELECTION_RESEARCH_COMPLETED");
    assert(outputEvent.districtId === "TOKYO-18", "District ID must be TOKYO-18");
    assert(outputEvent.result.path === "03_BRANCH/東京第18区/election-research-result.json", "Output json file path must match target");
    assert(typeof outputEvent.result.checksum === "string" && outputEvent.result.checksum.length === 64, "SHA-256 checksum must be a 64-char hex string");

    const outputJsonPath = path.join(pathResolver.getBranchDirectory("東京第18区"), "election-research-result.json");
    assert(fs.existsSync(outputJsonPath) === true, "Compiled JSON file must be generated.");
    
    const resultObj = JSON.parse(fs.readFileSync(outputJsonPath, "utf-8"));
    assert(resultObj.district.id === "TOKYO-18", "JSON district.id matches TOKYO-18");
    assert(resultObj.municipalities.length === 3, "JSON must contain武蔵野市, 小金井市, 西東京市");
    assert(resultObj.municipalities[0].name === "武蔵野市", "First municipality must be武蔵野市");
    assert(resultObj.municipalities[0].electionHistory.length > 0, "Turnout history must be populated");
    assert(resultObj.metadata.generatedBy === "AIOS ElectionResearchRuntime", "Metadata generatedBy must be valid");
    assert(resultObj.metadata.version === "v1", "Metadata version must be v1");

    console.log("   ✓ Tokyo 18th district resolved to TOKYO-18 and municipalities resolved.");
    console.log("   ✓ Municipalities' turnout history structure verified.");
  }

  // Test Case 2: Osaka 6th normal resolution
  {
    const runtime = new ElectionResearchRuntime(localWorkspaceRoot);
    const event: ResearchRequestedEvent = {
      type: "RESEARCH_REQUESTED",
      missionId: "MIS-TEST-RES-002",
      districtName: "大阪第6区"
    };

    const res = await runtime.processEvent(event);
    assert(res.success === true, "Osaka 6th research resolution should succeed.");
    const outputEvent = res.event!;
    assert(outputEvent.districtId === "OSAKA-06", "District ID must be OSAKA-06");

    const outputJsonPath = path.join(pathResolver.getBranchDirectory("大阪第6区"), "election-research-result.json");
    assert(fs.existsSync(outputJsonPath) === true, "Compiled JSON file must be generated.");
    const resultObj = JSON.parse(fs.readFileSync(outputJsonPath, "utf-8"));
    assert(resultObj.municipalities.length === 4, "Osaka 6th has 4 municipalities.");
    assert(resultObj.municipalities[0].name === "守口市", "First municipality is 守口市");
    
    // 存在しない門真市や旭区、鶴見区については空配列で返ってくることの検証
    assert(resultObj.municipalities[1].name === "門真市", "Second municipality should be 門真市");
    assert(resultObj.municipalities[1].electionHistory.length === 0, "Missing turnout records must fallback to empty array");

    console.log("   ✓ Osaka 6th resolved and missing municipal histories fall back to empty arrays.");
  }

  // Test Case 3: Responsibility Boundary and forbidden key validation
  {
    const validator = new ResearchValidator();
    
    // OKデータの検証
    const safeData = {
      district: { id: "TOKYO-18", name: "東京第18区" },
      municipalities: [{ name: "武蔵野市", electionHistory: [] }]
    };
    assert(validator.validate(safeData) === true, "Safe data should pass validator");

    // NGデータ（計画系キー混入）
    const badDataPlan = {
      district: { id: "TOKYO-18", name: "東京第18区" },
      route: ["PathA", "PathB"] // 禁止キー
    };
    assert(validator.validate(badDataPlan) === false, "Data containing 'route' must be blocked");

    // NGデータ（戦略系キー混入）
    const badDataStrategy = {
      district: { id: "TOKYO-18", name: "東京第18区" },
      prediction: "Candidate A wins" // 禁止キー
    };
    assert(validator.validate(badDataStrategy) === false, "Data containing 'prediction' must be blocked");

    console.log("   ✓ Strict validator blocks strategic/routing decision properties successfully.");
  }

  // クリーンアップ
  const cleanupPaths = [
    path.join(pathResolver.getBranchDirectory("東京第18区"), "election-research-result.json"),
    path.join(pathResolver.getBranchDirectory("大阪第6区"), "election-research-result.json")
  ];
  for (const p of cleanupPaths) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }

  console.log("\n==========================================");
  console.log("🎉 ELECTION RESEARCH RUNTIME TEST PASSED");
  console.log("==========================================\n");
}

runTest().catch(err => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
