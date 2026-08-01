import { WorkspacePathAuditLogger } from '../../src/shared/audit/WorkspacePathAuditLogger';
import { PostingMapPathResolver } from '../../src/shared/PostingMapPathResolver';
import { WorkspacePathValidator } from '../../../../tools/validators/WorkspacePathValidator';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Workspace Path Governance & Audit Foundation Unit Test...\n");

  const logger = WorkspacePathAuditLogger.getInstance();
  logger.clear();

  // 1. Audit Event & Logger Basic Verification
  logger.logEvent({
    componentName: "TestComponent",
    eventType: "VALIDATION_STARTED",
    executionContext: { scope: "unit-test" }
  });

  let events = logger.getEvents();
  assert(events.length === 1, "Expected 1 logged event.");
  assert(events[0].eventId.startsWith("wpae-"), "Event ID prefix mismatch.");
  assert(events[0].eventType === "VALIDATION_STARTED", "Event type mismatch.");
  console.log("   ✓ WorkspacePathAuditLogger basic logging verified.");

  // 2. Resolver Call Audit Verification
  logger.clear();
  const resolver = new PostingMapPathResolver();
  resolver.getBranchDirectory("東京第18区");
  resolver.getAssetRegistryPath();

  const resolverEvents = logger.getEventsByComponent("PostingMapPathResolver");
  assert(resolverEvents.length === 2, "Expected 2 RESOLVER_CALLED events for PostingMapPathResolver.");
  assert(resolverEvents[0].resolverMethod === "getBranchDirectory", "First resolver method mismatch.");
  assert(resolverEvents[1].resolverMethod === "getAssetRegistryPath", "Second resolver method mismatch.");
  console.log("   ✓ Resolver utilization audit events verified.");

  // 3. Validation Pipeline Audit Verification
  logger.clear();
  const validator = new WorkspacePathValidator();
  const valResult = await validator.validate();

  assert(valResult.status === "PASS", "WorkspacePathValidator must pass.");
  const validationEvents = logger.getEventsByComponent("WorkspacePathValidator");
  assert(validationEvents.length >= 2, "Expected at least 2 validation audit events.");

  const startEvents = logger.getEventsByType("VALIDATION_STARTED");
  const passEvents = logger.getEventsByType("VALIDATION_PASSED");
  assert(startEvents.length >= 1, "VALIDATION_STARTED event missing.");
  assert(passEvents.length >= 1, "VALIDATION_PASSED event missing.");
  console.log("   ✓ Validation Pipeline audit events verified.");

  console.log("\n==========================================");
  console.log("🎉 WORKSPACE PATH AUDIT FOUNDATION PASSED");
  console.log("==========================================\n");
}

runTest();
