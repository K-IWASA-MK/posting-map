/**
 * POSTING MAP
 * Phase 36: Automated Report Generator Test Suite
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

function runTest() {
  console.log(`==================================================`);
  console.log(`🧪 Running Automated Report Generator Test Suite`);
  console.log(`==================================================\n`);

  const reportsDir = path.join(__dirname, '..', 'active', 'dashboard', 'clients', 'reports');
  const historyPath = path.join(reportsDir, 'history.json');

  // 1. Trigger manual generation of a weekly report
  console.log("Triggering report-generator.js with type: weekly...");
  execSync('node development/report-generator.js --type weekly', { stdio: 'inherit' });

  // 2. Assert history file and directories exist
  assert.ok(fs.existsSync(historyPath), "history.json metadata log must exist.");
  
  const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  assert.ok(historyData.history.length > 0, "History list must not be empty.");
  
  // Get latest entry
  const latest = historyData.history[0];
  assert.equal(latest.type, "weekly", "Latest generated type must be 'weekly'");
  assert.ok(latest.files.markdown, "Markdown report path must be defined");
  assert.ok(latest.files.html, "HTML report path must be defined");
  assert.ok(latest.files.csv, "CSV report path must be defined");

  // 3. Confirm physical file existence
  const mdPath = path.join(__dirname, '..', 'active', 'dashboard', latest.files.markdown);
  const htmlPath = path.join(__dirname, '..', 'active', 'dashboard', latest.files.html);
  const csvPath = path.join(__dirname, '..', 'active', 'dashboard', latest.files.csv);

  assert.ok(fs.existsSync(mdPath), `Markdown file must exist physically: ${mdPath}`);
  assert.ok(fs.existsSync(htmlPath), `HTML file must exist physically: ${htmlPath}`);
  assert.ok(fs.existsSync(csvPath), `CSV file must exist physically: ${csvPath}`);

  console.log("\nConfirming generated file contents parsing...");
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  assert.ok(mdContent.includes("# POSTING MAP WEEKLY PERFORMANCE REPORT"), "Markdown must contain correct title header.");

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  assert.ok(csvContent.startsWith("DistrictId,DistrictName,TotalAreas,CompletedAreas,ProgressAvg"), "CSV must contain matching header columns.");

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(htmlContent.includes("POSTING MAP <span style=\"color: #3b82f6;\">WEEKLY REPORT</span>"), "HTML must contain matches template title span.");

  // 4. Test history limit queue capping (mock append up to 105 entries)
  console.log("\nTesting history registry maximum limit capping queue (Limit: 100)...");
  const testHistory = { ...historyData };
  testHistory.history = Array.from({ length: 105 }, (_, i) => ({
    type: "daily",
    timestamp: Date.now() - i * 1000,
    files: { markdown: `test-${i}.md`, csv: `test-${i}.csv`, html: `test-${i}.html` }
  }));
  fs.writeFileSync(historyPath, JSON.stringify(testHistory, null, 2), 'utf8');

  // Trigger report-generator again to see if it trims down to 100
  execSync('node development/report-generator.js --type daily', { stdio: 'ignore' });
  
  const trimmedData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  assert.equal(trimmedData.history.length, 100, "History queue length must be capped and trimmed exactly to 100.");
  console.log("✓ History capping queue trim verified successfully.");

  // Cleanup test run history
  fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2), 'utf8');

  console.log(`\n==================================================`);
  console.log(`🎉 ALL REPORT GENERATION INTEGRITY TESTS PASSED`);
  console.log(`==================================================`);
}

runTest();
