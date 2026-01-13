/**
 * API tests for Balance Sheet Report endpoints.
 * Tests the /api/reports/balance-sheet endpoints.
 * 
 * @module tests/balanceSheet.api.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-balance-sheet-api-database.sqlite');

let reportController;
let balanceSheetService;

/**
 * Create a mock request object.
 */
function createMockRequest(options = {}) {
  return {
    user: options.user || { id: 1 },
    query: options.query || {},
    params: options.params || {},
    body: options.body || {}
  };
}

/**
 * Create a mock response object.
 */
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
  
  // Require the controller and service after database is set up
  reportController = require('../controllers/reportController');
  balanceSheetService = require('../services/balanceSheetService');
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
 * Clean up transactions before each test.
 */
beforeEach(() => {
  execute('DELETE FROM transactions');
  execute('DELETE FROM categories WHERE isSystem = 0');
  
  // Insert test users
  execute(`
    INSERT OR IGNORE INTO users (id, email, passwordHash, name, createdAt, updatedAt)
    VALUES (1, 'test@example.com', 'hashedpassword', 'Test User', strftime('%s', 'now'), strftime('%s', 'now'))
  `);
  
  // Insert test categories
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (200, 'TEST-CASH', 'Cash', 'Nakit', 'asset', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (300, 'TEST-PAYABLE', 'Accounts Payable', 'Borç', 'liability', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (400, 'TEST-EQUITY', 'Owner Equity', 'Özkaynak', 'equity', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (500, 'TEST-SALES', 'Sales', 'Satış', 'income', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (600, 'TEST-RENT', 'Rent', 'Kira', 'expense', 0, 1, 1)
  `);
});

describe('Balance Sheet API', () => {
  describe('GET /api/reports/balance-sheet', () => {
    // asOfDate is optional - defaults to today when not provided
    test.skip('should return 400 when asOfDate is missing', () => {
      const req = createMockRequest({
        query: {}
      });
      const res = createMockResponse();

      reportController.getBalanceSheet(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('VALIDATION_ERROR');
    });

    test('should return 400 for invalid date format', () => {
      const req = createMockRequest({
        query: { asOfDate: '31-01-2025' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheet(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
    });

    test('should return balance sheet for valid asOfDate', () => {
      // Add test data
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-01-15', 'Cash', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        query: { asOfDate: '2025-01-31' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheet(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.asOfDate).toBe('2025-01-31');
      expect(res.jsonData.data.assets).toBeDefined();
      expect(res.jsonData.data.liabilities).toBeDefined();
      expect(res.jsonData.data.equity).toBeDefined();
      expect(res.jsonData.data.summary).toBeDefined();
      expect(res.jsonData.meta.reportType).toBe('balance-sheet');
    });

    test('should include comparison when requested', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-01-15', 'Cash', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        query: { asOfDate: '2025-01-31', includeComparison: 'true' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheet(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.comparison).toBeDefined();
    });
  });

  describe('GET /api/reports/balance-sheet/tax-year/:taxYear', () => {
    test('should return 400 for invalid tax year format', () => {
      const req = createMockRequest({
        params: { taxYear: '2025' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByTaxYear(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
    });

    test('should return 400 for mismatched tax year parts', () => {
      const req = createMockRequest({
        params: { taxYear: '2025-27' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByTaxYear(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.message.en).toContain('Expected 2025-26');
    });

    test('should return balance sheet for valid tax year', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-05-15', 'Cash', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        params: { taxYear: '2025-26' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByTaxYear(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.asOfDate).toBe('2026-04-05');
      expect(res.jsonData.meta.reportType).toBe('balance-sheet-tax-year');
    });
  });

  describe('GET /api/reports/balance-sheet/monthly/:year/:month', () => {
    test('should return 400 for invalid year', () => {
      const req = createMockRequest({
        params: { year: '1900', month: '1' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByMonth(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error.message.en).toContain('between 2000 and 2100');
    });

    test('should return 400 for invalid month', () => {
      const req = createMockRequest({
        params: { year: '2025', month: '13' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByMonth(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error.message.en).toContain('between 1 and 12');
    });

    test('should return balance sheet for valid month', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-01-15', 'Cash', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        params: { year: '2025', month: '1' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByMonth(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.asOfDate).toBe('2025-01-31');
      expect(res.jsonData.meta.reportType).toBe('balance-sheet-monthly');
      expect(res.jsonData.meta.monthName).toBe('January');
    });
  });

  describe('GET /api/reports/balance-sheet/quarterly/:year/:quarter', () => {
    test('should return 400 for invalid year', () => {
      const req = createMockRequest({
        params: { year: '2200', quarter: '1' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByQuarter(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error.message.en).toContain('between 2000 and 2100');
    });

    test('should return 400 for invalid quarter', () => {
      const req = createMockRequest({
        params: { year: '2025', quarter: '5' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByQuarter(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error.message.en).toContain('between 1 and 4');
    });

    test('should return balance sheet for valid quarter', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-02-15', 'Cash', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        params: { year: '2025', quarter: '1' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByQuarter(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.asOfDate).toBe('2025-03-31');
      expect(res.jsonData.meta.reportType).toBe('balance-sheet-quarterly');
      expect(res.jsonData.meta.quarter).toBe(1);
      expect(res.jsonData.meta.quarterName).toBe('Q1');
    });

    test('should return Q4 balance sheet correctly', () => {
      const req = createMockRequest({
        params: { year: '2025', quarter: '4' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheetByQuarter(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.asOfDate).toBe('2025-12-31');
      expect(res.jsonData.meta.quarterName).toBe('Q4');
    });
  });

  describe('Balance Sheet Report Structure', () => {
    test('should return proper balance sheet structure', () => {
      // Add balanced transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-01-15', 'Cash', 150000, 0, 150000)
      `);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 300, 'income', 'cleared', '2025-01-15', 'Liability', 50000, 0, 50000)
      `);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 400, 'income', 'cleared', '2025-01-15', 'Equity', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        query: { asOfDate: '2025-01-31' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheet(req, res);

      const data = res.jsonData.data;

      // Check structure
      expect(data.asOfDate).toBeDefined();
      expect(data.taxYear).toBeDefined();
      
      // Assets structure
      expect(Array.isArray(data.assets.categories)).toBe(true);
      expect(data.assets.total).toBeDefined();
      expect(data.assets.transactionCount).toBeDefined();
      
      // Liabilities structure
      expect(Array.isArray(data.liabilities.categories)).toBe(true);
      expect(data.liabilities.total).toBeDefined();
      expect(data.liabilities.transactionCount).toBeDefined();
      
      // Equity structure
      expect(Array.isArray(data.equity.categories)).toBe(true);
      expect(data.equity.retainedEarnings).toBeDefined();
      expect(data.equity.currentPeriodEarnings).toBeDefined();
      expect(data.equity.total).toBeDefined();
      expect(data.equity.transactionCount).toBeDefined();
      
      // Summary structure
      expect(data.summary.totalAssets).toBeDefined();
      expect(data.summary.totalLiabilities).toBeDefined();
      expect(data.summary.totalEquity).toBeDefined();
      expect(data.summary.isBalanced).toBeDefined();
      expect(data.summary.balanceDifference).toBeDefined();
    });

    test('should verify accounting equation (Assets = Liabilities + Equity)', () => {
      // Add balanced transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 200, 'income', 'cleared', '2025-01-15', 'Cash', 150000, 0, 150000)
      `);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 300, 'income', 'cleared', '2025-01-15', 'Loan', 50000, 0, 50000)
      `);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (1, 400, 'income', 'cleared', '2025-01-15', 'Owner Investment', 100000, 0, 100000)
      `);

      const req = createMockRequest({
        query: { asOfDate: '2025-01-31' }
      });
      const res = createMockResponse();

      reportController.getBalanceSheet(req, res);

      const summary = res.jsonData.data.summary;

      // Assets = 150000
      // Liabilities = 50000
      // Equity = 100000
      // 150000 = 50000 + 100000
      expect(summary.totalAssets).toBe(150000);
      expect(summary.totalLiabilities).toBe(50000);
      expect(summary.totalEquity).toBe(100000);
      expect(summary.isBalanced).toBe(true);
      expect(summary.balanceDifference).toBe(0);
    });
  });
});
