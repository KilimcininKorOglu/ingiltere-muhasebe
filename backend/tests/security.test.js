/**
 * Unit tests for Security Middleware
 * Tests security headers, CORS, input sanitization, and XSS protection.
 * 
 * @module tests/security.test
 */

const {
  securityHeaders,
  corsMiddleware,
  sanitizeInput,
  requestSizeLimit,
  sanitizeString,
  sanitizeObject,
  containsXSS,
  getAllowedOrigins,
  SECURITY_HEADERS,
  DEFAULT_ALLOWED_ORIGINS
} = require('../middleware/security');

// Store original env
const originalEnv = process.env.NODE_ENV;

// Mock request/response helpers
function createMockRequest(options = {}) {
  return {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
    params: options.params || {}
  };
}

function createMockResponse() {
  const headers = {};
  const res = {
    statusCode: 200,
    jsonData: null,
    headers,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    },
    setHeader: function(key, value) {
      this.headers[key] = value;
    },
    end: function() {
      return this;
    }
  };
  return res;
}

// Restore env after tests
afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});

describe('Security Middleware', () => {
  describe('securityHeaders', () => {
    test('should set security headers on response', () => {
      const middleware = securityHeaders();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['X-Frame-Options']).toBe('DENY');
      expect(res.headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(next).toHaveBeenCalled();
    });

    test('should set cache control headers', () => {
      const middleware = securityHeaders();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
      expect(res.headers['Pragma']).toBe('no-cache');
      expect(res.headers['Expires']).toBe('0');
    });

    test('should not set HSTS header in development', () => {
      process.env.NODE_ENV = 'development';
      const middleware = securityHeaders({ hsts: true });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Strict-Transport-Security']).toBeUndefined();
    });

    test('should set HSTS header in production', () => {
      process.env.NODE_ENV = 'production';
      const middleware = securityHeaders({ hsts: true });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
      process.env.NODE_ENV = 'test';
    });

    test('should allow disabling CSP', () => {
      const middleware = securityHeaders({ csp: false });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Content-Security-Policy']).toBeUndefined();
    });

    test('should allow custom headers', () => {
      const middleware = securityHeaders({
        customHeaders: { 'X-Custom-Header': 'custom-value' }
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['X-Custom-Header']).toBe('custom-value');
    });
  });

  describe('corsMiddleware', () => {
    test('should set CORS headers for allowed origin', () => {
      const middleware = corsMiddleware({
        origin: ['http://localhost:3000']
      });
      const req = createMockRequest({
        headers: { origin: 'http://localhost:3000' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
      expect(res.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(res.headers['Access-Control-Allow-Headers']).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test('should not set origin header for disallowed origin', () => {
      const middleware = corsMiddleware({
        origin: ['http://localhost:3000']
      });
      const req = createMockRequest({
        headers: { origin: 'http://malicious.com' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    test('should handle preflight OPTIONS requests', () => {
      const middleware = corsMiddleware({
        origin: ['http://localhost:3000']
      });
      const req = createMockRequest({
        method: 'OPTIONS',
        headers: { origin: 'http://localhost:3000' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(204);
      expect(next).not.toHaveBeenCalled();
    });

    test('should expose rate limit headers', () => {
      const middleware = corsMiddleware();
      const req = createMockRequest({
        headers: { origin: 'http://localhost:3000' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      const exposedHeaders = res.headers['Access-Control-Expose-Headers'];
      expect(exposedHeaders).toContain('X-RateLimit-Limit');
      expect(exposedHeaders).toContain('X-RateLimit-Remaining');
      expect(exposedHeaders).toContain('X-RateLimit-Reset');
    });

    test('should allow wildcard origin', () => {
      const middleware = corsMiddleware({ origin: '*' });
      const req = createMockRequest({
        headers: { origin: 'http://any-origin.com' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('sanitizeInput', () => {
    test('should sanitize XSS in body', () => {
      const middleware = sanitizeInput();
      const req = createMockRequest({
        body: {
          name: '<script>alert("xss")</script>',
          email: 'test@example.com'
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.body.name).not.toContain('<script>');
      expect(req.body.name).toContain('&lt;script&gt;');
      expect(req.body.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should skip password fields by default', () => {
      const middleware = sanitizeInput();
      const req = createMockRequest({
        body: {
          password: '<script>test</script>',
          confirmPassword: '<script>test</script>'
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.body.password).toBe('<script>test</script>');
      expect(req.body.confirmPassword).toBe('<script>test</script>');
    });

    test('should sanitize query parameters', () => {
      const middleware = sanitizeInput();
      const req = createMockRequest({
        query: {
          search: '<img onerror="alert(1)">'
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      // The string is escaped, not removed - the word 'onerror' may still be present
      // but the actual HTML is escaped so it's safe
      expect(req.query.search).toContain('&lt;');
      expect(req.query.search).toContain('&gt;');
    });

    test('should sanitize URL parameters', () => {
      const middleware = sanitizeInput();
      const req = createMockRequest({
        params: {
          id: '<script>bad</script>'
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.params.id).not.toContain('<script>');
    });

    test('should reject request when rejectOnXSS is true', () => {
      const middleware = sanitizeInput({ rejectOnXSS: true });
      const req = createMockRequest({
        body: { name: '<script>alert(1)</script>' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error.code).toBe('SECURITY_XSS_DETECTED');
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle nested objects', () => {
      const middleware = sanitizeInput();
      const req = createMockRequest({
        body: {
          user: {
            profile: {
              bio: '<script>evil</script>'
            }
          }
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.body.user.profile.bio).not.toContain('<script>');
    });

    test('should handle arrays', () => {
      const middleware = sanitizeInput();
      const req = createMockRequest({
        body: {
          tags: ['<script>a</script>', 'normal', '<script>b</script>']
        }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.body.tags[0]).not.toContain('<script>');
      expect(req.body.tags[1]).toBe('normal');
      expect(req.body.tags[2]).not.toContain('<script>');
    });
  });

  describe('requestSizeLimit', () => {
    test('should allow requests within size limit', () => {
      const middleware = requestSizeLimit({ limit: 1024 * 1024 });
      const req = createMockRequest({
        headers: { 'content-length': '1000' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject requests exceeding size limit', () => {
      const middleware = requestSizeLimit({ limit: 1000 });
      const req = createMockRequest({
        headers: { 'content-length': '2000' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(413);
      expect(res.jsonData.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow requests without content-length', () => {
      const middleware = requestSizeLimit({ limit: 1000 });
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    describe('sanitizeString', () => {
      test('should escape HTML entities', () => {
        const input = '<script>alert("xss")</script>';
        const result = sanitizeString(input);
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
      });

      test('should handle non-string input', () => {
        expect(sanitizeString(123)).toBe(123);
        expect(sanitizeString(null)).toBe(null);
        expect(sanitizeString(undefined)).toBe(undefined);
      });
    });

    describe('sanitizeObject', () => {
      test('should recursively sanitize object values', () => {
        const obj = {
          a: '<script>1</script>',
          b: {
            c: '<script>2</script>'
          }
        };
        const result = sanitizeObject(obj);
        expect(result.a).not.toContain('<script>');
        expect(result.b.c).not.toContain('<script>');
      });

      test('should skip specified fields', () => {
        const obj = {
          password: '<script>secret</script>',
          name: '<script>test</script>'
        };
        const result = sanitizeObject(obj, { skipFields: ['password'] });
        expect(result.password).toBe('<script>secret</script>');
        expect(result.name).not.toContain('<script>');
      });
    });

    describe('containsXSS', () => {
      test('should detect script tags', () => {
        expect(containsXSS('<script>alert(1)</script>')).toBe(true);
      });

      test('should detect javascript: protocol', () => {
        expect(containsXSS('javascript:alert(1)')).toBe(true);
      });

      test('should detect event handlers', () => {
        expect(containsXSS('onclick=alert(1)')).toBe(true);
        expect(containsXSS('onerror = alert(1)')).toBe(true);
      });

      test('should detect data: protocol', () => {
        expect(containsXSS('data:text/html')).toBe(true);
      });

      test('should not flag normal text', () => {
        expect(containsXSS('Hello world')).toBe(false);
        expect(containsXSS('user@example.com')).toBe(false);
      });

      test('should handle non-string input', () => {
        expect(containsXSS(123)).toBe(false);
        expect(containsXSS(null)).toBe(false);
      });
    });

    describe('getAllowedOrigins', () => {
      test('should return default origins when env not set', () => {
        delete process.env.ALLOWED_ORIGINS;
        const origins = getAllowedOrigins();
        expect(origins).toEqual(DEFAULT_ALLOWED_ORIGINS);
      });

      test('should parse ALLOWED_ORIGINS from env', () => {
        process.env.ALLOWED_ORIGINS = 'http://app.example.com, http://api.example.com';
        const origins = getAllowedOrigins();
        expect(origins).toContain('http://app.example.com');
        expect(origins).toContain('http://api.example.com');
        delete process.env.ALLOWED_ORIGINS;
      });
    });
  });

  describe('Constants', () => {
    test('SECURITY_HEADERS should have expected values', () => {
      expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
      expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
      expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block');
    });

    test('DEFAULT_ALLOWED_ORIGINS should include localhost ports', () => {
      expect(DEFAULT_ALLOWED_ORIGINS).toContain('http://localhost:3000');
      expect(DEFAULT_ALLOWED_ORIGINS).toContain('http://localhost:5173');
    });
  });
});
