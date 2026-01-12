/**
 * Unit tests for Auth API endpoints.
 * Tests registration, login, and authentication functionality.
 * 
 * @module tests/auth.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const app = require('../app');

// Mock http request/response for testing
function createMockRequest(body = {}, query = {}, headers = {}) {
  return {
    body,
    query,
    headers
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

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-auth-database.sqlite');

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
});

// Import modules for unit testing
const { register, login, logout } = require('../controllers/authController');
const { validateRegistration, validateLogin, sanitizeRegistration } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { hashPassword, comparePassword, validatePassword } = require('../utils/password');
const { generateToken, verifyToken, decodeToken } = require('../utils/jwt');
const { 
  addToBlacklist, 
  isBlacklisted, 
  removeFromBlacklist, 
  clearBlacklist, 
  getBlacklistSize,
  cleanupExpiredTokens 
} = require('../utils/tokenBlacklist');

describe('Auth API', () => {
  describe('Password Utility', () => {
    test('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    test('should compare password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject wrong password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await comparePassword('WrongPassword123', hash);
      expect(isValid).toBe(false);
    });

    test('should validate password with all requirements', () => {
      const result = validatePassword('ValidPass123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject password without uppercase', () => {
      const result = validatePassword('validpass123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    test('should reject password without lowercase', () => {
      const result = validatePassword('VALIDPASS123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    test('should reject password without number', () => {
      const result = validatePassword('ValidPassword');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    test('should reject short password', () => {
      const result = validatePassword('Val1');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('8 characters'))).toBe(true);
    });
  });

  describe('JWT Utility', () => {
    const testUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User'
    };

    test('should generate valid token', () => {
      const token = generateToken(testUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    test('should verify valid token', () => {
      const token = generateToken(testUser);
      const result = verifyToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload.userId).toBe(testUser.id);
      expect(result.payload.email).toBe(testUser.email);
    });

    test('should reject invalid token', () => {
      const result = verifyToken('invalid.token.here');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should decode token without verification', () => {
      const token = generateToken(testUser);
      const decoded = decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUser.id);
    });

    test('should handle Bearer prefix', () => {
      const token = generateToken(testUser);
      const result = verifyToken(`Bearer ${token}`);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Registration Validation', () => {
    test('should validate valid registration data', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should reject missing email', () => {
      const req = createMockRequest({
        password: 'ValidPass123',
        name: 'John Doe'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.details.some(e => e.field === 'email')).toBe(true);
    });

    test('should reject invalid email format', () => {
      const req = createMockRequest({
        email: 'invalid-email',
        password: 'ValidPass123',
        name: 'John Doe'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error.details.some(e => e.field === 'email')).toBe(true);
    });

    test('should reject missing password', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        name: 'John Doe'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.jsonData.error.details.some(e => e.field === 'password')).toBe(true);
    });

    test('should reject weak password', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'weak',
        name: 'John Doe'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.jsonData.error.details.some(e => e.field === 'password')).toBe(true);
    });

    test('should reject missing name', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.jsonData.error.details.some(e => e.field === 'name')).toBe(true);
    });

    test('should reject invalid VAT number format', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe',
        vatNumber: '12345'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.jsonData.error.details.some(e => e.field === 'vatNumber')).toBe(true);
    });

    test('should accept valid VAT number', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe',
        vatNumber: 'GB123456789'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should reject invalid company number format', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe',
        companyNumber: '1234'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.jsonData.error.details.some(e => e.field === 'companyNumber')).toBe(true);
    });

    test('should accept valid company number', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe',
        companyNumber: '12345678'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateRegistration(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Registration Controller', () => {
    test('should register user successfully', async () => {
      const req = createMockRequest({
        email: 'newuser@example.com',
        password: 'ValidPass123',
        name: 'New User'
      });
      const res = createMockResponse();
      
      await register(req, res);
      
      expect(res.statusCode).toBe(201);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.user).toBeDefined();
      expect(res.jsonData.data.user.email).toBe('newuser@example.com');
      expect(res.jsonData.data.user.name).toBe('New User');
      expect(res.jsonData.data.token).toBeDefined();
      // Password should not be exposed
      expect(res.jsonData.data.user.passwordHash).toBeUndefined();
      expect(res.jsonData.data.user.password).toBeUndefined();
    });

    test('should register user with business information', async () => {
      const req = createMockRequest({
        email: 'business@example.com',
        password: 'ValidPass123',
        name: 'Business User',
        businessName: 'Test Business Ltd',
        businessAddress: '123 Test Street, London',
        vatNumber: 'GB123456789',
        isVatRegistered: true,
        companyNumber: '12345678'
      });
      const res = createMockResponse();
      
      await register(req, res);
      
      expect(res.statusCode).toBe(201);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.user.businessName).toBe('Test Business Ltd');
      expect(res.jsonData.data.user.vatNumber).toBe('GB123456789');
      expect(res.jsonData.data.user.isVatRegistered).toBe(true);
    });

    test('should return 409 for duplicate email', async () => {
      // First registration
      const req1 = createMockRequest({
        email: 'duplicate@example.com',
        password: 'ValidPass123',
        name: 'First User'
      });
      const res1 = createMockResponse();
      await register(req1, res1);
      expect(res1.statusCode).toBe(201);
      
      // Second registration with same email
      const req2 = createMockRequest({
        email: 'duplicate@example.com',
        password: 'AnotherPass123',
        name: 'Second User'
      });
      const res2 = createMockResponse();
      await register(req2, res2);
      
      expect(res2.statusCode).toBe(409);
      expect(res2.jsonData.success).toBe(false);
      expect(res2.jsonData.error.code).toBe('RES_EMAIL_ALREADY_REGISTERED');
    });

    test('should return valid JWT token on registration', async () => {
      const req = createMockRequest({
        email: 'tokentest@example.com',
        password: 'ValidPass123',
        name: 'Token Test User'
      });
      const res = createMockResponse();
      
      await register(req, res);
      
      expect(res.statusCode).toBe(201);
      const token = res.jsonData.data.token;
      expect(token).toBeDefined();
      
      // Verify the token is valid
      const verified = verifyToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.payload.email).toBe('tokentest@example.com');
    });

    test('should normalize email to lowercase', async () => {
      const req = createMockRequest({
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'ValidPass123',
        name: 'Uppercase User'
      });
      const res = createMockResponse();
      
      // Simulate sanitization
      req.body.email = req.body.email.toLowerCase().trim();
      
      await register(req, res);
      
      expect(res.statusCode).toBe(201);
      expect(res.jsonData.data.user.email).toBe('uppercase@example.com');
    });
  });

  describe('Login Controller', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const req = createMockRequest({
        email: 'login@example.com',
        password: 'ValidPass123',
        name: 'Login User'
      });
      const res = createMockResponse();
      await register(req, res);
    });

    test('should login successfully with valid credentials', async () => {
      const req = createMockRequest({
        email: 'login@example.com',
        password: 'ValidPass123'
      });
      const res = createMockResponse();
      
      await login(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.user).toBeDefined();
      expect(res.jsonData.data.token).toBeDefined();
    });

    test('should reject login with wrong password', async () => {
      const req = createMockRequest({
        email: 'login@example.com',
        password: 'WrongPass123'
      });
      const res = createMockResponse();
      
      await login(req, res);
      
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    test('should reject login with non-existent email', async () => {
      const req = createMockRequest({
        email: 'nonexistent@example.com',
        password: 'ValidPass123'
      });
      const res = createMockResponse();
      
      await login(req, res);
      
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('Login Validation', () => {
    test('should validate valid login data', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'anypassword'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateLogin(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should reject missing email on login', () => {
      const req = createMockRequest({
        password: 'anypassword'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateLogin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });

    test('should reject missing password on login', () => {
      const req = createMockRequest({
        email: 'test@example.com'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      validateLogin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Sanitization Middleware', () => {
    test('should sanitize email to lowercase', () => {
      const req = createMockRequest({
        email: '  TEST@EXAMPLE.COM  ',
        password: 'ValidPass123',
        name: '  John Doe  '
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      sanitizeRegistration(req, res, next);
      
      expect(req.body.email).toBe('test@example.com');
      expect(req.body.name).toBe('John Doe');
      expect(next).toHaveBeenCalled();
    });

    test('should normalize VAT number', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe',
        vatNumber: 'gb 123 456 789'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      sanitizeRegistration(req, res, next);
      
      expect(req.body.vatNumber).toBe('GB123456789');
    });

    test('should normalize company number', () => {
      const req = createMockRequest({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'John Doe',
        companyNumber: 'sc 12 34 56'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      sanitizeRegistration(req, res, next);
      
      expect(req.body.companyNumber).toBe('SC123456');
    });
  });

  describe('Token Blacklist Utility', () => {
    beforeEach(() => {
      clearBlacklist();
    });

    afterEach(() => {
      clearBlacklist();
    });

    test('should add token to blacklist', () => {
      const token = generateToken({ id: 1, email: 'test@example.com' });
      
      const result = addToBlacklist(token);
      
      expect(result).toBe(true);
      expect(isBlacklisted(token)).toBe(true);
    });

    test('should handle Bearer prefix when adding to blacklist', () => {
      const token = generateToken({ id: 1, email: 'test@example.com' });
      
      addToBlacklist(`Bearer ${token}`);
      
      expect(isBlacklisted(token)).toBe(true);
      expect(isBlacklisted(`Bearer ${token}`)).toBe(true);
    });

    test('should return false for non-blacklisted token', () => {
      const token = generateToken({ id: 1, email: 'test@example.com' });
      
      expect(isBlacklisted(token)).toBe(false);
    });

    test('should remove token from blacklist', () => {
      const token = generateToken({ id: 1, email: 'test@example.com' });
      addToBlacklist(token);
      
      expect(isBlacklisted(token)).toBe(true);
      
      const removed = removeFromBlacklist(token);
      
      expect(removed).toBe(true);
      expect(isBlacklisted(token)).toBe(false);
    });

    test('should clear all tokens from blacklist', () => {
      const token1 = generateToken({ id: 1, email: 'test1@example.com' });
      const token2 = generateToken({ id: 2, email: 'test2@example.com' });
      
      addToBlacklist(token1);
      addToBlacklist(token2);
      
      expect(getBlacklistSize()).toBe(2);
      
      clearBlacklist();
      
      expect(getBlacklistSize()).toBe(0);
      expect(isBlacklisted(token1)).toBe(false);
      expect(isBlacklisted(token2)).toBe(false);
    });

    test('should return false when adding null token', () => {
      expect(addToBlacklist(null)).toBe(false);
      expect(addToBlacklist(undefined)).toBe(false);
      expect(addToBlacklist('')).toBe(false);
    });

    test('should return false when checking null token', () => {
      expect(isBlacklisted(null)).toBe(false);
      expect(isBlacklisted(undefined)).toBe(false);
      expect(isBlacklisted('')).toBe(false);
    });

    test('should return correct blacklist size', () => {
      expect(getBlacklistSize()).toBe(0);
      
      const token = generateToken({ id: 1, email: 'test@example.com' });
      addToBlacklist(token);
      
      expect(getBlacklistSize()).toBe(1);
    });
  });

  describe('Auth Middleware', () => {
    beforeEach(() => {
      clearBlacklist();
    });

    afterEach(() => {
      clearBlacklist();
    });

    test('should reject request without token', async () => {
      const req = createMockRequest({}, {}, {});
      const res = createMockResponse();
      const next = jest.fn();
      
      await authenticate(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    test('should reject request with invalid token', async () => {
      const req = createMockRequest({}, {}, {
        authorization: 'Bearer invalid.token.here'
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      await authenticate(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should reject request with blacklisted token', async () => {
      // First register a user
      const regReq = createMockRequest({
        email: 'middleware@example.com',
        password: 'ValidPass123',
        name: 'Middleware User'
      });
      const regRes = createMockResponse();
      await register(regReq, regRes);
      
      const token = regRes.jsonData.data.token;
      
      // Blacklist the token
      addToBlacklist(token);
      
      const req = createMockRequest({}, {}, {
        authorization: `Bearer ${token}`
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      await authenticate(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should authenticate valid token and attach user', async () => {
      // First register a user
      const regReq = createMockRequest({
        email: 'valid@example.com',
        password: 'ValidPass123',
        name: 'Valid User'
      });
      const regRes = createMockResponse();
      await register(regReq, regRes);
      
      const token = regRes.jsonData.data.token;
      
      const req = createMockRequest({}, {}, {
        authorization: `Bearer ${token}`
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      await authenticate(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe('valid@example.com');
      expect(req.token).toBe(token);
      // Password hash should not be exposed
      expect(req.user.passwordHash).toBeUndefined();
    });
  });

  describe('Logout Controller', () => {
    beforeEach(() => {
      clearBlacklist();
    });

    afterEach(() => {
      clearBlacklist();
    });

    test('should logout successfully and blacklist token', async () => {
      // First register a user
      const regReq = createMockRequest({
        email: 'logout@example.com',
        password: 'ValidPass123',
        name: 'Logout User'
      });
      const regRes = createMockResponse();
      await register(regReq, regRes);
      
      const token = regRes.jsonData.data.token;
      
      // Create logout request with token attached (simulating auth middleware)
      const req = createMockRequest({}, {}, {});
      req.token = token;
      req.user = regRes.jsonData.data.user;
      
      const res = createMockResponse();
      
      await logout(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.message).toBeDefined();
      expect(res.jsonData.data.message.en).toBe('Successfully logged out');
      expect(res.jsonData.data.message.tr).toBe('Başarıyla çıkış yapıldı');
      
      // Token should now be blacklisted
      expect(isBlacklisted(token)).toBe(true);
    });

    test('should reject logout without token', async () => {
      const req = createMockRequest({}, {}, {});
      // No token attached
      const res = createMockResponse();
      
      await logout(req, res);
      
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    test('should prevent token reuse after logout', async () => {
      // Register a user
      const regReq = createMockRequest({
        email: 'reuse@example.com',
        password: 'ValidPass123',
        name: 'Reuse Test User'
      });
      const regRes = createMockResponse();
      await register(regReq, regRes);
      
      const token = regRes.jsonData.data.token;
      
      // Logout
      const logoutReq = createMockRequest({}, {}, {});
      logoutReq.token = token;
      logoutReq.user = regRes.jsonData.data.user;
      const logoutRes = createMockResponse();
      await logout(logoutReq, logoutRes);
      
      expect(logoutRes.statusCode).toBe(200);
      
      // Try to authenticate with the same token
      const authReq = createMockRequest({}, {}, {
        authorization: `Bearer ${token}`
      });
      const authRes = createMockResponse();
      const next = jest.fn();
      
      await authenticate(authReq, authRes, next);
      
      // Should be rejected because token is blacklisted
      expect(next).not.toHaveBeenCalled();
      expect(authRes.statusCode).toBe(401);
    });
  });

  describe('Full Login-Logout Flow', () => {
    beforeEach(() => {
      clearBlacklist();
    });

    afterEach(() => {
      clearBlacklist();
    });

    test('should complete full login and logout flow', async () => {
      // 1. Register a user
      const regReq = createMockRequest({
        email: 'fullflow@example.com',
        password: 'ValidPass123',
        name: 'Full Flow User'
      });
      const regRes = createMockResponse();
      await register(regReq, regRes);
      
      expect(regRes.statusCode).toBe(201);
      expect(regRes.jsonData.data.token).toBeDefined();
      
      // 2. Login with the user
      const loginReq = createMockRequest({
        email: 'fullflow@example.com',
        password: 'ValidPass123'
      });
      const loginRes = createMockResponse();
      await login(loginReq, loginRes);
      
      expect(loginRes.statusCode).toBe(200);
      const token = loginRes.jsonData.data.token;
      expect(token).toBeDefined();
      
      // 3. Verify token works with auth middleware
      const authReq = createMockRequest({}, {}, {
        authorization: `Bearer ${token}`
      });
      const authRes = createMockResponse();
      const next = jest.fn();
      await authenticate(authReq, authRes, next);
      
      expect(next).toHaveBeenCalled();
      expect(authReq.user).toBeDefined();
      
      // 4. Logout
      const logoutReq = createMockRequest({}, {}, {});
      logoutReq.token = token;
      logoutReq.user = loginRes.jsonData.data.user;
      const logoutRes = createMockResponse();
      await logout(logoutReq, logoutRes);
      
      expect(logoutRes.statusCode).toBe(200);
      
      // 5. Token should no longer work
      const authReq2 = createMockRequest({}, {}, {
        authorization: `Bearer ${token}`
      });
      const authRes2 = createMockResponse();
      const next2 = jest.fn();
      await authenticate(authReq2, authRes2, next2);
      
      expect(next2).not.toHaveBeenCalled();
      expect(authRes2.statusCode).toBe(401);
    });
  });
});
