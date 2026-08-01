import { Workspace } from '@domain/workspace/entities/Workspace';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test Workspace] Verifying Workspace entity...');

  const ws = new Workspace({
    workspaceId: 'WS-MIE-03',
    workspaceName: '三重第3支部',
    status: 'ACTIVE'
  });

  assert(ws.workspaceId === 'WS-MIE-03', 'workspaceId mismatch');
  assert(ws.workspaceName === '三重第3支部', 'workspaceName mismatch');
  assert(ws.getStatus() === 'ACTIVE', 'status mismatch');

  ws.archive();
  assert(ws.getStatus() === 'ARCHIVED', 'should archive');

  ws.activate();
  assert(ws.getStatus() === 'ACTIVE', 'should activate');

  console.log('[Test Workspace] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
