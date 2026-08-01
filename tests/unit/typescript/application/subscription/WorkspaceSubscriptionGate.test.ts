import { WorkspaceSubscriptionGate } from '@application/subscription/WorkspaceSubscriptionGate';
import { IWorkspaceSubscriptionRepository } from '@domain/workspace/repositories/IWorkspaceSubscriptionRepository';
import { IStaffRepository } from '@domain/field/staff/repositories/IStaffRepository';
import { WorkspaceSubscription } from '@domain/workspace/entities/WorkspaceSubscription';
import { Staff } from '@domain/field/staff/entities/Staff';
import { ApiRequest } from '@core/api/ApiRequest';
import { SubscriptionException } from '@core/exceptions/SubscriptionException';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockWorkspaceSubscriptionRepository implements IWorkspaceSubscriptionRepository {
  private db = new Map<string, WorkspaceSubscription>();

  constructor() {
    // ACTIVE subscription
    this.db.set('WS-MIE-03', new WorkspaceSubscription({
      workspaceId: 'WS-MIE-03',
      status: 'ACTIVE',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000)
    }));

    // SUSPENDED subscription
    this.db.set('WS-SUSPENDED', new WorkspaceSubscription({
      workspaceId: 'WS-SUSPENDED',
      status: 'SUSPENDED',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000)
    }));
  }

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscription | undefined> {
    return this.db.get(workspaceId);
  }

  async findAll(): Promise<WorkspaceSubscription[]> {
    return Array.from(this.db.values());
  }

  async save(subscription: WorkspaceSubscription): Promise<void> {
    this.db.set(subscription.workspaceId, subscription);
  }

  async create(subscription: WorkspaceSubscription): Promise<void> {
    this.db.set(subscription.workspaceId, subscription);
  }
}

class MockStaffRepository implements IStaffRepository {
  async findByStaffNo(staffNo: string): Promise<Staff | undefined> {
    if (staffNo === 'S001') {
      return new Staff({
        staffNo: 'S001',
        displayName: 'Aさん',
        lineUserId: 'line-A',
        workspaceId: 'WS-MIE-03',
        createdAt: new Date()
      });
    }
    if (staffNo === 'S-SUSPENDED') {
      return new Staff({
        staffNo: 'S-SUSPENDED',
        displayName: 'Suspended Staff',
        lineUserId: 'line-suspended',
        workspaceId: 'WS-SUSPENDED',
        createdAt: new Date()
      });
    }
    return undefined;
  }

  async findByLineUserId(lineUserId: string): Promise<Staff | undefined> {
    if (lineUserId === 'line-A') {
      return this.findByStaffNo('S001');
    }
    if (lineUserId === 'line-suspended') {
      return this.findByStaffNo('S-SUSPENDED');
    }
    return undefined;
  }

  async findByWorkspace(workspaceId: string): Promise<Staff[]> {
    return [];
  }

  async findNewStaffByMonth(workspaceId: string, yearMonth: any): Promise<Staff[]> {
    return [];
  }

  async getNextStaffNo(workspaceId: string): Promise<string> {
    return 'S001';
  }

  async findAll(): Promise<Staff[]> {
    return [];
  }
  async save(staff: Staff): Promise<void> {}
}

async function runTests() {
  console.log('[Test WorkspaceSubscriptionGate] Starting unit tests...');

  const subRepo = new MockWorkspaceSubscriptionRepository();
  const staffRepo = new MockStaffRepository();
  const gate = new WorkspaceSubscriptionGate(subRepo, staffRepo);

  // 1. Valid ACTIVE Workspace passes
  try {
    const req = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-MIE-03',
      version: '1.0.0',
      requestId: 'test-req-id',
      pathParams: { id: 'WS-MIE-03' }
    });
    await gate.pass(req);
    console.log('Test 1: ACTIVE workspace pass: PASSED');
  } catch (e: any) {
    assert(false, `Test 1 failed: ${e.message}`);
  }

  // 2. SUSPENDED Workspace throws SubscriptionException (PM-SUB-001)
  try {
    const req = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-SUSPENDED',
      version: '1.0.0',
      requestId: 'test-req-id',
      pathParams: { id: 'WS-SUSPENDED' }
    });
    await gate.pass(req);
    assert(false, 'Test 2 should have thrown SubscriptionException');
  } catch (e: any) {
    assert(e instanceof SubscriptionException, `Expected SubscriptionException, got ${e.constructor.name}`);
    assert(e.code === 'PM-SUB-001', `Expected PM-SUB-001, got ${e.code}`);
    console.log('Test 2: SUSPENDED workspace block: PASSED');
  }

  // 3. Non-existent Workspace subscription throws SubscriptionException (PM-SUB-002)
  try {
    const req = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-NONEXISTENT',
      version: '1.0.0',
      requestId: 'test-req-id',
      pathParams: { id: 'WS-NONEXISTENT' }
    });
    await gate.pass(req);
    assert(false, 'Test 3 should have thrown SubscriptionException');
  } catch (e: any) {
    assert(e instanceof SubscriptionException, `Expected SubscriptionException, got ${e.constructor.name}`);
    assert(e.code === 'PM-SUB-002', `Expected PM-SUB-002, got ${e.code}`);
    console.log('Test 3: Non-existent workspace block: PASSED');
  }

  // 4. Resolve via lineUserId for ACTIVE staff passes
  try {
    const req = new ApiRequest({
      method: 'POST',
      path: '/field/reservation',
      version: '1.0.0',
      requestId: 'test-req-id',
      query: { lineUserId: 'line-A' }
    });
    await gate.pass(req);
    console.log('Test 4: Resolve via lineUserId ACTIVE: PASSED');
  } catch (e: any) {
    assert(false, `Test 4 failed: ${e.message}`);
  }

  // 5. Resolve via lineUserId for SUSPENDED staff blocks
  try {
    const req = new ApiRequest({
      method: 'POST',
      path: '/field/reservation',
      version: '1.0.0',
      requestId: 'test-req-id',
      query: { lineUserId: 'line-suspended' }
    });
    await gate.pass(req);
    assert(false, 'Test 5 should have thrown SubscriptionException');
  } catch (e: any) {
    assert(e instanceof SubscriptionException, `Expected SubscriptionException, got ${e.constructor.name}`);
    assert(e.code === 'PM-SUB-001', `Expected PM-SUB-001, got ${e.code}`);
    console.log('Test 5: Resolve via lineUserId SUSPENDED: PASSED');
  }

  console.log('[Test WorkspaceSubscriptionGate] All tests PASSED.');
}

runTests().catch(e => {
  console.error('[Test WorkspaceSubscriptionGate] Test suite failed!');
  console.error(e);
  process.exit(1);
});
