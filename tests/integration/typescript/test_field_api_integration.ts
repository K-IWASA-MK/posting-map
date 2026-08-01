import { PlatformIntegrationPipeline } from '../../../src/platform/PlatformIntegrationPipeline';
import { PlatformStage } from '../../../src/platform/PlatformStage';
import { GasConfigurationProvider } from '@infra/gas/GasConfigurationProvider';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

const globalVar = globalThis as any;

// 1. Mock GAS globals for Integration Test
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

// Realigned Sheets corresponding to Japanese headers in Sprint 5 S5-5
let mockSheets: { [name: string]: any[][] } = {
  'Flyers': [
    ['ID', 'スタッフID', 'スタッフ名', '保管場所', '保管枚数', '更新日時'],
    ['Holding-S037', 'S037', 'Bさん', '自宅', '1000', String(Date.now())]
  ],
  'Staff': [
    ['スタッフID', 'スタッフ名', 'LINEユーザーID', 'ワークスペースID', '登録日時'],
    ['S037', 'Bさん', 'identity-1', 'WS-MIE-03', String(Date.now())]
  ],
  'Activity': [
    ['活動ID', 'スタッフID', '報告枚数', '写真URL', '位置情報', '活動日時']
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

globalVar.ContentService = {
  MimeType: {
    JSON: 'JSON'
  },
  createTextOutput: (content: string) => {
    let mimeType: string = '';
    return {
      setMimeType: (type: string) => {
        mimeType = type;
        return {
          content,
          mimeType
        };
      }
    };
  }
};

globalVar.createJsonResponseFromApiResponse = (apiResponse: any) => {
  return {
    body: apiResponse,
    mimeType: 'JSON'
  };
};

async function runTests() {
  console.log('[Integration Test] Starting Field API Integration Pipeline tests...');

  // Setup configuration provider overrides
  const config = GasConfigurationProvider.getInstance();
  config.getFeatureFlags = () => ({
    flyerHolding: true,
    googleMaps: true,
    mapbox: false,
    gpsEvidence: true,
    photoEvidence: true,
    aiosBridge: true,
    analytics: false,
    apiKeyAuth: true,
    liffAuth: true,
    serviceAuth: true,
    anonymousAccess: true,
    authorizationEnabled: true,
    roleValidation: true,
    scopeValidation: true,
    permissionValidation: true,
    licensingEnabled: true,
    editionValidation: true,
    licenseValidation: true,
    featureAccessEnabled: true,
    featureValidation: true,
    bridgeEnabled: true,
    bridgeHeartbeat: true,
    bridgeTimeout: 5000,
    bridgeProvider: 'AIOSBridgeProvider',
    platformIntegrationEnabled: true,
    pipelineMode: 'DETERMINISTIC',
    debugExecutionTrace: true
  });

  // Test Case 1: GET /field/stocks/{id} path parameter routing (fetches from FlyerHolding)
  {
    const mockEvent = {
      parameter: {
        path: '/field/stocks/S037',
        version: 'v2',
        apiKey: 'valid-api-key'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response !== null, 'Response should not be null');
    if (!response.body.success) {
      console.log('GET /field/stocks/S037 failed with response:', JSON.stringify(response.body, null, 2));
    }
    assert(response.body.success === true, 'GET stocks API call must succeed');
    assert(response.body.status === 200, 'HTTP status must be 200');
    
    // Verify DTO response shape (backward compatibility structure)
    const data = response.body.data;
    assert(data.id === 'S037', 'DTO ID mismatch');
    assert(data.quantity === 1000, 'DTO Quantity mismatch');
    assert(data.status === 'AVAILABLE', 'DTO Status mismatch');
    assert(data.ownerId === 'S037', 'DTO Owner ID mismatch');

    console.log('[Integration Test] GET /field/stocks/{id} path parameter routing: PASSED');
  }

  // Test Case 2: GET /field/distributors/{id} path parameter routing (fetches from Staff)
  {
    const mockEvent = {
      parameter: {
        path: '/field/distributors/S037',
        version: 'v2',
        apiKey: 'valid-api-key'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response !== null, 'Response should not be null');
    assert(response.body.success === true, 'GET distributors API call must succeed');
    assert(response.body.status === 200, 'HTTP status must be 200');

    const data = response.body.data;
    assert(data.id === 'S037', 'DTO ID mismatch');
    assert(data.name === 'Bさん', 'DTO Name mismatch');
    assert(data.status === 'ACTIVE', 'DTO Status mismatch');

    console.log('[Integration Test] GET /field/distributors/{id} path parameter routing: PASSED');
  }

  // Test Case 3: POST /field/reservation mapping to Activity recording (No inventory subtraction)
  {
    const mockEvent = {
      parameter: {
        path: '/field/reservation',
        version: 'v2',
        apiKey: 'valid-api-key'
      },
      postData: {
        contents: JSON.stringify({
          flyerStockId: 'Holding-S037',
          distributorId: 'S037',
          quantity: 300,
          photoUrl: 'http://example.com/photo.jpg',
          latitude: 34.965,
          longitude: 136.622
        })
      }
    };

    mockScriptLock.hasLock = false;
    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response !== null, 'Response should not be null');
    assert(response.body.success === true, 'POST reservation API call must succeed');
    assert(response.body.status === 200, 'HTTP status must be 200');

    const result = response.body.data;
    assert(result.success === true, 'ReservationResult success must be true');
    assert(result.stock.quantity === 1000, 'FlyerHolding quantity must NOT be updated upon activity recording (Constitution compliance)');
    assert(result.eventIds.length >= 1, 'Event ID must be mapped and returned');
    assert(result.eventIds[0].indexOf('EV-DAR') === 0, 'Event ID must start with EV-DAR');

    // Lock Service release validation
    assert(mockScriptLock.hasLock === false, 'Lock must be released after operation');

    console.log('[Integration Test] POST /field/reservation mapping to Activity: PASSED');
  }

  // Test Case 4: Route Not Found (ensure fallback logic is correct)
  {
    const mockEvent = {
      parameter: {
        path: '/field/invalid-route',
        version: 'v2',
        apiKey: 'valid-api-key'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response.body.success === false, 'Invalid route must fail');
    assert(response.body.status === 404, 'HTTP status must be 404');
    assert(response.body.error.code === 'PM-VAL-001', 'Error code must match');

    console.log('[Integration Test] Route Fallback: PASSED');
  }

  console.log('[Integration Test] All Field API Integration Pipeline tests completed.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  FIELD API INTEGRATION TESTS PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[Integration Test Failure]', err);
  process.exit(1);
});
