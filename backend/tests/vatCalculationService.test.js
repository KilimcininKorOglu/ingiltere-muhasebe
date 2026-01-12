/**
 * Unit Tests for VAT Calculation Service
 * 
 * Tests VAT return calculation service functionality including:
 * - VAT calculation for periods
 * - Standard and cash accounting schemes
 * - Period comparisons
 * - Statistics and estimations
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');

const {
  calculateVatReturn,
  calculateAndPrepareVatReturn,
  getVatReturnPreview,
  compareVatPeriods,
  estimateVatLiability,
  getVatStatistics,
  getIncomeTransactions,
  getExpenseTransactions,
  getSalesInvoices,
  validateCalculationParams,
  validateAgainstSaved,
  ACCOUNTING_SCHEMES
} = require('../services/vatCalculationService');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-vat-calculation-database.sqlite');

// Test user data
let testUserId;

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
    VALUES ('testvat@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testvat@example.com');
  testUserId = user.id;
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
 * Clean up test data before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM invoice_items;');
  executeMany('DELETE FROM invoices;');
  executeMany('DELETE FROM transactions;');
  executeMany('DELETE FROM vat_returns;');
});

/**
 * Helper to create test transactions
 */
function createTestTransactions(transactions) {
  const db = openDatabase();
  const stmt = db.prepare(`
    INSERT INTO transactions (userId, type, status, transactionDate, description, amount, vatAmount, totalAmount, vatRate)
    VALUES (@userId, @type, @status, @transactionDate, @description, @amount, @vatAmount, @totalAmount, @vatRate)
  `);
  
  for (const txn of transactions) {
    stmt.run({
      userId: testUserId,
      type: txn.type,
      status: txn.status || 'cleared',
      transactionDate: txn.transactionDate,
      description: txn.description || 'Test transaction',
      amount: txn.amount,
      vatAmount: txn.vatAmount,
      totalAmount: txn.totalAmount || (txn.amount + txn.vatAmount),
      vatRate: txn.vatRate || 2000
    });
  }
}

/**
 * Helper to create test invoices
 */
function createTestInvoices(invoices) {
  const db = openDatabase();
  const stmt = db.prepare(`
    INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, subtotal, vatAmount, totalAmount)
    VALUES (@userId, @invoiceNumber, @status, @issueDate, @dueDate, @customerName, @subtotal, @vatAmount, @totalAmount)
  `);
  
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    stmt.run({
      userId: testUserId,
      invoiceNumber: inv.invoiceNumber || `INV-2026-${String(i + 1).padStart(4, '0')}`,
      status: inv.status || 'pending',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate || inv.issueDate,
      customerName: inv.customerName || 'Test Customer',
      subtotal: inv.subtotal,
      vatAmount: inv.vatAmount,
      totalAmount: inv.totalAmount || (inv.subtotal + inv.vatAmount)
    });
  }
}

/**
 * Helper to create test VAT returns
 */
function createTestVatReturns(returns) {
  const db = openDatabase();
  const stmt = db.prepare(`
    INSERT INTO vat_returns (userId, periodStart, periodEnd, status, box1, box2, box3, box4, box5, box6, box7, box8, box9)
    VALUES (@userId, @periodStart, @periodEnd, @status, @box1, @box2, @box3, @box4, @box5, @box6, @box7, @box8, @box9)
  `);
  
  for (const vatReturn of returns) {
    stmt.run({
      userId: testUserId,
      periodStart: vatReturn.periodStart,
      periodEnd: vatReturn.periodEnd,
      status: vatReturn.status || 'submitted',
      box1: vatReturn.box1 || 0,
      box2: vatReturn.box2 || 0,
      box3: vatReturn.box3 || 0,
      box4: vatReturn.box4 || 0,
      box5: vatReturn.box5 || 0,
      box6: vatReturn.box6 || 0,
      box7: vatReturn.box7 || 0,
      box8: vatReturn.box8 || 0,
      box9: vatReturn.box9 || 0
    });
  }
}

