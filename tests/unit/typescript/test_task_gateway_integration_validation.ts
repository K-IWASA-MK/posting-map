import { AiosGatewayBridge } from '../../../src/foundation/gateway/AiosGatewayBridge';
import { TaskGateway } from '../../../../../sdk/gateway/TaskGateway';

async function runTaskGatewayIntegrationValidation() {
  console.log("==================================================");
  console.log("  TASK-POSTINGMAP-002A: TASK GATEWAY VALIDATION   ");
  console.log("==================================================");

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

  // Item 1: Entry Point Validation
  console.log("\n--- Item 1: Entry Point Validation ---");
  const actionsToTest = ['submitDistribution', 'getDashboardData', 'registerStaff', 'getRanking', 'unknown_action'];
  actionsToTest.forEach(act => {
    const res = AiosGatewayBridge.acceptRequest(act, { sample: 123 });
    assertTrue(`Entry Point routed for action '${act}'`, res !== null && res.contract !== undefined);
  });

  // Item 2: TaskContract Validation (SSOT & Immutability)
  console.log("\n--- Item 2: TaskContract Validation ---");
  const res2 = AiosGatewayBridge.acceptRequest('submitDistribution', { staffId: 'ST-01', rowId: 10 });
  assertTrue("Result is Object.frozen", Object.isFrozen(res2));
  assertTrue("TaskContract is Object.frozen", Object.isFrozen(res2.contract));
  assertTrue("TaskId is non-empty string", typeof res2.contract.taskId === 'string' && res2.contract.taskId.length > 0);
  assertEqual("Metadata source is POSTING_MAP_API", res2.contract.ceoDecision.metadata?.source, 'POSTING_MAP_API');

  // Item 3: Workflow Validation
  console.log("\n--- Item 3: Workflow Validation ---");
  assertTrue("WorkflowProfile is attached", res2.contract.workflowProfile !== undefined);
  assertTrue("WorkflowProfile contains stages", res2.contract.workflowProfile.stages.length > 0);

  // Item 4: Business Flow Validation
  console.log("\n--- Item 4: Business Flow Validation ---");
  const businessActions = ['submitDistribution', 'getDashboardData', 'login', 'dashboard', 'statistics'];
  businessActions.forEach(bAct => {
    const bRes = AiosGatewayBridge.acceptRequest(bAct, { testKey: 'val' });
    assertTrue(`Business Flow '${bAct}' successfully accepted by TaskGateway`, bRes.contract.intent !== undefined);
  });

  // Item 5: Backward Compatibility Validation
  console.log("\n--- Item 5: Backward Compatibility Validation ---");
  const compatPayload = { staffId: 'ST-99', areaId: 'AREA-1', rowId: 1, count: 5 };
  const compatRes = AiosGatewayBridge.acceptRequest('submitDistribution', compatPayload);
  assertEqual("Compat Payload action preserved", compatRes.contract.ceoDecision.metadata?.action, 'submitDistribution');
  assertEqual("Compat Payload staffId preserved", compatRes.contract.ceoDecision.metadata?.staffId, 'ST-99');

  // Item 6: Error Path Validation
  console.log("\n--- Item 6: Error Path Validation ---");
  const emptyRes = AiosGatewayBridge.acceptRequest('', {});
  assertTrue("Empty action correctly handled without throw", emptyRes.contract !== undefined);
  const badParamRes = AiosGatewayBridge.acceptRequest('invalid', { badData: null });
  assertTrue("Invalid params correctly handled without throw", badParamRes.contract !== undefined);

  // Item 7: Performance Validation
  console.log("\n--- Item 7: Performance Validation ---");
  const iterations = 1000;
  const startMs = Date.now();
  for (let i = 0; i < iterations; i++) {
    AiosGatewayBridge.acceptRequest('benchmark_action', { iter: i });
  }
  const totalMs = Date.now() - startMs;
  const avgMs = totalMs / iterations;
  console.log(`[PERF] Total time for ${iterations} requests: ${totalMs} ms (Avg: ${avgMs.toFixed(4)} ms/req)`);
  assertTrue("Performance overhead is < 1ms per request", avgMs < 1.0);

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTaskGatewayIntegrationValidation().catch(err => {
  console.error("Validation execution failed:", err);
  process.exit(1);
});
