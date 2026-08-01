import { ApplicationEventPublisher } from '@application/events/ApplicationEventPublisher';
import { FlyerHoldingCreatedEvent } from '@domain/field/events/FieldEvent';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test ApplicationEventPublisher] Verifying publisher...');

  const publisher = new ApplicationEventPublisher();
  const event = new FlyerHoldingCreatedEvent('S037', 1000);

  publisher.publish(event);
  assert(publisher.publishedEvents.length === 1, 'Event must be recorded');
  assert(publisher.publishedEvents[0].eventId === event.eventId, 'Event ID mismatch');
  assert(publisher.publishedEvents[0].aggregateId === 'S037', 'Aggregate ID mismatch');

  console.log('[Test ApplicationEventPublisher] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
