import { DataBuilderRuntime } from '../../src/platform/data-builder-runtime/DataBuilderRuntime';
import { RootResolver } from '../../../../tools/review/RootResolver';
import { PostingMapPathResolver } from '../../src/shared/PostingMapPathResolver';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Data Builder Runtime Foundation Integration Test...\n");

  process.env.NODE_ENV = 'test';
  process.env.AIOS_MOCK = 'true';
  const pathResolver = new PostingMapPathResolver();

  const mockEvent = {
    type: "RESEARCH_COMPLETED",
    missionId: "MIS-TEST-002",
    districtName: "東京第18区"
  };

  try {
    // Execute data builder process
    const result = await DataBuilderRuntime.processEvent(mockEvent);

    assert(result.success === true, "Data builder compilation execution must succeed.");
    assert(result.outputEvent !== undefined, "Output event must be returned.");
    assert(result.outputEvent.type === "DATA_BUILD_COMPLETED", "Output event type must be DATA_BUILD_COMPLETED.");
    assert(result.outputEvent.missionId === "MIS-TEST-002", "Mission ID mismatch.");

    // Retrieve generated outputs
    const branchDir = pathResolver.getBranchDirectory('東京第18区');
    const districtPath = path.join(branchDir, 'district.json');
    const configPath = path.join(branchDir, 'config.json');

    assert(fs.existsSync(districtPath), "district.json must be generated.");
    assert(fs.existsSync(configPath), "config.json must be generated.");

    // Validate district.json schema
    const district = JSON.parse(fs.readFileSync(districtPath, 'utf8'));
    assert(district.district.id === "TOKYO-18", "Expected ID: TOKYO-18");
    assert(district.district.name === "東京第18区", "District name mismatch.");
    assert(Array.isArray(district.district.municipalities), "municipalities must be an array.");
    
    // Assert extended object array structure for municipalities
    const mus = district.district.municipalities;
    assert(mus.length === 3, "Expected 3 municipalities.");
    assert(typeof mus[0] === 'object' && mus[0].name === "武蔵野市", "Municipality 0 should be object mapping.");
    assert(typeof mus[1] === 'object' && mus[1].name === "小金井市", "Municipality 1 should be object mapping.");
    assert(typeof mus[2] === 'object' && mus[2].name === "西東京市", "Municipality 2 should be object mapping.");

    // Validate config.json schema
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(config.system.syncIntervalMs === 30000, "syncIntervalMs mismatch.");
    assert(config.system.map !== undefined, "map object should be present.");
    assert(config.system.map.center === null, "Map center coordinates must be decoupled (null).");
    assert(config.app.mode === "PROD", "App mode default should be PROD.");

    console.log("   ✓ Generated district.json schema (municipalities object array) validated.");
    console.log("   ✓ Generated config.json schema (map.center decoupled) validated.");
    console.log("\n==========================================");
    console.log("🎉 DATA-BUILDER INTEGRATION TEST PASSED");
    console.log("==========================================");

  } catch (err: any) {
    console.error(`\n❌ Test failed: ${err.message}`);
    process.exit(1);
  }
}

runTest();
