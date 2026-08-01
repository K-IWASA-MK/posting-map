import { HoldingHandler } from '@api/field/HoldingHandler';
import { HoldingApplicationService } from '@application/field/services/HoldingApplicationService';
import { ApiRequest } from '@core/api/ApiRequest';
import { ApiExecutionContext } from '@infra/gas/ApiExecutionContext';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockHoldingApplicationService extends HoldingApplicationService {
  constructor() {
    super(null as any, null as any);
  }

  public async declareHolding(command: any): Promise<any> {
    return {
      staffNo: command.staffNo,
      quantity: command.quantity,
      updatedAt: new Date().toISOString()
    };
  }

  public async getAllRawHoldings(): Promise<any[]> {
    return [
      {
        id: 'Holding-S037',
        staffId: 'S037',
        staffName: 'Bさん',
        location: '自宅',
        count: 1000,
        updatedAt: '07/11 23:20'
      }
    ];
  }
}

async function runTests() {
  console.log('[Test HoldingHandler] Running unit tests...');

  const service = new MockHoldingApplicationService();
  const handler = new HoldingHandler(service);
  const context = new ApiExecutionContext();

  // Test Case 1: POST declare holding
  {
    const request = new ApiRequest({
      method: 'POST',
      path: '/holding',
      version: 'v2',
      requestId: 'req-post-1',
      body: {
        staffId: 'S037',
        count: 1000,
        location: '自宅'
      }
    });

    const response = await handler.execute(request, context);
    assert(response.success === true, 'Response must be success');
    assert(response.status === 200, 'Status must be 200');
    assert(response.data.staffNo === 'S037', 'staffNo must match');
    assert(response.data.quantity === 1000, 'quantity must match');
  }

  // Test Case 2: GET retrieve all holdings
  {
    const request = new ApiRequest({
      method: 'GET',
      path: '/holding',
      version: 'v2',
      requestId: 'req-get-1'
    });

    const response = await handler.execute(request, context);
    assert(response.success === true, 'Response must be success');
    assert(response.status === 200, 'Status must be 200');
    assert(response.data.success === true, 'Wrapper success must be true');
    assert(Array.isArray(response.data.stocks), 'stocks must be an array');
    assert(response.data.stocks.length === 1, 'stocks length must match');
    assert(response.data.stocks[0].staffId === 'S037', 'staffId must match');
  }

  console.log('[Test HoldingHandler] All tests PASSED.');
}

runTests().catch(err => {
  console.error('[Test HoldingHandler] Failed:', err);
  process.exit(1);
});
