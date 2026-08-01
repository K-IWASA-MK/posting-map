import { PerformanceGovernanceEngine } from '../../../../../../src/core/performance/governance/PerformanceGovernanceEngine';
import { PerformanceValidationSummary } from '../../../../../../src/core/performance/validation/PerformanceValidationSummary';
import { PerformanceValidationResult } from '../../../../../../src/core/performance/validation/PerformanceValidationResult';
import { PerformanceGovernanceAction } from '../../../../../../src/core/performance/governance/PerformanceGovernanceDecision';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

function createMockValidationResult(failed: number, warning: number, score: number): PerformanceValidationResult {
  const summary: PerformanceValidationSummary = {
    status: failed > 0 ? 'FAILED' : (warning > 0 ? 'WARNING' : 'PASS'),
    validationCount: 10,
    passed: 10 - failed - warning,
    warning,
    failed,
    info: 0,
    score,
    durationMs: 100,
    generatedAt: new Date().toISOString()
  };

  return {
    metadata: {
      toolVersion: '1.0.0',
      schemaVersion: 'v1',
      runtime: 'Node.js',
      generatedAt: summary.generatedAt
    },
    summary,
    report: {
      policyCount: 10,
      score,
      pass: summary.passed,
      warning,
      failed,
      info: 0,
      violations: []
    }
  };
}

async function runTests() {
  console.log('Running PerformanceGovernanceEngine tests...');
  const engine = new PerformanceGovernanceEngine();

  // CASE 1: FAILED = 0, WARNING = 0, Score = 100 -> PASS -> PROCEED
  let validationResult = createMockValidationResult(0, 0, 100);
  let governanceResult = engine.evaluate(validationResult);
  assert(governanceResult.decision.status === 'PASS', 'CASE 1 Status should be PASS');
  assert(governanceResult.decision.action === PerformanceGovernanceAction.PROCEED, 'CASE 1 Action should be PROCEED');

  // CASE 2: FAILED = 0, WARNING = 4, Score = 88 -> WARNING -> REVIEW_REQUIRED
  validationResult = createMockValidationResult(0, 4, 88);
  governanceResult = engine.evaluate(validationResult);
  assert(governanceResult.decision.status === 'WARNING', 'CASE 2 Status should be WARNING');
  assert(governanceResult.decision.action === PerformanceGovernanceAction.REVIEW_REQUIRED, 'CASE 2 Action should be REVIEW_REQUIRED');

  // CASE 3: FAILED = 1, WARNING = 0, Score = 95 -> FAILED -> BLOCK
  // FAILED takes precedence over Score
  validationResult = createMockValidationResult(1, 0, 95);
  governanceResult = engine.evaluate(validationResult);
  assert(governanceResult.decision.status === 'FAILED', 'CASE 3 Status should be FAILED');
  assert(governanceResult.decision.action === PerformanceGovernanceAction.BLOCK, 'CASE 3 Action should be BLOCK');

  // Extra CASE: FAILED = 0, WARNING = 0, Score = 60 -> FAILED -> BLOCK
  validationResult = createMockValidationResult(0, 0, 60);
  governanceResult = engine.evaluate(validationResult);
  assert(governanceResult.decision.status === 'FAILED', 'Extra CASE Status should be FAILED (due to low score)');
  assert(governanceResult.decision.action === PerformanceGovernanceAction.BLOCK, 'Extra CASE Action should be BLOCK');

  console.log('All PerformanceGovernanceEngine tests passed!');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
