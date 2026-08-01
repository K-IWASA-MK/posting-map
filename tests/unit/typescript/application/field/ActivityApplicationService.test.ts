import { ActivityApplicationService } from '@application/field/services/ActivityApplicationService';
import { IActivityRepository } from '@domain/field/activity/repositories/IActivityRepository';
import { DistributionActivity } from '@domain/field/activity/entities/DistributionActivity';
import { RecordActivityCommand } from '@application/field/commands/RecordActivityCommand';
import { ApplicationEventPublisher } from '@application/events/ApplicationEventPublisher';
import { IFlyerHoldingRepository } from '@domain/field/holding/repositories/IFlyerHoldingRepository';
import { FlyerHolding } from '@domain/field/holding/entities/FlyerHolding';
import { Quantity } from '@domain/field/valueobjects/Quantity';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

class MockActivityRepository implements IActivityRepository {
  async findById(id: string): Promise<DistributionActivity | undefined> { return undefined; }
  public db = new Map<string, DistributionActivity>();

  public async findLatestByStaff(staffNo: string, limit: number): Promise<DistributionActivity[]> {
    return Array.from(this.db.values())
      .filter(a => a.staffNo === staffNo)
      .slice(0, limit);
  }

  public async findByPeriod(start: Date, end: Date): Promise<DistributionActivity[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return Array.from(this.db.values()).filter(
      a => a.occurredAt.getTime() >= startTime && a.occurredAt.getTime() <= endTime
    );
  }

  public async findByYearMonth(workspaceId: string, yearMonth: any): Promise<DistributionActivity[]> {
    return [];
  }

  public async findAll(): Promise<DistributionActivity[]> {
    return Array.from(this.db ? this.db.values() : []);
  }
  public async save(activity: DistributionActivity): Promise<void> {
    this.db.set(activity.id, activity);
  }
}

class MockFlyerHoldingRepository implements IFlyerHoldingRepository {
  public db = new Map<string, FlyerHolding>();

  public async findByStaffNo(staffNo: string): Promise<FlyerHolding | undefined> {
    return this.db.get(staffNo);
  }

  public async findAllRaw(): Promise<any[]> {
    return [];
  }

  public async findAll(): Promise<FlyerHolding[]> {
    return Array.from(this.db.values());
  }

  public async save(holding: FlyerHolding): Promise<void> {
    this.db.set(holding.staffNo, holding);
  }

  public async delete(staffNo: string): Promise<void> {
    this.db.delete(staffNo);
  }
}

async function runTests() {
  console.log('[Test ActivityApplicationService] Verifying service coordination...');

  const repo = new MockActivityRepository();
  const holdingRepo = new MockFlyerHoldingRepository();
  const publisher = new ApplicationEventPublisher();
  
  // Set up initial stock (150 flyers, threshold is 100)
  const initialHolding = new FlyerHolding({
    staffNo: 'S037',
    quantity: new Quantity(150),
    cityName: 'Suzuka'
  });
  await holdingRepo.save(initialHolding);

  const service = new ActivityApplicationService(repo, publisher, holdingRepo);

  // Record activity test: consume 60 flyers -> remaining 90 (triggers shortage warning)
  const command = new RecordActivityCommand(
    'S037',
    60,
    'http://example.com/photo.jpg',
    34.965,
    136.622,
    5,
    'AREA-001'
  );

  const dto = await service.recordActivity(command);
  assert(dto.staffNo === 'S037', 'staffNo mismatch');
  assert(dto.reportedQuantity === 60, 'quantity mismatch');
  assert(dto.photoUrl === 'http://example.com/photo.jpg', 'photoUrl mismatch');
  assert(dto.latitude === 34.965, 'latitude mismatch');
  assert(dto.longitude === 136.622, 'longitude mismatch');

  // Verify stock is NOT decremented (POSTING MAP 憲法: 自動減算の廃止)
  const updatedHolding = await holdingRepo.findByStaffNo('S037');
  assert(updatedHolding !== undefined, 'holding should exist');
  assert(updatedHolding!.getQuantity().getValue() === 150, 'stock should remain 150 (not automatically decremented)');

  // Verify domain events published
  // Should trigger:
  // 1. DistributionActivityCompleted (from activity complete)
  // 2. DistributionActivityRecordedEvent (legacy event compatibility)
  // (FlyerShortageWarning is NOT triggered as inventory is not automatically decremented)
  const eventTypes = publisher.publishedEvents.map(e => e.eventType);
  assert(eventTypes.includes('DistributionActivityCompleted'), 'missing DistributionActivityCompleted event');
  assert(!eventTypes.includes('FlyerShortageWarning'), 'FlyerShortageWarning should not be raised on auto-deductions');
  assert(eventTypes.includes('DistributionActivityRecordedEvent'), 'missing legacy DistributionActivityRecordedEvent event');

  console.log('[Test ActivityApplicationService] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
