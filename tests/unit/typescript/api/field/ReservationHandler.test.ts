import { ReservationHandler } from '@api/field/ReservationHandler';
import { ActivityApplicationService } from '@application/field/services/ActivityApplicationService';
import { HoldingApplicationService } from '@application/field/services/HoldingApplicationService';
import { ApiRequest } from '@core/api/ApiRequest';
import { ApiExecutionContext } from '@infra/gas/ApiExecutionContext';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockActivityApplicationService extends ActivityApplicationService {
  public recordedCmd: any = null;

  constructor() {
    super(null as any, null as any);
  }

  public async recordActivity(command: any): Promise<any> {
    this.recordedCmd = command;
    return {
      id: 'ACT-MOCK-100',
      staffNo: command.staffNo,
      reportedQuantity: command.quantity,
      photoUrl: command.photoUrl,
      latitude: command.latitude,
      longitude: command.longitude,
      accuracy: command.accuracy,
      occurredAt: new Date().toISOString()
    };
  }
}

class MockHoldingApplicationService extends HoldingApplicationService {
  constructor() {
    super(null as any, null as any);
  }

  public async getHolding(staffNo: string): Promise<any> {
    return {
      staffNo,
      quantity: 1000,
      updatedAt: new Date().toISOString()
    };
  }
}

async function runTests() {
  console.log('[Test ReservationHandler] Running unit tests...');

  const activityService = new MockActivityApplicationService();
  const holdingService = new MockHoldingApplicationService();
  const handler = new ReservationHandler(activityService, holdingService);
  const context = new ApiExecutionContext();

  const request = new ApiRequest({
    method: 'POST',
    path: '/field/reservation',
    version: 'v2',
    requestId: 'req-reserve-1',
    body: {
      flyerStockId: 'stock-100',
      distributorId: 'S037',
      quantity: 300,
      photoUrl: 'http://example.com/photo.jpg',
      latitude: 34.965,
      longitude: 136.622
    }
  });

  const response = await handler.execute(request, context);
  assert(response.success === true, 'Response must be success');
  assert(response.status === 200, 'Status must be 200');

  // Verify that ActivityApplicationService was called with correct mapped command parameters
  assert(activityService.recordedCmd !== null, 'recordActivity must be called');
  assert(activityService.recordedCmd.staffNo === 'S037', 'staffNo mapping failed');
  assert(activityService.recordedCmd.quantity === 300, 'quantity mapping failed');
  assert(activityService.recordedCmd.photoUrl === 'http://example.com/photo.jpg', 'photoUrl mapping failed');
  assert(activityService.recordedCmd.latitude === 34.965, 'latitude mapping failed');
  assert(activityService.recordedCmd.longitude === 136.622, 'longitude mapping failed');

  // Verify backward-compatible fields in response
  assert(response.data.success === true, 'success field mismatch');
  assert(response.data.stock.quantity === 1000, 'stock quantity must remain 1000 (no auto-subtraction)');
  assert(response.data.eventIds[0] === 'EV-DAR-ACT-MOCK-100', 'Event ID mismatch');

  console.log('[Test ReservationHandler] All tests PASSED.');
}

runTests().catch(err => {
  console.error('[Test ReservationHandler] Failed:', err);
  process.exit(1);
});
