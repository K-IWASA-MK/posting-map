import { PlatformIntegrationPipeline } from '../../../src/platform/PlatformIntegrationPipeline';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

const globalVar = globalThis as any;

let mockCacheStore: { [key: string]: string } = {};
globalVar.CacheService = {
  getScriptCache: () => ({
    get: (key: string) => mockCacheStore[key] || null,
    put: (key: string, val: string, ttl: number) => {
      mockCacheStore[key] = val;
    },
    remove: (key: string) => {
      delete mockCacheStore[key];
    }
  })
};

let mockScriptLock = {
  hasLock: false,
  tryLock: (timeout: number) => {
    mockScriptLock.hasLock = true;
    return true;
  },
  releaseLock: () => {
    mockScriptLock.hasLock = false;
  }
};
globalVar.LockService = {
  getScriptLock: () => mockScriptLock
};

globalVar.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key: string) => null
  })
};

let mockSheets: { [name: string]: any[][] } = {
  'Workspaces': [
    ['ワークスペースID', 'ワークスペース名', 'ステータス'],
    ['WS-MIE-01', '三重県 第1支部', 'ACTIVE'],
    ['WS-MIE-02', '三重県 第2支部', 'ACTIVE'],
    ['WS-MIE-03', '三重県 第3支部', 'ACTIVE']
  ],
  'Subscriptions': [
    ['ワークスペースID', 'ステータス', '開始日', '期限日'],
    ['WS-MIE-01', 'ACTIVE', '2026-07-01T00:00:00.000Z', new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()],
    ['WS-MIE-02', 'SUSPENDED', '2026-07-01T00:00:00.000Z', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()],
    ['WS-MIE-03', 'ACTIVE', '2026-07-01T00:00:00.000Z', new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()]
  ]
};

globalVar.SpreadsheetApp = {
  openById: (id: string) => ({
    getSheetByName: (name: string) => {
      if (!mockSheets[name]) return null;
      return {
        getLastRow: () => mockSheets[name].length,
        getLastColumn: () => mockSheets[name][0].length,
        getRange: (row: number, col: number, numRows: number, numCols: number) => ({
          getValues: () => {
            const data = [];
            for (let r = 0; r < numRows; r++) {
              const rowIndex = row - 1 + r;
              if (rowIndex < mockSheets[name].length) {
                data.push(mockSheets[name][rowIndex].slice(col - 1, col - 1 + numCols));
              }
            }
            return data;
          },
          setValues: (vals: any[][]) => {
            for (let r = 0; r < numRows; r++) {
              const rowIndex = row - 1 + r;
              if (rowIndex >= mockSheets[name].length) {
                mockSheets[name].push([]);
              }
              for (let c = 0; c < vals[r].length; c++) {
                mockSheets[name][rowIndex][col - 1 + c] = vals[r][c];
              }
            }
          }
        })
      };
    }
  })
};

globalVar.createJsonResponseFromApiResponse = (apiResponse: any) => {
  return {
    body: apiResponse,
    mimeType: 'JSON'
  };
};

async function runIntegrationTest() {
  console.log('[Integration Test Operations Dashboard] Starting dashboard flow validation...');

  const event = {
    parameter: {
      action: 'operations/dashboard/workspaces',
      apiKey: 'valid-api-key',
      version: 'v2'
    }
  };

  const response = await PlatformIntegrationPipeline.execute(event);
  assert(response !== null, 'Response should not be null');
  assert(response.body !== undefined, 'Response must contain body');

  const body = response.body;
  assert(body.status === 200, `Expected status 200, got ${body.status}`);
  assert(body.success === true, 'Expected success: true');

  const data = body.data;
  assert(Array.isArray(data), 'Expected array data payload');
  assert(data.length === 3, `Expected 3 workspaces, got ${data.length}`);

  // Workspace 1
  const ow1 = data.find((w: any) => w.workspaceId === 'WS-MIE-01');
  assert(ow1 !== undefined, 'Workspace 1 not found');
  assert(ow1.workspaceName === '三重県 第1支部', 'Name mismatch');
  assert(ow1.status === 'ACTIVE', 'Status mismatch');
  assert(ow1.remainingDays === 10, `Expected 10 remaining days, got ${ow1.remainingDays}`);

  // Workspace 2 (Expired)
  const ow2 = data.find((w: any) => w.workspaceId === 'WS-MIE-02');
  assert(ow2 !== undefined, 'Workspace 2 not found');
  assert(ow2.status === 'SUSPENDED', 'Status mismatch');
  assert(ow2.remainingDays === 0, `Expected 0 remaining days for expired, got ${ow2.remainingDays}`);

  // Workspace 3
  const ow3 = data.find((w: any) => w.workspaceId === 'WS-MIE-03');
  assert(ow3 !== undefined, 'Workspace 3 not found');
  assert(ow3.status === 'ACTIVE', 'Status mismatch');
  assert(ow3.remainingDays === 45, `Expected 45 remaining days, got ${ow3.remainingDays}`);

  console.log('[Integration Test Operations Dashboard] Flow verification: PASSED.');
}

runIntegrationTest().catch(error => {
  console.error('[Integration Test Operations Dashboard] Failed!');
  console.error(error);
  process.exit(1);
});
