const GAS_URL = "https://script.google.com/macros/s/AKfycbxy1fuWL89swFVzCZW3cuPf73s7q1IrEP3aoqT2y2aQjvfcm3g0HHJ5705K9lYMYITU/exec";
async function run() {
  try {
    const resp = await fetch(GAS_URL + "?action=debugProperties", { method: "GET" });
    const text = await resp.text();
    console.log("Props:", text);
  } catch (err) {
    console.log("Error:", err);
  }
}
run();
