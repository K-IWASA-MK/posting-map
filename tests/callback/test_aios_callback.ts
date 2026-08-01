/**
 * test_aios_callback.ts
 * Unit & Integration tests for AIOS Callback Foundation.
 */
import { AIOSCallbackReceiver } from '../../src/integration/aios/callback/AIOSCallbackReceiver';
import { CallbackValidator } from '../../src/integration/aios/callback/CallbackValidator';
import { SharedSecretAuthenticator } from '../../src/integration/aios/callback/SharedSecretAuthenticator';
import { TaskResultHandler } from '../../src/application/callback/TaskResultHandler';
import { CallbackEvent, CallbackEventTypes } from '../../src/integration/aios/callback/CallbackEvent';
import { CallbackContext } from '../../src/integration/aios/callback/CallbackContext';


class MockEventBus {
  events: { name: string; payload: unknown }[] = [];
  publish(eventName: string, payload: unknown): void {
    this.events.push({ name: eventName, payload });
  }
}

class MockEventPublisher {
  events: CallbackEvent[] = [];
  publish(event: CallbackEvent): void {
    this.events.push(event);
  }
}

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

  const secret = 'test-secret';
  const authenticator = new SharedSecretAuthenticator(secret);
  const validator = new CallbackValidator(authenticator);
  const eventBus = new MockEventBus();
  const handler = new TaskResultHandler(eventBus);
  const publisher = new MockEventPublisher();

  const receiver = new AIOSCallbackReceiver(validator, handler, publisher);

  console.log('--- Starting AIOS Callback Receiver Tests ---');

  // Test 1: Successful Validation and Handling
  const validContext: CallbackContext = {
    requestId: 'req-123',
    receivedAt: new Date(),
    source: 'test',
    headers: { 'authorization': `Bearer ${secret}` }
  };
  const validPayload = {
    taskId: 'task-1',
    executionId: 'exec-1',
    status: 'COMPLETED',
    duration: 100,
    startedAt: new Date(),
    completedAt: new Date(),
    metadata: { version: 1 }
  };

  let res = await receiver.receive(validContext, validPayload);
  assert(res.statusCode === 200, 'Returns 200 on success');
  assert(res.accepted === true, 'Response is accepted on success');
  assert(publisher.events.length === 3, 'Publishes RECEIVED, VALIDATED, and ACCEPTED events');
  assert(publisher.events.some(e => e.type === CallbackEventTypes.TASK_RESULT_VALIDATED), 'Fired VALIDATED event');
  assert(eventBus.events.length === 1, 'EventBus received POSTINGMAP_TASK_COMPLETED event');
  assert((eventBus.events[0].payload as any).internalTaskId === 'task-1', 'Handler correctly mapped and forwarded payload');

  // Clear mocks
  publisher.events = [];
  eventBus.events = [];

  // Test 2: Authentication Failure
  const invalidAuthContext: CallbackContext = {
    requestId: 'req-401',
    receivedAt: new Date(),
    source: 'test',
    headers: { 'authorization': `Bearer wrong-secret` }
  };
  res = await receiver.receive(invalidAuthContext, validPayload);
  assert(res.statusCode === 401, 'Returns 401 on authentication failure');
  assert(res.accepted === false, 'Response is not accepted on failure');
  assert(publisher.events.some(e => e.type === CallbackEventTypes.TASK_RESULT_REJECTED), 'Fired REJECTED event on auth failure');
  assert(eventBus.events.length === 0, 'Handler not called on auth failure');

  // Clear mocks
  publisher.events = [];

  // Test 3: Validation Failure (Missing taskId)
  const invalidPayload = { ...validPayload };
  delete (invalidPayload as any).taskId;
  res = await receiver.receive(validContext, invalidPayload);
  assert(res.statusCode === 401, 'Returns 401 (or appropriate error code) on validation failure');
  assert(res.accepted === false, 'Response is not accepted on validation failure');
  assert(publisher.events.some(e => e.type === CallbackEventTypes.TASK_RESULT_REJECTED), 'Fired REJECTED event on validation failure');
  assert(eventBus.events.length === 0, 'Handler not called on validation failure');

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
