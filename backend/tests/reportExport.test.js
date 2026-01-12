/**
 * Unit tests for Report Export Services.
 * Tests CSV and PDF generation for financial reports.
 * 
 * @module tests/reportExport.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-report-export-database.sqlite');

let csvGenerator;
let reportPdfGenerator;
let reportTemplates;

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
  
  // Require the modules after database is set up
  csvGenerator = require('../services/csvGenerator');
  reportPdfGenerator = require('../services/reportPdfGenerator');
  reportTemplates = require('../templates/reports');
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

// =====================================
// CSV Generator Tests
// =====================================

describe('CSV Generator Service', () => {
  describe('escapeCSV', () => {
    test('should return empty string for null or undefined', () => {
      expect(csvGenerator.escapeCSV(null)).toBe('');
      expect(csvGenerator.escapeCSV(undefined)).toBe('');
    });

    test('should return value as-is for simple strings', () => {
      expect(csvGenerator.escapeCSV('hello')).toBe('hello');
      expect(csvGenerator.escapeCSV('12345')).toBe('12345');
    });

    test('should wrap value in quotes if contains comma', () => {
      expect(csvGenerator.escapeCSV('hello, world')).toBe('"hello, world"');
    });

    test('should wrap value in quotes and double quotes if contains quote', () => {
      expect(csvGenerator.escapeCSV('say "hello"')).toBe('"say ""hello"""');
    });

    test('should wrap value in quotes if contains newline', () => {
      expect(csvGenerator.escapeCSV('line1\nline2')).toBe('"line1\nline2"');
    });

    test('should handle Turkish special characters without escaping', () => {
      expect(csvGenerator.escapeCSV('İstanbul')).toBe('İstanbul');
      expect(csvGenerator.escapeCSV('Türkçe')).toBe('Türkçe');
      expect(csvGenerator.escapeCSV('şirket')).toBe('şirket');
    });
  });

  describe('formatAmount', () => {
    test('should format pence to pounds with 2 decimal places', () => {
      expect(csvGenerator.formatAmount(12345)).toBe('123.45');
      expect(csvGenerator.formatAmount(100)).toBe('1.00');
      expect(csvGenerator.formatAmount(50)).toBe('0.50');
    });

    test('should return 0.00 for null or undefined', () => {
      expect(csvGenerator.formatAmount(null)).toBe('0.00');
      expect(csvGenerator.formatAmount(undefined)).toBe('0.00');
    });
  });

  describe('formatDate', () => {
    test('should format ISO date to UK format', () => {
      expect(csvGenerator.formatDate('2026-01-15')).toBe('15/01/2026');
      expect(csvGenerator.formatDate('2026-12-25')).toBe('25/12/2026');
    });

    test('should return empty string for invalid dates', () => {
      expect(csvGenerator.formatDate('')).toBe('');
      expect(csvGenerator.formatDate(null)).toBe('');
    });
  });

  describe('createCSVRow', () => {
    test('should create CSV row from array of values', () => {
      expect(csvGenerator.createCSVRow(['a', 'b', 'c'])).toBe('a,b,c');
      expect(csvGenerator.createCSVRow([1, 2, 3])).toBe('1,2,3');
    });

    test('should escape values with special characters', () => {
      expect(csvGenerator.createCSVRow(['hello', 'world, earth', 'test'])).toBe('hello,"world, earth",test');
    });
  });

  describe('getLabels', () => {
    test('should return English labels by default', () => {
      const labels = csvGenerator.getLabels();
      expect(labels.date).toBe('Date');
      expect(labels.income).toBe('Income');
    });

    test('should return Turkish labels when lang is tr', () => {
      const labels = csvGenerator.getLabels('tr');
      expect(labels.date).toBe('Tarih');
      expect(labels.income).toBe('Gelir');
    });
  });

  describe('generateProfitLossCSV', () => {
    const mockProfitLossReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      income: {
        categories: [
          { categoryCode: '4000', categoryName: 'Sales', categoryNameTr: 'Satışlar', amount: 100000, vatAmount: 20000, totalAmount: 120000, transactionCount: 50 }
        ],
        total: { amount: 100000, vatAmount: 20000, totalAmount: 120000, transactionCount: 50 }
      },
      expenses: {
        categories: [
          { categoryCode: '6000', categoryName: 'Operating Expenses', categoryNameTr: 'İşletme Giderleri', amount: 30000, vatAmount: 6000, totalAmount: 36000, transactionCount: 25 }
        ],
        total: { amount: 30000, vatAmount: 6000, totalAmount: 36000, transactionCount: 25 }
      },
      summary: {
        totalRevenue: 100000,
        totalExpenses: 30000,
        netProfit: 70000,
        profitMargin: 70.00,
        transactionCount: 75
      },
      monthlySummary: []
    };

    test('should generate valid CSV with BOM prefix', () => {
      const csv = csvGenerator.generateProfitLossCSV(mockProfitLossReport);
      expect(csv.startsWith(csvGenerator.UTF8_BOM)).toBe(true);
    });

    test('should include report title in English', () => {
      const csv = csvGenerator.generateProfitLossCSV(mockProfitLossReport, { lang: 'en' });
      expect(csv).toContain('Profit & Loss Report');
    });

    test('should include report title in Turkish', () => {
      const csv = csvGenerator.generateProfitLossCSV(mockProfitLossReport, { lang: 'tr' });
      expect(csv).toContain('Kar/Zarar Raporu');
    });

    test('should include business name when provided', () => {
      const csv = csvGenerator.generateProfitLossCSV(mockProfitLossReport, {
        businessDetails: { businessName: 'Test Company Ltd' }
      });
      expect(csv).toContain('Test Company Ltd');
    });

    test('should include income and expense categories', () => {
      const csv = csvGenerator.generateProfitLossCSV(mockProfitLossReport);
      expect(csv).toContain('4000');
      expect(csv).toContain('Sales');
      expect(csv).toContain('6000');
      expect(csv).toContain('Operating Expenses');
    });
  });

  describe('generateVatSummaryCSV', () => {
    const mockVatSummaryReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      outputVat: {
        byRate: [
          { vatRate: 2000, vatRatePercent: 20, netAmount: 100000, vatAmount: 20000, grossAmount: 120000, transactionCount: 50 }
        ],
        totals: { netAmount: 100000, vatAmount: 20000, grossAmount: 120000, transactionCount: 50 }
      },
      inputVat: {
        byRate: [
          { vatRate: 2000, vatRatePercent: 20, netAmount: 30000, vatAmount: 6000, grossAmount: 36000, transactionCount: 25 }
        ],
        totals: { netAmount: 30000, vatAmount: 6000, grossAmount: 36000, transactionCount: 25 }
      },
      netPosition: {
        outputVat: 20000,
        inputVat: 6000,
        netVat: 14000,
        isRefundDue: false
      },
      monthlyBreakdown: []
    };

    test('should generate valid CSV', () => {
      const csv = csvGenerator.generateVatSummaryCSV(mockVatSummaryReport);
      expect(csv.startsWith(csvGenerator.UTF8_BOM)).toBe(true);
    });

    test('should include VAT position data', () => {
      const csv = csvGenerator.generateVatSummaryCSV(mockVatSummaryReport);
      expect(csv).toContain('VAT Summary Report');
      expect(csv).toContain('200.00'); // VAT amount
      expect(csv).toContain('20.00'); // VAT rate
    });
  });

  describe('generateCashFlowCSV', () => {
    const mockCashFlowReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      inflows: {
        categories: [
          { categoryCode: '4000', categoryName: 'Sales', amount: 100000, transactionCount: 50 }
        ],
        total: 100000,
        transactionCount: 50
      },
      outflows: {
        categories: [
          { categoryCode: '6000', categoryName: 'Expenses', amount: 30000, transactionCount: 25 }
        ],
        total: 30000,
        transactionCount: 25
      },
      summary: {
        openingBalance: 50000,
        totalInflows: 100000,
        totalOutflows: 30000,
        netCashChange: 70000,
        closingBalance: 120000
      },
      monthlyCashFlow: []
    };

    test('should generate valid CSV', () => {
      const csv = csvGenerator.generateCashFlowCSV(mockCashFlowReport);
      expect(csv.startsWith(csvGenerator.UTF8_BOM)).toBe(true);
    });

    test('should include cash flow data', () => {
      const csv = csvGenerator.generateCashFlowCSV(mockCashFlowReport);
      expect(csv).toContain('Cash Flow Statement');
      expect(csv).toContain('1000.00'); // Opening balance
    });
  });

  describe('generatePayeSummaryCSV', () => {
    const mockPayeSummaryReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      totals: {
        grossPay: 500000,
        taxableIncome: 450000,
        incomeTax: 100000,
        employeeNI: 50000,
        employerNI: 60000,
        studentLoanDeductions: 5000,
        pensionEmployeeContributions: 25000,
        pensionEmployerContributions: 15000,
        netPay: 320000,
        totalPayrollCost: 575000
      },
      hmrcLiability: {
        paye: 100000,
        employeeNI: 50000,
        employerNI: 60000,
        studentLoans: 5000,
        totalLiability: 215000,
        paymentDeadline: '2026-05-22'
      },
      employeeBreakdown: [],
      monthlySummary: []
    };

    test('should generate valid CSV', () => {
      const csv = csvGenerator.generatePayeSummaryCSV(mockPayeSummaryReport);
      expect(csv.startsWith(csvGenerator.UTF8_BOM)).toBe(true);
    });

    test('should include PAYE data', () => {
      const csv = csvGenerator.generatePayeSummaryCSV(mockPayeSummaryReport);
      expect(csv).toContain('PAYE Summary Report');
      expect(csv).toContain('5000.00'); // Gross pay
      expect(csv).toContain('22/05/2026'); // Payment deadline
    });
  });

  describe('validateReportForCSV', () => {
    test('should return valid for complete profit-loss report', () => {
      const report = {
        period: {},
        income: {},
        expenses: {},
        summary: {}
      };
      const result = csvGenerator.validateReportForCSV(report, 'profit-loss');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return invalid for missing data', () => {
      const result = csvGenerator.validateReportForCSV(null, 'profit-loss');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Report data is required');
    });

    test('should return invalid for unknown report type', () => {
      const result = csvGenerator.validateReportForCSV({}, 'unknown-type');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown report type'))).toBe(true);
    });
  });
});

// =====================================
// Report PDF Generator Tests
// =====================================

describe('Report PDF Generator Service', () => {
  describe('formatMoney', () => {
    test('should format pence to GBP with comma separators', () => {
      expect(reportPdfGenerator.formatMoney(123456)).toBe('£1,234.56');
      expect(reportPdfGenerator.formatMoney(100)).toBe('£1.00');
      expect(reportPdfGenerator.formatMoney(0)).toBe('£0.00');
    });

    test('should return £0.00 for null or undefined', () => {
      expect(reportPdfGenerator.formatMoney(null)).toBe('£0.00');
      expect(reportPdfGenerator.formatMoney(undefined)).toBe('£0.00');
    });
  });

  describe('formatPdfDate', () => {
    test('should format ISO date to UK format', () => {
      expect(reportPdfGenerator.formatPdfDate('2026-01-15')).toBe('15/01/2026');
    });

    test('should return empty string for null', () => {
      expect(reportPdfGenerator.formatPdfDate(null)).toBe('');
    });
  });

  describe('formatPercent', () => {
    test('should format percentage with 2 decimal places', () => {
      expect(reportPdfGenerator.formatPercent(20)).toBe('20.00%');
      expect(reportPdfGenerator.formatPercent(5.5)).toBe('5.50%');
    });

    test('should return 0.00% for null or undefined', () => {
      expect(reportPdfGenerator.formatPercent(null)).toBe('0.00%');
      expect(reportPdfGenerator.formatPercent(undefined)).toBe('0.00%');
    });
  });

  describe('generateProfitLossPdf', () => {
    const mockReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      income: {
        categories: [],
        total: { amount: 100000, vatAmount: 20000, totalAmount: 120000, transactionCount: 0 }
      },
      expenses: {
        categories: [],
        total: { amount: 30000, vatAmount: 6000, totalAmount: 36000, transactionCount: 0 }
      },
      summary: {
        totalRevenue: 100000,
        totalExpenses: 30000,
        netProfit: 70000,
        profitMargin: 70.00,
        transactionCount: 0
      },
      monthlySummary: []
    };

    const mockBusinessDetails = {
      businessName: 'Test Company Ltd',
      businessAddress: '123 Test Street, London',
      vatNumber: 'GB123456789'
    };

    test('should generate valid PDF buffer', async () => {
      const buffer = await reportPdfGenerator.generateProfitLossPdf(mockReport, mockBusinessDetails);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF magic bytes: %PDF-
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('should generate PDF with Turkish language', async () => {
      const buffer = await reportPdfGenerator.generateProfitLossPdf(mockReport, mockBusinessDetails, { lang: 'tr' });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF without business details', async () => {
      const buffer = await reportPdfGenerator.generateProfitLossPdf(mockReport, {});
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generateVatSummaryPdf', () => {
    const mockReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      outputVat: {
        byRate: [],
        totals: { netAmount: 100000, vatAmount: 20000, grossAmount: 120000, transactionCount: 0 }
      },
      inputVat: {
        byRate: [],
        totals: { netAmount: 30000, vatAmount: 6000, grossAmount: 36000, transactionCount: 0 }
      },
      netPosition: {
        outputVat: 20000,
        inputVat: 6000,
        netVat: 14000,
        isRefundDue: false
      },
      monthlyBreakdown: []
    };

    test('should generate valid PDF buffer', async () => {
      const buffer = await reportPdfGenerator.generateVatSummaryPdf(mockReport, {});
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateCashFlowPdf', () => {
    const mockReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      inflows: {
        categories: [],
        total: 100000,
        transactionCount: 0
      },
      outflows: {
        categories: [],
        total: 30000,
        transactionCount: 0
      },
      summary: {
        openingBalance: 50000,
        totalInflows: 100000,
        totalOutflows: 30000,
        netCashChange: 70000,
        closingBalance: 120000
      },
      monthlyCashFlow: []
    };

    test('should generate valid PDF buffer', async () => {
      const buffer = await reportPdfGenerator.generateCashFlowPdf(mockReport, {});
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generatePayeSummaryPdf', () => {
    const mockReport = {
      period: {
        startDate: '2025-04-06',
        endDate: '2026-04-05',
        taxYear: '2025-26'
      },
      totals: {
        grossPay: 500000,
        taxableIncome: 450000,
        incomeTax: 100000,
        employeeNI: 50000,
        employerNI: 60000,
        studentLoanDeductions: 5000,
        pensionEmployeeContributions: 25000,
        pensionEmployerContributions: 15000,
        netPay: 320000,
        totalPayrollCost: 575000
      },
      hmrcLiability: {
        paye: 100000,
        employeeNI: 50000,
        employerNI: 60000,
        studentLoans: 5000,
        totalLiability: 215000,
        paymentDeadline: '2026-05-22'
      },
      employeeBreakdown: [],
      monthlySummary: []
    };

    test('should generate valid PDF buffer', async () => {
      const buffer = await reportPdfGenerator.generatePayeSummaryPdf(mockReport, {});
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('validateReportForPdf', () => {
    test('should return valid for complete report', () => {
      const report = {
        period: {},
        income: {},
        expenses: {},
        summary: {}
      };
      const result = reportPdfGenerator.validateReportForPdf(report, 'profit-loss');
      expect(result.isValid).toBe(true);
    });

    test('should return invalid for null report', () => {
      const result = reportPdfGenerator.validateReportForPdf(null, 'profit-loss');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Report data is required');
    });
  });
});

// =====================================
// Report Templates Tests
// =====================================

describe('Report Templates', () => {
  describe('getLabels', () => {
    test('should return English labels by default', () => {
      const labels = reportTemplates.getLabels();
      expect(labels.profitLoss.title).toBe('Profit & Loss Report');
      expect(labels.common.period).toBe('Report Period');
    });

    test('should return Turkish labels', () => {
      const labels = reportTemplates.getLabels('tr');
      expect(labels.profitLoss.title).toBe('Kar/Zarar Raporu');
      expect(labels.common.period).toBe('Rapor Dönemi');
    });
  });

  describe('getMonthName', () => {
    test('should return English month names', () => {
      expect(reportTemplates.getMonthName(1, 'en')).toBe('January');
      expect(reportTemplates.getMonthName(12, 'en')).toBe('December');
    });

    test('should return Turkish month names', () => {
      expect(reportTemplates.getMonthName(1, 'tr')).toBe('Ocak');
      expect(reportTemplates.getMonthName(12, 'tr')).toBe('Aralık');
    });

    test('should return empty string for invalid month', () => {
      expect(reportTemplates.getMonthName(0)).toBe('');
      expect(reportTemplates.getMonthName(13)).toBe('');
    });
  });

  describe('getVatRateName', () => {
    test('should return standard rate name in English', () => {
      expect(reportTemplates.getVatRateName(2000, 'en')).toBe('Standard Rate (20%)');
    });

    test('should return standard rate name in Turkish', () => {
      expect(reportTemplates.getVatRateName(2000, 'tr')).toBe('Standart Oran (%20)');
    });

    test('should return custom rate for unknown rates', () => {
      expect(reportTemplates.getVatRateName(1500, 'en')).toBe('Custom Rate (15%)');
      expect(reportTemplates.getVatRateName(1500, 'tr')).toBe('Özel Oran (%15)');
    });
  });

  describe('colors', () => {
    test('should have required color definitions', () => {
      expect(reportTemplates.colors.primary).toBeDefined();
      expect(reportTemplates.colors.text).toBeDefined();
      expect(reportTemplates.colors.income).toBeDefined();
      expect(reportTemplates.colors.expense).toBeDefined();
    });
  });

  describe('layout', () => {
    test('should have page size defined', () => {
      expect(reportTemplates.layout.pageSize).toBe('A4');
    });

    test('should have margins defined', () => {
      expect(reportTemplates.layout.margins.top).toBeDefined();
      expect(reportTemplates.layout.margins.bottom).toBeDefined();
      expect(reportTemplates.layout.margins.left).toBeDefined();
      expect(reportTemplates.layout.margins.right).toBeDefined();
    });
  });
});
