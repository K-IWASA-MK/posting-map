import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute, normalize } from 'path';

const rootDir = process.cwd();
const scopeJsonPath = resolve(rootDir, '.agents/current-scope.json');

function exitFail(message) {
  console.error(`\n🛑 [Hard Stop] Scope Guard Failed: ${message}`);
  process.exit(1);
}

// 1. Validate Scope JSON
if (!existsSync(scopeJsonPath)) {
  exitFail('.agents/current-scope.json does not exist.');
}

let allowedScope = [];
try {
  allowedScope = JSON.parse(readFileSync(scopeJsonPath, 'utf8'));
  if (!Array.isArray(allowedScope)) {
    exitFail('.agents/current-scope.json must be a JSON array.');
  }
} catch (e) {
  exitFail(`Invalid JSON format in .agents/current-scope.json: ${e.message}`);
}

for (const p of allowedScope) {
  if (typeof p !== 'string' || isAbsolute(p) || normalize(p).startsWith('..')) {
    exitFail(`Invalid or unsafe path in scope list: "${p}"`);
  }
}

// Normalize allowed scope paths
const normalizedAllowed = new Set(allowedScope.map(p => normalize(p)));
// Bootstrap exception: allow current-scope.json itself on initial creation
normalizedAllowed.add(normalize('.agents/current-scope.json'));

// 2. Fetch Git Changed Files via `git status --porcelain=v1 -z`
let gitStatusOutput;
try {
  gitStatusOutput = execSync('git status --porcelain=v1 -z', { cwd: rootDir });
} catch (e) {
  exitFail(`Failed to execute git status: ${e.message}`);
}

const changedFiles = [];
const tokens = gitStatusOutput.toString('utf8').split('\0').filter(Boolean);

for (let i = 0; i < tokens.length; i++) {
  const token = tokens[i];
  if (token.length < 4) continue;
  const status = token.substring(0, 2);
  const filePath = normalize(token.substring(3).trim());

  changedFiles.push(filePath);

  // If status is rename/copy, next token is original path
  if (status.includes('R') || status.includes('C')) {
    i++;
  }
}

console.log(`[Scope Guard] Checking ${changedFiles.length} changed file(s) against allowed scope...`);

// 3. Self-Modification Check for committed current-scope.json
let isTrackedScopeJson = false;
try {
  const trackedCheck = execSync('git ls-files .agents/current-scope.json', { cwd: rootDir }).toString().trim();
  if (trackedCheck.length > 0) {
    isTrackedScopeJson = true;
  }
} catch (e) {
  // Not tracked
}

if (isTrackedScopeJson && changedFiles.includes(normalize('.agents/current-scope.json'))) {
  exitFail('Unauthorized modification detected: .agents/current-scope.json cannot be modified once committed.');
}

// 4. Verify Changed Files Against Scope
const scopeViolations = [];
for (const file of changedFiles) {
  if (!normalizedAllowed.has(file)) {
    scopeViolations.push(file);
  }
}

if (scopeViolations.length > 0) {
  console.error('❌ Scope Violations Detected:');
  scopeViolations.forEach(f => console.error(`  - ${f}`));
  exitFail(`${scopeViolations.length} file(s) outside allowed scope.`);
}

console.log('🟢 Scope Validation PASSED: All changed files are within allowed scope.');

// 5. Connect Existing Governance Auditor (report-governance-gate.js)
const auditorScript = resolve(rootDir, '.agents/auditor/report-governance-gate.js');
const jsonReportPath = resolve(rootDir, '.agents/audit-log/report-audit.json');
const targetReport = existsSync(jsonReportPath) ? jsonReportPath : resolve(rootDir, 'latest-report-audit.json');

if (existsSync(auditorScript)) {
  console.log('\n[Governance Gate] Invoking .agents/auditor/report-governance-gate.js...');
  try {
    const output = execSync(`node "${auditorScript}" "${targetReport}"`, { cwd: rootDir }).toString();
    console.log(output);

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch (e) {
      exitFail('Failed to parse report-governance-gate.js JSON output.');
    }

    if (parsed.allowCommit !== true) {
      exitFail(`Governance Auditor rejected (allowCommit: ${parsed.allowCommit}).`);
    }
    console.log('🟢 Governance Gate PASSED: Auditor allowCommit === true.');
  } catch (e) {
    exitFail(`Governance Auditor execution failed: ${e.message}`);
  }
}

console.log('\n✅ [Audit Gate Complete] Scope & Governance Validation Succeeded.');
process.exit(0);
