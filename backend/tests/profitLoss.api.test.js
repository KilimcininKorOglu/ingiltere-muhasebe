/**
 * API integration tests for Profit & Loss Report endpoints.
 * Tests P&L report generation operations.
 * 
 * @module tests/profitLoss.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../app');
const { openDatabase, closeDatabase, execute } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-profit-loss-api-database.sqlite');

// Store test tokens and IDs
let authToken;
let testUserId;

/**
 * Setup test database before all tests.
 */
beforeAll(async () => {
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
  
  // Create a test user and get auth token
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'profitloss-test@example.com',
      password: 'TestPassword123!',
      name: 'Profit Loss Test User'
    });
  
  if (registerRes.status === 201) {
    authToken = registerRes.body.data.token;
    testUserId = registerRes.body.data.user.id;
  } else {
    // User might already exist, try login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'profitloss-test@example.com',
        password: 'TestPassword123!'
      });
    
    authToken = loginRes.body.data.token;
    testUserId = loginRes.body.data.user.id;
  }
  
  // Create test categories
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (200, 'PL-SALES', 'Sales', 'Satışlar', 'income', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (201, 'PL-SERVICES', 'Services', 'Hizmetler', 'income', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (202, 'PL-RENT', 'Rent', 'Kira', 'expense', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (203, 'PL-UTILITIES', 'Utilities', 'Yardımcı Hizmetler', 'expense', 0, 1, 2)
  `);
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
  execute('DELETE FROM transactions WHERE userId = ?', [testUserId]);
});

describe('Profit & Loss API', () => {
  describe('GET /api/reports/profit-loss', () => {
    test('should get P&L report for date range', async () => {
      // Create test transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Sale 1', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 202, 'expense', 'cleared', '2025-01-10', 'Rent', 40000, 0, 40000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check period info
      expect(res.body.data.period.startDate).toBe('2025-01-01');
      expect(res.body.data.period.endDate).toBe('2025-01-31');
      
      // Check income
      expect(res.body.data.income.total.amount).toBe(100000);
      expect(res.body.data.income.categories).toHaveLength(1);
      
      // Check expenses
      expect(res.body.data.expenses.total.amount).toBe(40000);
      expect(res.body.data.expenses.categories).toHaveLength(1);
      
      // Check summary
      expect(res.body.data.summary.totalRevenue).toBe(100000);
      expect(res.body.data.summary.totalExpenses).toBe(40000);
      expect(res.body.data.summary.netProfit).toBe(60000);
      expect(res.body.data.summary.profitMargin).toBe(60);
    });

    test('should return empty report when no transactions exist', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-06-01',
          endDate: '2025-06-30'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalRevenue).toBe(0);
      expect(res.body.data.summary.totalExpenses).toBe(0);
      expect(res.body.data.summary.netProfit).toBe(0);
      expect(res.body.data.income.categories).toHaveLength(0);
      expect(res.body.data.expenses.categories).toHaveLength(0);
    });

    test('should include comparison when requested', async () => {
      // Current period
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-02-15', 'Feb Sale', 150000, 30000, 180000)
      `, [testUserId]);
      
      // Previous period
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Jan Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-02-01',
          endDate: '2025-02-28',
          includeComparison: 'true'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.comparison).toBeDefined();
      expect(res.body.data.comparison.previous.totalRevenue).toBe(100000);
      expect(res.body.data.comparison.changes.revenueChange).toBe(50000);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.status).toBe(401);
    });

    test('should fail without start date', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          endDate: '2025-01-31'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail without end date', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid date format', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '01-01-2025',
          endDate: '31-01-2025'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail when start date is after end date', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-02-01',
          endDate: '2025-01-01'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reports/profit-loss/tax-year/:taxYear', () => {
    test('should get P&L report for tax year', async () => {
      // Create transaction in tax year 2025-26
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-05-15', 'May Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss/tax-year/2025-26')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.startDate).toBe('2025-04-06');
      expect(res.body.data.period.endDate).toBe('2026-04-05');
      expect(res.body.data.period.taxYear).toBe('2025-26');
      expect(res.body.data.income.total.amount).toBe(100000);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/tax-year/2025-26');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid tax year format', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/tax-year/2025')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid tax year sequence', async () => {
      // 2025-27 is invalid (should be 2025-26)
      const res = await request(app)
        .get('/api/reports/profit-loss/tax-year/2025-27')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reports/profit-loss/monthly/:year/:month', () => {
    test('should get P&L report for specific month', async () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Jan Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss/monthly/2025/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.startDate).toBe('2025-01-01');
      expect(res.body.data.period.endDate).toBe('2025-01-31');
      expect(res.body.meta.monthName).toBe('January');
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/monthly/2025/1');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid year', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/monthly/1999/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid month (too low)', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/monthly/2025/0')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid month (too high)', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/monthly/2025/13')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reports/profit-loss/quarterly/:year/:quarter', () => {
    test('should get P&L report for Q1', async () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-02-15', 'Q1 Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss/quarterly/2025/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.startDate).toBe('2025-01-01');
      expect(res.body.data.period.endDate).toBe('2025-03-31');
      expect(res.body.meta.quarter).toBe(1);
      expect(res.body.meta.quarterName).toBe('Q1');
    });

    test('should get P&L report for Q4', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/quarterly/2025/4')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.period.startDate).toBe('2025-10-01');
      expect(res.body.data.period.endDate).toBe('2025-12-31');
      expect(res.body.meta.quarter).toBe(4);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/quarterly/2025/1');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid year', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/quarterly/1999/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
    });

    test('should fail with invalid quarter (too low)', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/quarterly/2025/0')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
    });

    test('should fail with invalid quarter (too high)', async () => {
      const res = await request(app)
        .get('/api/reports/profit-loss/quarterly/2025/5')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
    });
  });

  describe('P&L Report Calculations', () => {
    test('should group income by category correctly', async () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Sale 1', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-16', 'Sale 2', 50000, 10000, 60000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 201, 'income', 'cleared', '2025-01-20', 'Service', 75000, 15000, 90000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.body.data.income.categories).toHaveLength(2);
      
      const salesCategory = res.body.data.income.categories.find(c => c.categoryCode === 'PL-SALES');
      expect(salesCategory.amount).toBe(150000);
      expect(salesCategory.transactionCount).toBe(2);
      
      const servicesCategory = res.body.data.income.categories.find(c => c.categoryCode === 'PL-SERVICES');
      expect(servicesCategory.amount).toBe(75000);
      expect(servicesCategory.transactionCount).toBe(1);
    });

    test('should group expenses by category correctly', async () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 202, 'expense', 'cleared', '2025-01-10', 'Rent', 40000, 0, 40000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 203, 'expense', 'cleared', '2025-01-15', 'Electric', 10000, 500, 10500)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 203, 'expense', 'cleared', '2025-01-20', 'Gas', 5000, 250, 5250)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.body.data.expenses.categories).toHaveLength(2);
      
      const rentCategory = res.body.data.expenses.categories.find(c => c.categoryCode === 'PL-RENT');
      expect(rentCategory.amount).toBe(40000);
      expect(rentCategory.transactionCount).toBe(1);
      
      const utilitiesCategory = res.body.data.expenses.categories.find(c => c.categoryCode === 'PL-UTILITIES');
      expect(utilitiesCategory.amount).toBe(15000);
      expect(utilitiesCategory.transactionCount).toBe(2);
    });

    test('should calculate net profit correctly for loss', async () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Sale', 50000, 10000, 60000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 202, 'expense', 'cleared', '2025-01-10', 'Rent', 80000, 0, 80000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.body.data.summary.netProfit).toBe(-30000);
      expect(res.body.data.summary.profitMargin).toBe(-60);
    });

    test('should include monthly summary in report', async () => {
      // January
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Jan Sale', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 202, 'expense', 'cleared', '2025-01-15', 'Jan Rent', 30000, 0, 30000)
      `, [testUserId]);

      // February
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-02-15', 'Feb Sale', 150000, 30000, 180000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 202, 'expense', 'cleared', '2025-02-15', 'Feb Rent', 30000, 0, 30000)
      `, [testUserId]);

      const res = await request(app)
        .get('/api/reports/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-02-28'
        });
      
      expect(res.body.data.monthlySummary).toHaveLength(2);
      
      const january = res.body.data.monthlySummary.find(m => m.month === '01');
      expect(january.monthName).toBe('January');
      expect(january.income.amount).toBe(100000);
      expect(january.expense.amount).toBe(30000);
      expect(january.netProfit).toBe(70000);
      
      const february = res.body.data.monthlySummary.find(m => m.month === '02');
      expect(february.monthName).toBe('February');
      expect(february.income.amount).toBe(150000);
      expect(february.expense.amount).toBe(30000);
      expect(february.netProfit).toBe(120000);
    });
  });
});
