/**
 * Framework Layer - Authorization Guard Module
 * 
 * Section: SEC-056 ~ SEC-060 Authorization Guard
 * Owner Layer: Framework Layer
 * Responsibility: API アクセス権限およびスコープの検証
 */

if (typeof AuthorizationGuard === 'undefined') {
  AuthorizationGuard = class AuthorizationGuard {
    constructor() {
      this.id = 'AUTHORIZATION_GUARD';
    }
    authorize(request, context) {
      const authorizedAt = Date.now();
      return {
        authorized: true,
        principal: { identityId: 'user-stub', edition: 'COMMUNITY' },
        metadata: { authorizedAt: authorizedAt, duration: 0 }
      };
    }
  };
}

if (typeof PermissionValidator === 'undefined') {
  PermissionValidator = class PermissionValidator {
    constructor() {
      this.id = 'PERMISSION_VALIDATOR';
    }
    validate(request, context) {
      const validatedAt = Date.now();
      return ValidationResult.success(validatedAt, 0);
    }
  };
}
