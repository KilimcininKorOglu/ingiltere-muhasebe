/**
 * Unit tests for Supplier Transaction History API endpoints.
 * Tests transaction history retrieval with filtering and summary calculations.
 * 
 * @module tests/supplierHistory.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-supplier-history-${workerId}.sqlite`);

// Test user data
let testUser;
let otherUser;
let authToken;
let otherAuthToken;
let db;
let app;
let supplierId;
let categoryId;

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
    email: `testuser-supplier-history-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Test User'
  });
  
  testUser = result.data;
  authToken = generateToken(testUser);
  
  // Create a second user for access control tests
  const otherResult = await createUser({
    email: `otheruser-supplier-history-${workerId}@example.com`,
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
  const { executeMany, execute, queryOne } = require('../database/index');
  executeMany('DELETE FROM transactions;');
  executeMany('DELETE FROM suppliers;');
  
  // Create a test category for filtering
  const existingCategory = queryOne('SELECT id FROM categories WHERE code = ?', ['TEST-CAT']);
  if (!existingCategory) {
    execute(`
      INSERT INTO categories (code, name, type, isSystem, isActive)
      VALUES ('TEST-CAT', 'Test Category', 'expense', 0, 1)
    `);
  }
  const category = queryOne('SELECT id FROM categories WHERE code = ?', ['TEST-CAT']);
  categoryId = category.id;
  
  // Create a test supplier directly in the database
  execute(`
    INSERT INTO suppliers (userId, name, status, country, currency, paymentTerms, isVatRegistered, vatNumber, defaultExpenseCategory)
    VALUES (?, 'History Test Supplier', 'active', 'United Kingdom', 'GBP', 'net30', 1, 'GB123456789', 'Office Supplies')
  `, [testUser.id]);
  
  // Get the supplier ID
  const supplier = queryOne('SELECT id FROM suppliers WHERE userId = ? AND name = ?', [testUser.id, 'History Test Supplier']);
  supplierId = supplier.id;
});

describe('Supplier Transaction History API', () => {
  describe('GET /api/suppliers/:id/transactions', () => {
    beforeEach(() => {
      const { execute } = require('../database/index');
      
      // Create test expense transactions for the supplier
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee, categoryId)
        VALUES (?, 'expense', 'cleared', '2026-01-01', 'Purchase 1', 10000, 12000, 2000, 'History Test Supplier', ?)
      `, [testUser.id, categoryId]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee, categoryId)
        VALUES (?, 'expense', 'cleared', '2026-01-05', 'Purchase 2', 20000, 24000, 4000, 'History Test Supplier', ?)
      `, [testUser.id, categoryId]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-10', 'Credit Note', 5000, 6000, 1000, 'History Test Supplier')
      `, [testUser.id]);
      
      // Create a transaction for another payee (should not be returned)
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'expense', 'cleared', '2026-01-15', 'Other Purchase', 15000, 18000, 3000, 'Other Supplier')
      `, [testUser.id]);
    });

    it('should return transaction history for a supplier', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(3);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.supplierId).toBe(supplierId);
      expect(response.body.data.supplierName).toBe('History Test Supplier');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(2);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?categoryId=${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(2);
      response.body.data.transactions.forEach(txn => {
        expect(txn.categoryId).toBe(categoryId);
      });
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?startDate=2026-01-05&endDate=2026-01-10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(2);
    });

    it('should reject invalid date range', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?startDate=2026-01-15&endDate=2026-01-01`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent supplier', async () => {
      const response = await request(app)
        .get('/api/suppliers/99999/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });

    it('should return 403 when accessing another user\'s supplier', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHZ_RESOURCE_OWNER_ONLY');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/suppliers/:id/summary', () => {
    beforeEach(() => {
      const { execute } = require('../database/index');
      
      // Create test expense transactions
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee, categoryId)
        VALUES (?, 'expense', 'cleared', '2026-01-01', 'Purchase 1', 10000, 12000, 2000, 'History Test Supplier', ?)
      `, [testUser.id, categoryId]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee, categoryId)
        VALUES (?, 'expense', 'pending', '2026-01-15', 'Purchase 2', 20000, 24000, 4000, 'History Test Supplier', ?)
      `, [testUser.id, categoryId]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'expense', 'reconciled', '2026-01-20', 'Purchase 3', 15000, 18000, 3000, 'History Test Supplier')
      `, [testUser.id]);
      
      // Credit note (income type)
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'income', 'cleared', '2026-01-10', 'Credit Note', 5000, 6000, 1000, 'History Test Supplier')
      `, [testUser.id]);
      
      // Void transaction (should not be included in totals)
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'expense', 'void', '2026-01-25', 'Voided Purchase', 8000, 9600, 1600, 'History Test Supplier')
      `, [testUser.id]);
    });

    it('should return supplier summary with correct calculations', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const summary = response.body.data;
      
      // Basic supplier info
      expect(summary.supplierId).toBe(supplierId);
      expect(summary.supplierName).toBe('History Test Supplier');
      expect(summary.isVatRegistered).toBe(true);
      expect(summary.vatNumber).toBe('GB123456789');
      
      // Expense summary - total should include all non-void expenses
      expect(summary.expenses.totalCount).toBe(5); // All 5 transactions
      expect(summary.expenses.totalExpensesGross).toBe(54000); // 12000 + 24000 + 18000 (excludes void)
      expect(summary.expenses.totalExpensesNet).toBe(45000); // 10000 + 20000 + 15000 (excludes void)
      
      // VAT reclaimed from expenses
      expect(summary.expenses.vatReclaimed).toBe(9000); // 2000 + 4000 + 3000 (excludes void)
      
      // Total credits (income type transactions)
      expect(summary.expenses.totalCredits).toBe(6000);
      
      // Net expenses = gross expenses - credits
      expect(summary.expenses.netExpenses).toBe(48000); // 54000 - 6000
      
      // Status breakdown
      expect(summary.expenses.statusBreakdown.pending).toBe(1);
      expect(summary.expenses.statusBreakdown.cleared).toBe(2);
      expect(summary.expenses.statusBreakdown.reconciled).toBe(1);
      expect(summary.expenses.statusBreakdown.void).toBe(1);
    });

    it('should include category breakdown', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const summary = response.body.data;
      
      // Category breakdown should exist
      expect(summary.categoryBreakdown).toBeDefined();
      expect(Array.isArray(summary.categoryBreakdown)).toBe(true);
      
      // Should have at least one category
      const testCategoryBreakdown = summary.categoryBreakdown.find(c => c.categoryId === categoryId);
      expect(testCategoryBreakdown).toBeDefined();
      expect(testCategoryBreakdown.transactionCount).toBe(2);
      expect(testCategoryBreakdown.totalAmount).toBe(36000); // 12000 + 24000
      expect(testCategoryBreakdown.vatAmount).toBe(6000); // 2000 + 4000
    });

    it('should return zero values for supplier with no history', async () => {
      // Create a new supplier with no transactions
      const { execute, queryOne } = require('../database/index');
      execute(`
        INSERT INTO suppliers (userId, name, status, country, currency, paymentTerms)
        VALUES (?, 'New Supplier No History', 'active', 'United Kingdom', 'GBP', 'net30')
      `, [testUser.id]);
      
      const newSupplier = queryOne('SELECT id FROM suppliers WHERE userId = ? AND name = ?', [testUser.id, 'New Supplier No History']);
      const newSupplierId = newSupplier.id;

      const response = await request(app)
        .get(`/api/suppliers/${newSupplierId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const summary = response.body.data;
      
      expect(summary.expenses.totalCount).toBe(0);
      expect(summary.expenses.totalExpensesGross).toBe(0);
      expect(summary.expenses.vatReclaimed).toBe(0);
      expect(summary.categoryBreakdown.length).toBe(0);
    });

    it('should return 404 for non-existent supplier', async () => {
      const response = await request(app)
        .get('/api/suppliers/99999/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 when accessing another user\'s supplier', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/summary`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/summary`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Date Validation', () => {
    it('should reject invalid date format for startDate', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?startDate=01-01-2026`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid date format for endDate', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?endDate=invalid-date`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept valid date range', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?startDate=2026-01-01&endDate=2026-12-31`)
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
        VALUES (?, 'expense', 'cleared', '2026-01-01', 'First', 10000, 12000, 2000, 'History Test Supplier')
      `, [testUser.id]);
      
      execute(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, totalAmount, vatAmount, payee)
        VALUES (?, 'expense', 'cleared', '2026-01-15', 'Second', 30000, 36000, 6000, 'History Test Supplier')
      `, [testUser.id]);
    });

    it('should sort transactions by amount ascending', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?sortBy=totalAmount&sortOrder=ASC`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      expect(transactions[0].totalAmount).toBeLessThanOrEqual(transactions[1].totalAmount);
    });

    it('should sort transactions by amount descending', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?sortBy=totalAmount&sortOrder=DESC`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      expect(transactions[0].totalAmount).toBeGreaterThanOrEqual(transactions[1].totalAmount);
    });

    it('should default to descending order', async () => {
      const response = await request(app)
        .get(`/api/suppliers/${supplierId}/transactions?sortBy=transactionDate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data.transactions;
      expect(new Date(transactions[0].transactionDate) >= new Date(transactions[1].transactionDate)).toBe(true);
    });
  });
});
