import { RepositoryPerformanceProfiler } from '../../../../../../src/infrastructure/repository/profiler/RepositoryPerformanceProfiler';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('Running RepositoryPerformanceProfiler tests...');

  // Test 1
  let profiler = RepositoryPerformanceProfiler.getInstance();
  profiler.reset();
  let metrics = profiler.getMetrics();
  assert(metrics.repositoryCallCount === 0, 'Initial metrics should be 0');
  
  // Test 2
  profiler.incrementRepositoryCall('TestRepo');
  profiler.incrementRepositoryCall('TestRepo');
  profiler.incrementRepositoryCall('OtherRepo');
  metrics = profiler.getMetrics();
  assert(metrics.repositoryCallCount === 3, 'Call count should be 3');
  assert(metrics.repositoryExecutionCount.length === 2, 'Execution count array length should be 2');
  assert(metrics.repositoryExecutionCount.find((m: any) => m.repositoryName === 'TestRepo')?.executionCount === 2, 'TestRepo count should be 2');
  
  // Test 3
  profiler.incrementRead('Sheet1');
  profiler.incrementRead('Sheet2');
  profiler.incrementRead('Sheet1');
  profiler.incrementWrite('Sheet1');
  metrics = profiler.getMetrics();
  assert(metrics.spreadsheetReadCount === 3, 'Read count should be 3');
  assert(metrics.spreadsheetWriteCount === 1, 'Write count should be 1');
  const sheet1 = metrics.sheetMetrics.find((m: any) => m.sheetName === 'Sheet1');
  assert(sheet1?.readCount === 2, 'Sheet1 read should be 2');
  assert(sheet1?.writeCount === 1, 'Sheet1 write should be 1');
  
  // Test 4
  profiler.addExecutionTime(50);
  profiler.addExecutionTime(100);
  metrics = profiler.getMetrics();
  assert(metrics.totalExecutionTimeMs === 150, 'Execution time should be 150');
  
  // Test 5 (reset)
  profiler.reset();
  metrics = profiler.getMetrics();
  assert(metrics.repositoryCallCount === 0, 'Reset should zero out metrics');
  assert(metrics.totalExecutionTimeMs === 0, 'Reset should zero out execution time');
  
  // Test 6 (Deep copy)
  profiler.incrementRepositoryCall('TestRepo');
  const m1 = profiler.getMetrics();
  m1.repositoryCallCount = 999;
  m1.repositoryExecutionCount[0].executionCount = 999;
  const m2 = profiler.getMetrics();
  assert(m2.repositoryCallCount === 1, 'getMetrics should return a deep copy (call count)');
  assert(m2.repositoryExecutionCount[0].executionCount === 1, 'getMetrics should return a deep copy (array)');

  console.log('All RepositoryPerformanceProfiler tests passed!');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
