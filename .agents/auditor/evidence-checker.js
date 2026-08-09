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

  // DEPLOYED証跡確認 (push結果、deployment versionなど)
  const hasDeploymentEvidence = !!evidence.commitHash && !!evidence.deploymentVersion;

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
