/**
 * Unit tests for Bank Transactions API endpoints.
 * Tests CRUD operations, validation, running balance, and reconciliation logic.
 * 
 * @module tests/bankTransactionsApi.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-bank-transactions-api-${workerId}.sqlite`);

// Test user data
let testUser;
let testUser2;
let authToken;
let authToken2;
let db;
let app;
let testBankAccountId;
let testBankAccountId2;

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
  
  // Create test users directly in database
  const { createUser } = require('../database/models/User');
  const result = await createUser({
    email: `bankxntestuser-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Test User'
  });
  
  testUser = result.data;
  authToken = generateToken(testUser);

  const result2 = await createUser({
    email: `bankxntestuser2-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Test User 2'
  });
  
  testUser2 = result2.data;
  authToken2 = generateToken(testUser2);

  // Create bank accounts for testing
  const BankAccount = require('../database/models/BankAccount');
  const bankAccountResult = BankAccount.createBankAccount({
    userId: testUser.id,
    accountName: 'Test Bank Account',
    bankName: 'Test Bank',
    sortCode: '12-34-56',
    accountNumber: '12345678',
    currency: 'GBP',
    openingBalance: 100000 // £1000
  });
  testBankAccountId = bankAccountResult.data.id;

  const bankAccountResult2 = BankAccount.createBankAccount({
    userId: testUser2.id,
    accountName: 'Test Bank Account 2',
    bankName: 'Other Bank',
    sortCode: '65-43-21',
    accountNumber: '87654321',
    currency: 'GBP',
    openingBalance: 50000 // £500
  });
  testBankAccountId2 = bankAccountResult2.data.id;
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
 * Clean up bank_transactions table before each test.
 */
beforeEach(() => {
  const { executeMany } = require('../database/index');
  executeMany('DELETE FROM bank_transactions;');
  // Reset bank account balances
  executeMany(`UPDATE bank_accounts SET currentBalance = openingBalance;`);
});

