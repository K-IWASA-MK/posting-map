/**
 * Runtime Layer - Lifecycle & Logging Module
 * 
 * Section: SEC-001 Admin Setup, SEC-002 Trace Logging, SEC-003 WebApp Variable
 * Owner Layer: Runtime Layer
 * Responsibility: スタートアップライフサイクル管理、TraceLog出力、isWebAppCall判定、管理者初期登録
 */

function setupAdminSheet() {
  const admins = [
    { name: 'K. IWASA', lineUserId: 'U7375015ea7c5380e2c8da827eb8d3f08' }
  ];
  admins.forEach(a => {
    if (typeof registerAdmin === 'function') {
      registerAdmin(a.name, a.lineUserId);
    }
  });
  Logger.log('✅ 管理者IDシートのセットアップ完了');
}

function logTrace(event, data) {
  try {
    Logger.log("[TRACE] " + event + ": " + JSON.stringify(data || {}));
  } catch (e) {}
}

function writeDebugLogToSheet(data) {
  return; // 無効化（高速化のためTraceLogへの書き込みを停止）
}

const RuntimeLifecycle = {
  /**
   * Runtime スタートアップの初期化
   */
  start: function() {
    isWebAppCall = true;
  }
};
