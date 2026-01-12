/**
 * Error Handler Utility
 * Centralized error handling for the frontend application.
 * Provides consistent error processing, translation, and user-friendly messaging.
 */

/**
 * Error categories matching backend error codes
 */
export const ERROR_CATEGORY = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  RESOURCE: 'resource',
  BUSINESS: 'business',
  SYSTEM: 'system',
  NETWORK: 'network',
  RATE_LIMIT: 'rateLimit',
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * HTTP status code to error category mapping
 */
const HTTP_STATUS_CATEGORY_MAP = {
  400: ERROR_CATEGORY.VALIDATION,
  401: ERROR_CATEGORY.AUTHENTICATION,
  403: ERROR_CATEGORY.AUTHORIZATION,
  404: ERROR_CATEGORY.RESOURCE,
  409: ERROR_CATEGORY.BUSINESS,
  422: ERROR_CATEGORY.VALIDATION,
  429: ERROR_CATEGORY.RATE_LIMIT,
  500: ERROR_CATEGORY.SYSTEM,
  502: ERROR_CATEGORY.NETWORK,
  503: ERROR_CATEGORY.SYSTEM,
  504: ERROR_CATEGORY.NETWORK,
};

/**
 * HTTP status code to severity mapping
 */
const HTTP_STATUS_SEVERITY_MAP = {
  400: ERROR_SEVERITY.WARNING,
  401: ERROR_SEVERITY.WARNING,
  403: ERROR_SEVERITY.WARNING,
  404: ERROR_SEVERITY.INFO,
  409: ERROR_SEVERITY.WARNING,
  422: ERROR_SEVERITY.WARNING,
  429: ERROR_SEVERITY.WARNING,
  500: ERROR_SEVERITY.ERROR,
  502: ERROR_SEVERITY.ERROR,
  503: ERROR_SEVERITY.ERROR,
  504: ERROR_SEVERITY.ERROR,
};

/**
 * Parsed error structure
 * @typedef {Object} ParsedError
 * @property {string} code - Error code
 * @property {string} category - Error category
 * @property {string} severity - Error severity
 * @property {string} messageKey - Translation key for the error message
 * @property {Object} params - Parameters for translation interpolation
 * @property {number} [httpStatus] - HTTP status code
 * @property {*} [originalError] - Original error for debugging
 * @property {boolean} isNetworkError - Whether this is a network error
 * @property {boolean} isAuthError - Whether this is an authentication error
 * @property {boolean} isValidationError - Whether this is a validation error
 */

/**
 * Check if the browser is online
 * @returns {boolean}
 */
const isOnline = () => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * Determine error category from HTTP status
 * @param {number} status - HTTP status code
 * @returns {string} Error category
 */
const getCategoryFromStatus = (status) => {
  return HTTP_STATUS_CATEGORY_MAP[status] || ERROR_CATEGORY.SYSTEM;
};

/**
 * Determine error severity from HTTP status
 * @param {number} status - HTTP status code
 * @returns {string} Error severity
 */
const getSeverityFromStatus = (status) => {
  return HTTP_STATUS_SEVERITY_MAP[status] || ERROR_SEVERITY.ERROR;
};

/**
 * Map backend error code to frontend translation key
 * @param {string} code - Backend error code
 * @returns {string} Translation key
 */
const mapCodeToTranslationKey = (code) => {
  // Direct mapping using the codes namespace
  return `errors:codes.${code}`;
};

/**
 * Map validation error key to translation key
 * @param {string} errorKey - Validation error key (e.g., 'validation.required')
 * @returns {string} Full translation key
 */
export const mapValidationErrorKey = (errorKey) => {
  // If it's already a full path with namespace, return as-is
  if (errorKey.includes(':')) {
    return errorKey;
  }
  
  // If it starts with 'validation.', use errors namespace
  if (errorKey.startsWith('validation.')) {
    return `errors:${errorKey}`;
  }
  
  // Otherwise, assume it's a validation error
  return `errors:validation.${errorKey}`;
};

/**
 * Parse an API error response
 * @param {Object} response - API error response
 * @returns {ParsedError} Parsed error object
 */
const parseApiError = (response) => {
  const error = response?.error || response;
  const code = error?.code || 'UNKNOWN_ERROR';
  const category = error?.category || getCategoryFromStatus(response?.status || 500);
  
  return {
    code,
    category,
    severity: getSeverityFromStatus(response?.status || 500),
    messageKey: mapCodeToTranslationKey(code),
    params: error?.params || {},
    httpStatus: response?.status,
    originalError: response,
    isNetworkError: category === ERROR_CATEGORY.NETWORK,
    isAuthError: category === ERROR_CATEGORY.AUTHENTICATION,
    isValidationError: category === ERROR_CATEGORY.VALIDATION,
  };
};

