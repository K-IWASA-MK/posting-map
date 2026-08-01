const GAS_URL = "https://script.google.com/macros/s/AKfycbxy1fuWL89swFVzCZW3cuPf73s7q1IrEP3aoqT2y2aQjvfcm3g0HHJ5705K9lYMYITU/exec";

async function run() {
  try {
    const resp = await fetch(GAS_URL + "?action=getAppData&liffToken=valid-liff-token", { method: "GET" });
    const json = await resp.json();
    console.log("Success:", json.success);
    const areas = (json.data && json.data.areas) || json.areas || [];
    console.log("Areas Count:", areas.length);
    if (areas.length > 0) {
      console.log("Sample Area [0]:", JSON.stringify(areas[0], null, 2));
      console.log("Sample Area [1]:", JSON.stringify(areas[1], null, 2));
      console.log("Sample Area [last]:", JSON.stringify(areas[areas.length - 1], null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
