/**
 * Unit tests for Customer Transaction History API endpoints.
 * Tests transaction and invoice history retrieval with filtering and summary calculations.
 * 
 * @module tests/customerHistory.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-customer-history-${workerId}.sqlite`);

// Test user data
let testUser;
let otherUser;
let authToken;
let otherAuthToken;
let db;
let app;
let customerId;

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
  
  // Clear all require cache to ensure fresh database connection and routes
  Object.keys(require.cache).forEach(key => {
    if (key.includes('database') || key.includes('app') || key.includes('routes') || key.includes('controllers') || key.includes('services')) {
      delete require.cache[key];
    }
  });
  
  // Open database and run migrations
  const { openDatabase, closeDatabase } = require('../database/index');
  const { runMigrations } = require('../database/migrate');
  
  db = openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Import app after database is set up
  app = require('../app');
  
  // Create test users directly in database
  const { createUser } = require('../database/models/User');
  const result = await createUser({
    email: `testuser-history-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Test User'
  });
  
  testUser = result.data;
  authToken = generateToken(testUser);
  
  // Create a second user for access control tests
  const otherResult = await createUser({
    email: `otheruser-history-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Other User'
  });
  
  otherUser = otherResult.data;
  otherAuthToken = generateToken(otherUser);
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
 * Setup test data before each test.
 */
beforeEach(async () => {
  const { executeMany, execute } = require('../database/index');
  executeMany('DELETE FROM transactions;');
  executeMany('DELETE FROM invoices;');
  executeMany('DELETE FROM customers;');
  
  // Create a test customer directly in the database
  execute(`
    INSERT INTO customers (userId, customerNumber, name, status, country, currency, paymentTerms, creditLimit)
    VALUES (?, 'CUST-0001', 'History Test Customer', 'active', 'GB', 'GBP', 30, 0)
  `, [testUser.id]);
  
  // Get the customer ID
  const { queryOne } = require('../database/index');
  const customer = queryOne('SELECT id FROM customers WHERE userId = ? AND name = ?', [testUser.id, 'History Test Customer']);
  customerId = customer.id;
});

