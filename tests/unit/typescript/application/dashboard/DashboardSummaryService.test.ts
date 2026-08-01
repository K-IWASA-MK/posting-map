import { DashboardApplicationService } from '@application/dashboard/services/DashboardApplicationService';
import { IWorkspaceRepository } from '@domain/workspace/repositories/IWorkspaceRepository';
import { Workspace } from '@domain/workspace/entities/Workspace';
import { IStaffRepository } from '@domain/field/staff/repositories/IStaffRepository';
import { Staff } from '@domain/field/staff/entities/Staff';
import { IFlyerHoldingRepository } from '@domain/field/holding/repositories/IFlyerHoldingRepository';
import { FlyerHolding } from '@domain/field/holding/entities/FlyerHolding';
import { Quantity } from '@domain/field/valueobjects/Quantity';
import { Location } from '@domain/field/valueobjects/Location';
import { IActivityRepository } from '@domain/field/activity/repositories/IActivityRepository';
import { DistributionActivity } from '@domain/field/activity/entities/DistributionActivity';
import { YearMonth } from '../../../../../src/domain/common/valueobjects/YearMonth';

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
  async save(ws: Workspace): Promise<void> {
    this.db.set(ws.workspaceId, ws);
  }
}

class MockStaffRepository implements IStaffRepository {
  public db = new Map<string, Staff>();
  async findByStaffNo(staffNo: string): Promise<Staff | undefined> {
    return this.db.get(staffNo);
  }
  async findByLineUserId(lineUserId: string): Promise<Staff | undefined> {
    return Array.from(this.db.values()).find(s => s.lineUserId === lineUserId);
  }
  async findByWorkspace(workspaceId: string): Promise<Staff[]> {
    return Array.from(this.db.values()).filter(s => s.workspaceId === workspaceId);
  }
  async findNewStaffByMonth(workspaceId: string, yearMonth: YearMonth): Promise<Staff[]> {
    const start = yearMonth.getStartDate().getTime();
    const end = yearMonth.getEndDate().getTime();
    return Array.from(this.db.values()).filter(
      s => s.workspaceId === workspaceId && s.createdAt.getTime() >= start && s.createdAt.getTime() <= end
    );
  }
  async getNextStaffNo(workspaceId: string): Promise<string> {
    const nextNum = this.db.size + 1;
    return 'S' + String(nextNum).padStart(3, '0');
  }
  async findAll(): Promise<Staff[]> {
    return Array.from(this.db ? this.db.values() : []);
  }
  async save(staff: Staff): Promise<void> {
    this.db.set(staff.staffNo, staff);
  }
}

class MockHoldingRepository implements IFlyerHoldingRepository {
  public db = new Map<string, FlyerHolding>();
  async findByStaffNo(staffNo: string): Promise<FlyerHolding | undefined> {
    return this.db.get(staffNo);
  }
  async findAllRaw(): Promise<any[]> {
    return [];
  }
  async findAll(): Promise<FlyerHolding[]> {
    return Array.from(this.db ? this.db.values() : []);
  }
  async save(holding: FlyerHolding): Promise<void> {
    this.db.set(holding.staffNo, holding);
  }
  public async delete(staffNo: string): Promise<void> {
    this.db.delete(staffNo);
  }
}

class MockActivityRepository implements IActivityRepository {
  public db = new Map<string, DistributionActivity>();
  public async findById(id: string): Promise<DistributionActivity | undefined> { return undefined; }
  public activities: DistributionActivity[] = [];
  async findLatestByStaff(staffNo: string, limit: number): Promise<DistributionActivity[]> {
    return Array.from(this.db.values())
      .filter(a => a.staffNo === staffNo)
      .slice(0, limit);
  }
  async findByPeriod(start: Date, end: Date): Promise<DistributionActivity[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return Array.from(this.db.values()).filter(
      a => a.occurredAt.getTime() >= startTime && a.occurredAt.getTime() <= endTime
    );
  }
  async findByYearMonth(workspaceId: string, yearMonth: YearMonth): Promise<DistributionActivity[]> {
    const start = yearMonth.getStartDate().getTime();
    const end = yearMonth.getEndDate().getTime();
    return Array.from(this.db.values()).filter(
      a => a.occurredAt.getTime() >= start && a.occurredAt.getTime() <= end
    );
  }
  async findAll(): Promise<DistributionActivity[]> {
    return Array.from(this.db ? this.db.values() : []);
  }
  async save(activity: DistributionActivity): Promise<void> {
    this.db.set(activity.id, activity);
  }
}

