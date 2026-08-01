/**
 * test_dashboard_mvp_integration.ts
 * 
 * 製品版 POSTING MAP Dashboard MVP 用の最終統合テスト。
 * アプリケーションの起動フロー、MapEngine アダプターへの委譲、メディエーター(Coordinator)の
 * イベント伝搬、およびリフレッシュ制御（10秒ロックガード）の全フローを検証します。
 */

import { DashboardApplication } from '../../../src/dashboard/DashboardApplication';
import { DashboardApiClient } from '../../../src/dashboard/DashboardApiClient';
import { DashboardStateModel } from '../../../src/dashboard/DashboardStateModel';
import { DOMMapEngine } from '../../../src/dashboard/map/MapEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// 1. ブラウザ DOM 環境のモック化
class MockHTMLElement {
  style: any = {
    setProperty: (key: string, val: string) => {
      this.style[key] = val;
    }
  };
  className: string = '';
  innerText: string = '';
  innerHTML: string = '';
  children: MockHTMLElement[] = [];

  appendChild(child: any) {
    this.children.push(child);
  }

  addEventListener(event: string, callback: any) {
    // No-op
  }

  querySelectorAll(selector: string) {
    return [];
  }
}

const globalVar = globalThis as any;
globalVar.document = {
  createElement: (tag: string) => new MockHTMLElement()
};

// 2. グローバル fetch API のモック化
globalVar.fetch = async (url: string, init?: any) => {
  const body = init && init.body ? JSON.parse(init.body) : {};
  const action = body.action;

  let responseData: any = { success: true };

  if (action === 'getDashboard') {
    responseData = {
      success: true,
      data: {
        branchName: 'MIE-03',
        stats: { totalHouseholds: 500, totalCompleted: 250 },
        areas: [
          { areaId: 'AREA-01', name: '四日市-001', totalHouseholds: 200, doneCount: 100, latitude: 34, longitude: 136 }
        ],
        cities: [
          { cityName: '四日市市', doneCount: 100, totalCount: 200 }
        ]
      }
    };
  } else if (action === 'getVoteTurnout') {
    responseData = {
      success: true,
      data: {
        turnouts: [
          { areaId: 'AREA-01', electionId: 'HR-2024', electionType: 'HOUSE_OF_REPRESENTATIVES', electionDate: '2024-10-27', turnoutRate: 0.61, nationalAverage: 0.52 }
        ]
      }
    };
  } else if (action === 'getEventLog') {
    responseData = {
      success: true,
      data: {
        logs: [
          { id: 'EV-01', timestamp: Date.now(), tenantId: 'MIE-03', branchId: 'MIE-03', areaId: 'AREA-01', memberId: 'MIE-03-S01', actionType: 'distribute', count: 100 }
        ]
      }
    };
  }

  return {
    ok: true,
    json: async () => responseData
  } as any;
};

// 3. 統合検証フローの実行
async function runIntegrationTest() {
  console.log('[Test MVP] Integrating Dashboard MVP boot sequence starting...');

  const app = DashboardApplication.getInstance();
  const root = new MockHTMLElement() as any;

  // アプリケーション起動
  await app.start(root, 'https://script.google.com/macros/s/mock-url/exec', 'MIE-03', 'MIE-03');

  // インスタンス取得と内部状態の検証
  const stateModel = (app as any).stateModel as DashboardStateModel;
  const coordinator = (app as any).eventCoordinator;
  const refreshController = (app as any).refreshController;

  assert(stateModel !== undefined, 'StateModel must be instantiated');
  assert(coordinator !== undefined, 'EventCoordinator must be instantiated');
  assert(refreshController !== undefined, 'RefreshController must be instantiated');

  // データ同期状況の確認
  const data = stateModel.getData();
  assert(data !== null, 'Data should be loaded after app.start()');
  assert(data!.branchName === 'MIE-03', 'Branch Name must match mock data');
  assert(data!.stats.progressRate === 50, 'Progress rate should be mapped to 50%');

  // 4. イベントコーディネーター（メディエーター）の連携検証
  let eventFired = false as boolean;
  coordinator.on('area-selected-success', (areaId: string) => {
    eventFired = true;
    assert(areaId === 'AREA-01', 'Event payload must propagate selected AreaID');
  });

  await coordinator.handleAreaSelected('AREA-01');
  assert(eventFired === true, 'Coordinator event pipeline must trigger successfully');

  // 投票率がロードされたことを検証
  const turnouts = stateModel.getVoteTurnouts();
  assert(turnouts.length === 1, 'Historical turnouts count mismatch');
  assert(turnouts[0].turnoutRate === 0.61, 'Turnout rate mismatch');

  // 5. リフレッシュコントローラー（10秒ガードロック）の検証
  let refreshFired = false as boolean;
  coordinator.on('refresh-start', () => {
    refreshFired = true;
  });

  // 初回リフレッシュトリガー（成功するはず）
  const success1 = await refreshController.triggerManualRefresh('MIE-03', 'MIE-03');
  assert(success1 === true, 'First manual refresh must be allowed');
  assert(refreshFired === true, 'Refresh start event must fire');

  // 連続リフレッシュトリガー（10秒ロックによりブロックされるはず）
  const success2 = await refreshController.triggerManualRefresh('MIE-03', 'MIE-03');
  assert(success2 === false, 'Consecutive refresh within 10s must be blocked by lock guard');

  // 後処理
  app.destroy();
  console.log('[Test MVP] Integration flow: PASSED');
}

// 実行
runIntegrationTest().then(() => {
  console.log('\n======================================');
  console.log('  DASHBOARD MVP INTEGRATION PASSED');
  console.log('======================================\n');
}).catch((err) => {
  console.error('[Integration Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
