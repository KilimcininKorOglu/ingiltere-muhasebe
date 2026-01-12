/**
 * API integration tests for Dashboard endpoints.
 * Tests dashboard summary and metrics operations.
 * 
 * @module tests/dashboard.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../app');
const { openDatabase, closeDatabase, execute } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-dashboard-api-database.sqlite');

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
      email: 'dashboard-api-test@example.com',
      password: 'TestPassword123!',
      name: 'Dashboard API Test User'
    });
  
  if (registerRes.status === 201) {
    authToken = registerRes.body.data.token;
    testUserId = registerRes.body.data.user.id;
  } else {
    // User might already exist, try login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'dashboard-api-test@example.com',
        password: 'TestPassword123!'
      });
    
    authToken = loginRes.body.data.token;
    testUserId = loginRes.body.data.user.id;
  }
  
  // Create test categories
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (400, 'DA-SALES', 'Sales', 'Satışlar', 'income', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (401, 'DA-RENT', 'Rent', 'Kira', 'expense', 0, 1, 1)
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
 * Clean up data before each test.
 */
beforeEach(() => {
  execute('DELETE FROM transactions WHERE userId = ?', [testUserId]);
  execute('DELETE FROM invoices WHERE userId = ?', [testUserId]);
  execute('DELETE FROM payroll_entries WHERE userId = ?', [testUserId]);
  execute('DELETE FROM employees WHERE userId = ?', [testUserId]);
  execute('DELETE FROM bank_accounts WHERE userId = ?', [testUserId]);
});

