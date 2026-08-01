import {
  RepositoryRuntime,
  RepositoryDispatcher,
  RepositoryProviderType,
  RepositoryProvider,
  RepositoryExecutionContext
} from '../../src/runtime/repository';
import { RepositoryUpdateRequest } from '../../src/application/task-result';
import { 
  SpreadsheetRepositoryAdapter,
  MockSpreadsheetGateway,
  SpreadsheetSheetResolver,
  SpreadsheetRowMapper,
  SpreadsheetWriteExecutor 
} from '../../src/repository';

import { RepositoryResult } from '../../src/repository/RepositoryResult';

class MockFailedProvider implements RepositoryProvider {
  public async execute(context: RepositoryExecutionContext): Promise<RepositoryResult> {
    throw new Error('Simulated repository failure');
  }
}

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

  console.log('--- Starting Repository Runtime Foundation Tests ---');

  // Initialize Spreadsheet dependencies
  const gateway = new MockSpreadsheetGateway();
  const resolver = new SpreadsheetSheetResolver();
  const mapper = new SpreadsheetRowMapper();
  const executor = new SpreadsheetWriteExecutor(gateway, resolver, mapper);
  const spreadsheetAdapter = new SpreadsheetRepositoryAdapter(executor);

  // Initialize Provider Registry and Dispatcher
  const providers = new Map<RepositoryProviderType, RepositoryProvider>();
  providers.set(RepositoryProviderType.SPREADSHEET, spreadsheetAdapter);
  providers.set(RepositoryProviderType.DATABASE, new MockFailedProvider());
  
  const dispatcher = new RepositoryDispatcher(providers);
  const runtime = new RepositoryRuntime(dispatcher);

  // Test 1: Successful Routing to SpreadsheetAdapter
  const request1: RepositoryUpdateRequest = {
    taskId: 'task-001',
    idempotencyKey: 'idem-001',
    status: 'COMPLETED'
  };

  let result = await runtime.execute(request1, RepositoryProviderType.SPREADSHEET);
  assert(result.success === true, 'Successfully routed to SpreadsheetAdapter');
  assert(result.repositoryProvider === RepositoryProviderType.SPREADSHEET, 'Provider type matches requested');
  assert(result.operationId.startsWith('op-'), 'SpreadsheetAdapter returned its specific operationId');
  assert(result.requestId !== undefined && result.correlationId !== undefined, 'requestId and correlationId are populated');

  // Test 2: Unregistered Provider
  let unregisteredResult = await runtime.execute(request1, RepositoryProviderType.FIRESTORE);
  assert(unregisteredResult.success === false, 'Fails gracefully when provider is not registered');
  assert(unregisteredResult.message?.includes('No RepositoryProvider registered') ?? false, 'Error message indicates missing provider');

  // Test 3: Repository Update Failure
  let failedResult = await runtime.execute(request1, RepositoryProviderType.DATABASE);
  assert(failedResult.success === false, 'Fails gracefully when provider throws error');
  assert(failedResult.message?.includes('Simulated repository failure') ?? false, 'Catches provider execution errors');

  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
