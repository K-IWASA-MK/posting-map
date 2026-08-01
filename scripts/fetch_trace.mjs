const GAS_URL = "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec";
(async () => {
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "getEvidence" }),
      redirect: "follow"
    });
    const data = await res.json();
    console.log(JSON.stringify(data.traceLatest || data, null, 2));
  } catch (e) {
    console.error("Failed:", e);
  }
})();
