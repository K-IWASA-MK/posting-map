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
  public async findById(id: string): Promise<DistributionActivity | undefined> { return undefined; }
  public activities: DistributionActivity[] = [];
  public db = new Map<string, DistributionActivity>();
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
  console.log('[Test DashboardApplicationService] Verifying S5-7 crossing-month scenario...');

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

  // ==================== JULY 2026 ====================
  const july = new YearMonth('202607');
  
  // A and B registered in July
  const staffA = new Staff({ staffNo: 'S001', displayName: 'Aさん', lineUserId: 'line-A', workspaceId, createdAt: new Date('2026-07-10T10:00:00Z') });
  const staffB = new Staff({ staffNo: 'S002', displayName: 'Bさん', lineUserId: 'line-B', workspaceId, createdAt: new Date('2026-07-12T12:00:00Z') });
  await staffRepo.save(staffA);
  await staffRepo.save(staffB);

  // Holdings in July: A = 1200, B = 800
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S001', quantity: new Quantity(1200), updatedAt: new Date('2026-07-10') }));
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S002', quantity: new Quantity(800), updatedAt: new Date('2026-07-12') }));

  // Activities in July
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_JULY_A',
    staffNo: 'S001',
    reportedQuantity: new Quantity(1200),
    photoUrl: 'http://example.com/a.jpg',
    location: new Location(34, 136, 0),
    occurredAt: new Date('2026-07-15T10:00:00Z')
  }));
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_JULY_B',
    staffNo: 'S002',
    reportedQuantity: new Quantity(800),
    photoUrl: 'http://example.com/b.jpg',
    location: new Location(34, 136, 0),
    occurredAt: new Date('2026-07-16T12:00:00Z')
  }));

  // Verify July Dashboard
  const julyDashboard = await service.getWorkspaceDashboard(workspaceId, july);
  assert(julyDashboard.members.length === 2, 'July member count mismatch');
  assert(julyDashboard.totalHoldingQuantity === 2000, 'July total holding mismatch'); // 1200 + 800
  assert(julyDashboard.activeMemberCount === 2, 'July active member count mismatch');
  assert(julyDashboard.newMembers.length === 2, 'July new members count mismatch');
  assert(julyDashboard.newMembers.some(m => m.staffNo === 'S001'), 'July new members must include A');
  assert(julyDashboard.newMembers.some(m => m.staffNo === 'S002'), 'July new members must include B');
  assert(julyDashboard.cityActivities.length === 1, 'July city activities length mismatch');
  assert(julyDashboard.cityActivities[0].cityName === '-', 'July city name mismatch');
  assert(julyDashboard.cityActivities[0].quantity === 2000, 'July city quantity mismatch');

  // July Goal Unset (no goal -> undefined)
  assert(julyDashboard.distributionGoal === undefined, 'July unset goal mismatch');
  assert(julyDashboard.achievementRate === undefined, 'July unset achievement rate mismatch');

  // Set Goal to 10000 via repository
  const wsToUpdate = await wsRepo.findById(workspaceId);
  wsToUpdate!.updateGoal(10000, 'tester');
  await wsRepo.save(wsToUpdate!);

  // July Goal Achievement Rate (goal = 10000 -> achievement = 20%)
  const julyWithGoal = await service.getWorkspaceDashboard(workspaceId, july);
  assert(julyWithGoal.distributionGoal === 10000, 'July goal mismatch');
  assert(julyWithGoal.achievementRate === 20, `July achievement rate mismatch: expected 20, got ${julyWithGoal.achievementRate}`);

  const julyRankings = await service.getMonthlyRanking(workspaceId, july);
  assert(julyRankings.length === 2, 'July ranking length mismatch');
  assert(julyRankings[0].staffNo === 'S001' && julyRankings[0].quantity === 1200, 'July Rank 1 mismatch');
  assert(julyRankings[1].staffNo === 'S002' && julyRankings[1].quantity === 800, 'July Rank 2 mismatch');

  // ==================== AUGUST 2026 ====================
  const august = new YearMonth('202608');

  // C registered in August
  const staffC = new Staff({ staffNo: 'S003', displayName: 'Cさん', lineUserId: 'line-C', workspaceId, createdAt: new Date('2026-08-03T09:00:00Z') });
  await staffRepo.save(staffC);

  // Modify holdings: A = 1000, B = 500, C = 300
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S001', quantity: new Quantity(1000), updatedAt: new Date('2026-08-01') }));
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S002', quantity: new Quantity(500), updatedAt: new Date('2026-08-02') }));
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S003', quantity: new Quantity(300), updatedAt: new Date('2026-08-03') }));

  // C records activity in August
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_AUG_C',
    staffNo: 'S003',
    reportedQuantity: new Quantity(700),
    photoUrl: 'http://example.com/c.jpg',
    location: new Location(34, 136, 0),
    occurredAt: new Date('2026-08-05T10:00:00Z')
  }));

  // Verify August Dashboard
  const augustDashboard = await service.getWorkspaceDashboard(workspaceId, august);
  // 1. Staff roster continues to exist (A, B, C)
  assert(augustDashboard.members.length === 3, 'August member count mismatch');
  // 2. Holding persists with updated values: 1000 + 500 + 300 = 1800
  assert(augustDashboard.totalHoldingQuantity === 1800, `August total holding mismatch: expected 1800, got ${augustDashboard.totalHoldingQuantity}`);
  assert(augustDashboard.activeMemberCount === 1, 'August active member count mismatch');
  // 3. Only C registered in August
  assert(augustDashboard.newMembers.length === 1, 'August new members count mismatch');
  assert(augustDashboard.newMembers[0].staffNo === 'S003', 'August new member must be C');
  assert(augustDashboard.newMembers[0].registeredAt === '2026/08/03', 'C registered date mismatch');
  assert(augustDashboard.newMembers[0].holdingQuantity === 300, 'C holding mismatch');
  assert(augustDashboard.cityActivities.length === 1, 'August city activities length mismatch');
  assert(augustDashboard.cityActivities[0].cityName === '-', 'August city name mismatch');
  assert(augustDashboard.cityActivities[0].quantity === 700, 'August city quantity mismatch');

  // August MoM (compared to July: volume = 2000, members = 2)
  // Diff volume = 700 - 2000 = -1300, growth = -65%
  assert(augustDashboard.volumeDifference === -1300, 'August MoM volume diff mismatch');
  assert(augustDashboard.volumeGrowthRate === -65, `August MoM volume growth mismatch: expected -65, got ${augustDashboard.volumeGrowthRate}`);
  assert(augustDashboard.prevActiveMemberCount === 2, 'August prev active members mismatch');
  // Diff member = 1 - 2 = -1, growth = -50%
  assert(augustDashboard.memberDifference === -1, 'August MoM member diff mismatch');
  assert(augustDashboard.memberGrowthRate === -50, `August MoM member growth mismatch: expected -50, got ${augustDashboard.memberGrowthRate}`);
  assert(augustDashboard.activeCityCount === 1, 'August active city count mismatch');
  assert(augustDashboard.topCityName === '-', 'August top city name mismatch');
  assert(augustDashboard.topCityQuantity === 700, 'August top city quantity mismatch');

  // 4. August ranking should only include August activities (C: 700, A: 0, B: 0)
  const augustRankings = await service.getMonthlyRanking(workspaceId, august);
  assert(augustRankings.length === 3, 'August rankings length mismatch');
  assert(augustRankings[0].staffNo === 'S003' && augustRankings[0].quantity === 700, 'August Rank 1 must be C');
  assert(augustRankings[1].quantity === 0 && augustRankings[2].quantity === 0, 'A and B must have 0 activity in August');

  // ==================== SEPTEMBER 2026 (Complex Scenarios) ====================
  console.log('[Test DashboardApplicationService] Verifying S5-17 complex scenarios (multiple activities, cities, workspaces)...');
  const september = new YearMonth('202609');

  // Staff in WS-MIE-03: S001 (cityName: '鈴鹿市'), S002 (cityName: '四日市市'), S003 (cityName: '津市')
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S001', quantity: new Quantity(100), cityName: '鈴鹿市' }));
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S002', quantity: new Quantity(200), cityName: '四日市市' }));
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S003', quantity: new Quantity(300), cityName: '津市' }));

  // Staff in another workspace (WS-OTHER) to verify workspace isolation
  const staffOther = new Staff({ staffNo: 'S999', displayName: '他支部さん', lineUserId: 'line-other', workspaceId: 'WS-OTHER', createdAt: new Date('2026-09-01') });
  await staffRepo.save(staffOther);
  await holdingRepo.save(new FlyerHolding({ staffNo: 'S999', quantity: new Quantity(500), cityName: '松阪市' }));

  // Activities in September
  // 1. Same staff (S001) has multiple activities
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_SEP_A1',
    staffNo: 'S001',
    reportedQuantity: new Quantity(150),
    photoUrl: 'a1.jpg',
    location: new Location(0, 0, 0),
    occurredAt: new Date('2026-09-05T10:00:00Z')
  }));
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_SEP_A2',
    staffNo: 'S001',
    reportedQuantity: new Quantity(250),
    photoUrl: 'a2.jpg',
    location: new Location(0, 0, 0),
    occurredAt: new Date('2026-09-06T10:00:00Z')
  }));

  // 2. Staff (S002) has one activity
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_SEP_B',
    staffNo: 'S002',
    reportedQuantity: new Quantity(300),
    photoUrl: 'b.jpg',
    location: new Location(0, 0, 0),
    occurredAt: new Date('2026-09-07T10:00:00Z')
  }));

  // 3. Other workspace staff (S999) has activity (must be filtered out)
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_SEP_OTHER',
    staffNo: 'S999',
    reportedQuantity: new Quantity(1000),
    photoUrl: 'other.jpg',
    location: new Location(0, 0, 0),
    occurredAt: new Date('2026-09-08T10:00:00Z')
  }));

  const sepDashboard = await service.getWorkspaceDashboard(workspaceId, september);
  // Verify active member count (Only S001 and S002 are active. S003 is inactive, S999 is in another WS)
  assert(sepDashboard.activeMemberCount === 2, `September active members count mismatch: expected 2, got ${sepDashboard.activeMemberCount}`);

  // Verify MoM comparisons for September (compared to August: volume = 700, members = 1)
  // Diff volume = 700 - 700 = 0, growth = 0%
  assert(sepDashboard.volumeDifference === 0, 'September MoM volume diff mismatch');
  assert(sepDashboard.volumeGrowthRate === 0, 'September MoM volume growth mismatch');
  assert(sepDashboard.prevActiveMemberCount === 1, 'September prev active members mismatch');
  // Diff member = 2 - 1 = 1, growth = 100%
  assert(sepDashboard.memberDifference === 1, 'September MoM member diff mismatch');
  assert(sepDashboard.memberGrowthRate === 100, `September MoM member growth mismatch: expected 100, got ${sepDashboard.memberGrowthRate}`);

  // Verify city-wise activity aggregation
  // 鈴鹿市: S001 (150 + 250) = 400
  // 四日市市: S002 (300) = 300
  assert(sepDashboard.cityActivities.length === 2, `September city activities count mismatch: expected 2, got ${sepDashboard.cityActivities.length}`);
  assert(sepDashboard.cityActivities[0].cityName === '鈴鹿市' && sepDashboard.cityActivities[0].quantity === 400, 'September City Rank 1 mismatch');
  assert(sepDashboard.cityActivities[1].cityName === '四日市市' && sepDashboard.cityActivities[1].quantity === 300, 'September City Rank 2 mismatch');
  assert(sepDashboard.topCityName === '鈴鹿市', 'September top city name mismatch');
  assert(sepDashboard.topCityQuantity === 400, 'September top city quantity mismatch');
  assert(sepDashboard.activeCityCount === 2, 'September active city count mismatch');

  // Verify empty scenario (October 2026 - no activities at all)
  const october = new YearMonth('202610');
  const octDashboard = await service.getWorkspaceDashboard(workspaceId, october);
  assert(octDashboard.activeMemberCount === 0, 'October active members count mismatch');
  assert(octDashboard.cityActivities.length === 0, 'October city activities count mismatch');
  // October MoM (compared to September: volume = 700, members = 2)
  // Diff volume = 0 - 700 = -700, growth = -100%
  assert(octDashboard.volumeDifference === -700, 'October volume diff mismatch');
  assert(octDashboard.volumeGrowthRate === -100, 'October volume growth mismatch');
  assert(octDashboard.prevActiveMemberCount === 2, 'October prev active members mismatch');
  assert(octDashboard.memberDifference === -2, 'October member diff mismatch');
  assert(octDashboard.memberGrowthRate === -100, 'October member growth mismatch');

  // ==================== NOVEMBER 2026 (MoM from 0 activity) ====================
  console.log('[Test DashboardApplicationService] Verifying S5-18 boundary MoM with 0-activity previous month (October -> November)...');
  const november = new YearMonth('202611');

  // Register one activity in November
  await activityRepo.save(new DistributionActivity({
    id: 'ACT_NOV_A',
    staffNo: 'S001',
    reportedQuantity: new Quantity(500),
    photoUrl: 'nov.jpg',
    location: new Location(0, 0, 0),
    occurredAt: new Date('2026-11-05T10:00:00Z')
  }));

  const novDashboard = await service.getWorkspaceDashboard(workspaceId, november);
  assert(novDashboard.monthlyDistributionQuantity === 500, 'November volume mismatch');
  assert(novDashboard.activeMemberCount === 1, 'November active members mismatch');
  assert(novDashboard.previousMonthDistributionQuantity === 0, 'November prev volume must be 0');
  assert(novDashboard.prevActiveMemberCount === 0, 'November prev active members must be 0');
  assert(novDashboard.volumeDifference === 500, 'November volume diff mismatch');
  assert(novDashboard.volumeGrowthRate === 100, `November volume growth rate must be 100, got ${novDashboard.volumeGrowthRate}`);
  assert(novDashboard.memberDifference === 1, 'November member diff mismatch');
  assert(novDashboard.memberGrowthRate === 100, `November member growth rate must be 100, got ${novDashboard.memberGrowthRate}`);

  console.log('[Test DashboardApplicationService] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
