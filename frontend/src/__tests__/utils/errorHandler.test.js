import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ERROR_CATEGORY,
  ERROR_SEVERITY,
  parseError,
  getErrorMessage,
  getErrorTitle,
  getSuggestedAction,
  formatValidationErrors,
  mapValidationErrorKey,
  requiresUserAction,
  isRetryable,
  createErrorHandler,
} from '../../utils/errorHandler';

// Translation lookup table
const translations = {
  'errors:codes.VAL_REQUIRED_FIELD': 'This field is required',
  'errors:codes.AUTH_TOKEN_EXPIRED': 'Your session has expired. Please log in again.',
  'errors:codes.NET_OFFLINE': 'You appear to be offline.',
  'errors:codes.SYS_INTERNAL_ERROR': 'An unexpected error occurred.',
  'errors:codes.RES_NOT_FOUND': 'The requested resource was not found',
  'errors:network.offline': 'You appear to be offline. Please check your internet connection.',
  'errors:network.timeout': 'Request timed out. Please try again.',
  'errors:network.connectionError': 'Unable to connect to the server.',
  'errors:system.internalError': 'An unexpected error occurred. Please try again later.',
  'errors:api.unknownError': 'An unknown error occurred',
  'errors:validation.required': 'This field is required',
  'errors:validation.invalidEmail': 'Please enter a valid email address',
  'errors:validation.minLength': 'Must be at least {{min}} characters',
  'errors:titles.error': 'Error',
  'errors:titles.validationError': 'Validation Error',
  'errors:titles.authenticationError': 'Authentication Error',
  'errors:titles.authorizationError': 'Access Denied',
  'errors:titles.notFound': 'Not Found',
  'errors:titles.serverError': 'Server Error',
  'errors:titles.networkError': 'Connection Error',
};

// Default mock translate function implementation
const defaultMockTImpl = (key, options = {}) => {
  // Handle interpolation
  let result = translations[key] || options?.defaultValue || key;
  if (options && typeof result === 'string') {
    Object.entries(options).forEach(([param, value]) => {
      if (param !== 'defaultValue') {
        result = result.replace(`{{${param}}}`, value);
      }
    });
  }
  return result;
};