async function runTests() {
  console.log('[Test DashboardSummaryService] Starting dashboard visual enhancement unit tests...');

  const wsRepo = new MockWorkspaceRepository();
  const staffRepo = new MockStaffRepository();
  const holdingRepo = new MockHoldingRepository();
  const activityRepo = new MockActivityRepository();

  const service = new DashboardApplicationService(wsRepo, staffRepo, holdingRepo, activityRepo);

  const workspaceId = 'WS-MIE-03';
  await wsRepo.save(new Workspace({
    workspaceId,
    workspaceName: '三重第3支部',
    status: 'ACTIVE'
  }));

  // Seed Staff (S001: registered in July, S002: registered in August (new))
  const registerJuly = new Date('2026-07-15T12:00:00.000Z');
  const registerAugust = new Date('2026-08-05T12:00:00.000Z');

  await staffRepo.save(new Staff({
    staffNo: 'S001',
    displayName: 'Aさん',
    lineUserId: 'line-A',
    workspaceId,
    createdAt: registerJuly
  }));

  await staffRepo.save(new Staff({
    staffNo: 'S002',
    displayName: 'Bさん',
    lineUserId: 'line-B',
    workspaceId,
    createdAt: registerAugust
  }));

  // Seed Holdings
  await holdingRepo.save(new FlyerHolding({
    staffNo: 'S001',
    quantity: new Quantity(3000),
    updatedAt: registerJuly
  }));

  await holdingRepo.save(new FlyerHolding({
    staffNo: 'S002',
    quantity: new Quantity(1500),
    updatedAt: registerAugust
  }));

  // Seed Activities (S001: July 2000 qty, August 3000 qty. S002: August 1000 qty (new))
  // S001 July Activity
  await activityRepo.save(new DistributionActivity({
    id: 'ACT-001',
    staffNo: 'S001',
    reportedQuantity: new Quantity(2000),
    photoUrl: 'http://a.jpg',
    location: new Location(34.0, 136.0, 0),
    occurredAt: new Date('2026-07-20T10:00:00.000Z')
  }));

  // S001 August Activities (two reports, different days: August 10 and August 12)
  await activityRepo.save(new DistributionActivity({
    id: 'ACT-002',
    staffNo: 'S001',
    reportedQuantity: new Quantity(1800),
    photoUrl: 'http://a.jpg',
    location: new Location(34.0, 136.0, 0),
    occurredAt: new Date('2026-08-10T10:00:00.000Z')
  }));

  await activityRepo.save(new DistributionActivity({
    id: 'ACT-003',
    staffNo: 'S001',
    reportedQuantity: new Quantity(1200),
    photoUrl: 'http://a.jpg',
    location: new Location(34.0, 136.0, 0),
    occurredAt: new Date('2026-08-12T10:00:00.000Z')
  }));

  // S002 August Activity (one report: August 8)
  await activityRepo.save(new DistributionActivity({
    id: 'ACT-004',
    staffNo: 'S002',
    reportedQuantity: new Quantity(1000),
    photoUrl: 'http://b.jpg',
    location: new Location(34.0, 136.0, 0),
    occurredAt: new Date('2026-08-08T10:00:00.000Z')
  }));

  // Execute Dashboard fetch for August 2026
  const dashboard = await service.getWorkspaceDashboard(workspaceId, '202608');

  // Verify properties
  assert(dashboard.workspaceName === '三重第3支部', 'Workspace name mismatch');
  assert(dashboard.memberCount === 2, 'Should have 2 members');
  assert(dashboard.newMemberCount === 1, 'Should have 1 new member in August');
  
  // Verify totals
  // S001 holding (3000) + S002 holding (1500) = 4500
  assert(dashboard.totalHoldingQuantity === 4500, `Expected total holding 4500, got ${dashboard.totalHoldingQuantity}`);
  // S001 August (1800 + 1200) + S002 August (1000) = 4000
  assert(dashboard.monthlyDistributionQuantity === 4000, `Expected monthly activities 4000, got ${dashboard.monthlyDistributionQuantity}`);
  
  // Verify previous month total (July S001 = 2000)
  assert(dashboard.previousMonthDistributionQuantity === 2000, `Expected July total 2000, got ${dashboard.previousMonthDistributionQuantity}`);

  // Growth rate calculation: ((4000 - 2000) / 2000) * 100 = +100%
  assert(dashboard.growthRate === '+100%', `Expected growthRate +100%, got ${dashboard.growthRate}`);

  // Verify New Members detail
  const newB = dashboard.newMembers.find(m => m.staffNo === 'S002');
  assert(newB !== undefined, 'S002 should be in new members');
  assert(newB!.registeredAt === '2026/08/05', 'Registration date mismatch');
  assert(newB!.firstActivityDate === '2026/08/08', `First activity date mismatch: expected 2026/08/08, got ${newB!.firstActivityDate}`);
  assert(newB!.holdingQuantity === 1500, 'New member holding mismatch');

  // Verify Rankings and ActivityIndex
  // S001 (A): quantity 3000. Unique days = 2 (August 10, August 12). isNew = false. Index = 3000 + (2 * 100) + 0 = 3200
  // S002 (B): quantity 1000. Unique days = 1 (August 8). isNew = true. Index = 1000 + (1 * 100) + 500 = 1600
  const rankA = dashboard.members.find(m => m.staffNo === 'S001');
  const rankB = dashboard.members.find(m => m.staffNo === 'S002');
  
  assert(rankA !== undefined, 'A should be in members');
  assert(rankA!.monthlyDistributionQuantity === 3000, 'A distribution quantity mismatch');
  assert(rankA!.activityDays === 2, 'A activity days mismatch');
  assert(rankA!.activityIndex === 3200, `A activityIndex mismatch: expected 3200, got ${rankA!.activityIndex}`);

  assert(rankB !== undefined, 'B should be in members');
  assert(rankB!.monthlyDistributionQuantity === 1000, 'B distribution quantity mismatch');
  assert(rankB!.activityDays === 1, 'B activity days mismatch');
  assert(rankB!.activityIndex === 1600, `B activityIndex mismatch: expected 1600, got ${rankB!.activityIndex}`);

  // Verify Ranking order is sorted by monthlyDistributionQuantity descending
  assert(dashboard.members[0].staffNo === 'S001', 'Rank 1 must be S001 (3000 qty)');
  assert(dashboard.members[1].staffNo === 'S002', 'Rank 2 must be S002 (1000 qty)');

  // Verify monthlyTrend (直近6ヶ月)
  // August 2026 back to March 2026
  assert(dashboard.monthlyTrend.length === 6, 'Trend must have exactly 6 months');
  assert(dashboard.monthlyTrend[5].month === '8月', 'Last element must be 8月');
  assert(dashboard.monthlyTrend[5].quantity === 4000, '8月 total mismatch');
  assert(dashboard.monthlyTrend[4].month === '7月', 'July must be 7月');
  assert(dashboard.monthlyTrend[4].quantity === 2000, 'July total mismatch');

  console.log('[Test DashboardSummaryService] All dashboard enhancement unit tests PASSED.');
}

runTests().catch(e => {
  console.error('[Test DashboardSummaryService] Tests failed!');
  console.error(e);
  process.exit(1);
});
