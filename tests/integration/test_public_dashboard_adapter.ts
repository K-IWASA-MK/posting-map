import { PublicDashboardDataAdapter, DEVELOPMENT_FALLBACK_DATA } from "../../src/dashboard/PublicDashboardDataAdapter";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failure] ${message}`);
  }
}

// Global fetch mock helper
let mockResponse: { ok: boolean; status: number; statusText: string; json: () => Promise<any> } | null = null;
let fetchCallCount = 0;
let lastFetchUrl = "";

(global as any).fetch = async (url: string) => {
  fetchCallCount++;
  lastFetchUrl = url;
  if (!mockResponse) {
    throw new Error("Network error");
  }
  return mockResponse;
};

async function runTest() {
  console.log("🧪 Running POSTING MAP Dashboard Consumer Adapter Test...\n");

  // Ensure config source is configured via environment
  process.env.POSTING_MAP_DATA_SOURCE = "MOCK";

  // ==========================================
  // 1. Mock Source Fetch Test
  // ==========================================
  {
    const state = await PublicDashboardDataAdapter.fetchPublicDashboard();
    assert(state.status === "ONLINE", "Mock fetch must return ONLINE status.");
    assert(state.data !== null, "Mock data must be populated.");
    assert(state.data?.districts.length === 2, "Mock districts count must match.");
    assert(state.data?.metadata.presentationHash === "mock-presentation-hash-value-12345", "Mock hash matches.");
    console.log("   ✓ Mock Source Fetch verified.");
  }

  // Set source to LIVE for API tests
  process.env.POSTING_MAP_DATA_SOURCE = "LIVE";

  // ==========================================
  // 2. Live API Fetch & Mapping Test
  // ==========================================
  {
    fetchCallCount = 0;
    const validRaw = {
      ...DEVELOPMENT_FALLBACK_DATA,
      metadata: {
        ...DEVELOPMENT_FALLBACK_DATA.metadata,
        executionId: "exec-live-456",
        presentationHash: "live-presentation-hash-value-999"
      }
    };

    mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => validRaw
    };

    const state = await PublicDashboardDataAdapter.fetchPublicDashboard("https://api.postingmap.dev/district-1/public");
    assert(state.status === "ONLINE", "Successful live fetch returns ONLINE status.");
    assert(state.data?.metadata.executionId === "exec-live-456", "Maps executionId from live response.");
    assert(state.data?.metadata.presentationHash === "live-presentation-hash-value-999", "Maps presentationHash.");
    assert(fetchCallCount === 1, "Exactly one fetch call should be made.");
    assert(lastFetchUrl === "https://api.postingmap.dev/district-1/public", "Calls correct endpoint.");

    console.log("   ✓ Live API Fetch & Mapping verified.");
  }

  // ==========================================
  // 3. Invalid Schema Defensiveness Test
  // ==========================================
  {
    const badRaw = {
      metadata: {
        schemaVersion: "v999", // Unmatched version
        presentationHash: "some-hash"
      }
    };

    mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => badRaw
    };

    const state = await PublicDashboardDataAdapter.fetchPublicDashboard("https://api.postingmap.dev/district-1/public");
    assert(state.status === "WARNING", "Corrupted schema returns WARNING status.");
    assert(state.warning?.includes("Schema validation failed") === true, "Reports schema validation failure in warning.");
    assert(state.data?.metadata.executionId === "exec-mock-123", "Falls back to DEVELOPMENT_FALLBACK_DATA.");

    console.log("   ✓ Invalid Schema Defensiveness verified.");
  }

  // ==========================================
  // 4. Lineage / Hash Exposure Test
  // ==========================================
  {
    assert(DEVELOPMENT_FALLBACK_DATA.lineage.sourceHash !== undefined, "Lineage sourceHash present.");
    assert(DEVELOPMENT_FALLBACK_DATA.lineage.outputHash !== undefined, "Lineage outputHash present.");
    console.log("   ✓ Lineage / Hash Exposure verified.");
  }

  // ==========================================
  // 5. Data Source Switch Test
  // ==========================================
  {
    // Switch to MOCK
    process.env.POSTING_MAP_DATA_SOURCE = "MOCK";
    const stateMock1 = await PublicDashboardDataAdapter.fetchPublicDashboard();
    assert(stateMock1.status === "ONLINE", "Mock active.");

    // Switch to LIVE
    process.env.POSTING_MAP_DATA_SOURCE = "LIVE";
    mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DEVELOPMENT_FALLBACK_DATA
    };
    const stateLive = await PublicDashboardDataAdapter.fetchPublicDashboard("https://api.postingmap.dev/district-1/public");
    assert(stateLive.status === "ONLINE", "Live active.");

    // Switch back to MOCK
    process.env.POSTING_MAP_DATA_SOURCE = "MOCK";
    const stateMock2 = await PublicDashboardDataAdapter.fetchPublicDashboard();
    assert(stateMock2.status === "ONLINE", "Mock active again.");
    assert(stateMock2.data?.metadata.executionId === "exec-mock-123", "Mock properties returned.");

    console.log("   ✓ Data Source Switch verified.");
  }

  // ==========================================
  // 6. Offline Recovery Test
  // ==========================================
  {
    process.env.POSTING_MAP_DATA_SOURCE = "LIVE";

    // 1. Force network failure
    mockResponse = null; 

    const stateFail = await PublicDashboardDataAdapter.fetchPublicDashboard("https://api.postingmap.dev/district-1/public");
    assert(stateFail.status === "OFFLINE", "Network error maps to OFFLINE.");
    assert(stateFail.warning?.includes("Network exception encountered") === true, "Warning captures the throw.");
    assert(stateFail.data?.metadata.executionId === "exec-mock-123", "Fails back to mock fallback dataset.");

    // 2. Recovery: API back online
    mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DEVELOPMENT_FALLBACK_DATA
    };

    const stateRecovered = await PublicDashboardDataAdapter.fetchPublicDashboard("https://api.postingmap.dev/district-1/public");
    assert(stateRecovered.status === "ONLINE", "Recovered API returns ONLINE status.");
    assert(stateRecovered.warning === null, "Recovered warning is null.");

    console.log("   ✓ Offline Recovery verified.");
  }

  console.log("\n==========================================");
  console.log("🎉 DASHBOARD CONSUMER ADAPTER PASSED");
  console.log("==========================================\n");
}

runTest().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
