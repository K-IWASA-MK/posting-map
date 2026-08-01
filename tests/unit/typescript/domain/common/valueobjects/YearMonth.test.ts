import { YearMonth } from '@domain/common/valueobjects/YearMonth';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test YearMonth] Verifying YearMonth value object...');

  // Build from string "202607"
  const ym1 = new YearMonth('202607');
  assert(ym1.getYear() === 2026, 'Year mismatch');
  assert(ym1.getMonth() === 7, 'Month mismatch');
  assert(ym1.toString() === '202607', 'toString mismatch');

  // Boundary check
  const start = ym1.getStartDate();
  const end = ym1.getEndDate();
  assert(start.getFullYear() === 2026 && start.getMonth() === 6 && start.getDate() === 1, 'Start date mismatch');
  assert(end.getFullYear() === 2026 && end.getMonth() === 6 && end.getDate() === 31, 'End date mismatch');

  // Build from Date
  const date = new Date(2026, 7, 15); // August 15, 2026
  const ym2 = new YearMonth(date);
  assert(ym2.getYear() === 2026, 'Date year mismatch');
  assert(ym2.getMonth() === 8, 'Date month mismatch');
  assert(ym2.toString() === '202608', 'Date toString mismatch');

  // Equivalence check
  const ym3 = new YearMonth('202607');
  assert(ym1.equals(ym3), 'Equals check failed');
  assert(!ym1.equals(ym2), 'Not equals check failed');

  console.log('[Test YearMonth] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
