/**
 * Unit tests for VAT Summary Service
 * 
 * Tests the VAT summary report generation functionality including
 * VAT breakdown by rate, output/input VAT separation, net position calculation,
 * and transaction count accuracy.
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Import the service
const vatSummaryService = require('../services/vatSummaryService');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-vat-summary-database.sqlite');

// Test data
let TEST_USER_ID;
const PERIOD_START = '2025-01-01';
const PERIOD_END = '2025-03-31';

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
    VALUES ('testvatsummary@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testvatsummary@example.com');
  TEST_USER_ID = user.id;
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
  executeMany('DELETE FROM transactions;');
});

/**
 * Helper function to create test transactions
 */
function createTestTransactions(transactions) {
  const db = openDatabase();
  const stmt = db.prepare(`
    INSERT INTO transactions (userId, type, status, transactionDate, description, amount, vatAmount, totalAmount, vatRate)
    VALUES (@userId, @type, @status, @transactionDate, @description, @amount, @vatAmount, @totalAmount, @vatRate)
  `);
  
  for (const txn of transactions) {
    stmt.run({
      userId: txn.userId || TEST_USER_ID,
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
  
describe('VAT Summary Service', () => {
  describe('validateDateRange', () => {
    it('should return valid for correct date range', () => {
      const result = vatSummaryService.validateDateRange('2025-01-01', '2025-03-31');
      expect(result.isValid).toBe(true);
    });
    
    it('should return invalid for missing start date', () => {
      const result = vatSummaryService.validateDateRange(null, '2025-03-31');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('start date');
    });
    
    it('should return invalid for missing end date', () => {
      const result = vatSummaryService.validateDateRange('2025-01-01', null);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('end date');
    });
    
    it('should return invalid when start date is after end date', () => {
      const result = vatSummaryService.validateDateRange('2025-03-31', '2025-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('before or equal');
    });
    
    it('should return invalid for invalid date format', () => {
      const result = vatSummaryService.validateDateRange('01-01-2025', '2025-03-31');
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('getVatRateName', () => {
    it('should return correct name for standard rate in English', () => {
      const name = vatSummaryService.getVatRateName(2000, 'en');
      expect(name).toContain('Standard');
      expect(name).toContain('20%');
    });
    
    it('should return correct name for standard rate in Turkish', () => {
      const name = vatSummaryService.getVatRateName(2000, 'tr');
      expect(name).toContain('Standart');
      expect(name).toContain('%20');
    });
    
    it('should return correct name for reduced rate', () => {
      const name = vatSummaryService.getVatRateName(500, 'en');
      expect(name).toContain('Reduced');
      expect(name).toContain('5%');
    });
    
    it('should return correct name for zero rate', () => {
      const name = vatSummaryService.getVatRateName(0, 'en');
      expect(name).toContain('Zero');
      expect(name).toContain('0%');
    });
    
    it('should return custom rate format for unknown rates', () => {
      const name = vatSummaryService.getVatRateName(1500, 'en');
      expect(name).toContain('Custom');
      expect(name).toContain('15%');
    });
  });
  
  describe('getTaxYearForDate', () => {
    it('should return correct tax year for date after April 5', () => {
      const taxYear = vatSummaryService.getTaxYearForDate('2025-04-10');
      expect(taxYear).toBe('2025-26');
    });
    
    it('should return previous tax year for date before April 6', () => {
      const taxYear = vatSummaryService.getTaxYearForDate('2025-04-01');
      expect(taxYear).toBe('2024-25');
    });
    
    it('should return previous tax year for April 5', () => {
      const taxYear = vatSummaryService.getTaxYearForDate('2025-04-05');
      expect(taxYear).toBe('2024-25');
    });
    
    it('should return current tax year for April 6', () => {
      const taxYear = vatSummaryService.getTaxYearForDate('2025-04-06');
      expect(taxYear).toBe('2025-26');
    });
  });
  
  describe('getTaxYearDates', () => {
    it('should return correct date range for tax year', () => {
      const { startDate, endDate } = vatSummaryService.getTaxYearDates('2025-26');
      expect(startDate).toBe('2025-04-06');
      expect(endDate).toBe('2026-04-05');
    });
  });
  
  describe('getMonthName', () => {
    it('should return correct month names', () => {
      expect(vatSummaryService.getMonthName(1)).toBe('January');
      expect(vatSummaryService.getMonthName(6)).toBe('June');
      expect(vatSummaryService.getMonthName(12)).toBe('December');
    });
    
    it('should return empty string for invalid month', () => {
      expect(vatSummaryService.getMonthName(0)).toBe('');
      expect(vatSummaryService.getMonthName(13)).toBe('');
    });
  });
  
  describe('getOutputVatByRate', () => {
    it('should return output VAT grouped by rate', () => {
      // Create test transactions with different VAT rates
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 },
        { type: 'income', transactionDate: '2025-01-20', amount: 5000, vatAmount: 1000, vatRate: 2000 },
        { type: 'income', transactionDate: '2025-02-15', amount: 10000, vatAmount: 500, vatRate: 500 }
      ]);
      
      const result = vatSummaryService.getOutputVatByRate(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(result.length).toBe(2); // Two different VAT rates
      
      // Find standard rate entry (2000 = 20%)
      const standardRate = result.find(r => r.vatRate === 2000);
      expect(standardRate).toBeDefined();
      expect(standardRate.transactionCount).toBe(2);
      expect(standardRate.netAmount).toBe(15000); // 10000 + 5000
      expect(standardRate.vatAmount).toBe(3000); // 2000 + 1000
      
      // Find reduced rate entry (500 = 5%)
      const reducedRate = result.find(r => r.vatRate === 500);
      expect(reducedRate).toBeDefined();
      expect(reducedRate.transactionCount).toBe(1);
      expect(reducedRate.vatAmount).toBe(500);
    });
    
    it('should not include voided transactions', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000, status: 'cleared' },
        { type: 'income', transactionDate: '2025-01-20', amount: 5000, vatAmount: 1000, vatRate: 2000, status: 'void' }
      ]);
      
      const result = vatSummaryService.getOutputVatByRate(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(result.length).toBe(1);
      expect(result[0].transactionCount).toBe(1);
      expect(result[0].vatAmount).toBe(2000);
    });
  });
  
  describe('getInputVatByRate', () => {
    it('should return input VAT grouped by rate', () => {
      createTestTransactions([
        { type: 'expense', transactionDate: '2025-01-15', amount: 8000, vatAmount: 1600, vatRate: 2000 },
        { type: 'expense', transactionDate: '2025-02-15', amount: 4000, vatAmount: 200, vatRate: 500 }
      ]);
      
      const result = vatSummaryService.getInputVatByRate(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(result.length).toBe(2);
      
      const standardRate = result.find(r => r.vatRate === 2000);
      expect(standardRate.vatAmount).toBe(1600);
      
      const reducedRate = result.find(r => r.vatRate === 500);
      expect(reducedRate.vatAmount).toBe(200);
    });
  });
  
  describe('getVatTotals', () => {
    it('should return correct totals for output and input VAT', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 },
        { type: 'income', transactionDate: '2025-01-20', amount: 5000, vatAmount: 1000, vatRate: 2000 },
        { type: 'expense', transactionDate: '2025-01-25', amount: 8000, vatAmount: 1600, vatRate: 2000 }
      ]);
      
      const result = vatSummaryService.getVatTotals(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(result.output.netAmount).toBe(15000);
      expect(result.output.vatAmount).toBe(3000);
      expect(result.output.transactionCount).toBe(2);
      
      expect(result.input.netAmount).toBe(8000);
      expect(result.input.vatAmount).toBe(1600);
      expect(result.input.transactionCount).toBe(1);
    });
  });
  
  describe('getMonthlyVatSummary', () => {
    it('should return monthly breakdown of VAT', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 },
        { type: 'expense', transactionDate: '2025-01-20', amount: 5000, vatAmount: 1000, vatRate: 2000 },
        { type: 'income', transactionDate: '2025-02-15', amount: 8000, vatAmount: 1600, vatRate: 2000 }
      ]);
      
      const result = vatSummaryService.getMonthlyVatSummary(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(result.length).toBe(2); // January and February
      
      const january = result.find(m => m.month === 1);
      expect(january.monthName).toBe('January');
      expect(january.outputVat).toBe(2000);
      expect(january.inputVat).toBe(1000);
      expect(january.netVat).toBe(1000); // 2000 - 1000
      expect(january.isRefundDue).toBe(false);
      
      const february = result.find(m => m.month === 2);
      expect(february.outputVat).toBe(1600);
      expect(february.inputVat).toBe(0);
      expect(february.netVat).toBe(1600);
    });
  });
  
  describe('generateVatSummaryReport', () => {
    it('should generate a complete VAT summary report', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 },
        { type: 'income', transactionDate: '2025-01-20', amount: 5000, vatAmount: 250, vatRate: 500 },
        { type: 'expense', transactionDate: '2025-01-25', amount: 8000, vatAmount: 1600, vatRate: 2000 },
        { type: 'expense', transactionDate: '2025-02-10', amount: 2000, vatAmount: 100, vatRate: 500 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryReport(
        TEST_USER_ID, 
        PERIOD_START, 
        PERIOD_END,
        { includeMonthlyBreakdown: true }
      );
      
      // Check period
      expect(report.period.startDate).toBe(PERIOD_START);
      expect(report.period.endDate).toBe(PERIOD_END);
      expect(report.period.taxYear).toBe('2024-25'); // Q1 2025 is in 2024-25 tax year
      
      // Check output VAT by rate
      expect(report.outputVat.byRate.length).toBe(2);
      expect(report.outputVat.byRate.some(r => r.vatRate === 2000)).toBe(true);
      expect(report.outputVat.byRate.some(r => r.vatRate === 500)).toBe(true);
      
      // Check output VAT totals
      expect(report.outputVat.totals.vatAmount).toBe(2250); // 2000 + 250
      expect(report.outputVat.totals.transactionCount).toBe(2);
      
      // Check input VAT totals
      expect(report.inputVat.totals.vatAmount).toBe(1700); // 1600 + 100
      expect(report.inputVat.totals.transactionCount).toBe(2);
      
      // Check net position
      expect(report.netPosition.outputVat).toBe(2250);
      expect(report.netPosition.inputVat).toBe(1700);
      expect(report.netPosition.netVat).toBe(550); // 2250 - 1700
      expect(report.netPosition.isRefundDue).toBe(false);
      
      // Check transaction counts
      expect(report.transactionCounts.output).toBe(2);
      expect(report.transactionCounts.input).toBe(2);
      expect(report.transactionCounts.total).toBe(4);
      
      // Check monthly breakdown
      expect(report.monthlyBreakdown).toBeDefined();
      expect(report.monthlyBreakdown.length).toBe(2);
    });
    
    it('should correctly identify when a refund is due', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 5000, vatAmount: 1000, vatRate: 2000 },
        { type: 'expense', transactionDate: '2025-01-25', amount: 10000, vatAmount: 2000, vatRate: 2000 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryReport(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(report.netPosition.outputVat).toBe(1000);
      expect(report.netPosition.inputVat).toBe(2000);
      expect(report.netPosition.netVat).toBe(-1000);
      expect(report.netPosition.isRefundDue).toBe(true);
      expect(report.netPosition.description.en).toContain('refund');
    });
    
    it('should include category breakdown when requested', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryReport(
        TEST_USER_ID, 
        PERIOD_START, 
        PERIOD_END,
        { includeCategoryBreakdown: true }
      );
      
      expect(report.categoryBreakdown).toBeDefined();
      expect(report.categoryBreakdown.output).toBeDefined();
      expect(report.categoryBreakdown.input).toBeDefined();
    });
    
    it('should include rate names in output', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryReport(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(report.outputVat.byRate[0].rateName).toBeDefined();
      expect(report.outputVat.byRate[0].rateName.en).toContain('Standard');
      expect(report.outputVat.byRate[0].rateName.tr).toContain('Standart');
    });
  });
  
  describe('generateVatSummaryForTaxYear', () => {
    it('should generate report for a full tax year', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-05-15', amount: 10000, vatAmount: 2000, vatRate: 2000 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryForTaxYear(TEST_USER_ID, '2025-26');
      
      expect(report.period.startDate).toBe('2025-04-06');
      expect(report.period.endDate).toBe('2026-04-05');
      expect(report.period.taxYear).toBe('2025-26');
    });
  });
  
  describe('generateVatSummaryForMonth', () => {
    it('should generate report for a specific month', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryForMonth(TEST_USER_ID, 2025, 1);
      
      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-01-31');
      expect(report.outputVat.totals.vatAmount).toBe(2000);
    });
    
    it('should handle February correctly (leap year)', () => {
      const report = vatSummaryService.generateVatSummaryForMonth(TEST_USER_ID, 2024, 2);
      expect(report.period.endDate).toBe('2024-02-29'); // 2024 is a leap year
    });
    
    it('should handle February correctly (non-leap year)', () => {
      const report = vatSummaryService.generateVatSummaryForMonth(TEST_USER_ID, 2025, 2);
      expect(report.period.endDate).toBe('2025-02-28');
    });
  });
  
  describe('generateVatSummaryForQuarter', () => {
    it('should generate report for Q1', () => {
      const report = vatSummaryService.generateVatSummaryForQuarter(TEST_USER_ID, 2025, 1);
      
      expect(report.period.startDate).toBe('2025-01-01');
      expect(report.period.endDate).toBe('2025-03-31');
    });
    
    it('should generate report for Q2', () => {
      const report = vatSummaryService.generateVatSummaryForQuarter(TEST_USER_ID, 2025, 2);
      
      expect(report.period.startDate).toBe('2025-04-01');
      expect(report.period.endDate).toBe('2025-06-30');
    });
    
    it('should generate report for Q3', () => {
      const report = vatSummaryService.generateVatSummaryForQuarter(TEST_USER_ID, 2025, 3);
      
      expect(report.period.startDate).toBe('2025-07-01');
      expect(report.period.endDate).toBe('2025-09-30');
    });
    
    it('should generate report for Q4', () => {
      const report = vatSummaryService.generateVatSummaryForQuarter(TEST_USER_ID, 2025, 4);
      
      expect(report.period.startDate).toBe('2025-10-01');
      expect(report.period.endDate).toBe('2025-12-31');
    });
    
    it('should throw error for invalid quarter', () => {
      expect(() => {
        vatSummaryService.generateVatSummaryForQuarter(TEST_USER_ID, 2025, 5);
      }).toThrow('Invalid quarter');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle period with no transactions', () => {
      const report = vatSummaryService.generateVatSummaryReport(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(report.outputVat.totals.vatAmount).toBe(0);
      expect(report.outputVat.totals.transactionCount).toBe(0);
      expect(report.inputVat.totals.vatAmount).toBe(0);
      expect(report.inputVat.totals.transactionCount).toBe(0);
      expect(report.netPosition.netVat).toBe(0);
      expect(report.netPosition.isRefundDue).toBe(false);
    });
    
    it('should handle transactions with zero VAT', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 0, vatRate: 0 }
      ]);
      
      const report = vatSummaryService.generateVatSummaryReport(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      // The report should have at least one entry for output VAT
      expect(report.outputVat.totals.transactionCount).toBe(1);
      expect(report.outputVat.totals.netAmount).toBe(10000);
      expect(report.outputVat.totals.vatAmount).toBe(0);
    });
    
    it('should only include transactions within the date range', () => {
      createTestTransactions([
        { type: 'income', transactionDate: '2024-12-31', amount: 5000, vatAmount: 1000, vatRate: 2000 }, // Before range
        { type: 'income', transactionDate: '2025-01-15', amount: 10000, vatAmount: 2000, vatRate: 2000 }, // Within range
        { type: 'income', transactionDate: '2025-04-01', amount: 8000, vatAmount: 1600, vatRate: 2000 } // After range
      ]);
      
      const report = vatSummaryService.generateVatSummaryReport(TEST_USER_ID, PERIOD_START, PERIOD_END);
      
      expect(report.outputVat.totals.vatAmount).toBe(2000);
      expect(report.outputVat.totals.transactionCount).toBe(1);
    });
  });
});
