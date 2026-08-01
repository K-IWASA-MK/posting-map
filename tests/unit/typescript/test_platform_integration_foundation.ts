import { PlatformIntegrationPipeline } from '../../../src/platform/PlatformIntegrationPipeline';
import { PlatformStage } from '../../../src/platform/PlatformStage';
import { EventDispatcher } from '@foundation/monitoring/EventDispatcher';
import { MonitoringEvent } from '@foundation/monitoring/MonitoringEvent';
import { GasConfigurationProvider } from '@infra/gas/GasConfigurationProvider';
import { ApiExecutionContext } from '@infra/gas/ApiExecutionContext';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

const globalVar = globalThis as any;

// 1. Mock GAS globals
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
  'Areas': [
    ['Area ID', 'Name', 'City', 'Status', 'Done Count', 'Total Count'],
    ['A-1', 'Area 1', 'City A', 'NOT_STARTED', 0, 100]
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
  ],
  'Flyers': [
    ['ID', 'スタッフID', 'スタッフ名', '保管場所', '保管枚数', '更新日時']
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
  console.log('[Test PlatformIntegration] Starting Platform Integration Foundation tests...');

  // Setup configuration provider overrides
  const config = GasConfigurationProvider.getInstance();
  config.getFeatureFlags = () => ({
    flyerHolding: true,
    googleMaps: true,
    mapbox: false,
    gpsEvidence: true,
    photoEvidence: true,
    aiosBridge: true, // Enable AIOS bridge to execute S4-5 pipeline
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

  // Track dispatched events
  const dispatchedEvents: MonitoringEvent[] = [];
  const listener = {
    onEvent: (event: MonitoringEvent) => {
      dispatchedEvents.push(event);
    }
  };
  EventDispatcher.getInstance().addListener(listener);

  // 1. Success Path Verification: GET /dashboard (action=getAppData)
  {
    dispatchedEvents.length = 0;
    const mockEvent = {
      parameter: {
        action: 'getAppData', // Resolves to path '/dashboard', which maps to REALTIME_DASHBOARD feature
        version: 'v2',
        apiKey: 'valid-api-key',
        traceId: 'trace-12345',
        correlationId: 'corr-54321'
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);

    assert(response !== null, 'Should return a response');
    assert(response.body !== null, 'Response body should not be null');
    // DashboardHandler returns 501 NotImplemented as a stub, which is a successful run through routing to handler execution
    assert(response.body.status === 501, 'Response status should be 501 NotImplemented');

    const lastCtx = PlatformIntegrationPipeline.lastContext;
    assert(lastCtx !== null, 'Last context should be set');
    assert(lastCtx?.getCurrentStage() === PlatformStage.COMPLETED, 'Current stage should be COMPLETED');

    // Context Propagation check
    assert(lastCtx?.getAuthenticationContext() !== null, 'AuthenticationContext must be propagated');
    assert(lastCtx?.getAuthorizationContext() !== null, 'AuthorizationContext must be propagated');
    assert(lastCtx?.getLicenseContext() !== null, 'LicenseContext must be propagated');
    assert(lastCtx?.getFeatureContext() !== null, 'FeatureContext must be propagated');
    assert(lastCtx?.getBridgeContext() !== null, 'BridgeContext must be propagated');

    const platformCtx = lastCtx?.getPlatformContext();
    assert(platformCtx !== null, 'PlatformContext must be propagated');
    assert(platformCtx?.stage === PlatformStage.COMPLETED, 'PlatformStage should be COMPLETED');
    assert(platformCtx?.status === 'COMPLETED', 'Platform status should be COMPLETED');
    assert(platformCtx?.traceId === 'trace-12345', 'PlatformContext traceId should match');
    assert(platformCtx?.correlationId === 'corr-54321', 'PlatformContext correlationId should match');

    // Verify events generated in order
    const eventTypes = dispatchedEvents.map(e => e.eventType);
    assert(eventTypes.includes('PLATFORM_STARTED'), 'PLATFORM_STARTED event missing');
    assert(eventTypes.includes('STAGE_STARTED'), 'STAGE_STARTED event missing');
    assert(eventTypes.includes('STAGE_COMPLETED'), 'STAGE_COMPLETED event missing');
    assert(eventTypes.includes('PLATFORM_COMPLETED'), 'PLATFORM_COMPLETED event missing');

    console.log('[Test PlatformIntegration] Normal Success Path: PASSED');
  }

  // 2. Lock Verification: POST /updateFlyerStock (requires Lock Service)
  {
    const mockPostEvent = {
      parameter: {
        action: 'updateFlyerStock',
        version: 'v2',
        apiKey: 'valid-api-key'
      },
      postData: {
        contents: JSON.stringify({
          action: 'updateFlyerStock',
          tenantId: 'TENANT-1',
          branchId: 'BRANCH-1',
          staffId: 'S037',
          count: 1000
        })
      }
    };

    mockScriptLock.hasLock = false;
    const response = await PlatformIntegrationPipeline.execute(mockPostEvent);
    // HoldingHandler is fully implemented and returns 200 success status
    assert(response.body.status === 200, 'POST request should run handler to completion (200)');
    // Lock must have been acquired and then released
    assert(mockScriptLock.hasLock === false, 'Lock must be released');

    console.log('[Test PlatformIntegration] Write Action Lock: PASSED');
  }

  // 3. Failure Path Verification (Authentication failure via invalid apiKey)
  {
    dispatchedEvents.length = 0;
    const mockBadEvent = {
      parameter: {
        action: 'getAppData', // Resolves to /dashboard (anonymousAccess allowed is false for /dashboard)
        version: 'v2',
        apiKey: 'invalid-key' // Causes AuthenticationPipeline to throw AuthenticationException
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockBadEvent);
    assert(response.body.success === false, 'Failure path response should have success: false');
    assert(response.body.status === 401, 'Failure path response status should be 401');

    const lastCtx = PlatformIntegrationPipeline.lastContext;
    assert(lastCtx !== null, 'Last context should be set');
    assert(lastCtx?.getCurrentStage() === PlatformStage.FAILED, 'Stage must be FAILED on error');

    const platformCtx = lastCtx?.getPlatformContext();
    assert(platformCtx?.stage === PlatformStage.FAILED, 'PlatformContext stage should be FAILED');
    assert(platformCtx?.status === 'FAILED', 'Platform status should be FAILED');

    const eventTypes = dispatchedEvents.map(e => e.eventType);
    assert(eventTypes.includes('PLATFORM_FAILED'), 'PLATFORM_FAILED event missing');

    console.log('[Test PlatformIntegration] Failure Path: PASSED');
  }

  console.log('[Test PlatformIntegration] All Platform Integration Foundation tests completed.');
}

runTests().then(() => {
  console.log('\n======================================');
  console.log('  PLATFORM INTEGRATION FOUNDATION PASSED');
  console.log('======================================\n');
}).catch(err => {
  console.error('[PlatformIntegration Test Failure]', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