describe('Bank Transactions API', () => {
  describe('POST /api/bank-transactions', () => {
    it('should create a credit transaction and update bank balance', async () => {
      const transactionData = {
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Customer payment received',
        transactionType: 'credit',
        amount: 50000 // £500
      };

      const response = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.description).toBe('Customer payment received');
      expect(response.body.data.transaction.transactionType).toBe('credit');
      expect(response.body.data.transaction.amount).toBe(50000);
      expect(response.body.data.transaction.reconciliationStatus).toBe('unmatched');
      expect(response.body.data.transaction.isReconciled).toBe(false);

      // Verify bank account balance was updated
      const BankAccount = require('../database/models/BankAccount');
      const account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(150000); // 100000 + 50000
    });

    it('should create a debit transaction and decrease bank balance', async () => {
      const transactionData = {
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Supplier payment',
        transactionType: 'debit',
        amount: 30000 // £300
      };

      const response = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.transactionType).toBe('debit');
      expect(response.body.data.transaction.amount).toBe(30000);

      // Verify bank account balance was updated
      const BankAccount = require('../database/models/BankAccount');
      const account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(70000); // 100000 - 30000
    });

    it('should create a transaction with all optional fields', async () => {
      const transactionData = {
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        postingDate: '2026-01-16',
        description: 'Full transaction',
        reference: 'REF123456',
        transactionType: 'credit',
        amount: 25000,
        runningBalance: 125000,
        importSource: 'manual',
        fitId: 'FIT123456',
        reconciliationNotes: 'Test notes'
      };

      const response = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.postingDate).toBe('2026-01-16');
      expect(response.body.data.transaction.reference).toBe('REF123456');
      expect(response.body.data.transaction.runningBalance).toBe(125000);
      expect(response.body.data.transaction.importSource).toBe('manual');
      expect(response.body.data.transaction.fitId).toBe('FIT123456');
    });

    it('should reject transaction for non-existent bank account', async () => {
      const response = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: 99999,
          transactionDate: '2026-01-15',
          description: 'Test',
          transactionType: 'credit',
          amount: 1000
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_BANK_ACCOUNT_NOT_FOUND');
    });

    it('should reject transaction for another user\'s bank account', async () => {
      const response = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId2, // belongs to testUser2
          transactionDate: '2026-01-15',
          description: 'Test',
          transactionType: 'credit',
          amount: 1000
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHZ_RESOURCE_OWNER_ONLY');
    });

    it('should reject transaction with missing required fields', async () => {
      const response = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId
          // missing other required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/bank-transactions')
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Test',
          transactionType: 'credit',
          amount: 1000
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bank-accounts/:bankAccountId/transactions', () => {
    beforeEach(async () => {
      // Create some test transactions
      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-10',
          description: 'Transaction 1',
          transactionType: 'credit',
          amount: 10000
        });

      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Transaction 2',
          transactionType: 'debit',
          amount: 5000
        });

      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-20',
          description: 'Transaction 3',
          transactionType: 'credit',
          amount: 20000
        });
    });

    it('should list all transactions for a bank account', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should filter transactions by date range', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions`)
        .query({ startDate: '2026-01-12', endDate: '2026-01-18' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.transactions[0].description).toBe('Transaction 2');
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions`)
        .query({ transactionType: 'credit' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.transactions.every(t => t.transactionType === 'credit')).toBe(true);
    });

    it('should paginate transactions', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions`)
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });

    it('should include summary in response', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalCredits).toBe(30000); // 10000 + 20000
      expect(response.body.data.summary.totalDebits).toBe(5000);
      expect(response.body.data.summary.netAmount).toBe(25000);
    });

    it('should reject access to another user\'s bank account', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId2}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bank-transactions/:id', () => {
    let testTransactionId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Test get transaction',
          transactionType: 'credit',
          amount: 15000
        });

      testTransactionId = createResponse.body.data.transaction.id;
    });

    it('should get a transaction by ID', async () => {
      const response = await request(app)
        .get(`/api/bank-transactions/${testTransactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.id).toBe(testTransactionId);
      expect(response.body.data.transaction.description).toBe('Test get transaction');
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/bank-transactions/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_BANK_TRANSACTION_NOT_FOUND');
    });
  });

  describe('PUT /api/bank-transactions/:id', () => {
    let testTransactionId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Original description',
          transactionType: 'credit',
          amount: 20000
        });

      testTransactionId = createResponse.body.data.transaction.id;
    });

    it('should update transaction description', async () => {
      const response = await request(app)
        .put(`/api/bank-transactions/${testTransactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.description).toBe('Updated description');
    });

    it('should update amount and adjust bank balance', async () => {
      const BankAccount = require('../database/models/BankAccount');
      const initialBalance = BankAccount.findById(testBankAccountId).currentBalance;

      const response = await request(app)
        .put(`/api/bank-transactions/${testTransactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 30000 // Was 20000, now 30000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.amount).toBe(30000);

      // Balance should have increased by 10000 (30000 - 20000)
      const account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(initialBalance + 10000);
    });

    it('should not update reconciled transaction', async () => {
      // First, reconcile the transaction
      await request(app)
        .patch(`/api/bank-transactions/${testTransactionId}/reconciliation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'matched' });

      const response = await request(app)
        .put(`/api/bank-transactions/${testTransactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Trying to update reconciled'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BUS_TRANSACTION_RECONCILED');
    });
  });

  describe('DELETE /api/bank-transactions/:id', () => {
    let testTransactionId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'To be deleted',
          transactionType: 'credit',
          amount: 25000
        });

      testTransactionId = createResponse.body.data.transaction.id;
    });

    it('should delete a transaction and reverse balance', async () => {
      const BankAccount = require('../database/models/BankAccount');
      const initialBalance = BankAccount.findById(testBankAccountId).currentBalance;

      const response = await request(app)
        .delete(`/api/bank-transactions/${testTransactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Balance should be reversed
      const account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(initialBalance - 25000);
    });

    it('should not delete reconciled transaction', async () => {
      // First, reconcile the transaction
      await request(app)
        .patch(`/api/bank-transactions/${testTransactionId}/reconciliation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'matched' });

      const response = await request(app)
        .delete(`/api/bank-transactions/${testTransactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BUS_TRANSACTION_RECONCILED');
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .delete('/api/bank-transactions/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/bank-transactions/:id/reconciliation', () => {
    let testTransactionId;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'For reconciliation',
          transactionType: 'credit',
          amount: 15000
        });

      testTransactionId = createResponse.body.data.transaction.id;
    });

    it('should update reconciliation status to matched', async () => {
      const response = await request(app)
        .patch(`/api/bank-transactions/${testTransactionId}/reconciliation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'matched',
          notes: 'Matched with invoice #123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.reconciliationStatus).toBe('matched');
      expect(response.body.data.transaction.isReconciled).toBe(true);
      expect(response.body.data.transaction.reconciliationNotes).toBe('Matched with invoice #123');
    });

    it('should update reconciliation status to excluded', async () => {
      const response = await request(app)
        .patch(`/api/bank-transactions/${testTransactionId}/reconciliation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'excluded',
          notes: 'Duplicate transaction'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction.reconciliationStatus).toBe('excluded');
      expect(response.body.data.transaction.isReconciled).toBe(true);
    });

    it('should reject invalid reconciliation status', async () => {
      const response = await request(app)
        .patch(`/api/bank-transactions/${testTransactionId}/reconciliation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/bank-accounts/:bankAccountId/transactions/summary', () => {
    beforeEach(async () => {
      // Create various transactions
      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-10',
          description: 'Credit 1',
          transactionType: 'credit',
          amount: 50000
        });

      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Debit 1',
          transactionType: 'debit',
          amount: 20000
        });

      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-20',
          description: 'Credit 2',
          transactionType: 'credit',
          amount: 30000
        });
    });

    it('should return transaction summary', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalCredits).toBe(80000);
      expect(response.body.data.summary.totalDebits).toBe(20000);
      expect(response.body.data.summary.netAmount).toBe(60000);
      expect(response.body.data.summary.creditCount).toBe(2);
      expect(response.body.data.summary.debitCount).toBe(1);
    });

    it('should return summary with date range filter', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions/summary`)
        .query({ startDate: '2026-01-12', endDate: '2026-01-18' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalDebits).toBe(20000);
      expect(response.body.data.summary.debitCount).toBe(1);
    });
  });

  describe('GET /api/bank-accounts/:bankAccountId/transactions/search', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-10',
          description: 'Payment from ABC Company',
          transactionType: 'credit',
          amount: 10000
        });

      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Transfer to supplier',
          reference: 'REF-ABC-123',
          transactionType: 'debit',
          amount: 5000
        });

      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-20',
          description: 'Utility payment',
          transactionType: 'debit',
          amount: 2000
        });
    });

    it('should search transactions by description', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions/search`)
        .query({ q: 'ABC' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
    });

    it('should search transactions by reference', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions/search`)
        .query({ q: 'REF-ABC' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(1);
    });

    it('should require search term', async () => {
      const response = await request(app)
        .get(`/api/bank-accounts/${testBankAccountId}/transactions/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Running Balance Calculation', () => {
    it('should maintain correct balance after multiple operations', async () => {
      const BankAccount = require('../database/models/BankAccount');
      
      // Initial balance: 100000

      // Add credit: +50000 = 150000
      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-10',
          description: 'Credit 1',
          transactionType: 'credit',
          amount: 50000
        });
      
      let account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(150000);

      // Add debit: -30000 = 120000
      await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-11',
          description: 'Debit 1',
          transactionType: 'debit',
          amount: 30000
        });
      
      account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(120000);

      // Add another credit: +20000 = 140000
      const createResponse = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-12',
          description: 'Credit 2',
          transactionType: 'credit',
          amount: 20000
        });
      
      account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(140000);

      // Delete last transaction: -20000 = 120000
      const transactionId = createResponse.body.data.transaction.id;
      await request(app)
        .delete(`/api/bank-transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      account = BankAccount.findById(testBankAccountId);
      expect(account.currentBalance).toBe(120000);
    });
  });
});
