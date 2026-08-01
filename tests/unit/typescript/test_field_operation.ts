import { DistributionStatusManager } from '../../../src/dashboard/field/DistributionStatusManager';
import { InventoryMonitor } from '../../../src/dashboard/field/InventoryMonitor';
import { GPSEvidenceMonitor } from '../../../src/dashboard/field/GPSEvidenceMonitor';
import { PhotoEvidenceMonitor } from '../../../src/dashboard/field/PhotoEvidenceMonitor';
import { FieldOperationMetrics } from '../../../src/dashboard/field/FieldOperationMetrics';
import { FieldOperationController } from '../../../src/dashboard/field/FieldOperationController';
import { NotificationCenter } from '../../../src/dashboard/operations/NotificationCenter';
import { DashboardEventCoordinator } from '../../../src/dashboard/DashboardEventCoordinator';
import { DashboardStateModel, EventLogItem } from '../../../src/dashboard/DashboardStateModel';

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

globalVar.document = {
  createElement(tag: string) {
    return {
      tagName: tag.toUpperCase(),
      style: {
        setProperty(name: string, value: string) {
          (this as any)[name] = value;
        }
      },
      appendChild(child: any) { return child; },
      addEventListener(event: string, cb: any) {},
      classList: {
        add() {},
        remove() {}
      },
      id: '',
      innerText: '',
      innerHTML: '',
      remove() {}
    } as any;
  },
  head: {
    appendChild(child: any) {}
  },
  body: {
    appendChild(child: any) {}
  },
  getElementById(id: string) {
    return null;
  }
} as any;

