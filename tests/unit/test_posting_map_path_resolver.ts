import * as path from "path";
import { PostingMapPathResolver } from "../../src/shared/PostingMapPathResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

function runTest() {
  console.log("🧪 Running PostingMapPathResolver Unit Test...\n");

  const resolver = new PostingMapPathResolver();
  const workspaceRoot = resolver.getWorkspaceRoot();
  
  assert(typeof workspaceRoot === "string" && workspaceRoot.length > 0, "workspaceRoot must be non-empty string");
  assert(resolver.getProjectRoot() === path.join(workspaceRoot, "projects", "posting-map"), "getProjectRoot must match");
  assert(resolver.getFieldOperationsPlatformRoot() === path.join(workspaceRoot, "projects", "posting-map", "FIELD_OPERATIONS_PLATFORM"), "getFieldOperationsPlatformRoot must match");
  assert(resolver.getBranchRoot() === path.join(workspaceRoot, "projects", "posting-map", "FIELD_OPERATIONS_PLATFORM", "03_BRANCH"), "getBranchRoot must match");
  assert(resolver.getBranchDirectory("東京第18区") === path.join(workspaceRoot, "projects", "posting-map", "FIELD_OPERATIONS_PLATFORM", "03_BRANCH", "東京第18区"), "getBranchDirectory must match");
  assert(resolver.getDashboardRoot() === path.join(workspaceRoot, "projects", "posting-map", "active", "dashboard"), "getDashboardRoot must match");
  assert(resolver.getAssetRegistryPath() === path.join(workspaceRoot, "projects", "posting-map", "active", "dashboard", "clients", "AssetRegistry.json"), "getAssetRegistryPath must match");

  // Test normalizing project root input
  const projectRootInput = path.join(workspaceRoot, "projects", "posting-map");
  const resolverFromProject = new PostingMapPathResolver(projectRootInput);
  assert(resolverFromProject.getWorkspaceRoot() === workspaceRoot, "Project root input must normalize to workspace root");
  assert(resolverFromProject.getBranchDirectory("東京第18区") === resolver.getBranchDirectory("東京第18区"), "Resolved branch directory must match");

  console.log("==========================================");
  console.log("🎉 POSTING MAP PATH RESOLVER TEST PASSED");
  console.log("==========================================\n");
}

runTest();
