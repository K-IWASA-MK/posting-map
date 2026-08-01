/**
 * Runtime Layer - Execution Context Module
 * 
 * Section: SEC-036 ApiExecutionContext, SEC-005 Context Variables
 * Owner Layer: Runtime Layer
 * Responsibility: リクエスト別実行コンテキスト、スタートアップタイムスタンプ、状態変数のカプセル化
 */

var executionContext = null;
var globalCacheHit = false;

class ApiExecutionContext {
  constructor() {
    this.startTimestamp = Date.now();
    this.requestId = "req-" + this.startTimestamp + "-" + Math.random().toString(36).substr(2, 9);
    this.executionId = "exec-" + Math.random().toString(36).substr(2, 9);
    this.retryCount = 0;
    this.validationTime = 0;
    this.routingTime = 0;
    this.handlerTime = 0;

    // Synchronize context properties with 04_api.gs (Canonical)
    this.authContext = null;
    this.authzContext = null;
    this.licenseContext = null;
    this.featureContext = null;
    this.bridgeContext = null;
    this.platformCtx = null;
    this.currentStage = (typeof PlatformStage !== 'undefined' && PlatformStage.INITIALIZING) ? PlatformStage.INITIALIZING : "INITIALIZING";
  }
  getRequestId() { return this.requestId; }
  getExecutionId() { return this.executionId; }
  getStartTimestamp() { return this.startTimestamp; }
  getElapsedTime() { return Date.now() - this.startTimestamp; }
  getRetryCount() { return this.retryCount; }
  incrementRetry() { this.retryCount++; }
  setValidationTime(ms) { this.validationTime = ms; }
  getValidationTime() { return this.validationTime; }
  setRoutingTime(ms) { this.routingTime = ms; }
  getRoutingTime() { return this.routingTime; }
  setHandlerTime(ms) { this.handlerTime = ms; }
  getHandlerTime() { return this.handlerTime; }

  // Synchronize context getters/setters with 04_api.gs (Canonical)
  setAuthenticationContext(context) { this.authContext = context; }
  getAuthenticationContext() { return this.authContext; }
  setAuthorizationContext(context) { this.authzContext = context; }
  getAuthorizationContext() { return this.authzContext; }
  setLicenseContext(context) { this.licenseContext = context; }
  getLicenseContext() { return this.licenseContext; }
  setFeatureContext(context) { this.featureContext = context; }
  getFeatureContext() { return this.featureContext; }
  setBridgeContext(context) { this.bridgeContext = context; }
  getBridgeContext() { return this.bridgeContext; }
  setPlatformContext(context) { this.platformCtx = context; }
  getPlatformContext() { return this.platformCtx; }
  setCurrentStage(stage) { this.currentStage = stage; }
  getCurrentStage() { return this.currentStage; }
}
