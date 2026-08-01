/**
 * Framework Layer - Request Validator Module
 * 
 * Section: SEC-046 ~ SEC-050 Request Validation
 * Owner Layer: Framework Layer
 * Responsibility: リクエスト形式、必須パラメータ、メソッド可否のバリデーション
 */

if (typeof ValidationError === 'undefined') {
  ValidationError = {
    INVALID_REQUEST: 'INVALID_REQUEST',
    INVALID_METHOD: 'INVALID_METHOD',
    INVALID_VERSION: 'INVALID_VERSION',
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
    FEATURE_DISABLED: 'FEATURE_DISABLED'
  };
}

if (typeof ValidationResult === 'undefined') {
  ValidationResult = class ValidationResult {
    constructor(params) {
      this.valid = params.valid;
      this.errors = params.errors || [];
      this.warnings = params.warnings || [];
      this.metadata = params.metadata;
    }
    static success(validatedAt, duration) {
      return new ValidationResult({
        valid: true,
        metadata: { validatedAt: validatedAt, duration: duration }
      });
    }
    static failure(errors, validatedAt, duration) {
      return new ValidationResult({
        valid: false,
        errors: errors,
        metadata: { validatedAt: validatedAt, duration: duration }
      });
    }
  };
}

if (typeof RequestValidator === 'undefined') {
  RequestValidator = class RequestValidator {
    constructor() {
      this.id = 'REQUEST_VALIDATOR';
    }
    validate(request, context) {
      const validatedAt = Date.now();
      if (!request) {
        return ValidationResult.failure(
          [{ code: ValidationError.INVALID_REQUEST, message: 'Request object is null or undefined.', validatorId: this.id }],
          validatedAt,
          0
        );
      }
      if (!request.method || !request.path || !request.requestId) {
        return ValidationResult.failure(
          [{ code: ValidationError.INVALID_REQUEST, message: 'Request method, path or requestId is missing.', validatorId: this.id }],
          validatedAt,
          0
        );
      }
      return ValidationResult.success(validatedAt, 0);
    }
  };
}

if (typeof MethodValidator === 'undefined') {
  MethodValidator = class MethodValidator {
    constructor() {
      this.id = 'METHOD_VALIDATOR';
    }
    validate(request, context) {
      const validatedAt = Date.now();
      if (!RoutePolicy.isMethodAllowed(request ? request.method : '')) {
        return ValidationResult.failure(
          [{ code: ValidationError.INVALID_METHOD, message: 'HTTP Method ' + (request ? request.method : '') + ' is not allowed.', validatorId: this.id }],
          validatedAt,
          0
        );
      }
      return ValidationResult.success(validatedAt, 0);
    }
  };
}
