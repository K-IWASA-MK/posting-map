/**
 * TASK-PM-HOTFIX-002: MIE-03 Region Data Restoration Test
 */

async function runMie03RestorationTest() {
  console.log("=== Running TASK-PM-HOTFIX-002 MIE-03 Restoration Test ===");

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

  // --- Mocking global window config objects ---
  const mockPmsConfig = {
    districtId: "MIE-03",
    districtName: "三重県第3区",
    api: {
      gasWebAppUrl: "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec"
    }
  };

  // Test 1: Fallback logic for PMS_CLIENT_CONFIG
  const mockWindow: any = { PMS_CLIENT_CONFIG: mockPmsConfig, CONFIG: undefined };
  const pmsConfig = mockWindow.PMS_CLIENT_CONFIG || {};
  const config = mockWindow.CONFIG || {};

  const apiUrl = config.API_BASE || pmsConfig.api?.gasWebAppUrl;
  const tenantId = config.DEFAULT_TENANT_ID || pmsConfig.districtId || 'MIE-03';
  const branchId = config.DEFAULT_BRANCH_ID || pmsConfig.districtId || 'MIE-03';

  assertEqual("Test 1: Extracted API URL from PMS_CLIENT_CONFIG", apiUrl, mockPmsConfig.api.gasWebAppUrl);
  assertEqual("Test 1: Extracted TenantId from PMS_CLIENT_CONFIG", tenantId, "MIE-03");
  assertEqual("Test 1: Extracted BranchId from PMS_CLIENT_CONFIG", branchId, "MIE-03");

  // Test 2: Preferred window.CONFIG when provided
  const mockWindowNew: any = {
    CONFIG: {
      API_BASE: "https://script.google.com/macros/s/NEW_ENDPOINT/exec",
      DEFAULT_TENANT_ID: "MIE-03-NEW"
    }
  };
  const configNew = mockWindowNew.CONFIG || {};
  const pmsConfigNew = mockWindowNew.PMS_CLIENT_CONFIG || {};
  const apiUrlNew = configNew.API_BASE || pmsConfigNew.api?.gasWebAppUrl;
  assertEqual("Test 2: Preferred window.CONFIG.API_BASE", apiUrlNew, "https://script.google.com/macros/s/NEW_ENDPOINT/exec");

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runMie03RestorationTest().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