/**
 * Parse a network error
 * @param {Error} error - Network error
 * @returns {ParsedError} Parsed error object
 */
const parseNetworkError = (error) => {
  // Check if offline
  if (!isOnline()) {
    return {
      code: 'NET_OFFLINE',
      category: ERROR_CATEGORY.NETWORK,
      severity: ERROR_SEVERITY.ERROR,
      messageKey: 'errors:network.offline',
      params: {},
      originalError: error,
      isNetworkError: true,
      isAuthError: false,
      isValidationError: false,
    };
  }

  // Check for timeout
  if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    return {
      code: 'NET_TIMEOUT',
      category: ERROR_CATEGORY.NETWORK,
      severity: ERROR_SEVERITY.ERROR,
      messageKey: 'errors:network.timeout',
      params: {},
      originalError: error,
      isNetworkError: true,
      isAuthError: false,
      isValidationError: false,
    };
  }

  // Generic network error
  return {
    code: 'NET_CONNECTION_ERROR',
    category: ERROR_CATEGORY.NETWORK,
    severity: ERROR_SEVERITY.ERROR,
    messageKey: 'errors:network.connectionError',
    params: {},
    originalError: error,
    isNetworkError: true,
    isAuthError: false,
    isValidationError: false,
  };
};

/**
 * Parse any error into a standardized format
 * @param {*} error - Error from any source
 * @returns {ParsedError} Parsed error object
 */
export const parseError = (error) => {
  // Handle null/undefined
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      category: ERROR_CATEGORY.SYSTEM,
      severity: ERROR_SEVERITY.ERROR,
      messageKey: 'errors:api.unknownError',
      params: {},
      originalError: error,
      isNetworkError: false,
      isAuthError: false,
      isValidationError: false,
    };
  }

  // Handle fetch Response object
  if (error instanceof Response || error?.status !== undefined) {
    return parseApiError(error);
  }

  // Handle Error object with response (axios-style)
  if (error?.response) {
    return parseApiError({
      ...error.response.data,
      status: error.response.status,
    });
  }

  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return parseNetworkError(error);
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    // Check for network-related errors
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return parseNetworkError(error);
    }

    return {
      code: 'SYS_INTERNAL_ERROR',
      category: ERROR_CATEGORY.SYSTEM,
      severity: ERROR_SEVERITY.ERROR,
      messageKey: 'errors:system.internalError',
      params: {},
      originalError: error,
      isNetworkError: false,
      isAuthError: false,
      isValidationError: false,
    };
  }

  // Handle API response object with error property
  if (error?.error || error?.code) {
    return parseApiError(error);
  }

  // Fallback
  return {
    code: 'UNKNOWN_ERROR',
    category: ERROR_CATEGORY.SYSTEM,
    severity: ERROR_SEVERITY.ERROR,
    messageKey: 'errors:api.unknownError',
    params: {},
    originalError: error,
    isNetworkError: false,
    isAuthError: false,
    isValidationError: false,
  };
};

/**
 * Get a translated error message
 * @param {Function} t - i18next translate function
 * @param {*} error - Error to translate
 * @param {string} [fallback] - Fallback message if translation fails
 * @returns {string} Translated error message
 */
export const getErrorMessage = (t, error, fallback = 'An error occurred') => {
  const parsed = parseError(error);
  
  // Try to translate using the message key
  const translated = t(parsed.messageKey, {
    ...parsed.params,
    defaultValue: null,
  });
  
  // If translation succeeded, return it
  if (translated && translated !== parsed.messageKey) {
    return translated;
  }
  
  // Try the code directly
  const codeTranslated = t(`errors:codes.${parsed.code}`, {
    ...parsed.params,
    defaultValue: null,
  });
  
  if (codeTranslated && !codeTranslated.includes('codes.')) {
    return codeTranslated;
  }
  
  // Return fallback
  return fallback;
};

/**
 * Get the title for an error category
 * @param {Function} t - i18next translate function
 * @param {string} category - Error category
 * @returns {string} Translated title
 */
