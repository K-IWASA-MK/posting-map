import { PerformancePolicyEngine } from '../../../../../../src/core/performance/policy/PerformancePolicyEngine';
import { PerformancePolicyRegistry } from '../../../../../../src/core/performance/policy/PerformancePolicyRegistry';
import { PolicyContext } from '../../../../../../src/core/performance/policy/PerformancePolicy';
import { Rule001NoLoopRead } from '../../../../../../src/core/performance/policy/rules/Rule001NoLoopRead';
import { Rule008ProfilerMandatory } from '../../../../../../src/core/performance/policy/rules/Rule008ProfilerMandatory';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('Running PerformancePolicyEngine tests...');

  const registry = PerformancePolicyRegistry.getInstance();
  registry.clear();
  const engine = new PerformancePolicyEngine();

  // Test 1: Valid
  registry.register(new Rule008ProfilerMandatory());
  let contexts: PolicyContext[] = [
    {
      filePath: '/repository/field/SpreadsheetStaffRepository.ts',
      sourceCode: `
        import { RepositoryPerformanceProfiler } from '../profiler/RepositoryPerformanceProfiler';
        export class SpreadsheetStaffRepository {
          public save() {
            const profiler = RepositoryPerformanceProfiler.getInstance();
            profiler.incrementRepositoryCall('SpreadsheetStaffRepository');
          }
        }
      `
    }
  ];

  let report = engine.validate(contexts);
  assert(report.policyCount === 1, 'Policy count should be 1');
  assert(report.pass === 1, 'Pass should be 1');
  assert(report.failed === 0, 'Failed should be 0');
  assert(report.score === 100, 'Score should be 100');

  // Test 2: Invalid
  registry.clear();
  registry.register(new Rule001NoLoopRead());
  registry.register(new Rule008ProfilerMandatory());

  contexts = [
    {
      filePath: '/repository/field/SpreadsheetStaffRepository.ts',
      sourceCode: `
        export class SpreadsheetStaffRepository {
          public save() {
            for (let i = 0; i < 10; i++) {
              this.reader.readAll('Staff');
            }
          }
        }
      `
    }
  ];

  report = engine.validate(contexts);
  assert(report.policyCount === 2, 'Policy count should be 2');
  assert(report.failed === 2, 'Failed should be 2');
  assert(report.score === 80, 'Score should be 80');
  
  console.log('All PerformancePolicyEngine tests passed!');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
