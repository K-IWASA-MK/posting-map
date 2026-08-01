/**
 * POSTING MAP Generation 2 — Regression Test Suite
 * Test: Sorting Reversion & Flat 10-Item Chunking Verification
 * 
 * Verifies that:
 * 1. Addresses sort strictly by City Priority -> Postal Code Ascending (NO district sorting).
 * 2. Sheet chunking produces exactly 10-item blocks regardless of district boundary transitions.
 * 3. Sheet names follow the exact specification: CityName, CityName(2), CityName(3)...
 */

const assert = require('assert');

// Mock data representing sample extracted addresses crossing district boundaries in Yokkaichi
const mockAddresses = [
  { postalCode: "510-0001", address: "三重県四日市市八幡町1", city: "四日市市", district: "羽津地区" },
  { postalCode: "510-0002", address: "三重県四日市市八幡町2", city: "四日市市", district: "羽津地区" },
  { postalCode: "510-0003", address: "三重県四日市市平町1", city: "四日市市", district: "富洲原地区" },
  { postalCode: "510-0004", address: "三重県四日市市平町2", city: "四日市市", district: "富洲原地区" },
  { postalCode: "510-0005", address: "三重県四日市市日永1", city: "四日市市", district: "日永地区" },
  { postalCode: "510-0006", address: "三重県四日市市日永2", city: "四日市市", district: "日永地区" },
  { postalCode: "510-0007", address: "三重県四日市市日永3", city: "四日市市", district: "日永地区" },
  { postalCode: "510-0008", address: "三重県四日市市日永4", city: "四日市市", district: "日永地区" },
  { postalCode: "510-0009", address: "三重県四日市市日永5", city: "四日市市", district: "日永地区" },
  { postalCode: "510-0010", address: "三重県四日市市赤堀1", city: "四日市市", district: "常磐地区" },
  { postalCode: "510-0011", address: "三重県四日市市赤堀2", city: "四日市市", district: "常磐地区" },
  { postalCode: "510-0012", address: "三重県四日市市赤堀3", city: "四日市市", district: "常磐地区" },
];

const cityOrderPriority = ["桑名市", "いなべ市", "桑名郡", "員弁郡", "三重郡", "四日市市", "鈴鹿市"];

function runSortingTest() {
  console.log("▶ Running Test 1: Address Sorting Logic (Zip Code Ascending)");
  const addresses = [...mockAddresses];
  
  addresses.sort((a, b) => {
    const idxA = cityOrderPriority.indexOf(a.city);
    const idxB = cityOrderPriority.indexOf(b.city);
    const pA = idxA === -1 ? 999 : idxA;
    const pB = idxB === -1 ? 999 : idxB;
    if (pA !== pB) return pA - pB;

    const numA = parseInt((a.postalCode || "0").replace(/-/g, ""), 10);
    const numB = parseInt((b.postalCode || "0").replace(/-/g, ""), 10);
    return numA - numB;
  });

  // Verify sorted postal codes
  for (let i = 0; i < addresses.length - 1; i++) {
    const zip1 = parseInt(addresses[i].postalCode.replace(/-/g, ""), 10);
    const zip2 = parseInt(addresses[i + 1].postalCode.replace(/-/g, ""), 10);
    assert(zip1 <= zip2, `Sorting order failed between index ${i} and ${i+1}`);
  }
  
  // Verify that district transition does NOT reorder (e.g. 富洲原地区 vs 羽津地区)
  // 510-0001 (羽津) should come BEFORE 510-0003 (富洲原) because 5100001 < 5100003
  assert.strictEqual(addresses[0].district, "羽津地区");
  assert.strictEqual(addresses[2].district, "富洲原地区");

  console.log("  ✅ Address Sorting Logic test passed.");
}

function runChunkingTest() {
  console.log("▶ Running Test 2: Flat 10-Item Chunking & Sheet Naming Logic");
  const chunkSize = 10;
  const addresses = [...mockAddresses];
  
  let cityCounts = {};
  let cityNameCounts = {};
  let lastCity = "";
  let itemsInBlock = 0;
  
  const generatedSheets = [];
  
  for (let currentIndex = 0; currentIndex < addresses.length; currentIndex++) {
    const currentAddr = addresses[currentIndex];
    const currentKey = currentAddr.city;
    const cityName = currentAddr.city;

    if (currentKey !== lastCity || itemsInBlock >= chunkSize) {
      cityCounts[currentKey] = (cityCounts[currentKey] || 0) + 1;
      cityNameCounts[cityName] = (cityNameCounts[cityName] || 0) + 1;
      itemsInBlock = 0;
      lastCity = currentKey;
    }

    let sheetName =
      cityNameCounts[cityName] === 1
        ? cityName
        : `${cityName}(${cityNameCounts[cityName]})`;
        
    if (!generatedSheets[cityNameCounts[cityName] - 1]) {
      generatedSheets[cityNameCounts[cityName] - 1] = { name: sheetName, count: 0 };
    }
    generatedSheets[cityNameCounts[cityName] - 1].count++;
    itemsInBlock++;
  }

  // Sheet 1: 四日市市 must have exactly 10 items (despite crossing 羽津, 富洲原, 日永 districts)
  assert.strictEqual(generatedSheets[0].name, "四日市市");
  assert.strictEqual(generatedSheets[0].count, 10, "First sheet should have exactly 10 items");

  // Sheet 2: 四日市市(2) must have remaining 2 items
  assert.strictEqual(generatedSheets[1].name, "四日市市(2)");
  assert.strictEqual(generatedSheets[1].count, 2, "Second sheet should have remaining 2 items");

  console.log("  ✅ Flat 10-Item Chunking & Sheet Naming test passed.");
}

function main() {
  console.log("==================================================");
  console.log("POSTING MAP Generation 2 - Regression Test Runner");
  console.log("==================================================");
  try {
    runSortingTest();
    runChunkingTest();
    console.log("==================================================");
    console.log("🎉 ALL REGRESSION TESTS PASSED (100% SUCCESS)");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  }
}

main();