// Create mock function with default implementation
const mockT = vi.fn(defaultMockTImpl);

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default implementation before each test
    mockT.mockImplementation(defaultMockTImpl);
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

  describe('ERROR_SEVERITY', () => {
    it('should have all expected severity levels', () => {
      expect(ERROR_SEVERITY.INFO).toBe('info');
      expect(ERROR_SEVERITY.WARNING).toBe('warning');
      expect(ERROR_SEVERITY.ERROR).toBe('error');
      expect(ERROR_SEVERITY.CRITICAL).toBe('critical');
    });
  });

  describe('parseError', () => {
    it('should parse null/undefined errors', () => {
      const parsed = parseError(null);
      expect(parsed.code).toBe('UNKNOWN_ERROR');
      expect(parsed.category).toBe(ERROR_CATEGORY.SYSTEM);
      expect(parsed.isNetworkError).toBe(false);
    });

    it('should parse API error response with code', () => {
      const apiError = {
        error: {
          code: 'VAL_REQUIRED_FIELD',
          category: 'validation',
        },
        status: 400,
      };
      
      const parsed = parseError(apiError);
      expect(parsed.code).toBe('VAL_REQUIRED_FIELD');
      expect(parsed.category).toBe('validation');
      expect(parsed.isValidationError).toBe(true);
      expect(parsed.httpStatus).toBe(400);
    });

    it('should parse authentication errors', () => {
      const authError = {
        error: {
          code: 'AUTH_TOKEN_EXPIRED',
          category: 'authentication',
        },
        status: 401,
      };
      
      const parsed = parseError(authError);
      expect(parsed.code).toBe('AUTH_TOKEN_EXPIRED');
      expect(parsed.isAuthError).toBe(true);
    });

    it('should parse network errors when offline', () => {
      // Mock navigator.onLine
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
      });

      const networkError = new TypeError('Failed to fetch');
      const parsed = parseError(networkError);
      
      expect(parsed.code).toBe('NET_OFFLINE');
      expect(parsed.isNetworkError).toBe(true);

      // Restore
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      });
    });

    it('should handle Error objects', () => {
      const error = new Error('Something went wrong');
      const parsed = parseError(error);
      
      expect(parsed.code).toBe('SYS_INTERNAL_ERROR');
      expect(parsed.category).toBe(ERROR_CATEGORY.SYSTEM);
    });

    it('should parse axios-style errors with response', () => {
      const axiosError = {
        response: {
          data: {
            error: {
              code: 'RES_NOT_FOUND',
              category: 'resource',
            },
          },
          status: 404,
        },
      };
      
      const parsed = parseError(axiosError);
      expect(parsed.code).toBe('RES_NOT_FOUND');
      expect(parsed.httpStatus).toBe(404);
    });
  });

  describe('getErrorMessage', () => {
    it('should return translated message for known error', () => {
      const error = {
        error: {
          code: 'VAL_REQUIRED_FIELD',
          category: 'validation',
        },
      };
      
      const message = getErrorMessage(mockT, error);
      expect(message).toBe('This field is required');
    });

    it('should return fallback for unknown error', () => {
      const error = {
        error: {
          code: 'UNKNOWN_CODE_123',
        },
      };
      
      const message = getErrorMessage(mockT, error, 'Custom fallback');
      expect(message).toBe('Custom fallback');
    });

    it('should use default fallback if none provided', () => {
      mockT.mockImplementation(() => 'errors:codes.UNKNOWN_CODE');
      
      const error = {
        error: {
          code: 'UNKNOWN_CODE',
        },
      };
      
      const message = getErrorMessage(mockT, error);
      expect(message).toBe('An error occurred');
    });
  });

  describe('getErrorTitle', () => {
    it('should return correct title for validation errors', () => {
      const title = getErrorTitle(mockT, ERROR_CATEGORY.VALIDATION);
      expect(title).toBe('Validation Error');
    });

    it('should return correct title for authentication errors', () => {
      const title = getErrorTitle(mockT, ERROR_CATEGORY.AUTHENTICATION);
      expect(title).toBe('Authentication Error');
    });

    it('should return correct title for network errors', () => {
      const title = getErrorTitle(mockT, ERROR_CATEGORY.NETWORK);
      expect(title).toBe('Connection Error');
    });

    it('should return default title for unknown category', () => {
      const title = getErrorTitle(mockT, 'unknown');
      expect(title).toBe('Error');
    });
  });

  describe('getSuggestedAction', () => {
    it('should suggest retry for network errors', () => {
      const error = {
        isNetworkError: true,
        code: 'NET_CONNECTION_ERROR',
      };
      expect(getSuggestedAction(error)).toBe('retry');
    });

    it('should suggest login for expired token', () => {
      const error = {
        isAuthError: true,
        code: 'AUTH_TOKEN_EXPIRED',
      };
      expect(getSuggestedAction(error)).toBe('login');
    });

    it('should suggest goHome for route not found', () => {
      const error = {
        category: ERROR_CATEGORY.RESOURCE,
        code: 'RES_ROUTE_NOT_FOUND',
      };
      expect(getSuggestedAction(error)).toBe('goHome');
    });

    it('should suggest retry for system errors', () => {
      const error = {
        category: ERROR_CATEGORY.SYSTEM,
        code: 'SYS_INTERNAL_ERROR',
      };
      expect(getSuggestedAction(error)).toBe('retry');
    });

    it('should return null for validation errors', () => {
      const error = {
        isValidationError: true,
        category: ERROR_CATEGORY.VALIDATION,
        code: 'VAL_REQUIRED_FIELD',
      };
      expect(getSuggestedAction(error)).toBeNull();
    });
  });

  describe('mapValidationErrorKey', () => {
    it('should handle keys with namespace', () => {
      const key = 'errors:validation.required';
      expect(mapValidationErrorKey(key)).toBe('errors:validation.required');
    });

    it('should add namespace to validation keys', () => {
      const key = 'validation.required';
      expect(mapValidationErrorKey(key)).toBe('errors:validation.required');
    });

    it('should add full path for simple keys', () => {
      const key = 'required';
      expect(mapValidationErrorKey(key)).toBe('errors:validation.required');
    });
  });

  describe('formatValidationErrors', () => {
    it('should format array of error objects', () => {
      const errors = {
        email: [{ errorKey: 'invalidEmail' }],
        name: [{ errorKey: 'required' }],
      };
      
      const formatted = formatValidationErrors(mockT, errors);
      expect(formatted.email).toEqual(['Please enter a valid email address']);
      expect(formatted.name).toEqual(['This field is required']);
    });

    it('should format string errors', () => {
      const errors = {
        email: 'validation.invalidEmail',
      };
      
      const formatted = formatValidationErrors(mockT, errors);
      expect(formatted.email).toEqual(['Please enter a valid email address']);
    });

    it('should handle errors with params', () => {
      mockT.mockImplementation((key, params) => {
        if (key === 'errors:validation.minLength') {
          return `Must be at least ${params?.min || 0} characters`;
        }
        return key;
      });

      const errors = {
        password: [{ errorKey: 'minLength', params: { min: 8 } }],
      };
      
      const formatted = formatValidationErrors(mockT, errors);
      expect(formatted.password[0]).toContain('8');
    });
  });

  describe('requiresUserAction', () => {
    it('should return true for auth errors', () => {
      const error = { isAuthError: true };
      expect(requiresUserAction(error)).toBe(true);
    });

    it('should return true for critical errors', () => {
      const error = { severity: ERROR_SEVERITY.CRITICAL };
      expect(requiresUserAction(error)).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      const error = { category: ERROR_CATEGORY.RATE_LIMIT };
      expect(requiresUserAction(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = { 
        category: ERROR_CATEGORY.VALIDATION,
        severity: ERROR_SEVERITY.WARNING,
      };
      expect(requiresUserAction(error)).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('should return true for network errors', () => {
      const error = { isNetworkError: true };
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for system errors', () => {
      const error = { category: ERROR_CATEGORY.SYSTEM };
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = { code: 'NET_TIMEOUT' };
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for 503 errors', () => {
      const error = { httpStatus: 503 };
      expect(isRetryable(error)).toBe(true);
    });

    it('should return false for validation errors', () => {
      const error = { 
        category: ERROR_CATEGORY.VALIDATION,
        httpStatus: 400,
      };
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe('createErrorHandler', () => {
    it('should call onError for generic errors', () => {
      const onError = vi.fn();
      const handler = createErrorHandler({ t: mockT, onError });
      
      const error = {
        error: { code: 'VAL_REQUIRED_FIELD', category: 'validation' },
      };
      
      handler(error);
      expect(onError).toHaveBeenCalled();
    });

    it('should call onAuthError for auth errors', () => {
      const onAuthError = vi.fn();
      const onError = vi.fn();
      const handler = createErrorHandler({ t: mockT, onError, onAuthError });
      
      const error = {
        error: { code: 'AUTH_TOKEN_EXPIRED', category: 'authentication' },
        status: 401,
      };
      
      handler(error);
      expect(onAuthError).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onNetworkError for network errors', () => {
      const onNetworkError = vi.fn();
      const onError = vi.fn();
      const handler = createErrorHandler({ t: mockT, onError, onNetworkError });
      
      const error = {
        error: { code: 'NET_OFFLINE', category: 'network' },
      };
      
      handler(error);
      expect(onNetworkError).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should return parsed error', () => {
      const handler = createErrorHandler({ t: mockT });
      
      const error = {
        error: { code: 'VAL_REQUIRED_FIELD', category: 'validation' },
      };
      
      const result = handler(error);
      expect(result.code).toBe('VAL_REQUIRED_FIELD');
    });
  });
});
