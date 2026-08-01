const url = "https://script.google.com/macros/s/AKfycbyZLqHQL1kKBsO5zf2lxbJ1cyGAlaJWbfhoILaRpZfouX0ieikejZELSXOUSW0dti5R/exec";
(async () => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "getEvidence" }),
      redirect: "follow"
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed:", e);
  }
})();
