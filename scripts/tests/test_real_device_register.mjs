const GAS_URL = "https://script.google.com/macros/s/AKfycbxy1fuWL89swFVzCZW3cuPf73s7q1IrEP3aoqT2y2aQjvfcm3g0HHJ5705K9lYMYITU/exec";

async function run() {
  console.log("Testing registerStaff with stub token...");
  try {
    const resp = await fetch(GAS_URL + "?liffToken=valid-liff-token", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "registerStaff",
        lastName: "テスト",
        firstName: "LINE",
        lineUserId: "U_TEST_CEO"
      }),
      redirect: "follow"
    });
    const text = await resp.text();
    console.log("Raw Response:", text);
    
    const resp2 = await fetch(GAS_URL + "?action=getEvidence&liffToken=valid-liff-token", {
      method: "GET",
      redirect: "follow"
    });
    const text2 = await resp2.text();
    const json2 = JSON.parse(text2);
    if(json2.success) {
      console.log("Latest Roster row:", JSON.stringify(json2.rosterLatest));
      console.log("Latest TraceLog:", JSON.stringify(json2.traceLatest, null, 2));
    }
  } catch (err) {
    console.log("Error:", err);
  }
}
run();
