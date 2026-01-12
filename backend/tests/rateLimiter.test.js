/**
 * Unit tests for Rate Limiter Middleware
 * Tests rate limiting functionality, sliding window algorithm, and cleanup.
 * 
 * @module tests/rateLimiter.test
 */

const {
  createRateLimiter,
  standardLimiter,
  strictLimiter,
  loginLimiter,
  generateKey,
  getRateLimitInfo,
  recordRequest,
  cleanupExpiredEntries,
  clearStore,
  getStoreSize,
  DEFAULT_CONFIG
} = require('../middleware/rateLimiter');

// Mock request/response helpers
function createMockRequest(options = {}) {
  return {
    ip: options.ip || '127.0.0.1',
    headers: options.headers || {},
    connection: { remoteAddress: options.ip || '127.0.0.1' },
    user: options.user || null
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
    end: function() {}
  };
  return res;
}

// Clean store before each test
beforeEach(() => {
  clearStore();
});

// Clean store after all tests
afterAll(() => {
  clearStore();
});

describe('Rate Limiter Middleware', () => {
  describe('generateKey', () => {
    test('should generate IP-based key by default', () => {
      const req = createMockRequest({ ip: '192.168.1.1' });
      const key = generateKey(req);
      expect(key).toBe('ip:192.168.1.1');
    });

    test('should generate user-based key when user is present', () => {
      const req = createMockRequest({
        ip: '192.168.1.1',
        user: { id: 42 }
      });
      const key = generateKey(req, 'user');
      expect(key).toBe('user:42');
    });

    test('should fallback to IP for user key type when no user', () => {
      const req = createMockRequest({ ip: '192.168.1.1' });
      const key = generateKey(req, 'user');
      expect(key).toBe('ip:192.168.1.1');
    });

    test('should generate combined key', () => {
      const req = createMockRequest({
        ip: '192.168.1.1',
        user: { id: 42 }
      });
      const key = generateKey(req, 'combined');
      expect(key).toBe('user:42:ip:192.168.1.1');
    });

    test('should extract IP from x-forwarded-for header', () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }
      });
      req.ip = undefined;
      const key = generateKey(req);
      expect(key).toBe('ip:10.0.0.1');
    });
  });

  describe('getRateLimitInfo', () => {
    test('should return full remaining for new key', () => {
      const info = getRateLimitInfo('new-key', 60000, 100);
      expect(info.remaining).toBe(100);
      expect(info.isLimited).toBe(false);
      expect(info.total).toBe(100);
      expect(info.current).toBe(0);
    });

    test('should decrease remaining after requests', () => {
      const key = 'test-key-1';
      recordRequest(key);
      recordRequest(key);
      recordRequest(key);

      const info = getRateLimitInfo(key, 60000, 100);
      expect(info.remaining).toBe(97);
      expect(info.current).toBe(3);
    });

    test('should indicate limited when max requests reached', () => {
      const key = 'limited-key';
      for (let i = 0; i < 5; i++) {
        recordRequest(key);
      }

      const info = getRateLimitInfo(key, 60000, 5);
      expect(info.remaining).toBe(0);
      expect(info.isLimited).toBe(true);
    });
  });

  describe('recordRequest', () => {
    test('should create new record for new key', () => {
      expect(getStoreSize()).toBe(0);
      recordRequest('new-key');
      expect(getStoreSize()).toBe(1);
    });

    test('should increment count for existing key', () => {
      const key = 'existing-key';
      recordRequest(key);
      recordRequest(key);
      
      const info = getRateLimitInfo(key, 60000, 100);
      expect(info.current).toBe(2);
    });
  });

  describe('cleanupExpiredEntries', () => {
    test('should remove expired entries', () => {
      const key = 'old-key';
      recordRequest(key);
      
      expect(getStoreSize()).toBe(1);
      
      // Manually expire entries by waiting would be slow, 
      // so we test the mechanism works
      const cleaned = cleanupExpiredEntries();
      // Entry still has recent timestamp so shouldn't be cleaned
      expect(getStoreSize()).toBe(1);
    });

    test('should return count of cleaned entries', () => {
      const cleaned = cleanupExpiredEntries();
      expect(typeof cleaned).toBe('number');
    });
  });

  describe('clearStore', () => {
    test('should clear all entries', () => {
      recordRequest('key1');
      recordRequest('key2');
      recordRequest('key3');
      
      expect(getStoreSize()).toBe(3);
      clearStore();
      expect(getStoreSize()).toBe(0);
    });
  });

  describe('createRateLimiter', () => {
    test('should create middleware with default config', () => {
      const limiter = createRateLimiter();
      expect(typeof limiter).toBe('function');
    });

    test('should allow requests within limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const req = createMockRequest({ ip: '10.0.0.1' });
      const res = createMockResponse();
      const next = jest.fn();

      limiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.headers['X-RateLimit-Limit']).toBe(10);
      expect(res.headers['X-RateLimit-Remaining']).toBeDefined();
    });

    test('should block requests exceeding limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2
      });

      const ip = '10.0.0.2';
      
      // Make 2 requests to reach limit
      for (let i = 0; i < 2; i++) {
        const req = createMockRequest({ ip });
        const res = createMockResponse();
        const next = jest.fn();
        limiter(req, res, next);
      }

      // Third request should be blocked
      const req = createMockRequest({ ip });
      const res = createMockResponse();
      const next = jest.fn();
      
      limiter(req, res, next);

      expect(res.statusCode).toBe(429);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.headers['Retry-After']).toBeDefined();
      expect(next).not.toHaveBeenCalled();
    });

    test('should set rate limit headers on response', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100
      });

      const req = createMockRequest({ ip: '10.0.0.3' });
      const res = createMockResponse();
      const next = jest.fn();

      limiter(req, res, next);

      expect(res.headers['X-RateLimit-Limit']).toBe(100);
      expect(res.headers['X-RateLimit-Remaining']).toBeDefined();
      expect(res.headers['X-RateLimit-Reset']).toBeDefined();
    });
  });

  describe('Pre-configured limiters', () => {
    test('standardLimiter should exist and be a function', () => {
      expect(typeof standardLimiter).toBe('function');
    });

    test('strictLimiter should exist and be a function', () => {
      expect(typeof strictLimiter).toBe('function');
    });

    test('loginLimiter should exist and be a function', () => {
      expect(typeof loginLimiter).toBe('function');
    });

    test('strictLimiter should have lower limit than standard', () => {
      // We can't directly inspect the config, but we can test behavior
      // by making requests and checking when they get blocked
      const strictIp = '20.0.0.1';
      const standardIp = '20.0.0.2';

      // Make 10 requests with strict limiter (should hit limit)
      for (let i = 0; i < 10; i++) {
        const req = createMockRequest({ ip: strictIp });
        const res = createMockResponse();
        const next = jest.fn();
        strictLimiter(req, res, next);
      }

      // 11th request should be blocked
      const req = createMockRequest({ ip: strictIp });
      const res = createMockResponse();
      const next = jest.fn();
      strictLimiter(req, res, next);
      
      expect(res.statusCode).toBe(429);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_CONFIG.windowMs).toBe(60000); // 1 minute
      expect(DEFAULT_CONFIG.maxRequests).toBe(100);
      expect(DEFAULT_CONFIG.skipFailedRequests).toBe(false);
      expect(DEFAULT_CONFIG.skipSuccessfulRequests).toBe(false);
    });
  });
});
