/**
 * test_google_maps_engine.ts
 * 
 * GoogleMapsEngine および関連コントローラー・ローダーの単体・統合検証テスト。
 */

import { GoogleMapsEngine } from '../../../src/dashboard/map/GoogleMapsEngine';
import { GoogleMapsScriptLoader } from '../../../src/dashboard/map/GoogleMapsScriptLoader';
import { GoogleMapsConfiguration } from '../../../src/dashboard/map/GoogleMapsConfiguration';
import { AreaDetail, VoteTurnout, EventLogItem } from '../../../src/dashboard/DashboardStateModel';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// 1. DOM環境モック
class MockHTMLElement {
  style: any = {};
  className: string = '';
  innerHTML: string = '';
  children: any[] = [];
  appendChild(c: any) { this.children.push(c); }
  addEventListener() {}
}

const globalVar = globalThis as any;
globalVar.window = globalVar;
globalVar.document = {
  createElement: (tag: string) => {
    if (tag === 'script') {
      const script: any = new MockHTMLElement();
      // setTimeout で onload コールバックを呼ぶことで script load を模擬
      setTimeout(() => {
        if (script.onload) {
          script.onload();
        }
        // Google Maps callback 呼び出し
        if (globalVar.__googleMapsCallback) {
          globalVar.__googleMapsCallback();
        }
      }, 10);
      return script;
    }
    return new MockHTMLElement();
  },
  head: {
    appendChild: (child: any) => {}
  }
};

// 2. Google Maps API モック
class MockMap {
  center: any;
  zoom: number;
  options: any;
  constructor(container: any, options: any) {
    this.center = options.center;
    this.zoom = options.zoom;
    this.options = options;
  }
  panTo(latLng: any) {
    this.center = latLng;
  }
  setZoom(z: number) {
    this.zoom = z;
  }
  fitBounds(bounds: any) {
    // No-op for mock
  }
  setOptions(options: any) {
    this.options = { ...this.options, ...options };
  }
}

class MockCircle {
  options: any;
  map: any;
  radius: number;
  constructor(options: any) {
    this.options = options;
    this.map = options.map;
    this.radius = options.radius;
  }
  setMap(m: any) {
    this.map = m;
  }
  setOptions(opts: any) {
    this.options = { ...this.options, ...opts };
  }
  setRadius(r: number) {
    this.radius = r;
  }
}

class MockMarker {
  options: any;
  map: any;
  constructor(options: any) {
    this.options = options;
    this.map = options.map;
  }
  setMap(m: any) {
    this.map = m;
  }
}

class MockLatLngBounds {
  extended: any[] = [];
  extend(latLng: any) {
    this.extended.push(latLng);
  }
}

class MockLatLng {
  lat: number;
  lng: number;
  constructor(lat: number, lng: number) {
    this.lat = lat;
    this.lng = lng;
  }
}

globalVar.google = {
  maps: {
    Map: MockMap,
    Circle: MockCircle,
    Marker: MockMarker,
    LatLngBounds: MockLatLngBounds,
    LatLng: MockLatLng,
    SymbolPath: { CIRCLE: 0 },
    event: {
      addListener: (instance: any, eventName: string, handler: any) => {
        // テスト用のリスナー実行関数を追加
        instance[`__on_${eventName}`] = handler;
      },
      trigger: (instance: any, eventName: string) => {
        instance[`__triggered_${eventName}`] = true;
      }
    }
  }
};

// 3. テスト設定の設定
globalVar.POSTING_MAP_CONFIG = {
  MAP_ENGINE: 'google_maps',
  GOOGLE_MAPS_API_KEY: 'test-api-key-12345',
  DEFAULT_CENTER: { lat: 35.6895, lng: 139.6917 },
  DEFAULT_ZOOM: 14
};

