import { SubscriptionApplicationService } from '@application/subscription/SubscriptionApplicationService';
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
  public db = new Map<string, WorkspaceSubscription>();

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
    return undefined;
  }
  async findByLineUserId(lineUserId: string): Promise<Staff | undefined> {
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
  console.log('[Test SubscriptionApplicationService] Starting subscription lifecycle verification tests...');

  const subRepo = new MockWorkspaceSubscriptionRepository();
  const staffRepo = new MockStaffRepository();
  const service = new SubscriptionApplicationService(subRepo);
  const gate = new WorkspaceSubscriptionGate(subRepo, staffRepo);

  const workspaceId = 'WS-MIE-03';

  // 1. Initial State: Register ACTIVE subscription
  const expiresAt = new Date('2026-12-31T23:59:59.000Z');
  await service.updateSubscription(workspaceId, 'ACTIVE', expiresAt);

  const subDto = await service.getSubscription(workspaceId);
  assert(subDto !== undefined, 'Subscription should be registered');
  assert(subDto!.status === 'ACTIVE', 'Status must be ACTIVE');
  assert(subDto!.expiresAt === expiresAt.toISOString(), 'Expiry date mismatch');

  // Verify access via Gate: should pass
  try {
    const req = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-MIE-03',
      version: 'v2',
      requestId: 'req-active-test',
      pathParams: { id: 'WS-MIE-03' }
    });
    await gate.pass(req);
    console.log('Access ACTIVE state: PASSED (Allowed access)');
  } catch (e: any) {
    assert(false, `ACTIVE gate check failed: ${e.message}`);
  }

  // 2. State transition: Update status to SUSPENDED
  await service.updateSubscription(workspaceId, 'SUSPENDED', expiresAt);

  const suspendedDto = await service.getSubscription(workspaceId);
  assert(suspendedDto!.status === 'SUSPENDED', 'Status must be updated to SUSPENDED');

  // Verify access via Gate: should throw 403 SubscriptionException (PM-SUB-001)
  try {
    const req = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-MIE-03',
      version: 'v2',
      requestId: 'req-suspended-test',
      pathParams: { id: 'WS-MIE-03' }
    });
    await gate.pass(req);
    assert(false, 'Suspended subscription should be blocked');
  } catch (e: any) {
    assert(e instanceof SubscriptionException, 'Expected SubscriptionException');
    assert(e.code === 'PM-SUB-001', `Expected PM-SUB-001, got ${e.code}`);
    console.log('Access SUSPENDED state: PASSED (Blocked with PM-SUB-001)');
  }

  // 3. Reactivation: Update status back to ACTIVE
  await service.updateSubscription(workspaceId, 'ACTIVE', expiresAt);

  // Verify access via Gate: should pass again
  try {
    const req = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-MIE-03',
      version: 'v2',
      requestId: 'req-reactivated-test',
      pathParams: { id: 'WS-MIE-03' }
    });
    await gate.pass(req);
    console.log('Access REACTIVATED state: PASSED (Allowed access again)');
  } catch (e: any) {
    assert(false, `Reactivated gate check failed: ${e.message}`);
  }

  // 4. Listing verification
  const allSubs = await service.getAllSubscriptions();
  assert(allSubs.length === 1, 'Should have exactly 1 subscription in list');
  assert(allSubs[0].workspaceId === workspaceId, 'Workspace ID mismatch in list');

  console.log('[Test SubscriptionApplicationService] All lifecycle unit tests PASSED.');
}

runTests().catch(e => {
  console.error('[Test SubscriptionApplicationService] Test suite failed!');
  console.error(e);
  process.exit(1);
});
