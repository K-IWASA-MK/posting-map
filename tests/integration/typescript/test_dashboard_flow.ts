import { PlatformIntegrationPipeline } from '../../../src/platform/PlatformIntegrationPipeline';
import { GasConfigurationProvider } from '@infra/gas/GasConfigurationProvider';

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

// Seed sheets with 3 members: A, B, C (1200, 800, 500 holding & activities)
let mockSheets: { [name: string]: any[][] } = {
  'Flyers': [
    ['ID', 'スタッフID', 'スタッフ名', '保管場所', '保管枚数', '更新日時'],
    ['Holding-S001', 'S001', 'Aさん', '自宅', '1200', String(Date.now())],
    ['Holding-S002', 'S002', 'Bさん', '自宅', '800', String(Date.now())],
    ['Holding-S003', 'S003', 'Cさん', '自宅', '500', String(Date.now())]
  ],
  'Staff': [
    ['スタッフID', 'スタッフ名', 'LINEユーザーID', 'ワークスペースID', '登録日時'],
    ['S001', 'Aさん', 'line-A', 'WS-MIE-03', String(Date.now())],
    ['S002', 'Bさん', 'line-B', 'WS-MIE-03', String(Date.now())],
    ['S003', 'Cさん', 'line-C', 'WS-MIE-03', String(Date.now())]
  ],
  'Activity': [
    ['活動ID', 'スタッフID', '報告枚数', '写真URL', '位置情報', '活動日時'],
    ['ACT001', 'S001', '1200', 'http://a.jpg', '34,136', String(Date.now())],
    ['ACT002', 'S002', '800', 'http://b.jpg', '34,136', String(Date.now())],
    ['ACT003', 'S003', '500', 'http://c.jpg', '34,136', String(Date.now())]
  ],
  'Workspaces': [
    ['ワークスペースID', 'ワークスペース名', 'ステータス'],
    ['WS-MIE-03', '三重第3支部', 'ACTIVE']
  ],
  'Subscriptions': [
    ['ワークスペースID', 'ステータス', '開始日', '期限日'],
    ['WS-MIE-03', 'ACTIVE', '2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z']
  ],
  'EventLogs': [
    ['Event ID', 'Timestamp', 'Type', 'Payload']
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
  console.log('[Integration Test Dashboard Flow] Starting integration test flow...');

  // Stage 1: GET /dashboard/me?lineUserId=line-B
  {
    const e = {
      parameter: {
        action: 'dashboard/me',
        lineUserId: 'line-B',
        apiKey: 'valid-api-key',
        v: 'v2'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(e);
    const body = response.body;

    if (!body.success) {
      console.log('GET /dashboard/me failed with response:', JSON.stringify(body, null, 2));
    }
    assert(body.success === true, 'Response must be success');
    assert(body.data.name === 'Bさん', 'Name must be Bさん');
    assert(body.data.holding === 800, 'B should hold 800');
    assert(body.data.monthlyActivity === 800, 'B should have 800 activity');
  }

  // Stage 2: GET /dashboard/workspace/WS-MIE-03
  {
    const e = {
      parameter: {
        action: 'dashboard/workspace/WS-MIE-03',
        path: '/dashboard/workspace/WS-MIE-03',
        apiKey: 'valid-api-key',
        v: 'v2'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(e);
    const body = response.body;

    assert(body.success === true, 'Workspace response must be success');
    assert(body.data.name === '三重第3支部', 'Workspace name must match');
    assert(body.data.total === 2500, `Total holding mismatch: expected 2500, got ${body.data.total}`); // 1200 + 800 + 500 = 2500
    assert(body.data.members.length === 3, 'Workspace members length should be 3');
    assert(body.data.newMembers.length === 3, 'Workspace new members length should be 3');
    
    // S5-9 verification
    assert(body.data.memberCount === 3, 'memberCount must be 3');
    assert(body.data.newMemberCount === 3, 'newMemberCount must be 3');
    assert(body.data.growthRate !== undefined, 'growthRate must be defined');
    assert(body.data.monthlyTrend.length === 6, 'monthlyTrend length must be 6');
    assert(body.data.members[0].activityIndex !== undefined, 'activityIndex must be defined');
    assert(body.data.newMembers[0].firstActivityDate !== undefined, 'firstActivityDate must be defined');
  }

  // Stage 3: GET /dashboard/ranking?workspaceId=WS-MIE-03
  {
    const e = {
      parameter: {
        action: 'dashboard/ranking',
        workspaceId: 'WS-MIE-03',
        apiKey: 'valid-api-key',
        v: 'v2'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(e);
    const body = response.body;

    assert(body.success === true, 'Ranking response must be success');
    assert(body.data.length === 3, 'Rankings length mismatch');
    assert(body.data[0].rank === 1, 'Rank 1 must be correct');
    assert(body.data[0].name === 'Aさん', 'Rank 1 name mismatch');
    assert(body.data[0].quantity === 1200, 'Rank 1 quantity mismatch');
    assert(body.data[1].rank === 2, 'Rank 2 must be correct');
    assert(body.data[1].name === 'Bさん', 'Rank 2 name mismatch');
    assert(body.data[1].quantity === 800, 'Rank 2 quantity mismatch');
  }

  console.log('[Integration Test Dashboard Flow] All integration test cases passed!');
}

runIntegrationTest().catch(err => {
  console.error('[Integration Test Dashboard Flow] FAILED:', err);
  process.exit(1);
});
