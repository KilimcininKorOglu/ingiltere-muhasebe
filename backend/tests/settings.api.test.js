/**
 * Unit tests for VAT Settings API endpoints.
 * Tests GET /api/settings/vat, PUT /api/settings/vat, and GET /api/settings/vat/schemes functionality.
 * 
 * @module tests/settings.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const { generateToken } = require('../utils/jwt');
const { createUser, findById } = require('../database/models/User');
const app = require('../app');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-settings-api-database.sqlite');

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

describe('VAT Settings API', () => {
  describe('GET /api/settings/vat', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/settings/vat')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should return 401 when an invalid token is provided', async () => {
      const response = await request(app)
        .get('/api/settings/vat')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('should return VAT settings when authenticated', async () => {
      // Create a test user
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123',
        name: 'Test User',
        isVatRegistered: true,
        vatNumber: 'GB123456789',
        vatScheme: 'standard'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .get('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings).toBeDefined();
      expect(response.body.data.vatSettings.isVatRegistered).toBe(true);
      expect(response.body.data.vatSettings.vatNumber).toBe('GB123456789');
      expect(response.body.data.vatSettings.vatScheme).toBe('standard');
      expect(response.body.meta.validSchemes).toBeDefined();
      expect(response.body.meta.validSchemes).toContain('standard');
    });

    it('should return default VAT scheme when not set', async () => {
      // Create a test user without explicit vatScheme
      const userData = {
        email: 'default@example.com',
        password: 'TestPass123',
        name: 'Default User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .get('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.isVatRegistered).toBe(false);
      expect(response.body.data.vatSettings.vatNumber).toBe(null);
      expect(response.body.data.vatSettings.vatScheme).toBe('standard');
    });
  });

  describe('PUT /api/settings/vat', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .put('/api/settings/vat')
        .send({ vatScheme: 'flat_rate' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should update VAT registration status successfully', async () => {
      // Create a test user
      const userData = {
        email: 'vat@example.com',
        password: 'TestPass123',
        name: 'VAT User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          isVatRegistered: true,
          vatNumber: 'GB987654321'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.isVatRegistered).toBe(true);
      expect(response.body.data.vatSettings.vatNumber).toBe('GB987654321');
    });

    it('should update VAT scheme successfully', async () => {
      // Create a test user
      const userData = {
        email: 'scheme@example.com',
        password: 'TestPass123',
        name: 'Scheme User',
        vatScheme: 'standard'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatScheme: 'flat_rate'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.vatScheme).toBe('flat_rate');
      
      // Verify the change persisted
      const updatedUser = findById(result.data.id);
      expect(updatedUser.vatScheme).toBe('flat_rate');
    });

    it('should reject invalid VAT scheme', async () => {
      // Create a test user
      const userData = {
        email: 'invalid-scheme@example.com',
        password: 'TestPass123',
        name: 'Invalid Scheme User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatScheme: 'invalid_scheme'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'vatScheme')).toBe(true);
    });

    it('should reject invalid VAT number format', async () => {
      // Create a test user
      const userData = {
        email: 'invalid-vat@example.com',
        password: 'TestPass123',
        name: 'Invalid VAT User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'INVALID123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'vatNumber')).toBe(true);
    });

    it('should return validation error for empty request body', async () => {
      // Create a test user
      const userData = {
        email: 'empty@example.com',
        password: 'TestPass123',
        name: 'Empty User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should update all VAT settings at once', async () => {
      // Create a test user
      const userData = {
        email: 'multi@example.com',
        password: 'TestPass123',
        name: 'Multi User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          isVatRegistered: true,
          vatNumber: 'GB111222333',
          vatScheme: 'cash'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      const vatSettings = response.body.data.vatSettings;
      expect(vatSettings.isVatRegistered).toBe(true);
      expect(vatSettings.vatNumber).toBe('GB111222333');
      expect(vatSettings.vatScheme).toBe('cash');
    });

    it('should sanitize and uppercase VAT number', async () => {
      // Create a test user
      const userData = {
        email: 'sanitize@example.com',
        password: 'TestPass123',
        name: 'Sanitize User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'gb 123 456 789'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.vatNumber).toBe('GB123456789');
    });

    it('should normalize vatScheme to lowercase', async () => {
      // Create a test user
      const userData = {
        email: 'normalize@example.com',
        password: 'TestPass123',
        name: 'Normalize User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatScheme: 'FLAT_RATE'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.vatScheme).toBe('flat_rate');
    });

    it('should accept 12-digit VAT number', async () => {
      // Create a test user
      const userData = {
        email: 'vat12@example.com',
        password: 'TestPass123',
        name: 'VAT12 User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'GB123456789012'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.vatNumber).toBe('GB123456789012');
    });

    it('should accept GBGD format VAT number (government departments)', async () => {
      // Create a test user
      const userData = {
        email: 'gbgd@example.com',
        password: 'TestPass123',
        name: 'GBGD User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'GBGD123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.vatNumber).toBe('GBGD123');
    });
  });

  describe('GET /api/settings/vat/schemes', () => {
    it('should return list of valid VAT schemes without authentication', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.schemes).toBeDefined();
      expect(Array.isArray(response.body.data.schemes)).toBe(true);
      expect(response.body.data.schemes.length).toBe(5);
    });

    it('should include standard scheme', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      const standardScheme = response.body.data.schemes.find(s => s.id === 'standard');
      expect(standardScheme).toBeDefined();
      expect(standardScheme.name.en).toBe('Standard VAT Accounting');
      expect(standardScheme.name.tr).toBeDefined();
      expect(standardScheme.description.en).toBeDefined();
      expect(standardScheme.description.tr).toBeDefined();
    });

    it('should include flat_rate scheme', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      const flatRateScheme = response.body.data.schemes.find(s => s.id === 'flat_rate');
      expect(flatRateScheme).toBeDefined();
      expect(flatRateScheme.name.en).toBe('Flat Rate Scheme');
    });

    it('should include cash scheme', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      const cashScheme = response.body.data.schemes.find(s => s.id === 'cash');
      expect(cashScheme).toBeDefined();
      expect(cashScheme.name.en).toBe('Cash Accounting Scheme');
    });

    it('should include annual scheme', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      const annualScheme = response.body.data.schemes.find(s => s.id === 'annual');
      expect(annualScheme).toBeDefined();
      expect(annualScheme.name.en).toBe('Annual Accounting Scheme');
    });

    it('should include retail scheme', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      const retailScheme = response.body.data.schemes.find(s => s.id === 'retail');
      expect(retailScheme).toBeDefined();
      expect(retailScheme.name.en).toBe('Retail Schemes');
    });

    it('should include meta information', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes')
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.language).toBe('en');
    });

    it('should respect language query parameter', async () => {
      const response = await request(app)
        .get('/api/settings/vat/schemes?lang=tr')
        .expect(200);

      expect(response.body.meta.language).toBe('tr');
    });
  });

  describe('VAT settings persistence', () => {
    it('should persist VAT settings correctly', async () => {
      // Create a test user
      const userData = {
        email: 'persist@example.com',
        password: 'TestPass123',
        name: 'Persist User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      // Update VAT settings
      await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          isVatRegistered: true,
          vatNumber: 'GB555666777',
          vatScheme: 'annual'
        })
        .expect(200);
      
      // Verify by fetching again
      const getResponse = await request(app)
        .get('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(getResponse.body.data.vatSettings.isVatRegistered).toBe(true);
      expect(getResponse.body.data.vatSettings.vatNumber).toBe('GB555666777');
      expect(getResponse.body.data.vatSettings.vatScheme).toBe('annual');
    });

    it('should clear VAT number when set to empty string', async () => {
      // Create a test user with VAT number
      const userData = {
        email: 'clear@example.com',
        password: 'TestPass123',
        name: 'Clear User',
        vatNumber: 'GB111222333',
        isVatRegistered: true
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      // Clear VAT number
      const response = await request(app)
        .put('/api/settings/vat')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: '',
          isVatRegistered: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vatSettings.vatNumber).toBe(null);
      expect(response.body.data.vatSettings.isVatRegistered).toBe(false);
    });
  });
});
