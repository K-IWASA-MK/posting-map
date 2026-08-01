import { PlatformIntegrationPipeline } from '../../../src/platform/PlatformIntegrationPipeline';
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
    getProperty: (key: string) => 'mock-folder-id'
  })
};

globalVar.getStorageFolderId = () => 'mock-folder-id';

// Utilities Mock
globalVar.Utilities = {
  formatDate: (date: Date, tz: string, format: string) => '07/12 12:00',
  base64Decode: (str: string) => new Uint8Array([1, 2, 3]),
  newBlob: (data: any, contentType: string, fileName: string) => ({ data, contentType, fileName }),
  getUuid: () => 'mock-uuid-12345'
};

// DriveApp Mock
let driveCreatedFiles: any[] = [];
globalVar.DriveApp = {
  getFolderById: (id: string) => ({
    createFile: (blob: any) => {
      const file = {
        getId: () => `mock-file-id-for-${blob.fileName}`,
        getName: () => blob.fileName
      };
      driveCreatedFiles.push(file);
      return file;
    }
  })
};

// Global event log mock
let appendedEvents: any[] = [];
globalVar.appendEventLog = (event: any) => {
  appendedEvents.push(event);
};

// Mock sheets matching legacy and new structure
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
  ],
  '津市西部': [
    ['町名', '世帯数', '配布数', '完了', '完了日時', '配布枚数', '配布員', '配布員ID', 'GPS', '写真'],
    ['町名A', '100', '0', false, '', '', '', '', '', '']
  ]
};

