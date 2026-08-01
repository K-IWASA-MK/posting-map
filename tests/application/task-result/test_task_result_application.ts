import { 
  TaskResultSubscriber, 
  RepositoryUpdater, 
  DashboardProjectionUpdater, 
  NotificationPublisher, 
  AuditRecorder
} from '../../../src/application/task-result';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const repoUpdater = new RepositoryUpdater();
  const projUpdater = new DashboardProjectionUpdater();
  const notifPublisher = new NotificationPublisher();
  const auditRecorder = new AuditRecorder();
  const subscriber = new TaskResultSubscriber(repoUpdater, projUpdater, notifPublisher, auditRecorder);

  console.log('--- Starting Task Result Application Integration Tests ---');

  // Test 1: Successful Task Execution
  const successPayload = {
    taskId: 'task-100',
    executionId: 'exec-100',
    status: 'COMPLETED',
    completedAt: new Date(),
    metadata: { accuracy: 0.99 },
    payload: { recognizedAddresses: 15 }
  };

  let result = await subscriber.handleTaskCompletedEvent(successPayload);
  assert(result.repositoryUpdated === true, 'Repository update request generated successfully');
  assert(result.repositoryRequest?.taskId === 'task-100', 'Repository request has correct taskId');
  assert(result.dashboardProjected === true, 'Dashboard projection request generated successfully');
  assert(result.projectionRequest?.projectionType === 'AI_TASK_PROGRESS', 'Projection request has correct type');
  assert(result.notificationPublished === true, 'Notification request generated successfully');
  assert(result.notificationRequest?.eventType === 'TASK_COMPLETED_NOTIFICATION', 'Notification eventType is COMPLETED');
  assert(result.auditRecorded === true, 'Audit request generated successfully');
  assert(result.auditRequest?.eventType === 'TASK_COMPLETED', 'Audit eventType is TASK_COMPLETED');

  // Test 2: Failed Task Execution
  const failedPayload = {
    taskId: 'task-101',
    executionId: 'exec-101',
    status: 'FAILED',
    metadata: { errorReason: 'Timeout' }
  };

  result = await subscriber.handleTaskCompletedEvent(failedPayload);
  assert(result.notificationRequest?.eventType === 'TASK_FAILED_NOTIFICATION', 'Notification eventType is FAILED for failed status');
  assert(result.auditRequest?.eventType === 'TASK_FAILED', 'Audit eventType is TASK_FAILED');
  assert(result.repositoryRequest?.status === 'FAILED', 'Repository request preserves FAILED status');
  
  // Test 3: Cancelled Task Execution
  const cancelledPayload = {
    taskId: 'task-102',
    executionId: 'exec-102',
    status: 'CANCELLED',
  };

  result = await subscriber.handleTaskCompletedEvent(cancelledPayload);
  assert(result.notificationRequest?.eventType === 'TASK_STATUS_NOTIFICATION', 'Notification eventType is STATUS for CANCELLED');
  assert(result.auditRequest?.eventType === 'TASK_CANCELLED', 'Audit eventType is TASK_CANCELLED');

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
