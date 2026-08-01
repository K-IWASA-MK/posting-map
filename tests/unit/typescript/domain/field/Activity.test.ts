import { DistributionActivity } from '@domain/field/activity/entities/DistributionActivity';
import { Quantity } from '@domain/field/valueobjects/Quantity';
import { Location } from '@domain/field/valueobjects/Location';
import { AreaId } from '@domain/field/valueobjects/AreaId';
import { GPSEvidence } from '@domain/field/valueobjects/GPSEvidence';
import { PhotoEvidence } from '@domain/field/valueobjects/PhotoEvidence';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test Activity] Verifying DistributionActivity with business rules...');

  const now = new Date();

  // 1. Success Path: GPS valid (within 5 minutes), Photo valid, Area set, Qty > 0
  const gpsValid = new GPSEvidence(
    new Location(34.965, 136.622, 5),
    new Date(now.getTime() - 2 * 60 * 1000) // 2 minutes ago
  );
  const photoValid = new PhotoEvidence('http://example.com/photo.png', now);
  const areaId = new AreaId('AREA-123');

  const activity = new DistributionActivity({
    id: 'ACT-01',
    staffNo: 'S037',
    reportedQuantity: new Quantity(300),
    gpsEvidence: gpsValid,
    photoEvidence: photoValid,
    areaId: areaId
  });

  assert(activity.getStatus() === 'IN_PROGRESS', 'initial status must be IN_PROGRESS');

  const events = activity.complete({ now, photoRequired: true });
  assert(activity.getStatus() === 'COMPLETED', 'status should transition to COMPLETED');
  assert(events.length === 1, 'should trigger 1 completed event');
  assert(events[0].eventType === 'DistributionActivityCompleted', 'event type mismatch');

  // 2. GPS Stale (measured 10 minutes ago)
  const gpsStale = new GPSEvidence(
    new Location(34.965, 136.622, 5),
    new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago
  );
  const activityStaleGps = new DistributionActivity({
    id: 'ACT-02',
    staffNo: 'S037',
    reportedQuantity: new Quantity(300),
    gpsEvidence: gpsStale,
    photoEvidence: photoValid,
    areaId: areaId
  });

  try {
    activityStaleGps.complete({ now, photoRequired: true });
    assert(false, 'should throw on stale GPS');
  } catch (err: any) {
    assert(err.message === 'StaleGPSEvidence', 'should fail with StaleGPSEvidence');
  }

  // 3. GPS Missing
  const gpsMissing = new GPSEvidence(); // undefined location/measuredAt
  const activityMissingGps = new DistributionActivity({
    id: 'ACT-03',
    staffNo: 'S037',
    reportedQuantity: new Quantity(300),
    gpsEvidence: gpsMissing,
    photoEvidence: photoValid,
    areaId: areaId
  });

  try {
    activityMissingGps.complete({ now, photoRequired: true });
    assert(false, 'should throw on missing GPS');
  } catch (err: any) {
    assert(err.message === 'MissingGPSEvidence', 'should fail with MissingGPSEvidence');
  }

  // 4. Photo Missing (when required)
  const photoMissing = new PhotoEvidence(); // undefined photoUrl
  const activityMissingPhoto = new DistributionActivity({
    id: 'ACT-04',
    staffNo: 'S037',
    reportedQuantity: new Quantity(300),
    gpsEvidence: gpsValid,
    photoEvidence: photoMissing,
    areaId: areaId
  });

  try {
    activityMissingPhoto.complete({ now, photoRequired: true });
    assert(false, 'should throw on missing required photo');
  } catch (err: any) {
    assert(err.message === 'MissingPhotoEvidence', 'should fail with MissingPhotoEvidence');
  }

  // 5. Photo Missing (when optional) -> should succeed
  const activityOptionalPhoto = new DistributionActivity({
    id: 'ACT-05',
    staffNo: 'S037',
    reportedQuantity: new Quantity(300),
    gpsEvidence: gpsValid,
    photoEvidence: photoMissing,
    areaId: areaId
  });

  const optionalEvents = activityOptionalPhoto.complete({ now, photoRequired: false });
  assert(activityOptionalPhoto.getStatus() === 'COMPLETED', 'optional photo should succeed');
  assert(optionalEvents[0].eventType === 'DistributionActivityCompleted', 'should trigger complete event');

  // 6. Target Area Missing
  const activityMissingArea = new DistributionActivity({
    id: 'ACT-06',
    staffNo: 'S037',
    reportedQuantity: new Quantity(300),
    gpsEvidence: gpsValid,
    photoEvidence: photoValid
  });

  try {
    activityMissingArea.complete({ now, photoRequired: true });
    assert(false, 'should throw when areaId is missing');
  } catch (err: any) {
    assert(err.message === 'Target area is required', 'should throw area required message');
  }

  console.log('[Test Activity] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
