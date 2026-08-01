import { OrderRuntime } from '../../src/platform/order-runtime/OrderRuntime';
import { RootResolver } from '../../../../tools/review/RootResolver';
import { PostingMapPathResolver } from '../../src/shared/PostingMapPathResolver';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Order Runtime Integration Test...\n");

  process.env.NODE_ENV = 'test';
  process.env.AIOS_MOCK = 'true';
  const pathResolver = new PostingMapPathResolver();

  const order = {
    orderId: "ORD-TEST-001",
    districtName: "東京第18区",
    customerType: "branch",
    requestedAt: "2026-07-18"
  };

  try {
    const result = await OrderRuntime.processOrder(order);
    
    assert(result.success === true, "Order runtime execution must succeed.");
    assert(typeof result.missionId === 'string', "Mission ID should be returned.");
    assert(result.missionId!.startsWith("MIS-ORD-TEST-001-"), "Mission ID pattern mismatch.");

    // Check if research-result.json was generated locally in the mock directory
    const resultPath = path.join(pathResolver.getBranchDirectory('東京第18区'), 'research-result.json');
    
    assert(fs.existsSync(resultPath), "research-result.json must be written to the branch directory.");
    
    const content = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert(content.districtName === "東京第18区", "districtName in result must be '東京第18区'.");
    assert(Array.isArray(content.municipalities), "municipalities must be an array.");
    assert(content.municipalities.includes("武蔵野市"), "municipalities must contain '武蔵野市'.");
    assert(content.municipalities.includes("小金井市"), "municipalities must contain '小金井市'.");
    assert(content.municipalities.includes("西東京市"), "municipalities must contain '西東京市'.");

    console.log("   ✓ Local research-result.json validation passed.");
    console.log("\n==========================================");
    console.log("🎉 ORDER-TO-RESEARCH INTEGRATION TEST PASSED");
    console.log("==========================================");

  } catch (err: any) {
    console.error(`\n❌ Test failed: ${err.message}`);
    process.exit(1);
  }
}

runTest();
