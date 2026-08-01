import { AiosGatewayBridge } from '../../../src/foundation/gateway/AiosGatewayBridge';
import { TaskGateway } from '../../../../../sdk/gateway/TaskGateway';

async function runAiosGatewayBridgeTests() {
  console.log("=== Running AIOS Gateway Bridge Integration Tests ===");

  let passed = 0;
  let failed = 0;

  function assertEqual(name: string, actual: any, expected: any) {
    if (actual === expected) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - Expected ${expected} but got ${actual}`);
      failed++;
    }
  }

  function assertTrue(name: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - Expected condition to be true`);
      failed++;
    }
  }

  // Test 1: TaskGateway FIRST_PRINCIPLE Constitutional Check
  assertTrue(
    "Test 1: TaskGateway FIRST_PRINCIPLE is non-empty string",
    typeof TaskGateway.FIRST_PRINCIPLE === 'string' && TaskGateway.FIRST_PRINCIPLE.length > 0
  );

  // Test 2: Bridge routes request through TaskGateway
  const action = 'submitDistribution';
  const payload = { staffId: 'STAFF-101', areaId: 'MIE-03-AREA-1', count: 10 };
  const result = AiosGatewayBridge.acceptRequest(action, payload);

  assertTrue("Test 2: Result returned from TaskGateway", result !== null && typeof result === 'object');
  assertTrue("Test 2: Result contains frozen contract", result.contract !== undefined && Object.isFrozen(result.contract));
  assertTrue("Test 2: Contract contains valid taskId", typeof result.contract.taskId === 'string' && result.contract.taskId.length > 0);
  assertTrue("Test 2: Contract contains valid workflowProfile", result.contract.workflowProfile !== undefined);
  assertEqual("Test 2: Contract contains correct metadata source", result.contract.ceoDecision.metadata?.source, 'POSTING_MAP_API');

  // Test 3: Immutability and SSOT Verification (Bridge does not mutate or recreate contract)
  assertTrue("Test 3: TaskGatewayResult is completely frozen", Object.isFrozen(result));
  assertTrue("Test 3: Contract is completely frozen", Object.isFrozen(result.contract));

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAiosGatewayBridgeTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
