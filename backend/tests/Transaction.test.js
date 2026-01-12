/**
 * Unit tests for Transaction model.
 * Tests validation, CRUD operations, and business logic.
 * 
 * @module tests/Transaction.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Transaction = require('../database/models/Transaction');
const Category = require('../database/models/Category');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-transaction-database.sqlite');

// Test user and category IDs
let testUserId;
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
  
  // Create a test user for foreign key relationships
  executeMany(`
    INSERT INTO users (email, passwordHash, name, businessName)
    VALUES ('testtransaction@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testtransaction@example.com');
  testUserId = user.id;
  
  // Create a test category
  const categoryResult = Category.createCategory({
    code: 'TEST-CAT',
    name: 'Test Category',
    type: 'expense'
  });
  testCategoryId = categoryResult.data.id;
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
 * Clean up transactions table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM transactions;');
});

describe('Transaction Model', () => {
  describe('validateTransactionData', () => {
    describe('required fields', () => {
      test('should fail validation for missing userId', () => {
        const result = Transaction.validateTransactionData({
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test transaction'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.userId).toBeDefined();
      });

      test('should fail validation for missing type', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          transactionDate: '2026-01-15',
          description: 'Test transaction'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.type).toBeDefined();
      });

      test('should fail validation for missing transactionDate', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          description: 'Test transaction'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionDate).toBeDefined();
      });

      test('should fail validation for missing description', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '2026-01-15'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.description).toBeDefined();
      });
    });

    describe('type validation', () => {
      test('should fail validation for invalid type', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'invalid-type',
          transactionDate: '2026-01-15',
          description: 'Test'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.type).toContain('Invalid type');
      });

      test('should pass validation for all valid types', () => {
        const types = ['income', 'expense', 'transfer'];
        for (const type of types) {
          const result = Transaction.validateTransactionData({
            userId: 1,
            type,
            transactionDate: '2026-01-15',
            description: 'Test transaction'
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('status validation', () => {
      test('should fail validation for invalid status', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test',
          status: 'invalid-status'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.status).toContain('Invalid status');
      });

      test('should pass validation for all valid statuses', () => {
        const statuses = ['pending', 'cleared', 'reconciled', 'void'];
        for (const status of statuses) {
          const result = Transaction.validateTransactionData({
            userId: 1,
            type: 'expense',
            transactionDate: '2026-01-15',
            description: 'Test transaction',
            status
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('date validation', () => {
      test('should fail validation for invalid date format', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '15-01-2026',
          description: 'Test'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.transactionDate).toContain('Invalid transactionDate format');
      });
    });

    describe('amount validation', () => {
      test('should fail validation for negative amount', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test',
          amount: -100
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toContain('non-negative integer');
      });

      test('should fail validation for non-integer amount', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test',
          amount: 100.50
        });
        expect(result.isValid).toBe(false);
      });
    });

    describe('payment method validation', () => {
      test('should fail validation for invalid payment method', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test',
          paymentMethod: 'invalid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.paymentMethod).toContain('Invalid paymentMethod');
      });

      test('should pass validation for valid payment methods', () => {
        const methods = ['cash', 'bank_transfer', 'card', 'cheque', 'direct_debit', 'standing_order', 'other'];
        for (const method of methods) {
          const result = Transaction.validateTransactionData({
            userId: 1,
            type: 'expense',
            transactionDate: '2026-01-15',
            description: 'Test',
            paymentMethod: method
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('recurring validation', () => {
      test('should fail when isRecurring is true but no frequency', () => {
        const result = Transaction.validateTransactionData({
          userId: 1,
          type: 'expense',
          transactionDate: '2026-01-15',
          description: 'Test',
          isRecurring: true
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.recurringFrequency).toContain('required when isRecurring is true');
      });
    });
  });

  describe('calculateVat', () => {
    test('should calculate VAT correctly at 20%', () => {
      const result = Transaction.calculateVat(10000, 2000);
      expect(result.vatAmount).toBe(2000);
      expect(result.totalAmount).toBe(12000);
    });

    test('should calculate VAT correctly at 5%', () => {
      const result = Transaction.calculateVat(10000, 500);
      expect(result.vatAmount).toBe(500);
      expect(result.totalAmount).toBe(10500);
    });

    test('should handle zero VAT rate', () => {
      const result = Transaction.calculateVat(10000, 0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(10000);
    });

    test('should round VAT amounts correctly', () => {
      const result = Transaction.calculateVat(1001, 2000);
      expect(result.vatAmount).toBe(200); // Rounded from 200.2
      expect(result.totalAmount).toBe(1201);
    });
  });

  describe('createTransaction', () => {
    test('should create a transaction with valid data', () => {
      const result = Transaction.createTransaction({
        userId: testUserId,
        categoryId: testCategoryId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Office supplies',
        amount: 5000,
        vatRate: 2000,
        paymentMethod: 'card',
        payee: 'Staples'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.userId).toBe(testUserId);
      expect(result.data.type).toBe('expense');
      expect(result.data.amount).toBe(5000);
      expect(result.data.vatAmount).toBe(1000);
      expect(result.data.totalAmount).toBe(6000);
      expect(result.data.status).toBe('pending');
    });

    test('should create a transaction with explicit VAT amounts', () => {
      const result = Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Consulting invoice',
        amount: 10000,
        vatAmount: 2000,
        totalAmount: 12000
      });

      expect(result.success).toBe(true);
      expect(result.data.amount).toBe(10000);
      expect(result.data.vatAmount).toBe(2000);
      expect(result.data.totalAmount).toBe(12000);
    });

    test('should create a recurring transaction', () => {
      const result = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Monthly rent',
        amount: 100000,
        isRecurring: true,
        recurringFrequency: 'monthly'
      });

      expect(result.success).toBe(true);
      expect(result.data.isRecurring).toBe(true);
      expect(result.data.recurringFrequency).toBe('monthly');
    });
  });

  describe('findById', () => {
    test('should find transaction by ID', () => {
      const created = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Find me'
      });

      const found = Transaction.findById(created.data.id);
      expect(found).not.toBeNull();
      expect(found.description).toBe('Find me');
    });

    test('should return null for non-existent ID', () => {
      const found = Transaction.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findByReference', () => {
    test('should find transactions by reference', () => {
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'With reference',
        reference: 'INV-001'
      });

      const found = Transaction.findByReference(testUserId, 'INV-001');
      expect(found).toHaveLength(1);
      expect(found[0].reference).toBe('INV-001');
    });
  });

  describe('getTransactionsByUserId', () => {
    beforeEach(() => {
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-10',
        description: 'Income 1',
        amount: 10000
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Expense 1',
        amount: 5000
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-20',
        description: 'Expense 2',
        amount: 3000,
        status: 'cleared'
      });
    });

    test('should return paginated transactions', () => {
      const result = Transaction.getTransactionsByUserId(testUserId);
      expect(result.transactions).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    test('should filter by type', () => {
      const result = Transaction.getTransactionsByUserId(testUserId, { type: 'expense' });
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions.every(t => t.type === 'expense')).toBe(true);
    });

    test('should filter by status', () => {
      const result = Transaction.getTransactionsByUserId(testUserId, { status: 'cleared' });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Expense 2');
    });

    test('should filter by date range', () => {
      const result = Transaction.getTransactionsByUserId(testUserId, {
        startDate: '2026-01-12',
        endDate: '2026-01-18'
      });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Expense 1');
    });

    test('should respect pagination', () => {
      const result = Transaction.getTransactionsByUserId(testUserId, { page: 1, limit: 2 });
      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('updateTransaction', () => {
    test('should update transaction fields', () => {
      const created = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Original',
        amount: 1000
      });

      const result = Transaction.updateTransaction(created.data.id, {
        description: 'Updated',
        amount: 2000,
        status: 'cleared'
      });

      expect(result.success).toBe(true);
      expect(result.data.description).toBe('Updated');
      expect(result.data.amount).toBe(2000);
      expect(result.data.status).toBe('cleared');
    });

    test('should fail to update non-existent transaction', () => {
      const result = Transaction.updateTransaction(99999, {
        description: 'New'
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBe('Transaction not found');
    });
  });

  describe('deleteTransaction', () => {
    test('should delete transaction', () => {
      const created = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'To delete'
      });

      const result = Transaction.deleteTransaction(created.data.id);
      expect(result.success).toBe(true);

      const found = Transaction.findById(created.data.id);
      expect(found).toBeNull();
    });

    test('should return error for non-existent transaction', () => {
      const result = Transaction.deleteTransaction(99999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });
  });

  describe('updateStatus', () => {
    test('should update transaction status', () => {
      const created = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Status test'
      });

      const result = Transaction.updateStatus(created.data.id, 'cleared');
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('cleared');
    });

    test('should fail for invalid status', () => {
      const created = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Status test'
      });

      const result = Transaction.updateStatus(created.data.id, 'invalid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });
  });

  describe('voidTransaction', () => {
    test('should void a transaction', () => {
      const created = Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'To void'
      });

      const result = Transaction.voidTransaction(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('void');
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Income',
        amount: 10000,
        vatAmount: 2000,
        totalAmount: 12000
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Expense',
        amount: 5000,
        vatAmount: 1000,
        totalAmount: 6000
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Void expense',
        amount: 2000,
        totalAmount: 2000,
        status: 'void'
      });
    });

    test('should calculate summary correctly', () => {
      const summary = Transaction.getSummary(testUserId, '2026-01-01', '2026-01-31');
      expect(summary.income).toBe(12000);
      expect(summary.expense).toBe(6000);
      expect(summary.netAmount).toBe(6000);
      expect(summary.vatCollected).toBe(2000);
      expect(summary.vatPaid).toBe(1000);
    });

    test('should exclude voided transactions', () => {
      const summary = Transaction.getSummary(testUserId, '2026-01-01', '2026-01-31');
      // Voided expense of 2000 should not be included
      expect(summary.expense).toBe(6000);
    });
  });

  describe('getVatSummary', () => {
    beforeEach(() => {
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Sale',
        amount: 10000,
        vatAmount: 2000,
        totalAmount: 12000
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Purchase',
        amount: 4000,
        vatAmount: 800,
        totalAmount: 4800
      });
    });

    test('should calculate VAT summary correctly', () => {
      const vatSummary = Transaction.getVatSummary(testUserId, '2026-01-01', '2026-01-31');
      expect(vatSummary.outputVat).toBe(2000);
      expect(vatSummary.inputVat).toBe(800);
      expect(vatSummary.netVat).toBe(1200);
      expect(vatSummary.totalSales).toBe(12000);
      expect(vatSummary.totalPurchases).toBe(4800);
    });
  });

  describe('getTypeCounts', () => {
    beforeEach(() => {
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Income 1'
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'income',
        transactionDate: '2026-01-15',
        description: 'Income 2'
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Expense 1'
      });
    });

    test('should return correct counts by type', () => {
      const counts = Transaction.getTypeCounts(testUserId);
      expect(counts.income).toBe(2);
      expect(counts.expense).toBe(1);
      expect(counts.transfer).toBe(0);
    });
  });

  describe('searchTransactions', () => {
    beforeEach(() => {
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Office supplies from Amazon',
        payee: 'Amazon UK'
      });
      Transaction.createTransaction({
        userId: testUserId,
        type: 'expense',
        transactionDate: '2026-01-15',
        description: 'Software subscription',
        reference: 'SUB-001'
      });
    });

    test('should find by description', () => {
      const results = Transaction.searchTransactions(testUserId, 'Office');
      expect(results).toHaveLength(1);
      expect(results[0].description).toContain('Office');
    });

    test('should find by payee', () => {
      const results = Transaction.searchTransactions(testUserId, 'Amazon');
      expect(results).toHaveLength(1);
      expect(results[0].payee).toBe('Amazon UK');
    });

    test('should find by reference', () => {
      const results = Transaction.searchTransactions(testUserId, 'SUB-001');
      expect(results).toHaveLength(1);
    });

    test('should return empty for no matches', () => {
      const results = Transaction.searchTransactions(testUserId, 'nonexistent');
      expect(results).toHaveLength(0);
    });
  });
});