globalVar.SpreadsheetApp = {
  openById: (id: string) => ({
    getSheetByName: (name: string) => {
      if (!mockSheets[name]) return null;
      return {
        getLastRow: () => mockSheets[name].length,
        getLastColumn: () => mockSheets[name][0].length,
        getRange: (row: number, col: number, numRows: number, numCols: number) => {
          // Normalize if numRows/numCols is undefined
          const actualRows = numRows !== undefined ? numRows : 1;
          const actualCols = numCols !== undefined ? numCols : 1;
          return {
            getValues: () => {
              const data = [];
              for (let r = 0; r < actualRows; r++) {
                const rowIndex = row - 1 + r;
                if (rowIndex < mockSheets[name].length) {
                  data.push(mockSheets[name][rowIndex].slice(col - 1, col - 1 + actualCols));
                }
              }
              return data;
            },
            setValues: (vals: any[][]) => {
              for (let r = 0; r < actualRows; r++) {
                const rowIndex = row - 1 + r;
                while (rowIndex >= mockSheets[name].length) {
                  mockSheets[name].push(new Array(mockSheets[name][0].length).fill(''));
                }
                for (let c = 0; c < vals[r].length; c++) {
                  mockSheets[name][rowIndex][col - 1 + c] = vals[r][c];
                }
              }
            },
            setValue: (val: any) => {
              const rowIndex = row - 1;
              while (rowIndex >= mockSheets[name].length) {
                mockSheets[name].push(new Array(mockSheets[name][0].length).fill(''));
              }
              mockSheets[name][rowIndex][col - 1] = val;
            }
          };
        }
      };
    }
  }),
  getActiveSpreadsheet: () => ({
    getSheetByName: (name: string) => {
      if (!mockSheets[name]) return null;
      return {
        getLastRow: () => mockSheets[name].length,
        getLastColumn: () => mockSheets[name][0].length,
        getRange: (row: number, col: number, numRows: number, numCols: number) => {
          const actualRows = numRows !== undefined ? numRows : 1;
          const actualCols = numCols !== undefined ? numCols : 1;
          return {
            getValues: () => {
              const data = [];
              for (let r = 0; r < actualRows; r++) {
                const rowIndex = row - 1 + r;
                if (rowIndex < mockSheets[name].length) {
                  data.push(mockSheets[name][rowIndex].slice(col - 1, col - 1 + actualCols));
                }
              }
              return data;
            },
            setValues: (vals: any[][]) => {
              for (let r = 0; r < actualRows; r++) {
                const rowIndex = row - 1 + r;
                while (rowIndex >= mockSheets[name].length) {
                  mockSheets[name].push(new Array(mockSheets[name][0].length).fill(''));
                }
                for (let c = 0; c < vals[r].length; c++) {
                  mockSheets[name][rowIndex][col - 1 + c] = vals[r][c];
                }
              }
            },
            setValue: (val: any) => {
              const rowIndex = row - 1;
              while (rowIndex >= mockSheets[name].length) {
                mockSheets[name].push(new Array(mockSheets[name][0].length).fill(''));
              }
              mockSheets[name][rowIndex][col - 1] = val;
            }
          };
        }
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
  console.log('[Integration Test] Starting S5-16 Activity Flow Integration Pipeline tests...');

  // Setup configuration overrides
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
    bridgeEnabled: false,
    bridgeHeartbeat: true,
    bridgeTimeout: 5000,
    bridgeProvider: 'AIOSBridgeProvider',
    platformIntegrationEnabled: true,
    pipelineMode: 'DETERMINISTIC',
    debugExecutionTrace: true
  });
  config.getLockTimeout = () => 5000;

  // Test Case 1: Legacy updateRecordWithGPSPhoto mapping and verification
  {
    appendedEvents.length = 0;
    driveCreatedFiles.length = 0;

    const mockEvent = {
      parameter: {
        apiKey: 'valid-api-key'
      },
      postData: {
        contents: JSON.stringify({
          action: 'updateRecordWithGPSPhoto',
          areaName: '津市西部',
          rowId: 2,
          isDone: true,
          count: 150,
          latitude: 34.73,
          longitude: 136.51,
          accuracy: 10,
          photoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          staffName: '津 太郎',
          staffId: 'S037'
        })
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response !== null, 'Response should not be null');
    if (!response.body.success) {
      console.error('[TEST ERROR RESPONSE]', JSON.stringify(response.body, null, 2));
    }
    assert(response.body.success === true, 'API call must succeed');
    assert(response.body.status === 200, 'HTTP status must be 200');

    const result = response.body.data;
    assert(result.success === true, 'Payload success must be true');
    assert(result.photoUrl.indexOf('mock-file-id-for-') === 0, 'Should return created Drive file ID');

    // 1. Verify area sheet update (津市西部)
    const areaRow = mockSheets['津市西部'][1];
    // headers: Town, Households, Distributed, Done, DoneAt, Qty, Staff, StaffID, GPS, Photo
    assert(areaRow[3] === true, 'Done state must be true');
    assert(areaRow[4] === '07/12 12:00', 'Done date mismatch');
    assert(areaRow[5] === 150, 'Reported quantity mismatch');
    assert(areaRow[6] === '津 太郎', 'Staff name mismatch');
    assert(areaRow[7] === 'S037', 'Staff ID mismatch');
    assert(areaRow[8] === '34.73,136.51', 'GPS mismatch');
    assert(areaRow[9] === result.photoUrl, 'Photo URL mismatch');

    // 2. Verify EventLog append
    assert(appendedEvents.length === 1, 'One event log should be appended');
    assert(appendedEvents[0].actionType === 'photo', 'Event log actionType must be photo');
    assert(appendedEvents[0].count === 150, 'Event log count mismatch');
    assert(appendedEvents[0].userId === 'S037', 'Event log userId mismatch');

    // 3. Verify Activity sheet save
    const activityRows = mockSheets['Activity'];
    assert(activityRows.length === 2, 'One activity record should be appended to Activity sheet');
    const actRow = activityRows[1];
    // headers: 活動ID, スタッフID, 報告枚数, 写真URL, 位置情報, 活動日時
    assert(actRow[0].indexOf('ACT-S037-') === 0, 'Activity ID prefix mismatch');
    assert(actRow[1] === 'S037', 'Activity sheet staffNo mismatch');
    assert(actRow[2] === 150, 'Activity sheet quantity mismatch');
    assert(actRow[3] === result.photoUrl, 'Activity sheet photoUrl mismatch');
    assert(actRow[4] === '34.73,136.51', 'Activity sheet location mismatch');

    console.log('[Integration Test] updateRecordWithGPSPhoto pipeline execution: PASSED');
  }

  // Test Case 2: Legacy submitDistribution mapping (Photo-less done reporting)
  {
    appendedEvents.length = 0;
    // Reset area row to prevent state leakage from Test Case 1
    mockSheets['津市西部'][1] = ['町名A', '100', '0', false, '', '', '', '', '', ''];

    const mockEvent = {
      parameter: {
        apiKey: 'valid-api-key'
      },
      postData: {
        contents: JSON.stringify({
          action: 'submitDistribution',
          areaName: '津市西部',
          rowId: 2,
          isDone: true,
          count: 50,
          staffName: '津 太郎',
          staffId: 'S037'
        })
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response !== null, 'Response should not be null');
    assert(response.body.success === true, 'API call must succeed');

    const result = response.body.data;
    assert(result.success === true, 'Payload success must be true');

    // Verify area sheet update (津市西部)
    const areaRow = mockSheets['津市西部'][1];
    assert(areaRow[3] === true, 'Done state must be true');
    assert(areaRow[5] === 50, 'Reported quantity mismatch');
    assert(areaRow[9] === '', 'Photo should be empty since no photoData was uploaded');

    // Verify EventLog append
    assert(appendedEvents.length === 1, 'One event log should be appended');
    assert(appendedEvents[0].actionType === 'distribute', 'Event log actionType must be distribute');
    assert(appendedEvents[0].count === 50, 'Event log count mismatch');

    // Verify Activity sheet save (photoUrl should normalize to 'none')
    const activityRows = mockSheets['Activity'];
    assert(activityRows.length === 3, 'Activity record should be appended to Activity sheet');
    const actRow = activityRows[2];
    assert(actRow[2] === 50, 'Activity sheet quantity mismatch');
    assert(actRow[3] === 'none', 'Activity sheet photoUrl should normalize to none');

    console.log('[Integration Test] submitDistribution (done) pipeline execution: PASSED');
  }

  // Test Case 3: Legacy submitDistribution mapping (revert reporting)
  {
    appendedEvents.length = 0;

    const mockEvent = {
      parameter: {
        apiKey: 'valid-api-key'
      },
      postData: {
        contents: JSON.stringify({
          action: 'submitDistribution',
          areaName: '津市西部',
          rowId: 2,
          isDone: false,
          count: 50,
          staffName: '津 太郎',
          staffId: 'S037'
        })
      }
    };

    const response = await PlatformIntegrationPipeline.execute(mockEvent);
    assert(response !== null, 'Response should not be null');
    assert(response.body.success === true, 'API call must succeed');

    // Verify area sheet revert update
    const areaRow = mockSheets['津市西部'][1];
    assert(areaRow[3] === false, 'Done state must be false');
    assert(areaRow[4] === '', 'Completed date should be cleared');
    assert(areaRow[5] === '', 'Reported quantity should be cleared');
    assert(areaRow[6] === '', 'Staff name should be cleared');
    assert(areaRow[7] === '', 'Staff ID should be cleared');
    assert(areaRow[8] === '', 'GPS should be cleared');
    assert(areaRow[9] === '', 'Photo should be cleared');

    // Verify EventLog append has negative count
    assert(appendedEvents.length === 1, 'One event log should be appended');
    assert(appendedEvents[0].actionType === 'revert_distribute', 'Event log actionType must be revert_distribute');
    assert(appendedEvents[0].count === -50, 'Event log count must be negative for revert');

    // Verify Activity sheet is NOT appended for reverts
    const activityRows = mockSheets['Activity'];
    assert(activityRows.length === 3, 'Activity sheet should remain unchanged for revert actions');

    console.log('[Integration Test] submitDistribution (revert) pipeline execution: PASSED');
  }

  console.log('[Integration Test] All S5-16 Activity Flow Integration Pipeline tests passed successfully!');
}

runTests().catch(err => {
  console.error('[Integration Test Error]', err);
  process.exit(1);
});
