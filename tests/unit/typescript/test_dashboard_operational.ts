import { OperationalStatusManager, OperationalStatus } from '../../../src/dashboard/operations/OperationalStatusManager';
import { SystemHealthMonitor, DEFAULT_THRESHOLDS } from '../../../src/dashboard/operations/SystemHealthMonitor';
import { MetricsAggregator } from '../../../src/dashboard/operations/MetricsAggregator';
import { NotificationCenter, NotificationType } from '../../../src/dashboard/operations/NotificationCenter';
import { HealthIndicator } from '../../../src/dashboard/operations/HealthIndicator';
import { DashboardHeader } from '../../../src/dashboard/components/DashboardHeader';
import { CacheManager } from '../../../src/dashboard/sync/CacheManager';
import { RetryController } from '../../../src/dashboard/sync/RetryController';
import { SynchronizationScheduler } from '../../../src/dashboard/sync/SynchronizationScheduler';
import { HAppConnectionState } from '../../../src/dashboard/HAppConnectionState';
import { ConflictResolver } from '../../../src/dashboard/sync/ConflictResolver';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// Global browser mocks for node runtime compatibility
const globalVar = globalThis as any;
globalVar.window = globalVar;

globalVar.requestAnimationFrame = (callback: any) => {
  return setTimeout(callback, 0);
};

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true
});

const createdElements: any[] = [];

globalVar.document = {
  createElement(tag: string) {
    let clickCb: any = null;
    const el = {
      tagName: tag.toUpperCase(),
      style: {
        setProperty(name: string, value: string) {
          (this as any)[name] = value;
        }
      },
      appendChild(child: any) { return child; },
      addEventListener(event: string, cb: any) {
        if (event === 'click') clickCb = cb;
      },
      classList: {
        add() {},
        remove() {}
      },
      className: '',
      id: '',
      innerText: '',
      innerHTML: '',
      remove() {},
      click() {
        if (clickCb) clickCb();
      },
      querySelector(selector: string) {
        return createdElements.find(item => {
          if (selector.startsWith('.')) {
            return item.className === selector.slice(1);
          }
          if (selector.startsWith('#')) {
            return item.id === selector.slice(1);
          }
          return item.tagName === selector.toUpperCase();
        }) || null;
      }
    } as any;
    createdElements.push(el);
    return el;
  },
  head: {
    appendChild(child: any) {}
  },
  body: {
    appendChild(child: any) {}
  },
  getElementById(id: string) {
    return createdElements.find(item => item.id === id) || null;
  }
} as any;

