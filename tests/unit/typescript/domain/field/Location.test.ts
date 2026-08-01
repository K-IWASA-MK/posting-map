import { Location } from '@domain/field/valueobjects/Location';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test Location] Verifying Location value object...');

  // 1. Valid Location
  {
    const loc = new Location(35.6895, 139.6917, 10);
    assert(loc.latitude === 35.6895, 'Latitude mismatch');
    assert(loc.longitude === 139.6917, 'Longitude mismatch');
    assert(loc.accuracy === 10, 'Accuracy mismatch');
  }

  // 2. Reject out of bounds latitude
  {
    let errorThrown = false;
    try {
      new Location(91, 139.6917, 10);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Latitude above 90 must throw error');

    errorThrown = false;
    try {
      new Location(-90.1, 139.6917, 10);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Latitude below -90 must throw error');
  }

  // 3. Reject out of bounds longitude
  {
    let errorThrown = false;
    try {
      new Location(35.6895, 180.1, 10);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Longitude above 180 must throw error');

    errorThrown = false;
    try {
      new Location(35.6895, -181, 10);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Longitude below -180 must throw error');
  }

  // 4. Reject negative accuracy
  {
    let errorThrown = false;
    try {
      new Location(35.6895, 139.6917, -0.1);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Negative accuracy must throw error');
  }

  // 5. Equality
  {
    const a = new Location(35, 135, 5);
    const b = new Location(35, 135, 5);
    const c = new Location(35.1, 135, 5);
    assert(a.equals(b), 'Identical Locations must be equal');
    assert(!a.equals(c), 'Different Locations must not be equal');
  }

  console.log('[Test Location] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
