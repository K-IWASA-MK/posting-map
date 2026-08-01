/**
# FIELD OPERATIONS PLATFORM - Execution Kernel & Event Router
# Version: 3.2 (Data Integrity Audit Foundation - Self-Governing OS)
# 
# Core Principles:
# 1. Brain (AIOS/Design) -> Control (Rules) -> Hands (Execution) -> Memory (Drive) -> Eyes (Verify)
# 2. Design and execution are strictly separated.
# 3. Google Drive is the Single Source of Truth (SST).
# 4. Zero direct operations (everything must route via the Event Kernel).
# 5. Locked Mode (postingareamap@gmail.com & root ID: 1FfcVEQjod--rZSucOPFJD2DJ58hV650_).
# 6. Audit OS: NO SIDE EFFECT RULE. Audits only observe and generate logs/events.
# 7. Governance OS: POLICY & COST GUARD. Blocks bad operations before execution.
*/

// ==========================================
// 1. CONFIG & SYSTEM LOCK STATE
// ==========================================
var SYSTEM_LOCK = {
  ACTIVE_ACCOUNT: "postingareamap@gmail.com",
  ACTIVE_DRIVE_ROOT_ID: "1FfcVEQjod--rZSucOPFJD2DJ58hV650_",
  SYSTEM_MODE: "LOCKED (NO FALLBACK)"
};

var SHEET_NAMES = {
  EVENT_QUEUE: "EventQueue"
};

// ==========================================
// 11. GOVERNANCE LAYER (統治層 v4.0)
// ==========================================

var GOVERNANCE_POLICIES = {
  "ADMIN": ["*"], // 全許可
  "SYSTEM": ["sync", "heal", "update", "create"], // システム制御実行
  "OPERATOR": ["create", "update", "sync"], // スプレッドシート操作
  "USER": ["create", "update"] // 一般的な操作のみ
};

/**
 * 送信元の種類と認証ユーザーから実行ロールを決定する
 */
function resolveRole(source, executingUserEmail) {
  if (executingUserEmail === SYSTEM_LOCK.ACTIVE_ACCOUNT) {
    if (source === "http" || source === "gas" || source === "audit" || source === "kernel") {
      return "SYSTEM"; // Webhookや自動トリガーはSYSTEMロール
    }
    return "ADMIN";
  }
  
  // ソースに基づくフォールバック
  if (source === "line" || source === "liff") return "USER";
  if (source === "sheet") return "OPERATOR";
  
  return "GUEST"; // 基本ブロック
}

/**
 * ポリシー評価 (事前統治)
 * 実行権限がないアクションは強制ブロック (Exception)
 */
function policyCheck(event) {
  console.log("[Governance] Running Policy Check for Event ID: " + event.event_id);
  
  var allowedActions = GOVERNANCE_POLICIES[event.role] || [];
  var isAllowed = false;
  
  if (allowedActions.indexOf("*") !== -1) {
    isAllowed = true;
  } else if (allowedActions.indexOf(event.type) !== -1) {
    isAllowed = true;
  }
  
  // healとevolutionのハード制約
  if (event.type === "heal" && event.role !== "SYSTEM" && event.role !== "ADMIN") {
    isAllowed = false; // healはSYSTEM/ADMIN専用
  }
  if (event.type === "evolution" && event.role !== "ADMIN") {
    isAllowed = false; // evolutionはADMIN専用
  }
  
  if (!isAllowed) {
    throw new Error("GOVERNANCE_REJECT: Action '" + event.type + "' not allowed for role '" + event.role + "'.");
  }
}

/**
 * 安全・コスト評価 (実行前統治)
 * 暴走、無限ループ、高コストのAPIチェーンを強制ブロック (Exception)
 */
