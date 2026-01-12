/**
 * Security Middleware
 * Provides security headers, CORS configuration, and input sanitization.
 * Implements security best practices for the UK Accounting API.
 * 
 * @module middleware/security
 */

const validator = require('validator');

/**
 * Default allowed origins for CORS.
 * Can be overridden via environment variable ALLOWED_ORIGINS (comma-separated).
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite default
  'http://localhost:8080'
];

/**
 * Gets allowed origins from environment or defaults.
 * 
 * @returns {string[]} Array of allowed origins
 */
function getAllowedOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Security headers configuration following OWASP recommendations.
 */
const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Enable XSS filter (legacy browsers)
  'X-XSS-Protection': '1; mode=block',
  
  // Strict Transport Security (HTTPS only)
  // Only set in production with HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  
  // Content Security Policy
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'",
  
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  
  // Cache control for API responses
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

/**
 * Security headers middleware.
 * Sets various HTTP security headers on responses.
 * 
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.hsts=true] - Enable HSTS header
 * @param {boolean} [options.csp=true] - Enable Content-Security-Policy
 * @param {Object} [options.customHeaders] - Custom headers to add
 * @returns {Function} Express middleware function
 */
function securityHeaders(options = {}) {
  const { hsts = true, csp = true, customHeaders = {} } = options;

  return (req, res, next) => {
    // Set standard security headers
    res.setHeader('X-Content-Type-Options', SECURITY_HEADERS['X-Content-Type-Options']);
    res.setHeader('X-Frame-Options', SECURITY_HEADERS['X-Frame-Options']);
    res.setHeader('X-XSS-Protection', SECURITY_HEADERS['X-XSS-Protection']);
    res.setHeader('Referrer-Policy', SECURITY_HEADERS['Referrer-Policy']);
    res.setHeader('Permissions-Policy', SECURITY_HEADERS['Permissions-Policy']);
    res.setHeader('Cache-Control', SECURITY_HEADERS['Cache-Control']);
    res.setHeader('Pragma', SECURITY_HEADERS['Pragma']);
    res.setHeader('Expires', SECURITY_HEADERS['Expires']);

    // HSTS header (only in production with HTTPS)
    if (hsts && process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', SECURITY_HEADERS['Strict-Transport-Security']);
    }

    // Content Security Policy (can be disabled for APIs that don't serve HTML)
    if (csp) {
      res.setHeader('Content-Security-Policy', SECURITY_HEADERS['Content-Security-Policy']);
    }

    // Custom headers
    for (const [key, value] of Object.entries(customHeaders)) {
      res.setHeader(key, value);
    }

    next();
  };
}

/**
 * CORS middleware configuration.
 * Configures Cross-Origin Resource Sharing for the API.
 * 
 * @param {Object} [options] - CORS configuration options
 * @param {string|string[]} [options.origin] - Allowed origins
 * @param {string[]} [options.methods] - Allowed HTTP methods
 * @param {string[]} [options.allowedHeaders] - Allowed headers
 * @param {boolean} [options.credentials] - Allow credentials
 * @returns {Function} Express middleware function
 */
