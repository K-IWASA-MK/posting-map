const url = 'https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec?apiKey=valid-api-key&_t=' + Date.now();
const body = JSON.stringify({
  action: "submitDistribution",
  apiKey: "valid-api-key",
  areaName: "四日市市",
  rowId: 2,
  staffName: "AIテスト",
  count: 1,
  isDone: true,
  staffId: "S999",
  userId: "S999",
  legacySheetName: "四日市市"
});

fetch(url, {
  method: 'POST',
  body: body,
  redirect: 'follow'
}).then(res => res.text()).then(text => console.log(text)).catch(err => console.error(err));
