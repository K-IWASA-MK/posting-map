/**
 * Recovery Sprint 1-1: Distribution API Standard Contract Unit Test
 * 
 * 役割:
 * 1. Normalizer (パラメータ揺らぎの吸収) のテスト
 * 2. Validator (Business Rules: staffId/areaId/rowId/count の検証) のテスト
 * 3. 統一 Response Contract (success, code, message) の検証
 */

async function runDistributionContractTests() {
  console.log("=== Running Distribution Contract Unit Tests ===");

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

  // --- GASコードのロジックと同等のTypeScript関数（コンパイル可能テスト用） ---
  const DEFAULT_TENANT_ID = "MIE-03";
  const DEFAULT_BRANCH_ID = "MIE-03";

  function normalizeDistributionContract(data: any) {
    if (!data || typeof data !== 'object') return null;
    const staffId = String(data.staffId || data.userId || "").trim();
    const areaId = String(data.areaId || data.blockId || data.areaName || data.legacySheetName || "").trim();
    const rawRow = data.rowId || data.legacyRow;
    const rowId = parseInt(rawRow, 10);
    const rawCount = typeof data.count !== 'undefined' ? data.count : data.distributedCount;
    const count = parseFloat(rawCount);

    return {
      staffId: staffId,
      staffName: String(data.staffName || "").trim(),
      areaId: areaId,
      rowId: isNaN(rowId) ? -1 : rowId,
      count: isNaN(count) ? 0 : count,
      isDone: data.isDone === true || data.isDone === 'true' || data.isComplete === true || data.isComplete === 'true',
      tenantId: String(data.tenantId || DEFAULT_TENANT_ID),
      branchId: String(data.branchId || DEFAULT_BRANCH_ID),
      timestamp: parseInt(data.timestamp, 10) || Date.now(),
      lat: parseFloat(data.lat) || 0,
      lng: parseFloat(data.lng) || 0
    };
  }

  function validateDistributionContract(contract: any) {
    if (!contract) {
      return { success: false, code: 'INVALID_PAYLOAD', message: 'Payload is missing or invalid JSON' };
    }
    if (!contract.staffId) {
      return { success: false, code: 'INVALID_STAFF', message: 'staffId is required' };
    }
    if (!contract.areaId) {
      return { success: false, code: 'INVALID_AREA', message: 'areaId is required' };
    }
    if (contract.rowId < 1) {
      return { success: false, code: 'INVALID_ROW', message: 'rowId must be an integer >= 1' };
    }
    if (contract.count <= 0) {
      return { success: false, code: 'INVALID_COUNT', message: 'count must be greater than 0' };
    }
    return { success: true, code: 'SUCCESS', message: 'Valid contract' };
  }

  // --- テストケース実行 ---

  // Test 1: 標準DTO形式 -> Normalizer & Validator 成功
  const input1 = { staffId: "STUFF-001", areaId: "MIE-03-AREA-A", rowId: 5, count: 10, isDone: true };
  const dto1 = normalizeDistributionContract(input1);
  const val1 = validateDistributionContract(dto1);
  assertEqual("Test 1: Standard Payload Success", val1.success, true);
  assertEqual("Test 1: Code SUCCESS", val1.code, "SUCCESS");

  // Test 2: 旧Web形式 (`userId`, `areaName`, `legacyRow`) -> 正常変換
  const input2 = { userId: "USER-999", areaName: "MIE-03-AREA-B", legacyRow: "12", distributedCount: "50", isComplete: "true" };
  const dto2 = normalizeDistributionContract(input2);
  assertEqual("Test 2: Legacy Normalization staffId", dto2?.staffId, "USER-999");
  assertEqual("Test 2: Legacy Normalization areaId", dto2?.areaId, "MIE-03-AREA-B");
  assertEqual("Test 2: Legacy Normalization rowId", dto2?.rowId, 12);
  assertEqual("Test 2: Legacy Normalization count", dto2?.count, 50);
  const val2 = validateDistributionContract(dto2);
  assertEqual("Test 2: Legacy Payload Validated", val2.success, true);

  // Test 3: Business Rule 違反: staffId 欠落 -> INVALID_STAFF
  const input3 = { areaId: "AREA-X", rowId: 1, count: 10, isDone: true };
  const dto3 = normalizeDistributionContract(input3);
  const val3 = validateDistributionContract(dto3);
  assertEqual("Test 3: Missing staffId -> Failure", val3.success, false);
  assertEqual("Test 3: Missing staffId Code", val3.code, "INVALID_STAFF");

  // Test 4: Business Rule 違反: areaId 欠落 -> INVALID_AREA
  const input4 = { staffId: "STAFF-1", rowId: 1, count: 10, isDone: true };
  const dto4 = normalizeDistributionContract(input4);
  const val4 = validateDistributionContract(dto4);
  assertEqual("Test 4: Missing areaId -> Failure", val4.success, false);
  assertEqual("Test 4: Missing areaId Code", val4.code, "INVALID_AREA");

  // Test 5: Business Rule 違反: rowId < 1 -> INVALID_ROW
  const input5 = { staffId: "STAFF-1", areaId: "AREA-1", rowId: 0, count: 10, isDone: true };
  const dto5 = normalizeDistributionContract(input5);
  const val5 = validateDistributionContract(dto5);
  assertEqual("Test 5: rowId=0 -> Failure", val5.success, false);
  assertEqual("Test 5: rowId=0 Code", val5.code, "INVALID_ROW");

  // Test 6: Business Rule 違反: count <= 0 -> INVALID_COUNT
  const input6 = { staffId: "STAFF-1", areaId: "AREA-1", rowId: 1, count: 0, isDone: true };
  const dto6 = normalizeDistributionContract(input6);
  const val6 = validateDistributionContract(dto6);
  assertEqual("Test 6: count=0 -> Failure", val6.success, false);
  assertEqual("Test 6: count=0 Code", val6.code, "INVALID_COUNT");

  // Test 7: staffName 空文字保持確認（IDの誤補完なし）
  assertEqual("Test 7: staffName empty by default", dto1?.staffName, "");

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runDistributionContractTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
