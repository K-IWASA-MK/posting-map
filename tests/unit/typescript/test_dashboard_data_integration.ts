import { DashboardApiClient, ApiResponse } from '../../../src/dashboard/DashboardApiClient';
import { DashboardDataMapper } from '../../../src/dashboard/DashboardDataMapper';
import { DashboardStateModel, DashboardData, VoteTurnout, EventLogItem, InventoryItem } from '../../../src/dashboard/DashboardStateModel';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// 1. Mock fetch setup for testing DashboardApiClient
class MockDashboardApiClient extends DashboardApiClient {
  mockResponse: ApiResponse | null = null;
  lastAction: string = '';
  lastParams: Record<string, any> = {};

  constructor() {
    super('https://script.google.com/macros/s/mock-url/exec');
  }

  override async request<T = any>(action: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    this.lastAction = action;
    this.lastParams = params;
    if (this.mockResponse) {
      return this.mockResponse as ApiResponse<T>;
    }
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'No mock response configured.' } };
  }
}

// Test Suite 1: DashboardDataMapper Verification
function testMapperNormalAndEdgeCases() {
  console.log('[Test 1] DashboardDataMapper verification starting...');

  // Map Area Detail
  const rawArea = {
    name: '四日市-001',
    totalHouseholds: 250,
    doneCount: 125,
    representativeAddress: '三重県四日市市栄町1-1',
    latitude: 34.966,
    longitude: 136.628
  };
  const area = DashboardDataMapper.mapArea(rawArea);
  assert(area.areaId === '四日市-001', 'Invalid AreaID mapping');
  assert(area.progressRate === 50, 'Invalid ProgressRate calculation');
  assert(area.latitude === 34.966, 'Invalid Latitude mapping');
  assert(area.longitude === 136.628, 'Invalid Longitude mapping');

  // Edge case mapping (empty fields)
  const emptyArea = DashboardDataMapper.mapArea({});
  assert(emptyArea.areaId === '', 'Invalid empty AreaID mapping');
  assert(emptyArea.progressRate === 0, 'Invalid empty ProgressRate calculation');
  assert(emptyArea.latitude === 0, 'Invalid empty Latitude mapping');

  // Map Vote Turnout
  const rawTurnout = {
    areaId: 'MIE-03-YOK-001',
    electionId: 'HR-2024',
    electionType: 'HOUSE_OF_REPRESENTATIVES',
    electionDate: '2024-10-27',
    turnoutRate: 0.542,
    nationalAverage: 0.521
  };
  const turnout = DashboardDataMapper.mapVoteTurnout(rawTurnout);
  assert(turnout.areaId === 'MIE-03-YOK-001', 'Invalid Turnout AreaID mapping');
  assert(turnout.turnoutRate === 0.542, 'Invalid Turnout rate mapping');
  assert(turnout.electionType === 'HOUSE_OF_REPRESENTATIVES', 'Invalid Turnout ElectionType mapping');

  // Map Event Log
  const rawEvent = {
    id: 'EV-1001',
    timestamp: 1718000000000,
    tenantId: 'MIE-03',
    branchId: 'MIE-03',
    blockId: 'MIE-03-YOK-001',
    userId: 'MIE-03-S001',
    actionType: 'distribute',
    count: 200,
    lat: 34.966,
    lng: 136.628,
    meta: '{"legacyRow": 2}'
  };
  const event = DashboardDataMapper.mapEventLogItem(rawEvent);
  assert(event.id === 'EV-1001', 'Invalid EventID mapping');
  assert(event.memberId === 'MIE-03-S001', 'Invalid MemberID mapping');
  assert(event.meta.legacyRow === 2, 'Invalid JSON meta parsing');

  console.log('[Test 1] PASSED');
}

// Test Suite 2: DashboardStateModel State Transitions & Subscription Listeners
async function testStateModelTransitions() {
  console.log('[Test 2] DashboardStateModel transitions starting...');

  const client = new MockDashboardApiClient();
  const stateModel = new DashboardStateModel(client);

  let listenerCallCount = 0;
  const unsubscribe = stateModel.subscribe(() => {
    listenerCallCount++;
  });

  // Mock dashboard fetch success
  client.mockResponse = {
    success: true,
    data: {
      branchName: '三重第3支部',
      stats: {
        totalHouseholds: 300000,
        totalCompleted: 150000
      },
      areas: [
        { name: '四日市-001', totalHouseholds: 200, doneCount: 100 }
      ],
      cities: [
        { cityName: '四日市市', doneCount: 100, totalCount: 200 }
      ]
    }
  };

  // Initial fetch trigger
  const fetchPromise = stateModel.loadDashboard('MIE-03', 'MIE-03', true);
  
  // Loading state verification
  assert(stateModel.getIsLoading() === true, 'Model must set isLoading to true');
  assert(listenerCallCount > 0, 'Subscription listener must be notified of loading state');

  await fetchPromise;

  // Complete state verification
  assert(stateModel.getIsLoading() === false, 'Model must reset isLoading to false');
  const data = stateModel.getData();
  assert(data !== null, 'Model data must not be null');
  assert(data!.branchName === '三重第3支部', 'Invalid branch name in loaded state');
  assert(data!.stats.progressRate === 50, 'Invalid progress rate calculation');
  assert(data!.areas[0].areaName === '四日市-001', 'Invalid area item mapped');
  assert(stateModel.getError() === null, 'Error state must be null');

  // Clean subscription
  unsubscribe();
  const previousCallCount = listenerCallCount;
  
  // Trigger another fetch, listener must not be called anymore
  client.mockResponse = { success: true, data: { branchName: 'MIE-03' } };
  await stateModel.loadDashboard('MIE-03', 'MIE-03', true);
  assert(listenerCallCount === previousCallCount, 'Listener must not be called after unsubscribing');

  console.log('[Test 2] PASSED');
}

// Test Suite 3: Error handling policy verification
async function testStateModelErrorHandling() {
  console.log('[Test 3] DashboardStateModel error handling starting...');

  const client = new MockDashboardApiClient();
  const stateModel = new DashboardStateModel(client);

  client.mockResponse = {
    success: false,
    error: {
      code: 'PERMISSION_ERROR',
      message: 'LINE UserID is not registered in MemberMaster.'
    }
  };

  await stateModel.loadDashboard('MIE-03', 'MIE-03', true);

  // Verification of error propagation
  assert(stateModel.getIsLoading() === false, 'Loading must be false on failure');
  assert(stateModel.getData() === null, 'Data must remain null on failure');
  const error = stateModel.getError();
  assert(error !== null, 'Error must not be null');
  assert(error!.code === 'PERMISSION_ERROR', 'Invalid error code propagated');
  assert(error!.message.includes('LINE UserID'), 'Invalid error message propagated');

  console.log('[Test 3] PASSED');
}

// Run All Tests
testMapperNormalAndEdgeCases();
testStateModelTransitions().then(() => {
  return testStateModelErrorHandling();
}).then(() => {
  console.log('\n======================================');
  console.log('  ALL INTEGRATION TESTS PASSED');
  console.log('======================================\n');
}).catch((err) => {
  console.error('[Integration Test Failure]', err);
  process.exit(1);
});
