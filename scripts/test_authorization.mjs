const GAS_URL = "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec";

async function runTests() {
  const testPayload = {
    action: "registerStaff",
    lastName: "AuthzTest",
    firstName: "LINE",
    lineUserId: "U_TRACE_TEST_" + Date.now()
  };

  console.log("=== Test 1: No Token (Should fail with PM-AUT-001) ===");
  try {
    const resp1 = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(testPayload),
      redirect: "follow"
    });
    console.log("Test 1 Response:", await resp1.text());
  } catch(e) {
    console.log("Error:", e.message);
  }

  console.log("\n=== Test 2: With valid stub token (Should succeed) ===");
  try {
    const resp2 = await fetch(GAS_URL + "?liffToken=stub-test-token", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(testPayload),
      redirect: "follow"
    });
    console.log("Test 2 Response:", await resp2.text());
  } catch(e) {
    console.log("Error:", e.message);
  }
}

runTests();
