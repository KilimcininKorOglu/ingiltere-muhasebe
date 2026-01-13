/**
 * Unit tests for Customer API endpoints.
 * Tests CRUD operations, validation, and business logic.
 * 
 * @module tests/customers.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-customers-api-${workerId}.sqlite`);

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
    email: `testuser-${workerId}@example.com`,
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
 * Clean up customers table before each test.
 */
beforeEach(() => {
  const { executeMany } = require('../database/index');
  executeMany('DELETE FROM customers;');
  executeMany('DELETE FROM invoices;');
});

describe('Customer API', () => {
  describe('POST /api/customers', () => {
    it('should create a customer with all required fields', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Customer Ltd'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Customer Ltd');
      expect(response.body.data.customerNumber).toMatch(/^CUST-\d{4}$/);
      expect(response.body.data.status).toBe('active');
    });

    it('should create a customer with all fields', async () => {
      const customerData = {
        name: 'Full Customer Ltd',
        tradingName: 'FC Trading',
        email: 'contact@fullcustomer.com',
        phone: '+441234567890',
        website: 'www.fullcustomer.com',
        vatNumber: 'GB123456789',
        companyNumber: '12345678',
        addressLine1: '123 Test Street',
        addressLine2: 'Suite 100',
        city: 'London',
        county: 'Greater London',
        postcode: 'SW1A1AA',
        country: 'GB',
        contactName: 'John Doe',
        contactEmail: 'john@fullcustomer.com',
        contactPhone: '+441234567891',
        paymentTerms: 30,
        creditLimit: 500000,
        currency: 'GBP',
        notes: 'Important customer'
      };

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(customerData);

      if (response.status !== 201) {
        console.error('Customer creation failed:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Full Customer Ltd');
      expect(response.body.data.tradingName).toBe('FC Trading');
      expect(response.body.data.email).toBe('contact@fullcustomer.com');
      expect(response.body.data.vatNumber).toBe('GB123456789');
      expect(response.body.data.paymentTerms).toBe(30);
    });

    it('should reject customer creation without name', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'name')).toBe(true);
    });

    it('should reject customer with invalid email', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Customer',
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject customer with invalid VAT number', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Customer',
          vatNumber: '12345'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'vatNumber')).toBe(true);
    });

    it('should accept valid UK VAT number formats', async () => {
      // Standard 9-digit VAT number
      const response1 = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Customer 1',
          vatNumber: 'GB123456789'
        })
        .expect(201);

      expect(response1.body.success).toBe(true);

      // 12-digit VAT number
      const response2 = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Customer 2',
          vatNumber: 'GB123456789012'
        })
        .expect(201);

      expect(response2.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/customers')
        .send({
          name: 'Test Customer'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/customers', () => {
    beforeEach(async () => {
      // Create some test customers
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Customer A' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Customer B' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Customer C', status: 'inactive' });
    });

    it('should list all customers for the authenticated user', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customers.length).toBe(3);
      expect(response.body.data.total).toBe(3);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/customers?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customers.length).toBe(2);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/customers?status=inactive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customers.length).toBe(1);
      expect(response.body.data.customers[0].status).toBe('inactive');
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/customers?search=Customer%20A')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customers.length).toBe(1);
      expect(response.body.data.customers[0].name).toBe('Customer A');
    });
  });

  describe('GET /api/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Get Test Customer' });
      
      customerId = response.body.data.id;
    });

    it('should get a customer by ID', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Get Test Customer');
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/customers/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update Test Customer' });
      
      customerId = response.body.data.id;
    });

    it('should update a customer', async () => {
      const response = await request(app)
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Customer Name',
          email: 'updated@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Customer Name');
      expect(response.body.data.email).toBe('updated@example.com');
    });

    it('should partially update a customer', async () => {
      const response = await request(app)
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'partial@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('partial@example.com');
      // Original name should be preserved
      expect(response.body.data.name).toBe('Update Test Customer');
    });

    it('should reject update with invalid data', async () => {
      const response = await request(app)
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .put('/api/customers/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Name'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Delete Test Customer' });
      
      customerId = response.body.data.id;
    });

    it('should soft delete (archive) a customer by default', async () => {
      const response = await request(app)
        .delete(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('archived');
      
      // Customer should still exist
      const getResponse = await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(getResponse.body.data.status).toBe('archived');
    });

    it('should hard delete a customer when requested', async () => {
      const response = await request(app)
        .delete(`/api/customers/${customerId}?hard=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Customer should not exist
      await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should prevent deletion of customer with unpaid invoices', async () => {
      // Create an invoice for this customer
      const { execute } = require('../database/index');
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [testUser.id, 'INV-2026-0001', 'pending', '2026-01-01', '2026-01-31', 'Delete Test Customer']);

      const response = await request(app)
        .delete(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BUS_CUSTOMER_HAS_UNPAID_INVOICES');
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .delete('/api/customers/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/customers/:id/status', () => {
    let customerId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Status Test Customer' });
      
      customerId = response.body.data.id;
    });

    it('should update customer status', async () => {
      const response = await request(app)
        .patch(`/api/customers/${customerId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'inactive' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/customers/${customerId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/customers/search', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Acme Corp',
          email: 'contact@acme.com'
        });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Beta Ltd',
          email: 'info@beta.co.uk'
        });
    });

    it('should search customers by name', async () => {
      const response = await request(app)
        .get('/api/customers/search?q=Acme')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Acme Corp');
    });

    it('should search customers by email', async () => {
      const response = await request(app)
        .get('/api/customers/search?q=beta.co.uk')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Beta Ltd');
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/customers/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/customers/active', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active Customer 1' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active Customer 2' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Inactive Customer', status: 'inactive' });
    });

    it('should return only active customers', async () => {
      const response = await request(app)
        .get('/api/customers/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      response.body.data.forEach(customer => {
        expect(customer.status).toBe('active');
      });
    });
  });

  describe('GET /api/customers/b2b', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'B2B Customer',
          vatNumber: 'GB123456789'
        });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'B2C Customer' });
    });

    it('should return only B2B customers with VAT numbers', async () => {
      const response = await request(app)
        .get('/api/customers/b2b')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('B2B Customer');
      expect(response.body.data[0].vatNumber).toBe('GB123456789');
    });
  });

  describe('GET /api/customers/stats', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active 1' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Active 2' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Inactive', status: 'inactive' });
      
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Archived', status: 'archived' });
    });

    it('should return customer counts by status', async () => {
      const response = await request(app)
        .get('/api/customers/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(2);
      expect(response.body.data.inactive).toBe(1);
      expect(response.body.data.archived).toBe(1);
    });
  });

  describe('VAT Number Validation', () => {
    it('should accept GB 9-digit VAT number', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 1',
          vatNumber: 'GB123456789'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should accept GB 12-digit VAT number', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 2',
          vatNumber: 'GB123456789012'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should accept GBGD government department VAT number', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 3',
          vatNumber: 'GBGD123'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should accept GBHA health authority VAT number', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 4',
          vatNumber: 'GBHA456'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should accept EU VAT number format', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test 5',
          vatNumber: 'DE123456789'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid VAT number format', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'VAT Test Invalid',
          vatNumber: '12345'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(e => e.field === 'vatNumber')).toBe(true);
    });
  });
});
