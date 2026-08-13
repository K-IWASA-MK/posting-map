/**
 * evidence-checker.js
 * 証跡の存在確認を行う（判定はしない）
 */

function checkEvidence(evidence) {
  if (!evidence) return {
    hasImplementationEvidence: false,
    hasVerificationEvidence: false,
    hasDeploymentEvidence: false,
    hasProductionEvidence: false
  };

  // IMPLEMENTED証跡確認 (ファイルと差分)
  const hasImplementationEvidence = Array.isArray(evidence.files) && evidence.files.length > 0 && evidence.gitDiff === true;

  // VERIFIED証跡確認 (コマンド、結果、日時のいずれか)
  let hasVerificationEvidence = false;
  if (Array.isArray(evidence.commands) && evidence.commands.length > 0) {
    const cmd = evidence.commands[0];
    if (cmd.command && cmd.result && cmd.timestamp) {
      hasVerificationEvidence = true;
    }
  }

  // DEPLOYED証跡確認 (push結果、deployment version ＋ Git Fact 4重確認)
  let hasDeploymentEvidence = !!evidence.commitHash && !!evidence.deploymentVersion;
  if (hasDeploymentEvidence) {
    const rawHash = String(evidence.commitHash).trim();
    // 1. SHA 形式チェック (7〜40桁の16進数)
    const isShaFormat = /^[0-9a-fA-F]{7,40}$/.test(rawHash);
    if (!isShaFormat) {
      hasDeploymentEvidence = false;
    } else {
      try {
        const { execSync } = require('child_process');
        // 2. Git Object実体存在確認 (git cat-file -e)
        execSync(`git cat-file -e ${rawHash}`, { stdio: 'ignore' });

        // 3. Git Objectタイプ確認 (git cat-file -t ➔ "commit" であること)
        const objectType = execSync(`git cat-file -t ${rawHash}`).toString().trim();
        if (objectType !== 'commit') {
          hasDeploymentEvidence = false;
        } else {
          // 4. HEAD 整合性確認 (reported commitHash === current git rev-parse HEAD)
          const currentHead = execSync('git rev-parse HEAD').toString().trim();
          const targetHash = execSync(`git rev-parse ${rawHash}`).toString().trim();
          if (targetHash !== currentHead) {
            hasDeploymentEvidence = false;
          }
        }
      } catch (e) {
        // Gitオブジェクトが存在しない、またはコマンド失敗時は証跡無効
        hasDeploymentEvidence = false;
      }
    }
  }

  // PRODUCTION VERIFIED証跡確認
  const hasProductionEvidence = !!evidence.runtimeCheck && !!evidence.runtimeCheck.content && !!evidence.runtimeCheck.timestamp;

  return {
    hasImplementationEvidence,
    hasVerificationEvidence,
    hasDeploymentEvidence,
    hasProductionEvidence
  };
}

module.exports = { checkEvidence };
