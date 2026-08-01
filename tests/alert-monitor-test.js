/**
 * POSTING MAP
 * Phase 35: Operational Alert Monitor Test Suite
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const RegistryManager = require('../development/registry-manager');
const { monitor } = require('../development/alert-monitor');

function runTest() {
  console.log(`==================================================`);
  console.log(`🧪 Running HQ Alert Monitor System Test Suite`);
  console.log(`==================================================\n`);

  const registryPath = RegistryManager.getRegistryPath();
  const originalContent = fs.readFileSync(registryPath, 'utf8');

  try {
    // 1. Inject corrupted mockup data into registry.json
    console.log("Injecting warning states (BLOCKED status, Version 50, heartbeats 24 hours stale) to test triggers...");
    
    const mockRegistry = {
      updatedAt: Date.now(),
      schemaVersion: 1,
      districts: [
        {
          id: "MIE-TEST-01",
          name: "Stale Heartbeat Test District",
          status: "READY",
          deployment: { version: 61, environment: "production" },
          runtime: {
            latency: 120,
            lastHeartbeat: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours old (stale)
            lastCertification: new Date().toISOString()
          },
          resources: { spreadsheetId: "mock", webAppUrl: "mock", scriptId: "mock" }
        },
        {
          id: "MIE-TEST-02",
          name: "Outdated Version Test District",
          status: "READY",
          deployment: { version: 50, environment: "production" }, // Recommended is 61
          runtime: {
            latency: 100,
            lastHeartbeat: new Date().toISOString(),
            lastCertification: new Date().toISOString()
          },
          resources: { spreadsheetId: "mock", webAppUrl: "mock", scriptId: "mock" }
        },
        {
          id: "MIE-TEST-03",
          name: "Blocked Access Gateway Test District",
          status: "BLOCKED", // Blocked state trigger
          deployment: { version: 61, environment: "production" },
          runtime: {
            latency: 0,
            lastHeartbeat: new Date().toISOString(),
            lastCertification: new Date().toISOString()
          },
          resources: { spreadsheetId: "mock", webAppUrl: "mock", scriptId: "mock" }
        }
      ]
    };

    fs.writeFileSync(registryPath, JSON.stringify(mockRegistry, null, 2), 'utf8');

    // 2. Trigger monitor scan
    const alerts = monitor();

    // 3. Confirm alert alerts resolution
    assert.equal(alerts.length, 3, "Exactly 3 alerts must be triggered");
    
    const staleAlert = alerts.find(a => a.type === "HEARTBEAT_LOST" && a.districtId === "MIE-TEST-01");
    assert.ok(staleAlert, "HEARTBEAT_LOST alert must exist");
    assert.equal(staleAlert.severity, "CRITICAL");

    const versionAlert = alerts.find(a => a.type === "VERSION_MISMATCH" && a.districtId === "MIE-TEST-02");
    assert.ok(versionAlert, "VERSION_MISMATCH alert must exist");
    assert.equal(versionAlert.severity, "WARNING");

    const blockedAlert = alerts.find(a => a.type === "STATE_BLOCKED" && a.districtId === "MIE-TEST-03");
    assert.ok(blockedAlert, "STATE_BLOCKED alert must exist");
    assert.equal(blockedAlert.severity, "CRITICAL");

    console.log("\n==================================================");
    console.log("🎉 ALL HQ ALERT MONITOR SYSTEM TESTS PASSED");
    console.log("==================================================");

  } finally {
    // Restore original registry state
    fs.writeFileSync(registryPath, originalContent, 'utf8');
    // Refresh alerts to clean up mock values
    monitor();
  }
}

runTest();