describe('VAT Calculation Service', () => {
  describe('validateCalculationParams', () => {
    it('should pass for valid parameters', () => {
      const result = validateCalculationParams(1, '2026-01-01', '2026-03-31');
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should fail for invalid userId', () => {
      const result = validateCalculationParams(0, '2026-01-01', '2026-03-31');
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
    });

    it('should fail for invalid date format', () => {
      const result = validateCalculationParams(1, '01-01-2026', '2026-03-31');
      expect(result.isValid).toBe(false);
      expect(result.errors.periodStart).toBeDefined();
    });

    it('should fail when periodEnd is before periodStart', () => {
      const result = validateCalculationParams(1, '2026-03-31', '2026-01-01');
      expect(result.isValid).toBe(false);
      expect(result.errors.periodEnd).toBeDefined();
    });
  });

  describe('getIncomeTransactions', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 10000, vatAmount: 2000 },
        { type: 'income', status: 'pending', transactionDate: '2026-02-15', amount: 5000, vatAmount: 1000 },
        { type: 'income', status: 'void', transactionDate: '2026-02-20', amount: 8000, vatAmount: 1600 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-25', amount: 3000, vatAmount: 600 },
        { type: 'income', status: 'cleared', transactionDate: '2026-04-15', amount: 6000, vatAmount: 1200 } // Outside range
      ]);
    });

    it('should return income transactions in date range (standard accounting)', () => {
      const transactions = getIncomeTransactions(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' });
      
      expect(transactions.length).toBe(2); // Excludes void and expense
      expect(transactions.every(t => t.type === 'income')).toBe(true);
      expect(transactions.every(t => t.status !== 'void')).toBe(true);
    });

    it('should filter by cash status (cash accounting)', () => {
      const transactions = getIncomeTransactions(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' });
      
      expect(transactions.length).toBe(1); // Only cleared
      expect(transactions[0].status).toBe('cleared');
    });
  });

  describe('getExpenseTransactions', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-15', amount: 5000, vatAmount: 1000 },
        { type: 'expense', status: 'pending', transactionDate: '2026-02-15', amount: 3000, vatAmount: 600 },
        { type: 'expense', status: 'void', transactionDate: '2026-02-20', amount: 8000, vatAmount: 1600 }
      ]);
    });

    it('should return expense transactions in date range', () => {
      const transactions = getExpenseTransactions(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' });
      
      expect(transactions.length).toBe(2); // Excludes void
      expect(transactions.every(t => t.type === 'expense')).toBe(true);
    });
  });

  describe('getSalesInvoices', () => {
    beforeEach(() => {
      createTestInvoices([
        { issueDate: '2026-01-15', subtotal: 10000, vatAmount: 2000, status: 'pending' },
        { issueDate: '2026-02-15', subtotal: 5000, vatAmount: 1000, status: 'paid' },
        { issueDate: '2026-02-20', subtotal: 8000, vatAmount: 1600, status: 'cancelled' },
        { issueDate: '2026-04-15', subtotal: 6000, vatAmount: 1200, status: 'pending' } // Outside range
      ]);
    });

    it('should return non-void invoices in date range', () => {
      const invoices = getSalesInvoices(testUserId, '2026-01-01', '2026-03-31');
      
      expect(invoices.length).toBe(2);
      expect(invoices.every(i => i.status !== 'void' && i.status !== 'cancelled')).toBe(true);
    });
  });

  describe('calculateVatReturn', () => {
    beforeEach(() => {
      // Create income transactions
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 50000, vatAmount: 10000 }
      ]);
      
      // Create expense transactions
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 25000, vatAmount: 5000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-20', amount: 15000, vatAmount: 3000 }
      ]);
      
      // Create sales invoices
      createTestInvoices([
        { issueDate: '2026-01-15', subtotal: 100000, vatAmount: 20000 },
        { issueDate: '2026-02-15', subtotal: 50000, vatAmount: 10000 }
      ]);
    });

    it('should calculate VAT return correctly (standard accounting)', () => {
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' });
      
      expect(result.success).toBe(true);
      expect(result.data.boxes.box1).toBe(30000);  // VAT on invoices
      expect(result.data.boxes.box2).toBe(0);      // EC acquisitions (post-Brexit)
      expect(result.data.boxes.box3).toBe(30000);  // Total VAT due
      expect(result.data.boxes.box4).toBe(8000);   // VAT reclaimed
      expect(result.data.boxes.box5).toBe(22000);  // Net VAT
      expect(result.data.boxes.box6).toBe(150000); // Total sales
      expect(result.data.boxes.box7).toBe(40000);  // Total purchases
      expect(result.data.boxes.box8).toBe(0);      // EC supplies
      expect(result.data.boxes.box9).toBe(0);      // EC acquisitions
    });

    it('should calculate VAT return correctly (cash accounting)', () => {
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' });
      
      expect(result.success).toBe(true);
      expect(result.data.boxes.box1).toBe(30000);  // VAT on transactions
      expect(result.data.boxes.box4).toBe(8000);   // VAT reclaimed
      expect(result.data.boxes.box6).toBe(150000); // Total sales (from transactions)
    });

    it('should fail with invalid parameters', () => {
      const result = calculateVatReturn(0, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(false);
      expect(result.errors.userId).toBeDefined();
    });

    it('should fail with invalid accounting scheme', () => {
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'invalid' });
      
      expect(result.success).toBe(false);
      expect(result.errors.accountingScheme).toBeDefined();
    });

    it('should include breakdown when requested', () => {
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', { includeBreakdown: true });
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown).toBeDefined();
      expect(result.data.breakdown.income.transactionCount).toBeDefined();
      expect(result.data.breakdown.expense.transactionCount).toBeDefined();
    });

    it('should include summary with refund indicator', () => {
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.isRefundDue).toBe(false); // Not a refund
    });

    it('should handle empty period', () => {
      const result = calculateVatReturn(testUserId, '2025-01-01', '2025-03-31');
      
      expect(result.success).toBe(true);
      expect(result.data.boxes.box1).toBe(0);
      expect(result.data.boxes.box5).toBe(0);
    });
  });

  describe('calculateAndPrepareVatReturn', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000 }
      ]);
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 20000, vatAmount: 4000 }
      ]);
    });

    it('should return data ready for VatReturn model', () => {
      const result = calculateAndPrepareVatReturn(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(true);
      expect(result.data.userId).toBe(testUserId);
      expect(result.data.periodStart).toBe('2026-01-01');
      expect(result.data.periodEnd).toBe('2026-03-31');
      expect(result.data.status).toBe('draft');
      expect(result.data.box1).toBeDefined();
      expect(result.data.box9).toBeDefined();
    });
  });

  describe('getVatReturnPreview', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000 }
      ]);
    });

    it('should return formatted summary in English', () => {
      const result = getVatReturnPreview(testUserId, '2026-01-01', '2026-03-31', { language: 'en' });
      
      expect(result.success).toBe(true);
      expect(result.data.formattedSummary).toBeDefined();
      expect(result.data.formattedSummary.boxes).toHaveLength(9);
      expect(result.data.submissionFormat).toBeDefined();
    });

    it('should return formatted summary in Turkish', () => {
      const result = getVatReturnPreview(testUserId, '2026-01-01', '2026-03-31', { language: 'tr' });
      
      expect(result.success).toBe(true);
      expect(result.data.formattedSummary.boxes[0].name).toContain('KDV');
    });
  });

  describe('compareVatPeriods', () => {
    beforeEach(() => {
      // Q1 data
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000 }
      ]);
      // Q2 data
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-04-15', amount: 75000, vatAmount: 15000 }
      ]);
    });

    it('should compare two periods', () => {
      const result = compareVatPeriods(
        testUserId,
        { start: '2026-04-01', end: '2026-06-30' }, // Q2 (current)
        { start: '2026-01-01', end: '2026-03-31' }, // Q1 (previous)
        { accountingScheme: 'cash' }
      );
      
      expect(result.success).toBe(true);
      expect(result.data.currentPeriod).toBeDefined();
      expect(result.data.previousPeriod).toBeDefined();
      expect(result.data.changes).toBeDefined();
      expect(result.data.changes.box1.change).toBe(5000); // 15000 - 10000
    });

    it('should calculate percentage changes', () => {
      const result = compareVatPeriods(
        testUserId,
        { start: '2026-04-01', end: '2026-06-30' },
        { start: '2026-01-01', end: '2026-03-31' },
        { accountingScheme: 'cash' }
      );
      
      expect(result.success).toBe(true);
      expect(result.data.changes.box1.percentChange).toBe(50); // 50% increase
    });
  });

  describe('estimateVatLiability', () => {
    beforeEach(() => {
      createTestVatReturns([
        { periodStart: '2025-01-01', periodEnd: '2025-03-31', status: 'submitted', box1: 10000, box4: 3000, box5: 7000 },
        { periodStart: '2025-04-01', periodEnd: '2025-06-30', status: 'accepted', box1: 12000, box4: 4000, box5: 8000 },
        { periodStart: '2025-07-01', periodEnd: '2025-09-30', status: 'submitted', box1: 14000, box4: 5000, box5: 9000 },
        { periodStart: '2025-10-01', periodEnd: '2025-12-31', status: 'accepted', box1: 16000, box4: 6000, box5: 10000 }
      ]);
    });

    it('should estimate based on historical data', () => {
      const result = estimateVatLiability(testUserId, 4);
      
      expect(result.success).toBe(true);
      expect(result.data.estimated).toBe(true);
      expect(result.data.periodsUsed).toBe(4);
      expect(result.data.averages).toBeDefined();
      expect(result.data.averages.box1).toBe(13000); // Average of 10000, 12000, 14000, 16000
      expect(result.data.averages.box5).toBe(8500);  // Average of 7000, 8000, 9000, 10000
    });

    it('should return no estimate for user with no history', () => {
      // Create a new user with no VAT returns
      executeMany(`
        INSERT INTO users (email, passwordHash, name, businessName)
        VALUES ('newuser@example.com', 'hashedpassword', 'New User', 'New Business');
      `);
      const db = openDatabase();
      const newUser = db.prepare('SELECT id FROM users WHERE email = ?').get('newuser@example.com');
      
      const result = estimateVatLiability(newUser.id, 4);
      
      expect(result.success).toBe(true);
      expect(result.data.estimated).toBe(false);
    });
  });

  describe('getVatStatistics', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-03-15', amount: 100000, vatAmount: 20000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-03-20', amount: 40000, vatAmount: 8000 }
      ]);
      createTestInvoices([
        { issueDate: '2026-03-15', subtotal: 100000, vatAmount: 20000 }
      ]);
      createTestVatReturns([
        { periodStart: '2026-01-01', periodEnd: '2026-03-31', status: 'submitted', box1: 20000, box4: 8000, box5: 12000 }
      ]);
    });

    it('should return yearly statistics', () => {
      const result = getVatStatistics(testUserId, 2026);
      
      expect(result.success).toBe(true);
      expect(result.data.year).toBe(2026);
      expect(result.data.income.transactionCount).toBe(1);
      expect(result.data.income.totalVat).toBe(20000);
      expect(result.data.expenses.transactionCount).toBe(1);
      expect(result.data.expenses.totalVat).toBe(8000);
      expect(result.data.invoices.count).toBe(1);
      expect(result.data.vatReturns.count).toBe(1);
      expect(result.data.summary.estimatedNetVat).toBe(12000);
    });
  });

  describe('validateAgainstSaved', () => {
    it('should pass when calculated matches saved', () => {
      const saved = { box1: 10000, box2: 0, box3: 10000, box4: 3000, box5: 7000, box6: 50000, box7: 15000, box8: 0, box9: 0 };
      const calculated = { box1: 10000, box2: 0, box3: 10000, box4: 3000, box5: 7000, box6: 50000, box7: 15000, box8: 0, box9: 0 };
      
      const result = validateAgainstSaved(saved, calculated);
      
      expect(result.isValid).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('should report discrepancies', () => {
      const saved = { box1: 10000, box2: 0, box3: 10000, box4: 3000, box5: 7000, box6: 50000, box7: 15000, box8: 0, box9: 0 };
      const calculated = { box1: 12000, box2: 0, box3: 12000, box4: 3000, box5: 9000, box6: 60000, box7: 15000, box8: 0, box9: 0 };
      
      const result = validateAgainstSaved(saved, calculated);
      
      expect(result.isValid).toBe(false);
      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.discrepancies.some(d => d.box === 'box1')).toBe(true);
    });
  });

  describe('ACCOUNTING_SCHEMES constant', () => {
    it('should have STANDARD and CASH schemes', () => {
      expect(ACCOUNTING_SCHEMES.STANDARD).toBe('standard');
      expect(ACCOUNTING_SCHEMES.CASH).toBe('cash');
    });
  });

  describe('End-to-end scenarios', () => {
    it('should handle typical quarterly VAT return calculation', () => {
      // Setup: Small business with various transactions
      createTestTransactions([
        // Sales
        { type: 'income', status: 'cleared', transactionDate: '2026-01-10', amount: 200000, vatAmount: 40000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 150000, vatAmount: 30000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-03-20', amount: 180000, vatAmount: 36000 },
        // Purchases
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-20', amount: 30000, vatAmount: 6000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-03-25', amount: 40000, vatAmount: 8000 }
      ]);
      
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', {
        accountingScheme: 'cash',
        includeBreakdown: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data.boxes.box1).toBe(106000);  // 40000 + 30000 + 36000
      expect(result.data.boxes.box4).toBe(24000);   // 10000 + 6000 + 8000
      expect(result.data.boxes.box5).toBe(82000);   // 106000 - 24000 = £820 to pay
      expect(result.data.boxes.box6).toBe(530000);  // 200000 + 150000 + 180000
      expect(result.data.boxes.box7).toBe(120000);  // 50000 + 30000 + 40000
      expect(result.data.summary.isRefundDue).toBe(false);
    });

    it('should handle refund scenario with high capital expenditure', () => {
      // Setup: Business with low sales but large equipment purchase
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-01', amount: 500000, vatAmount: 100000 } // Large equipment
      ]);
      
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' });
      
      expect(result.success).toBe(true);
      expect(result.data.boxes.box1).toBe(10000);
      expect(result.data.boxes.box4).toBe(100000);
      expect(result.data.boxes.box5).toBe(-90000); // Refund due: £900
      expect(result.data.summary.isRefundDue).toBe(true);
    });

    it('should correctly set EC boxes to 0 post-Brexit', () => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000 }
      ]);
      
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.data.boxes.box2).toBe(0); // VAT on EU acquisitions
      expect(result.data.boxes.box8).toBe(0); // Value of EU supplies
      expect(result.data.boxes.box9).toBe(0); // Value of EU acquisitions
    });

    it('should use invoice data for standard accounting', () => {
      // Only create invoices, not transactions
      createTestInvoices([
        { issueDate: '2026-01-15', subtotal: 100000, vatAmount: 20000 },
        { issueDate: '2026-02-15', subtotal: 80000, vatAmount: 16000 }
      ]);
      
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 25000, vatAmount: 5000 }
      ]);
      
      const result = calculateVatReturn(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' });
      
      expect(result.success).toBe(true);
      expect(result.data.boxes.box1).toBe(36000);  // From invoices (20000 + 16000)
      expect(result.data.boxes.box6).toBe(180000); // From invoices (100000 + 80000)
    });
  });
});
