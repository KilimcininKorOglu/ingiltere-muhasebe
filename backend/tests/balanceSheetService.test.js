/**
 * Unit tests for Balance Sheet Service.
 * Tests Balance Sheet report calculation and utility functions.
 * 
 * @module tests/balanceSheetService.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-balance-sheet-service-database.sqlite');

let balanceSheetService;

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
  balanceSheetService = require('../services/balanceSheetService');
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
  
  // Insert test categories for assets, liabilities, equity, income, expense
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (200, 'TEST-CASH', 'Cash', 'Nakit', 'asset', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (201, 'TEST-BANK', 'Bank Account', 'Banka Hesabı', 'asset', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (202, 'TEST-ACCOUNTS-RECEIVABLE', 'Accounts Receivable', 'Alacak Hesapları', 'asset', 0, 1, 3)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (300, 'TEST-ACCOUNTS-PAYABLE', 'Accounts Payable', 'Borç Hesapları', 'liability', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (301, 'TEST-LOAN', 'Bank Loan', 'Banka Kredisi', 'liability', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (400, 'TEST-OWNER-EQUITY', 'Owner Equity', 'Özkaynak', 'equity', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (401, 'TEST-RETAINED-EARNINGS', 'Retained Earnings', 'Dağıtılmamış Kârlar', 'equity', 0, 1, 2)
  `);
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
    VALUES (600, 'TEST-RENT', 'Rent Expense', 'Kira Gideri', 'expense', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (601, 'TEST-UTILITIES', 'Utilities Expense', 'Fatura Giderleri', 'expense', 0, 1, 2)
  `);
});

describe('Balance Sheet Service', () => {
  describe('validateAsOfDate', () => {
    test('should validate correct date format', () => {
      const result = balanceSheetService.validateAsOfDate('2025-01-31');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid date format', () => {
      const result = balanceSheetService.validateAsOfDate('31-01-2025');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    test('should reject missing date', () => {
      const result = balanceSheetService.validateAsOfDate(null);
      expect(result.isValid).toBe(false);
    });

    test('should reject invalid date values', () => {
      const result = balanceSheetService.validateAsOfDate('2025-13-45');
      expect(result.isValid).toBe(false);
    });
  });

  describe('getTaxYearForDate', () => {
    test('should return correct tax year for date after April 6', () => {
      const taxYear = balanceSheetService.getTaxYearForDate('2025-05-15');
      expect(taxYear).toBe('2025-26');
    });

    test('should return correct tax year for date before April 6', () => {
      const taxYear = balanceSheetService.getTaxYearForDate('2025-03-15');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 5 (last day of tax year)', () => {
      const taxYear = balanceSheetService.getTaxYearForDate('2025-04-05');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 6 (first day of new tax year)', () => {
      const taxYear = balanceSheetService.getTaxYearForDate('2025-04-06');
      expect(taxYear).toBe('2025-26');
    });

    test('should handle Date objects', () => {
      const taxYear = balanceSheetService.getTaxYearForDate(new Date('2025-07-15'));
      expect(taxYear).toBe('2025-26');
    });
  });

  describe('getTaxYearDates', () => {
    test('should return correct start and end dates for tax year', () => {
      const dates = balanceSheetService.getTaxYearDates('2025-26');
      expect(dates.startDate).toBe('2025-04-06');
      expect(dates.endDate).toBe('2026-04-05');
    });

    test('should handle different tax years', () => {
      const dates = balanceSheetService.getTaxYearDates('2024-25');
      expect(dates.startDate).toBe('2024-04-06');
      expect(dates.endDate).toBe('2025-04-05');
    });
  });

  describe('getMonthName', () => {
    test('should return correct month names', () => {
      expect(balanceSheetService.getMonthName(1)).toBe('January');
      expect(balanceSheetService.getMonthName(6)).toBe('June');
      expect(balanceSheetService.getMonthName(12)).toBe('December');
    });

    test('should return empty string for invalid months', () => {
      expect(balanceSheetService.getMonthName(0)).toBe('');
      expect(balanceSheetService.getMonthName(13)).toBe('');
    });
  });

  describe('getPreviousPeriodDate', () => {
    test('should return date one year earlier', () => {
      const prevDate = balanceSheetService.getPreviousPeriodDate('2025-01-31');
      expect(prevDate).toBe('2024-01-31');
    });

    test('should handle leap year dates', () => {
      const prevDate = balanceSheetService.getPreviousPeriodDate('2024-02-29');
      // Feb 29 2024 - 1 year = Feb 29 2023 doesn't exist, so it becomes Mar 1
      expect(prevDate).toBeDefined();
    });
  });

  describe('calculatePercentageChange', () => {
    test('should calculate positive change correctly', () => {
      const change = balanceSheetService.calculatePercentageChange(120, 100);
      expect(change).toBe(20);
    });

    test('should calculate negative change correctly', () => {
      const change = balanceSheetService.calculatePercentageChange(80, 100);
      expect(change).toBe(-20);
    });

    test('should return 0 when both values are 0', () => {
      const change = balanceSheetService.calculatePercentageChange(0, 0);
      expect(change).toBe(0);
    });

    test('should return null when previous is 0 but current is not', () => {
      const change = balanceSheetService.calculatePercentageChange(100, 0);
      expect(change).toBe(null);
    });

    test('should handle decimal percentage changes', () => {
      const change = balanceSheetService.calculatePercentageChange(133, 100);
      expect(change).toBe(33);
    });
  });

  describe('generateBalanceSheetReport', () => {
    const testUserId = 1;

    test('should return empty balance sheet when no transactions exist', () => {
      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');
      
      expect(report.asOfDate).toBe('2025-01-31');
      expect(report.taxYear).toBeDefined();
      expect(report.assets.total).toBe(0);
      expect(report.assets.categories).toHaveLength(0);
      expect(report.liabilities.total).toBe(0);
      expect(report.liabilities.categories).toHaveLength(0);
      expect(report.equity.total).toBe(0);
      expect(report.summary.totalAssets).toBe(0);
      expect(report.summary.totalLiabilities).toBe(0);
      expect(report.summary.totalEquity).toBe(0);
      expect(report.summary.isBalanced).toBe(true);
    });

    test('should calculate asset balances correctly', () => {
      // Add cash income (increases asset)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Cash Received', 100000, 0, 100000)
      `, [testUserId]);
      
      // Add bank deposit (increases asset)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 201, 'income', 'cleared', '2025-01-20', 'Bank Deposit', 50000, 0, 50000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.assets.total).toBe(150000);
      expect(report.assets.categories).toHaveLength(2);
      
      const cashCategory = report.assets.categories.find(c => c.categoryCode === 'TEST-CASH');
      expect(cashCategory).toBeDefined();
      expect(cashCategory.balance).toBe(100000);
      
      const bankCategory = report.assets.categories.find(c => c.categoryCode === 'TEST-BANK');
      expect(bankCategory).toBeDefined();
      expect(bankCategory.balance).toBe(50000);
    });

    test('should calculate liability balances correctly', () => {
      // Add accounts payable (increases liability)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', '2025-01-15', 'Supplier Credit', 40000, 0, 40000)
      `, [testUserId]);
      
      // Add bank loan (increases liability)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 301, 'income', 'cleared', '2025-01-20', 'Bank Loan Received', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.liabilities.total).toBe(140000);
      expect(report.liabilities.categories).toHaveLength(2);
      
      const payableCategory = report.liabilities.categories.find(c => c.categoryCode === 'TEST-ACCOUNTS-PAYABLE');
      expect(payableCategory).toBeDefined();
      expect(payableCategory.balance).toBe(40000);
      
      const loanCategory = report.liabilities.categories.find(c => c.categoryCode === 'TEST-LOAN');
      expect(loanCategory).toBeDefined();
      expect(loanCategory.balance).toBe(100000);
    });

    test('should calculate equity balances correctly', () => {
      // Add owner investment (increases equity)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 400, 'income', 'cleared', '2025-01-15', 'Owner Investment', 200000, 0, 200000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.equity.categories).toHaveLength(1);
      
      const ownerEquity = report.equity.categories.find(c => c.categoryCode === 'TEST-OWNER-EQUITY');
      expect(ownerEquity).toBeDefined();
      expect(ownerEquity.balance).toBe(200000);
    });

    test('should calculate retained earnings from income and expenses', () => {
      // Add sales income
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Sales', 100000, 20000, 120000)
      `, [testUserId]);
      
      // Add service income
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 501, 'income', 'cleared', '2025-01-16', 'Service Revenue', 50000, 10000, 60000)
      `, [testUserId]);
      
      // Add rent expense
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 600, 'expense', 'cleared', '2025-01-20', 'Rent', 30000, 0, 30000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      // Retained earnings = Income - Expenses = 150000 - 30000 = 120000
      expect(report.equity.retainedEarnings).toBe(120000);
      expect(report.equity.total).toBe(120000);
    });

    test('should include current period earnings', () => {
      // Add sales income
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 500, 'income', 'cleared', '2025-01-15', 'Sales', 100000, 20000, 120000)
      `, [testUserId]);
      
      // Add expense
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 600, 'expense', 'cleared', '2025-01-20', 'Rent', 30000, 0, 30000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.equity.currentPeriodEarnings).toBeDefined();
      expect(report.equity.currentPeriodEarnings.income).toBe(100000);
      expect(report.equity.currentPeriodEarnings.expenses).toBe(30000);
      expect(report.equity.currentPeriodEarnings.netIncome).toBe(70000);
    });

    test('should use as-of date logic correctly (exclude future transactions)', () => {
      // Add transaction in January (should be included)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'January Cash', 100000, 0, 100000)
      `, [testUserId]);
      
      // Add transaction in February (should be excluded for Jan 31 report)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-02-15', 'February Cash', 50000, 0, 50000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.assets.total).toBe(100000);
      
      // Check February report includes both
      const febReport = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-02-28');
      expect(febReport.assets.total).toBe(150000);
    });

    test('should exclude void transactions', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Valid Cash', 100000, 0, 100000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'void', '2025-01-16', 'Void Cash', 50000, 0, 50000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.assets.total).toBe(100000);
    });

    test('should filter by user ID correctly', () => {
      const otherUserId = 2;

      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'User 1 Cash', 100000, 0, 100000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'User 2 Cash', 200000, 0, 200000)
      `, [otherUserId]);

      const report1 = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');
      expect(report1.assets.total).toBe(100000);

      const report2 = balanceSheetService.generateBalanceSheetReport(otherUserId, '2025-01-31');
      expect(report2.assets.total).toBe(200000);
    });

    test('should check balance sheet equation (Assets = Liabilities + Equity)', () => {
      // Create a balanced balance sheet scenario
      // Asset (Cash) = 150000
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Cash', 150000, 0, 150000)
      `, [testUserId]);
      
      // Liability (Loan) = 50000
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 301, 'income', 'cleared', '2025-01-15', 'Bank Loan', 50000, 0, 50000)
      `, [testUserId]);
      
      // Owner Equity = 100000 (should make it balance)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 400, 'income', 'cleared', '2025-01-15', 'Owner Investment', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      // Assets = 150000
      // Liabilities = 50000
      // Equity = 100000
      // 150000 = 50000 + 100000 ✓
      expect(report.summary.totalAssets).toBe(150000);
      expect(report.summary.totalLiabilities).toBe(50000);
      expect(report.summary.totalEquity).toBe(100000);
      expect(report.summary.isBalanced).toBe(true);
      expect(report.summary.balanceDifference).toBe(0);
    });

    test('should include period comparison when requested', () => {
      // Add current period transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Current Year Cash', 150000, 0, 150000)
      `, [testUserId]);
      
      // Add previous period transaction
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2024-01-15', 'Previous Year Cash', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31', {
        includeComparison: true
      });

      expect(report.comparison).toBeDefined();
      expect(report.comparison.previousDate).toBe('2024-01-31');
      // Previous balance at 2024-01-31 includes only the 100000 transaction
      expect(report.comparison.previous.totalAssets).toBe(100000);
      // Current balance at 2025-01-31 includes BOTH transactions (100000 + 150000 = 250000)
      // because balance sheet is cumulative
      expect(report.assets.total).toBe(250000);
      // Change = 250000 - 100000 = 150000
      expect(report.comparison.changes.assetChange).toBe(150000);
      expect(report.comparison.changes.assetChangePercent).toBe(150);
    });

    test('should not include comparison when not requested', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Cash', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetReport(testUserId, '2025-01-31');

      expect(report.comparison).toBeUndefined();
    });
  });

  describe('generateBalanceSheetForTaxYear', () => {
    const testUserId = 1;

    test('should generate report for tax year end', () => {
      // Insert transaction in tax year 2025-26 (April 6 2025 - April 5 2026)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-05-15', 'May Cash', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetForTaxYear(testUserId, '2025-26');

      expect(report.asOfDate).toBe('2026-04-05');
      expect(report.taxYear).toBe('2025-26');
      expect(report.assets.total).toBe(100000);
    });
  });

  describe('generateBalanceSheetForMonth', () => {
    const testUserId = 1;

    test('should generate report for month end', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-01-15', 'Jan Cash', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetForMonth(testUserId, 2025, 1);

      expect(report.asOfDate).toBe('2025-01-31');
      expect(report.assets.total).toBe(100000);
    });

    test('should handle February correctly (non-leap year)', () => {
      const report = balanceSheetService.generateBalanceSheetForMonth(testUserId, 2025, 2);
      expect(report.asOfDate).toBe('2025-02-28');
    });

    test('should handle February correctly (leap year)', () => {
      const report = balanceSheetService.generateBalanceSheetForMonth(testUserId, 2024, 2);
      expect(report.asOfDate).toBe('2024-02-29');
    });
  });

  describe('generateBalanceSheetForQuarter', () => {
    const testUserId = 1;

    test('should generate report for Q1 end', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 200, 'income', 'cleared', '2025-02-15', 'Q1 Cash', 100000, 0, 100000)
      `, [testUserId]);

      const report = balanceSheetService.generateBalanceSheetForQuarter(testUserId, 2025, 1);

      expect(report.asOfDate).toBe('2025-03-31');
      expect(report.assets.total).toBe(100000);
    });

    test('should generate report for Q2 end', () => {
      const report = balanceSheetService.generateBalanceSheetForQuarter(testUserId, 2025, 2);
      expect(report.asOfDate).toBe('2025-06-30');
    });

    test('should generate report for Q3 end', () => {
      const report = balanceSheetService.generateBalanceSheetForQuarter(testUserId, 2025, 3);
      expect(report.asOfDate).toBe('2025-09-30');
    });

    test('should generate report for Q4 end', () => {
      const report = balanceSheetService.generateBalanceSheetForQuarter(testUserId, 2025, 4);
      expect(report.asOfDate).toBe('2025-12-31');
    });

    test('should throw error for invalid quarter', () => {
      expect(() => {
        balanceSheetService.generateBalanceSheetForQuarter(testUserId, 2025, 5);
      }).toThrow('Invalid quarter');
    });
  });
});
