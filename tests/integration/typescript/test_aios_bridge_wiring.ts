import { AIOSBridgeProvider } from '../../../src/foundation/bridge/AIOSBridgeProvider';
import { AIOSBridgeMode } from '../../../src/foundation/bridge/AIOSBridgeMode';
import { BridgeMessage } from '../../../src/foundation/bridge/BridgeMessage';
import { CapabilityResolver } from '../../../src/foundation/bridge/CapabilityResolver';
import { VerificationCapabilityType } from '../../../../../sdk/verification/VerificationCapabilityModel';
import { ExecutionTaskPriority } from '../../../../../sdk/execution/ExecutionTaskModel';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('POSTING MAP AIOS Bridge Runtime Wiring Integration Test');
  console.log('========================================================\n');

  // 1. Test Capability Resolution
  console.log('[Test 1] Capability & Priority Resolution Mapping Test...');
  const orderMsg = new BridgeMessage({
    messageId: 'msg-order-001',
    messageType: 'ORDER_CREATED',
    timestamp: Date.now(),
    source: 'POSTING_MAP',
    destination: 'AIOS',
    payload: { title: 'Order Intake', districtName: '三重第3区' }
  });
  const orderResolved = CapabilityResolver.resolve(orderMsg);
  assert(orderResolved.priority === ExecutionTaskPriority.HIGH, 'ORDER_CREATED must resolve to HIGH priority');
  assert(orderResolved.capabilities.includes(VerificationCapabilityType.API_ACCESS), 'ORDER_CREATED requires API_ACCESS');

  const gpsMsg = new BridgeMessage({
    messageId: 'msg-gps-001',
    messageType: 'GPS_EVIDENCE_REJECTED',
    timestamp: Date.now(),
    source: 'POSTING_MAP',
    destination: 'AIOS',
    payload: { title: 'GPS Anomaly', reason: 'Location offset' }
  });
  const gpsResolved = CapabilityResolver.resolve(gpsMsg);
  assert(gpsResolved.priority === ExecutionTaskPriority.HIGH, 'GPS_EVIDENCE_REJECTED must resolve to HIGH priority');
  assert(
    gpsResolved.capabilities.includes(VerificationCapabilityType.BROWSER_AUTOMATION),
    'GPS_EVIDENCE_REJECTED requires BROWSER_AUTOMATION'
  );
  console.log(' -> Capability Resolution PASSED.');

  // 2. Test STUB Mode (BRIDGE_MODE=STUB)
  console.log('\n[Test 2] BRIDGE_MODE=STUB Verification Test...');
  const stubProvider = new AIOSBridgeProvider(AIOSBridgeMode.STUB);
  const stubMessage = new BridgeMessage({
    messageId: 'msg-stub-100',
    messageType: 'DISTRIBUTION_ACTIVITY_COMPLETED',
    timestamp: Date.now(),
    source: 'POSTING_MAP',
    destination: 'AIOS',
    payload: { activityId: 'act-001', staffNo: 'S102' }
  });

  const stubResult = stubProvider.send(stubMessage);
  assert(stubResult.success === true, 'Stub delivery must return success');
  assert(stubResult.response !== null, 'Stub response must exist');
  assert(stubResult.response?.payload?.status === 'PROPOSAL_RECEIVED', 'Stub response status must be PROPOSAL_RECEIVED');
  assert(
    Boolean(stubResult.response?.payload?.details?.includes('MockAIOSClient')),
    'Stub response must be handled by MockAIOSClient'
  );
  console.log(' -> STUB Mode Test PASSED.');

  // 3. Test LIVE Mode (BRIDGE_MODE=LIVE via ProjectBridgeRuntime)
  console.log('\n[Test 3] BRIDGE_MODE=LIVE Verification Test (ProjectBridgeRuntime)...');
  const liveProvider = new AIOSBridgeProvider(AIOSBridgeMode.LIVE);
  const liveMessage = new BridgeMessage({
    messageId: 'msg-live-200',
    messageType: 'GPS_EVIDENCE_REJECTED',
    timestamp: Date.now(),
    source: 'POSTING_MAP',
    destination: 'AIOS',
    payload: { title: 'GPS Rejection Investigation', activityId: 'act-999', reason: 'Unmatched route' }
  });

  const liveResult = liveProvider.send(liveMessage);
  assert(liveResult.success === true, 'LIVE mode delivery must return success');
  assert(liveResult.response !== null, 'LIVE mode response must exist');
  assert(liveResult.response?.messageType === 'GPS_EVIDENCE_REJECTED.reply', 'Reply messageType must match .reply');

  const taskId = liveResult.response?.payload?.taskId;
  assert(typeof taskId === 'string' && taskId.length > 0, 'LIVE response must contain valid taskId from AIOS ProjectBridge');
  assert(
    liveResult.response?.payload?.completed === true,
    'LIVE response must acknowledge ProjectBridgeRuntime completion'
  );
  assert(
    Array.isArray(liveResult.response?.payload?.producedArtifacts),
    'LIVE response must return producedArtifacts array from Workflow execution'
  );
  console.log(' -> LIVE Mode Test PASSED.');

  // 4. Test ORDER_CREATED Event Transmission via Pipeline (FLAG_BRIDGE_MODE=LIVE)
  console.log('\n[Test 4] Pipeline ORDER_CREATED Real Event Transmission Test (FLAG_BRIDGE_MODE=LIVE)...');
  const pipelineProvider = new AIOSBridgeProvider(AIOSBridgeMode.LIVE);
  const orderEventMsg = new BridgeMessage({
    messageId: 'msg-order-live-999',
    messageType: 'ORDER_CREATED',
    timestamp: Date.now(),
    source: 'POSTING_MAP',
    destination: 'AIOS',
    payload: { title: 'Election Poster Dispatch Order Mie District 3', districtId: 'mie-03' }
  });

  const orderResult = pipelineProvider.send(orderEventMsg);
  assert(orderResult.success === true, 'ORDER_CREATED delivery must return success');
  const orderTaskId = orderResult.response?.payload?.taskId;
  assert(typeof orderTaskId === 'string' && orderTaskId.length > 0, 'Response must contain valid taskId');
  assert(orderResult.response?.payload?.completed === true, 'ORDER_CREATED task must complete via AIOS Supervisor');
  console.log(' -> Pipeline ORDER_CREATED Test PASSED.');

  console.log('\n========================================================');
  console.log('ALL AIOS Bridge Wiring Integration Tests PASSED!');
  console.log('========================================================');
}


runTests().catch((err) => {
  console.error('\n[Test Failure]', err);
  process.exit(1);
});
