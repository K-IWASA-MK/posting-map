import { DashboardStateModel, DashboardData } from '../../../src/dashboard/DashboardStateModel';
import { DashboardApiClient } from '../../../src/dashboard/DashboardApiClient';
import { DashboardLayout } from '../../../src/dashboard/components/DashboardLayout';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// 1. Browser DOM Mocking for Node.js test environment
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
    // No-op for mock
  }
}

// Inject global mocks
const globalVar = global as any;
globalVar.document = {
  createElement: (tag: string) => {
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      return new MockHTMLElement();
    }
    if (tag === 'span' || tag === 'p' || tag === 'div' || tag === 'button') {
      return new MockHTMLElement();
    }
    return new MockHTMLElement();
  }
};

class MockApiClient extends DashboardApiClient {
  constructor() {
    super('https://script.google.com/macros/s/mock-url/exec');
  }
  override async request<T = any>(action: string, params: Record<string, any> = {}): Promise<any> {
    return { success: true };
  }
}

// Test Suite: Component instantiation and binding verification
async function testPremiumUIComponents() {
  console.log('[Test 4] DashboardPremiumUI components layout starting...');

  const client = new MockApiClient();
  const stateModel = new DashboardStateModel(client);
  
  // Create layout
  const layout = new DashboardLayout(stateModel);
  assert(layout.getElement() instanceof MockHTMLElement, 'Layout container must be an HTML Element');

  // Trigger state load mock success
  const mockData: DashboardData = {
    branchName: 'MIE-03',
    stats: {
      totalHouseholds: 1000,
      totalCompleted: 400,
      progressRate: 40
    },
    areas: [
      {
        areaId: 'MIE-03-YOK-001',
        areaName: '四日市-001',
        cityName: '四日市市',
        totalHouseholds: 100,
        representativeAddress: '三重県',
        latitude: 34,
        longitude: 136,
        doneCount: 40,
        progressRate: 40
      }
    ],
    cities: [
      { cityName: '四日市市', doneCount: 40, totalCount: 100 }
    ]
  };

  // Directly set model state and notify
  (stateModel as any).data = mockData;
  (stateModel as any).notify();

  // Verify elements populated
  const element = layout.getElement() as any;
  assert(element.children.length > 0, 'Layout must contain populated child views');

  console.log('[Test 4] PASSED');
}

testPremiumUIComponents().then(() => {
  console.log('\n======================================');
  console.log('  UI COMPONENT TEST PASSED');
  console.log('======================================\n');
}).catch((err) => {
  console.error('[UI Component Test Failure]', err);
  process.exit(1);
});