async function runTest() {
  console.log('[Test GoogleMapsEngine] Starting tests...');

  // Configuration Provider 検証
  assert(GoogleMapsConfiguration.getApiKey() === 'test-api-key-12345', 'API key loading mismatch');
  assert(GoogleMapsConfiguration.getDefaultZoom() === 14, 'Zoom mismatch');
  assert(GoogleMapsConfiguration.getDefaultCenter().lat === 35.6895, 'Center lat mismatch');

  // Script Loader 検証
  GoogleMapsScriptLoader.resetForTest();
  const loaderPromise = GoogleMapsScriptLoader.load('test-api-key-12345');
  await loaderPromise;
  console.log('[Test GoogleMapsEngine] Script loader: PASSED');

  // Engine インスタンス検証
  let areaSelectedId: string | null = null;
  const engine = new GoogleMapsEngine((areaId: string) => {
    areaSelectedId = areaId;
  });

  const container = new MockHTMLElement() as any;
  engine.initialize(container);

  // initialize は非同期なので少し待つ
  await new Promise(resolve => setTimeout(resolve, 50));

  assert((engine as any).map !== null, 'Map should be initialized');
  assert((engine as any).cameraController !== null, 'CameraController should be initialized');
  assert((engine as any).layerManager !== null, 'LayerManager should be initialized');

  // showAreas 検証
  const mockAreas: readonly AreaDetail[] = [
    { areaId: 'AREA-A', areaName: '地区A', cityName: '津市', totalHouseholds: 100, representativeAddress: '', latitude: 34.5, longitude: 136.5, doneCount: 50, progressRate: 50 },
    { areaId: 'AREA-B', areaName: '地区B', cityName: '津市', totalHouseholds: 200, representativeAddress: '', latitude: 34.6, longitude: 136.6, doneCount: 200, progressRate: 100 }
  ];

  engine.showAreas(mockAreas);

  const layerManager = (engine as any).layerManager;
  assert(layerManager.areaOverlays.size === 2, 'Should render 2 area circle overlays');

  // エリアクリックシミュレーション
  const circleA = layerManager.areaOverlays.get('AREA-A');
  assert(circleA !== undefined, 'Circle overlay A should exist');
  assert(circleA.options.strokeColor === '#3b82f6', 'Progress area color should be blue');

  const circleB = layerManager.areaOverlays.get('AREA-B');
  assert(circleB !== undefined, 'Circle overlay B should exist');
  assert(circleB.options.strokeColor === '#10b981', 'Completed area color should be green');

  // クリックシミュレーション
  if (circleA.__on_click) {
    circleA.__on_click();
  }
  
  // click アニメーション遅延があるので待つ
  await new Promise(resolve => setTimeout(resolve, 150));
  assert(areaSelectedId === 'AREA-A', 'onAreaSelectedCallback should be triggered with AREA-A');

  // highlightArea 検証
  engine.highlightArea('AREA-A');
  assert(circleA.options.strokeWeight === 4, 'Highlighted circle strokeWeight should be 4');
  assert(circleB.options.strokeWeight === 2, 'Unhighlighted circle strokeWeight should be 2');

  // updateLayer (VoteTurnout) 検証
  const mockTurnouts: readonly VoteTurnout[] = [
    { areaId: 'AREA-A', electionId: 'HR-2024', electionType: 'HOUSE_OF_REPRESENTATIVES', electionDate: '2024', turnoutRate: 60, nationalAverage: 52 }
  ];
  engine.updateLayer('voteTurnout', { turnouts: mockTurnouts, areas: mockAreas });
  assert(layerManager.turnoutOverlays.length === 1, 'Should render 1 turnout overlay circle');

  // updateLayer (Activity) 検証
  const mockLogs: readonly EventLogItem[] = [
    { id: 'LOG-1', timestamp: Date.now(), tenantId: 'MIE-03', branchId: 'MIE-03', areaId: 'AREA-A', memberId: 'USER-1', actionType: 'distribute', count: 10, latitude: 34.501, longitude: 136.501, meta: {} }
  ];
  engine.updateLayer('activity', { logs: mockLogs });
  assert(layerManager.activityOverlays.length === 1, 'Should render 1 activity overlay marker');

  // 新規予約メソッド (setTheme, resize, fitBounds) 検証
  engine.setTheme('dark');
  assert((engine as any).map.options.styles !== undefined, 'Map style options should be set');
  engine.resize();
  assert((engine as any).map.__triggered_resize === true, 'Resize event trigger should be fired');
  engine.fitBounds(new (window as any).google.maps.LatLngBounds());

  // destroy 検証
  engine.destroy();
  assert((engine as any).map === null, 'Map should be null after destroy');
  assert((engine as any).layerManager === null, 'LayerManager should be null after destroy');

  console.log('[Test GoogleMapsEngine] All tests: PASSED');
}

runTest().then(() => {
  console.log('\n======================================');
  console.log('  GOOGLE MAPS ENGINE TESTS PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[GoogleMapsEngine Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
