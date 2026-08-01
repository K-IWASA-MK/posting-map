/**
 * POSTING MAP
 * Phase 37: HQ Notification Integration Test Suite
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

function runTest() {
  console.log(`==================================================`);
  console.log(`🧪 Running Chatwork Notification Integration Tests`);
  console.log(`==================================================\n`);

  const historyPath = path.join(__dirname, '..', 'active', 'dashboard', 'clients', 'notifications-history.json');
  
  // Clean history or ensure it is initialized
  if (fs.existsSync(historyPath)) {
    fs.unlinkSync(historyPath);
  }

  // 1. Run test connectivity message
  console.log("1. Dispatching Test Connectivity Notification (Mock Mode)...");
  execSync('CHATWORK_API_TOKEN=mock CHATWORK_ROOM_ID=999999 node development/notification-engine.js --type test', { stdio: 'inherit' });

  assert.ok(fs.existsSync(historyPath), "notifications-history.json must be generated");
  let history = JSON.parse(fs.readFileSync(historyPath, 'utf8')).history;
  assert.equal(history.length, 1, "Exactly 1 record must be logged.");
  assert.equal(history[0].type, "test");
  assert.equal(history[0].status, "SUCCESS");
  assert.ok(history[0].response.messageId.startsWith("mock-msg-"));

  // 2. Run new district provisioned message
  console.log("\n2. Dispatching Provision Success Notification (Mock Mode)...");
  execSync('CHATWORK_API_TOKEN=mock CHATWORK_ROOM_ID=999999 node development/notification-engine.js --type provision --district MIE-TEST-05', { stdio: 'inherit' });

  history = JSON.parse(fs.readFileSync(historyPath, 'utf8')).history;
  assert.equal(history.length, 2, "Exactly 2 records must be logged.");
  assert.equal(history[0].type, "provision");
  assert.ok(history[0].contentPreview.includes("MIE-TEST-05"));

  // 3. Test report generation triggering automatic dispatch integration
  console.log("\n3. Testing Integrated Report -> Notification compilation chain...");
  execSync('CHATWORK_API_TOKEN=mock CHATWORK_ROOM_ID=999999 node development/report-generator.js --type daily', { stdio: 'inherit' });

  history = JSON.parse(fs.readFileSync(historyPath, 'utf8')).history;
  // Index 0 must be report, 1 must be provision, 2 must be test
  assert.equal(history.length, 3, "Exactly 3 records must be logged.");
  assert.equal(history[0].type, "report");
  assert.ok(history[0].contentPreview.includes("POSTING MAP DAILY PERFORMANCE REPORT"));

  console.log(`\n==================================================`);
  console.log(`🎉 ALL CHATWORK NOTIFICATION INTEGRITY TESTS PASSED`);
  console.log(`==================================================`);
}

runTest();
