/**
 * Framework Layer - API Router Module
 * 
 * Section: SEC-041 ApiRouter
 * Owner Layer: Framework Layer
 * Responsibility: HTTP リクエストを EndpointRegistry 経由で適切なハンドラーへ振分けルーティングする
 */

if (typeof ApiRouter === 'undefined') {
  ApiRouter = class ApiRouter {
    constructor() {
      this.registry = EndpointRegistry.getInstance();
    }
    static getInstance() {
      if (!ApiRouter.instance) {
        ApiRouter.instance = new ApiRouter();
      }
      return ApiRouter.instance;
    }
    route(request, context) {
      const metadata = {
        requestId: request ? request.requestId : "",
        serverTimestamp: context ? context.getStartTimestamp() : Date.now(),
        processingTime: context ? context.getElapsedTime() : 0,
        version: request ? request.version : "v1"
      };

      if (!RoutePolicy.isMethodAllowed(request ? request.method : '')) {
        return (typeof ApiResponse !== 'undefined' && ApiResponse.errorResponse)
          ? ApiResponse.errorResponse('METHOD_NOT_ALLOWED', 'HTTP Method ' + (request ? request.method : '') + ' is not allowed by RoutePolicy.', 405, metadata)
          : { success: false, error: 'Method Not Allowed', statusCode: 405 };
      }

      try {
        const handler = this.registry.getHandler(request.method, request.version, request.path);
        return handler.execute(request, context);
      } catch (err) {
        return (typeof ApiResponse !== 'undefined' && ApiResponse.errorResponse)
          ? ApiResponse.errorResponse('INTERNAL_SERVER_ERROR', err.message || String(err), 500, metadata)
          : { success: false, error: err.message || String(err), statusCode: 500 };
      }
    }
  };
  ApiRouter.instance = null;
}
