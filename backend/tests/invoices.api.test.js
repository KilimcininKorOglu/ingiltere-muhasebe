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

    it('should include customer details in response', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customer).toBeDefined();
      expect(response.body.data.customer.name).toBe('Test Customer Ltd');
      expect(response.body.data.customer.id).toBe(testCustomer.id);
    });

    it('should include isOverdue flag in response', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isOverdue');
      expect(typeof response.body.data.isOverdue).toBe('boolean');
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
    let testInvoiceIds = [];

    beforeAll(async () => {
      // Create multiple test invoices for filtering tests
      const invoices = [
        {
          customerId: testCustomer.id,
          invoiceDate: '2026-01-01',
          dueDate: '2026-01-15',
          items: [{ description: 'Service A', quantity: 1, unitPrice: 10000 }]
        },
        {
          customerId: testCustomer.id,
          invoiceDate: '2026-01-05',
          dueDate: '2026-01-20',
          items: [{ description: 'Service B', quantity: 1, unitPrice: 20000 }]
        },
        {
          customerId: testCustomer.id,
          invoiceDate: '2026-01-10',
          dueDate: '2026-01-25',
          items: [{ description: 'Service C', quantity: 1, unitPrice: 30000 }]
        }
      ];

      for (const invoiceData of invoices) {
        const response = await request(app)
          .post('/api/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invoiceData);
        if (response.body.data) {
          testInvoiceIds.push(response.body.data.id);
        }
      }
    });

    afterAll(() => {
      const { deleteInvoice } = require('../database/models/Invoice');
      testInvoiceIds.forEach(id => {
        try { deleteInvoice(id); } catch {}
      });
    });

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

    it('should include isOverdue flag for each invoice', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.invoices.forEach(invoice => {
        expect(invoice).toHaveProperty('isOverdue');
        expect(typeof invoice.isOverdue).toBe('boolean');
      });
    });

    it('should filter invoices by status', async () => {
      const response = await request(app)
        .get('/api/invoices?status=draft')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.invoices.forEach(invoice => {
        expect(invoice.status).toBe('draft');
      });
    });

    it('should filter invoices by date range', async () => {
      const response = await request(app)
        .get('/api/invoices?dateFrom=2026-01-03&dateTo=2026-01-08')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.invoices.forEach(invoice => {
        expect(invoice.issueDate >= '2026-01-03').toBe(true);
        expect(invoice.issueDate <= '2026-01-08').toBe(true);
      });
    });

    it('should search invoices by invoice number or customer name', async () => {
      const response = await request(app)
        .get('/api/invoices?search=Test Customer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.invoices.forEach(invoice => {
        expect(invoice.customerName.toLowerCase()).toContain('test customer');
      });
    });

    it('should filter invoices by customer ID', async () => {
      const response = await request(app)
        .get(`/api/invoices?customerId=${testCustomer.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.invoices.forEach(invoice => {
        expect(invoice.customerName).toBe('Test Customer Ltd');
      });
    });

    it('should sort invoices by totalAmount', async () => {
      const response = await request(app)
        .get('/api/invoices?sortBy=totalAmount&sortOrder=ASC')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const amounts = response.body.data.invoices.map(inv => inv.totalAmount);
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i] >= amounts[i - 1]).toBe(true);
      }
    });

    it('should paginate invoices correctly', async () => {
      const response = await request(app)
        .get('/api/invoices?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBeLessThanOrEqual(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
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

  describe('PATCH /api/invoices/:id/status', () => {
    let testInvoiceId;

    beforeEach(async () => {
      // Create a fresh test invoice for each status test
      const invoiceData = {
        customerId: testCustomer.id,
        invoiceDate: '2026-01-12',
        dueDate: '2026-02-12',
        items: [
          { description: 'Test Service', quantity: 1, unitPrice: 10000, vatRate: 20 }
        ]
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceData);

      testInvoiceId = response.body.data.id;
    });

    afterEach(() => {
      if (testInvoiceId) {
        try {
          const { deleteInvoice, findById, updateInvoice } = require('../database/models/Invoice');
          const invoice = findById(testInvoiceId);
          // Reset status to draft if needed for deletion
          if (invoice && invoice.status !== 'draft') {
            // Force delete by direct SQL
            const { execute } = require('../database/index');
            execute('DELETE FROM invoices WHERE id = ?', [testInvoiceId]);
          } else if (invoice) {
            deleteInvoice(testInvoiceId);
          }
        } catch {}
        testInvoiceId = null;
      }
    });

    describe('Valid status transitions', () => {
      it('should transition from draft to pending', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('pending');
        expect(response.body.data.statusChange).toBeDefined();
        expect(response.body.data.statusChange.previousStatus).toBe('draft');
        expect(response.body.data.statusChange.newStatus).toBe('pending');
      });

      it('should transition from draft to cancelled', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'cancelled' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('cancelled');
      });

      it('should transition from pending to paid', async () => {
        // First transition to pending
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Then transition to paid
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'paid' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('paid');
        expect(response.body.data.paidAt).toBeDefined();
      });

      it('should transition from pending to overdue', async () => {
        // First transition to pending
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Then transition to overdue
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'overdue' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('overdue');
      });

      it('should transition from overdue to paid', async () => {
        // Transition to pending then overdue
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'overdue' });

        // Then transition to paid
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'paid' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('paid');
        expect(response.body.data.paidAt).toBeDefined();
      });

      it('should transition from paid to refunded', async () => {
        // Transition to pending then paid
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'paid' });

        // Then transition to refunded
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'refunded' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('refunded');
      });
    });

    describe('Invalid status transitions', () => {
      it('should return 400 for draft to paid (invalid)', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'paid' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BUS_INVALID_STATUS_TRANSITION');
        expect(response.body.error.validTransitions).toEqual(['pending', 'cancelled']);
      });

      it('should return 400 for pending to draft (invalid)', async () => {
        // First transition to pending
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Try invalid transition back to draft
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'draft' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BUS_INVALID_STATUS_TRANSITION');
      });

      it('should return 400 for cancelled to any status (terminal)', async () => {
        // Cancel the invoice
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'cancelled' });

        // Try to change from cancelled
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BUS_INVALID_STATUS_TRANSITION');
      });
    });

    describe('Payment details recording', () => {
      it('should record payment details when marking as paid', async () => {
        // Transition to pending first
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Mark as paid with payment details
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'paid',
            paymentDetails: {
              paymentMethod: 'bank_transfer',
              paymentReference: 'BACS-20260112-001',
              notes: 'Payment received via BACS'
            }
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('paid');
        expect(response.body.data.payment).toBeDefined();
        expect(response.body.data.payment.method).toBe('bank_transfer');
        expect(response.body.data.payment.reference).toBe('BACS-20260112-001');
      });

      it('should accept payment date in payment details', async () => {
        // Transition to pending first
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        const customPaymentDate = '2026-01-10T14:30:00Z';

        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'paid',
            paymentDetails: {
              paymentDate: customPaymentDate,
              paymentMethod: 'card'
            }
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.payment.paidAt).toBe(customPaymentDate);
      });

      it('should validate payment details', async () => {
        // Transition to pending first
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Try with invalid payment method
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'paid',
            paymentDetails: {
              paymentMethod: 'invalid_method'
            }
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('Income transaction creation', () => {
      it('should create income transaction when requested', async () => {
        // Transition to pending first
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Mark as paid with income transaction creation
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'paid',
            createIncomeTransaction: true,
            paymentDetails: {
              paymentMethod: 'bank_transfer'
            }
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.incomeTransaction).toBeDefined();
        expect(response.body.data.incomeTransaction.id).toBeDefined();
        expect(response.body.data.incomeTransaction.amount).toBe(12000); // 10000 + 2000 VAT
      });

      it('should not create income transaction by default', async () => {
        // Transition to pending first
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Mark as paid without income transaction flag
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'paid' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.incomeTransaction).toBeUndefined();
      });
    });

    describe('Error handling', () => {
      it('should return 404 for non-existent invoice', async () => {
        const response = await request(app)
          .patch('/api/invoices/999999/status')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('RES_NOT_FOUND');
      });

      it('should return 400 for invalid status value', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'invalid_status' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for missing status', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should return 401 without authentication', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .send({ status: 'pending' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Timestamps updates', () => {
      it('should update paidAt when marking as paid', async () => {
        // Transition to pending first
        await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' });

        // Mark as paid
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'paid' })
          .expect(200);

        expect(response.body.data.paidAt).toBeDefined();
        // Verify it's a valid ISO timestamp
        const paidAt = new Date(response.body.data.paidAt);
        expect(paidAt.getTime()).not.toBeNaN();
      });

      it('should update updatedAt on status change', async () => {
        const response = await request(app)
          .patch(`/api/invoices/${testInvoiceId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'pending' })
          .expect(200);

        expect(response.body.data.updatedAt).toBeDefined();
        // Verify it's a valid timestamp format
        expect(response.body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
      });
    });
  });
});