describe('Customer Transaction History API', () => {
  describe('GET /api/customers/:id/transactions', () => {
    beforeEach(() => {
      const { execute } = require('../database/index');
      
      // Create test transactions for the customer
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-01', 'Sale 1', 10000, 12000, 2000, 'History Test Customer')
      `, [testUser.id]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-05', 'Sale 2', 20000, 24000, 4000, 'History Test Customer')
      `, [testUser.id]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'expense', 'cleared', '2026-01-10', 'Refund', 5000, 6000, 1000, 'History Test Customer')
      `, [testUser.id]);
      
      // Create a transaction for another payee (should not be returned)
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-15', 'Other Sale', 15000, 18000, 3000, 'Other Customer')
      `, [testUser.id]);
    });

    it('should return transaction history for a customer', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(3);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.customerId).toBe(customerId);
      expect(response.body.data.customerName).toBe('History Test Customer');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(2);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    it('should filter by transaction type', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?type=income`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(2);
      response.body.data.transactions.forEach(txn => {
        expect(txn.type).toBe('income');
      });
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?startDate=2026-01-05&endDate=2026-01-10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(2);
    });

    it('should reject invalid date range', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?startDate=2026-01-15&endDate=2026-01-01`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/customers/99999/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });

    it('should return 403 when accessing another user\'s customer', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHZ_RESOURCE_OWNER_ONLY');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/customers/:id/invoices', () => {
    beforeEach(() => {
      const { execute } = require('../database/index');
      
      // Create test invoices for the customer
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0001', 'paid', '2026-01-01', '2026-01-31', 'History Test Customer', 12000, 2000, 10000)
      `, [testUser.id]);
      
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0002', 'pending', '2026-01-15', '2026-02-14', 'History Test Customer', 24000, 4000, 20000)
      `, [testUser.id]);
      
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0003', 'overdue', '2025-12-01', '2025-12-31', 'History Test Customer', 6000, 1000, 5000)
      `, [testUser.id]);
      
      // Create an invoice for another customer (should not be returned)
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0004', 'paid', '2026-01-10', '2026-02-09', 'Other Customer', 18000, 3000, 15000)
      `, [testUser.id]);
    });

    it('should return invoice history for a customer', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBe(3);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.customerId).toBe(customerId);
      expect(response.body.data.customerName).toBe('History Test Customer');
    });

    it('should filter by invoice status', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices?status=paid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBe(1);
      expect(response.body.data.invoices[0].status).toBe('paid');
    });

    it('should filter by pending status', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices?status=pending`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBe(1);
      expect(response.body.data.invoices[0].status).toBe('pending');
    });

    it('should filter by overdue status', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices?status=overdue`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBe(1);
      expect(response.body.data.invoices[0].status).toBe('overdue');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBe(2);
      expect(response.body.data.total).toBe(3);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices?startDate=2026-01-01&endDate=2026-01-31`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoices.length).toBe(2);
    });

    it('should include isOverdue flag', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Check that isOverdue flag exists on all invoices
      response.body.data.invoices.forEach(invoice => {
        expect(invoice.hasOwnProperty('isOverdue')).toBe(true);
      });
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/customers/99999/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 when accessing another user\'s customer', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/customers/:id/summary', () => {
    beforeEach(() => {
      const { execute } = require('../database/index');
      
      // Create test invoices
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal, paidAt)
        VALUES (?, 'INV-2026-0001', 'paid', '2026-01-01', '2026-01-31', 'History Test Customer', 12000, 2000, 10000, datetime('now'))
      `, [testUser.id]);
      
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0002', 'pending', '2026-01-15', '2026-02-14', 'History Test Customer', 24000, 4000, 20000)
      `, [testUser.id]);
      
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0003', 'overdue', '2025-12-01', '2025-12-31', 'History Test Customer', 6000, 1000, 5000)
      `, [testUser.id]);
      
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, totalAmount, vatAmount, subtotal)
        VALUES (?, 'INV-2026-0004', 'draft', '2026-01-20', '2026-02-19', 'History Test Customer', 8000, 1400, 6600)
      `, [testUser.id]);
      
      // Create test transactions
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-01', 'Sale 1', 10000, 12000, 2000, 'History Test Customer')
      `, [testUser.id]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'expense', 'cleared', '2026-01-10', 'Refund', 3000, 3600, 600, 'History Test Customer')
      `, [testUser.id]);
    });

    it('should return customer summary with correct calculations', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const summary = response.body.data;
      
      // Basic customer info
      expect(summary.customerId).toBe(customerId);
      expect(summary.customerName).toBe('History Test Customer');
      
      // Invoice summary - total invoiced should include all invoices
      expect(summary.invoices.totalCount).toBe(4);
      expect(summary.invoices.totalInvoiced).toBe(50000); // 12000 + 24000 + 6000 + 8000
      expect(summary.invoices.totalPaid).toBe(12000);
      
      // Outstanding balance: pending + overdue = 24000 + 6000 = 30000
      expect(summary.invoices.outstandingBalance).toBe(30000);
      
      // Status breakdown
      expect(summary.invoices.statusBreakdown.paid).toBe(1);
      expect(summary.invoices.statusBreakdown.pending).toBe(1);
      expect(summary.invoices.statusBreakdown.draft).toBe(1);
      
      // Transaction summary
      expect(summary.transactions.totalCount).toBe(2);
      expect(summary.transactions.totalIncome).toBe(12000);
      expect(summary.transactions.totalExpenses).toBe(3600);
      expect(summary.transactions.netAmount).toBe(8400); // 12000 - 3600
    });

    it('should calculate available credit correctly', async () => {
      // Update customer with credit limit
      await request(app)
        .put(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ creditLimit: 50000 });

      const response = await request(app)
        .get(`/api/customers/${customerId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const summary = response.body.data;
      
      // Available credit = creditLimit - outstandingBalance
      // 50000 - 30000 = 20000
      expect(summary.creditLimit).toBe(50000);
      expect(summary.availableCredit).toBe(20000);
    });

    it('should return zero values for customer with no history', async () => {
      // Create a new customer with no invoices or transactions directly in database
      const { execute, queryOne } = require('../database/index');
      execute(`
        INSERT INTO customers (userId, customerNumber, name, status, country, currency, paymentTerms, creditLimit)
        VALUES (?, 'CUST-0002', 'New Customer No History', 'active', 'GB', 'GBP', 30, 0)
      `, [testUser.id]);
      
      const newCustomer = queryOne('SELECT id FROM customers WHERE userId = ? AND name = ?', [testUser.id, 'New Customer No History']);
      const newCustomerId = newCustomer.id;

      const response = await request(app)
        .get(`/api/customers/${newCustomerId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const summary = response.body.data;
      
      expect(summary.invoices.totalCount).toBe(0);
      expect(summary.invoices.totalInvoiced).toBe(0);
      expect(summary.invoices.outstandingBalance).toBe(0);
      expect(summary.transactions.totalCount).toBe(0);
      expect(summary.transactions.totalIncome).toBe(0);
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/customers/99999/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 when accessing another user\'s customer', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/summary`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/summary`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Date Validation', () => {
    it('should reject invalid date format for startDate', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?startDate=01-01-2026`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid date format for endDate', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/invoices?endDate=invalid-date`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept valid date range', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?startDate=2026-01-01&endDate=2026-12-31`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      const { execute } = require('../database/index');
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-01', 'First', 10000, 12000, 2000, 'History Test Customer')
      `, [testUser.id]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-15', 'Second', 30000, 36000, 6000, 'History Test Customer')
      `, [testUser.id]);
    });

    it('should sort transactions by amount ascending', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?sortBy=totalAmount&sortOrder=ASC`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      expect(transactions[0].totalAmount).toBeLessThanOrEqual(transactions[1].totalAmount);
    });

    it('should sort transactions by amount descending', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?sortBy=totalAmount&sortOrder=DESC`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      expect(transactions[0].totalAmount).toBeGreaterThanOrEqual(transactions[1].totalAmount);
    });

    it('should default to descending order', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}/transactions?sortBy=transactionDate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      expect(new Date(transactions[0].transactionDate) >= new Date(transactions[1].transactionDate)).toBe(true);
    });
  });
});
