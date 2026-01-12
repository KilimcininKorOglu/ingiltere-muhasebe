/**
 * Unit tests for Reconciliation model.
 * Tests validation, CRUD operations, and reconciliation-specific functionality.
 * 
 * @module tests/Reconciliation.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Reconciliation = require('../database/models/Reconciliation');
const BankTransaction = require('../database/models/BankTransaction');
const Transaction = require('../database/models/Transaction');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-reconciliation-database.sqlite');

// Test data IDs
let testUserId;
let testBankAccountId;
let testBankTransactionId;
let testAppTransactionId;

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
  
  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Create a test user
  executeMany(`
    INSERT INTO users (email, passwordHash, name, businessName)
    VALUES ('testreconciliation@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testreconciliation@example.com');
  testUserId = user.id;
  
  // Create a test bank account
  executeMany(`
    INSERT INTO bank_accounts (userId, accountName, bankName, sortCode, accountNumber, currency)
    VALUES (${testUserId}, 'Reconciliation Test Account', 'Test Bank', '654321', '87654321', 'GBP');
  `);
  
  const bankAccount = db.prepare('SELECT id FROM bank_accounts WHERE userId = ?').get(testUserId);
  testBankAccountId = bankAccount.id;
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
 * Clean up tables and create fresh test data before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM reconciliations;');
  executeMany('DELETE FROM bank_transactions;');
  executeMany('DELETE FROM transactions;');
  
  // Create a test bank transaction
  const bankTxnResult = BankTransaction.createBankTransaction({
    bankAccountId: testBankAccountId,
    transactionDate: '2026-01-15',
    description: 'Bank Transaction for Reconciliation',
    transactionType: 'credit',
    amount: 50000
  });
  testBankTransactionId = bankTxnResult.data.id;
  
  // Create a test application transaction
  const appTxnResult = Transaction.createTransaction({
    userId: testUserId,
    type: 'income',
    transactionDate: '2026-01-15',
    description: 'App Transaction for Reconciliation',
    amount: 41667,
    vatAmount: 8333,
    totalAmount: 50000
  });
  testAppTransactionId = appTxnResult.data.id;
});

describe('Reconciliation Model', () => {
  describe('validateReconciliationData', () => {
    describe('required fields', () => {
      test('should fail validation for missing bankTransactionId', () => {
        const result = Reconciliation.validateReconciliationData({
          transactionId: 1,
          matchAmount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.bankTransactionId).toBeDefined();
      });

      test('should fail validation for missing transactionId', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          matchAmount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionId).toBeDefined();
      });

      test('should fail validation for missing matchAmount', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.matchAmount).toBeDefined();
      });
    });

    describe('matchType validation', () => {
      test('should accept valid match types', () => {
        const types = ['exact', 'partial', 'split', 'adjustment'];
        for (const matchType of types) {
          const result = Reconciliation.validateReconciliationData({
            bankTransactionId: 1,
            transactionId: 1,
            matchAmount: 10000,
            matchType
          });
          expect(result.isValid).toBe(true);
        }
      });

      test('should reject invalid match type', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000,
          matchType: 'invalid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.matchType).toContain('Invalid matchType');
      });
    });

    describe('status validation', () => {
      test('should accept valid statuses', () => {
        const statuses = ['pending', 'confirmed', 'rejected'];
        for (const status of statuses) {
          const result = Reconciliation.validateReconciliationData({
            bankTransactionId: 1,
            transactionId: 1,
            matchAmount: 10000,
            status
          });
          expect(result.isValid).toBe(true);
        }
      });

      test('should reject invalid status', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000,
          status: 'invalid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.status).toContain('Invalid status');
      });
    });

    describe('matchConfidence validation', () => {
      test('should accept valid confidence values', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000,
          matchConfidence: 85
        });
        expect(result.isValid).toBe(true);
      });

      test('should accept 0 and 100 confidence', () => {
        const result1 = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000,
          matchConfidence: 0
        });
        expect(result1.isValid).toBe(true);

        const result2 = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000,
          matchConfidence: 100
        });
        expect(result2.isValid).toBe(true);
      });

      test('should reject out of range confidence', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000,
          matchConfidence: 150
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.matchConfidence).toBeDefined();
      });
    });

    describe('matchAmount validation', () => {
      test('should accept non-negative integer amount', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: 10000
        });
        expect(result.isValid).toBe(true);
      });

      test('should reject negative amount', () => {
        const result = Reconciliation.validateReconciliationData({
          bankTransactionId: 1,
          transactionId: 1,
          matchAmount: -10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.matchAmount).toBeDefined();
      });
    });
  });

  describe('createReconciliation', () => {
    test('should create a reconciliation with valid data', () => {
      const result = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        matchType: 'exact',
        status: 'pending'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.bankTransactionId).toBe(testBankTransactionId);
      expect(result.data.transactionId).toBe(testAppTransactionId);
      expect(result.data.matchAmount).toBe(50000);
      expect(result.data.matchType).toBe('exact');
      expect(result.data.status).toBe('pending');
    });

    test('should create reconciliation with default values', () => {
      const result = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000
      });

      expect(result.success).toBe(true);
      expect(result.data.matchType).toBe('exact');
      expect(result.data.status).toBe('pending');
      expect(result.data.matchConfidence).toBe(0);
    });

    test('should fail with invalid bank transaction ID', () => {
      const result = Reconciliation.createReconciliation({
        bankTransactionId: 999999,
        transactionId: testAppTransactionId,
        matchAmount: 50000
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBeDefined();
    });

    test('should fail with invalid app transaction ID', () => {
      const result = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: 999999,
        matchAmount: 50000
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBeDefined();
    });
  });

  describe('reconcile', () => {
    test('should create and confirm reconciliation in one step', () => {
      const result = Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId,
        { notes: 'Manual reconciliation' }
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('confirmed');
      expect(result.data.reconciledBy).toBe(testUserId);
      expect(result.data.matchConfidence).toBe(100);
      expect(result.data.notes).toBe('Manual reconciliation');
    });

    test('should set reconciledAt timestamp for confirmed reconciliation', () => {
      const result = Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.data.reconciledAt).toBeDefined();
    });
  });

  describe('suggestMatch', () => {
    test('should create pending reconciliation suggestion', () => {
      const result = Reconciliation.suggestMatch(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        85,
        { notes: 'Auto-matched by amount' }
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('pending');
      expect(result.data.matchConfidence).toBe(85);
      expect(result.data.notes).toBe('Auto-matched by amount');
    });
  });

  describe('findById', () => {
    test('should find existing reconciliation', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000
      });

      const found = Reconciliation.findById(created.data.id);
      expect(found).toBeDefined();
      expect(found.matchAmount).toBe(50000);
    });

    test('should return null for non-existent reconciliation', () => {
      const found = Reconciliation.findById(999999);
      expect(found).toBeNull();
    });
  });

  describe('getByBankTransactionId', () => {
    test('should get all reconciliations for bank transaction', () => {
      // Create multiple app transactions
      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Second App Transaction',
        totalAmount: 25000
      });

      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 25000,
        matchType: 'partial'
      });

      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: appTxn2.data.id,
        matchAmount: 25000,
        matchType: 'split'
      });

      const reconciliations = Reconciliation.getByBankTransactionId(testBankTransactionId);
      expect(reconciliations.length).toBe(2);
    });

    test('should filter by status', () => {
      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      const pending = Reconciliation.getByBankTransactionId(testBankTransactionId, { status: 'pending' });
      expect(pending.length).toBe(1);

      const confirmed = Reconciliation.getByBankTransactionId(testBankTransactionId, { status: 'confirmed' });
      expect(confirmed.length).toBe(0);
    });
  });

  describe('getByTransactionId', () => {
    test('should get reconciliations for app transaction', () => {
      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000
      });

      const reconciliations = Reconciliation.getByTransactionId(testAppTransactionId);
      expect(reconciliations.length).toBe(1);
      expect(reconciliations[0].transactionId).toBe(testAppTransactionId);
    });
  });

  describe('getPendingReconciliations', () => {
    test('should get pending reconciliations ordered by confidence', () => {
      Reconciliation.suggestMatch(testBankTransactionId, testAppTransactionId, 50000, 85);
      
      // Create another bank transaction and app transaction
      const bankTxn2 = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Second Bank Transaction',
        transactionType: 'debit',
        amount: 30000
      });
      
      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-16',
        description: 'Second App Transaction',
        totalAmount: 30000
      });
      
      Reconciliation.suggestMatch(bankTxn2.data.id, appTxn2.data.id, 30000, 95);

      const pending = Reconciliation.getPendingReconciliations();
      expect(pending.length).toBe(2);
      expect(pending[0].matchConfidence).toBe(95); // Highest confidence first
      expect(pending[1].matchConfidence).toBe(85);
    });

    test('should filter by minimum confidence', () => {
      Reconciliation.suggestMatch(testBankTransactionId, testAppTransactionId, 50000, 60);

      const highConfidence = Reconciliation.getPendingReconciliations({ minConfidence: 70 });
      expect(highConfidence.length).toBe(0);

      const allPending = Reconciliation.getPendingReconciliations({ minConfidence: 50 });
      expect(allPending.length).toBe(1);
    });
  });

  describe('confirmReconciliation', () => {
    test('should confirm pending reconciliation', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      const result = Reconciliation.confirmReconciliation(
        created.data.id,
        testUserId,
        'Confirmed by user'
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('confirmed');
      expect(result.data.reconciledBy).toBe(testUserId);
      expect(result.data.notes).toBe('Confirmed by user');
    });

    test('should fail to confirm already confirmed reconciliation', () => {
      const created = Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      const result = Reconciliation.confirmReconciliation(created.data.id, testUserId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already confirmed');
    });
  });

  describe('rejectReconciliation', () => {
    test('should reject pending reconciliation', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      const result = Reconciliation.rejectReconciliation(
        created.data.id,
        testUserId,
        'Incorrect match'
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('rejected');
      expect(result.data.notes).toBe('Incorrect match');
    });
  });

  describe('deleteReconciliation', () => {
    test('should delete existing reconciliation', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000
      });

      const result = Reconciliation.deleteReconciliation(created.data.id);
      expect(result.success).toBe(true);

      const found = Reconciliation.findById(created.data.id);
      expect(found).toBeNull();
    });

    test('should fail for non-existent reconciliation', () => {
      const result = Reconciliation.deleteReconciliation(999999);
      expect(result.success).toBe(false);
    });
  });

  describe('deletePendingByBankTransactionId', () => {
    test('should delete only pending reconciliations', () => {
      // Create pending
      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      // Create confirmed
      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-16',
        description: 'Another transaction',
        totalAmount: 25000
      });

      Reconciliation.reconcile(
        testBankTransactionId,
        appTxn2.data.id,
        25000,
        testUserId
      );

      const result = Reconciliation.deletePendingByBankTransactionId(testBankTransactionId);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);

      // Confirmed should still exist
      const remaining = Reconciliation.getByBankTransactionId(testBankTransactionId);
      expect(remaining.length).toBe(1);
      expect(remaining[0].status).toBe('confirmed');
    });
  });

  describe('getSummary', () => {
    test('should return correct summary statistics', () => {
      // Create confirmed reconciliation
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      // Create pending
      const bankTxn2 = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Pending Bank Transaction',
        transactionType: 'credit',
        amount: 30000
      });
      
      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-16',
        description: 'Pending App Transaction',
        totalAmount: 30000
      });

      Reconciliation.suggestMatch(bankTxn2.data.id, appTxn2.data.id, 30000, 80);

      const summary = Reconciliation.getSummary();
      expect(summary.confirmed).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.rejected).toBe(0);
      expect(summary.totalMatchedAmount).toBe(50000);
    });
  });

  describe('hasConfirmedReconciliation', () => {
    test('should return true for confirmed reconciliation', () => {
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      const exists = Reconciliation.hasConfirmedReconciliation(
        testBankTransactionId,
        testAppTransactionId
      );
      expect(exists).toBe(true);
    });

    test('should return false for pending reconciliation', () => {
      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      const exists = Reconciliation.hasConfirmedReconciliation(
        testBankTransactionId,
        testAppTransactionId
      );
      expect(exists).toBe(false);
    });
  });

  describe('getTotalMatchedAmount', () => {
    test('should return total matched amount for confirmed reconciliations', () => {
      // Create first match
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        30000,
        testUserId
      );

      // Create second match
      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-16',
        description: 'Second match',
        totalAmount: 20000
      });

      Reconciliation.reconcile(
        testBankTransactionId,
        appTxn2.data.id,
        20000,
        testUserId
      );

      const total = Reconciliation.getTotalMatchedAmount(testBankTransactionId);
      expect(total).toBe(50000);
    });

    test('should not include pending reconciliations in total', () => {
      Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      const total = Reconciliation.getTotalMatchedAmount(testBankTransactionId);
      expect(total).toBe(0);
    });
  });

  describe('getRemainingAmount', () => {
    test('should calculate remaining unmatched amount', () => {
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        30000,
        testUserId
      );

      const remaining = Reconciliation.getRemainingAmount(testBankTransactionId, 50000);
      expect(remaining).toBe(20000);
    });

    test('should return 0 when fully matched', () => {
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      const remaining = Reconciliation.getRemainingAmount(testBankTransactionId, 50000);
      expect(remaining).toBe(0);
    });
  });

  describe('getByUserId', () => {
    test('should get reconciliations by user', () => {
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      const result = Reconciliation.getByUserId(testUserId);
      expect(result.reconciliations.length).toBe(1);
      expect(result.total).toBe(1);
    });

    test('should support pagination', () => {
      // Create multiple reconciliations
      Reconciliation.reconcile(
        testBankTransactionId,
        testAppTransactionId,
        50000,
        testUserId
      );

      const bankTxn2 = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-17',
        description: 'Another transaction',
        transactionType: 'credit',
        amount: 20000
      });
      
      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-17',
        description: 'Another app transaction',
        totalAmount: 20000
      });

      Reconciliation.reconcile(
        bankTxn2.data.id,
        appTxn2.data.id,
        20000,
        testUserId
      );

      const result = Reconciliation.getByUserId(testUserId, { page: 1, limit: 1 });
      expect(result.reconciliations.length).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  describe('updateReconciliation', () => {
    test('should update reconciliation fields', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000
      });

      const result = Reconciliation.updateReconciliation(created.data.id, {
        matchType: 'partial',
        matchAmount: 40000,
        notes: 'Updated notes'
      });

      expect(result.success).toBe(true);
      expect(result.data.matchType).toBe('partial');
      expect(result.data.matchAmount).toBe(40000);
      expect(result.data.notes).toBe('Updated notes');
    });

    test('should fail for non-existent reconciliation', () => {
      const result = Reconciliation.updateReconciliation(999999, {
        notes: 'Updated'
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBeDefined();
    });
  });

  describe('Constants', () => {
    test('should export MATCH_TYPES', () => {
      expect(Reconciliation.MATCH_TYPES).toEqual(['exact', 'partial', 'split', 'adjustment']);
    });

    test('should export STATUSES', () => {
      expect(Reconciliation.STATUSES).toEqual(['pending', 'confirmed', 'rejected']);
    });
  });

  describe('Database Triggers', () => {
    test('should update bank transaction status when reconciliation is confirmed', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      // Confirm the reconciliation
      Reconciliation.confirmReconciliation(created.data.id, testUserId);

      // Check bank transaction was updated
      const bankTxn = BankTransaction.findById(testBankTransactionId);
      expect(bankTxn.reconciliationStatus).toBe('matched');
      expect(bankTxn.isReconciled).toBe(1);
    });

    test('should update app transaction status when reconciliation is confirmed', () => {
      const created = Reconciliation.createReconciliation({
        bankTransactionId: testBankTransactionId,
        transactionId: testAppTransactionId,
        matchAmount: 50000,
        status: 'pending'
      });

      // Confirm the reconciliation
      Reconciliation.confirmReconciliation(created.data.id, testUserId);

      // Check app transaction was updated
      const appTxn = Transaction.findById(testAppTransactionId);
      expect(appTxn.status).toBe('reconciled');
    });
  });
});
