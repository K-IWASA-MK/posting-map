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
    ['ワークスペースID', 'ワークスペース名', 'ステータス', '月間配布目標', '目標更新日時', '最終更新者'],
    ['WS-MIE-01', '三重県 第1支部', 'ACTIVE', '', '', ''],
    ['WS-MIE-02', '三重県 第2支部', 'ACTIVE', '', '', ''],
    ['WS-MIE-03', '三重県 第3支部', 'ACTIVE', '', '', '']
  ],
  'Subscriptions': [
    ['ワークスペースID', 'ステータス', '開始日', '期限日'],
    ['WS-MIE-01', 'ACTIVE', '2026-07-01T00:00:00.000Z', new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()],
    ['WS-MIE-02', 'SUSPENDED', '2026-07-01T00:00:00.000Z', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()],
    ['WS-MIE-03', 'ACTIVE', '2026-07-01T00:00:00.000Z', new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()]
  ],
  'Staff': [
    ['スタッフID', 'スタッフ名', 'LINEユーザーID', 'ワークスペースID', '登録日時'],
    ['S001', 'Aさん', 'line-A', 'mie-04', String(Date.now())]
  ],
  'Flyers': [
    ['ID', 'スタッフID', 'スタッフ名', '保管場所', '保管枚数', '更新日時'],
    ['Holding-S001', 'S001', 'Aさん', '自宅', '1200', String(Date.now())]
  ],
  'Activity': [
    ['活動ID', 'スタッフID', '報告枚数', '写真URL', '位置情報', '活動日時'],
    ['ACT001', 'S001', '1200', 'http://a.jpg', '34,136', String(Date.now())]
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
        }),
        appendRow: (rowVals: any[]) => {
          mockSheets[name].push(rowVals);
        }
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
  console.log('[Integration Test Workspace Flow] Starting workspace integration test flow...');

  // 1. Create a new workspace: POST /operations/workspaces
  {
    const postEvent = {
      parameter: {
        action: 'operations/workspaces',
        apiKey: 'valid-api-key',
        version: 'v2'
      },
      postData: {
        contents: JSON.stringify({
          action: 'operations/workspaces',
          apiKey: 'valid-api-key',
          version: 'v2',
          workspaceName: '三重県 第4支部'
        })
      }
    };

    const response = await PlatformIntegrationPipeline.execute(postEvent);
    const body = response.body;
    assert(body.success === true, 'Response must be success');
    assert(body.data.workspaceId === 'mie-04', `Expected mie-04, got ${body.data.workspaceId}`);
  }

  // 2. Fetch created workspace settings: GET /operations/workspaces?workspaceId=mie-04
  {
    const getEvent = {
      parameter: {
        action: 'operations/workspaces',
        workspaceId: 'mie-04',
        apiKey: 'valid-api-key',
        version: 'v2'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(getEvent);
    const body = response.body;
    assert(body.success === true, 'Get response must be success');
    assert(body.data.workspaceId === 'mie-04', 'ID mismatch');
    assert(body.data.distributionGoal === null, 'Initial goal should be null');
  }

  // 3. Update Goal: POST /operations/workspaces (action = updateWorkspaceGoal)
  {
    const updateEvent = {
      parameter: {
        action: 'updateWorkspaceGoal',
        apiKey: 'valid-api-key',
        version: 'v2'
      },
      postData: {
        contents: JSON.stringify({
          action: 'updateWorkspaceGoal',
          workspaceId: 'mie-04',
          distributionGoal: 5000,
          updatedBy: 'manager@mie.example.com',
          apiKey: 'valid-api-key',
          version: 'v2'
        })
      }
    };

    const response = await PlatformIntegrationPipeline.execute(updateEvent);
    const body = response.body;
    assert(body.success === true, 'Update response must be success');
    assert(body.data.distributionGoal === 5000, 'Expected goal to be 5000');
    assert(body.data.goalUpdatedBy === 'manager@mie.example.com', 'Expected updated by to be manager');
    assert(body.data.goalUpdatedAt !== null, 'Expected updated at to be populated');
  }

  // 4. Verify spreadsheet updates
  {
    const workspacesSheet = mockSheets['Workspaces'];
    const row = workspacesSheet.find(r => r[0] === 'mie-04');
    assert(row !== undefined, 'Spreadsheet row for mie-04 should exist');
    assert(row![3] === 5000, `Expected 5000 in goal column, got ${row![3]}`);
    assert(row![5] === 'manager@mie.example.com', 'Expected author mismatch in spreadsheet');
  }

  // 5. Verify Dashboard Analytics Integration: GET /dashboard/workspace/mie-04
  {
    const dashboardEvent = {
      parameter: {
        action: 'getWorkspaceDashboard',
        workspaceId: 'mie-04',
        apiKey: 'valid-api-key',
        version: 'v2'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(dashboardEvent);
    const body = response.body;
    assert(body.success === true, 'Dashboard response must be success');
    assert(body.data.workspaceId === 'mie-04', 'Workspace ID mismatch in dashboard');
    // Staff activity in mie-04 is S001 with 1200 activity, goal is 5000
    // Achievement rate should be Math.round((1200 / 5000) * 100) = 24
    assert(body.data.distributionGoal === 5000, `Expected dashboard goal to be 5000, got ${body.data.distributionGoal}`);
    assert(body.data.achievementRate === 24, `Expected achievementRate to be 24, got ${body.data.achievementRate}`);
  }

  // 6. Verify Workspace Separation: Goal of WS-MIE-03 is independent of mie-04
  {
    // Update goal for WS-MIE-03
    const updateEvent3 = {
      parameter: {
        action: 'updateWorkspaceGoal',
        apiKey: 'valid-api-key',
        version: 'v2'
      },
      postData: {
        contents: JSON.stringify({
          action: 'updateWorkspaceGoal',
          workspaceId: 'WS-MIE-03',
          distributionGoal: 8000,
          updatedBy: 'admin@mie.example.com',
          apiKey: 'valid-api-key',
          version: 'v2'
        })
      }
    };
    await PlatformIntegrationPipeline.execute(updateEvent3);

    // Verify WS-MIE-03 goal
    const getEvent3 = {
      parameter: {
        action: 'operations/workspaces',
        workspaceId: 'WS-MIE-03',
        apiKey: 'valid-api-key',
        version: 'v2'
      }
    };
    const response3 = await PlatformIntegrationPipeline.execute(getEvent3);
    assert(response3.body.data.distributionGoal === 8000, 'WS-MIE-03 goal should be 8000');

    // Re-verify mie-04 goal is still 5000
    const getEvent4 = {
      parameter: {
        action: 'operations/workspaces',
        workspaceId: 'mie-04',
        apiKey: 'valid-api-key',
        version: 'v2'
      }
    };
    const response4 = await PlatformIntegrationPipeline.execute(getEvent4);
    assert(response4.body.data.distributionGoal === 5000, 'mie-04 goal should remain 5000');
  }

  console.log('[Integration Test Workspace Flow] All integration test cases passed!');
}

runIntegrationTest().catch(error => {
  console.error('[Integration Test Workspace Flow] Failed!');
  console.error(error);
  process.exit(1);
});
