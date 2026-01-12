/**
 * Unit tests for Supplier API endpoints.
 * Tests CRUD operations, validation, and business logic.
 * 
 * @module tests/suppliers.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-suppliers-api-${workerId}.sqlite`);

// Test user data
let testUser;
let authToken;
let db;
let app;

/**
 * Setup test database before all tests.
 */
beforeAll(async () => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Remove existing test database if it exists
  [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(f => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    }
  });
  
  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  
  // Clear require cache to ensure fresh database connection
  delete require.cache[require.resolve('../database/index')];
  delete require.cache[require.resolve('../database/migrate')];
  delete require.cache[require.resolve('../app')];
  
  // Open database and run migrations
  const { openDatabase, closeDatabase } = require('../database/index');
  const { runMigrations } = require('../database/migrate');
  
  db = openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Import app after database is set up
  app = require('../app');
  
  // Create test user directly in database
  const { createUser } = require('../database/models/User');
  const result = await createUser({
    email: `testuser-suppliers-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Test User'
  });
  
  testUser = result.data;
  authToken = generateToken(testUser);
});

/**
 * Clean up test database after all tests.
 */
afterAll(() => {
  try {
    const { closeDatabase } = require('../database/index');
    closeDatabase();
    // Small delay to ensure database is released
    setTimeout(() => {
      [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(f => {
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
        }
      });
    }, 100);
  } catch (error) {
    // Ignore cleanup errors
  }
});

/**
 * Clean up suppliers table before each test.
 */
beforeEach(() => {
  const { executeMany } = require('../database/index');
  executeMany('DELETE FROM suppliers;');
});

describe('Supplier API', () => {
  describe('POST /api/suppliers', () => {
    it('should create a supplier with all required fields', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Supplier Ltd'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Supplier Ltd');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.paymentTerms).toBe('net30');
      expect(response.body.data.currency).toBe('GBP');
      expect(response.body.data.country).toBe('United Kingdom');
    });

    it('should create a supplier with all fields', async () => {
      const supplierData = {
        name: 'Full Supplier Ltd',
        contactName: 'Jane Smith',
        email: 'contact@fullsupplier.com',
        phoneNumber: '+441234567890',
        address: '456 Supplier Street',
        city: 'Manchester',
        postcode: 'M1 1AA',
        country: 'United Kingdom',
        vatNumber: 'GB123456789',
        isVatRegistered: true,
        companyNumber: '87654321',
        paymentTerms: 'net60',
        currency: 'GBP',
        bankAccountName: 'Full Supplier Ltd',
        bankAccountNumber: '12345678',
        bankSortCode: '123456',
        defaultExpenseCategory: 'Office Supplies',
        notes: 'Preferred supplier for office equipment'
      };

      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(supplierData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Full Supplier Ltd');
      expect(response.body.data.contactName).toBe('Jane Smith');
      expect(response.body.data.email).toBe('contact@fullsupplier.com');
      expect(response.body.data.vatNumber).toBe('GB123456789');
      expect(response.body.data.isVatRegistered).toBe(true);
      expect(response.body.data.paymentTerms).toBe('net60');
    });

    it('should reject supplier creation without name', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'name')).toBe(true);
    });

    it('should reject supplier with invalid email', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Supplier',
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject supplier with invalid VAT number', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Supplier',
          vatNumber: '12345'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'vatNumber')).toBe(true);
    });

    it('should accept valid UK VAT number formats', async () => {
      // Standard 9-digit VAT number
      const response1 = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Supplier 1',
          vatNumber: 'GB123456789',
          isVatRegistered: true
        })
        .expect(201);

      expect(response1.body.success).toBe(true);

      // 12-digit VAT number (branch traders)
      const response2 = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Supplier 2',
          vatNumber: 'GB123456789012',
          isVatRegistered: true
        })
        .expect(201);

      expect(response2.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate supplier name for same user', async () => {
      // Create first supplier
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unique Supplier' })
        .expect(201);

      // Try to create another with the same name
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unique Supplier' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'name')).toBe(true);
    });
  });

  describe('GET /api/suppliers', () => {
    beforeEach(async () => {
      // Create some test suppliers
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Supplier A' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Supplier B' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Supplier C', status: 'inactive' });
    });

    it('should list all suppliers for the authenticated user', async () => {
      const response = await request(app)
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suppliers.length).toBe(3);
      expect(response.body.data.total).toBe(3);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/suppliers?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suppliers.length).toBe(2);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/suppliers?status=inactive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suppliers.length).toBe(1);
      expect(response.body.data.suppliers[0].status).toBe('inactive');
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/suppliers?search=Supplier%20A')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suppliers.length).toBe(1);
      expect(response.body.data.suppliers[0].name).toBe('Supplier A');
    });
  });

  describe('GET /api/suppliers/:id', () => {
    let supplierId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Get Test Supplier' });
      
      supplierId = response.body.data.id;
    });

    it('should get a supplier by ID', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Get Test Supplier');
    });

    it('should return 404 for non-existent supplier', async () => {
      const response = await request(app)
        .get('/api/suppliers/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/suppliers/:id', () => {
    let supplierId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update Test Supplier' });
      
      supplierId = response.body.data.id;
    });

    it('should update a supplier', async () => {
      const response = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Supplier Name',
          email: 'updated@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Supplier Name');
      expect(response.body.data.email).toBe('updated@example.com');
    });

    it('should partially update a supplier', async () => {
      const response = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'partial@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('partial@example.com');
      // Original name should be preserved
      expect(response.body.data.name).toBe('Update Test Supplier');
    });

    it('should reject update with invalid data', async () => {
      const response = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent supplier', async () => {
      const response = await request(app)
        .put('/api/suppliers/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Name'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/suppliers/:id', () => {
    let supplierId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Delete Test Supplier' });
      
      supplierId = response.body.data.id;
    });

    it('should soft delete (deactivate) a supplier by default', async () => {
      const response = await request(app)
        .delete(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
      
      // Supplier should still exist
      const getResponse = await request(app)
        .get(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(getResponse.body.data.status).toBe('inactive');
    });

    it('should hard delete a supplier when requested', async () => {
      const response = await request(app)
        .delete(`/api/suppliers/${supplierId}?hard=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Supplier should not exist
      await request(app)
        .get(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent supplier', async () => {
      const response = await request(app)
        .delete('/api/suppliers/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/suppliers/:id/status', () => {
    let supplierId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Status Test Supplier' });
      
      supplierId = response.body.data.id;
    });

    it('should update supplier status', async () => {
      const response = await request(app)
        .patch(`/api/suppliers/${supplierId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'inactive' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/suppliers/${supplierId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/suppliers/search', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Acme Supplies',
          contactName: 'John Smith',
          city: 'London'
        });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Beta Vendors',
          contactName: 'Jane Doe',
          city: 'Manchester'
        });
    });

    it('should search suppliers by name', async () => {
      const response = await request(app)
        .get('/api/suppliers/search?q=Acme')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Acme Supplies');
    });

    it('should search suppliers by contact name', async () => {
      const response = await request(app)
        .get('/api/suppliers/search?q=Jane')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Beta Vendors');
    });

    it('should search suppliers by city', async () => {
      const response = await request(app)
        .get('/api/suppliers/search?q=London')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Acme Supplies');
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/suppliers/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/suppliers/active', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active Supplier 1' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active Supplier 2' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Inactive Supplier', status: 'inactive' });
    });

    it('should return only active suppliers', async () => {
      const response = await request(app)
        .get('/api/suppliers/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      response.body.data.forEach(supplier => {
        expect(supplier.status).toBe('active');
      });
    });
  });

  describe('GET /api/suppliers/vat-registered', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'VAT Registered Supplier',
          vatNumber: 'GB123456789',
          isVatRegistered: true
        });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Non-VAT Supplier' });
    });

    it('should return only VAT registered suppliers', async () => {
      const response = await request(app)
        .get('/api/suppliers/vat-registered')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('VAT Registered Supplier');
      expect(response.body.data[0].vatNumber).toBe('GB123456789');
    });
  });

  describe('GET /api/suppliers/stats', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active 1' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active 2' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Inactive', status: 'inactive' });
      
      await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Blocked', status: 'blocked' });
    });

    it('should return supplier counts by status', async () => {
      const response = await request(app)
        .get('/api/suppliers/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(2);
      expect(response.body.data.inactive).toBe(1);
      expect(response.body.data.blocked).toBe(1);
    });
  });

  describe('VAT Number Validation', () => {
    it('should accept GB 9-digit VAT number', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 1',
          vatNumber: 'GB123456789',
          isVatRegistered: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should accept GB 12-digit VAT number (branch traders)', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 2',
          vatNumber: 'GB123456789012',
          isVatRegistered: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should accept VAT number without GB prefix and normalize it', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 3',
          vatNumber: '987654321',
          isVatRegistered: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      // Should be normalized with GB prefix
      expect(response.body.data.vatNumber).toBe('GB987654321');
    });

    it('should reject invalid VAT number format', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test Invalid',
          vatNumber: '12345'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'vatNumber')).toBe(true);
    });

    it('should warn when VAT number is provided but isVatRegistered is false', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test Inconsistent',
          vatNumber: 'GB123456789',
          isVatRegistered: false
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'isVatRegistered')).toBe(true);
    });
  });

  describe('Payment Terms Validation', () => {
    it('should accept valid payment terms', async () => {
      const validTerms = ['immediate', 'net7', 'net14', 'net30', 'net60', 'net90', 'custom'];
      
      for (const terms of validTerms) {
        const supplierData = {
          name: `Payment Terms Test ${terms}`,
          paymentTerms: terms
        };
        
        if (terms === 'custom') {
          supplierData.paymentTermsDays = 45;
        }
        
        const response = await request(app)
          .post('/api/suppliers')
          .set('Authorization', `Bearer ${authToken}`)
          .send(supplierData);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.paymentTerms).toBe(terms);
      }
    });

    it('should reject invalid payment terms', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Payment Terms',
          paymentTerms: 'invalid_terms'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'paymentTerms')).toBe(true);
    });

    it('should require paymentTermsDays when paymentTerms is custom', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Custom Payment Terms',
          paymentTerms: 'custom'
          // Missing paymentTermsDays
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'paymentTermsDays')).toBe(true);
    });
  });

  describe('Bank Details Validation', () => {
    it('should accept valid UK bank details', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bank Details Test',
          bankAccountNumber: '12345678',
          bankSortCode: '123456'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bankAccountNumber).toBe('12345678');
      expect(response.body.data.bankSortCode).toBe('123456');
    });

    it('should reject invalid bank account number', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Bank Account',
          bankAccountNumber: '1234' // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'bankAccountNumber')).toBe(true);
    });

    it('should reject invalid sort code', async () => {
      const response = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Sort Code',
          bankSortCode: '12' // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'bankSortCode')).toBe(true);
    });
  });
});