function costGuard(plan, event) {
  console.log("[Governance] Running Cost Guard for Plan ID: " + plan.plan_id);
  
  // 1. APIコール上限のブロック
  var MAX_STEPS = 20;
  if (plan.steps.length > MAX_STEPS) {
    throw new Error("GOVERNANCE_BLOCK: Execution plan exceeds max API call limit (" + plan.steps.length + " steps).");
  }
  
  // 2. 深さ（連鎖）のブロック
  var depth = event.state_context && event.state_context.depth ? event.state_context.depth : 0;
  if (depth > 3) {
    throw new Error("GOVERNANCE_BLOCK: Infinite loop detected. Max depth exceeded (Depth: " + depth + ").");
  }
  plan.execution_depth = depth + 1;
  
  // 3. 短時間の同一イベント連発ブロック (60秒間に5回以上同じタイプ)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.EVENT_QUEUE);
  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      // 直近20件をサンプリング
      var startRow = Math.max(2, lastRow - 20);
      var range = sheet.getRange(startRow, 1, lastRow - startRow + 1, 4); // [ID, Time, Source, Type]
      var values = range.getValues();
      var now = new Date().getTime();
      var sameTypeCount = 0;
      
      for (var i = values.length - 1; i >= 0; i--) {
        var rowTime = new Date(values[i][1]).getTime();
        var rowType = values[i][3];
        if (now - rowTime <= 60000 && rowType === event.type) {
          sameTypeCount++;
        }
      }
      
      if (sameTypeCount >= 5) {
        throw new Error("GOVERNANCE_BLOCK: Loop storm detected. Over 5 events of type '" + event.type + "' within 60 seconds.");
      }
    }
  }
}

// ==========================================
// 2. EVENT STREAM BRIDGE LAYER (リアルタイムストリームブリッジ)
// ==========================================

// [DISABLED in Version 1.0] 
// This function shadows the standard doPost in v2_api.gs/99_entry.gs.
// Renamed to avoid intercepting and crashing H-App POST requests.
function v2_kernel_doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var rawEvent = {
      event_id: postData.event_id || Utilities.getUuid(),
      source: postData.source || "http",
      type: postData.type || "sync",
      target: postData.target || "drive",
      payload: postData.payload || {},
      state_context: postData.state_context || {}
    };
    
    pushToEventQueue(rawEvent, "EXECUTING");
    var result = executeKernel(rawEvent);
    updateEventStatus(rawEvent.event_id, result.success ? "SUCCESS" : "FAILED");
    
    return ContentService.createTextOutput(JSON.stringify(result))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function onEditTrigger(e) {
  try {
    var sheet = e.range.getSheet();
    var rawEvent = {
      event_id: Utilities.getUuid(),
      source: "sheet",
      type: "sync",
      target: "drive",
      payload: {
        sheet_name: sheet.getName(),
        range: e.range.getA1Notation(),
        value: e.value
      }
    };
    
    pushToEventQueue(rawEvent, "EXECUTING");
    var result = executeKernel(rawEvent);
    updateEventStatus(rawEvent.event_id, result.success ? "SUCCESS" : "FAILED");
  } catch(err) {
    console.error("onEditTrigger Error: " + err.toString());
  }
}

function onChangeTrigger(e) {
  try {
    var rawEvent = {
      event_id: Utilities.getUuid(),
      source: "sheet",
      type: "heal",
      target: "drive",
      payload: {
        change_type: e.changeType
      }
    };
    
    pushToEventQueue(rawEvent, "EXECUTING");
    var result = executeKernel(rawEvent);
    updateEventStatus(rawEvent.event_id, result.success ? "SUCCESS" : "FAILED");
  } catch(err) {
    console.error("onChangeTrigger Error: " + err.toString());
  }
}

function pushToEventQueue(rawEvent, initialStatus) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.EVENT_QUEUE);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAMES.EVENT_QUEUE);
      sheet.appendRow(["Event ID", "Timestamp", "Source", "Type", "Target", "Payload", "Status"]);
    }
    
    var timestamp = new Date().toISOString();
    sheet.appendRow([
      rawEvent.event_id,
      timestamp,
      rawEvent.source,
      rawEvent.type,
      rawEvent.target,
      JSON.stringify(rawEvent.payload),
      initialStatus || "PENDING"
    ]);
  } catch(e) {
    console.error("pushToEventQueue Audit Error: " + e.toString());
  }
}

function updateEventStatus(eventId, status) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.EVENT_QUEUE);
    if (!sheet) return;
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    var range = sheet.getRange(2, 1, lastRow - 1, 7);
    var values = range.getValues();
    
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === eventId) {
        sheet.getRange(i + 2, 7).setValue(status);
        break;
      }
    }
  } catch(e) {
    console.error("updateEventStatus Audit Error: " + e.toString());
  }
}

// ==========================================
// 3. CONTINUOUS POLL BACKUP (ポーリングフォールバック)
// ==========================================

function setupContinuousTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "pollAndProcessEventQueue") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("pollAndProcessEventQueue")
           .timeBased()
           .everyMinutes(5)
           .create();
  console.log("[ContinuousTrigger] Backup polling set up successfully (5-minute interval).");
}

function pollAndProcessEventQueue() {
  enforceSecurityGate();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.EVENT_QUEUE);
  if (!sheet) return;
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var range = sheet.getRange(2, 1, lastRow - 1, 7);
  var values = range.getValues();
  
  for (var i = 0; i < values.length; i++) {
    var status = values[i][6];
    if (status === "PENDING") {
      var rowNum = i + 2;
      sheet.getRange(rowNum, 7).setValue("PROCESSING");
      SpreadsheetApp.flush();
      
      var rawEvent = {
        event_id: values[i][0],
        timestamp: values[i][1],
        source: values[i][2],
        type: values[i][3],
        target: values[i][4],
        payload: JSON.parse(values[i][5])
      };
      
      var result = executeKernel(rawEvent);
      sheet.getRange(rowNum, 7).setValue(result.success ? "SUCCESS" : "FAILED");
      SpreadsheetApp.flush();
    }
  }
}

// ==========================================
// 4. EVENT ROUTER (ルールマッチング)
// ==========================================

function normalizeEvent(rawEvent) {
  if (!rawEvent) {
    throw new Error("Normalizer Error: Null or Undefined event source received.");
  }
  
  var executingUser = Session.getEffectiveUser().getEmail();
  var source = rawEvent.source || "unknown";
  var role = resolveRole(source, executingUser);
  
  return {
    event_id: rawEvent.event_id || Utilities.getUuid(),
    source: source,
    role: role, // Role mapping included during normalization
    type: rawEvent.type || "unknown",
    target: rawEvent.target || "unknown",
    payload: rawEvent.payload || {},
    timestamp: rawEvent.timestamp || new Date().toISOString(),
    state_context: rawEvent.state_context || {}
  };
}

function routeEvent(event) {
  console.log("[Router] Routing Event ID: " + event.event_id + " (Type: " + event.type + ")");
  
  var plan = {
    plan_id: Utilities.getUuid(),
    event_id: event.event_id,
    steps: []
  };
  
  var evolutionRules = loadEvolutionRules();
  if (evolutionRules[event.type]) {
    console.log("[Router] Applied Evolved Rule for event: " + event.type);
    plan.steps = plan.steps.concat(evolutionRules[event.type].steps);
    return plan;
  }
  
  switch(event.type) {
    case "create":
      if (event.target === "drive") {
        plan.steps.push({ action: "create_folder", params: event.payload });
      }
      break;
    case "update":
      if (event.target === "drive" && event.payload.filename === "README.md") {
        plan.steps.push({ action: "update_readme", params: event.payload });
      }
      break;
    case "sync":
      plan.steps.push({ action: "verify_structure", params: {} });
      plan.steps.push({ action: "sync_state", params: event.payload });
      break;
    case "heal":
      plan.steps.push({ action: "verify_structure", params: {} });
      plan.steps.push({ action: "run_healing", params: event.payload });
      break;
    default:
      console.warn("[Router] No match routing rule for type: " + event.type);
  }
  
  return plan;
}

// ==========================================
// 5. EXECUTION KERNEL (核心実行ループ)
// ==========================================

