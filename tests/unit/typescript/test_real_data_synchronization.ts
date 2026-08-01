import { DeltaSynchronizationManager } from '../../../src/dashboard/sync/DeltaSynchronizationManager';
import { CacheManager } from '../../../src/dashboard/sync/CacheManager';
import { RetryController } from '../../../src/dashboard/sync/RetryController';
import { ConflictResolver, AreaMergeStrategy } from '../../../src/dashboard/sync/ConflictResolver';
import { SynchronizationScheduler, SchedulerEvent } from '../../../src/dashboard/sync/SynchronizationScheduler';
import { HAppConnectionState } from '../../../src/dashboard/HAppConnectionState';
import { AreaDetail, EventLogItem, InventoryItem } from '../../../src/dashboard/DashboardStateModel';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// Global browser mocks for node runtime compatibility
const globalVar = globalThis as any;
globalVar.window = globalVar;

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true
});

// Cache config mock
globalVar.POSTING_MAP_CONFIG = {
  CACHE_TTL: {
    dashboard: 200, // 短い値に設定
    area: 100
  }
};

async function runTests() {
  console.log('[Test RealDataSynchronization] Starting synchronization tests...');

  // 1. DeltaSynchronizationManager Tests
  {
    const delta = new DeltaSynchronizationManager(1000);
    assert(delta.getLastSyncTimestamp() === 1000, 'Initial sync timestamp should be 1000');

    // 新着判定
    const isNew1 = delta.updatePointer(1005, 'EV-1');
    assert(isNew1 === true, 'Newer timestamp should be accepted');
    assert(delta.getLastSyncTimestamp() === 1005, 'Pointer should update to 1005');
    assert(delta.getLastEventId() === 'EV-1', 'Pointer ID should update to EV-1');

    // 過去データ拒否
    const isNew2 = delta.updatePointer(1000, 'EV-2');
    assert(isNew2 === false, 'Stale timestamp should be rejected');

    // 重複データ拒否
    const isNew3 = delta.updatePointer(1005, 'EV-1');
    assert(isNew3 === false, 'Identical timestamp and ID should be rejected');
    console.log('[Test RealDataSynchronization] DeltaSynchronizationManager: PASSED');
  }

  // 2. CacheManager Tests
  {
    const cache = new CacheManager();
    
    // 基本的な保存・取得
    cache.set('dashboard:test', { value: 123 });
    const hit = cache.get<any>('dashboard:test');
    assert(hit !== null && hit.value === 123, 'Cache hit should return cached value');

    // TTL 満了テスト
    await new Promise(resolve => setTimeout(resolve, 250));
    const expired = cache.get<any>('dashboard:test');
    assert(expired === null, 'Expired cache should return null');

    // 無効化（Invalidation）
    cache.set('area:test', { value: 456 });
    cache.invalidate('area:test');
    const invalidated = cache.get<any>('area:test');
    assert(invalidated === null, 'Invalidated cache should return null');

    // メトリクスの検証
    const metrics = cache.getMetrics();
    assert(metrics.hitCount === 1, 'Hit count should be 1');
    assert(metrics.missCount === 2, 'Miss count should be 2'); // expired + invalidated
    assert(metrics.hitRate === 0.3333, 'Hit rate should be 0.3333');
    assert(metrics.cacheSize === 0, 'Cache size should be 0');
    assert(metrics.memoryUsageBytes === 0, 'Memory usage should be 0');

    console.log('[Test RealDataSynchronization] CacheManager: PASSED');
  }

  // 3. RetryController Tests
  {
    // 初期ディレイ10ms, factor 2, 最大2回
    const retry = new RetryController(2, 10, 2);
    let runCount = 0;
    
    try {
      await retry.execute(async () => {
        runCount++;
        throw new Error('Transient error');
      });
      assert(false, 'Should throw error after retries');
    } catch (err) {
      assert(runCount === 2, 'Should retry up to maxRetries (2 times)');
    }

    // 成功系リトライ
    runCount = 0;
    const successResult = await retry.execute(async () => {
      runCount++;
      if (runCount === 1) throw new Error('First try fails');
      return 'success';
    });
    assert(successResult === 'success', 'Should succeed after retry');
    assert(runCount === 2, 'Should succeed on attempt 2');
    console.log('[Test RealDataSynchronization] RetryController: PASSED');
  }

  // 4. ConflictResolver Tests
  {
    const resolver = new ConflictResolver();

    // 4.1. EventLog マージ競合解決 (重複排除 & 最新順ソート)
    const logsCur: EventLogItem[] = [
      { id: 'EV-1', timestamp: 1000, tenantId: '', branchId: '', areaId: '', memberId: '', actionType: '', count: 10, latitude: 0, longitude: 0, meta: {} },
      { id: 'EV-2', timestamp: 2000, tenantId: '', branchId: '', areaId: '', memberId: '', actionType: '', count: 20, latitude: 0, longitude: 0, meta: {} }
    ];
    const logsInc: EventLogItem[] = [
      { id: 'EV-2', timestamp: 2000, tenantId: '', branchId: '', areaId: '', memberId: '', actionType: '', count: 20, latitude: 0, longitude: 0, meta: {} },
      { id: 'EV-3', timestamp: 3000, tenantId: '', branchId: '', areaId: '', memberId: '', actionType: '', count: 30, latitude: 0, longitude: 0, meta: {} }
    ];

    const logsMerged = resolver.mergeEventLogs(logsCur, logsInc);
    assert(logsMerged.length === 3, 'Merged logs should resolve duplicate EV-2 to length 3');
    assert(logsMerged[0].id === 'EV-3', 'Latest log EV-3 should be first');

    // 4.2. Area マージ競合解決 (doneCount デグレード防止)
    const areasCur: AreaDetail[] = [
      { areaId: 'A-1', areaName: '地区1', cityName: '津', totalHouseholds: 100, doneCount: 50, representativeAddress: '', latitude: 0, longitude: 0, progressRate: 50 }
    ];
    // doneCount が現在の値より小さい新着データを受信
    const areasInc: AreaDetail[] = [
      { areaId: 'A-1', areaName: '地区1', cityName: '津', totalHouseholds: 100, doneCount: 40, representativeAddress: '', latitude: 0, longitude: 0, progressRate: 40 }
    ];

    const areasMerged = resolver.mergeAreas(areasCur, areasInc);
    assert(areasMerged[0].doneCount === 50, 'Merged area doneCount must protect and maintain the maximum value of 50');
    assert(areasMerged[0].progressRate === 50, 'Merged area progressRate must remain 50');

    // 4.3. Inventory マージ競合解決 (lastUpdatedAt 優先)
    const stockCur: InventoryItem[] = [
      { inventoryId: 'I-1', flyerId: '', flyerName: '', holderId: '', holderType: 'MEMBER', currentStock: 100, lastUpdatedAt: 5000 }
    ];
    const stockInc: InventoryItem[] = [
      { inventoryId: 'I-1', flyerId: '', flyerName: '', holderId: '', holderType: 'MEMBER', currentStock: 80, lastUpdatedAt: 6000 } // 新しい更新
    ];

    const stockMerged = resolver.mergeInventories(stockCur, stockInc);
    assert(stockMerged[0].currentStock === 80, 'Merged inventory must adopt the newer update (80)');

    // 4.4. Strategy パターン拡張性の検証 (カスタム AreaMergeStrategy)
    class OverrideAreaMergeStrategy implements AreaMergeStrategy {
      merge(current: AreaDetail, incoming: AreaDetail): AreaDetail {
        // 例: 常に入力値を絶対優先するカスタム戦略
        return incoming;
      }
    }
    resolver.setAreaMergeStrategy(new OverrideAreaMergeStrategy());
    const customAreasMerged = resolver.mergeAreas(areasCur, areasInc);
    assert(customAreasMerged[0].doneCount === 40, 'Custom Strategy must apply the overridden merge behavior (40)');

    // 競合メトリクスの検証
    assert(resolver.getConflictCount() === 3, 'Conflict count must be 3');
    resolver.resetMetrics();
    assert(resolver.getConflictCount() === 0, 'Conflict count must reset to 0');

    console.log('[Test RealDataSynchronization] ConflictResolver: PASSED');
  }

  // 5. SynchronizationScheduler Tests
  {
    const connection = new HAppConnectionState();
    const scheduler = new SynchronizationScheduler(connection, new RetryController(2, 5, 2));

    const eventsFired: SchedulerEvent[] = [];
    scheduler.subscribe((event: any) => {
      eventsFired.push(event);
    });

    let syncExecuted = false as boolean;
    const task = async () => {
      syncExecuted = true;
      return true;
    };

    // 即時同期の成功フロー検証
    const triggerSuccess = await scheduler.triggerImmediateSync(task);
    assert(triggerSuccess === true, 'triggerImmediateSync should return true on success');
    assert(syncExecuted === true, 'Task execution should trigger');
    assert(eventsFired.includes('sync-start'), 'Event sync-start must be fired');
    assert(eventsFired.includes('sync-success'), 'Event sync-success must be fired');
    assert(connection.getState() === 'CONNECTED', 'Connection status must return to CONNECTED');

    // メトリクスの検証
    let schedMetrics = scheduler.getMetrics();
    assert(schedMetrics.lastSyncTime > 0, 'lastSyncTime must be populated');
    assert(schedMetrics.lastSyncDuration >= 0, 'lastSyncDuration must be populated');
    assert(schedMetrics.lastRetryCount === 0, 'lastRetryCount must be 0 for direct success');
    assert(schedMetrics.totalSyncCount === 1, 'totalSyncCount should be 1');
    assert(schedMetrics.averageSyncTime >= 0, 'averageSyncTime should be >= 0');
    assert(schedMetrics.maxSyncTime >= 0, 'maxSyncTime should be >= 0');
    assert(schedMetrics.averageRetryCount === 0, 'averageRetryCount should be 0');

    // 定期スケジュールのオフラインポリシー検証
    globalVar.navigator.onLine = false;
    eventsFired.length = 0; // 配列クリア

    scheduler.startScheduler(async () => {}, 50);
    await new Promise(resolve => setTimeout(resolve, 100));

    assert(eventsFired.includes('sync-offline'), 'Event sync-offline must fire when browser is offline');
    assert(connection.getState() === 'OFFLINE', 'Connection status must transition to OFFLINE');

    // オフライン時間計測の検証
    schedMetrics = scheduler.getMetrics();
    assert(schedMetrics.totalOfflineDuration >= 10, 'totalOfflineDuration must track offline time');

    scheduler.stopScheduler();
    console.log('[Test RealDataSynchronization] SynchronizationScheduler: PASSED');
  }

  console.log('[Test RealDataSynchronization] All synchronization tests completed successfully.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  REAL DATA SYNCHRONIZATION PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[RealDataSynchronization Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
