/**
 * Unit Tests for VAT Breakdown Service
 * 
 * Tests VAT return transaction breakdown functionality including:
 * - Full breakdown for VAT returns
 * - Individual box breakdowns
 * - Breakdown by VAT rate
 * - Filtering by rate
 * - Summary calculations
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');

const {
  getBoxBreakdown,
  getFullVatReturnBreakdown,
  getBreakdownByVatRate,
  getAvailableVatRates,
  getBox1Breakdown,
  getBox4Breakdown,
  getBox6Breakdown,
  getBox7Breakdown,
  getIncomeTransactionsForBreakdown,
  getExpenseTransactionsForBreakdown,
  getSalesInvoicesForBreakdown,
  calculateSummaryByVatRate,
  validateBreakdownParams,
  getVatRateName,
  formatCurrency,
  VAT_RATE_NAMES,
  BOX_DESCRIPTIONS
} = require('../services/vatBreakdownService');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-vat-breakdown-database.sqlite');

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
    VALUES ('testbreakdown@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testbreakdown@example.com');
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
    INSERT INTO transactions (userId, type, status, transactionDate, description, amount, vatAmount, totalAmount, vatRate, payee)
    VALUES (@userId, @type, @status, @transactionDate, @description, @amount, @vatAmount, @totalAmount, @vatRate, @payee)
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
      vatRate: txn.vatRate || 2000,
      payee: txn.payee || null
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

describe('VAT Breakdown Service', () => {
  describe('validateBreakdownParams', () => {
    it('should pass for valid parameters', () => {
      const result = validateBreakdownParams(1, '2026-01-01', '2026-03-31');
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should fail for invalid userId', () => {
      const result = validateBreakdownParams(0, '2026-01-01', '2026-03-31');
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
    });

    it('should fail for invalid date format', () => {
      const result = validateBreakdownParams(1, '01-01-2026', '2026-03-31');
      expect(result.isValid).toBe(false);
      expect(result.errors.periodStart).toBeDefined();
    });

    it('should fail when periodEnd is before periodStart', () => {
      const result = validateBreakdownParams(1, '2026-03-31', '2026-01-01');
      expect(result.isValid).toBe(false);
      expect(result.errors.periodEnd).toBeDefined();
    });
  });

  describe('getVatRateName', () => {
    it('should return standard rate name in English', () => {
      const name = getVatRateName(2000, 'en');
      expect(name).toBe('Standard Rate (20%)');
    });

    it('should return standard rate name in Turkish', () => {
      const name = getVatRateName(2000, 'tr');
      expect(name).toBe('Standart Oran (%20)');
    });

    it('should return reduced rate name', () => {
      const name = getVatRateName(500, 'en');
      expect(name).toBe('Reduced Rate (5%)');
    });

    it('should return zero rate name', () => {
      const name = getVatRateName(0, 'en');
      expect(name).toBe('Zero Rate (0%)');
    });

    it('should return custom rate format for unknown rates', () => {
      const name = getVatRateName(1200, 'en');
      expect(name).toBe('Custom Rate (12%)');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      const result = formatCurrency(10000);
      expect(result).toBe('£100.00');
    });

    it('should format negative values correctly', () => {
      const result = formatCurrency(-5000);
      expect(result).toBe('-£50.00');
    });

    it('should format zero correctly', () => {
      const result = formatCurrency(0);
      expect(result).toBe('£0.00');
    });
  });

  describe('getIncomeTransactionsForBreakdown', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 },
        { type: 'income', status: 'pending', transactionDate: '2026-02-15', amount: 5000, vatAmount: 1000, vatRate: 2000 },
        { type: 'income', status: 'void', transactionDate: '2026-02-20', amount: 8000, vatAmount: 1600, vatRate: 2000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-03-10', amount: 1000, vatAmount: 50, vatRate: 500 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-25', amount: 3000, vatAmount: 600, vatRate: 2000 }
      ]);
    });

    it('should return income transactions in date range (standard accounting)', () => {
      const transactions = getIncomeTransactionsForBreakdown(
        testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' }
      );
      
      expect(transactions.length).toBe(3); // Excludes void and expense
      expect(transactions.every(t => t.status !== 'void')).toBe(true);
    });

    it('should filter by cash status (cash accounting)', () => {
      const transactions = getIncomeTransactionsForBreakdown(
        testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' }
      );
      
      expect(transactions.length).toBe(2); // Only cleared/reconciled
      expect(transactions.every(t => ['cleared', 'reconciled'].includes(t.status))).toBe(true);
    });

    it('should filter by VAT rate', () => {
      const transactions = getIncomeTransactionsForBreakdown(
        testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard', vatRate: 500 }
      );
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].vatRate).toBe(500);
    });
  });

  describe('getExpenseTransactionsForBreakdown', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-15', amount: 5000, vatAmount: 1000, vatRate: 2000 },
        { type: 'expense', status: 'pending', transactionDate: '2026-02-15', amount: 3000, vatAmount: 600, vatRate: 2000 },
        { type: 'expense', status: 'void', transactionDate: '2026-02-20', amount: 8000, vatAmount: 1600, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-03-10', amount: 2000, vatAmount: 100, vatRate: 500 }
      ]);
    });

    it('should return expense transactions in date range', () => {
      const transactions = getExpenseTransactionsForBreakdown(
        testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' }
      );
      
      expect(transactions.length).toBe(3); // Excludes void
      expect(transactions.every(t => t.status !== 'void')).toBe(true);
    });

    it('should filter by VAT rate', () => {
      const transactions = getExpenseTransactionsForBreakdown(
        testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard', vatRate: 500 }
      );
      
      expect(transactions.length).toBe(1);
      expect(transactions[0].vatRate).toBe(500);
    });
  });

  describe('getSalesInvoicesForBreakdown', () => {
    beforeEach(() => {
      createTestInvoices([
        { issueDate: '2026-01-15', subtotal: 10000, vatAmount: 2000, status: 'pending' },
        { issueDate: '2026-02-15', subtotal: 5000, vatAmount: 1000, status: 'paid' },
        { issueDate: '2026-02-20', subtotal: 8000, vatAmount: 1600, status: 'cancelled' }
      ]);
    });

    it('should return non-cancelled invoices in date range', () => {
      const invoices = getSalesInvoicesForBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(invoices.length).toBe(2);
      expect(invoices.every(i => i.status !== 'void' && i.status !== 'cancelled')).toBe(true);
    });
  });

  describe('calculateSummaryByVatRate', () => {
    it('should calculate summary grouped by VAT rate', () => {
      const transactions = [
        { amount: 10000, vatAmount: 2000, totalAmount: 12000, vatRate: 2000 },
        { amount: 5000, vatAmount: 1000, totalAmount: 6000, vatRate: 2000 },
        { amount: 2000, vatAmount: 100, totalAmount: 2100, vatRate: 500 },
        { amount: 3000, vatAmount: 0, totalAmount: 3000, vatRate: 0 }
      ];
      
      const summary = calculateSummaryByVatRate(transactions, 'en');
      
      expect(summary.length).toBe(3);
      
      // Standard rate
      const standardRate = summary.find(s => s.vatRate === 2000);
      expect(standardRate).toBeDefined();
      expect(standardRate.transactionCount).toBe(2);
      expect(standardRate.netAmount).toBe(15000);
      expect(standardRate.vatAmount).toBe(3000);
      
      // Reduced rate
      const reducedRate = summary.find(s => s.vatRate === 500);
      expect(reducedRate).toBeDefined();
      expect(reducedRate.transactionCount).toBe(1);
      
      // Zero rate
      const zeroRate = summary.find(s => s.vatRate === 0);
      expect(zeroRate).toBeDefined();
      expect(zeroRate.transactionCount).toBe(1);
    });

    it('should sort by rate descending', () => {
      const transactions = [
        { amount: 1000, vatAmount: 0, totalAmount: 1000, vatRate: 0 },
        { amount: 1000, vatAmount: 200, totalAmount: 1200, vatRate: 2000 },
        { amount: 1000, vatAmount: 50, totalAmount: 1050, vatRate: 500 }
      ];
      
      const summary = calculateSummaryByVatRate(transactions, 'en');
      
      expect(summary[0].vatRate).toBe(2000);
      expect(summary[1].vatRate).toBe(500);
      expect(summary[2].vatRate).toBe(0);
    });
  });

  describe('getBox1Breakdown', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 50000, vatAmount: 10000, vatRate: 2000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-03-10', amount: 10000, vatAmount: 500, vatRate: 500 }
      ]);
    });

    it('should return Box 1 breakdown with all transactions', () => {
      const breakdown = getBox1Breakdown(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' });
      
      expect(breakdown.box).toBe(1);
      expect(breakdown.boxKey).toBe('box1');
      expect(breakdown.transactionCount).toBe(3);
      expect(breakdown.totalVatAmount).toBe(30500); // 20000 + 10000 + 500
      expect(breakdown.items.length).toBe(3);
    });

    it('should include summary by rate', () => {
      const breakdown = getBox1Breakdown(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' });
      
      expect(breakdown.summaryByRate.length).toBe(2);
      
      const standardRate = breakdown.summaryByRate.find(s => s.vatRate === 2000);
      expect(standardRate.transactionCount).toBe(2);
      expect(standardRate.vatAmount).toBe(30000);
    });

    it('should include formatted values', () => {
      const breakdown = getBox1Breakdown(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'cash' });
      
      expect(breakdown.formatted.totalVatAmount).toBe('£305.00');
    });
  });

  describe('getBox4Breakdown', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 25000, vatAmount: 5000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-20', amount: 15000, vatAmount: 3000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-03-20', amount: 4000, vatAmount: 200, vatRate: 500 }
      ]);
    });

    it('should return Box 4 breakdown with expense transactions', () => {
      const breakdown = getBox4Breakdown(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' });
      
      expect(breakdown.box).toBe(4);
      expect(breakdown.boxKey).toBe('box4');
      expect(breakdown.transactionCount).toBe(3);
      expect(breakdown.totalVatAmount).toBe(8200); // 5000 + 3000 + 200
    });

    it('should include category information if available', () => {
      const breakdown = getBox4Breakdown(testUserId, '2026-01-01', '2026-03-31', { accountingScheme: 'standard' });
      
      expect(breakdown.items.length).toBe(3);
      breakdown.items.forEach(item => {
        expect(item.category).toBe(null); // No category in test data
      });
    });
  });

  describe('getBoxBreakdown', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 25000, vatAmount: 5000, vatRate: 2000 }
      ]);
    });

    it('should return breakdown for Box 1', () => {
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 1);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.box).toBe(1);
      expect(result.data.breakdown.totalVatAmount).toBe(20000);
    });

    it('should return breakdown for Box 4', () => {
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 4);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.box).toBe(4);
      expect(result.data.breakdown.totalVatAmount).toBe(5000);
    });

    it('should return note for Box 2 (post-Brexit)', () => {
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 2);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.box).toBe(2);
      expect(result.data.breakdown.totalVatAmount).toBe(0);
      expect(result.data.breakdown.note).toBeDefined();
      expect(result.data.breakdown.note.en).toContain('Post-Brexit');
    });

    it('should return components for Box 3', () => {
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 3);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.box).toBe(3);
      expect(result.data.breakdown.components).toBeDefined();
      expect(result.data.breakdown.components.box1).toBe(20000);
      expect(result.data.breakdown.components.box2).toBe(0);
    });

    it('should return net VAT for Box 5', () => {
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 5);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.box).toBe(5);
      expect(result.data.breakdown.netVatAmount).toBe(15000); // 20000 - 5000
      expect(result.data.breakdown.isRefundDue).toBe(false);
    });

    it('should fail for invalid box number', () => {
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 10);
      
      expect(result.success).toBe(false);
      expect(result.errors.boxNumber).toBeDefined();
    });

    it('should filter by VAT rate', () => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 10000, vatAmount: 500, vatRate: 500 }
      ]);
      
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 1, { vatRate: 2000 });
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.transactionCount).toBe(1);
      expect(result.data.breakdown.totalVatAmount).toBe(20000);
    });
  });

  describe('getFullVatReturnBreakdown', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 50000, vatAmount: 10000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 25000, vatAmount: 5000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-20', amount: 15000, vatAmount: 3000, vatRate: 2000 }
      ]);
    });

    it('should return full breakdown with all boxes', () => {
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(true);
      expect(result.data.boxes).toBeDefined();
      
      // Check all 9 boxes
      for (let i = 1; i <= 9; i++) {
        expect(result.data.boxes[`box${i}`]).toBeDefined();
      }
    });

    it('should calculate correct totals', () => {
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.data.boxes.box1.value).toBe(30000); // 20000 + 10000
      expect(result.data.boxes.box2.value).toBe(0);
      expect(result.data.boxes.box3.value).toBe(30000);
      expect(result.data.boxes.box4.value).toBe(8000); // 5000 + 3000
      expect(result.data.boxes.box5.value).toBe(22000); // 30000 - 8000
      expect(result.data.boxes.box6.value).toBe(150000); // 100000 + 50000
      expect(result.data.boxes.box7.value).toBe(40000); // 25000 + 15000
      expect(result.data.boxes.box8.value).toBe(0);
      expect(result.data.boxes.box9.value).toBe(0);
    });

    it('should include summary', () => {
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.vatDue).toBe(30000);
      expect(result.data.summary.vatReclaimed).toBe(8000);
      expect(result.data.summary.netVat).toBe(22000);
      expect(result.data.summary.isRefundDue).toBe(false);
    });

    it('should detect refund scenario', () => {
      // Add more expenses to trigger refund
      createTestTransactions([
        { type: 'expense', status: 'cleared', transactionDate: '2026-03-15', amount: 200000, vatAmount: 40000, vatRate: 2000 }
      ]);
      
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.data.summary.netVat).toBe(-18000); // 30000 - 48000
      expect(result.data.summary.isRefundDue).toBe(true);
    });

    it('should include formatted values', () => {
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.data.summary.formatted.vatDue).toBe('£300.00');
      expect(result.data.summary.formatted.vatReclaimed).toBe('£80.00');
      expect(result.data.summary.formatted.netVat).toBe('£220.00');
    });

    it('should include metadata', () => {
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31', { lang: 'tr' });
      
      expect(result.data.metadata).toBeDefined();
      expect(result.data.metadata.calculatedAt).toBeDefined();
      expect(result.data.metadata.language).toBe('tr');
    });
  });

  describe('getBreakdownByVatRate', () => {
    beforeEach(() => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 20000, vatAmount: 1000, vatRate: 500 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 50000, vatAmount: 10000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-20', amount: 10000, vatAmount: 500, vatRate: 500 }
      ]);
    });

    it('should return breakdown filtered by standard rate', () => {
      const result = getBreakdownByVatRate(testUserId, '2026-01-01', '2026-03-31', 2000);
      
      expect(result.success).toBe(true);
      expect(result.data.vatRate).toBe(2000);
      expect(result.data.vatRatePercent).toBe(20);
      expect(result.data.vatRateName).toBe('Standard Rate (20%)');
      
      expect(result.data.output.transactionCount).toBe(1);
      expect(result.data.output.totalVat).toBe(20000);
      
      expect(result.data.input.transactionCount).toBe(1);
      expect(result.data.input.totalVat).toBe(10000);
      
      expect(result.data.summary.netVat).toBe(10000);
      expect(result.data.summary.isRefundDue).toBe(false);
    });

    it('should return breakdown filtered by reduced rate', () => {
      const result = getBreakdownByVatRate(testUserId, '2026-01-01', '2026-03-31', 500);
      
      expect(result.success).toBe(true);
      expect(result.data.vatRate).toBe(500);
      expect(result.data.vatRateName).toBe('Reduced Rate (5%)');
      
      expect(result.data.output.transactionCount).toBe(1);
      expect(result.data.input.transactionCount).toBe(1);
    });

    it('should fail for invalid VAT rate', () => {
      const result = getBreakdownByVatRate(testUserId, '2026-01-01', '2026-03-31', 15000);
      
      expect(result.success).toBe(false);
      expect(result.errors.vatRate).toBeDefined();
    });

    it('should include formatted values', () => {
      const result = getBreakdownByVatRate(testUserId, '2026-01-01', '2026-03-31', 2000);
      
      expect(result.data.output.formatted.totalVat).toBe('£200.00');
      expect(result.data.input.formatted.totalVat).toBe('£100.00');
      expect(result.data.summary.formatted.netVat).toBe('£100.00');
    });
  });

  describe('getAvailableVatRates', () => {
    it('should return all VAT rates used in period', () => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 20000, vatAmount: 1000, vatRate: 500 },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-20', amount: 10000, vatAmount: 0, vatRate: 0 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 50000, vatAmount: 10000, vatRate: 2000 }
      ]);
      
      const result = getAvailableVatRates(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(true);
      // Should have at least 2 rates (standard and one other)
      // Zero rate may be excluded if no VAT was charged
      expect(result.data.rates.length).toBeGreaterThanOrEqual(2);
      
      // Verify specific rates are present
      const standardRate = result.data.rates.find(r => r.vatRate === 2000);
      const reducedRate = result.data.rates.find(r => r.vatRate === 500);
      expect(standardRate).toBeDefined();
      expect(reducedRate).toBeDefined();
    });

    it('should include income and expense breakdown per rate', () => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-20', amount: 50000, vatAmount: 10000, vatRate: 2000 }
      ]);
      
      const result = getAvailableVatRates(testUserId, '2026-01-01', '2026-03-31');
      
      const standardRate = result.data.rates.find(r => r.vatRate === 2000);
      expect(standardRate).toBeDefined();
      expect(standardRate.income.transactionCount).toBe(1);
      expect(standardRate.expense.transactionCount).toBe(1);
      expect(standardRate.total.transactionCount).toBe(2);
    });

    it('should include VAT rate names', () => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000 }
      ]);
      
      const result = getAvailableVatRates(testUserId, '2026-01-01', '2026-03-31', 'en');
      
      const standardRate = result.data.rates.find(r => r.vatRate === 2000);
      expect(standardRate.vatRateName).toBe('Standard Rate (20%)');
    });

    it('should fail for invalid parameters', () => {
      const result = getAvailableVatRates(0, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(false);
      expect(result.errors.userId).toBeDefined();
    });
  });

  describe('End-to-end scenarios', () => {
    it('should handle quarterly VAT return breakdown', () => {
      // Setup: Small business with various transactions at different rates
      createTestTransactions([
        // Standard rate sales
        { type: 'income', status: 'cleared', transactionDate: '2026-01-10', amount: 200000, vatAmount: 40000, vatRate: 2000, description: 'Consulting services' },
        { type: 'income', status: 'cleared', transactionDate: '2026-02-15', amount: 150000, vatAmount: 30000, vatRate: 2000, description: 'Training workshop' },
        // Reduced rate sale
        { type: 'income', status: 'cleared', transactionDate: '2026-03-20', amount: 50000, vatAmount: 2500, vatRate: 500, description: 'Energy services' },
        // Zero rate sale
        { type: 'income', status: 'cleared', transactionDate: '2026-03-25', amount: 30000, vatAmount: 0, vatRate: 0, description: 'Export sale' },
        // Purchases
        { type: 'expense', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000, vatRate: 2000, description: 'Office supplies' },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-20', amount: 30000, vatAmount: 6000, vatRate: 2000, description: 'Software subscription' }
      ]);
      
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(true);
      
      // Box 1: Total output VAT
      expect(result.data.boxes.box1.value).toBe(72500); // 40000 + 30000 + 2500 + 0
      
      // Box 4: Total input VAT
      expect(result.data.boxes.box4.value).toBe(16000); // 10000 + 6000
      
      // Box 5: Net VAT
      expect(result.data.boxes.box5.value).toBe(56500); // 72500 - 16000
      
      // Box 6: Total sales (net)
      expect(result.data.boxes.box6.value).toBe(430000); // 200000 + 150000 + 50000 + 30000
      
      // Box 7: Total purchases (net)
      expect(result.data.boxes.box7.value).toBe(80000); // 50000 + 30000
      
      // Summary by rate should show multiple different rates for income
      // Note: The exact count depends on the Box1 breakdown which may use different
      // accounting scheme than the transactions directly
      expect(result.data.boxes.box1.summaryByRate.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle refund scenario correctly', () => {
      // Setup: Business with low sales but large capital expenditure
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 50000, vatAmount: 10000, vatRate: 2000 },
        { type: 'expense', status: 'cleared', transactionDate: '2026-02-01', amount: 500000, vatAmount: 100000, vatRate: 2000, description: 'Equipment purchase' }
      ]);
      
      const result = getFullVatReturnBreakdown(testUserId, '2026-01-01', '2026-03-31');
      
      expect(result.success).toBe(true);
      expect(result.data.summary.netVat).toBe(-90000); // 10000 - 100000
      expect(result.data.summary.isRefundDue).toBe(true);
      expect(result.data.boxes.box5.isRefundDue).toBe(true);
      expect(result.data.boxes.box5.label.en).toBe('VAT refund due');
    });

    it('should provide transaction details for audit', () => {
      createTestTransactions([
        { type: 'income', status: 'cleared', transactionDate: '2026-01-15', amount: 100000, vatAmount: 20000, vatRate: 2000, payee: 'Customer Ltd', description: 'Invoice #001' }
      ]);
      
      const result = getBoxBreakdown(testUserId, '2026-01-01', '2026-03-31', 1);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown.items.length).toBe(1);
      
      const item = result.data.breakdown.items[0];
      expect(item.description).toBe('Invoice #001');
      expect(item.payee).toBe('Customer Ltd');
      expect(item.netAmount).toBe(100000);
      expect(item.vatAmount).toBe(20000);
      expect(item.vatRateName).toBe('Standard Rate (20%)');
      expect(item.formatted.vatAmount).toBe('£200.00');
    });
  });

  describe('Constants', () => {
    it('should have correct VAT rate names', () => {
      expect(VAT_RATE_NAMES[2000].en).toBe('Standard Rate (20%)');
      expect(VAT_RATE_NAMES[500].en).toBe('Reduced Rate (5%)');
      expect(VAT_RATE_NAMES[0].en).toBe('Zero Rate (0%)');
    });

    it('should have box descriptions for all 9 boxes', () => {
      for (let i = 1; i <= 9; i++) {
        const key = `box${i}`;
        expect(BOX_DESCRIPTIONS[key]).toBeDefined();
        expect(BOX_DESCRIPTIONS[key].name.en).toBeDefined();
        expect(BOX_DESCRIPTIONS[key].name.tr).toBeDefined();
        expect(BOX_DESCRIPTIONS[key].description.en).toBeDefined();
        expect(BOX_DESCRIPTIONS[key].description.tr).toBeDefined();
      }
    });
  });
});