function executeKernel(rawEvent) {
  var auditLog = {
    kernel_execution_id: rawEvent.event_id || Utilities.getUuid(),
    step: "INIT",
    status: "PROCESSING"
  };
  
  var plan = null;
  var event = null;
  var executionResults = [];
  
  try {
    enforceSecurityGate();
    
    // 1. Normalize Event
    auditLog.step = "NORMALIZE";
    event = normalizeEvent(rawEvent);
    
    // 2. Governance Policy Check (BLOCK POINT 1)
    auditLog.step = "GOVERNANCE_POLICY_CHECK";
    policyCheck(event);
    
    // 3. Routing
    auditLog.step = "ROUTING";
    plan = routeEvent(event);
    
    // 4. Governance Cost/Safety Guard (BLOCK POINT 2)
    auditLog.step = "GOVERNANCE_COST_GUARD";
    costGuard(plan, event);
    
    // 5. Execution Loop
    auditLog.step = "EXECUTION";
    for (var i = 0; i < plan.steps.length; i++) {
      var stepResult = executeActionStep(plan.steps[i]);
      executionResults.push(stepResult);
    }
    
    // 6. Audit Logging (NO SIDE EFFECT)
    auditLog.step = "STATE_UPDATE";
    auditKernelExecution(auditLog.kernel_execution_id, "SUCCESS", event, plan, executionResults);
    
    // 7. Evolution Logic
    auditLog.step = "EVOLUTION_ANALYZE";
    analyzeExecutionLogsAndEvolve(auditLog.kernel_execution_id);
    
    // 8. Self-Healing Post-Check
    if (event.type !== "heal") {
      auditLog.step = "SELF_HEALING_CHECK";
      var healingRequired = checkStateIntegrity();
      if (healingRequired) {
        console.log("[Kernel] Integrity drift detected. Queueing Self-Healing event...");
        var healingEvent = {
          event_id: Utilities.getUuid(),
          source: "kernel",
          type: "heal",
          target: "drive",
          payload: { trigger_source: event.event_id },
          state_context: { depth: plan.execution_depth || 1 }
        };
        // 副作用の排除: キューへ積むだけ (Self-Healing無限ループもcostGuardで保護される)
        pushToEventQueue(healingEvent, "PENDING");
      }
    }
    
    return { success: true, execution_id: auditLog.kernel_execution_id };
    
  } catch(e) {
    console.error("[Kernel ERROR] Execution Aborted: " + e.toString());
    auditKernelExecution(auditLog.kernel_execution_id, "FAILED", rawEvent, plan, { error: e.toString(), last_step: auditLog.step });
    return { success: false, error: e.toString(), execution_id: auditLog.kernel_execution_id };
  }
}

function executeActionStep(step) {
  switch (step.action) {
    case "create_folder":
      return DriveActionAdapter.createFolder(step.params.name, step.params.parent_id);
    case "update_readme":
      return DriveActionAdapter.updateReadme(step.params.folder_id, step.params.folder_name, step.params.content);
    case "verify_structure":
      return DriveActionAdapter.verifyAllFolders();
    case "run_healing":
      return runStateSelfHealing();
    default:
      throw new Error("Unknown execution action: " + step.action);
  }
}

// ==========================================
// 6. LOGICAL EXECUTION SECURITY GATE (論理制御ラッパー)
// ==========================================

function enforceSecurityGate() {
  var authedEmail = Session.getEffectiveUser().getEmail();
  if (authedEmail !== SYSTEM_LOCK.ACTIVE_ACCOUNT) {
    throw new Error("SECURITY_AUTH_GUARD_TRIGGERED: Pinned account mismatch. Executing User: " + authedEmail);
  }

  var rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
  } catch(e) {
    throw new Error("SECURITY_AUTH_GUARD_TRIGGERED: Drive Root ID access failed.");
  }
  
  if (rootFolder.getName() !== "FIELD_OPERATIONS_PLATFORM") {
    throw new Error("SECURITY_AUTH_GUARD_TRIGGERED: Drive Root Folder name mismatch.");
  }
}

// ==========================================
// 7. DRIVE ACTION ADAPTER (API 物理制御層)
// ==========================================

var DriveActionAdapter = {
  createFolder: function(name, parentId) {
    enforceSecurityGate();
    var parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    
    var existing = parent.getFoldersByName(name);
    if (existing.hasNext()) {
      var folder = existing.next();
      return { action: "create_folder", folder_id: folder.getId(), status: "EXISTS" };
    }
    
    var newFolder = parent.createFolder(name);
    return { action: "create_folder", folder_id: newFolder.getId(), status: "CREATED" };
  },
  
  updateReadme: function(folderId, folderName, content) {
    enforceSecurityGate();
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFilesByName("README.md");
    var file;
    if (files.hasNext()) {
      file = files.next();
      file.setContent(content);
      return { action: "update_readme", file_id: file.getId(), status: "UPDATED" };
    } else {
      file = folder.createFile("README.md", content, MimeType.PLAIN_TEXT);
      return { action: "update_readme", file_id: file.getId(), status: "CREATED" };
    }
  },
  
  verifyAllFolders: function() {
    enforceSecurityGate();
    var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    var subfolders = root.getFolders();
    var found = {};
    while(subfolders.hasNext()) {
      var f = subfolders.next();
      found[f.getName()] = f.getId();
    }
    return { action: "verify_all", folders: found, timestamp: new Date().toISOString() };
  }
};

// ==========================================
// 8. EVOLUTION MEMORY LAYER (自己進化コア)
// ==========================================