async function runTests() {
  console.log('[Test DashboardOperational] Starting operational tests...');

  // 1. OperationalStatusManager Tests
  {
    const statusManager = new OperationalStatusManager('NORMAL');
    assert(statusManager.getStatus() === 'NORMAL', 'Initial status should be NORMAL');

    const transitions: { from: OperationalStatus; to: OperationalStatus }[] = [];
    statusManager.subscribe((status, prev) => {
      transitions.push({ from: prev, to: status });
    });

    statusManager.setStatus('WARNING');
    assert(statusManager.getStatus() === 'WARNING', 'Status should transition to WARNING');
    assert(transitions.length === 1, 'Listener should trigger on transition');
    assert(transitions[0].from === 'NORMAL' && transitions[0].to === 'WARNING', 'Transition detail mismatch');

    // 重複セットは無視されること
    statusManager.setStatus('WARNING');
    assert(transitions.length === 1, 'Repeated set status must be ignored by state machine');

    console.log('[Test DashboardOperational] OperationalStatusManager: PASSED');
  }

  // 2. SystemHealthMonitor Tests
  {
    const statusManager = new OperationalStatusManager('NORMAL');
    const thresholds = {
      SYNC_WARNING_MS: 100, // 短い値
      SYNC_ERROR_MS: 300,
      RETRY_WARNING_COUNT: 2
    };
    const healthMonitor = new SystemHealthMonitor(statusManager, thresholds);

    // デフォルト状態で評価 (NORMAL)
    healthMonitor.evaluateHealth();
    assert(statusManager.getStatus() === 'NORMAL', 'Initial evaluated health should be NORMAL');

    // オフライン検知時の評価 (OFFLINE)
    healthMonitor.setOffline(true);
    assert(statusManager.getStatus() === 'OFFLINE', 'Offline status should be OFFLINE');

    healthMonitor.setOffline(false);
    assert(statusManager.getStatus() === 'NORMAL', 'Should recover to NORMAL when online');

    // リトライしきい値警告の評価 (WARNING)
    healthMonitor.updateSyncMetrics(Date.now(), 2); // retry >= 2
    assert(statusManager.getStatus() === 'WARNING', 'Status should be WARNING on retry threshold');

    // リトライ初期化で NORMAL へ回復
    healthMonitor.updateSyncMetrics(Date.now(), 0);
    assert(statusManager.getStatus() === 'NORMAL', 'Status should recover to NORMAL');

    // 許容同期遅延警告の評価 (WARNING)
    healthMonitor.updateSyncMetrics(Date.now() - 150, 0); // delay = 150 >= 100
    assert(statusManager.getStatus() === 'WARNING', 'Status should be WARNING on sync delay >= SYNC_WARNING_MS');

    // 許容同期遅延エラーの評価 (ERROR)
    healthMonitor.updateSyncMetrics(Date.now() - 350, 0); // delay = 350 >= 300
    assert(statusManager.getStatus() === 'ERROR', 'Status should be ERROR on sync delay >= SYNC_ERROR_MS');

    // GAS疎通不可の評価 (ERROR)
    healthMonitor.updateSyncMetrics(Date.now(), 0);
    healthMonitor.setGasAvailable(false);
    assert(statusManager.getStatus() === 'ERROR', 'Status should be ERROR when GAS is down');

    healthMonitor.setGasAvailable(true);
    assert(statusManager.getStatus() === 'NORMAL', 'Status should recover to NORMAL');

    console.log('[Test DashboardOperational] SystemHealthMonitor: PASSED');
  }

  // 3. NotificationCenter Tests
  {
    const notificationCenter = new NotificationCenter();
    const notifications: any[] = [];
    notificationCenter.subscribe((item) => {
      notifications.push(item);
    });

    notificationCenter.addNotification('Sync Success', '同期成功メッセージ');
    assert(notifications.length === 1, 'Subscriber should trigger on new notification');
    assert(notifications[0].type === 'Sync Success', 'Notification type mismatch');
    assert(notifications[0].message === '同期成功メッセージ', 'Notification message mismatch');

    // 保持上限 (50件) の検証
    for (let i = 0; i < 60; i++) {
      notificationCenter.addNotification('Warning', `警告通知番号: ${i}`);
    }
    const history = notificationCenter.getHistory();
    assert(history.length === 50, 'NotificationCenter must cap history size at 50');
    assert(history[49].message === '警告通知番号: 59', 'Latest notification should be at index 49');
    assert(history[0].message === '警告通知番号: 10', 'Old notifications should be shifted out');

    console.log('[Test DashboardOperational] NotificationCenter: PASSED');
  }

  // 4. HealthIndicator Tests
  {
    const indicator = new HealthIndicator();
    const element = indicator.getElement();
    assert(element !== null, 'Indicator element must be generated');

    // 状態によるラベルおよびスタイリングの切替テスト
    indicator.updateStatus('NORMAL');
    assert(element.style.color === 'rgb(16, 185, 129)' || element.style.color === '#10b981', 'NORMAL state color setup mismatch');

    indicator.updateStatus('ERROR');
    assert(element.style.color === 'rgb(239, 68, 68)' || element.style.color === '#ef4444', 'ERROR state color setup mismatch');

    console.log('[Test DashboardOperational] HealthIndicator: PASSED');
  }

  // 5. DashboardHeader Tests
  {
    const header = new DashboardHeader('POSTING MAP TEST STATION');
    assert(header.getElement() !== null, 'Header element must be generated');

    const coordinatorMock = {
      emittedEvents: [] as string[],
      emit(event: string) {
        this.emittedEvents.push(event);
      }
    };

    header.setCoordinator(coordinatorMock);
    
    // Force Refresh クリックシミュレーション
    const refreshBtn = header.getElement().querySelector('.force-refresh-button') as HTMLButtonElement;
    assert(refreshBtn !== null, 'Force Refresh button must be rendered in header');
    
    // click listener を直接トリガー
    refreshBtn.click();
    assert(coordinatorMock.emittedEvents.includes('refresh-requested'), 'Clicking Force Refresh button must emit refresh-requested');

    // メトリクス更新の検証
    header.updateMetrics({
      lastSyncTime: 1700000000000,
      lastSyncDuration: 1200,
      lastRetryCount: 1
    });

    console.log('[Test DashboardOperational] DashboardHeader: PASSED');
  }

  // 6. MetricsAggregator Tests
  {
    const cache = new CacheManager();
    const connection = new HAppConnectionState();
    const scheduler = new SynchronizationScheduler(connection, new RetryController(2, 5, 2));
    const conflict = new ConflictResolver();

    const aggregator = new MetricsAggregator(cache, scheduler, conflict);

    // ダミー活動
    cache.set('dashboard:test', { val: 1 });
    cache.get('dashboard:test'); // hit
    cache.get('dashboard:test-miss'); // miss

    const metrics = aggregator.getMetrics();
    assert(metrics.hitCount === 1, 'Aggregated hit count should be 1');
    assert(metrics.missCount === 1, 'Aggregated miss count should be 1');
    assert(metrics.hitRate === 0.5, 'Aggregated hit rate should be 0.5');
    assert(metrics.cacheSize === 1, 'Aggregated cache size should be 1');

    console.log('[Test DashboardOperational] MetricsAggregator: PASSED');
  }

  console.log('[Test DashboardOperational] All operational tests completed successfully.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  DASHBOARD OPERATIONAL PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[DashboardOperational Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
