import { AreaId } from '@domain/field/valueobjects/AreaId';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test AreaId] Verifying AreaId value object...');

  // 1. Valid ID creation
  {
    const areaId = new AreaId('  AREA-01  ');
    assert(areaId.getValue() === 'AREA-01', 'AreaId must trim white spaces');
  }

  // 2. Empty ID creation rejects
  {
    let errorThrown = false;
    try {
      new AreaId('');
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Empty AreaId must throw error');
  }

  // 3. Whitespace ID creation rejects
  {
    let errorThrown = false;
    try {
      new AreaId('   ');
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Whitespace AreaId must throw error');
  }

  // 4. Equality checks
  {
    const a = new AreaId('AREA-01');
    const b = new AreaId('AREA-01');
    const c = new AreaId('AREA-02');
    assert(a.equals(b), 'Identical AreaIds must be equal');
    assert(!a.equals(c), 'Different AreaIds must not be equal');
  }

  console.log('[Test AreaId] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
