import { WorkspaceApplicationService } from '@application/workspace/services/WorkspaceApplicationService';
import { WorkspaceIdGenerator } from '@application/workspace/services/WorkspaceIdGenerator';
import { IWorkspaceRepository } from '@domain/workspace/repositories/IWorkspaceRepository';
import { IWorkspaceSubscriptionRepository } from '@domain/workspace/repositories/IWorkspaceSubscriptionRepository';
import { Workspace } from '@domain/workspace/entities/Workspace';
import { WorkspaceSubscription } from '@domain/workspace/entities/WorkspaceSubscription';
import { WorkspaceUrl } from '@domain/workspace/valueobjects/WorkspaceUrl';

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
  console.log('[Test WorkspaceApplicationService] Starting unit tests...');

  // 1. Test WorkspaceIdGenerator
  console.log('  Testing WorkspaceIdGenerator...');
  assert(WorkspaceIdGenerator.generate('三重県 第4支部') === 'mie-04', 'Should parse Mie 04');
  assert(WorkspaceIdGenerator.generate('東京都 第二支部') === 'tokyo-02', 'Should parse Tokyo 02 (kanji)');
  assert(WorkspaceIdGenerator.generate('大阪府 第１支部') === 'osaka-01', 'Should parse Osaka 01 (full-width)');
  assert(WorkspaceIdGenerator.generate('愛知県 第14支部') === 'aichi-14', 'Should parse Aichi 14 (no padding needed)');
  
  const fallbackId = WorkspaceIdGenerator.generate('不明な支部');
  assert(fallbackId.startsWith('workspace-'), 'Fallback ID should start with workspace-');

  // Initialize service
  const wsRepo = new MockWorkspaceRepository();
  const subRepo = new MockWorkspaceSubscriptionRepository();
  const service = new WorkspaceApplicationService(wsRepo, subRepo);

  // 2. Test Workspace creation & initial goal
  console.log('  Testing createWorkspace and default goal...');
  const dto = await service.createWorkspace('三重県 第3支部');
  assert(dto.workspaceId === 'mie-03', 'Generated ID should be mie-03');
  assert(dto.workspaceName === '三重県 第3支部', 'Name should match');
  assert(dto.status === 'ACTIVE', 'Subscription should be ACTIVE');
  assert(dto.distributionGoal === null, 'Goal should be null initially');
  assert(dto.goalUpdatedAt === null, 'Goal updated at should be null initially');
  assert(dto.goalUpdatedBy === null, 'Goal updated by should be null initially');

  // 3. Test Goal setting & updating
  console.log('  Testing updateWorkspaceGoal...');
  const updatedDto = await service.updateWorkspaceGoal('mie-03', 5000, 'manager@mie.example.com');
  assert(updatedDto.distributionGoal === 5000, 'Goal should be updated to 5000');
  assert(updatedDto.goalUpdatedBy === 'manager@mie.example.com', 'Goal updated by should match');
  assert(updatedDto.goalUpdatedAt !== null, 'Goal updated at should not be null');

  // Verify stored goal state
  const storedWs = await wsRepo.findById('mie-03');
  assert(storedWs !== undefined, 'Workspace should be stored');
  assert(storedWs!.getDistributionGoal() === 5000, 'Stored goal should be 5000');
  assert(storedWs!.getGoalUpdatedBy() === 'manager@mie.example.com', 'Stored updated by should match');

  // 4. Test Goal update to another value
  console.log('  Testing overwrite goal update...');
  const reUpdatedDto = await service.updateWorkspaceGoal('mie-03', 7500, 'admin@mie.example.com');
  assert(reUpdatedDto.distributionGoal === 7500, 'Goal should be updated to 7500');
  assert(reUpdatedDto.goalUpdatedBy === 'admin@mie.example.com', 'Goal updated by should match admin');
  
  // 5. Test Workspace Separation (Goal is separate)
  console.log('  Testing goal separation between multiple workspaces...');
  const dto2 = await service.createWorkspace('三重県 第4支部');
  assert(dto2.workspaceId === 'mie-04', 'Workspace 2 ID should be mie-04');
  assert(dto2.distributionGoal === null, 'Workspace 2 goal should be null');

  // Update workspace 2 goal
  const updatedDto2 = await service.updateWorkspaceGoal('mie-04', 3000, 'another@mie.example.com');
  assert(updatedDto2.distributionGoal === 3000, 'Workspace 2 goal should be 3000');
  
  // Re-fetch workspace 1 to verify it is untouched
  const finalWs1Dto = await service.getWorkspace('mie-03');
  assert(finalWs1Dto.distributionGoal === 7500, 'Workspace 1 goal should remain 7500');

  // 6. Test duplicate ID suffix incrementation (preserving onboarding behavior)
  console.log('  Testing duplicate ID suffix logic...');
  const duplicateDto = await service.createWorkspace('三重県 第3支部');
  assert(duplicateDto.workspaceId === 'mie-03-2', 'Should append suffix for duplicate: mie-03-2');
  
  // 7. Test activate and suspend Workspace
  console.log('  Testing activation and suspension...');
  await service.suspendWorkspace('mie-03');
  const suspendedSub = await subRepo.findByWorkspaceId('mie-03');
  assert(suspendedSub!.getStatus() === 'SUSPENDED', 'Status should be updated to SUSPENDED');

  await service.activateWorkspace('mie-03');
  const activeSub = await subRepo.findByWorkspaceId('mie-03');
  assert(activeSub!.getStatus() === 'ACTIVE', 'Status should be updated to ACTIVE');

  console.log('[Test WorkspaceApplicationService] All unit tests PASSED.');
}

runTests().catch(e => {
  console.error('[Test WorkspaceApplicationService] Test suite failed!');
  console.error(e);
  process.exit(1);
});
