/**
 * Unit tests for Authentication Middleware
 * Tests token validation, blacklist checking, and role-based authorization.
 * 
 * @module tests/auth.middleware.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-auth-middleware-database.sqlite');

/**
 * Setup test database before all tests.
 */
beforeAll(() => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  
  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
});

/**
 * Clean up test database after all tests.
 */
afterAll(() => {
  try {
    closeDatabase();
    // Remove test database file
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Also remove WAL files if they exist
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch (error) {
    console.error('Error cleaning up test database:', error.message);
  }
});

/**
 * Clean up users table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM users;');
  // Clear token blacklist
  const { clearBlacklist } = require('../utils/tokenBlacklist');
  clearBlacklist();
});

// Import modules for testing
const { requireAuth, optionalAuth, requireRole, extractToken } = require('../middleware/auth');
const { generateToken } = require('../utils/jwt');
const { addToBlacklist, clearBlacklist } = require('../utils/tokenBlacklist');
const { createUser } = require('../database/models/User');

// Mock request/response helpers
function createMockRequest(options = {}) {
  return {
    headers: options.headers || {},
    user: options.user || null,
    token: options.token || null
  };
}

function createMockResponse() {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
}

describe('Auth Middleware', () => {
  describe('extractToken', () => {
    test('should extract token without Bearer prefix', () => {
      const token = 'some.jwt.token';
      expect(extractToken(token)).toBe(token);
    });

    test('should extract token with Bearer prefix', () => {
      const token = 'some.jwt.token';
      expect(extractToken(`Bearer ${token}`)).toBe(token);
    });

    test('should return null for null input', () => {
      expect(extractToken(null)).toBe(null);
    });

    test('should return null for undefined input', () => {
      expect(extractToken(undefined)).toBe(null);
    });
  });

  describe('requireAuth', () => {
    test('should reject request without authorization header', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_MISSING');
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid.token.here' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_INVALID');
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with blacklisted token', async () => {
      // Create a user first
      const result = await createUser({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'Test User'
      });
      expect(result.success).toBe(true);

      const token = generateToken(result.data);
      
      // Blacklist the token
      addToBlacklist(token);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_INVALID');
      expect(next).not.toHaveBeenCalled();
    });

    test('should accept request with valid token and attach user', async () => {
      // Create a user first
      const result = await createUser({
        email: 'valid@example.com',
        password: 'ValidPass123',
        name: 'Valid User'
      });
      expect(result.success).toBe(true);

      const token = generateToken(result.data);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe('valid@example.com');
      expect(req.token).toBe(token);
    });

    test('should reject request when user not found in database', () => {
      // Generate token for non-existent user
      const token = generateToken({ id: 99999, email: 'noone@example.com' });

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error.code).toBe('RES_USER_NOT_FOUND');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    test('should continue without user if no token provided', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    test('should continue without user if token is blacklisted', async () => {
      const result = await createUser({
        email: 'optional@example.com',
        password: 'ValidPass123',
        name: 'Optional User'
      });
      const token = generateToken(result.data);
      addToBlacklist(token);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    test('should attach user if valid token provided', async () => {
      const result = await createUser({
        email: 'optional2@example.com',
        password: 'ValidPass123',
        name: 'Optional User 2'
      });
      const token = generateToken(result.data);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe('optional2@example.com');
      expect(req.token).toBe(token);
    });

    test('should continue without user if token is invalid', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid.token' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });
  });

  describe('requireRole', () => {
    test('should reject request without user', () => {
      const middleware = requireRole('admin');
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_MISSING');
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with wrong role', () => {
      const middleware = requireRole('admin');
      const req = createMockRequest({
        user: { id: 1, email: 'user@example.com', role: 'user' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData.error.code).toBe('AUTHZ_INSUFFICIENT_PERMISSIONS');
      expect(next).not.toHaveBeenCalled();
    });

    test('should accept request with correct role', () => {
      const middleware = requireRole('admin');
      const req = createMockRequest({
        user: { id: 1, email: 'admin@example.com', role: 'admin' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should accept request with any of multiple allowed roles', () => {
      const middleware = requireRole(['admin', 'manager']);
      const req = createMockRequest({
        user: { id: 1, email: 'manager@example.com', role: 'manager' }
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should default to user role if not specified', () => {
      const middleware = requireRole('user');
      const req = createMockRequest({
        user: { id: 1, email: 'default@example.com' } // No role specified
      });
      const res = createMockResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
