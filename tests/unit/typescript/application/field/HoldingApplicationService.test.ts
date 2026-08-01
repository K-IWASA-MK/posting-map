import { HoldingApplicationService } from '@application/field/services/HoldingApplicationService';
import { IFlyerHoldingRepository } from '@domain/field/holding/repositories/IFlyerHoldingRepository';
import { FlyerHolding } from '@domain/field/holding/entities/FlyerHolding';
import { DeclareHoldingCommand } from '@application/field/commands/DeclareHoldingCommand';
import { ApplicationEventPublisher } from '@application/events/ApplicationEventPublisher';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockFlyerHoldingRepository implements IFlyerHoldingRepository {
  public db = new Map<string, FlyerHolding>();

  public async findByStaffNo(staffNo: string): Promise<FlyerHolding | undefined> {
    return this.db.get(staffNo);
  }

  public async findAllRaw(): Promise<any[]> {
    return Array.from(this.db.values()).map(h => ({
      id: 'Holding-' + h.staffNo,
      staffId: h.staffNo,
      staffName: 'Mock Name',
      location: '自宅',
      count: h.getQuantity().getValue(),
      updatedAt: h.getUpdatedAt().getTime()
    }));
  }

  public async findAll(): Promise<FlyerHolding[]> {
    return Array.from(this.db ? this.db.values() : []);
  }
  async save(holding: FlyerHolding): Promise<void> {
    this.db.set(holding.staffNo, holding);
  }

  public async delete(staffNo: string): Promise<void> {
    this.db.delete(staffNo);
  }
}

async function runTests() {
  console.log('[Test HoldingApplicationService] Verifying service...');

  const repo = new MockFlyerHoldingRepository();
  const publisher = new ApplicationEventPublisher();
  const service = new HoldingApplicationService(repo, publisher);

  // 1. Declare new holding -> creates entry, publishes FlyerHoldingCreatedEvent
  {
    const command = new DeclareHoldingCommand('S037', 1000);
    const dto = await service.declareHolding(command);
    assert(dto.staffNo === 'S037', 'staffNo mismatch');
    assert(dto.quantity === 1000, 'quantity mismatch');
    assert(publisher.publishedEvents.length === 1, 'Event must be published');
    assert(publisher.publishedEvents[0].eventType === 'FlyerHoldingCreatedEvent', 'Event type mismatch');
  }

  // 2. Declare update holding -> updates existing entry, no new event published
  {
    publisher.publishedEvents.length = 0;
    const command = new DeclareHoldingCommand('S037', 2500);
    const dto = await service.declareHolding(command);
    assert(dto.staffNo === 'S037', 'staffNo mismatch');
    assert(dto.quantity === 2500, 'quantity must be directly updated to 2500');
    assert(publisher.publishedEvents.length === 0, 'No new event on update');
  }

  console.log('[Test HoldingApplicationService] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
