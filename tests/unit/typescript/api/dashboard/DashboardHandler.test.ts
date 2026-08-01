import { DashboardHandler } from '@api/dashboard/DashboardHandler';
import { DashboardApplicationService } from '@application/dashboard/services/DashboardApplicationService';
import { IStaffRepository } from '@domain/field/staff/repositories/IStaffRepository';
import { Staff } from '@domain/field/staff/entities/Staff';
import { ApiRequest } from '@core/api/ApiRequest';
import { ApiExecutionContext } from '@infra/gas/ApiExecutionContext';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockStaffRepository implements IStaffRepository {
  async findByStaffNo(staffNo: string): Promise<Staff | undefined> {
    return undefined;
  }
  async findByLineUserId(lineUserId: string): Promise<Staff | undefined> {
    if (lineUserId === 'line-B') {
      return new Staff({
        staffNo: 'S002',
        displayName: 'Bさん',
        lineUserId: 'line-B',
        workspaceId: 'WS-MIE-03',
        createdAt: new Date()
      });
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

class MockDashboardApplicationService extends DashboardApplicationService {
  constructor() {
    super(null as any, null as any, null as any, null as any);
  }

  public async getPersonalDashboardByLineUserId(lineUserId: string, yearMonth?: any): Promise<any> {
    if (lineUserId === 'line-B') {
      return {
        staffNo: 'S002',
        displayName: 'Bさん',
        holdingQuantity: 1000,
        monthlyDistributionQuantity: 1200
      };
    }
    throw new Error('Staff not found');
  }

  public async getPersonalDashboard(staffNo: string, yearMonth?: any): Promise<any> {
    if (staffNo === 'S002') {
      return {
        staffNo: 'S002',
        displayName: 'Bさん',
        holdingQuantity: 1000,
        monthlyDistributionQuantity: 1200
      };
    }
    throw new Error('Staff not found');
  }

  public async getWorkspaceDashboard(workspaceId: string, yearMonth?: any): Promise<any> {
    if (workspaceId === 'WS-MIE-03') {
      return {
        workspaceId: 'WS-MIE-03',
        workspaceName: '三重第3支部',
        memberCount: 3,
        newMemberCount: 0,
        totalHoldingQuantity: 2500,
        monthlyDistributionQuantity: 2500,
        previousMonthDistributionQuantity: 2000,
        growthRate: '+25%',
        members: [],
        newMembers: [],
        monthlyTrend: []
      };
    }
    throw new Error('Workspace not found');
  }

  public async getMonthlyRanking(workspaceId: string, yearMonth?: any): Promise<any[]> {
    if (workspaceId === 'WS-MIE-03') {
      return [
        { rank: 1, staffNo: 'S001', displayName: 'Aさん', quantity: 1200, activityIndex: 1400 },
        { rank: 2, staffNo: 'S002', displayName: 'Bさん', quantity: 800, activityIndex: 900 },
        { rank: 3, staffNo: 'S003', displayName: 'Cさん', quantity: 500, activityIndex: 600 }
      ];
    }
    return [];
  }
}

async function runTests() {
  console.log('[Test DashboardHandler] Running unit tests...');

  const service = new MockDashboardApplicationService();
  const handler = new DashboardHandler(service);
  const context = new ApiExecutionContext();

  // Test Case 1: GET /dashboard/me
  {
    const request = new ApiRequest({
      method: 'GET',
      path: '/dashboard/me',
      version: 'v2',
      requestId: 'req-1',
      query: { lineUserId: 'line-B' }
    });

    const response = await handler.execute(request, context);
    assert(response.success === true, 'Response must be success');
    assert(response.status === 200, 'Status must be 200');
    assert(response.data.name === 'Bさん', 'Name must match');
    assert(response.data.holding === 1000, 'Holding must match');
    assert(response.data.monthlyActivity === 1200, 'Activity must match');
  }

  // Test Case 2: GET /dashboard/workspace/{id}
  {
    const request = new ApiRequest({
      method: 'GET',
      path: '/dashboard/workspace/WS-MIE-03',
      version: 'v2',
      requestId: 'req-2',
      pathParams: { id: 'WS-MIE-03' }
    });

    const response = await handler.execute(request, context);
    assert(response.success === true, 'Response must be success');
    assert(response.status === 200, 'Status must be 200');
    assert(response.data.name === '三重第3支部', 'Workspace name must match');
    assert(response.data.total === 2500, 'Total holding must match');
    assert(response.data.growthRate === '+25%', 'Growth rate must match');
    assert(response.data.memberCount === 3, 'Member count must match');
  }

  // Test Case 3: GET /dashboard/ranking
  {
    const request = new ApiRequest({
      method: 'GET',
      path: '/dashboard/ranking',
      version: 'v2',
      requestId: 'req-3',
      query: { workspaceId: 'WS-MIE-03' }
    });

    const response = await handler.execute(request, context);
    assert(response.success === true, 'Response must be success');
    assert(response.status === 200, 'Status must be 200');
    assert(response.data.length === 3, 'Rankings count must match');
    assert(response.data[0].rank === 1, 'Rank 1 must be correct');
    assert(response.data[0].name === 'Aさん', 'Rank 1 name must match');
    assert(response.data[0].quantity === 1200, 'Rank 1 quantity must match');
    assert(response.data[0].activityIndex === 1400, 'Rank 1 activityIndex must match');
  }

  console.log('[Test DashboardHandler] All tests PASSED.');
}

runTests().catch(err => {
  console.error('[Test DashboardHandler] Failed:', err);
  process.exit(1);
});