export const getErrorTitle = (t, category) => {
  const titleMap = {
    [ERROR_CATEGORY.VALIDATION]: 'errors:titles.validationError',
    [ERROR_CATEGORY.AUTHENTICATION]: 'errors:titles.authenticationError',
    [ERROR_CATEGORY.AUTHORIZATION]: 'errors:titles.authorizationError',
    [ERROR_CATEGORY.RESOURCE]: 'errors:titles.notFound',
    [ERROR_CATEGORY.BUSINESS]: 'errors:titles.error',
    [ERROR_CATEGORY.SYSTEM]: 'errors:titles.serverError',
    [ERROR_CATEGORY.NETWORK]: 'errors:titles.networkError',
    [ERROR_CATEGORY.RATE_LIMIT]: 'errors:titles.error',
  };
  
  return t(titleMap[category] || 'errors:titles.error');
};

/**
 * Get suggested action for an error
 * @param {ParsedError} error - Parsed error
 * @returns {string|null} Suggested action key
 */
export const getSuggestedAction = (error) => {
  if (error.isNetworkError) {
    return 'retry';
  }
  
  if (error.isAuthError) {
    return error.code === 'AUTH_TOKEN_EXPIRED' ? 'login' : null;
  }
  
  if (error.category === ERROR_CATEGORY.RESOURCE && error.code === 'RES_ROUTE_NOT_FOUND') {
    return 'goHome';
  }
  
  if (error.category === ERROR_CATEGORY.SYSTEM) {
    return 'retry';
  }
  
  return null;
};

/**
 * Format validation errors for form display
 * @param {Object} errors - Validation errors object
 * @param {Function} t - i18next translate function
 * @returns {Object} Formatted errors with translated messages
 */
export const formatValidationErrors = (t, errors) => {
  const formatted = {};
  
  for (const [field, fieldErrors] of Object.entries(errors)) {
    if (Array.isArray(fieldErrors)) {
      formatted[field] = fieldErrors.map((err) => {
        if (typeof err === 'string') {
          return t(mapValidationErrorKey(err));
        }
        if (err?.errorKey) {
          return t(mapValidationErrorKey(err.errorKey), err.params || {});
        }
        return t('errors:validation.required');
      });
    } else if (typeof fieldErrors === 'string') {
      formatted[field] = [t(mapValidationErrorKey(fieldErrors))];
    } else if (fieldErrors?.errorKey) {
      formatted[field] = [t(mapValidationErrorKey(fieldErrors.errorKey), fieldErrors.params || {})];
    }
  }
  
  return formatted;
};

/**
 * Check if error requires user action
 * @param {ParsedError} error - Parsed error
 * @returns {boolean}
 */
export const requiresUserAction = (error) => {
  return (
    error.isAuthError ||
    error.severity === ERROR_SEVERITY.CRITICAL ||
    error.category === ERROR_CATEGORY.RATE_LIMIT
  );
};

/**
 * Check if error is retryable
 * @param {ParsedError} error - Parsed error
 * @returns {boolean}
 */
export const isRetryable = (error) => {
  return (
    error.isNetworkError ||
    error.category === ERROR_CATEGORY.SYSTEM ||
    error.code === 'NET_TIMEOUT' ||
    error.httpStatus === 503 ||
    error.httpStatus === 504
  );
};

/**
 * Create error handler with default behavior
 * @param {Object} options - Handler options
 * @param {Function} options.t - i18next translate function
 * @param {Function} [options.onError] - Callback for errors
 * @param {Function} [options.onAuthError] - Callback for auth errors
 * @param {Function} [options.onNetworkError] - Callback for network errors
 * @returns {Function} Error handler function
 */
export const createErrorHandler = (options) => {
  const { t, onError, onAuthError, onNetworkError } = options;
  
  return (error) => {
    const parsed = parseError(error);
    const message = getErrorMessage(t, error);
    const title = getErrorTitle(t, parsed.category);
    
    // Handle specific error types
    if (parsed.isAuthError && onAuthError) {
      onAuthError(parsed, message, title);
      return parsed;
    }
    
    if (parsed.isNetworkError && onNetworkError) {
      onNetworkError(parsed, message, title);
      return parsed;
    }
    
    // Generic error handler
    if (onError) {
      onError(parsed, message, title);
    }
    
    return parsed;
  };
};

/**
 * Log error for debugging (only in development)
 * @param {*} error - Error to log
 * @param {string} [context] - Context information
 */
export const logError = (error, context = '') => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔴 Error${context ? ` [${context}]` : ''}`);
    console.error('Original error:', error);
    console.log('Parsed:', parseError(error));
    console.groupEnd();
  }
};

export default {
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
  logError,
};
