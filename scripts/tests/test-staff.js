const http = require('https');

async function testStaffRegistration() {
  const url = 'https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec';
  const testPayload = {
    action: 'registerStaff',
    lineUserId: 'U_TEST_AUTOMATION_P2_11A_STAFF',
    displayName: 'テストスタッフ_P2_11A'
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      redirect: 'follow'
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

testStaffRegistration();
