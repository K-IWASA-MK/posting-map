/**
 * Framework Layer - Endpoint Registry Module
 * 
 * Section: SEC-007 Routing Registry, SEC-040 Endpoint Mapping
 * Owner Layer: Framework Layer
 * Responsibility: HTTP メソッド・API バージョン・パスとハンドラーの対応付け管理
 */

if (typeof RoutePolicy === 'undefined') {
  RoutePolicy = class RoutePolicy {
    static isMethodAllowed(method) {
      const allowed = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      return allowed.includes(method ? method.toUpperCase() : '');
    }
  };
}

if (typeof RouteResolver === 'undefined') {
  RouteResolver = class RouteResolver {
    static resolveKey(method, version, path) {
      const m = method ? method.toUpperCase() : 'GET';
      const v = version ? version.toLowerCase() : 'v1';
      let p = path || '/';
      if (!p.startsWith('/')) p = '/' + p;
      return m + ":" + v + ":" + p;
    }
  };
}

if (typeof UnknownEndpointHandler === 'undefined') {
  UnknownEndpointHandler = class UnknownEndpointHandler {
    execute(request, context) {
      const metadata = {
        requestId: request ? request.requestId : "",
        serverTimestamp: context ? context.getStartTimestamp() : Date.now(),
        processingTime: context ? context.getElapsedTime() : 0,
        version: request ? request.version : "v1"
      };
      return (typeof ApiResponse !== 'undefined' && ApiResponse.errorResponse)
        ? ApiResponse.errorResponse('NOT_FOUND', 'Endpoint ' + (request ? request.path : '') + ' not found.', 404, metadata)
        : { success: false, error: 'Endpoint not found', statusCode: 404 };
    }
  };
}

if (typeof LegacyApiFallbackHandler === 'undefined') {
  LegacyApiFallbackHandler = class LegacyApiFallbackHandler {
    execute(request, context) {
      if (typeof processGetActionLegacy === 'function' && request && request.method === 'GET') {
        const action = (request.parameter && request.parameter.action) || request.path.replace('/', '');
        return processGetActionLegacy(action, request);
      }
      if (typeof processPostAction === 'function' && request && request.method === 'POST') {
        const action = (request.parameter && request.parameter.action) || (request.body && request.body.action) || request.path.replace('/', '');
        return processPostAction(action, request.body, request);
      }
      return { success: true, message: 'POSTING MAP API is online (Fallback).' };
    }
  };
}

if (typeof EndpointRegistry === 'undefined') {
  EndpointRegistry = class EndpointRegistry {
    constructor() {
      this.routes = {};
      this.unknownHandler = new UnknownEndpointHandler();
      this.legacyHandler = new LegacyApiFallbackHandler();
      this.registerDefaultRoutes();
    }
    static getInstance() {
      if (!EndpointRegistry.instance) {
        EndpointRegistry.instance = new EndpointRegistry();
      }
      return EndpointRegistry.instance;
    }
    registerDefaultRoutes() {
      const flags = (typeof GasConfigurationProvider !== 'undefined') ? GasConfigurationProvider.getInstance().getFeatureFlags() : {};
      
      if (typeof DashboardHandler !== 'undefined') {
        const dashboard = flags.mapbox && typeof DashboardHandler !== 'undefined' ? new DashboardHandler() : (typeof LegacyDashboardHandler !== 'undefined' ? new LegacyDashboardHandler() : null);
        if (dashboard) {
          this.register('GET', 'v2', '/dashboard', dashboard);
          this.register('POST', 'v2', '/dashboard', dashboard);
        }
      }
      if (typeof HoldingHandler !== 'undefined') {
        const holding = flags.mapbox && typeof HoldingHandler !== 'undefined' ? new HoldingHandler() : (typeof LegacyHoldingHandler !== 'undefined' ? new LegacyHoldingHandler() : null);
        if (holding) {
          this.register('GET', 'v2', '/holding', holding);
          this.register('POST', 'v2', '/holding', holding);
        }
      }
      if (typeof HealthHandler !== 'undefined') {
        this.register('GET', 'v2', '/health', new HealthHandler());
      }
      if (typeof VersionHandler !== 'undefined') {
        this.register('GET', 'v2', '/version', new VersionHandler());
      }
      if (typeof WriteBatchSpreadsheetHandler !== 'undefined') {
        const handler = new WriteBatchSpreadsheetHandler();
        this.register('POST', 'v1', '/writeBatchSpreadsheet', handler);
        this.register('POST', 'v2', '/writeBatchSpreadsheet', handler);
      }
      if (typeof GetAreasHandler !== 'undefined') {
        const handler = new GetAreasHandler();
        this.register('GET', 'v1', '/getAreas', handler);
        this.register('GET', 'v2', '/getAreas', handler);
      }
      if (typeof DuplicateTemplateSheetHandler !== 'undefined') {
        const handler = new DuplicateTemplateSheetHandler();
        this.register('POST', 'v1', '/duplicateTemplateSheet', handler);
        this.register('POST', 'v2', '/duplicateTemplateSheet', handler);
      }
      if (typeof CreateTestSpreadsheetHandler !== 'undefined') {
        const handler = new CreateTestSpreadsheetHandler();
        this.register('POST', 'v1', '/createTestSpreadsheet', handler);
        this.register('POST', 'v2', '/createTestSpreadsheet', handler);
      }
      if (typeof CleanupTestSpreadsheetHandler !== 'undefined') {
        const handler = new CleanupTestSpreadsheetHandler();
        this.register('POST', 'v1', '/cleanupTestSpreadsheet', handler);
        this.register('POST', 'v2', '/cleanupTestSpreadsheet', handler);
      }
    }
    register(method, version, path, handler) {
      const key = RouteResolver.resolveKey(method, version, path);
      this.routes[key] = handler;
    }
    getHandler(method, version, path) {
      const key = RouteResolver.resolveKey(method, version, path);
      return this.routes[key] || this.legacyHandler;
    }
  };
  EndpointRegistry.instance = null;
}
