import { DashboardApiClient } from '../../../src/dashboard/DashboardApiClient';
import { DashboardStateModel, AreaDetail, EventLogItem } from '../../../src/dashboard/DashboardStateModel';
import { HAppConnectionState } from '../../../src/dashboard/HAppConnectionState';
import { EventLogDispatcher } from '../../../src/dashboard/EventLogDispatcher';
import { HAppEventSubscriber } from '../../../src/dashboard/HAppEventSubscriber';
import { HAppSynchronizationController } from '../../../src/dashboard/HAppSynchronizationController';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// 1. ブラウザ環境のモック化
const globalVar = globalThis as any;
globalVar.window = globalVar;

let fetchCallCount = 0;
let fetchParams: any = null;
let mockResponseLogs: any[] = [];

globalVar.fetch = async (url: string, init?: any) => {
  fetchCallCount++;
  fetchParams = init && init.body ? JSON.parse(init.body) : {};
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        logs: mockResponseLogs
      }
    })
  } as any;
};

// navigator.onLine のモック化
Object.defineProperty(globalThis, 'navigator', {
  value: {
    onLine: true
  },
  writable: true,
  configurable: true
});

async function runTests() {
  console.log('[Test HAppRealConnection] Starting tests...');

  // 1. ConnectionState の単体テスト
  const connection = new HAppConnectionState();
  let latestState = connection.getState();
  assert(latestState === 'CONNECTED', 'Initial state must be CONNECTED');

  let stateChangeFired = false as boolean;
  connection.subscribe((state) => {
    stateChangeFired = true;
    latestState = state;
  });

  connection.setState('SYNCING');
  assert(stateChangeFired === true, 'Listener must be triggered on state change');
  assert(latestState === 'SYNCING', 'State must transition to SYNCING');
  console.log('[Test HAppRealConnection] ConnectionState tests: PASSED');

  // 2. EventLogDispatcher の単体テスト
  const dispatcher = new EventLogDispatcher();
  let dispatchFired = false as boolean;
  let receivedLog: any = null;

  dispatcher.subscribe((log) => {
    dispatchFired = true;
    receivedLog = log;
  });

  const sampleLog: EventLogItem = {
    id: 'EV-100',
    timestamp: 1700000000000,
    tenantId: 'MIE-03',
    branchId: 'MIE-03',
    areaId: 'AREA-01',
    memberId: 'USER-01',
    actionType: 'distribute',
    count: 50,
    latitude: 34.5,
    longitude: 136.5,
    meta: {}
  };

  dispatcher.dispatch(sampleLog);
  assert(dispatchFired === true, 'Dispatcher subscribe callback must trigger');
  assert(receivedLog !== null && (receivedLog as any).id === 'EV-100', 'Dispatched payload must match');
  console.log('[Test HAppRealConnection] EventLogDispatcher tests: PASSED');

  // 3. DashboardStateModel の不変（Immutable）再計算および一意性テスト
  const client = new DashboardApiClient('https://mock-gas-url/exec');
  const stateModel = new DashboardStateModel(client);

  // 初期データ状態のセットアップ
  const initialAreas: AreaDetail[] = [
    { areaId: 'AREA-01', areaName: '地区A', cityName: '津市', totalHouseholds: 200, representativeAddress: '', doneCount: 50, latitude: 34.5, longitude: 136.5, progressRate: 25 }
  ];
  (stateModel as any).data = {
    branchName: 'MIE-03',
    stats: { totalCompleted: 50, totalHouseholds: 200, progressRate: 25 },
    areas: initialAreas,
    cities: []
  };

  let modelNotifyFired = false as boolean;
  stateModel.subscribe(() => {
    modelNotifyFired = true;
  });

  // 初回追加 (正常系)
  const isAdded1 = stateModel.addIncomingEventLog(sampleLog);
  assert(isAdded1 === true, 'First event addition should return true');
  assert(modelNotifyFired === true, 'Model change listener must be called');

  // 不変状態の再計算検証
  const updatedData = stateModel.getData();
  assert(updatedData !== null, 'Data should not be null');
  assert(updatedData!.stats.totalCompleted === 100, 'Overall total completed count must be updated');
  assert(updatedData!.stats.progressRate === 50, 'Overall progress rate must be updated to 50%');

  const updatedArea = updatedData!.areas.find(a => a.areaId === 'AREA-01');
  assert(updatedArea !== undefined, 'Target area should exist');
  assert(updatedArea!.doneCount === 100, 'Area doneCount must be updated to 100');
  assert(updatedArea!.progressRate === 50, 'Area progressRate must be updated to 50%');

  // 参照同一性チェックによる Immutable 保証の検証
  assert(updatedData!.areas !== initialAreas, 'Areas array must be a new array instance');
  assert(updatedData!.areas[0] !== initialAreas[0], 'Updated area object must be a new object instance');

  // 重複 EventID 追加の試行 (重複排除ポリシー)
  modelNotifyFired = false;
  const isAdded2 = stateModel.addIncomingEventLog(sampleLog);
  assert(isAdded2 === false, 'Duplicate event addition should return false');
  assert(modelNotifyFired === false, 'Model change listener must NOT be called for duplicate event');
  assert(stateModel.getEventLogs().length === 1, 'EventLogs count should remain 1');
  console.log('[Test HAppRealConnection] StateModel Immutable & Uniqueness tests: PASSED');

  // 4. 同期コントローラー & サブスクライバー連携検証
  const subscriber = new HAppEventSubscriber(stateModel, dispatcher);
  const syncController = new HAppSynchronizationController(stateModel, subscriber, connection);

  // 差分同期データのモック設定
  const newLog1 = { id: 'EV-101', timestamp: 1700000010000, tenantId: 'MIE-03', branchId: 'MIE-03', areaId: 'AREA-01', memberId: 'USER-01', actionType: 'distribute', count: 20, latitude: 34.5, longitude: 136.5 };
  const newLog2 = { id: 'EV-102', timestamp: 1700000020000, tenantId: 'MIE-03', branchId: 'MIE-03', areaId: 'AREA-01', memberId: 'USER-02', actionType: 'distribute', count: 30, latitude: 34.5, longitude: 136.5 };
  mockResponseLogs = [newLog1, newLog2];

  fetchCallCount = 0;
  // 同期時刻をモックデータの前に初期設定
  if ((syncController as any).deltaManager) {
    (syncController as any).deltaManager.resetPointer(1700000000000);
  } else {
    (syncController as any).lastSyncTimestamp = 1700000000000;
  }

  await syncController.syncNewEvents('MIE-03', 'MIE-03');

  assert(fetchCallCount === 1, 'Should call API once');
  assert(fetchParams.action === 'getEventLog', 'Should request getEventLog action');
  assert(fetchParams.params.sinceTimestamp === 1700000000000, 'sinceTimestamp must be supplied');

  // 同期されたログの件数確認
  assert(stateModel.getEventLogs().length === 3, 'Total event logs should be 3');
  assert(syncController.getLastSyncTimestamp() === 1700000020000, 'Sync timestamp must be updated to the last log timestamp');
  assert(syncController.getLastEventId() === 'EV-102', 'Last event ID must be updated to the last log ID');
  assert(connection.getState() === 'CONNECTED', 'Connection state should return to CONNECTED');

  // 5. オフラインポリシーの検証
  globalVar.navigator.onLine = false;
  connection.setState('CONNECTED');
  syncController.startSyncLoop('MIE-03', 'MIE-03', 100);

  // 同期インターバル後のオフライン遷移確認のためウェイト
  await new Promise(resolve => setTimeout(resolve, 150));
  assert(connection.getState() === 'OFFLINE', 'State must transition to OFFLINE when browser is offline');

  syncController.stopSyncLoop();
  console.log('[Test HAppRealConnection] HAppSynchronizationController & Subscriber tests: PASSED');

  console.log('[Test HAppRealConnection] All tests completed successfully.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  H-APP REAL CONNECTION TESTS PASSED');
  console.log('======================================\n');
}).catch((err) => {
  console.error('[HAppRealConnection Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
