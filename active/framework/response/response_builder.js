/**
 * Framework Layer - Response Builder Module
 * 
 * Section: SEC-051 ~ SEC-055 ApiResponse, ResponseBuilder
 * Owner Layer: Framework Layer
 * Responsibility: 一貫した API JSON レスポンスフォーマット構造の構築と返却
 */

if (typeof ApiResponse === 'undefined') {
  ApiResponse = class ApiResponse {
    constructor(params) {
      this.success = params ? params.success : true;
      this.data = (params && params.data !== undefined) ? params.data : null;
      this.error = (params && params.error !== undefined) ? params.error : null;
      this.metadata = (params && params.metadata) || {};
      this.statusCode = (params && params.statusCode) || 200;
    }
    static successResponse(data, statusCode, metadata) {
      return new ApiResponse({
        success: true,
        data: data,
        error: null,
        statusCode: statusCode || 200,
        metadata: metadata || {}
      });
    }
    static errorResponse(code, message, statusCode, metadata) {
      return new ApiResponse({
        success: false,
        data: null,
        error: { code: code, message: message },
        statusCode: statusCode || 400,
        metadata: metadata || {}
      });
    }
  };
}

if (typeof ResponseBuilder === 'undefined') {
  ResponseBuilder = class ResponseBuilder {
    static buildJsonResponse(apiResponse) {
      let payload = apiResponse;
      if (apiResponse && apiResponse.success !== undefined) {
        payload = {
          success: apiResponse.success,
          data: apiResponse.data,
          error: apiResponse.error,
          metadata: apiResponse.metadata
        };
      }
      return ContentService.createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON);
    }
  };
}
