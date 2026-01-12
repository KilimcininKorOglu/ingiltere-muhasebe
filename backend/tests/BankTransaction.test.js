/**
 * Unit tests for BankTransaction model.
 * Tests validation, CRUD operations, and bank transaction specific functionality.
 * 
 * @module tests/BankTransaction.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const BankTransaction = require('../database/models/BankTransaction');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-bank-transaction-database.sqlite');

// Test data IDs
let testUserId;
let testBankAccountId;

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
    VALUES ('testbanktxn@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testbanktxn@example.com');
  testUserId = user.id;
  
  // Create a test bank account
  executeMany(`
    INSERT INTO bank_accounts (userId, accountName, bankName, sortCode, accountNumber, currency)
    VALUES (${testUserId}, 'Test Account', 'Test Bank', '123456', '12345678', 'GBP');
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
 * Clean up bank_transactions table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM reconciliations;');
  executeMany('DELETE FROM bank_transactions;');
});

describe('BankTransaction Model', () => {
  describe('validateBankTransactionData', () => {
    describe('required fields', () => {
      test('should fail validation for missing bankAccountId', () => {
        const result = BankTransaction.validateBankTransactionData({
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.bankAccountId).toBeDefined();
      });

      test('should fail validation for missing transactionDate', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionDate).toBeDefined();
      });

      test('should fail validation for missing description', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.description).toBeDefined();
      });

      test('should fail validation for missing transactionType', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          amount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionType).toBeDefined();
      });

      test('should fail validation for missing amount', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBeDefined();
      });
    });

    describe('transactionType validation', () => {
      test('should accept valid transaction types', () => {
        const types = ['credit', 'debit'];
        for (const type of types) {
          const result = BankTransaction.validateBankTransactionData({
            bankAccountId: 1,
            transactionDate: '2026-01-15',
            description: 'Test transaction',
            transactionType: type,
            amount: 10000
          });
          expect(result.isValid).toBe(true);
        }
      });

      test('should reject invalid transaction type', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'invalid',
          amount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionType).toContain('Invalid transactionType');
      });
    });

    describe('importSource validation', () => {
      test('should accept valid import sources', () => {
        const sources = ['manual', 'csv_import', 'open_banking', 'statement_upload'];
        for (const source of sources) {
          const result = BankTransaction.validateBankTransactionData({
            bankAccountId: 1,
            transactionDate: '2026-01-15',
            description: 'Test transaction',
            transactionType: 'credit',
            amount: 10000,
            importSource: source
          });
          expect(result.isValid).toBe(true);
        }
      });

      test('should reject invalid import source', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000,
          importSource: 'invalid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.importSource).toContain('Invalid importSource');
      });
    });

    describe('reconciliationStatus validation', () => {
      test('should accept valid reconciliation statuses', () => {
        const statuses = ['unmatched', 'matched', 'excluded', 'reviewed'];
        for (const status of statuses) {
          const result = BankTransaction.validateBankTransactionData({
            bankAccountId: 1,
            transactionDate: '2026-01-15',
            description: 'Test transaction',
            transactionType: 'credit',
            amount: 10000,
            reconciliationStatus: status
          });
          expect(result.isValid).toBe(true);
        }
      });

      test('should reject invalid reconciliation status', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000,
          reconciliationStatus: 'invalid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.reconciliationStatus).toContain('Invalid reconciliationStatus');
      });
    });

    describe('date validation', () => {
      test('should accept valid date format', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(true);
      });

      test('should reject invalid date format', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '15-01-2026',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionDate).toBeDefined();
      });

      test('should accept valid posting date', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          postingDate: '2026-01-16',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('amount validation', () => {
      test('should accept non-negative integer amount', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 10000
        });
        expect(result.isValid).toBe(true);
      });

      test('should accept zero amount', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: 0
        });
        expect(result.isValid).toBe(true);
      });

      test('should reject negative amount', () => {
        const result = BankTransaction.validateBankTransactionData({
          bankAccountId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction',
          transactionType: 'credit',
          amount: -10000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBeDefined();
      });
    });
  });

  describe('createBankTransaction', () => {
    test('should create a bank transaction with valid data', () => {
      const result = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Test credit transaction',
        transactionType: 'credit',
        amount: 50000
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.bankAccountId).toBe(testBankAccountId);
      expect(result.data.description).toBe('Test credit transaction');
      expect(result.data.transactionType).toBe('credit');
      expect(result.data.amount).toBe(50000);
      expect(result.data.reconciliationStatus).toBe('unmatched');
      expect(result.data.isReconciled).toBe(false);
    });

    test('should create a bank transaction with all optional fields', () => {
      const result = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        postingDate: '2026-01-16',
        description: 'Complete transaction',
        reference: 'REF123',
        transactionType: 'debit',
        amount: 25000,
        runningBalance: 100000,
        importSource: 'csv_import',
        importBatchId: 'batch_001',
        fitId: 'FIT123456',
        reconciliationNotes: 'Test notes'
      });

      expect(result.success).toBe(true);
      expect(result.data.postingDate).toBe('2026-01-16');
      expect(result.data.reference).toBe('REF123');
      expect(result.data.runningBalance).toBe(100000);
      expect(result.data.importSource).toBe('csv_import');
      expect(result.data.importBatchId).toBe('batch_001');
      expect(result.data.fitId).toBe('FIT123456');
    });

    test('should fail with invalid bank account ID', () => {
      const result = BankTransaction.createBankTransaction({
        bankAccountId: 999999,
        transactionDate: '2026-01-15',
        description: 'Test transaction',
        transactionType: 'credit',
        amount: 10000
      });

      expect(result.success).toBe(false);
      expect(result.errors.bankAccountId).toBeDefined();
    });

    test('should fail with duplicate fitId for same bank account', () => {
      // Create first transaction
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'First transaction',
        transactionType: 'credit',
        amount: 10000,
        fitId: 'DUPLICATE_FIT'
      });

      // Try to create second with same fitId
      const result = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Second transaction',
        transactionType: 'credit',
        amount: 20000,
        fitId: 'DUPLICATE_FIT'
      });

      expect(result.success).toBe(false);
      expect(result.errors.fitId).toBeDefined();
    });
  });

  describe('findById', () => {
    test('should find existing bank transaction', () => {
      const created = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Find me transaction',
        transactionType: 'credit',
        amount: 10000
      });

      const found = BankTransaction.findById(created.data.id);
      expect(found).toBeDefined();
      expect(found.description).toBe('Find me transaction');
    });

    test('should return null for non-existent transaction', () => {
      const found = BankTransaction.findById(999999);
      expect(found).toBeNull();
    });
  });

  describe('findByFitId', () => {
    test('should find transaction by fitId', () => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'FitId transaction',
        transactionType: 'credit',
        amount: 10000,
        fitId: 'UNIQUE_FIT_123'
      });

      const found = BankTransaction.findByFitId(testBankAccountId, 'UNIQUE_FIT_123');
      expect(found).toBeDefined();
      expect(found.description).toBe('FitId transaction');
    });

    test('should return null for non-existent fitId', () => {
      const found = BankTransaction.findByFitId(testBankAccountId, 'NONEXISTENT');
      expect(found).toBeNull();
    });
  });

  describe('getBankTransactionsByAccountId', () => {
    beforeEach(() => {
      // Create test transactions
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-10',
        description: 'Transaction 1',
        transactionType: 'credit',
        amount: 10000
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Transaction 2',
        transactionType: 'debit',
        amount: 5000
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-20',
        description: 'Transaction 3',
        transactionType: 'credit',
        amount: 20000
      });
    });

    test('should return paginated transactions', () => {
      const result = BankTransaction.getBankTransactionsByAccountId(testBankAccountId, {
        page: 1,
        limit: 2
      });

      expect(result.transactions.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    test('should filter by transaction type', () => {
      const result = BankTransaction.getBankTransactionsByAccountId(testBankAccountId, {
        transactionType: 'credit'
      });

      expect(result.transactions.length).toBe(2);
      expect(result.transactions.every(t => t.transactionType === 'credit')).toBe(true);
    });

    test('should filter by date range', () => {
      const result = BankTransaction.getBankTransactionsByAccountId(testBankAccountId, {
        startDate: '2026-01-12',
        endDate: '2026-01-18'
      });

      expect(result.transactions.length).toBe(1);
      expect(result.transactions[0].description).toBe('Transaction 2');
    });
  });

  describe('getUnreconciledTransactions', () => {
    test('should return only unreconciled transactions', () => {
      // Create unreconciled transactions
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Unreconciled',
        transactionType: 'credit',
        amount: 10000
      });

      // Create reconciled transaction
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Matched',
        transactionType: 'credit',
        amount: 20000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });

      const result = BankTransaction.getUnreconciledTransactions(testBankAccountId);
      expect(result.length).toBe(1);
      expect(result[0].description).toBe('Unreconciled');
    });
  });

  describe('updateBankTransaction', () => {
    test('should update transaction fields', () => {
      const created = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Original description',
        transactionType: 'credit',
        amount: 10000
      });

      const result = BankTransaction.updateBankTransaction(created.data.id, {
        description: 'Updated description',
        reference: 'NEW_REF'
      });

      expect(result.success).toBe(true);
      expect(result.data.description).toBe('Updated description');
      expect(result.data.reference).toBe('NEW_REF');
    });

    test('should fail for non-existent transaction', () => {
      const result = BankTransaction.updateBankTransaction(999999, {
        description: 'Updated'
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBeDefined();
    });
  });

  describe('deleteBankTransaction', () => {
    test('should delete existing transaction', () => {
      const created = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'To delete',
        transactionType: 'credit',
        amount: 10000
      });

      const result = BankTransaction.deleteBankTransaction(created.data.id);
      expect(result.success).toBe(true);

      const found = BankTransaction.findById(created.data.id);
      expect(found).toBeNull();
    });

    test('should fail for non-existent transaction', () => {
      const result = BankTransaction.deleteBankTransaction(999999);
      expect(result.success).toBe(false);
    });
  });

  describe('updateReconciliationStatus', () => {
    test('should update reconciliation status', () => {
      const created = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Status update test',
        transactionType: 'credit',
        amount: 10000
      });

      const result = BankTransaction.updateReconciliationStatus(
        created.data.id,
        'matched',
        'Matched with invoice'
      );

      expect(result.success).toBe(true);
      expect(result.data.reconciliationStatus).toBe('matched');
      expect(result.data.reconciliationNotes).toBe('Matched with invoice');
      expect(result.data.isReconciled).toBe(true);
    });

    test('should fail with invalid status', () => {
      const created = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Invalid status test',
        transactionType: 'credit',
        amount: 10000
      });

      const result = BankTransaction.updateReconciliationStatus(
        created.data.id,
        'invalid_status'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });
  });

  describe('excludeFromReconciliation', () => {
    test('should exclude transaction from reconciliation', () => {
      const created = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'To exclude',
        transactionType: 'credit',
        amount: 10000
      });

      const result = BankTransaction.excludeFromReconciliation(
        created.data.id,
        'Internal transfer - not needed'
      );

      expect(result.success).toBe(true);
      expect(result.data.reconciliationStatus).toBe('excluded');
      expect(result.data.isReconciled).toBe(true);
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      // Create test transactions
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Credit 1',
        transactionType: 'credit',
        amount: 50000
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Debit 1',
        transactionType: 'debit',
        amount: 20000
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-17',
        description: 'Credit 2',
        transactionType: 'credit',
        amount: 30000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
    });

    test('should return correct summary statistics', () => {
      const summary = BankTransaction.getSummary(testBankAccountId);

      expect(summary.totalCredits).toBe(80000);
      expect(summary.totalDebits).toBe(20000);
      expect(summary.creditCount).toBe(2);
      expect(summary.debitCount).toBe(1);
      expect(summary.unreconciledCount).toBe(2);
      expect(summary.netAmount).toBe(60000);
    });

    test('should filter summary by date range', () => {
      const summary = BankTransaction.getSummary(
        testBankAccountId,
        '2026-01-15',
        '2026-01-16'
      );

      expect(summary.totalCredits).toBe(50000);
      expect(summary.totalDebits).toBe(20000);
    });
  });

  describe('getReconciliationStatusCounts', () => {
    test('should return counts by status', () => {
      // Create transactions with different statuses
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Unmatched',
        transactionType: 'credit',
        amount: 10000,
        reconciliationStatus: 'unmatched'
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Matched',
        transactionType: 'credit',
        amount: 20000,
        reconciliationStatus: 'matched'
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-17',
        description: 'Excluded',
        transactionType: 'credit',
        amount: 5000,
        reconciliationStatus: 'excluded'
      });

      const counts = BankTransaction.getReconciliationStatusCounts(testBankAccountId);

      expect(counts.unmatched).toBe(1);
      expect(counts.matched).toBe(1);
      expect(counts.excluded).toBe(1);
      expect(counts.reviewed).toBe(0);
    });
  });

  describe('searchBankTransactions', () => {
    beforeEach(() => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Amazon purchase',
        reference: 'AMZ123',
        transactionType: 'debit',
        amount: 5000
      });
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Salary payment',
        reference: 'SAL456',
        transactionType: 'credit',
        amount: 200000
      });
    });

    test('should search by description', () => {
      const results = BankTransaction.searchBankTransactions(testBankAccountId, 'Amazon');
      expect(results.length).toBe(1);
      expect(results[0].description).toContain('Amazon');
    });

    test('should search by reference', () => {
      const results = BankTransaction.searchBankTransactions(testBankAccountId, 'SAL');
      expect(results.length).toBe(1);
      expect(results[0].reference).toContain('SAL');
    });

    test('should return empty array for no matches', () => {
      const results = BankTransaction.searchBankTransactions(testBankAccountId, 'nonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('fitIdExists', () => {
    test('should return true for existing fitId', () => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'FitId check',
        transactionType: 'credit',
        amount: 10000,
        fitId: 'EXISTS_123'
      });

      expect(BankTransaction.fitIdExists(testBankAccountId, 'EXISTS_123')).toBe(true);
    });

    test('should return false for non-existent fitId', () => {
      expect(BankTransaction.fitIdExists(testBankAccountId, 'DOES_NOT_EXIST')).toBe(false);
    });
  });

  describe('createBatch', () => {
    test('should create multiple transactions in batch', () => {
      const transactions = [
        {
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Batch 1',
          transactionType: 'credit',
          amount: 10000
        },
        {
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-16',
          description: 'Batch 2',
          transactionType: 'debit',
          amount: 5000
        }
      ];

      const result = BankTransaction.createBatch(transactions, 'test_batch');

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.batchId).toBe('test_batch');
    });

    test('should handle partial batch failures', () => {
      const transactions = [
        {
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Valid',
          transactionType: 'credit',
          amount: 10000
        },
        {
          bankAccountId: testBankAccountId,
          transactionDate: 'invalid-date', // Invalid
          description: 'Invalid',
          transactionType: 'credit',
          amount: 5000
        }
      ];

      const result = BankTransaction.createBatch(transactions);

      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('deleteBatch', () => {
    test('should delete all transactions in a batch', () => {
      const transactions = [
        {
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-15',
          description: 'Batch Delete 1',
          transactionType: 'credit',
          amount: 10000
        },
        {
          bankAccountId: testBankAccountId,
          transactionDate: '2026-01-16',
          description: 'Batch Delete 2',
          transactionType: 'debit',
          amount: 5000
        }
      ];

      BankTransaction.createBatch(transactions, 'delete_batch');

      const result = BankTransaction.deleteBatch('delete_batch');
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);

      const remaining = BankTransaction.getByImportBatchId('delete_batch');
      expect(remaining.length).toBe(0);
    });
  });

  describe('Constants', () => {
    test('should export TRANSACTION_TYPES', () => {
      expect(BankTransaction.TRANSACTION_TYPES).toEqual(['credit', 'debit']);
    });

    test('should export IMPORT_SOURCES', () => {
      expect(BankTransaction.IMPORT_SOURCES).toContain('manual');
      expect(BankTransaction.IMPORT_SOURCES).toContain('csv_import');
      expect(BankTransaction.IMPORT_SOURCES).toContain('open_banking');
    });

    test('should export RECONCILIATION_STATUSES', () => {
      expect(BankTransaction.RECONCILIATION_STATUSES).toContain('unmatched');
      expect(BankTransaction.RECONCILIATION_STATUSES).toContain('matched');
      expect(BankTransaction.RECONCILIATION_STATUSES).toContain('excluded');
    });
  });
});
