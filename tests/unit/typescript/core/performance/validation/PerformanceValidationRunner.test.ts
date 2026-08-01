import { PerformanceValidationRunner } from '../../../../../../src/core/performance/validation/PerformanceValidationRunner';
import { PerformancePolicyRegistry } from '../../../../../../src/core/performance/policy/PerformancePolicyRegistry';
import { Rule008ProfilerMandatory } from '../../../../../../src/core/performance/policy/rules/Rule008ProfilerMandatory';
import * as path from 'path';
import * as fs from 'fs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('Running PerformanceValidationRunner tests...');

  const registry = PerformancePolicyRegistry.getInstance();
  registry.clear();
  // Register a simple rule
  registry.register(new Rule008ProfilerMandatory());

  const runner = new PerformanceValidationRunner();

  // Create a temporary mock source directory for testing
  const testDir = path.join(__dirname, 'mock_src');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const mockFile = path.join(testDir, 'SpreadsheetTestRepository.ts');
  const mockCode = `
    import { RepositoryPerformanceProfiler } from '../profiler/RepositoryPerformanceProfiler';
    export class SpreadsheetTestRepository {
      public save() {
        const profiler = RepositoryPerformanceProfiler.getInstance();
        profiler.incrementRepositoryCall('SpreadsheetTestRepository');
      }
    }
  `;
  
  // Ensure we place the mock file in a proper structure to match Rule008 check
  const repoDir = path.join(testDir, 'repository');
  if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true });
  }
  const targetFile = path.join(repoDir, 'SpreadsheetTestRepository.ts');
  fs.writeFileSync(targetFile, mockCode, 'utf8');

  // Test 1: Runner correctly executes and generates ValidationResult
  const result = runner.run(testDir);

  // 1-1: Metadata checks
  assert(result.metadata !== undefined, 'Metadata should be present');
  assert(result.metadata.toolVersion === '1.0.0', 'toolVersion should be 1.0.0');
  
  // 1-2: Summary checks
  assert(result.summary !== undefined, 'Summary should be present');
  assert(result.summary.status === 'PASS', 'Status should be PASS');
  assert(result.summary.score === 100, 'Score should be 100');
  assert(result.summary.passed === 1, 'Passed count should be 1');
  
  // 1-3: Report checks
  assert(result.report !== undefined, 'Report should be present');
  assert(result.report.policyCount === 1, 'Policy count should be 1');

  // 1-4: Metrics check
  // Since we haven't executed the code that calls profiler methods in this test process context,
  // the execution time and calls should be 0, making metrics undefined.
  assert(result.metrics === undefined, 'Metrics should be undefined when Profiler has 0 activity');

  console.log('All PerformanceValidationRunner tests passed!');

  // Cleanup
  fs.unlinkSync(targetFile);
  fs.rmdirSync(repoDir);
  fs.rmdirSync(testDir);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
