const GAS_URL = "https://script.google.com/macros/s/AKfycbxy1fuWL89swFVzCZW3cuPf73s7q1IrEP3aoqT2y2aQjvfcm3g0HHJ5705K9lYMYITU/exec";

async function run() {
  try {
    const resp2 = await fetch(GAS_URL + "?liffToken=valid-liff-token", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "getEvidence" }),
      redirect: "follow"
    });
    const text2 = await resp2.text();
    const json2 = JSON.parse(text2);
    if(json2.success) {
      console.log("Latest Roster row:", JSON.stringify(json2.data.rosterLatest));
      console.log("Latest TraceLog rows:", JSON.stringify(json2.data.traceLatest, null, 2));
    } else {
      console.log("Error:", text2);
    }
  } catch (err) {
    console.log("Error:", err);
  }
}
run();
