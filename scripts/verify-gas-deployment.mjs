import fs from 'fs';
import path from 'path';

const deploymentPath = path.join(process.cwd(), 'deployment.json');
const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const ssotUrl = deploymentData?.resources?.webAppUrl;

console.log('=== TASK-POSTING-MAP-004 Validation Suite ===\n');

async function runValidation() {
  console.log(`[Target Endpoint] ${ssotUrl}\n`);

  // --- Gate 2: Endpoint Health & Reachability ---
  console.log('--- Gate 2: GAS Endpoint Health & Reachability ---');
  const startTime2 = Date.now();
  try {
    const res2 = await fetch(ssotUrl, { method: 'GET', redirect: 'follow' });
    const responseTime2 = Date.now() - startTime2;
    const contentType2 = res2.headers.get('content-type') || 'unknown';
    const text2 = await res2.text();

    console.log(`HTTP Status: ${res2.status}`);
    console.log(`Response Time: ${responseTime2} ms`);
    console.log(`Content-Type: ${contentType2}`);
    console.log(`Raw Body Snippet: ${text2.substring(0, 150)}...`);

    let isJson2 = false;
    try {
      JSON.parse(text2);
      isJson2 = true;
    } catch(e) {}
    console.log(`JSON Parse Success: ${isJson2}`);

    if (res2.status === 200) {
      console.log('✅ Gate 2 Result: PASS\n');
    } else {
      console.error('❌ Gate 2 Result: FAIL\n');
    }
  } catch (err) {
    console.error(`❌ Gate 2 Network Error: ${err.message}\n`);
  }

  // --- Gate 3: LIFF Identity Resolution (STUB Token) ---
  console.log('--- Gate 3: LIFF Identity Resolution (STUB Mode) ---');
  const startTime3 = Date.now();
  const stubToken = 'valid-liff-token';
  const url3 = `${ssotUrl}?action=registerStaff&liffToken=${stubToken}&lastName=AIOS&firstName=Validator`;
  try {
    const res3 = await fetch(url3, { method: 'GET', redirect: 'follow' });
    const responseTime3 = Date.now() - startTime3;
    const text3 = await res3.text();
    console.log(`HTTP Status: ${res3.status}`);
    console.log(`Response Time: ${responseTime3} ms`);
    console.log(`Auth Mode: STUB (Development Token: ${stubToken})`);

    let json3 = null;
    try { json3 = JSON.parse(text3); } catch(e) {}
    console.log('Parsed Response:', JSON.stringify(json3, null, 2));

    if (res3.status === 200 && json3 && json3.success !== false) {
      console.log('✅ Gate 3 Result: PASS (Identity Resolved in Stub Mode)\n');
    } else {
      console.error('❌ Gate 3 Result: FAIL\n');
    }
  } catch (err) {
    console.error(`❌ Gate 3 Error: ${err.message}\n`);
  }

  // --- Gate 4: Spreadsheet Data Layer (getAppData) ---
  console.log('--- Gate 4: Spreadsheet Data Layer (getAppData) ---');
  const startTime4 = Date.now();
  const url4 = `${ssotUrl}?action=getAppData&liffToken=${stubToken}`;
  try {
    const res4 = await fetch(url4, { method: 'GET', redirect: 'follow' });
    const responseTime4 = Date.now() - startTime4;
    const text4 = await res4.text();
    console.log(`HTTP Status: ${res4.status}`);
    console.log(`Response Time: ${responseTime4} ms`);

    let json4 = null;
    try { json4 = JSON.parse(text4); } catch(e) {}
    const dataObj = (json4 && json4.data) ? json4.data : json4;

    if (dataObj && dataObj.areas && Array.isArray(dataObj.areas)) {
      console.log(`Areas Loaded Count: ${dataObj.areas.length}`);
      console.log(`Sample Area Name: ${dataObj.areas[0]?.name || 'N/A'}`);
      console.log('✅ Gate 4 Result: PASS (Data Layer Successfully Retrieved)\n');
    } else {
      console.log('Raw Response:', text4.substring(0, 300));
      console.error('❌ Gate 4 Result: FAIL (Areas array missing)\n');
    }
  } catch (err) {
    console.error(`❌ Gate 4 Error: ${err.message}\n`);
  }
}

runValidation();