async function runTests() {
  console.log('[Test FieldOperation] Starting field operation tests...');

  // 1. DistributionStatusManager Tests
  {
    const manager = new DistributionStatusManager();
    const area = {
      areaId: 'AREA-01',
      areaName: '地区01',
      cityName: '市区01',
      totalHouseholds: 200,
      representativeAddress: '代表住所01',
      doneCount: 0,
      progressRate: 0,
      latitude: 0,
      longitude: 0
    };

    assert(manager.getStatus('AREA-01', area) === 'NOT_STARTED', 'Initial status must be NOT_STARTED');

    // 配布中の自動判定
    area.doneCount = 50;
    manager.updateFromArea(area);
    assert(manager.getStatus('AREA-01', area) === 'IN_PROGRESS', 'Status must transition to IN_PROGRESS');

    // 完了の自動判定
    area.doneCount = 200;
    manager.updateFromArea(area);
    assert(manager.getStatus('AREA-01', area) === 'COMPLETED', 'Status must transition to COMPLETED');

    // 手動PAUSED優先
    manager.setStatus('AREA-01', 'PAUSED');
    assert(manager.getStatus('AREA-01', area) === 'PAUSED', 'Status must manually override to PAUSED');

    // 手動設定クリアで自動判定に復帰
    manager.resetStatus('AREA-01');
    assert(manager.getStatus('AREA-01', area) === 'COMPLETED', 'Status must restore to COMPLETED after resetStatus');

    console.log('[Test FieldOperation] DistributionStatusManager: PASSED');
  }

  // 2. InventoryMonitor Tests
  {
    const notifyCenter = new NotificationCenter();
    const monitor = new InventoryMonitor(notifyCenter);
    const notifications: any[] = [];
    notifyCenter.subscribe((n: any) => notifications.push(n));

    // 通常残数
    monitor.updateInventory('FLYER-01', 300, 100);
    assert(monitor.getInventory('FLYER-01')?.isLowStock === false, 'Stock should be normal');
    assert(notifications.length === 0, 'No warning notification should be created when stock is healthy');

    // 警告ライン以下
    monitor.updateInventory('FLYER-01', 99, 100);
    assert(monitor.getInventory('FLYER-01')?.isLowStock === true, 'Stock should be low');
    assert(notifications.length === 1, 'Warning notification should be generated');
    assert(notifications[0].type === 'Warning', 'Notification type must be Warning');

    console.log('[Test FieldOperation] InventoryMonitor: PASSED');
  }

  // 3. GPSEvidenceMonitor Tests
  {
    const monitor = new GPSEvidenceMonitor();
    
    // GPS位置登録
    const now = Date.now();
    monitor.updateLocation('MEMBER-01', 34.5, 136.5, now, 10);
    assert(monitor.getLocation('MEMBER-01')?.latitude === 34.5, 'GPS latitude mismatch');
    assert(monitor.getActiveMembersCount() === 1, 'Active member count mismatch');

    // 古い位置情報の登録 (16分前)
    monitor.updateLocation('MEMBER-02', 34.6, 136.6, now - 16 * 60 * 1000, 5);
    assert(monitor.getActiveMembersCount() === 1, 'Active member count should ignore old locations');

    console.log('[Test FieldOperation] GPSEvidenceMonitor: PASSED');
  }

  // 4. PhotoEvidenceMonitor Tests
  {
    const monitor = new PhotoEvidenceMonitor();
    const now = Date.now();

    monitor.addPhoto('PH-01', 'MEMBER-01', 'AREA-01', 'https://example.com/p1.png', now - 1000);
    monitor.addPhoto('PH-02', 'MEMBER-01', 'AREA-01', 'https://example.com/p2.png', now); // 最新

    assert(monitor.getPhotos('AREA-01').length === 2, 'Total photo records count mismatch');
    assert(monitor.getLatestPhoto('AREA-01')?.photoId === 'PH-02', 'Latest photo mismatch');
    assert(monitor.getCoveredAreasCount() === 1, 'Covered areas count mismatch');

    console.log('[Test FieldOperation] PhotoEvidenceMonitor: PASSED');
  }

  // 5. FieldOperationMetrics & Controller integration Tests
  {
    const stateModelMock = {
      data: {
        areas: [
          { areaId: 'AREA-01', areaName: 'A1', cityName: 'C1', totalHouseholds: 100, representativeAddress: 'Addr1', doneCount: 100, progressRate: 100, latitude: 0, longitude: 0 },
          { areaId: 'AREA-02', areaName: 'A2', cityName: 'C2', totalHouseholds: 200, representativeAddress: 'Addr2', doneCount: 50, progressRate: 25, latitude: 0, longitude: 0 }
        ]
      },
      getData() {
        return this.data;
      },
      subscribe(cb: any) {}
    } as any;

    const coordinatorMock = {
      emitted: [] as { event: string; args: any }[],
      emit(event: string, args: any) {
        this.emitted.push({ event, args });
      }
    } as any;

    const statusManager = new DistributionStatusManager();
    const inventoryMonitor = new InventoryMonitor();
    const gpsEvidenceMonitor = new GPSEvidenceMonitor();
    const photoEvidenceMonitor = new PhotoEvidenceMonitor();
    
    const metrics = new FieldOperationMetrics(
      statusManager,
      inventoryMonitor,
      gpsEvidenceMonitor,
      photoEvidenceMonitor,
      stateModelMock
    );

    const controller = new FieldOperationController(
      statusManager,
      inventoryMonitor,
      gpsEvidenceMonitor,
      photoEvidenceMonitor,
      metrics,
      coordinatorMock,
      stateModelMock
    );

    // 初期データ読み込みをシミュレート
    stateModelMock.data.areas.forEach((area: any) => statusManager.updateFromArea(area));

    // 新着ログ(GPS/写真/在庫残数含む)の登録
    const log: EventLogItem = {
      id: 'EV-01',
      timestamp: Date.now(),
      tenantId: 'T1',
      branchId: 'B1',
      areaId: 'AREA-02',
      memberId: 'MEMBER-01',
      actionType: 'DELIVERY',
      count: 10,
      latitude: 35.1,
      longitude: 136.2,
      meta: {
        accuracy: 8,
        photoUrl: 'https://example.com/e1.png',
        photoId: 'PHOTO-01',
        remainingSheets: 450,
        lowStockThreshold: 100
      }
    };

    controller.processIncomingLog(log);

    // モニター内の値の検証
    assert(gpsEvidenceMonitor.getLocation('MEMBER-01')?.latitude === 35.1, 'GPS latitude mismatch from EventLog');
    assert(photoEvidenceMonitor.getLatestPhoto('AREA-02')?.photoUrl === 'https://example.com/e1.png', 'Photo URL mismatch from EventLog');
    assert(inventoryMonitor.getInventory('FLYER-MEMBER-01')?.remaining === 450, 'Remaining sheets count mismatch from EventLog');

    // コーディネーターへイベントが流れていることを検証
    const events = coordinatorMock.emitted.map((e: any) => e.event);
    assert(events.includes('gps-updated'), 'GPS update event must be emitted');
    assert(events.includes('photo-updated'), 'Photo update event must be emitted');
    assert(events.includes('inventory-updated'), 'Inventory update event must be emitted');

    // 現場メトリクスの集計検証
    const summary = metrics.getMetricsSummary();
    assert(summary.completedAreasCount === 1, 'Completed areas count should be 1 (AREA-01)');
    assert(summary.activeMembersCount === 1, 'Active member count should be 1 (MEMBER-01)');
    assert(summary.gpsCoverageRate === 0.5, 'GPS coverage rate mismatch');
    assert(summary.photoCoverageRate === 0.5, 'Photo coverage rate mismatch');

    // GPS履歴制限の上限検証
    for (let i = 0; i < 120; i++) {
      gpsEvidenceMonitor.updateLocation('MEMBER-LIMIT-TEST', 34.0, 135.0, Date.now(), 5);
    }
    assert(gpsEvidenceMonitor.getHistory('MEMBER-LIMIT-TEST').length === 100, 'GPS history must be capped at 100');

    // 不正写真URLの除外検証
    photoEvidenceMonitor.addPhoto('PH-BAD', 'MEMBER-01', 'AREA-02', 'invalid-url-string', Date.now());
    assert(photoEvidenceMonitor.getLatestPhoto('AREA-02')?.photoId !== 'PH-BAD', 'Invalid photo URL must be rejected');

    // グローバル設定からのしきい値取得検証
    (globalThis as any).window.POSTING_MAP_CONFIG = {
      SETTINGS: { INVENTORY_THRESHOLD: 150 }
    };
    inventoryMonitor.updateInventory('FLYER-CONFIG-TEST', 140);
    assert(inventoryMonitor.getInventory('FLYER-CONFIG-TEST')?.isLowStock === true, 'Low stock must be resolved using config settings');
    assert(inventoryMonitor.getInventory('FLYER-CONFIG-TEST')?.threshold === 150, 'Threshold value must map to config setting value');

    console.log('[Test FieldOperation] Metrics & Controller integration: PASSED');
  }

  console.log('[Test FieldOperation] All field operation tests completed successfully.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  FIELD OPERATION TESTS PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[FieldOperation Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
