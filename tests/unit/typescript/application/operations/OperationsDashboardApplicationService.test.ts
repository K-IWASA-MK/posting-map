import { OperationsDashboardApplicationService } from '@application/operations/services/OperationsDashboardApplicationService';
import { IWorkspaceRepository } from '@domain/workspace/repositories/IWorkspaceRepository';
import { IWorkspaceSubscriptionRepository } from '@domain/workspace/repositories/IWorkspaceSubscriptionRepository';
import { Workspace } from '@domain/workspace/entities/Workspace';
import { WorkspaceSubscription } from '@domain/workspace/entities/WorkspaceSubscription';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockWorkspaceRepository implements IWorkspaceRepository {
  public db = new Map<string, Workspace>();

  async findById(id: string): Promise<Workspace | undefined> {
    return this.db.get(id);
  }

  async findAll(): Promise<Workspace[]> {
    return Array.from(this.db.values());
  }

  async save(workspace: Workspace): Promise<void> {
    this.db.set(workspace.workspaceId, workspace);
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

async function runTests() {
  console.log('[Test OperationsDashboardApplicationService] Starting unit tests...');

  const wsRepo = new MockWorkspaceRepository();
  const subRepo = new MockWorkspaceSubscriptionRepository();
  const service = new OperationsDashboardApplicationService(wsRepo, subRepo);

  // Setup mock workspaces
  const ws1 = new Workspace({ workspaceId: 'mie-1', workspaceName: '三重県 第1支部', status: 'ACTIVE' });
  const ws2 = new Workspace({ workspaceId: 'mie-2', workspaceName: '三重県 第2支部', status: 'ACTIVE' });
  const ws3 = new Workspace({ workspaceId: 'mie-3', workspaceName: '三重県 第3支部', status: 'ACTIVE' });
  await wsRepo.save(ws1);
  await wsRepo.save(ws2);
  await wsRepo.save(ws3);

  const now = new Date();
  
  // subscription 1: Expires in 10 days
  const expiresAt1 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const sub1 = new WorkspaceSubscription({
    workspaceId: 'mie-1',
    status: 'ACTIVE',
    startedAt: now,
    expiresAt: expiresAt1
  });

  // subscription 2: Expired 2 days ago
  const expiresAt2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const sub2 = new WorkspaceSubscription({
    workspaceId: 'mie-2',
    status: 'SUSPENDED',
    startedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    expiresAt: expiresAt2
  });

  // subscription 3: No subscription row (will mock default INACTIVE)

  await subRepo.save(sub1);
  await subRepo.save(sub2);

  const overview = await service.getWorkspaceSubscriptionOverview();

  assert(overview.length === 3, `Expected 3 workspaces, got ${overview.length}`);

  // Validate workspace 1
  const ow1 = overview.find(o => o.workspaceId === 'mie-1');
  assert(ow1 !== undefined, 'Workspace mie-1 must be present');
  assert(ow1!.workspaceName === '三重県 第1支部', 'Workspace name mismatch');
  assert(ow1!.status === 'ACTIVE', 'Status mismatch');
  assert(ow1!.remainingDays === 10, `Expected 10 remaining days, got ${ow1!.remainingDays}`);

  // Validate workspace 2
  const ow2 = overview.find(o => o.workspaceId === 'mie-2');
  assert(ow2 !== undefined, 'Workspace mie-2 must be present');
  assert(ow2!.workspaceName === '三重県 第2支部', 'Workspace name mismatch');
  assert(ow2!.status === 'SUSPENDED', 'Status mismatch');
  assert(ow2!.remainingDays === 0, `Expected 0 remaining days for expired, got ${ow2!.remainingDays}`);

  // Validate workspace 3 (Default inactive fallback)
  const ow3 = overview.find(o => o.workspaceId === 'mie-3');
  assert(ow3 !== undefined, 'Workspace mie-3 must be present');
  assert(ow3!.status === 'INACTIVE', 'Status mismatch for non-existent subscription');
  assert(ow3!.remainingDays === 0, 'Remaining days for non-existent subscription should be 0');

  console.log('[Test OperationsDashboardApplicationService] All unit tests PASSED.');
}

runTests().catch(e => {
  console.error('[Test OperationsDashboardApplicationService] Test suite failed!');
  console.error(e);
  process.exit(1);
});
