/**
 * Unit tests for User Profile API endpoints.
 * Tests GET /api/users/me and PUT /api/users/me functionality.
 * 
 * @module tests/users.api.test
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
const TEST_DB_PATH = path.join(__dirname, '../data/test-users-api-database.sqlite');

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

describe('User Profile API', () => {
  describe('GET /api/users/me', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should return 401 when an invalid token is provided', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('should return user profile when authenticated', async () => {
      // Create a test user
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123',
        name: 'Test User',
        businessName: 'Test Business Ltd',
        preferredLanguage: 'en'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.name).toBe('Test User');
      expect(response.body.data.user.businessName).toBe('Test Business Ltd');
      expect(response.body.data.user.preferredLanguage).toBe('en');
      // Ensure password is not returned
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should return complete user profile with all fields', async () => {
      // Create a test user with all fields
      const userData = {
        email: 'complete@example.com',
        password: 'TestPass123',
        name: 'Complete User',
        businessName: 'Complete Business Ltd',
        businessAddress: '123 Business Street, London',
        vatNumber: 'GB123456789',
        isVatRegistered: true,
        companyNumber: 'AB123456',
        taxYearStart: '04-06',
        preferredLanguage: 'tr',
        invoicePrefix: 'INV',
        nextInvoiceNumber: 1
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const user = response.body.data.user;
      expect(user.email).toBe('complete@example.com');
      expect(user.businessAddress).toBe('123 Business Street, London');
      expect(user.vatNumber).toBe('GB123456789');
      expect(user.isVatRegistered).toBe(true);
      expect(user.companyNumber).toBe('AB123456');
      expect(user.taxYearStart).toBe('04-06');
      expect(user.preferredLanguage).toBe('tr');
    });
  });

  describe('PUT /api/users/me', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should return 401 when an invalid token is provided', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('should update user name successfully', async () => {
      // Create a test user
      const userData = {
        email: 'update@example.com',
        password: 'TestPass123',
        name: 'Original Name'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe('Updated Name');
      
      // Verify the change persisted
      const updatedUser = findById(result.data.id);
      expect(updatedUser.name).toBe('Updated Name');
    });

    it('should update business details successfully', async () => {
      // Create a test user
      const userData = {
        email: 'business@example.com',
        password: 'TestPass123',
        name: 'Business User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          businessName: 'New Business Ltd',
          businessAddress: '456 New Street, Manchester'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.businessName).toBe('New Business Ltd');
      expect(response.body.data.user.businessAddress).toBe('456 New Street, Manchester');
    });

    it('should update VAT registration successfully', async () => {
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
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'GB987654321',
          isVatRegistered: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.vatNumber).toBe('GB987654321');
      expect(response.body.data.user.isVatRegistered).toBe(true);
    });

    it('should return validation error for invalid VAT number format', async () => {
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
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'INVALID123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.some(d => d.field === 'vatNumber')).toBe(true);
    });

    it('should return validation error for invalid VAT number without GB prefix', async () => {
      // Create a test user
      const userData = {
        email: 'no-gb@example.com',
        password: 'TestPass123',
        name: 'No GB User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: '123456789'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should update language preference successfully', async () => {
      // Create a test user with English
      const userData = {
        email: 'lang@example.com',
        password: 'TestPass123',
        name: 'Language User',
        preferredLanguage: 'en'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      // Update to Turkish
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          preferredLanguage: 'tr'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.preferredLanguage).toBe('tr');
      
      // Verify the change persisted
      const updatedUser = findById(result.data.id);
      expect(updatedUser.preferredLanguage).toBe('tr');
    });

    it('should return validation error for invalid language preference', async () => {
      // Create a test user
      const userData = {
        email: 'bad-lang@example.com',
        password: 'TestPass123',
        name: 'Bad Lang User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          preferredLanguage: 'fr'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'preferredLanguage')).toBe(true);
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
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should update multiple fields at once', async () => {
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
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Multi User',
          businessName: 'Multi Business Ltd',
          vatNumber: 'GB111222333',
          isVatRegistered: true,
          preferredLanguage: 'tr',
          companyNumber: 'MU123456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      const user = response.body.data.user;
      expect(user.name).toBe('Updated Multi User');
      expect(user.businessName).toBe('Multi Business Ltd');
      expect(user.vatNumber).toBe('GB111222333');
      expect(user.isVatRegistered).toBe(true);
      expect(user.preferredLanguage).toBe('tr');
      expect(user.companyNumber).toBe('MU123456');
    });

    it('should return validation error for name too short', async () => {
      // Create a test user
      const userData = {
        email: 'short@example.com',
        password: 'TestPass123',
        name: 'Short User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'name')).toBe(true);
    });

    it('should return validation error for invalid company number', async () => {
      // Create a test user
      const userData = {
        email: 'badcompany@example.com',
        password: 'TestPass123',
        name: 'Bad Company User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyNumber: '12345' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'companyNumber')).toBe(true);
    });

    it('should accept valid 12-digit VAT number', async () => {
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
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'GB123456789012'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.vatNumber).toBe('GB123456789012');
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
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          vatNumber: 'gb 123 456 789'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.vatNumber).toBe('GB123456789');
    });

    it('should update tax year start successfully', async () => {
      // Create a test user
      const userData = {
        email: 'taxyear@example.com',
        password: 'TestPass123',
        name: 'Tax Year User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          taxYearStart: '01-01'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.taxYearStart).toBe('01-01');
    });

    it('should return validation error for invalid tax year start format', async () => {
      // Create a test user
      const userData = {
        email: 'badtaxyear@example.com',
        password: 'TestPass123',
        name: 'Bad Tax Year User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          taxYearStart: '2024-04-06'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'taxYearStart')).toBe(true);
    });

    it('should clear optional fields by setting them to empty string', async () => {
      // Create a test user with business name
      const userData = {
        email: 'clear@example.com',
        password: 'TestPass123',
        name: 'Clear User',
        businessName: 'Original Business'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          businessName: ''
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Empty string should be stored as null
      expect(response.body.data.user.businessName).toBeFalsy();
    });
  });

  describe('Response metadata', () => {
    it('should include meta information in response', async () => {
      // Create a test user
      const userData = {
        email: 'meta@example.com',
        password: 'TestPass123',
        name: 'Meta User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.language).toBe('en');
    });

    it('should respect language query parameter', async () => {
      // Create a test user
      const userData = {
        email: 'langquery@example.com',
        password: 'TestPass123',
        name: 'Lang Query User'
      };
      
      const result = await createUser(userData);
      expect(result.success).toBe(true);
      
      // Generate token
      const token = generateToken(result.data);
      
      const response = await request(app)
        .get('/api/users/me?lang=tr')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.meta.language).toBe('tr');
    });
  });
});
