/**
 * Unit tests for ReconciliationMatcher service.
 * Tests matching logic, score calculation, and reconciliation operations.
 * 
 * @module tests/reconciliationMatcher.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const ReconciliationMatcher = require('../services/reconciliationMatcher');
const BankTransaction = require('../database/models/BankTransaction');
const Transaction = require('../database/models/Transaction');
const Reconciliation = require('../database/models/Reconciliation');
const BankAccount = require('../database/models/BankAccount');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-matcher-database.sqlite');

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
    VALUES ('testmatcher@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testmatcher@example.com');
  testUserId = user.id;
  
  // Create a test bank account
  executeMany(`
    INSERT INTO bank_accounts (userId, accountName, bankName, sortCode, accountNumber, currency)
    VALUES (${testUserId}, 'Matcher Test Account', 'Test Bank', '123456', '12345678', 'GBP');
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

describe('ReconciliationMatcher Service', () => {
  describe('calculateStringSimilarity', () => {
    test('should return 1 for identical strings', () => {
      const similarity = ReconciliationMatcher.calculateStringSimilarity(
        'Payment to Acme Corp',
        'Payment to Acme Corp'
      );
      expect(similarity).toBe(1);
    });

    test('should return 0 for completely different strings', () => {
      const similarity = ReconciliationMatcher.calculateStringSimilarity(
        'Apple Store Purchase',
        'Rent Payment Monthly'
      );
      expect(similarity).toBe(0);
    });

    test('should return partial similarity for overlapping words', () => {
      const similarity = ReconciliationMatcher.calculateStringSimilarity(
        'Payment to Acme Corp',
        'Acme Corp Invoice'
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    test('should ignore short words (<=2 chars)', () => {
      const similarity = ReconciliationMatcher.calculateStringSimilarity(
        'A B C D Payment',
        'A B C D Invoice'
      );
      // Only 'Payment' and 'Invoice' should be compared (both >2 chars)
      expect(similarity).toBe(0);
    });

    test('should return 0 for empty strings', () => {
      expect(ReconciliationMatcher.calculateStringSimilarity('', 'test')).toBe(0);
      expect(ReconciliationMatcher.calculateStringSimilarity('test', '')).toBe(0);
      expect(ReconciliationMatcher.calculateStringSimilarity(null, 'test')).toBe(0);
    });
  });

  describe('getDaysDifference', () => {
    test('should return 0 for same date', () => {
      expect(ReconciliationMatcher.getDaysDifference('2026-01-15', '2026-01-15')).toBe(0);
    });

    test('should return correct difference', () => {
      expect(ReconciliationMatcher.getDaysDifference('2026-01-15', '2026-01-18')).toBe(3);
      expect(ReconciliationMatcher.getDaysDifference('2026-01-18', '2026-01-15')).toBe(3);
    });
  });

  describe('areTypesCompatible', () => {
    test('credit should match income', () => {
      expect(ReconciliationMatcher.areTypesCompatible('credit', 'income')).toBe(true);
    });

    test('credit should match transfer', () => {
      expect(ReconciliationMatcher.areTypesCompatible('credit', 'transfer')).toBe(true);
    });

    test('credit should not match expense', () => {
      expect(ReconciliationMatcher.areTypesCompatible('credit', 'expense')).toBe(false);
    });

    test('debit should match expense', () => {
      expect(ReconciliationMatcher.areTypesCompatible('debit', 'expense')).toBe(true);
    });

    test('debit should match transfer', () => {
      expect(ReconciliationMatcher.areTypesCompatible('debit', 'transfer')).toBe(true);
    });

    test('debit should not match income', () => {
      expect(ReconciliationMatcher.areTypesCompatible('debit', 'income')).toBe(false);
    });
  });

  describe('calculateMatchScore', () => {
    test('should return 0 for incompatible types', () => {
      const bankTxn = { transactionType: 'credit', amount: 10000, transactionDate: '2026-01-15', description: 'Test' };
      const appTxn = { type: 'expense', totalAmount: 10000, transactionDate: '2026-01-15', description: 'Test' };
      
      const { score, details } = ReconciliationMatcher.calculateMatchScore(bankTxn, appTxn);
      expect(score).toBe(0);
      expect(details.typeCompatible).toBe(false);
    });

    test('should return high score for exact match', () => {
      const bankTxn = { 
        transactionType: 'credit', 
        amount: 10000, 
        transactionDate: '2026-01-15', 
        description: 'Payment from Customer ABC',
        reference: 'INV-001'
      };
      const appTxn = { 
        type: 'income', 
        totalAmount: 10000, 
        transactionDate: '2026-01-15', 
        description: 'Payment from Customer ABC',
        reference: 'INV-001'
      };
      
      const { score, details } = ReconciliationMatcher.calculateMatchScore(bankTxn, appTxn);
      expect(score).toBeGreaterThanOrEqual(90);
      expect(details.amountScore).toBe(50); // Full amount match weight
    });

    test('should reduce score for different dates', () => {
      const bankTxn = { transactionType: 'credit', amount: 10000, transactionDate: '2026-01-15', description: 'Test' };
      const appTxn1 = { type: 'income', totalAmount: 10000, transactionDate: '2026-01-15', description: 'Test' };
      const appTxn2 = { type: 'income', totalAmount: 10000, transactionDate: '2026-01-20', description: 'Test' };
      
      const { score: score1 } = ReconciliationMatcher.calculateMatchScore(bankTxn, appTxn1);
      const { score: score2 } = ReconciliationMatcher.calculateMatchScore(bankTxn, appTxn2);
      
      expect(score1).toBeGreaterThan(score2);
    });

    test('should reduce score for amount mismatch', () => {
      const bankTxn = { transactionType: 'credit', amount: 10000, transactionDate: '2026-01-15', description: 'Test' };
      const appTxn1 = { type: 'income', totalAmount: 10000, transactionDate: '2026-01-15', description: 'Test' };
      const appTxn2 = { type: 'income', totalAmount: 9500, transactionDate: '2026-01-15', description: 'Test' };
      
      const { score: score1 } = ReconciliationMatcher.calculateMatchScore(bankTxn, appTxn1);
      const { score: score2 } = ReconciliationMatcher.calculateMatchScore(bankTxn, appTxn2);
      
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('findPotentialMatches', () => {
    test('should find matching transactions', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment from Customer',
        transactionType: 'credit',
        amount: 50000
      });

      // Create matching app transaction
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment from Customer',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.findPotentialMatches(bankTxn.data.id);

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].matchConfidence).toBeGreaterThanOrEqual(50);
    });

    test('should return empty matches for already reconciled transaction', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Already Reconciled',
        transactionType: 'credit',
        amount: 50000,
        isReconciled: true
      });

      const result = ReconciliationMatcher.findPotentialMatches(bankTxn.data.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already reconciled');
    });

    test('should not find matches for incompatible types', () => {
      // Create credit bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Credit Transaction',
        transactionType: 'credit',
        amount: 50000
      });

      // Create expense app transaction (incompatible with credit)
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Credit Transaction',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.findPotentialMatches(bankTxn.data.id);

      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(0);
    });

    test('should rank matches by confidence score', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment from ABC Corp',
        transactionType: 'credit',
        amount: 50000
      });

      // Create exact match
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment from ABC Corp',
        totalAmount: 50000
      });

      // Create partial match (different date)
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-18',
        description: 'Payment from ABC Corp',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.findPotentialMatches(bankTxn.data.id);

      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(2);
      expect(result.matches[0].matchConfidence).toBeGreaterThanOrEqual(result.matches[1].matchConfidence);
    });
  });

  describe('createMatch', () => {
    test('should create reconciliation match', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment',
        transactionType: 'credit',
        amount: 50000
      });

      // Create app transaction
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.createMatch(
        bankTxn.data.id,
        appTxn.data.id,
        testUserId,
        { notes: 'Test match' }
      );

      expect(result.success).toBe(true);
      expect(result.data.reconciliation).toBeDefined();
      expect(result.data.reconciliation.status).toBe('confirmed');
      expect(result.data.bankTransaction.isReconciled).toBe(true);
      expect(result.data.appTransaction.status).toBe('reconciled');
    });

    test('should fail for incompatible types', () => {
      // Create credit bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Credit',
        transactionType: 'credit',
        amount: 50000
      });

      // Create expense app transaction
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Expense',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.createMatch(
        bankTxn.data.id,
        appTxn.data.id,
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not compatible');
    });

    test('should fail for already reconciled pair', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment',
        transactionType: 'credit',
        amount: 50000
      });

      // Create app transaction
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment',
        totalAmount: 50000
      });

      // Create first match
      ReconciliationMatcher.createMatch(bankTxn.data.id, appTxn.data.id, testUserId);

      // Try to create duplicate
      const result = ReconciliationMatcher.createMatch(
        bankTxn.data.id,
        appTxn.data.id,
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already reconciled');
    });
  });

  describe('removeMatch', () => {
    test('should remove reconciliation and update statuses', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment',
        transactionType: 'credit',
        amount: 50000
      });

      // Create app transaction
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment',
        totalAmount: 50000
      });

      // Create match
      const matchResult = ReconciliationMatcher.createMatch(
        bankTxn.data.id,
        appTxn.data.id,
        testUserId
      );

      // Remove match
      const result = ReconciliationMatcher.removeMatch(
        matchResult.data.reconciliation.id,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.data.bankTransaction.isReconciled).toBe(false);
      expect(result.data.bankTransaction.reconciliationStatus).toBe('unmatched');
    });
  });

  describe('unreconcileBankTransaction', () => {
    test('should remove all reconciliations for a bank transaction', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Split Payment',
        transactionType: 'credit',
        amount: 100000
      });

      // Create two app transactions
      const appTxn1 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Part 1',
        totalAmount: 50000
      });

      const appTxn2 = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Part 2',
        totalAmount: 50000
      });

      // Create matches
      ReconciliationMatcher.createMatch(bankTxn.data.id, appTxn1.data.id, testUserId);
      ReconciliationMatcher.createMatch(bankTxn.data.id, appTxn2.data.id, testUserId);

      // Unreconcile all
      const result = ReconciliationMatcher.unreconcileBankTransaction(bankTxn.data.id, testUserId);

      expect(result.success).toBe(true);
      expect(result.data.removedReconciliations).toBe(2);
      expect(result.data.bankTransaction.isReconciled).toBe(false);
    });
  });

  describe('validateMatch', () => {
    test('should validate compatible match', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment',
        transactionType: 'credit',
        amount: 50000
      });

      // Create app transaction
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.validateMatch(bankTxn.data.id, appTxn.data.id);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should report amount mismatch as warning', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Payment',
        transactionType: 'credit',
        amount: 50000
      });

      // Create app transaction with different amount
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Payment',
        totalAmount: 45000
      });

      const result = ReconciliationMatcher.validateMatch(bankTxn.data.id, appTxn.data.id);

      // Should still be valid (amount mismatch is a warning)
      expect(result.valid).toBe(true);
      expect(result.errors.some(e => e.includes('Amount mismatch'))).toBe(true);
    });

    test('should report incompatible types as error', () => {
      // Create credit bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Credit',
        transactionType: 'credit',
        amount: 50000
      });

      // Create expense app transaction
      const appTxn = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Expense',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.validateMatch(bankTxn.data.id, appTxn.data.id);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not compatible'))).toBe(true);
    });
  });

  describe('autoReconcile', () => {
    test('should auto-reconcile high confidence matches', () => {
      // Create bank transactions
      const bankTxn1 = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Exact Match Payment ABC',
        transactionType: 'credit',
        amount: 50000
      });

      const bankTxn2 = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-16',
        description: 'Another Payment XYZ',
        transactionType: 'credit',
        amount: 30000
      });

      // Create matching app transactions
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Exact Match Payment ABC',
        totalAmount: 50000
      });

      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-16',
        description: 'Another Payment XYZ',
        totalAmount: 30000
      });

      const result = ReconciliationMatcher.autoReconcile(testBankAccountId, testUserId, {
        minConfidence: 80
      });

      expect(result.success).toBe(true);
      expect(result.data.matchedCount).toBeGreaterThan(0);
    });

    test('should return suggestions in dry run mode', () => {
      // Create bank transaction
      const bankTxn = BankTransaction.createBankTransaction({
        bankAccountId: testBankAccountId,
        transactionDate: '2026-01-15',
        description: 'Dry Run Test',
        transactionType: 'credit',
        amount: 50000
      });

      // Create matching app transaction
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Dry Run Test',
        totalAmount: 50000
      });

      const result = ReconciliationMatcher.autoReconcile(testBankAccountId, testUserId, {
        minConfidence: 80,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toBeDefined();
      
      // Verify no actual matches were created
      const reconciliations = Reconciliation.getByBankTransactionId(bankTxn.data.id);
      expect(reconciliations.length).toBe(0);
    });
  });
});
