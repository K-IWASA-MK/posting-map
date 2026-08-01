import { ApiKeyIdentityProvider } from '../../../src/foundation/authentication/providers/ApiKeyIdentityProvider';
import { ApiRequest } from '../../../src/core/api/ApiRequest';
import { AuthenticationMethod } from '../../../src/foundation/authentication/AuthenticationContext';

async function runTests() {
  console.log("=== Running API Key Authentication Unit Tests ===");

  let passed = 0;
  let failed = 0;

  function assertEqual(name: string, actual: any, expected: any) {
    if (actual === expected) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - Expected ${expected} but got ${actual}`);
      failed++;
    }
  }

  // Test 1: Missing API Key in request
  const providerWithKey = new ApiKeyIdentityProvider('my-secret-key');
  const reqMissing: ApiRequest = {
    path: '/test',
    method: 'GET',
    query: {},
    headers: {},
    body: {},
    version: 'v2',
    pathParams: {},
    requestId: 'req-1'
  };
  const resMissing = providerWithKey.authenticate(reqMissing);
  assertEqual('Test 1: Missing API Key -> Failure', resMissing.success, false);
  assertEqual('Test 1: Missing API Key -> Correct Message', resMissing.failureReason, 'API Key missing in query or headers');

  // Test 2: Invalid API Key provided
  const reqInvalid: ApiRequest = {
    path: '/test',
    method: 'GET',
    query: { apiKey: 'wrong-key' },
    headers: {},
    body: {},
    version: 'v2',
    pathParams: {},
    requestId: 'req-2'
  };
  const resInvalid = providerWithKey.authenticate(reqInvalid);
  assertEqual('Test 2: Invalid API Key -> Failure', resInvalid.success, false);
  assertEqual('Test 2: Invalid API Key -> Correct Message', resInvalid.failureReason, 'Invalid API Key provided');

  // Test 3: Correct API Key provided in query
  const reqValid: ApiRequest = {
    path: '/test',
    method: 'GET',
    query: { apiKey: 'my-secret-key' },
    headers: {},
    body: {},
    version: 'v2',
    pathParams: {},
    requestId: 'req-3'
  };
  const resValid = providerWithKey.authenticate(reqValid);
  assertEqual('Test 3: Correct API Key -> Success', resValid.success, true);
  if (resValid.context) {
    assertEqual('Test 3: Correct Auth Method', resValid.context.authenticationMethod, AuthenticationMethod.API_KEY);
  } else {
    assertEqual('Test 3: Context exists', false, true);
  }

  // Test 4: Previous Stub ('valid-api-key') fails if not matched
  const reqStub: ApiRequest = {
    path: '/test',
    method: 'GET',
    query: { apiKey: 'valid-api-key' },
    headers: {},
    body: {},
    version: 'v2',
    pathParams: {},
    requestId: 'req-4'
  };
  const resStub = providerWithKey.authenticate(reqStub);
  assertEqual('Test 4: Stub Key -> Failure (when real key is different)', resStub.success, false);

  // Test 5: Server missing configuration (expectedApiKey is null)
  const providerNoKey = new ApiKeyIdentityProvider();
  const resNoKey = providerNoKey.authenticate(reqValid);
  assertEqual('Test 5: Server misconfigured -> Failure', resNoKey.success, false);
  assertEqual('Test 5: Server misconfigured -> Correct Message', resNoKey.failureReason, 'API Key authentication is not properly configured on the server.');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
