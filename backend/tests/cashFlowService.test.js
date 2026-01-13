/**
 * Unit tests for Cash Flow Statement Service.
 * Tests Cash Flow report calculation and utility functions.
 * 
 * @module tests/cashFlowService.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-cash-flow-service-database.sqlite');

let cashFlowService;

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
  
  // Require the service after database is set up
  cashFlowService = require('../services/cashFlowService');
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
 * Clean up transactions before each test.
 */
beforeEach(() => {
  execute('DELETE FROM transactions');
  execute('DELETE FROM bank_transactions');
  execute('DELETE FROM bank_accounts');
  execute('DELETE FROM categories WHERE isSystem = 0');
  
  // Insert test users for foreign key constraints
  execute(`
    INSERT OR IGNORE INTO users (id, email, passwordHash, name, createdAt, updatedAt)
    VALUES (1, 'test1@example.com', 'hashedpassword', 'Test User 1', strftime('%s', 'now'), strftime('%s', 'now'))
  `);
  execute(`
    INSERT OR IGNORE INTO users (id, email, passwordHash, name, createdAt, updatedAt)
    VALUES (2, 'test2@example.com', 'hashedpassword', 'Test User 2', strftime('%s', 'now'), strftime('%s', 'now'))
  `);
  
  // Insert test categories for income and expense
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (500, 'TEST-SALES', 'Sales Revenue', 'Satış Geliri', 'income', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (501, 'TEST-SERVICE', 'Service Revenue', 'Hizmet Geliri', 'income', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (502, 'TEST-OTHER-INCOME', 'Other Income', 'Diğer Gelirler', 'income', 0, 1, 3)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (600, 'TEST-RENT', 'Rent Expense', 'Kira Gideri', 'expense', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (601, 'TEST-UTILITIES', 'Utilities Expense', 'Fatura Giderleri', 'expense', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (602, 'TEST-SUPPLIES', 'Supplies Expense', 'Malzeme Giderleri', 'expense', 0, 1, 3)
  `);
});

describe('Cash Flow Statement Service', () => {
  describe('validateDateRange', () => {
    test('should validate correct date format', () => {
      const result = cashFlowService.validateDateRange('2025-01-01', '2025-01-31');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid start date format', () => {
      const result = cashFlowService.validateDateRange('31-01-2025', '2025-01-31');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    test('should reject invalid end date format', () => {
      const result = cashFlowService.validateDateRange('2025-01-01', '31-01-2025');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    test('should reject missing dates', () => {
      const result = cashFlowService.validateDateRange(null, '2025-01-31');
      expect(result.isValid).toBe(false);
    });

    test('should reject when start date is after end date', () => {
      const result = cashFlowService.validateDateRange('2025-02-01', '2025-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('before');
    });
  });

  describe('getTaxYearForDate', () => {
    test('should return correct tax year for date after April 6', () => {
      const taxYear = cashFlowService.getTaxYearForDate('2025-05-15');
      expect(taxYear).toBe('2025-26');
    });

    test('should return correct tax year for date before April 6', () => {
      const taxYear = cashFlowService.getTaxYearForDate('2025-03-15');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 5 (last day of tax year)', () => {
      const taxYear = cashFlowService.getTaxYearForDate('2025-04-05');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 6 (first day of new tax year)', () => {
      const taxYear = cashFlowService.getTaxYearForDate('2025-04-06');
      expect(taxYear).toBe('2025-26');
    });

    test('should handle Date objects', () => {
      const taxYear = cashFlowService.getTaxYearForDate(new Date('2025-07-15'));
      expect(taxYear).toBe('2025-26');
    });
  });

  describe('getTaxYearDates', () => {
    test('should return correct start and end dates for tax year', () => {
      const dates = cashFlowService.getTaxYearDates('2025-26');
      expect(dates.startDate).toBe('2025-04-06');
      expect(dates.endDate).toBe('2026-04-05');
    });

    test('should handle different tax years', () => {
      const dates = cashFlowService.getTaxYearDates('2024-25');
      expect(dates.startDate).toBe('2024-04-06');
      expect(dates.endDate).toBe('2025-04-05');
    });
  });

  describe('getMonthName', () => {
    test('should return correct month names', () => {
      expect(cashFlowService.getMonthName(1)).toBe('January');
      expect(cashFlowService.getMonthName(6)).toBe('June');
      expect(cashFlowService.getMonthName(12)).toBe('December');
    });

    test('should return empty string for invalid months', () => {
      expect(cashFlowService.getMonthName(0)).toBe('');
      expect(cashFlowService.getMonthName(13)).toBe('');
    });
  });

  describe('getPreviousPeriodDates', () => {
    test('should return previous period dates for monthly report', () => {
      const prevDates = cashFlowService.getPreviousPeriodDates('2025-02-01', '2025-02-28');
      expect(prevDates.endDate).toBe('2025-01-31');
      // Duration is ~27 days for February, so prev period starts ~27 days before Jan 31
    });

    test('should return previous year dates for year-long period', () => {
      const prevDates = cashFlowService.getPreviousPeriodDates('2025-01-01', '2025-12-31');
      expect(prevDates.endDate).toBe('2024-12-31');
    });
  });

  describe('calculatePercentageChange', () => {
    test('should calculate positive change correctly', () => {
      const change = cashFlowService.calculatePercentageChange(120, 100);
      expect(change).toBe(20);
    });

    test('should calculate negative change correctly', () => {
      const change = cashFlowService.calculatePercentageChange(80, 100);
      expect(change).toBe(-20);
    });

    test('should return 0 when both values are 0', () => {
      const change = cashFlowService.calculatePercentageChange(0, 0);
      expect(change).toBe(0);
    });

    test('should return null when previous is 0 but current is not', () => {
      const change = cashFlowService.calculatePercentageChange(100, 0);
      expect(change).toBe(null);
    });

    test('should handle decimal percentage changes', () => {
      const change = cashFlowService.calculatePercentageChange(133, 100);
      expect(change).toBe(33);
    });
  });

  describe('generateCashFlowReport', () => {
    const testUserId = 1;

    test('should return empty cash flow report when no transactions exist', () => {
      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');
      
      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-01-31');
      expect(report.period.taxYear).toBeDefined();
      expect(report.openingBalance).toBe(0);
      expect(report.closingBalance).toBe(0);
      expect(report.inflows.total).toBe(0);
      expect(report.inflows.categories).toHaveLength(0);
      expect(report.outflows.total).toBe(0);
      expect(report.outflows.categories).toHaveLength(0);
      expect(report.summary.netCashChange).toBe(0);
      expect(report.summary.isReconciled).toBe(true);
    });

    test('should calculate cash inflows correctly', () => {
      // Add income transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Sales', 100000, 20000, 120000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 501, 'income', 'cleared', '2025-01-20', 'Service Revenue', 50000, 10000, 60000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.inflows.total).toBe(150000);
      expect(report.inflows.transactionCount).toBe(2);
      expect(report.inflows.categories).toHaveLength(2);
      
      const salesCategory = report.inflows.categories.find(c => c.categoryCode === 'TEST-SALES');
      expect(salesCategory).toBeDefined();
      expect(salesCategory.amount).toBe(100000);
      
      const serviceCategory = report.inflows.categories.find(c => c.categoryCode === 'TEST-SERVICE');
      expect(serviceCategory).toBeDefined();
      expect(serviceCategory.amount).toBe(50000);
    });

    test('should calculate cash outflows correctly', () => {
      // Add expense transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 600, 'expense', 'cleared', '2025-01-15', 'Rent', 40000, 0, 40000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 601, 'expense', 'cleared', '2025-01-20', 'Utilities', 10000, 2000, 12000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.outflows.total).toBe(50000);
      expect(report.outflows.transactionCount).toBe(2);
      expect(report.outflows.categories).toHaveLength(2);
      
      const rentCategory = report.outflows.categories.find(c => c.categoryCode === 'TEST-RENT');
      expect(rentCategory).toBeDefined();
      expect(rentCategory.amount).toBe(40000);
      
      const utilitiesCategory = report.outflows.categories.find(c => c.categoryCode === 'TEST-UTILITIES');
      expect(utilitiesCategory).toBeDefined();
      expect(utilitiesCategory.amount).toBe(10000);
    });

    test('should calculate net cash change correctly', () => {
      // Add income
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Sales', 100000, 20000, 120000)
      `, [testUserId]);
      
      // Add expense
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 600, 'expense', 'cleared', '2025-01-20', 'Rent', 30000, 0, 30000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      // Net cash change = Inflows - Outflows = 100000 - 30000 = 70000
      expect(report.summary.netCashChange).toBe(70000);
      expect(report.summary.totalInflows).toBe(100000);
      expect(report.summary.totalOutflows).toBe(30000);
    });

    test('should respect date range boundaries', () => {
      // Add transaction in January (should be included)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'January Sale', 100000, 20000, 120000)
      `, [testUserId]);
      
      // Add transaction in February (should be excluded from January report)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-02-15', 'February Sale', 50000, 10000, 60000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.inflows.total).toBe(100000);
    });

    test('should exclude void transactions', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Valid Sale', 100000, 20000, 120000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'void', '2025-01-16', 'Void Sale', 50000, 10000, 60000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.inflows.total).toBe(100000);
    });

    test('should filter by user ID correctly', () => {
      const otherUserId = 2;

      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'User 1 Sale', 100000, 20000, 120000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'User 2 Sale', 200000, 40000, 240000)
      `, [otherUserId]);

      const report1 = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');
      expect(report1.inflows.total).toBe(100000);

      const report2 = cashFlowService.generateCashFlowReport(otherUserId, '2025-01-01', '2025-01-31');
      expect(report2.inflows.total).toBe(200000);
    });

    test('should verify net change equals closing minus opening', () => {
      // This test verifies the fundamental cash flow equation when bank accounts exist
      // Create a bank account to track actual balances
      execute(`
        INSERT INTO bank_accounts (id, userId, accountName, bankName, accountType, sortCode, accountNumber, currency, openingBalance, currentBalance, isDefault, isActive)
        VALUES (200, ?, 'Test Account', 'Test Bank', 'current', '123456', '12345678', 'GBP', 50000, 50000, 1, 1)
      `, [testUserId]);
      
      // Add pre-period bank transaction (affects opening balance)
      execute(`
        INSERT INTO bank_transactions (bankAccountId, transactionDate, description, transactionType, amount, isReconciled, reconciliationStatus)
        VALUES (200, '2024-12-15', 'December Deposit', 'credit', 50000, 0, 'unmatched')
      `);
      
      // Add period bank transaction
      execute(`
        INSERT INTO bank_transactions (bankAccountId, transactionDate, description, transactionType, amount, isReconciled, reconciliationStatus)
        VALUES (200, '2025-01-15', 'January Deposit', 'credit', 100000, 0, 'unmatched')
      `);
      
      // Add matching income transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2024-12-15', 'December Sale', 50000, 0, 50000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'January Sale', 100000, 0, 100000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      // Verify: Net Change = Closing Balance - Opening Balance
      // Opening: 50000 (opening balance) + 50000 (Dec deposit) = 100000
      // Closing: 100000 + 100000 (Jan deposit) = 200000
      // Net Change from bank = 200000 - 100000 = 100000
      // Net inflows = 100000 (January income transaction)
      expect(report.summary.netCashChange).toBe(100000);
      expect(report.summary.closingBalance - report.summary.openingBalance).toBe(100000);
    });

    test('should include monthly breakdown when requested', () => {
      // Add January transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'January Sale', 100000, 0, 100000)
      `, [testUserId]);
      
      // Add February transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-02-15', 'February Sale', 150000, 0, 150000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-02-28', {
        includeMonthlyBreakdown: true
      });

      expect(report.monthlyCashFlow).toBeDefined();
      expect(report.monthlyCashFlow.length).toBe(2);
      
      const januaryData = report.monthlyCashFlow.find(m => m.month === '01');
      expect(januaryData).toBeDefined();
      expect(januaryData.inflows).toBe(100000);
      expect(januaryData.monthName).toBe('January');
      
      const februaryData = report.monthlyCashFlow.find(m => m.month === '02');
      expect(februaryData).toBeDefined();
      expect(februaryData.inflows).toBe(150000);
      expect(februaryData.monthName).toBe('February');
    });

    test('should include period comparison when requested', () => {
      // Add current period transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Current Period Sale', 150000, 0, 150000)
      `, [testUserId]);
      
      // Add previous period transaction (December 2024)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2024-12-15', 'Previous Period Sale', 100000, 0, 100000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31', {
        includeComparison: true
      });

      expect(report.comparison).toBeDefined();
      expect(report.comparison.previousPeriod).toBeDefined();
      expect(report.comparison.previous.totalInflows).toBe(100000);
      expect(report.comparison.changes.inflowChange).toBe(50000);
      expect(report.comparison.changes.inflowChangePercent).toBe(50);
    });

    test('should not include comparison when not requested', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Sale', 100000, 0, 100000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.comparison).toBeUndefined();
    });
  });

  describe('generateCashFlowForTaxYear', () => {
    const testUserId = 1;

    test('should generate report for full tax year', () => {
      // Insert transaction in tax year 2025-26 (April 6 2025 - April 5 2026)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-05-15', 'May Sale', 100000, 0, 100000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowForTaxYear(testUserId, '2025-26');

      expect(report.period.startDate).toBe('2025-04-06');
      expect(report.period.endDate).toBe('2026-04-05');
      expect(report.period.taxYear).toBe('2025-26');
      expect(report.inflows.total).toBe(100000);
    });
  });

  describe('generateCashFlowForMonth', () => {
    const testUserId = 1;

    test('should generate report for specific month', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'January Sale', 100000, 0, 100000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowForMonth(testUserId, 2025, 1);

      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-01-31');
      expect(report.inflows.total).toBe(100000);
    });

    test('should handle February correctly (non-leap year)', () => {
      const report = cashFlowService.generateCashFlowForMonth(testUserId, 2025, 2);
      expect(report.period.endDate).toBe('2025-02-28');
    });

    test('should handle February correctly (leap year)', () => {
      const report = cashFlowService.generateCashFlowForMonth(testUserId, 2024, 2);
      expect(report.period.endDate).toBe('2024-02-29');
    });

    test('should not include monthly breakdown for single month', () => {
      const report = cashFlowService.generateCashFlowForMonth(testUserId, 2025, 1);
      // Monthly breakdown is disabled for single month reports (includeMonthlyBreakdown: false)
      expect(report.monthlyCashFlow).toBeUndefined();
    });
  });

  describe('generateCashFlowForQuarter', () => {
    const testUserId = 1;

    test('should generate report for Q1', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-02-15', 'Q1 Sale', 100000, 0, 100000)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowForQuarter(testUserId, 2025, 1);

      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-03-31');
      expect(report.inflows.total).toBe(100000);
    });

    test('should generate report for Q2', () => {
      const report = cashFlowService.generateCashFlowForQuarter(testUserId, 2025, 2);
      expect(report.period.startDate).toBe('2025-04-01');
      expect(report.period.endDate).toBe('2025-06-30');
    });

    test('should generate report for Q3', () => {
      const report = cashFlowService.generateCashFlowForQuarter(testUserId, 2025, 3);
      expect(report.period.startDate).toBe('2025-07-01');
      expect(report.period.endDate).toBe('2025-09-30');
    });

    test('should generate report for Q4', () => {
      const report = cashFlowService.generateCashFlowForQuarter(testUserId, 2025, 4);
      expect(report.period.startDate).toBe('2025-10-01');
      expect(report.period.endDate).toBe('2025-12-31');
    });

    test('should throw error for invalid quarter', () => {
      expect(() => {
        cashFlowService.generateCashFlowForQuarter(testUserId, 2025, 5);
      }).toThrow('Invalid quarter');
    });
  });

  describe('Bank Account Movements', () => {
    const testUserId = 1;

    test('should return empty bank movements when no bank accounts exist', () => {
      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31', {
        includeBankMovements: true
      });

      expect(report.bankAccountMovements).toBeDefined();
      expect(report.bankAccountMovements).toHaveLength(0);
    });

    test('should include bank account movements when bank accounts exist', () => {
      // Create a bank account
      execute(`
        INSERT INTO bank_accounts (userId, accountName, bankName, accountType, sortCode, accountNumber, currency, openingBalance, currentBalance, isDefault, isActive)
        VALUES (?, 'Test Account', 'Test Bank', 'current', '123456', '12345678', 'GBP', 100000, 100000, 1, 1)
      `, [testUserId]);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31', {
        includeBankMovements: true
      });

      expect(report.bankAccountMovements).toBeDefined();
      expect(report.bankAccountMovements.length).toBeGreaterThanOrEqual(1);
      expect(report.bankAccountMovements[0].accountName).toBe('Test Account');
      expect(report.bankAccountMovements[0].bankName).toBe('Test Bank');
    });

    test('should calculate bank account movements correctly', () => {
      // Create a bank account with opening balance
      execute(`
        INSERT INTO bank_accounts (id, userId, accountName, bankName, accountType, sortCode, accountNumber, currency, openingBalance, currentBalance, isDefault, isActive)
        VALUES (100, ?, 'Main Account', 'Test Bank', 'current', '123456', '12345678', 'GBP', 100000, 100000, 1, 1)
      `, [testUserId]);

      // Add bank transactions
      execute(`
        INSERT INTO bank_transactions (bankAccountId, transactionDate, description, transactionType, amount, isReconciled, reconciliationStatus)
        VALUES (100, '2025-01-15', 'Deposit', 'credit', 50000, 0, 'unmatched')
      `);
      execute(`
        INSERT INTO bank_transactions (bankAccountId, transactionDate, description, transactionType, amount, isReconciled, reconciliationStatus)
        VALUES (100, '2025-01-20', 'Payment', 'debit', 20000, 0, 'unmatched')
      `);

      const report = cashFlowService.generateCashFlowReport(testUserId, '2025-01-01', '2025-01-31', {
        includeBankMovements: true
      });

      expect(report.bankAccountMovements).toHaveLength(1);
      
      const movement = report.bankAccountMovements[0];
      expect(movement.openingBalance).toBe(100000);
      expect(movement.credits).toBe(50000);
      expect(movement.debits).toBe(20000);
      expect(movement.netChange).toBe(30000);
      expect(movement.closingBalance).toBe(130000);
    });
  });
});
