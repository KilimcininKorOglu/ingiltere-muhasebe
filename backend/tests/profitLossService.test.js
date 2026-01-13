/**
 * Unit tests for Profit & Loss Service.
 * Tests P&L report calculation and utility functions.
 * 
 * @module tests/profitLossService.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-profit-loss-service-database.sqlite');

let profitLossService;

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
  profitLossService = require('../services/profitLossService');
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
  
  // Insert test categories
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (100, 'TEST-SALES', 'Sales', 'Satışlar', 'income', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (101, 'TEST-SERVICES', 'Services', 'Hizmetler', 'income', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (102, 'TEST-RENT', 'Rent', 'Kira', 'expense', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (103, 'TEST-UTILITIES', 'Utilities', 'Yardımcı Hizmetler', 'expense', 0, 1, 2)
  `);
});

describe('Profit & Loss Service', () => {
  describe('validateDateRange', () => {
    test('should validate correct date range', () => {
      const result = profitLossService.validateDateRange('2025-01-01', '2025-01-31');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid start date format', () => {
      const result = profitLossService.validateDateRange('01-01-2025', '2025-01-31');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('start date');
    });

    test('should reject invalid end date format', () => {
      const result = profitLossService.validateDateRange('2025-01-01', '31-01-2025');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('end date');
    });

    test('should reject when start date is after end date', () => {
      const result = profitLossService.validateDateRange('2025-02-01', '2025-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('before or equal');
    });

    test('should accept when start date equals end date', () => {
      const result = profitLossService.validateDateRange('2025-01-15', '2025-01-15');
      expect(result.isValid).toBe(true);
    });

    test('should reject missing start date', () => {
      const result = profitLossService.validateDateRange(null, '2025-01-31');
      expect(result.isValid).toBe(false);
    });

    test('should reject missing end date', () => {
      const result = profitLossService.validateDateRange('2025-01-01', null);
      expect(result.isValid).toBe(false);
    });
  });

  describe('getTaxYearForDate', () => {
    test('should return correct tax year for date after April 6', () => {
      const taxYear = profitLossService.getTaxYearForDate('2025-05-15');
      expect(taxYear).toBe('2025-26');
    });

    test('should return correct tax year for date before April 6', () => {
      const taxYear = profitLossService.getTaxYearForDate('2025-03-15');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 5 (last day of tax year)', () => {
      const taxYear = profitLossService.getTaxYearForDate('2025-04-05');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 6 (first day of new tax year)', () => {
      const taxYear = profitLossService.getTaxYearForDate('2025-04-06');
      expect(taxYear).toBe('2025-26');
    });

    test('should handle Date objects', () => {
      const taxYear = profitLossService.getTaxYearForDate(new Date('2025-07-15'));
      expect(taxYear).toBe('2025-26');
    });
  });

  describe('getTaxYearDates', () => {
    test('should return correct start and end dates for tax year', () => {
      const dates = profitLossService.getTaxYearDates('2025-26');
      expect(dates.startDate).toBe('2025-04-06');
      expect(dates.endDate).toBe('2026-04-05');
    });

    test('should handle different tax years', () => {
      const dates = profitLossService.getTaxYearDates('2024-25');
      expect(dates.startDate).toBe('2024-04-06');
      expect(dates.endDate).toBe('2025-04-05');
    });
  });

  describe('getMonthName', () => {
    test('should return correct month names', () => {
      expect(profitLossService.getMonthName(1)).toBe('January');
      expect(profitLossService.getMonthName(6)).toBe('June');
      expect(profitLossService.getMonthName(12)).toBe('December');
    });

    test('should return empty string for invalid months', () => {
      expect(profitLossService.getMonthName(0)).toBe('');
      expect(profitLossService.getMonthName(13)).toBe('');
    });
  });

  describe('getPreviousPeriodDates', () => {
    test('should calculate previous period with same duration', () => {
      // Feb 1 to Feb 28 = 27 days duration
      // Previous period ends Feb 1 minus 1 day = Jan 31
      // Previous period starts Jan 31 minus 27 days = Jan 4
      const prev = profitLossService.getPreviousPeriodDates('2025-02-01', '2025-02-28');
      // The function calculates previous period that ends the day before start
      expect(prev.endDate).toBeDefined();
      expect(new Date(prev.endDate)).toBeInstanceOf(Date);
    });

    test('should return valid previous period dates', () => {
      const prev = profitLossService.getPreviousPeriodDates('2025-01-01', '2025-12-31');
      // Should return valid dates
      expect(prev.startDate).toBeDefined();
      expect(prev.endDate).toBeDefined();
      // Previous end date should be before current start date
      expect(new Date(prev.endDate) < new Date('2025-01-01')).toBe(true);
    });
  });

  describe('calculatePercentageChange', () => {
    test('should calculate positive change correctly', () => {
      const change = profitLossService.calculatePercentageChange(120, 100);
      expect(change).toBe(20);
    });

    test('should calculate negative change correctly', () => {
      const change = profitLossService.calculatePercentageChange(80, 100);
      expect(change).toBe(-20);
    });

    test('should return 0 when both values are 0', () => {
      const change = profitLossService.calculatePercentageChange(0, 0);
      expect(change).toBe(0);
    });

    test('should return null when previous is 0 but current is not', () => {
      const change = profitLossService.calculatePercentageChange(100, 0);
      expect(change).toBe(null);
    });

    test('should handle decimal percentage changes', () => {
      const change = profitLossService.calculatePercentageChange(133, 100);
      expect(change).toBe(33);
    });
  });

  describe('generateProfitLossReport', () => {
    const testUserId = 1;

    test('should return empty summary when no transactions exist', () => {
      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');
      
      expect(report.summary.totalRevenue).toBe(0);
      expect(report.summary.totalExpenses).toBe(0);
      expect(report.summary.grossProfit).toBe(0);
      expect(report.summary.netProfit).toBe(0);
      expect(report.summary.profitMargin).toBe(0);
      expect(report.income.categories).toHaveLength(0);
      expect(report.expenses.categories).toHaveLength(0);
      expect(report.monthlySummary).toHaveLength(0);
    });

    test('should calculate totals correctly with transactions', () => {
      // Insert test income transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Sale 1', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 101, 'income', 'cleared', '2025-01-20', 'Service 1', 50000, 10000, 60000)
      `, [testUserId]);

      // Insert test expense transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-01-10', 'Rent', 40000, 0, 40000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 103, 'expense', 'cleared', '2025-01-25', 'Electric', 10000, 500, 10500)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      // Verify income totals
      expect(report.income.total.amount).toBe(150000);
      expect(report.income.total.vatAmount).toBe(30000);
      expect(report.income.total.totalAmount).toBe(180000);
      expect(report.income.total.transactionCount).toBe(2);

      // Verify expense totals
      expect(report.expenses.total.amount).toBe(50000);
      expect(report.expenses.total.vatAmount).toBe(500);
      expect(report.expenses.total.totalAmount).toBe(50500);
      expect(report.expenses.total.transactionCount).toBe(2);

      // Verify summary
      expect(report.summary.totalRevenue).toBe(150000);
      expect(report.summary.totalExpenses).toBe(50000);
      expect(report.summary.grossProfit).toBe(150000);
      expect(report.summary.netProfit).toBe(100000);
      expect(report.summary.transactionCount).toBe(4);
    });

    test('should group income by category correctly', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Sale 1', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-16', 'Sale 2', 80000, 16000, 96000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 101, 'income', 'cleared', '2025-01-20', 'Service 1', 50000, 10000, 60000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.income.categories).toHaveLength(2);
      
      const salesCategory = report.income.categories.find(c => c.categoryCode === 'TEST-SALES');
      expect(salesCategory).toBeDefined();
      expect(salesCategory.amount).toBe(180000);
      expect(salesCategory.transactionCount).toBe(2);
      
      const servicesCategory = report.income.categories.find(c => c.categoryCode === 'TEST-SERVICES');
      expect(servicesCategory).toBeDefined();
      expect(servicesCategory.amount).toBe(50000);
      expect(servicesCategory.transactionCount).toBe(1);
    });

    test('should group expenses by category correctly', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-01-10', 'Rent Jan', 40000, 0, 40000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 103, 'expense', 'cleared', '2025-01-15', 'Electric', 10000, 500, 10500)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 103, 'expense', 'cleared', '2025-01-20', 'Gas', 5000, 250, 5250)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.expenses.categories).toHaveLength(2);
      
      const rentCategory = report.expenses.categories.find(c => c.categoryCode === 'TEST-RENT');
      expect(rentCategory).toBeDefined();
      expect(rentCategory.amount).toBe(40000);
      expect(rentCategory.transactionCount).toBe(1);
      
      const utilitiesCategory = report.expenses.categories.find(c => c.categoryCode === 'TEST-UTILITIES');
      expect(utilitiesCategory).toBeDefined();
      expect(utilitiesCategory.amount).toBe(15000);
      expect(utilitiesCategory.transactionCount).toBe(2);
    });

    test('should calculate profit margin correctly', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Sale', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-01-10', 'Rent', 25000, 0, 25000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      // Net profit = 100000 - 25000 = 75000
      // Profit margin = 75000 / 100000 * 100 = 75%
      expect(report.summary.profitMargin).toBe(75);
    });

    test('should exclude void transactions', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Valid Sale', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'void', '2025-01-16', 'Void Sale', 50000, 10000, 60000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.income.total.amount).toBe(100000);
      expect(report.summary.totalRevenue).toBe(100000);
      expect(report.summary.transactionCount).toBe(1);
    });

    test('should filter by date range correctly', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'In Range', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-02-15', 'Out of Range', 50000, 10000, 60000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.income.total.amount).toBe(100000);
      expect(report.summary.transactionCount).toBe(1);
    });

    test('should filter by user ID correctly', () => {
      const otherUserId = 2;

      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'User 1 Sale', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'User 2 Sale', 200000, 40000, 240000)
      `, [otherUserId]);

      const report1 = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');
      expect(report1.income.total.amount).toBe(100000);

      const report2 = profitLossService.generateProfitLossReport(otherUserId, '2025-01-01', '2025-01-31');
      expect(report2.income.total.amount).toBe(200000);
    });

    test('should include monthly summary', () => {
      // Insert transactions for January
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Jan Sale', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-01-15', 'Jan Expense', 30000, 0, 30000)
      `, [testUserId]);

      // Insert transactions for February
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-02-15', 'Feb Sale', 150000, 30000, 180000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-02-15', 'Feb Expense', 50000, 0, 50000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-02-28');

      expect(report.monthlySummary).toHaveLength(2);
      
      const january = report.monthlySummary.find(m => m.month === '01');
      expect(january).toBeDefined();
      expect(january.monthName).toBe('January');
      expect(january.income.amount).toBe(100000);
      expect(january.expense.amount).toBe(30000);
      expect(january.netProfit).toBe(70000);
      
      const february = report.monthlySummary.find(m => m.month === '02');
      expect(february).toBeDefined();
      expect(february.monthName).toBe('February');
      expect(february.income.amount).toBe(150000);
      expect(february.expense.amount).toBe(50000);
      expect(february.netProfit).toBe(100000);
    });

    test('should include period comparison when requested', () => {
      // Insert current period transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-02-15', 'Feb Sale', 150000, 30000, 180000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-02-15', 'Feb Expense', 50000, 0, 50000)
      `, [testUserId]);

      // Insert previous period transactions
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Jan Sale', 100000, 20000, 120000)
      `, [testUserId]);
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 102, 'expense', 'cleared', '2025-01-15', 'Jan Expense', 30000, 0, 30000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-02-01', '2025-02-28', {
        includeComparison: true
      });

      expect(report.comparison).toBeDefined();
      expect(report.comparison.previous.totalRevenue).toBe(100000);
      expect(report.comparison.previous.totalExpenses).toBe(30000);
      expect(report.comparison.previous.netProfit).toBe(70000);
      
      // Current: 150000 revenue, Previous: 100000 revenue = 50% increase
      expect(report.comparison.changes.revenueChange).toBe(50000);
      expect(report.comparison.changes.revenueChangePercent).toBe(50);
    });

    test('should not include comparison when not requested', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossReport(testUserId, '2025-01-01', '2025-01-31');

      expect(report.comparison).toBeUndefined();
    });
  });

  describe('generateProfitLossForTaxYear', () => {
    const testUserId = 1;

    test('should generate report for full tax year', () => {
      // Insert transaction in tax year 2025-26
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-05-15', 'May Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossForTaxYear(testUserId, '2025-26');

      expect(report.period.startDate).toBe('2025-04-06');
      expect(report.period.endDate).toBe('2026-04-05');
      expect(report.period.taxYear).toBe('2025-26');
      expect(report.income.total.amount).toBe(100000);
    });
  });

  describe('generateProfitLossForMonth', () => {
    const testUserId = 1;

    test('should generate report for specific month', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-01-15', 'Jan Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossForMonth(testUserId, 2025, 1);

      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-01-31');
      expect(report.income.total.amount).toBe(100000);
    });

    test('should handle February correctly (non-leap year)', () => {
      const report = profitLossService.generateProfitLossForMonth(testUserId, 2025, 2);
      expect(report.period.startDate).toBe('2025-02-01');
      expect(report.period.endDate).toBe('2025-02-28');
    });

    test('should handle February correctly (leap year)', () => {
      const report = profitLossService.generateProfitLossForMonth(testUserId, 2024, 2);
      expect(report.period.startDate).toBe('2024-02-01');
      expect(report.period.endDate).toBe('2024-02-29');
    });
  });

  describe('generateProfitLossForQuarter', () => {
    const testUserId = 1;

    test('should generate report for Q1', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 100, 'income', 'cleared', '2025-02-15', 'Q1 Sale', 100000, 20000, 120000)
      `, [testUserId]);

      const report = profitLossService.generateProfitLossForQuarter(testUserId, 2025, 1);

      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-03-31');
      expect(report.income.total.amount).toBe(100000);
    });

    test('should generate report for Q2', () => {
      const report = profitLossService.generateProfitLossForQuarter(testUserId, 2025, 2);
      expect(report.period.startDate).toBe('2025-04-01');
      expect(report.period.endDate).toBe('2025-06-30');
    });

    test('should generate report for Q3', () => {
      const report = profitLossService.generateProfitLossForQuarter(testUserId, 2025, 3);
      expect(report.period.startDate).toBe('2025-07-01');
      expect(report.period.endDate).toBe('2025-09-30');
    });

    test('should generate report for Q4', () => {
      const report = profitLossService.generateProfitLossForQuarter(testUserId, 2025, 4);
      expect(report.period.startDate).toBe('2025-10-01');
      expect(report.period.endDate).toBe('2025-12-31');
    });

    test('should throw error for invalid quarter', () => {
      expect(() => {
        profitLossService.generateProfitLossForQuarter(testUserId, 2025, 5);
      }).toThrow('Invalid quarter');
    });
  });
});
