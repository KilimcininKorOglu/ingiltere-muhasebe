/**
 * Unit tests for PAYE Summary Service.
 * Tests PAYE summary calculation and utility functions.
 * 
 * @module tests/payeSummaryService.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-paye-summary-service-database.sqlite');

let payeSummaryService;

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
  payeSummaryService = require('../services/payeSummaryService');
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
 * Clean up payroll entries before each test.
 */
beforeEach(() => {
  execute('DELETE FROM payroll_entries');
  execute('DELETE FROM employees');
  
  // Insert test users for foreign key constraints
  execute(`
    INSERT OR IGNORE INTO users (id, email, passwordHash, name, createdAt, updatedAt)
    VALUES (1, 'test1@example.com', 'hashedpassword', 'Test User 1', strftime('%s', 'now'), strftime('%s', 'now'))
  `);
  execute(`
    INSERT OR IGNORE INTO users (id, email, passwordHash, name, createdAt, updatedAt)
    VALUES (2, 'test2@example.com', 'hashedpassword', 'Test User 2', strftime('%s', 'now'), strftime('%s', 'now'))
  `);
});

describe('PAYE Summary Service', () => {
  describe('calculatePaymentDeadline', () => {
    test('should calculate electronic payment deadline correctly', () => {
      // For January 2025, deadline should be 22nd February 2025
      const deadline = payeSummaryService.calculatePaymentDeadline(2025, 1, true);
      expect(deadline).toBe('2025-02-22');
    });

    test('should calculate postal payment deadline correctly', () => {
      // For January 2025, deadline should be 19th February 2025
      const deadline = payeSummaryService.calculatePaymentDeadline(2025, 1, false);
      expect(deadline).toBe('2025-02-19');
    });

    test('should handle year boundary correctly', () => {
      // For December 2025, deadline should be in January 2026
      const deadline = payeSummaryService.calculatePaymentDeadline(2025, 12, true);
      expect(deadline).toBe('2026-01-22');
    });

    test('should handle months with fewer days', () => {
      // For January (Feb has 28/29 days in most years)
      const deadline = payeSummaryService.calculatePaymentDeadline(2025, 1, true);
      expect(deadline).toBe('2025-02-22');
    });
  });

  describe('getTaxYearForDate', () => {
    test('should return correct tax year for date after April 6', () => {
      const taxYear = payeSummaryService.getTaxYearForDate('2025-05-15');
      expect(taxYear).toBe('2025-26');
    });

    test('should return correct tax year for date before April 6', () => {
      const taxYear = payeSummaryService.getTaxYearForDate('2025-03-15');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 5 (last day of tax year)', () => {
      const taxYear = payeSummaryService.getTaxYearForDate('2025-04-05');
      expect(taxYear).toBe('2024-25');
    });

    test('should return correct tax year for April 6 (first day of new tax year)', () => {
      const taxYear = payeSummaryService.getTaxYearForDate('2025-04-06');
      expect(taxYear).toBe('2025-26');
    });

    test('should handle Date objects', () => {
      const taxYear = payeSummaryService.getTaxYearForDate(new Date('2025-07-15'));
      expect(taxYear).toBe('2025-26');
    });
  });

  describe('getTaxYearDates', () => {
    test('should return correct start and end dates for tax year', () => {
      const dates = payeSummaryService.getTaxYearDates('2025-26');
      expect(dates.startDate).toBe('2025-04-06');
      expect(dates.endDate).toBe('2026-04-05');
    });

    test('should handle different tax years', () => {
      const dates = payeSummaryService.getTaxYearDates('2024-25');
      expect(dates.startDate).toBe('2024-04-06');
      expect(dates.endDate).toBe('2025-04-05');
    });
  });

  describe('getMonthName', () => {
    test('should return correct month names', () => {
      expect(payeSummaryService.getMonthName(1)).toBe('January');
      expect(payeSummaryService.getMonthName(6)).toBe('June');
      expect(payeSummaryService.getMonthName(12)).toBe('December');
    });

    test('should return empty string for invalid months', () => {
      expect(payeSummaryService.getMonthName(0)).toBe('');
      expect(payeSummaryService.getMonthName(13)).toBe('');
    });
  });

  describe('validateDateRange', () => {
    test('should validate correct date range', () => {
      const result = payeSummaryService.validateDateRange('2025-01-01', '2025-01-31');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid start date format', () => {
      const result = payeSummaryService.validateDateRange('01-01-2025', '2025-01-31');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('start date');
    });

    test('should reject invalid end date format', () => {
      const result = payeSummaryService.validateDateRange('2025-01-01', '31-01-2025');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('end date');
    });

    test('should reject when start date is after end date', () => {
      const result = payeSummaryService.validateDateRange('2025-02-01', '2025-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('before or equal');
    });

    test('should accept when start date equals end date', () => {
      const result = payeSummaryService.validateDateRange('2025-01-15', '2025-01-15');
      expect(result.isValid).toBe(true);
    });

    test('should reject missing start date', () => {
      const result = payeSummaryService.validateDateRange(null, '2025-01-31');
      expect(result.isValid).toBe(false);
    });

    test('should reject missing end date', () => {
      const result = payeSummaryService.validateDateRange('2025-01-01', null);
      expect(result.isValid).toBe(false);
    });
  });

  describe('generatePayeSummary', () => {
    const testUserId = 1;

    beforeEach(() => {
      // Insert test employees
      execute(`
        INSERT INTO employees (id, userId, employeeNumber, firstName, lastName, startDate, status, taxCode)
        VALUES (1, ?, 'EMP-001', 'John', 'Doe', '2024-01-01', 'active', '1257L')
      `, [testUserId]);
      
      execute(`
        INSERT INTO employees (id, userId, employeeNumber, firstName, lastName, startDate, status, taxCode)
        VALUES (2, ?, 'EMP-002', 'Jane', 'Smith', '2024-01-01', 'active', '1257L')
      `, [testUserId]);
    });

    test('should return empty summary when no payroll entries exist', () => {
      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-01-31');
      
      expect(summary.totals.grossPay).toBe(0);
      expect(summary.totals.incomeTax).toBe(0);
      expect(summary.totals.employeeNI).toBe(0);
      expect(summary.totals.employerNI).toBe(0);
      expect(summary.hmrcLiability.totalLiability).toBe(0);
      expect(summary.employeeBreakdown).toHaveLength(0);
      expect(summary.monthlySummary).toHaveLength(0);
      expect(summary.entriesCount).toBe(0);
    });

    test('should calculate totals correctly with payroll entries', () => {
      // Insert test payroll entries
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, taxableIncome, incomeTax, employeeNI,
          employerNI, studentLoanDeduction, pensionEmployeeContribution,
          pensionEmployerContribution, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 195000, 39000, 20000,
          30000, 5000, 15000, 9000, 226000, '1257L'
        )
      `, [testUserId]);

      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, taxableIncome, incomeTax, employeeNI,
          employerNI, studentLoanDeduction, pensionEmployeeContribution,
          pensionEmployerContribution, netPay, taxCode
        ) VALUES (
          2, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 250000, 145000, 29000, 16000,
          24000, 0, 12500, 7500, 192500, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-01-31');

      // Verify totals
      expect(summary.totals.grossPay).toBe(550000);
      expect(summary.totals.taxableIncome).toBe(340000);
      expect(summary.totals.incomeTax).toBe(68000);
      expect(summary.totals.employeeNI).toBe(36000);
      expect(summary.totals.employerNI).toBe(54000);
      expect(summary.totals.totalNI).toBe(90000);
      expect(summary.totals.studentLoanDeductions).toBe(5000);
      expect(summary.totals.pensionEmployeeContributions).toBe(27500);
      expect(summary.totals.pensionEmployerContributions).toBe(16500);
      expect(summary.totals.netPay).toBe(418500);
      
      // Total payroll cost = gross + employer NI + employer pension
      expect(summary.totals.totalPayrollCost).toBe(550000 + 54000 + 16500);
    });

    test('should calculate HMRC liability correctly', () => {
      // Insert test payroll entry
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI,
          studentLoanDeduction, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 39000, 20000, 30000,
          5000, 226000, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-01-31');

      // HMRC Liability = PAYE + Employee NI + Employer NI + Student Loans
      expect(summary.hmrcLiability.paye).toBe(39000);
      expect(summary.hmrcLiability.employeeNI).toBe(20000);
      expect(summary.hmrcLiability.employerNI).toBe(30000);
      expect(summary.hmrcLiability.studentLoans).toBe(5000);
      expect(summary.hmrcLiability.totalLiability).toBe(94000);
      
      // Payment deadline should be 22nd of next month
      expect(summary.hmrcLiability.paymentDeadline).toBe('2025-02-22');
    });

    test('should include employee breakdown', () => {
      // Insert payroll entries for multiple employees
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 39000, 20000, 30000, 241000, '1257L'
        )
      `, [testUserId]);

      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          2, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 250000, 29000, 16000, 24000, 205000, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-01-31');

      expect(summary.employeeBreakdown).toHaveLength(2);
      
      const johnDoe = summary.employeeBreakdown.find(e => e.firstName === 'John');
      expect(johnDoe).toBeDefined();
      expect(johnDoe.grossPay).toBe(300000);
      expect(johnDoe.entriesCount).toBe(1);
      
      const janeSmith = summary.employeeBreakdown.find(e => e.firstName === 'Jane');
      expect(janeSmith).toBeDefined();
      expect(janeSmith.grossPay).toBe(250000);
    });

    test('should include monthly summary', () => {
      // Insert payroll entries for multiple months
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, studentLoanDeduction, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 39000, 20000, 30000, 5000, 236000, '1257L'
        )
      `, [testUserId]);

      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, studentLoanDeduction, netPay, taxCode
        ) VALUES (
          1, ?, '2025-02-01', '2025-02-28', '2025-02-28',
          'paid', 320000, 43000, 22000, 32000, 5200, 249800, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-02-28');

      expect(summary.monthlySummary).toHaveLength(2);
      
      const january = summary.monthlySummary.find(m => m.month === '01');
      expect(january).toBeDefined();
      expect(january.monthName).toBe('January');
      expect(january.grossPay).toBe(300000);
      expect(january.totalLiability).toBe(39000 + 20000 + 30000 + 5000);
      expect(january.paymentDeadline).toBe('2025-02-22');
      
      const february = summary.monthlySummary.find(m => m.month === '02');
      expect(february).toBeDefined();
      expect(february.monthName).toBe('February');
      expect(february.grossPay).toBe(320000);
    });

    test('should exclude cancelled payroll entries', () => {
      // Insert paid entry
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 39000, 20000, 30000, 241000, '1257L'
        )
      `, [testUserId]);

      // Insert cancelled entry (should be excluded)
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-15',
          'cancelled', 300000, 39000, 20000, 30000, 241000, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-01-31');

      // Should only include the paid entry
      expect(summary.entriesCount).toBe(1);
      expect(summary.totals.grossPay).toBe(300000);
    });

    test('should filter by user ID correctly', () => {
      const otherUserId = 2;

      // Insert entry for test user
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 39000, 20000, 30000, 241000, '1257L'
        )
      `, [testUserId]);

      // Insert entry for different user
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 500000, 80000, 40000, 60000, 380000, '1257L'
        )
      `, [otherUserId]);

      // Query for test user should only return their data
      const summary = payeSummaryService.generatePayeSummary(testUserId, '2025-01-01', '2025-01-31');
      expect(summary.entriesCount).toBe(1);
      expect(summary.totals.grossPay).toBe(300000);

      // Query for other user should return their data
      const otherSummary = payeSummaryService.generatePayeSummary(otherUserId, '2025-01-01', '2025-01-31');
      expect(otherSummary.entriesCount).toBe(1);
      expect(otherSummary.totals.grossPay).toBe(500000);
    });
  });

  describe('generatePayeSummaryForTaxYear', () => {
    const testUserId = 1;

    beforeEach(() => {
      execute(`
        INSERT INTO employees (id, userId, employeeNumber, firstName, lastName, startDate, status, taxCode)
        VALUES (1, ?, 'EMP-001', 'John', 'Doe', '2024-01-01', 'active', '1257L')
      `, [testUserId]);
    });

    test('should generate summary for full tax year', () => {
      // Insert entry in tax year 2025-26
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-05-01', '2025-05-31', '2025-05-31',
          'paid', 300000, 39000, 20000, 30000, 241000, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummaryForTaxYear(testUserId, '2025-26');

      expect(summary.period.startDate).toBe('2025-04-06');
      expect(summary.period.endDate).toBe('2026-04-05');
      expect(summary.period.taxYear).toBe('2025-26');
      expect(summary.entriesCount).toBe(1);
    });
  });

  describe('generatePayeSummaryForMonth', () => {
    const testUserId = 1;

    beforeEach(() => {
      execute(`
        INSERT INTO employees (id, userId, employeeNumber, firstName, lastName, startDate, status, taxCode)
        VALUES (1, ?, 'EMP-001', 'John', 'Doe', '2024-01-01', 'active', '1257L')
      `, [testUserId]);
    });

    test('should generate summary for specific month', () => {
      // Insert entry in January 2025
      execute(`
        INSERT INTO payroll_entries (
          employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
          status, grossPay, incomeTax, employeeNI, employerNI, netPay, taxCode
        ) VALUES (
          1, ?, '2025-01-01', '2025-01-31', '2025-01-31',
          'paid', 300000, 39000, 20000, 30000, 241000, '1257L'
        )
      `, [testUserId]);

      const summary = payeSummaryService.generatePayeSummaryForMonth(testUserId, 2025, 1);

      expect(summary.period.startDate).toBe('2025-01-01');
      expect(summary.period.endDate).toBe('2025-01-31');
      expect(summary.entriesCount).toBe(1);
    });

    test('should handle February correctly (non-leap year)', () => {
      const summary = payeSummaryService.generatePayeSummaryForMonth(testUserId, 2025, 2);
      expect(summary.period.startDate).toBe('2025-02-01');
      expect(summary.period.endDate).toBe('2025-02-28');
    });

    test('should handle February correctly (leap year)', () => {
      const summary = payeSummaryService.generatePayeSummaryForMonth(testUserId, 2024, 2);
      expect(summary.period.startDate).toBe('2024-02-01');
      expect(summary.period.endDate).toBe('2024-02-29');
    });
  });
});
