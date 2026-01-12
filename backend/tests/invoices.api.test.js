/**
 * Integration Tests for Invoice API Endpoints
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-invoices-api-${workerId}.sqlite`);

// Test user data
let testUser;
let authToken;
let testCustomer;
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
    email: `invoice-test-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Invoice Test User'
  });
  
  testUser = result.data;
  authToken = generateToken(testUser);
  
  // Create test customer
  const { createCustomer } = require('../database/models/Customer');
  const customerResult = createCustomer({
    userId: testUser.id,
    name: 'Test Customer Ltd',
    email: 'customer@test.com',
    addressLine1: '123 Test Street',
    city: 'London',
    postcode: 'SW1A1AA',
    country: 'GB'
  });

  testCustomer = customerResult.data;
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
  } catch (e) {
    console.error('Error during cleanup:', e);
  }
});

describe('Invoice API', () => {
  describe('POST /api/invoices', () => {
    let createdInvoiceId;

    afterEach(() => {
      // Clean up created invoices
      if (createdInvoiceId) {
        try {
          const { deleteInvoice } = require('../database/models/Invoice');
          deleteInvoice(createdInvoiceId);
        } catch {}
        createdInvoiceId = null;
      }
    });

    it('should create an invoice with valid data', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        notes: 'Payment terms: Net 30 days',
        items: [
          { description: 'Consulting Service', quantity: 2, unitPrice: 10000, vatRate: 20 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.customerName).toBe('Test Customer Ltd');
      expect(response.body.data.subtotal).toBe(20000); // 2 * £100
      expect(response.body.data.vatAmount).toBe(4000); // 20% of £200
      expect(response.body.data.totalAmount).toBe(24000);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].description).toBe('Consulting Service');

      createdInvoiceId = response.body.data.id;
    });

    it('should create an invoice with multiple line items', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Service A', quantity: 1, unitPrice: 10000, vatRate: 'standard' },
          { description: 'Service B', quantity: 2, unitPrice: 5000, vatRate: 'reduced' },
          { description: 'Zero-rated Item', quantity: 3, unitPrice: 1000, vatRate: 'zero' }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(3);
      
      // £100 + (2 * £50) + (3 * £10) = £100 + £100 + £30 = £230
      expect(response.body.data.subtotal).toBe(23000);
      
      // VAT: £20 (standard) + £5 (reduced) + £0 (zero) = £25
      expect(response.body.data.vatAmount).toBe(2500);
      
      expect(response.body.data.totalAmount).toBe(25500);

      createdInvoiceId = response.body.data.id;
    });

    it('should return 400 for missing customerId', async () => {
      const invoiceData = {
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some(d => d.field === 'customerId')).toBe(true);
    });

    it('should return 400 for missing invoiceDate', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        dueDate: '2026-02-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'invoiceDate')).toBe(true);
    });

    it('should return 400 for missing dueDate', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'dueDate')).toBe(true);
    });

    it('should return 400 for dueDate before invoiceDate', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-02-12',
        dueDate: '2026-01-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'dueDate')).toBe(true);
    });

    it('should return 400 for missing items', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12'
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'items')).toBe(true);
    });

    it('should return 400 for empty items array', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: []
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'items')).toBe(true);
    });

    it('should return 400 for item missing description', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'items[0].description')).toBe(true);
    });

    it('should return 400 for item missing unitPrice', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Service', quantity: 1 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.some(d => d.field === 'items[0].unitPrice')).toBe(true);
    });

    it('should return 404 for non-existent customer', async () => {
      const invoiceData = {
        customerId: 999999,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should generate unique sequential invoice numbers', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      // Create first invoice
      const response1 = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(201);

      const invoiceNumber1 = response1.body.data.invoiceNumber;
      const id1 = response1.body.data.id;

      // Create second invoice
      const response2 = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(201);

      const invoiceNumber2 = response2.body.data.invoiceNumber;
      const id2 = response2.body.data.id;

      // Invoice numbers should be different
      expect(invoiceNumber1).not.toBe(invoiceNumber2);

      // Clean up
      const { deleteInvoice } = require('../database/models/Invoice');
      deleteInvoice(id1);
      deleteInvoice(id2);
    });

    it('should handle different currencies', async () => {
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        currency: 'EUR',
        items: [
          { description: 'Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData)
        .expect(201);

      expect(response.body.data.currency).toBe('EUR');

      createdInvoiceId = response.body.data.id;
    });
  });

  describe('GET /api/invoices/:id', () => {
    let testInvoiceId;

    beforeAll(async () => {
      // Create a test invoice
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Test Service', quantity: 1, unitPrice: 10000 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData);

      testInvoiceId = response.body.data.id;
    });

    afterAll(() => {
      if (testInvoiceId) {
        try {
          const { deleteInvoice } = require('../database/models/Invoice');
          deleteInvoice(testInvoiceId);
        } catch {}
      }
    });

    it('should return invoice with items', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testInvoiceId);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].description).toBe('Test Service');
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request(app)
        .get('/api/invoices/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });
  });

  describe('GET /api/invoices', () => {
    it('should return paginated list of invoices', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('invoices');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
    });
  });

  describe('GET /api/invoices/stats', () => {
    it('should return invoice statistics', async () => {
      const response = await request(app)
        .get('/api/invoices/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statusCounts');
      expect(response.body.data).toHaveProperty('overdueCount');
      expect(response.body.data).toHaveProperty('overdueTotal');
    });
  });

  describe('GET /api/invoices/overdue', () => {
    it('should return list of overdue invoices', async () => {
      const response = await request(app)
        .get('/api/invoices/overdue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