function corsMiddleware(options = {}) {
  const {
    origin = getAllowedOrigins(),
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
      'Origin'
    ],
    exposedHeaders = [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    credentials = true,
    maxAge = 86400 // 24 hours
  } = options;

  const allowedOrigins = Array.isArray(origin) ? origin : [origin];

  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    // Check if origin is allowed
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else if (allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    
    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Max-Age', maxAge.toString());

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}

/**
 * XSS character patterns to detect in input.
 * These are pattern strings - we create new RegExp instances each time to avoid lastIndex state issues.
 */
const XSS_PATTERN_STRINGS = [
  '<script\\b[^<]*(?:(?!</script>)<[^<]*)*</script>',
  'javascript:',
  'on\\w+\\s*=', // onclick=, onerror=, etc.
  '<\\s*img[^>]+src\\s*=\\s*["\']?[^"\']*["\']?[^>]*>',
  '<\\s*iframe[^>]*>',
  '<\\s*object[^>]*>',
  '<\\s*embed[^>]*>',
  '&lt;script',
  'data:',
  'vbscript:'
];

/**
 * Pre-compiled patterns for export (without global flag to avoid state issues)
 */
const XSS_PATTERNS = XSS_PATTERN_STRINGS.map(pattern => new RegExp(pattern, 'i'));

/**
 * Checks if a string contains potential XSS patterns.
 * Creates new RegExp instances each time to avoid lastIndex state issues with global flag.
 * 
 * @param {string} input - String to check
 * @returns {boolean} True if XSS patterns detected
 */
function containsXSS(input) {
  if (typeof input !== 'string') {
    return false;
  }
  // Create new regex instances to avoid global flag lastIndex state issues
  for (const patternStr of XSS_PATTERN_STRINGS) {
    const pattern = new RegExp(patternStr, 'gi');
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitizes a string by escaping HTML entities.
 * 
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }
  return validator.escape(input);
}

/**
 * Recursively sanitizes an object's string values.
 * 
 * @param {Object} obj - Object to sanitize
 * @param {Object} [options] - Sanitization options
 * @param {string[]} [options.skipFields] - Field names to skip sanitization
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, options = {}) {
  const { skipFields = ['password', 'confirmPassword'] } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (skipFields.includes(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeObject(value, options);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Input sanitization middleware.
 * Sanitizes request body, query, and params to prevent XSS attacks.
 * 
 * @param {Object} [options] - Sanitization options
 * @param {string[]} [options.skipFields] - Fields to skip sanitization (e.g., password)
 * @param {boolean} [options.sanitizeBody] - Sanitize request body
 * @param {boolean} [options.sanitizeQuery] - Sanitize query parameters
 * @param {boolean} [options.sanitizeParams] - Sanitize URL parameters
 * @param {boolean} [options.rejectOnXSS] - Reject request if XSS detected (instead of sanitizing)
 * @returns {Function} Express middleware function
 */
function sanitizeInput(options = {}) {
  const {
    skipFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword'],
    sanitizeBody = true,
    sanitizeQuery = true,
    sanitizeParams = true,
    rejectOnXSS = false
  } = options;

  return (req, res, next) => {
    // Check for XSS in body if rejectOnXSS is enabled
    if (rejectOnXSS && sanitizeBody && req.body) {
      const bodyStr = JSON.stringify(req.body);
      if (containsXSS(bodyStr)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SECURITY_XSS_DETECTED',
            message: {
              en: 'Request contains potentially malicious content',
              tr: 'İstek potansiyel olarak zararlı içerik içeriyor'
            }
          }
        });
      }
    }

    // Sanitize request body
    if (sanitizeBody && req.body) {
      req.body = sanitizeObject(req.body, { skipFields });
    }

    // Sanitize query parameters
    if (sanitizeQuery && req.query) {
      req.query = sanitizeObject(req.query, { skipFields });
    }

    // Sanitize URL parameters
    if (sanitizeParams && req.params) {
      req.params = sanitizeObject(req.params, { skipFields });
    }

    next();
  };
}

/**
 * Request size limiter middleware.
 * Limits the size of incoming request payloads.
 * 
 * @param {Object} [options] - Size limit options
 * @param {number} [options.limit] - Maximum payload size in bytes
 * @returns {Function} Express middleware function
 */
function requestSizeLimit(options = {}) {
  const { limit = 1024 * 1024 } = options; // Default 1MB

  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > limit) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: {
            en: `Request payload exceeds maximum size of ${Math.round(limit / 1024)}KB`,
            tr: `İstek yükü maksimum ${Math.round(limit / 1024)}KB boyutunu aşıyor`
          }
        }
      });
    }

    next();
  };
}

/**
 * Composite security middleware.
 * Combines all security middlewares into a single middleware array.
 * 
 * @param {Object} [options] - Configuration options
 * @returns {Function[]} Array of middleware functions
 */
function createSecurityMiddleware(options = {}) {
  const {
    headers = {},
    cors = {},
    sanitization = {},
    sizeLimit = {}
  } = options;

  return [
    securityHeaders(headers),
    corsMiddleware(cors),
    sanitizeInput(sanitization),
    requestSizeLimit(sizeLimit)
  ];
}

module.exports = {
  // Main middleware factories
  securityHeaders,
  corsMiddleware,
  sanitizeInput,
  requestSizeLimit,
  createSecurityMiddleware,
  
  // Utility functions
  sanitizeString,
  sanitizeObject,
  containsXSS,
  getAllowedOrigins,
  
  // Configuration
  SECURITY_HEADERS,
  DEFAULT_ALLOWED_ORIGINS,
  XSS_PATTERNS
};
