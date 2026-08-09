const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { checkEvidence } = require('./evidence-checker');

function runGate(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error(JSON.stringify({
      status: "WARNING",
      issues: [{ type: "FILE_NOT_FOUND", message: `Report file not found: ${reportPath}`, action: "報告書を作成してください" }],
      allowCommit: false
    }, null, 2));
    process.exit(0);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const claims = reportData.claims || {};
  const evidence = reportData.evidence || {};
  const evidenceChecks = checkEvidence(evidence);
  
  const issues = [];

  // Rule 1: Verification Evidence Check
  if (claims.verified && !evidenceChecks.hasVerificationEvidence) {
    issues.push({
      type: "EVIDENCE_MISSING",
      message: "検証完了と報告されていますが、検証結果の証跡がありません。",
      action: "追加確認してください"
    });
  }

  // Rule 2: Git Evidence Check
  // claims.implemented などの完了報告時に、Gitコミット等の証跡が提示されているか
  if (claims.implemented && (!evidence.commitHash || evidence.commitHash.trim() === '')) {
    issues.push({
      type: "EVIDENCE_MISSING",
      message: "Git操作完了報告がありますが、証跡不足（commit hashなし）です。",
      action: "証跡を追加してください"
    });
  }

  // Rule 3: Deployment Evidence Check
  if (claims.deployed && !evidenceChecks.hasDeploymentEvidence) {
    issues.push({
      type: "EVIDENCE_MISSING",
      message: "Deployment完了報告がありますが、Deployment証跡がありません。",
      action: "証跡を追加してください"
    });
  }

  // Rule 4 & 5: Lightweight Static Diff Analysis
  // 今回の変更差分から旧コードや直接的なロジック混入を警告する
  try {
    // 差分を取得 ( staged されているもの、もしくは unstaged のもの )
    const diff = execSync('git diff --cached || git diff').toString();
    
    // Rule 4: Legacy Cleanup Check
    // // や /* によるコメントアウトを簡易検知する
    if (diff.match(/^[+]\s*(\/\/|\/\*)/m)) {
      issues.push({
        type: "LEGACY_CODE",
        message: "差分にコメント行が含まれています。旧コード残存の可能性があります。",
        action: "不要コードか確認し、必要なら削除してください"
      });
    }

    // Rule 5: Architecture Quality Check
    // 例として、v2_api.js に SpreadsheetApp などのビジネスロジック直書きがないか監視
    if (diff.includes('active/api/v2_api.js') && diff.match(/^[+].*(SpreadsheetApp|CacheService)/m)) {
      issues.push({
        type: "ARCHITECTURE_WARNING",
        message: "v2_api.js にビジネスロジック（直接的なデータアクセス等）が追加されている可能性があります。",
        action: "Service層への分離を検討してください"
      });
    }

  } catch (e) {
    // git command failed, ignore diff checks
  }

  const status = issues.length > 0 ? "WARNING" : "PASS";
  
  const result = {
    status: status,
    issues: issues,
    allowCommit: status === "PASS"
  };

  const auditLogPath = path.join(__dirname, '../audit-log/latest-report-audit.json');
  const finalOutput = {
    status: result.status,
    allowCommit: result.allowCommit,
    report: path.basename(reportPath),
    commitAllowed: result.allowCommit,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(auditLogPath, JSON.stringify(finalOutput, null, 2));

  console.log(JSON.stringify(result, null, 2));
  return result;
}

// CLI Entrypoint
const reportFile = process.argv[2];
if (reportFile) {
  runGate(reportFile);
} else {
  console.log(JSON.stringify({
    status: "WARNING",
    issues: [{ type: "INVALID_ARGUMENT", message: "Usage: node report-governance-gate.js <path>", action: "パスを指定してください" }],
    allowCommit: false
  }, null, 2));
}
