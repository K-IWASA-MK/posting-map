import {
  SpreadsheetWriteExecutor,
  MockSpreadsheetGateway,
  SpreadsheetSheetResolver,
  SpreadsheetRowMapper,
  SpreadsheetWriteContext,
  TaskSheetSchema
} from '../../src/repository/spreadsheet';
import { RepositoryUpdateRequest } from '../../src/application/task-result';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  console.log('--- Starting Spreadsheet Repository Tests ---');

  const gateway = new MockSpreadsheetGateway();
  const resolver = new SpreadsheetSheetResolver();
  const mapper = new SpreadsheetRowMapper();
  const executor = new SpreadsheetWriteExecutor(gateway, resolver, mapper);

  const request1: RepositoryUpdateRequest = {
    taskId: 'task-100',
    idempotencyKey: 'idem-100',
    status: 'COMPLETED'
  };

  const context1 = new SpreadsheetWriteContext({
    request: request1,
    sheetName: '',
    rowKey: '',
    idempotencyKey: request1.idempotencyKey,
    requestId: 'req-1',
    correlationId: 'corr-1',
    executionId: 'exec-1'
  });

  // Test 1: New append
  let result = await executor.execute(context1);
  assert(result.success === true, 'Successfully appended new row');
  assert(result.isIdempotentSkip !== true, 'Not an idempotent skip');
  
  let sheetData = gateway._getSheet('Tasks');
  assert(sheetData !== undefined && sheetData.length === 1, 'Row was added to the Tasks sheet');
  assert(sheetData![0][TaskSheetSchema.COLUMNS.TASK_ID] === 'task-100', 'Task ID mapped correctly');
  assert(sheetData![0][TaskSheetSchema.COLUMNS.VERSION] === 1, 'Version initialized to 1');

  // Test 2: Idempotent Skip
  let result2 = await executor.execute(context1);
  assert(result2.success === true, 'Idempotent execution returns success');
  assert(result2.isIdempotentSkip === true, 'Flagged as idempotent skip');
  assert(gateway._getSheet('Tasks')?.length === 1, 'No duplicate row added');

  // Test 3: Update with version bump (Different idempotency key)
  const context3 = new SpreadsheetWriteContext({
    ...context1,
    idempotencyKey: 'idem-101', // Changed
    executionId: 'exec-2'
  });

  let result3 = await executor.execute(context3);
  assert(result3.success === true, 'Update successful');
  assert(result3.isIdempotentSkip !== true, 'Not a skip');
  
  sheetData = gateway._getSheet('Tasks');
  assert(sheetData?.length === 1, 'Still only 1 row (updated)');
  assert(sheetData![0][TaskSheetSchema.COLUMNS.VERSION] === 2, 'Version bumped to 2');
  assert(sheetData![0][TaskSheetSchema.COLUMNS.IDEMPOTENCY_KEY] === 'idem-101', 'Idempotency key updated');

  // Test 4: Concurrency Error
  const request4: RepositoryUpdateRequest = {
    ...request1,
    idempotencyKey: 'idem-102',
    metadata: { expectedVersion: 1 } // Trying to update based on stale version 1
  };
  const context4 = new SpreadsheetWriteContext({
    ...context3,
    request: request4,
    idempotencyKey: 'idem-102'
  });

  let result4 = await executor.execute(context4);
  assert(result4.success === false, 'Update fails when version mismatched');
  assert(result4.errorType === 'CONCURRENCY_ERROR', 'Returns CONCURRENCY_ERROR');
  
  sheetData = gateway._getSheet('Tasks');
  assert(sheetData![0][TaskSheetSchema.COLUMNS.VERSION] === 2, 'Version remains unchanged');

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
