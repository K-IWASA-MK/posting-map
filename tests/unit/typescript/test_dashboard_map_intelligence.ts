import { AreaDetail, VoteTurnout, EventLogItem } from '../../../src/dashboard/DashboardStateModel';
import { MapDataLayer } from '../../../src/dashboard/map/MapDataLayer';
import { AreaHeatLayer } from '../../../src/dashboard/map/AreaHeatLayer';
import { AreaSelectionController } from '../../../src/dashboard/map/AreaSelectionController';
import { VoteTurnoutVisualizer } from '../../../src/dashboard/map/VoteTurnoutVisualizer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// Global browser DOM mock
class MockHTMLElement {
  style: any = {
    setProperty: (key: string, val: string) => {
      this.style[key] = val;
    }
  };
  children: MockHTMLElement[] = [];
  innerHTML: string = '';
  innerText: string = '';
  appendChild(child: any) {
    this.children.push(child);
  }
}

const globalVar = global as any;
globalVar.document = {
  createElement: (tag: string) => new MockHTMLElement()
};

function testMapDataLayer() {
  console.log('[Test 5] MapDataLayer mapping starting...');

  const mockAreas: AreaDetail[] = [
    {
      areaId: 'AREA-001',
      areaName: '地区A',
      cityName: '四日市',
      totalHouseholds: 500,
      representativeAddress: '三重県',
      latitude: 34,
      longitude: 136,
      doneCount: 250,
      progressRate: 50
    }
  ];

  const mockTurnouts: VoteTurnout[] = [
    {
      areaId: 'AREA-001',
      electionId: 'HR-2024',
      electionType: 'HOUSE_OF_REPRESENTATIVES',
      electionDate: '2024-10-27',
      turnoutRate: 0.651,
      nationalAverage: 0.521
    },
    {
      areaId: 'AREA-001',
      electionId: 'HC-2022',
      electionType: 'HOUSE_OF_COUNCILLORS',
      electionDate: '2022-07-10',
      turnoutRate: 0.624,
      nationalAverage: 0.518
    }
  ];

  const mockLogs: EventLogItem[] = [
    {
      id: 'EV-001',
      timestamp: 1718000000000,
      tenantId: 'MIE-03',
      branchId: 'MIE-03',
      areaId: 'AREA-001',
      memberId: 'MIE-03-S001',
      actionType: 'distribute',
      count: 100,
      latitude: 34,
      longitude: 136,
      meta: {}
    }
  ];

  const nodes = MapDataLayer.buildVisualNodes(mockAreas, mockTurnouts, mockLogs);
  assert(nodes.length === 1, 'Should build exactly 1 node');
  assert(nodes[0].areaId === 'AREA-001', 'Incorrect area mapping');
  assert(nodes[0].latestTurnout === 0.651, 'Latest turnout mapping mismatch');
  assert(nodes[0].historicalTurnouts.length === 2, 'Historical turnouts count mismatch');
  assert(nodes[0].recentLogs.length === 1, 'Logs count mismatch');

  console.log('[Test 5] PASSED');
}

function testAreaHeatLayerStyles() {
  console.log('[Test 6] AreaHeatLayer styling starting...');

  // Progress Style Verification
  const styleCompleted = AreaHeatLayer.getActivityProgressStyle(100);
  assert(styleCompleted.color === '#10b981', 'Completed status color mismatch');

  const styleInProgress = AreaHeatLayer.getActivityProgressStyle(50);
  assert(styleInProgress.color === '#3b82f6', 'In-progress status color mismatch');

  // Turnout Style Verification (Purples)
  const styleHighTurnout = AreaHeatLayer.getVoteTurnoutStyle(0.75);
  assert(styleHighTurnout.color === '#a855f7', 'High turnout rate color mismatch');

  const styleLowTurnout = AreaHeatLayer.getVoteTurnoutStyle(0.40);
  assert(styleLowTurnout.color === 'rgba(255, 255, 255, 0.4)', 'Low turnout rate color mismatch');

  console.log('[Test 6] PASSED');
}

async function testVoteTurnoutVisualizer() {
  console.log('[Test 7] VoteTurnoutVisualizer drawing starting...');

  const visualizer = new VoteTurnoutVisualizer();
  const mockTurnouts: VoteTurnout[] = [
    {
      areaId: 'AREA-001',
      electionId: 'HR-2024',
      electionType: 'HOUSE_OF_REPRESENTATIVES',
      electionDate: '2024-10-27',
      turnoutRate: 0.651,
      nationalAverage: 0.521
    }
  ];

  visualizer.render(mockTurnouts);
  const element = visualizer.getElement() as any;
  assert(element.children.length === 1, 'Visual container should hold exactly 1 chart row');

  console.log('[Test 7] PASSED');
}

// Run All Tests
testMapDataLayer();
testAreaHeatLayerStyles();
testVoteTurnoutVisualizer().then(() => {
  console.log('\n======================================');
  console.log('  MAP INTELLIGENCE TEST PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[Map Intelligence Test Failure]', err);
  process.exit(1);
});
