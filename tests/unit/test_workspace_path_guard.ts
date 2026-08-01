import { WorkspacePathValidator } from "../../../../tools/validators/WorkspacePathValidator";
import { DirectoryResponsibilityRule } from "../../../../tools/review/rules/DirectoryResponsibilityRule";
import { OwnershipRule } from "../../../../tools/review/rules/OwnershipRule";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

async function runTest() {
  console.log("🧪 Running Workspace Path Architecture Guard Unit Test...\n");

  // 1. Validate clean workspace codebase using WorkspacePathValidator
  const validator = new WorkspacePathValidator();
  const result = await validator.validate();
  assert(result.status === "PASS", `WorkspacePathValidator must PASS clean codebase. Messages: ${result.messages.join("\n")}`);
  console.log("   ✓ WorkspacePathValidator PASS on valid codebase.");

  // 2. Validate DirectoryResponsibilityRule rule evaluation
  const dirRule = new DirectoryResponsibilityRule();
  const dirViolations = await dirRule.evaluate({
    taskTitle: "POSTING MAP path test",
    proposedFiles: [
      "/Volumes/SSD_DATA/AI Development OS/projects/posting-map/src/shared/PostingMapPathResolver.ts"
    ],
    isPlatformTask: true,
    planContent: ""
  });
  assert(dirViolations.length === 0, "PostingMapPathResolver.ts must have 0 violations");
  console.log("   ✓ DirectoryResponsibilityRule PASS on Resolver file.");

  // 3. Validate OwnershipRule rule evaluation
  const ownerRule = new OwnershipRule();
  const ownerViolations = await ownerRule.evaluate({
    taskTitle: "POSTING MAP path test",
    proposedFiles: [
      "/Volumes/SSD_DATA/AI Development OS/projects/posting-map/src/platform/election-research-runtime/ElectionResearchRuntime.ts"
    ],
    isPlatformTask: true,
    planContent: ""
  });
  assert(ownerViolations.length === 0, "ElectionResearchRuntime using Resolver must have 0 violations");
  console.log("   ✓ OwnershipRule PASS on Resolver-compliant runtime.");

  console.log("\n==========================================");
  console.log("🎉 WORKSPACE PATH GUARD TEST PASSED");
  console.log("==========================================\n");
}

runTest();
