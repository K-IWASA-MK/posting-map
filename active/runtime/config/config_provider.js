/**
 * Runtime Layer - Configuration Provider Module
 * 
 * Section: SEC-030 GasConfigurationProvider
 * Owner Layer: Runtime Layer
 * Responsibility: GAS 開発プロパティ、環境設定、機能アクセス制御フラグのカプセル化
 */

class GasConfigurationProvider {
  constructor() {
    this.cacheTTL = 600;
    this.lockTimeout = 10000;
    this.apiVersion = "1.0.0-RC1";
    this.loadProperties();
  }
  static getInstance() {
    if (!GasConfigurationProvider.instance) {
      GasConfigurationProvider.instance = new GasConfigurationProvider();
    }
    return GasConfigurationProvider.instance;
  }
  loadProperties() {
    try {
      const props = PropertiesService.getScriptProperties();
      const ttl = props.getProperty('CACHE_TTL');
      if (ttl) this.cacheTTL = parseInt(ttl, 10);
      const timeout = props.getProperty('LOCK_TIMEOUT');
      if (timeout) this.lockTimeout = parseInt(timeout, 10);
    } catch (e) {}
  }
  getCacheTTL() { return this.cacheTTL; }
  getLockTimeout() { return this.lockTimeout; }
  getApiVersion() { return this.apiVersion; }
  getSpreadsheetId() {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (id) return id;
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) return ss.getId();
    } catch (e) {}
    throw new Error('SPREADSHEET_ID is not configured.');
  }
  getStorageParentFolderId() {
    return PropertiesService.getScriptProperties().getProperty('STORAGE_PARENT_ID') || (typeof CONFIG !== 'undefined' ? CONFIG.STORAGE_PARENT_ID : null);
  }
  getFeatureFlags() {
    try {
      const props = PropertiesService.getScriptProperties();
      const timeoutStr = props.getProperty('BRIDGE_TIMEOUT');
      return {
        flyerHolding: props.getProperty('FLAG_FLYER_HOLDING') !== 'false',
        googleMaps: props.getProperty('FLAG_GOOGLE_MAPS') !== 'false',
        mapbox: props.getProperty('FLAG_MAPBOX') === 'true',
        gpsEvidence: props.getProperty('FLAG_GPS_EVIDENCE') !== 'false',
        photoEvidence: props.getProperty('FLAG_PHOTO_EVIDENCE') !== 'false',
        analytics: props.getProperty('FLAG_ANALYTICS') === 'true',
        apiKeyAuth: props.getProperty('FLAG_API_KEY_AUTH') !== 'false',
        liffAuth: props.getProperty('FLAG_LIFF_AUTH') !== 'false',
        serviceAuth: props.getProperty('FLAG_SERVICE_AUTH') !== 'false',
        anonymousAccess: props.getProperty('FLAG_ANONYMOUS_ACCESS') !== 'false',
        authorizationEnabled: props.getProperty('FLAG_AUTHORIZATION_ENABLED') !== 'false',
        roleValidation: props.getProperty('FLAG_ROLE_VALIDATION') !== 'false',
        scopeValidation: props.getProperty('FLAG_SCOPE_VALIDATION') !== 'false',
        permissionValidation: props.getProperty('FLAG_PERMISSION_VALIDATION') !== 'false',
        licensingEnabled: props.getProperty('FLAG_LICENSING_ENABLED') !== 'false',
        editionValidation: props.getProperty('FLAG_EDITION_VALIDATION') !== 'false',
        licenseValidation: props.getProperty('FLAG_LICENSE_VALIDATION') !== 'false',
        featureAccessEnabled: props.getProperty('FLAG_FEATURE_ACCESS_ENABLED') !== 'false',
        featureValidation: props.getProperty('FLAG_FEATURE_VALIDATION') !== 'false',
        platformIntegrationEnabled: props.getProperty('FLAG_PLATFORM_INTEGRATION_ENABLED') !== 'false',
        pipelineMode: props.getProperty('FLAG_PIPELINE_MODE') || 'DETERMINISTIC',
        debugExecutionTrace: props.getProperty('FLAG_DEBUG_EXECUTION_TRACE') !== 'false'
      };
    } catch (e) {}
    return {
      flyerHolding: true,
      googleMaps: true,
      mapbox: false,
      gpsEvidence: true,
      photoEvidence: true,
      analytics: false,
      apiKeyAuth: true,
      liffAuth: true,
      serviceAuth: true,
      anonymousAccess: true,
      authorizationEnabled: true,
      roleValidation: true,
      scopeValidation: true,
      permissionValidation: true,
      licensingEnabled: true,
      editionValidation: true,
      licenseValidation: true,
      featureAccessEnabled: true,
      featureValidation: true,
      platformIntegrationEnabled: true,
      pipelineMode: 'DETERMINISTIC',
      debugExecutionTrace: true
    };
  }
}
GasConfigurationProvider.instance = null;