function analyzeExecutionLogsAndEvolve(execId) {
  enforceSecurityGate();
  try {
    var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    var systemFolder = root.getFoldersByName("02_SYSTEM").next();
    
    var logFiles = systemFolder.getFilesByName("AUDIT_EXEC_" + execId + ".json");
    if (!logFiles.hasNext()) return;
    
    var logContent = JSON.parse(logFiles.next().getAs("text/plain").getDataAsString());
    
    if (logContent.status === "FAILED") {
      console.log("[EvolutionEngine] Failed log detected. Evolving auto-rules...");
      
      var oldRules = loadEvolutionRules();
      var evolvedRules = JSON.parse(JSON.stringify(oldRules));
      
      if (logContent.results && logContent.results.last_step === "EXECUTION") {
        evolvedRules["recover_readme_fail"] = {
          steps: [
            { action: "verify_structure", params: {} },
            { action: "run_healing", params: { recovery_source: execId } }
          ]
        };
        
        if (auditEvolutionRules(oldRules, evolvedRules)) {
          saveEvolutionRules(evolvedRules);
        }
      }
    }
  } catch(e) {
    console.error("[EvolutionEngine Error] Evolve process failed: " + e.toString());
  }
}

function loadEvolutionRules() {
  try {
    var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    var systemFolder = root.getFoldersByName("02_SYSTEM").next();
    var files = systemFolder.getFilesByName("EVOLUTION_RULES.json");
    if (files.hasNext()) {
      return JSON.parse(files.next().getAs("text/plain").getDataAsString());
    }
  } catch(e) {}
  return {};
}

function saveEvolutionRules(rules) {
  var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
  var systemFolder = root.getFoldersByName("02_SYSTEM").next();
  var files = systemFolder.getFilesByName("EVOLUTION_RULES.json");
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(rules, null, 2));
  } else {
    systemFolder.createFile("EVOLUTION_RULES.json", JSON.stringify(rules, null, 2), MimeType.PLAIN_TEXT);
  }
}

// ==========================================
// 9. SELF-HEALING & INTEGRITY CHECK (自己修復)
// ==========================================

function checkStateIntegrity() {
  enforceSecurityGate();
  var expectedFolders = ["01_MASTER", "02_SYSTEM", "03_BRANCH", "04_STORAGE", "05_BACKUP", "06_DASHBOARD", "07_MANUAL", "99_ARCHIVE"];
  var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
  var subfolders = root.getFolders();
  var foundNames = [];
  while(subfolders.hasNext()) {
    var f = subfolders.next();
    foundNames.push(f.getName());
  }
  
  for(var i = 0; i < expectedFolders.length; i++) {
    if (foundNames.indexOf(expectedFolders[i]) === -1) {
      return true; // ズレ検出
    }
  }
  return false;
}

function runStateSelfHealing() {
  enforceSecurityGate();
  console.log("[Self-Healing] Projecting correct state on root: " + SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
  
  var expectedFolders = ["01_MASTER", "02_SYSTEM", "03_BRANCH", "04_STORAGE", "05_BACKUP", "06_DASHBOARD", "07_MANUAL", "99_ARCHIVE"];
  var results = [];
  for (var i = 0; i < expectedFolders.length; i++) {
    var folderName = expectedFolders[i];
    var folderResult = DriveActionAdapter.createFolder(folderName, SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    results.push(folderResult);
    
    var fId = folderResult.folder_id;
    var content = "# " + folderName + "\n\n役割: 自動復旧テンプレート\n保存対象: 定義書参照\n運用ルール: AIOS管理";
    var readmeResult = DriveActionAdapter.updateReadme(fId, folderName, content);
    results.push(readmeResult);
  }
  
  return { action: "state_healing", details: results };
}

// ==========================================
// 10. AUDIT LAYER (監査層 v3.1 PRO)
// ==========================================

function auditKernelExecution(execId, status, event, plan, results) {
  try {
    var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    var systemFolder = root.getFoldersByName("02_SYSTEM").next();
    
    var auditLog = {
      execution_id: execId,
      timestamp: new Date().toISOString(),
      status: status,
      event: event,
      execution_plan: plan,
      results: results,
      audit_signature: "Verified by Execution Audit Layer"
    };
    
    systemFolder.createFile("AUDIT_EXEC_" + execId + ".json", JSON.stringify(auditLog, null, 2), MimeType.PLAIN_TEXT);
  } catch(e) {
    console.error("[Audit Error] Execution Audit Failed: " + e.toString());
  }
}

function setupHourlyIntegrityAudit() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "auditDriveState") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("auditDriveState")
           .timeBased()
           .everyHours(1)
           .create();
  console.log("[Audit Trigger] Hourly integrity audit set up successfully.");
}

