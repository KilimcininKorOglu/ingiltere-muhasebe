/**
 * Integration tests for Transaction Audit Trail API.
 * Tests the GET /transactions/:id/history endpoint and audit logging.
 * 
 * @module tests/transactionAuditTrail.api.test
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const { generateToken } = require('../utils/jwt');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-audit-api-database.sqlite');

let authToken;
let testUserId;
let testTransactionId;

/**
 * Setup test database and create test data.
 */
beforeAll(() => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;

  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();

  // Create a test user
  const db = openDatabase();
  db.prepare(`
    INSERT INTO users (email, passwordHash, name, businessName)
    VALUES ('testauditapi@example.com', 'hashedpassword', 'Test Audit API User', 'Test Business')
  `).run();

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testauditapi@example.com');
  testUserId = user.id;

  // Generate auth token for the test user
  authToken = generateToken({ id: testUserId, email: 'testauditapi@example.com' });
});

/**
 * Clean up test database after all tests.
 */
afterAll(() => {
  try {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch (error) {
    console.error('Error cleaning up test database:', error.message);
  }
});

/**
 * Clean up transactions and audit logs before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM transaction_audit_log;');
  executeMany('DELETE FROM transactions;');
});

describe('Transaction Audit Trail API', () => {
  describe('Audit Log Creation on Transaction Operations', () => {
    test('should create audit log on transaction creation', async () => {
      // Create a transaction
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test expense for audit',
          amount: 5000
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      const transactionId = createResponse.body.data.id;

      // Check audit history
      const historyResponse = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.entries).toHaveLength(1);
      expect(historyResponse.body.data.entries[0].action).toBe('create');
      expect(historyResponse.body.data.entries[0].newValues).toBeDefined();
    });

    test('should create audit log on transaction update with previous values', async () => {
      // Create a transaction
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Original description',
          amount: 5000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      // Update the transaction
      await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          amount: 7500
        })
        .expect(200);

      // Check audit history
      const historyResponse = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.data.entries).toHaveLength(2);
      
      // Find the update entry (should be first due to DESC order)
      const updateEntry = historyResponse.body.data.entries.find(e => e.action === 'update');
      expect(updateEntry).toBeDefined();
      expect(updateEntry.previousValues.description).toBe('Original description');
      expect(updateEntry.previousValues.amount).toBe(5000);
      expect(updateEntry.newValues.description).toBe('Updated description');
      expect(updateEntry.newValues.amount).toBe(7500);
      expect(updateEntry.changedFields).toContain('description');
      expect(updateEntry.changedFields).toContain('amount');
    });

    test('should create audit log on transaction delete', async () => {
      // Create a transaction
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Transaction to delete',
          amount: 3000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      // Delete the transaction
      await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check audit history (transaction is deleted but audit log should remain)
      // We need to query the database directly since the transaction no longer exists
      const db = openDatabase();
      const auditLogs = db.prepare(
        'SELECT * FROM transaction_audit_log WHERE transactionId = ? ORDER BY createdAt DESC'
      ).all(transactionId);

      expect(auditLogs).toHaveLength(2);
      const deleteEntry = auditLogs.find(e => e.action === 'delete');
      expect(deleteEntry).toBeDefined();
      expect(JSON.parse(deleteEntry.previousValues)).toBeDefined();
      expect(deleteEntry.newValues).toBeNull();
    });
  });

  describe('GET /api/transactions/:id/history', () => {
    test('should return empty history for new transaction', async () => {
      // Create transaction directly in DB to avoid audit log
      const db = openDatabase();
      db.prepare(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, vatAmount, totalAmount, currency)
        VALUES (?, 'expense', 'pending', '2026-01-15', 'Direct insert', 1000, 0, 1000, 'GBP')
      `).run(testUserId);

      const txn = db.prepare('SELECT id FROM transactions WHERE description = ?').get('Direct insert');

      const response = await request(app)
        .get(`/api/transactions/${txn.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toHaveLength(0);
      expect(response.body.data.total).toBe(0);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/transactions/1/history')
        .expect(401);
    });

    test('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/transactions/99999/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });

    test('should return 403 for transaction owned by another user', async () => {
      // Create another user and transaction
      const db = openDatabase();
      db.prepare(`
        INSERT INTO users (email, passwordHash, name, businessName)
        VALUES ('otheruser@example.com', 'hashedpassword', 'Other User', 'Other Business')
      `).run();
      const otherUser = db.prepare('SELECT id FROM users WHERE email = ?').get('otheruser@example.com');

      db.prepare(`
        INSERT INTO transactions (userId, type, status, transactionDate, description, amount, vatAmount, totalAmount, currency)
        VALUES (?, 'income', 'pending', '2026-01-15', 'Other user transaction', 1000, 0, 1000, 'GBP')
      `).run(otherUser.id);
      const otherTxn = db.prepare('SELECT id FROM transactions WHERE description = ?').get('Other user transaction');

      const response = await request(app)
        .get(`/api/transactions/${otherTxn.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should filter history by action type', async () => {
      // Create and update a transaction
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Filter test',
          amount: 1000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated filter test' })
        .expect(200);

      // Filter by create action only
      const response = await request(app)
        .get(`/api/transactions/${transactionId}/history?action=create`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.entries).toHaveLength(1);
      expect(response.body.data.entries[0].action).toBe('create');
    });

    test('should paginate history results', async () => {
      // Create a transaction and update it multiple times
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Pagination test',
          amount: 1000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      // Make multiple updates
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .put(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: 1000 * (i + 1) })
          .expect(200);
      }

      // Get paginated results
      const response = await request(app)
        .get(`/api/transactions/${transactionId}/history?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.entries).toHaveLength(2);
      expect(response.body.data.total).toBe(4); // 1 create + 3 updates
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });

    test('should support ascending sort order', async () => {
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Sort test',
          amount: 1000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated sort test' })
        .expect(200);

      // Get with ASC order
      const response = await request(app)
        .get(`/api/transactions/${transactionId}/history?sortOrder=ASC`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // First entry should be the create action
      expect(response.body.data.entries[0].action).toBe('create');
    });

    test('should include meta information in response', async () => {
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Meta test',
          amount: 1000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.transactionId).toBe(transactionId);
      expect(response.body.meta.timestamp).toBeDefined();
    });
  });

  describe('Audit Log Metadata', () => {
    test('should capture user agent in audit log', async () => {
      const createResponse = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .send({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'User agent test',
          amount: 1000
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      const historyResponse = await request(app)
        .get(`/api/transactions/${transactionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.data.entries[0].userAgent).toBe('Test-Agent/1.0');
    });
  });
});
