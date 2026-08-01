import { Staff } from '@domain/field/staff/entities/Staff';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test Staff] Verifying Staff entity...');

  const staff = new Staff({
    staffNo: 'S037',
    displayName: 'Bさん',
    lineUserId: 'U123456',
    workspaceId: 'WS-MIE-03'
  });

  assert(staff.staffNo === 'S037', 'staffNo mismatch');
  assert(staff.displayName === 'Bさん', 'displayName mismatch');
  assert(staff.lineUserId === 'U123456', 'lineUserId mismatch');
  assert(staff.workspaceId === 'WS-MIE-03', 'workspaceId mismatch');
  assert(staff.createdAt instanceof Date, 'createdAt must be Date');

  console.log('[Test Staff] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