function auditDriveState() {
  enforceSecurityGate();
  console.log("[Audit] Running System Integrity Audit...");
  
  var expectedFolders = ["01_MASTER", "02_SYSTEM", "03_BRANCH", "04_STORAGE", "05_BACKUP", "06_DASHBOARD", "07_MANUAL", "99_ARCHIVE"];
  var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
  var subfolders = root.getFolders();
  
  var foundNames = [];
  var anomalies = [];
  
  while(subfolders.hasNext()) {
    var f = subfolders.next();
    var name = f.getName();
    foundNames.push(name);
    
    if (expectedFolders.indexOf(name) !== -1) {
      var readmes = f.getFilesByName("README.md");
      if (!readmes.hasNext()) {
        anomalies.push({ type: "MISSING_README", folder: name });
      }
    } else {
      anomalies.push({ type: "UNAUTHORIZED_FOLDER", folder: name });
    }
  }
  
  for(var i=0; i<expectedFolders.length; i++) {
    if (foundNames.indexOf(expectedFolders[i]) === -1) {
      anomalies.push({ type: "MISSING_FOLDER", folder: expectedFolders[i] });
    }
  }
  
  var auditResult = {
    timestamp: new Date().toISOString(),
    status: anomalies.length === 0 ? "SECURE" : "BREACHED",
    anomalies: anomalies
  };
  
  var systemFolder = root.getFoldersByName("02_SYSTEM").next();
  systemFolder.createFile("AUDIT_STATE_" + new Date().getTime() + ".json", JSON.stringify(auditResult, null, 2), MimeType.PLAIN_TEXT);
  
  if (anomalies.length > 0) {
    console.warn("[Audit] Integrity breached. Issuing Self-Healing Event to Queue.");
    var healingEvent = {
      event_id: Utilities.getUuid(),
      source: "audit",
      type: "heal",
      target: "drive",
      payload: { trigger_source: "auditDriveState", anomalies: anomalies }
    };
    pushToEventQueue(healingEvent, "PENDING");
  }
}

function auditEvolutionRules(oldRules, newRules) {
  console.log("[Audit] Auditing Evolution Rules...");
  
  var oldKeys = Object.keys(oldRules);
  var newKeys = Object.keys(newRules);
  
  if (newKeys.length - oldKeys.length > 5) {
    console.error("EVOLUTION_AUDIT_BLOCK: Excessive rule generation detected. Possible runaway evolution.");
    return false;
  }
  
  var auditLog = {
    timestamp: new Date().toISOString(),
    old_rule_count: oldKeys.length,
    new_rule_count: newKeys.length,
    status: "APPROVED"
  };
  
  try {
    var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    var systemFolder = root.getFoldersByName("02_SYSTEM").next();
    systemFolder.createFile("AUDIT_EVO_" + new Date().getTime() + ".json", JSON.stringify(auditLog, null, 2), MimeType.PLAIN_TEXT);
  } catch(e) {}
  
  return true;
}

// ==========================================
// 12. DATA INTEGRITY AUDIT (データ整合性監査 v3.2)
// ==========================================

