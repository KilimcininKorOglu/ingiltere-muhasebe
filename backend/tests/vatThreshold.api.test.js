/**
 * Integration Tests for VAT Threshold API Endpoints
 * 
 * Tests the VAT registration threshold monitoring endpoints including:
 * - GET /api/vat/threshold-status
 * - GET /api/vat/threshold-config
 * - GET /api/vat/dashboard-summary
 * - GET /api/vat/turnover-breakdown
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const { generateToken } = require('../utils/jwt');
const { createUser } = require('../database/models/User');
const { createTransaction } = require('../database/models/Transaction');
const app = require('../app');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-vat-threshold-api-database.sqlite');

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
 * Clean up tables before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM transactions;');
  executeMany('DELETE FROM users;');
});

/**
 * Creates a test user and returns user data with token.
 */
async function createTestUser(overrides = {}) {
  const userData = {
    email: 'test@example.com',
    password: 'TestPass123',
    name: 'Test User',
    isVatRegistered: false,
    ...overrides
  };
  
  const result = await createUser(userData);
  expect(result.success).toBe(true);
  
  // generateToken requires user object with id and email
  const token = generateToken({ id: result.data.id, email: result.data.email });
  
  return { user: result.data, token };
}

/**
 * Creates test income transactions for a user.
 */
function createTestTransactions(userId, transactions) {
  for (const txn of transactions) {
    const result = createTransaction({
      userId,
      type: 'income',
      status: 'cleared',
      transactionDate: txn.date,
      description: txn.description || 'Test income',
      amount: txn.amount,
      vatAmount: txn.vatAmount || 0,
      totalAmount: txn.amount + (txn.vatAmount || 0),
      currency: 'GBP'
    });
    expect(result.success).toBe(true);
  }
}

