/**
 * Unit tests for ReconciliationStatusService.
 * Tests reconciliation status summary, balance calculations, and unreconciled totals.
 * 
 * @module tests/reconciliationStatusService.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const ReconciliationStatusService = require('../services/reconciliationStatusService');
const BankTransaction = require('../database/models/BankTransaction');
const Transaction = require('../database/models/Transaction');
const Reconciliation = require('../database/models/Reconciliation');
const BankAccount = require('../database/models/BankAccount');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-reconciliation-status-database.sqlite');

// Test data IDs
let testUserId;
let testBankAccountId;
let testCategoryId;

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
    VALUES ('teststatus@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('teststatus@example.com');
  testUserId = user.id;
  
  // Create a test category (categories don't have userId, they have unique code)
  executeMany(`
    INSERT INTO categories (code, name, type, isSystem)
    VALUES ('TEST001', 'Test Income Category', 'income', 0);
  `);
  
  const category = db.prepare('SELECT id FROM categories WHERE code = ?').get('TEST001');
  testCategoryId = category.id;
  
  // Create a test bank account
  executeMany(`
    INSERT INTO bank_accounts (userId, accountName, bankName, sortCode, accountNumber, currency, openingBalance, currentBalance)
    VALUES (${testUserId}, 'Status Test Account', 'Test Bank', '123456', '12345678', 'GBP', 100000, 150000);
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
 * Clean up tables before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM reconciliations;');
  executeMany('DELETE FROM bank_transactions;');
  executeMany('DELETE FROM transactions;');
});

describe('ReconciliationStatusService', () => {
  describe('getReconciliationStatusSummary', () => {
    test('should return success with zero counts when no transactions', () => {
      const result = ReconciliationStatusService.getReconciliationStatusSummary(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.totalTransactions).toBe(0);
      expect(result.data.reconciledCount).toBe(0);
      expect(result.data.unreconciledCount).toBe(0);
      expect(result.data.excludedCount).toBe(0);
      expect(result.data.reconciliationProgress).toBe(100); // 100% when no transactions
    });

    test('should return error for non-existent bank account', () => {
      const result = ReconciliationStatusService.getReconciliationStatusSummary(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bank account not found');
    });

    test('should return accurate counts for mixed transaction statuses', () => {
      // Create bank transactions with different statuses
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Reconciled transaction',
        transactionType: 'credit',
        amount: 10000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-02',
        description: 'Unreconciled transaction',
        transactionType: 'debit',
        amount: 5000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-03',
        description: 'Excluded transaction',
        transactionType: 'debit',
        amount: 2000,
        reconciliationStatus: 'excluded',
        isReconciled: true
      });
      
      const result = ReconciliationStatusService.getReconciliationStatusSummary(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.totalTransactions).toBe(3);
      expect(result.data.reconciledCount).toBe(2); // matched + excluded (both have isReconciled=true)
      expect(result.data.unreconciledCount).toBe(1);
      expect(result.data.excludedCount).toBe(1);
    });

    test('should filter by date range', () => {
      // Create transactions in different months
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'January transaction',
        transactionType: 'credit',
        amount: 10000,
        reconciliationStatus: 'unmatched'
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-02-15',
        description: 'February transaction',
        transactionType: 'credit',
        amount: 20000,
        reconciliationStatus: 'unmatched'
      });
      
      const result = ReconciliationStatusService.getReconciliationStatusSummary(testBankAccountId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.totalTransactions).toBe(1);
    });

    test('should calculate reconciliation progress correctly', () => {
      // Create 4 transactions: 2 reconciled, 1 unreconciled, 1 excluded
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Reconciled 1',
        transactionType: 'credit',
        amount: 10000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-02',
        description: 'Reconciled 2',
        transactionType: 'credit',
        amount: 10000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-03',
        description: 'Unreconciled',
        transactionType: 'debit',
        amount: 5000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-04',
        description: 'Excluded',
        transactionType: 'debit',
        amount: 2000,
        reconciliationStatus: 'excluded',
        isReconciled: false // Excluded but not marked as isReconciled
      });
      
      const result = ReconciliationStatusService.getReconciliationStatusSummary(testBankAccountId);
      
      expect(result.success).toBe(true);
      // Total = 4, Excluded = 1
      // Effective total = 4 - 1 (excluded) = 3
      // Reconciled (isReconciled=true OR reconciliationStatus='matched') = 2
      // Progress = 2/3 * 100 = 67%
      expect(result.data.reconciliationProgress).toBe(67);
    });
  });

  describe('calculateBalances', () => {
    test('should return balanced state when no transactions', () => {
      const result = ReconciliationStatusService.calculateBalances(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.bankBalance).toBe(0);
      expect(result.data.bookBalance).toBe(0);
      expect(result.data.discrepancy).toBe(0);
      expect(result.data.isBalanced).toBe(true);
    });

    test('should return error for non-existent bank account', () => {
      const result = ReconciliationStatusService.calculateBalances(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bank account not found');
    });

    test('should calculate bank balance correctly', () => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Credit 1',
        transactionType: 'credit',
        amount: 50000,
        reconciliationStatus: 'unmatched'
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-02',
        description: 'Debit 1',
        transactionType: 'debit',
        amount: 20000,
        reconciliationStatus: 'unmatched'
      });
      
      const result = ReconciliationStatusService.calculateBalances(testBankAccountId);
      
      expect(result.success).toBe(true);
      // Bank balance = 50000 - 20000 = 30000
      expect(result.data.bankBalance).toBe(30000);
      // Book balance = 0 (no reconciliations)
      expect(result.data.bookBalance).toBe(0);
      // Unreconciled
      expect(result.data.unreconciledCredits).toBe(50000);
      expect(result.data.unreconciledDebits).toBe(20000);
      // Discrepancy = 30000 - 0 = 30000
      expect(result.data.discrepancy).toBe(30000);
      expect(result.data.isBalanced).toBe(false);
    });

    test('should show zero discrepancy when fully reconciled', () => {
      // Create bank transaction
      const bankTxnResult = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Credit transaction',
        transactionType: 'credit',
        amount: 25000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
      
      // Create app transaction with valid categoryId
      const appTxnResult = Transaction.createTransaction({
        userId: testUserId,
        transactionDate: '2026-01-01',
        type: 'income',
        description: 'Income transaction',
        totalAmount: 25000,
        categoryId: testCategoryId
      });
      
      // Create reconciliation
      if (bankTxnResult.success && appTxnResult.success) {
        Reconciliation.reconcile(
          bankTxnResult.data.id,
          appTxnResult.data.id,
          25000,
          testUserId
        );
      }
      
      const result = ReconciliationStatusService.calculateBalances(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.bankBalance).toBe(25000);
      expect(result.data.bookBalance).toBe(25000);
      expect(result.data.discrepancy).toBe(0);
      expect(result.data.isBalanced).toBe(true);
    });
  });

  describe('getUnreconciledTotals', () => {
    test('should return empty totals when no unreconciled transactions', () => {
      const result = ReconciliationStatusService.getUnreconciledTotals(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.summary.unreconciledCount).toBe(0);
      expect(result.data.summary.totalUnreconciledAmount).toBe(0);
      expect(result.data.credits.count).toBe(0);
      expect(result.data.debits.count).toBe(0);
    });

    test('should return error for non-existent bank account', () => {
      const result = ReconciliationStatusService.getUnreconciledTotals(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bank account not found');
    });

    test('should calculate unreconciled totals correctly', () => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Unreconciled credit 1',
        transactionType: 'credit',
        amount: 15000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-02',
        description: 'Unreconciled credit 2',
        transactionType: 'credit',
        amount: 25000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-03',
        description: 'Unreconciled debit',
        transactionType: 'debit',
        amount: 10000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      const result = ReconciliationStatusService.getUnreconciledTotals(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.summary.unreconciledCount).toBe(3);
      expect(result.data.summary.totalUnreconciledAmount).toBe(50000);
      expect(result.data.summary.netUnreconciledAmount).toBe(30000); // 40000 - 10000
      expect(result.data.credits.count).toBe(2);
      expect(result.data.credits.amount).toBe(40000);
      expect(result.data.debits.count).toBe(1);
      expect(result.data.debits.amount).toBe(10000);
    });

    test('should exclude excluded transactions from unreconciled totals', () => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Unreconciled',
        transactionType: 'credit',
        amount: 15000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-02',
        description: 'Excluded',
        transactionType: 'credit',
        amount: 25000,
        reconciliationStatus: 'excluded',
        isReconciled: true
      });
      
      const result = ReconciliationStatusService.getUnreconciledTotals(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.summary.unreconciledCount).toBe(1);
      expect(result.data.credits.amount).toBe(15000);
    });

    test('should track oldest unreconciled date', () => {
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Newer unreconciled',
        transactionType: 'credit',
        amount: 15000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-05',
        description: 'Older unreconciled',
        transactionType: 'credit',
        amount: 25000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      const result = ReconciliationStatusService.getUnreconciledTotals(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.summary.oldestUnreconciledDate).toBe('2026-01-05');
    });
  });

  describe('getLastReconciliationDate', () => {
    test('should return null when no reconciliations', () => {
      const result = ReconciliationStatusService.getLastReconciliationDate(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.lastReconciliationDate).toBeNull();
      expect(result.data.lastReconciledTransactionDate).toBeNull();
      expect(result.data.reconciliationsToday).toBe(0);
    });

    test('should return error for non-existent bank account', () => {
      const result = ReconciliationStatusService.getLastReconciliationDate(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bank account not found');
    });

    test('should return last reconciliation info when reconciliations exist', () => {
      // Create bank transaction
      const bankTxnResult = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Credit transaction',
        transactionType: 'credit',
        amount: 25000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
      
      // Create app transaction with valid categoryId
      const appTxnResult = Transaction.createTransaction({
        userId: testUserId,
        transactionDate: '2026-01-01',
        type: 'income',
        description: 'Income transaction',
        totalAmount: 25000,
        categoryId: testCategoryId
      });
      
      // Create reconciliation
      if (bankTxnResult.success && appTxnResult.success) {
        Reconciliation.reconcile(
          bankTxnResult.data.id,
          appTxnResult.data.id,
          25000,
          testUserId
        );
      }
      
      const result = ReconciliationStatusService.getLastReconciliationDate(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.lastReconciliationDate).not.toBeNull();
      expect(result.data.lastReconciledTransactionDate).toBe('2026-01-01');
    });
  });

  describe('getFullReconciliationStatus', () => {
    test('should return comprehensive status data', () => {
      const result = ReconciliationStatusService.getFullReconciliationStatus(testBankAccountId);
      
      expect(result.success).toBe(true);
      expect(result.data.bankAccount).toBeDefined();
      expect(result.data.statusSummary).toBeDefined();
      expect(result.data.balances).toBeDefined();
      expect(result.data.unreconciledTotals).toBeDefined();
      expect(result.data.lastReconciliation).toBeDefined();
    });

    test('should return error for non-existent bank account', () => {
      const result = ReconciliationStatusService.getFullReconciliationStatus(999999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bank account not found');
    });

    test('should include date range in response when provided', () => {
      const result = ReconciliationStatusService.getFullReconciliationStatus(testBankAccountId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.dateRange.startDate).toBe('2026-01-01');
      expect(result.data.dateRange.endDate).toBe('2026-01-31');
    });
  });

  describe('getReconciliationStatusByUser', () => {
    test('should return status for all bank accounts', () => {
      const result = ReconciliationStatusService.getReconciliationStatusByUser(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.data.accounts).toBeDefined();
      expect(Array.isArray(result.data.accounts)).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalAccounts).toBeGreaterThanOrEqual(1);
    });

    test('should return empty accounts array for user with no accounts', () => {
      // Use a non-existent user ID
      const result = ReconciliationStatusService.getReconciliationStatusByUser(999999);
      
      expect(result.success).toBe(true);
      expect(result.data.accounts).toEqual([]);
      expect(result.data.overallProgress).toBe(100);
    });

    test('should calculate overall progress across accounts', () => {
      // Create some transactions
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-01',
        description: 'Reconciled',
        transactionType: 'credit',
        amount: 10000,
        reconciliationStatus: 'matched',
        isReconciled: true
      });
      
      BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-02',
        description: 'Unreconciled',
        transactionType: 'debit',
        amount: 5000,
        reconciliationStatus: 'unmatched',
        isReconciled: false
      });
      
      const result = ReconciliationStatusService.getReconciliationStatusByUser(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.data.summary.totalTransactions).toBe(2);
      expect(result.data.summary.totalReconciled).toBe(1);
      expect(result.data.summary.totalUnreconciled).toBe(1);
      expect(result.data.summary.overallProgress).toBe(50);
    });
  });
});
