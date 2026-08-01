import { FlyerHolding } from '@domain/field/holding/entities/FlyerHolding';
import { Quantity } from '@domain/field/valueobjects/Quantity';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test FlyerHolding] Verifying FlyerHolding inventory features...');

  // 1. Initial State
  const holding = new FlyerHolding({
    staffNo: 'S037',
    quantity: new Quantity(150),
    cityName: 'Suzuka'
  });

  assert(holding.staffNo === 'S037', 'staffNo mismatch');
  assert(holding.getQuantity().getValue() === 150, 'quantity mismatch');
  assert(!holding.isLowStock(), 'should not be low stock initially (150 > 100)');
  assert(!holding.isOutOfStock(), 'should not be out of stock');

  // 2. Consume & Low Stock Warning (Single Trigger Check)
  // First consumption to 110 (still above 100 threshold)
  let events = holding.consume(new Quantity(40));
  assert(holding.getQuantity().getValue() === 110, 'quantity should be 110');
  assert(events.length === 0, 'no warning should trigger at 110');
  assert(!holding.isWarningTriggered(), 'warning flag should be false');

  // Second consumption to 90 (below 100 threshold) -> should trigger FlyerShortageWarning
  events = holding.consume(new Quantity(20));
  assert(holding.getQuantity().getValue() === 90, 'quantity should be 90');
  assert(holding.isLowStock(), 'should be low stock');
  assert(events.length === 1, 'should return 1 event');
  assert(events[0].eventType === 'FlyerShortageWarning', 'should trigger FlyerShortageWarning');
  assert(holding.isWarningTriggered(), 'warning flag should be true');

  // Third consumption to 80 (still below 100 threshold) -> warning should NOT trigger again
  events = holding.consume(new Quantity(10));
  assert(holding.getQuantity().getValue() === 80, 'quantity should be 80');
  assert(events.length === 0, 'warning should not trigger twice');

  // 4. Out of Stock Check
  events = holding.consume(new Quantity(80));
  assert(holding.getQuantity().getValue() === 0, 'quantity should be 0');
  assert(holding.isOutOfStock(), 'should be out of stock');
  assert(events.length === 1, 'should return out of stock event');
  assert(events[0].eventType === 'FlyerOutOfStock', 'should trigger FlyerOutOfStock');

  // 5. Consume more than available should throw
  try {
    holding.consume(new Quantity(10));
    assert(false, 'should throw error when consuming beyond stock');
  } catch (err: any) {
    assert(err.message === 'FlyerOutOfStock', 'incorrect exception message');
  }

  // 6. Allocate stock
  holding.allocate(new Quantity(200));
  assert(holding.getQuantity().getValue() === 200, 'allocated quantity should be 200');
  assert(!holding.isLowStock(), 'should no longer be low stock');
  assert(!holding.isWarningTriggered(), 'warning flag should be reset');

  // 7. Return to Stock
  holding.returnToStock(new Quantity(50));
  assert(holding.getQuantity().getValue() === 250, 'quantity should be 250 after return');

  // 8. Adjust Stock
  events = holding.adjust(new Quantity(80));
  assert(holding.getQuantity().getValue() === 80, 'quantity should be adjusted to 80');
  assert(events.length === 1 && events[0].eventType === 'FlyerShortageWarning', 'should trigger shortage warning on adjustment');

  console.log('[Test FlyerHolding] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
