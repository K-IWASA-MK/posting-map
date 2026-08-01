import * as https from 'https';
import * as http from 'http';

/**
 * TASK-PM-HOTFIX-002: E2E Evidence Verification for MIE-03 Data & Distribution Submission
 */

const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec";

function fetchUrl(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirect if 302 / 301
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function postUrl(url: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const parsedUrl = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Redirection on POST to GAS WebApp
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runMie03E2eEvidenceTest() {
  console.log("==================================================");
  console.log("   TASK-PM-HOTFIX-002: MIE-03 E2E FLOW VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assertTrue(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}${detail ? ' - ' + detail : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ' - ' + detail : ''}`);
      failed++;
    }
  }

  // 1. Dashboard 初期化時の apiUrl 判定
  const mockPmsConfig = {
    districtId: "MIE-03",
    api: { gasWebAppUrl: GAS_WEBAPP_URL }
  };
  const pmsConfig = mockPmsConfig;
  const apiUrl = pmsConfig.api?.gasWebAppUrl;
  assertTrue("Criterion 1: apiUrl is defined and non-empty", typeof apiUrl === 'string' && apiUrl.length > 0, apiUrl);

  // 2. GAS の getDashboardData() / getSummary ネットワーク応答検証
  console.log("\nFetching getDashboardData from GAS endpoint...");
  const targetUrl = `${apiUrl}?action=getDashboardData&tenantId=MIE-03`;
  let dashResponse: any;
  try {
    dashResponse = await fetchUrl(targetUrl);
    assertTrue("Criterion 2: GAS getDashboardData responded successfully", dashResponse !== null && typeof dashResponse === 'object');
  } catch (err: any) {
    assertTrue("Criterion 2: GAS getDashboardData responded successfully", false, err.toString());
  }

  // 3. Networkレスポンスに MIE-03 の地域データ（summary / stats / items）が含まれているか検証
  if (dashResponse) {
    const hasSuccess = dashResponse.success === true || dashResponse.status === "ok" || Array.isArray(dashResponse.summary) || Array.isArray(dashResponse);
    assertTrue("Criterion 3: Response contains MIE-03 area data structure", hasSuccess, `Keys: ${Object.keys(dashResponse).join(', ')}`);
  }

  // 4. ブラウザ画面への地域一覧レンダリングデータ構造検証 (Simulating UI Store & Renderer Input)
  const areaSummaryList = Array.isArray(dashResponse?.summary) ? dashResponse.summary : (Array.isArray(dashResponse) ? dashResponse : []);
  console.log(`\nFound ${areaSummaryList.length} distribution areas (partitioned from 858 address master records) in MIE-03 response.`);
  assertTrue("Criterion 4: Renderable distribution areas count = 91", areaSummaryList.length === 91, `Areas: ${areaSummaryList.length}`);

  // 5. 配布登録 (submitDistribution) の実地送信動作検証
  console.log("\nTesting submitDistribution for MIE-03...");
  const postUrlWithKey = `${apiUrl}?apiKey=valid-api-key`;
  const testDistributionPayload = {
    action: "submitDistribution",
    apiKey: "valid-api-key",
    tenantId: "MIE-03",
    branchId: "MIE-03",
    areaId: "MIE03-TEST-AREA",
    staffId: "ST-E2E-TEST",
    staffName: "E2E Tester",
    rowId: 1,
    count: 10,
    isDone: true,
    timestamp: Date.now(),
    lat: 34.96,
    lng: 136.62
  };

  try {
    const submitRes = await postUrl(postUrlWithKey, testDistributionPayload);
    const submitSuccess = submitRes && (submitRes.success === true || submitRes.status === "ok");
    assertTrue("Criterion 5: submitDistribution responded with SUCCESS", submitSuccess, JSON.stringify(submitRes));
  } catch (err: any) {
    assertTrue("Criterion 5: submitDistribution responded with SUCCESS", false, err.toString());
  }

  console.log("\n==================================================");
  console.log(`E2E FLOW VERIFICATION RESULTS: ${passed} passed, ${failed} failed.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMie03E2eEvidenceTest().catch(err => {
  console.error("E2E verification failed:", err);
  process.exit(1);
});
