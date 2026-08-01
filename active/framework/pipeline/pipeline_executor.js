/**
 * Framework Layer - Pipeline Executor Module
 * 
 * Section: SEC-009, SEC-042 ~ SEC-045 Pipeline Execution Foundation
 * Owner Layer: Framework Layer
 * Responsibility: パイプラインステージの固定順序実行 (Request -> Auth -> Validation -> Business -> Response)
 */

if (typeof PlatformIntegrationPipeline === 'undefined') {
  PlatformIntegrationPipeline = class PlatformIntegrationPipeline {
    static execute(e) {
      if (typeof RuntimeLifecycle !== 'undefined' && RuntimeLifecycle.start) {
        RuntimeLifecycle.start();
      }
      
      const context = new ApiExecutionContext();
      
      let method = 'GET';
      if (e && e.postData) {
        method = 'POST';
      } else if (e && e.parameter && e.parameter.method) {
        method = e.parameter.method.toUpperCase();
      }

      let path = '/';
      let params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
      let postData = null;
      if (e && e.postData && e.postData.contents) {
        try {
          postData = JSON.parse(e.postData.contents);
        } catch (errP) {}
      }

      const action = params.action || (postData && postData.action) || "";
      if (action) {
        path = '/' + action;
      }

      const request = {
        method: method,
        version: params.v || 'v1',
        path: path,
        requestId: context.getRequestId(),
        parameter: params,
        body: postData,
        rawEvent: e
      };

      const router = ApiRouter.getInstance();
      const result = router.route(request, context);

      if (result && typeof ResponseBuilder !== 'undefined' && typeof ResponseBuilder.buildJsonResponse === 'function') {
        if (typeof result.setMimeType === 'function') {
          return result;
        }
        return ResponseBuilder.buildJsonResponse(result);
      }
      
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
  };
}

if (typeof ValidationPipeline === 'undefined') {
  ValidationPipeline = class ValidationPipeline {
    constructor() {
      this.validators = [new RequestValidator(), new MethodValidator()];
    }
    execute(request, context) {
      const startTime = Date.now();
      for (let validator of this.validators) {
        const result = validator.validate(request, context);
        if (!result.valid) {
          context.setValidationTime(Date.now() - startTime);
          return result;
        }
      }
      context.setValidationTime(Date.now() - startTime);
      return ValidationResult.success(Date.now(), Date.now() - startTime);
    }
  };
}

if (typeof AuthorizationPipeline === 'undefined') {
  AuthorizationPipeline = class AuthorizationPipeline {
    constructor() {
      this.guard = new AuthorizationGuard();
    }
    execute(request, context) {
      return this.guard.authorize(request, context);
    }
  };
}
