/**
 * Unit tests for error codes utility
 */

const {
  HTTP_STATUS,
  ERROR_CATEGORY,
  ERROR_CODES,
  createErrorResponse,
  getHttpStatus,
  ApiError,
  getErrorsByCategory,
  isValidErrorCode,
} = require('../utils/errorCodes');

describe('errorCodes', () => {
  describe('HTTP_STATUS', () => {
    it('should have all expected status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.CONFLICT).toBe(409);
      expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
      expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
    });
  });

  describe('ERROR_CATEGORY', () => {
    it('should have all expected categories', () => {
      expect(ERROR_CATEGORY.VALIDATION).toBe('validation');
      expect(ERROR_CATEGORY.AUTHENTICATION).toBe('authentication');
      expect(ERROR_CATEGORY.AUTHORIZATION).toBe('authorization');
      expect(ERROR_CATEGORY.RESOURCE).toBe('resource');
      expect(ERROR_CATEGORY.BUSINESS).toBe('business');
      expect(ERROR_CATEGORY.SYSTEM).toBe('system');
      expect(ERROR_CATEGORY.NETWORK).toBe('network');
      expect(ERROR_CATEGORY.RATE_LIMIT).toBe('rateLimit');
    });
  });

  describe('ERROR_CODES', () => {
    it('should have validation error codes', () => {
      expect(ERROR_CODES.VAL_REQUIRED_FIELD).toBeDefined();
      expect(ERROR_CODES.VAL_REQUIRED_FIELD.code).toBe('VAL_REQUIRED_FIELD');
      expect(ERROR_CODES.VAL_REQUIRED_FIELD.httpStatus).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(ERROR_CODES.VAL_REQUIRED_FIELD.category).toBe(ERROR_CATEGORY.VALIDATION);
      expect(ERROR_CODES.VAL_REQUIRED_FIELD.message.en).toBeDefined();
      expect(ERROR_CODES.VAL_REQUIRED_FIELD.message.tr).toBeDefined();
    });

    it('should have authentication error codes', () => {
      expect(ERROR_CODES.AUTH_INVALID_CREDENTIALS).toBeDefined();
      expect(ERROR_CODES.AUTH_TOKEN_EXPIRED).toBeDefined();
      expect(ERROR_CODES.AUTH_TOKEN_MISSING).toBeDefined();
    });

    it('should have resource error codes', () => {
      expect(ERROR_CODES.RES_NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.RES_TAX_YEAR_NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.RES_ALREADY_EXISTS).toBeDefined();
    });

    it('should have system error codes', () => {
      expect(ERROR_CODES.SYS_INTERNAL_ERROR).toBeDefined();
      expect(ERROR_CODES.SYS_DATABASE_ERROR).toBeDefined();
      expect(ERROR_CODES.SYS_SERVICE_UNAVAILABLE).toBeDefined();
    });

    it('should have network error codes', () => {
      expect(ERROR_CODES.NET_CONNECTION_ERROR).toBeDefined();
      expect(ERROR_CODES.NET_TIMEOUT).toBeDefined();
      expect(ERROR_CODES.NET_OFFLINE).toBeDefined();
    });

    it('should have rate limit error codes', () => {
      expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBeDefined();
      expect(ERROR_CODES.RATE_LOGIN_ATTEMPTS_EXCEEDED).toBeDefined();
    });

    it('all error codes should have bilingual messages', () => {
      Object.entries(ERROR_CODES).forEach(([key, errorDef]) => {
        expect(errorDef.message.en).toBeDefined();
        expect(errorDef.message.tr).toBeDefined();
        expect(typeof errorDef.message.en).toBe('string');
        expect(typeof errorDef.message.tr).toBe('string');
        expect(errorDef.message.en.length).toBeGreaterThan(0);
        expect(errorDef.message.tr.length).toBeGreaterThan(0);
      });
    });
  });

  describe('createErrorResponse', () => {
    it('should create a valid error response', () => {
      const response = createErrorResponse('VAL_REQUIRED_FIELD');
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VAL_REQUIRED_FIELD');
      expect(response.error.category).toBe(ERROR_CATEGORY.VALIDATION);
      expect(response.error.message.en).toBe('This field is required');
      expect(response.error.message.tr).toBe('Bu alan zorunludur');
    });

    it('should interpolate parameters into messages', () => {
      const response = createErrorResponse('VAL_MIN_LENGTH', { min: 8 });
      
      expect(response.error.message.en).toBe('Must be at least 8 characters');
      expect(response.error.message.tr).toBe('En az 8 karakter olmalıdır');
    });

    it('should include details when provided', () => {
      const details = { field: 'email', value: 'invalid' };
      const response = createErrorResponse('VAL_INVALID_EMAIL', {}, details);
      
      expect(response.error.details).toEqual(details);
    });

    it('should handle unknown error codes', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const response = createErrorResponse('UNKNOWN_CODE');
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('UNKNOWN_ERROR');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getHttpStatus', () => {
    it('should return correct HTTP status for known error codes', () => {
      expect(getHttpStatus('VAL_REQUIRED_FIELD')).toBe(400);
      expect(getHttpStatus('AUTH_INVALID_CREDENTIALS')).toBe(401);
      expect(getHttpStatus('AUTHZ_FORBIDDEN')).toBe(403);
      expect(getHttpStatus('RES_NOT_FOUND')).toBe(404);
      expect(getHttpStatus('RES_ALREADY_EXISTS')).toBe(409);
      expect(getHttpStatus('RATE_LIMIT_EXCEEDED')).toBe(429);
      expect(getHttpStatus('SYS_INTERNAL_ERROR')).toBe(500);
    });

    it('should return 500 for unknown error codes', () => {
      expect(getHttpStatus('UNKNOWN_CODE')).toBe(500);
    });
  });

  describe('ApiError', () => {
    it('should create an ApiError instance', () => {
      const error = new ApiError('VAL_REQUIRED_FIELD');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ApiError');
      expect(error.code).toBe('VAL_REQUIRED_FIELD');
      expect(error.httpStatus).toBe(400);
      expect(error.category).toBe(ERROR_CATEGORY.VALIDATION);
    });

    it('should include params and details', () => {
      const params = { min: 8 };
      const details = { field: 'password' };
      const error = new ApiError('VAL_MIN_LENGTH', params, details);
      
      expect(error.params).toEqual(params);
      expect(error.details).toEqual(details);
    });

    it('should have bilingual messages', () => {
      const error = new ApiError('AUTH_TOKEN_EXPIRED');
      
      expect(error.message).toBe('Your session has expired. Please log in again.');
      expect(error.messageTr).toBe('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
    });

    it('should convert to response object', () => {
      const error = new ApiError('RES_NOT_FOUND');
      const response = error.toResponse();
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('RES_NOT_FOUND');
    });

    it('should fall back to internal error for unknown codes', () => {
      const error = new ApiError('COMPLETELY_UNKNOWN');
      
      expect(error.code).toBe('SYS_INTERNAL_ERROR');
    });
  });

  describe('getErrorsByCategory', () => {
    it('should return validation errors', () => {
      const validationErrors = getErrorsByCategory(ERROR_CATEGORY.VALIDATION);
      
      expect(validationErrors.VAL_REQUIRED_FIELD).toBeDefined();
      expect(validationErrors.VAL_INVALID_EMAIL).toBeDefined();
      expect(validationErrors.AUTH_INVALID_CREDENTIALS).toBeUndefined();
    });

    it('should return authentication errors', () => {
      const authErrors = getErrorsByCategory(ERROR_CATEGORY.AUTHENTICATION);
      
      expect(authErrors.AUTH_INVALID_CREDENTIALS).toBeDefined();
      expect(authErrors.AUTH_TOKEN_EXPIRED).toBeDefined();
      expect(authErrors.VAL_REQUIRED_FIELD).toBeUndefined();
    });

    it('should return empty object for unknown category', () => {
      const errors = getErrorsByCategory('unknown_category');
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('isValidErrorCode', () => {
    it('should return true for valid error codes', () => {
      expect(isValidErrorCode('VAL_REQUIRED_FIELD')).toBe(true);
      expect(isValidErrorCode('AUTH_TOKEN_EXPIRED')).toBe(true);
      expect(isValidErrorCode('SYS_INTERNAL_ERROR')).toBe(true);
    });

    it('should return false for invalid error codes', () => {
      expect(isValidErrorCode('INVALID_CODE')).toBe(false);
      expect(isValidErrorCode('')).toBe(false);
      expect(isValidErrorCode('random')).toBe(false);
    });
  });

  describe('UK-specific validation error codes', () => {
    it('should have UK postcode validation', () => {
      expect(ERROR_CODES.VAL_INVALID_POSTCODE).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_POSTCODE.message.en).toContain('UK postcode');
    });

    it('should have UK phone validation', () => {
      expect(ERROR_CODES.VAL_INVALID_PHONE).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_PHONE.message.en).toContain('UK phone');
    });

    it('should have UK VAT number validation', () => {
      expect(ERROR_CODES.VAL_INVALID_VAT_NUMBER).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_VAT_NUMBER.message.en).toContain('VAT');
    });

    it('should have UK company number validation', () => {
      expect(ERROR_CODES.VAL_INVALID_COMPANY_NUMBER).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_COMPANY_NUMBER.message.en).toContain('company');
    });

    it('should have UTR validation', () => {
      expect(ERROR_CODES.VAL_INVALID_UTR).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_UTR.message.en).toContain('Taxpayer Reference');
    });

    it('should have NINO validation', () => {
      expect(ERROR_CODES.VAL_INVALID_NINO).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_NINO.message.en).toContain('National Insurance');
    });

    it('should have sort code validation', () => {
      expect(ERROR_CODES.VAL_INVALID_SORT_CODE).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_SORT_CODE.message.en).toContain('sort code');
    });

    it('should have bank account validation', () => {
      expect(ERROR_CODES.VAL_INVALID_BANK_ACCOUNT).toBeDefined();
      expect(ERROR_CODES.VAL_INVALID_BANK_ACCOUNT.message.en).toContain('bank account');
    });
  });

  describe('Tax-related error codes', () => {
    it('should have tax year not found error', () => {
      expect(ERROR_CODES.RES_TAX_YEAR_NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.RES_TAX_YEAR_NOT_FOUND.message.en).toContain('Tax rates');
    });

    it('should have VAT rates not found error', () => {
      expect(ERROR_CODES.RES_VAT_RATES_NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.RES_VAT_RATES_NOT_FOUND.message.en).toContain('VAT');
    });

    it('should have corporation tax not found error', () => {
      expect(ERROR_CODES.RES_CORPORATION_TAX_NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.RES_CORPORATION_TAX_NOT_FOUND.message.en).toContain('Corporation tax');
    });

    it('should have national insurance not found error', () => {
      expect(ERROR_CODES.RES_NI_RATES_NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.RES_NI_RATES_NOT_FOUND.message.en).toContain('National Insurance');
    });

    it('should have tax calculation error', () => {
      expect(ERROR_CODES.SYS_FAILED_TO_CALCULATE_TAX).toBeDefined();
    });
  });
});