describe('VAT Threshold API', () => {
  describe('GET /api/vat/threshold-status', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/vat/threshold-status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should return threshold status for authenticated user', async () => {
      const { token } = await createTestUser();

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isVatRegistered');
      expect(response.body.data).toHaveProperty('requiresMonitoring');
      expect(response.body.data).toHaveProperty('turnover');
      expect(response.body.data).toHaveProperty('projection');
      expect(response.body.data).toHaveProperty('threshold');
      expect(response.body.data).toHaveProperty('warning');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should show requiresMonitoring as true for non-VAT-registered users', async () => {
      const { token } = await createTestUser({ isVatRegistered: false });

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.isVatRegistered).toBe(false);
      expect(response.body.data.requiresMonitoring).toBe(true);
    });

    it('should show requiresMonitoring as false for VAT-registered users', async () => {
      const { token } = await createTestUser({ 
        isVatRegistered: true,
        vatNumber: 'GB123456789'
      });

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.isVatRegistered).toBe(true);
      expect(response.body.data.requiresMonitoring).toBe(false);
    });

    it('should calculate rolling 12-month turnover correctly', async () => {
      const { user, token } = await createTestUser();
      
      // Create income transactions (amounts in pence)
      const today = new Date();
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      createTestTransactions(user.id, [
        { date: sixMonthsAgo.toISOString().split('T')[0], amount: 2000000 }, // £20,000
        { date: today.toISOString().split('T')[0], amount: 3000000 } // £30,000
      ]);

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.turnover.rolling12Month).toBe(5000000); // £50,000
      expect(response.body.data.turnover.transactionCount).toBe(2);
    });

    it('should return Turkish messages when lang=tr', async () => {
      const { token } = await createTestUser();

      const response = await request(app)
        .get('/api/vat/threshold-status?lang=tr')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.meta.language).toBe('tr');
    });

    it('should return 400 for invalid asOfDate format', async () => {
      const { token } = await createTestUser();

      const response = await request(app)
        .get('/api/vat/threshold-status?asOfDate=invalid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/vat/threshold-config', () => {
    it('should return threshold configuration (public endpoint)', async () => {
      const response = await request(app)
        .get('/api/vat/threshold-config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('registrationThreshold');
      expect(response.body.data).toHaveProperty('deregistrationThreshold');
      expect(response.body.data).toHaveProperty('warningLevels');
      expect(response.body.data).toHaveProperty('notes');
    });

    it('should return correct threshold amounts', async () => {
      const response = await request(app)
        .get('/api/vat/threshold-config')
        .expect(200);

      expect(response.body.data.registrationThreshold.amount).toBe(90000);
      expect(response.body.data.registrationThreshold.amountPence).toBe(9000000);
      expect(response.body.data.registrationThreshold.currency).toBe('GBP');
      expect(response.body.data.deregistrationThreshold.amount).toBe(88000);
    });

    it('should include warning level percentages', async () => {
      const response = await request(app)
        .get('/api/vat/threshold-config')
        .expect(200);

      const { warningLevels } = response.body.data;
      expect(warningLevels.approaching.percentage).toBe(0.75);
      expect(warningLevels.imminent.percentage).toBe(0.90);
      expect(warningLevels.exceeded.percentage).toBe(1.00);
    });
  });

  describe('GET /api/vat/dashboard-summary', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/vat/dashboard-summary')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return dashboard summary for non-VAT-registered user', async () => {
      const { token } = await createTestUser({ isVatRegistered: false });

      const response = await request(app)
        .get('/api/vat/dashboard-summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isVatRegistered).toBe(false);
      expect(response.body.data.requiresMonitoring).toBe(true);
      expect(response.body.data).toHaveProperty('showWarning');
      expect(response.body.data).toHaveProperty('headline');
      expect(response.body.data).toHaveProperty('details');
    });

    it('should return simple status for VAT-registered user', async () => {
      const { token } = await createTestUser({ 
        isVatRegistered: true,
        vatNumber: 'GB123456789'
      });

      const response = await request(app)
        .get('/api/vat/dashboard-summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.isVatRegistered).toBe(true);
      expect(response.body.data.requiresMonitoring).toBe(false);
      expect(response.body.data).toHaveProperty('message');
    });
  });

  describe('GET /api/vat/turnover-breakdown', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/vat/turnover-breakdown')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return turnover breakdown for authenticated user', async () => {
      const { token } = await createTestUser();

      const response = await request(app)
        .get('/api/vat/turnover-breakdown')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('monthlyBreakdown');
      expect(response.body.data).toHaveProperty('threshold');
      expect(response.body.data).toHaveProperty('projection');
    });

    it('should include monthly breakdown with correct totals', async () => {
      const { user, token } = await createTestUser();
      
      const today = new Date();
      createTestTransactions(user.id, [
        { date: today.toISOString().split('T')[0], amount: 5000000 }
      ]);

      const response = await request(app)
        .get('/api/vat/turnover-breakdown')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.total.amount).toBe(5000000);
      expect(response.body.data.total.transactionCount).toBe(1);
    });
  });

  describe('Warning Level Scenarios', () => {
    it('should show no warning below 75% of threshold', async () => {
      const { user, token } = await createTestUser();
      
      // 50% of £90,000 = £45,000 = 4,500,000 pence
      const today = new Date();
      createTestTransactions(user.id, [
        { date: today.toISOString().split('T')[0], amount: 4500000 }
      ]);

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.warning.level).toBe('none');
      expect(response.body.data.summary.showWarning).toBe(false);
    });

    it('should show approaching warning at 75-90% of threshold', async () => {
      const { user, token } = await createTestUser();
      
      // 80% of £90,000 = £72,000 = 7,200,000 pence
      const today = new Date();
      createTestTransactions(user.id, [
        { date: today.toISOString().split('T')[0], amount: 7200000 }
      ]);

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.warning.level).toBe('approaching');
      expect(response.body.data.summary.showWarning).toBe(true);
    });

    it('should show imminent warning at 90-100% of threshold', async () => {
      const { user, token } = await createTestUser();
      
      // 95% of £90,000 = £85,500 = 8,550,000 pence
      const today = new Date();
      createTestTransactions(user.id, [
        { date: today.toISOString().split('T')[0], amount: 8550000 }
      ]);

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.warning.level).toBe('imminent');
      expect(response.body.data.summary.showWarning).toBe(true);
    });

    it('should show exceeded warning at 100%+ of threshold', async () => {
      const { user, token } = await createTestUser();
      
      // 110% of £90,000 = £99,000 = 9,900,000 pence
      const today = new Date();
      createTestTransactions(user.id, [
        { date: today.toISOString().split('T')[0], amount: 9900000 }
      ]);

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.warning.level).toBe('exceeded');
      expect(response.body.data.summary.showWarning).toBe(true);
    });

    it('should not show warning for VAT-registered users regardless of turnover', async () => {
      const { user, token } = await createTestUser({ 
        isVatRegistered: true,
        vatNumber: 'GB123456789'
      });
      
      // 150% of £90,000 = £135,000 = 13,500,000 pence
      const today = new Date();
      createTestTransactions(user.id, [
        { date: today.toISOString().split('T')[0], amount: 13500000 }
      ]);

      const response = await request(app)
        .get('/api/vat/threshold-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.isVatRegistered).toBe(true);
      expect(response.body.data.requiresMonitoring).toBe(false);
      expect(response.body.data.warning.level).toBe('none');
    });
  });
});
