import { DistributorHandler } from '@api/field/DistributorHandler';
import { StaffApplicationService } from '@application/field/services/StaffApplicationService';
import { ApiRequest } from '@core/api/ApiRequest';
import { ApiExecutionContext } from '@infra/gas/ApiExecutionContext';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockStaffApplicationService extends StaffApplicationService {
  constructor() {
    super(null as any);
  }

  public async getStaff(staffNo: string): Promise<any> {
    if (staffNo === 'S037') {
      return {
        staffNo: 'S037',
        displayName: 'Bさん',
        lineUserId: 'U123456',
        workspaceId: 'WS-MIE-03',
        createdAt: new Date().toISOString()
      };
    }
    return undefined;
  }
}

async function runTests() {
  console.log('[Test DistributorHandler] Running unit tests...');

  const service = new MockStaffApplicationService();
  const handler = new DistributorHandler(service);
  const context = new ApiExecutionContext();

  // Test Case 1: Success retrieval
  {
    const request = new ApiRequest({
      method: 'GET',
      path: '/field/distributors/S037',
      version: 'v2',
      requestId: 'req-1',
      pathParams: { id: 'S037' }
    });

    const response = await handler.execute(request, context);
    assert(response.success === true, 'Response must be success');
    assert(response.status === 200, 'Status must be 200');
    assert(response.data.id === 'S037', 'ID must match staffNo');
    assert(response.data.name === 'Bさん', 'Name must match displayName');
  }

  // Test Case 2: Not Found
  {
    const request = new ApiRequest({
      method: 'GET',
      path: '/field/distributors/S999',
      version: 'v2',
      requestId: 'req-2',
      pathParams: { id: 'S999' }
    });

    const response = await handler.execute(request, context);
    assert(response.success === false, 'Response must fail');
    assert(response.status === 404, 'Status must be 404');
    assert(response.error?.code === 'ENTITY_NOT_FOUND', 'Error code must match');
  }

  console.log('[Test DistributorHandler] All tests PASSED.');
}

runTests().catch(err => {
  console.error('[Test DistributorHandler] Failed:', err);
  process.exit(1);
});
