import { Quantity } from '@domain/field/valueobjects/Quantity';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTests() {
  console.log('[Test Quantity] Verifying Quantity value object...');

  // 1. Valid Quantity creation
  {
    const qty = new Quantity(100);
    assert(qty.getValue() === 100, 'Quantity value mismatch');
  }

  // 2. Reject negative numbers
  {
    let errorThrown = false;
    try {
      new Quantity(-1);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Negative Quantity must throw error');
  }

  // 3. Reject non-integers (floats)
  {
    let errorThrown = false;
    try {
      new Quantity(1.5);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Floating point Quantity must throw error');
  }

  // 4. Add operation
  {
    const q1 = new Quantity(100);
    const q2 = new Quantity(50);
    const result = q1.add(q2);
    assert(result.getValue() === 150, 'Addition result mismatch');
    assert(q1.getValue() === 100, 'Original Quantity must be immutable');
  }

  // 5. Subtract operation
  {
    const q1 = new Quantity(100);
    const q2 = new Quantity(30);
    const result = q1.subtract(q2);
    assert(result.getValue() === 70, 'Subtraction result mismatch');
  }

  // 6. Subtracting to negative rejects
  {
    const q1 = new Quantity(50);
    const q2 = new Quantity(100);
    let errorThrown = false;
    try {
      q1.subtract(q2);
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Subtraction resulting in negative value must throw error');
  }

  console.log('[Test Quantity] All tests PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