function auditDataIntegrity(stage, data) {
  try {
    console.log("[Audit] Running Data Integrity Audit for Stage: " + stage);
    var root = DriveApp.getFolderById(SYSTEM_LOCK.ACTIVE_DRIVE_ROOT_ID);
    var systemFolder = root.getFoldersByName("02_SYSTEM").next();

    var violations = [];
    var count = data ? data.length : 0;
    
    // 1. ソート順監査
    if (stage === "EXTRACT" || stage === "BATCH") {
      if (!auditSortIntegrity(data)) {
        violations.push("AUDIT_SORT_VIOLATION");
      }
    }

    // 2. メタデータ欠損監査
    if (!auditMetadataIntegrity(data, stage)) {
      violations.push("AUDIT_METADATA_MISSING");
    }

    // 3. 件数監査
    if (!auditCountIntegrity(stage, count)) {
      violations.push("AUDIT_COUNT_MISMATCH");
    }

    // 4. ハッシュ・改ざん監査
    var currentHash = generateNormalizedHash(data);
    if (!auditHashIntegrity(stage, currentHash)) {
      violations.push("AUDIT_HASH_MISMATCH");
    }

    // 5. スキーマ監査 (Future v2/v3 拡張準備)
    if (!auditSchemaIntegrity(stage, data)) {
      violations.push("AUDIT_SCHEMA_VIOLATION");
    }

    var auditLog = {
      timestamp: new Date().toISOString(),
      stage: stage,
      status: violations.length === 0 ? "PASS" : "FAILED",
      count: count,
      hash: currentHash,
      violations: violations,
      details: {
        stage_info: "Audit verification for data pipeline at stage: " + stage,
        verification_keys: data && data.length > 0 ? Object.keys(data[0]) : []
      }
    };

    var fileName = "AUDIT_DATA_" + stage + "_" + new Date().getTime() + ".json";
    systemFolder.createFile(fileName, JSON.stringify(auditLog, null, 2), MimeType.PLAIN_TEXT);
    console.log("[Audit] Stage " + stage + " integrity check result: " + auditLog.status);
  } catch (e) {
    console.error("[Audit Error] Data Integrity Audit Failed: " + e.toString());
    try {
      PropertiesService.getScriptProperties().setProperty("AUDIT_LAST_ERROR", "Stage: " + stage + " | Error: " + e.toString());
    } catch(err) {}
  }
}

function auditSortIntegrity(data) {
  if (!data || data.length <= 1) return true;
  for (var i = 0; i < data.length - 1; i++) {
    var a = data[i];
    var b = data[i+1];
    var cityA = a.cityKana || "";
    var cityB = b.cityKana || "";
    var townA = a.townKana || "";
    var townB = b.townKana || "";

    var compCity = cityA.localeCompare(cityB, 'ja');
    if (compCity > 0) return false;
    if (compCity === 0) {
      var compTown = townA.localeCompare(townB, 'ja');
      if (compTown > 0) return false;
    }
  }
  return true;
}

function auditMetadataIntegrity(data, stage) {
  if (!data) return false;
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var cityK = item.cityKana;
    var townK = item.townKana;
    if (cityK === null || cityK === undefined || String(cityK).trim() === "") return false;
    if (townK === null || townK === undefined || String(townK).trim() === "") return false;
    if (stage === "API") {
      if (item.version === null || item.version === undefined) return false;
    }
  }
  return true;
}

function auditCountIntegrity(stage, count) {
  var props = PropertiesService.getScriptProperties();
  if (stage === "EXTRACT") {
    props.setProperty("AUDIT_COUNT_EXTRACT", String(count));
    return true;
  }
  var baseCountStr = props.getProperty("AUDIT_COUNT_EXTRACT");
  if (!baseCountStr) return true; // 基準がない場合はパス
  return String(count) === baseCountStr;
}

function auditHashIntegrity(stage, currentHash) {
  var props = PropertiesService.getScriptProperties();
  var propKey = "AUDIT_HASH_" + stage;
  var storedHash = props.getProperty(propKey);
  
  props.setProperty(propKey, currentHash);
  
  if (storedHash && storedHash !== currentHash) {
    return false;
  }
  return true;
}

function auditSchemaIntegrity(stage, data) {
  if (!data || data.length === 0) return true;
  var first = data[0];
  if (stage === "API") {
    if (!("version" in first) || !("name" in first) || !("repAddress" in first)) return false;
  } else {
    if (!("cityKana" in first) || !("townKana" in first)) return false;
  }
  return true;
}

function generateNormalizedHash(data) {
  if (!data || data.length === 0) return "empty_hash";
  var keys = data.map(function(item) {
    var nameVal = item.address || item.name || "";
    var cityK = item.cityKana || "";
    var townK = item.townKana || "";
    return nameVal + "_" + cityK + "_" + townK;
  }).join("|");

  try {
    var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, keys, Utilities.Charset.UTF_8);
    var hash = "";
    for (var i = 0; i < rawHash.length; i++) {
      var byteVal = rawHash[i];
      if (byteVal < 0) byteVal += 256;
      var byteString = byteVal.toString(16);
      if (byteString.length == 1) byteString = "0" + byteString;
      hash += byteString;
    }
    return hash;
  } catch (e) {
    return "hash_error";
  }
}