describe('Dashboard API', () => {
  describe('GET /api/dashboard/summary', () => {
    test('should get full dashboard summary', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check overview structure
      expect(res.body.data.overview).toBeDefined();
      expect(res.body.data.overview.currentMonth).toBeDefined();
      expect(res.body.data.overview.accountBalance).toBeDefined();
      
      // Check invoices structure
      expect(res.body.data.invoices).toBeDefined();
      expect(res.body.data.invoices.outstanding).toBeDefined();
      expect(res.body.data.invoices.overdue).toBeDefined();
      
      // Check payroll structure
      expect(res.body.data.payroll).toBeDefined();
      expect(res.body.data.payroll.taxYear).toBeDefined();
      
      // Check VAT status structure
      expect(res.body.data.vatStatus).toBeDefined();
      
      // Check alerts array
      expect(res.body.data.alerts).toBeDefined();
      expect(Array.isArray(res.body.data.alerts)).toBe(true);
      
      // Check recent activity
      expect(res.body.data.recentActivity).toBeDefined();
      expect(res.body.data.recentActivity.transactions).toBeDefined();
      expect(res.body.data.recentActivity.invoices).toBeDefined();
      expect(res.body.data.recentActivity.payroll).toBeDefined();
    });

    test('should include transaction data in summary', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create income transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 400, 'income', 'cleared', ?, 'Test Sale', 100000, 20000, 120000)
      `, [testUserId, today]);
      
      // Create expense transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 401, 'expense', 'cleared', ?, 'Test Rent', 30000, 0, 30000)
      `, [testUserId, today]);
      
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.overview.currentMonth.income).toBe(100000);
      expect(res.body.data.overview.currentMonth.expenses).toBe(30000);
      expect(res.body.data.overview.currentMonth.netCashFlow).toBe(70000);
    });

    test('should exclude recent activity when requested', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ includeRecentActivity: 'false' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.recentActivity).toBeUndefined();
    });

    test('should respect activity limits', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create multiple transactions
      for (let i = 0; i < 15; i++) {
        execute(`
          INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
          VALUES (?, 400, 'income', 'cleared', ?, 'Sale ${i}', ${10000 + i * 1000}, ${2000 + i * 200}, ${12000 + i * 1200})
        `, [testUserId, today]);
      }
      
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ recentTransactionsLimit: 5 });
      
      expect(res.status).toBe(200);
      expect(res.body.data.recentActivity.transactions.length).toBe(5);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid transaction limit', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ recentTransactionsLimit: 100 });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/dashboard/quick-summary', () => {
    test('should get quick summary', async () => {
      const res = await request(app)
        .get('/api/dashboard/quick-summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check compact structure
      expect(res.body.data.monthlyIncome).toBeDefined();
      expect(res.body.data.monthlyExpenses).toBeDefined();
      expect(res.body.data.netCashFlow).toBeDefined();
      expect(res.body.data.totalBalance).toBeDefined();
      expect(res.body.data.outstandingInvoices).toBeDefined();
      expect(res.body.data.overdueInvoices).toBeDefined();
      expect(res.body.data.vatThresholdPercentage).toBeDefined();
      expect(res.body.data.vatWarningLevel).toBeDefined();
      expect(res.body.data.alertCount).toBeDefined();
      expect(res.body.data.hasUrgentAlerts).toBeDefined();
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/quick-summary');
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/monthly-summary', () => {
    test('should get monthly summary', async () => {
      const res = await request(app)
        .get('/api/dashboard/monthly-summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check structure
      expect(res.body.data.period).toBeDefined();
      expect(res.body.data.period.startDate).toBeDefined();
      expect(res.body.data.period.endDate).toBeDefined();
      expect(res.body.data.period.monthName).toBeDefined();
      expect(res.body.data.income).toBeDefined();
      expect(res.body.data.expenses).toBeDefined();
      expect(res.body.data.netCashFlow).toBeDefined();
    });

    test('should reflect current month transactions', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 400, 'income', 'cleared', ?, 'Monthly Sale', 200000, 40000, 240000)
      `, [testUserId, today]);
      
      const res = await request(app)
        .get('/api/dashboard/monthly-summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.income.amount).toBe(200000);
      expect(res.body.data.income.transactionCount).toBe(1);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/monthly-summary');
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/alerts', () => {
    test('should get alerts', async () => {
      const res = await request(app)
        .get('/api/dashboard/alerts')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check structure
      expect(res.body.data.alerts).toBeDefined();
      expect(Array.isArray(res.body.data.alerts)).toBe(true);
      expect(res.body.data.totalCount).toBeDefined();
      expect(res.body.data.urgentCount).toBeDefined();
      expect(res.body.data.warningCount).toBeDefined();
      expect(res.body.data.infoCount).toBeDefined();
    });

    test('should generate overdue invoice alerts', async () => {
      // Create overdue invoices (using correct schema)
      for (let i = 0; i < 4; i++) {
        execute(`
          INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, customerEmail, totalAmount, createdAt, updatedAt)
          VALUES (?, 'OD-00${i}', 'pending', '2020-01-01', '2020-02-01', 'Customer ${i}', 'cust${i}@test.com', 50000, datetime('now'), datetime('now'))
        `, [testUserId]);
      }
      
      const res = await request(app)
        .get('/api/dashboard/alerts')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.alerts.length).toBeGreaterThan(0);
      
      const overdueAlert = res.body.data.alerts.find(
        a => a.category === 'invoices' && a.type === 'urgent'
      );
      expect(overdueAlert).toBeDefined();
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/alerts');
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/recent-activity', () => {
    test('should get recent activity', async () => {
      const res = await request(app)
        .get('/api/dashboard/recent-activity')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check structure
      expect(res.body.data.transactions).toBeDefined();
      expect(res.body.data.invoices).toBeDefined();
      expect(res.body.data.payroll).toBeDefined();
    });

    test('should return recent transactions', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 400, 'income', 'cleared', ?, 'Recent Sale', 150000, 30000, 180000)
      `, [testUserId, today]);
      
      const res = await request(app)
        .get('/api/dashboard/recent-activity')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(1);
      expect(res.body.data.transactions[0].description).toBe('Recent Sale');
      expect(res.body.data.transactions[0].amount).toBe(150000);
    });

    test('should respect limit parameters', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      for (let i = 0; i < 10; i++) {
        execute(`
          INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
          VALUES (?, 400, 'income', 'cleared', ?, 'Sale ${i}', ${10000 + i * 1000}, ${2000 + i * 200}, ${12000 + i * 1200})
        `, [testUserId, today]);
      }
      
      const res = await request(app)
        .get('/api/dashboard/recent-activity')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ transactionsLimit: 3 });
      
      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(3);
      expect(res.body.meta.limits.transactions).toBe(3);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/dashboard/recent-activity');
      
      expect(res.status).toBe(401);
    });
  });

  describe('Response Time Performance', () => {
    test('summary endpoint should respond within 500ms', async () => {
      const start = Date.now();
      
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      const duration = Date.now() - start;
      
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    test('quick-summary endpoint should respond within 300ms', async () => {
      const start = Date.now();
      
      const res = await request(app)
        .get('/api/dashboard/quick-summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      const duration = Date.now() - start;
      
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(300);
    });
  });
});
