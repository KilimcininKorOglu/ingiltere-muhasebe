/**
 * Unit tests for Document Localization.
 * Tests bilingual (English/Turkish) support for PDF document generation.
 * 
 * @module tests/documentLocalization.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-document-localization-database.sqlite');

let pdfGenerator;
let reportPdfGenerator;
let invoiceTemplate;
let vatReturnTemplate;
let profitLossTemplate;
let balanceSheetTemplate;
let reportsTemplate;
let enDocuments;
let trDocuments;

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
  pdfGenerator = require('../services/pdfGenerator');
  reportPdfGenerator = require('../services/reportPdfGenerator');
  invoiceTemplate = require('../templates/invoice');
  vatReturnTemplate = require('../templates/vatReturn');
  profitLossTemplate = require('../templates/reports/profitLoss');
  balanceSheetTemplate = require('../templates/reports/balanceSheet');
  reportsTemplate = require('../templates/reports');
  enDocuments = require('../locales/en/documents.json');
  trDocuments = require('../locales/tr/documents.json');
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

describe('Document Localization - Locale Files', () => {
  describe('English Document Locale (en/documents.json)', () => {
    test('should contain invoice labels', () => {
      expect(enDocuments.invoice).toBeDefined();
      expect(enDocuments.invoice.title).toBe('INVOICE');
      expect(enDocuments.invoice.invoiceNumber).toBe('Invoice Number');
      expect(enDocuments.invoice.vatNumber).toBe('VAT Number');
    });

    test('should contain VAT return labels', () => {
      expect(enDocuments.vatReturn).toBeDefined();
      expect(enDocuments.vatReturn.title).toBe('VAT RETURN');
      expect(enDocuments.vatReturn.box1Label).toBe('Box 1');
      expect(enDocuments.vatReturn.netVatPayable).toBe('Net VAT Payable');
    });

    test('should contain profit & loss labels', () => {
      expect(enDocuments.profitLoss).toBeDefined();
      expect(enDocuments.profitLoss.title).toBe('Profit & Loss Report');
      expect(enDocuments.profitLoss.income).toBe('Income');
      expect(enDocuments.profitLoss.expenses).toBe('Expenses');
    });

    test('should contain balance sheet labels', () => {
      expect(enDocuments.balanceSheet).toBeDefined();
      expect(enDocuments.balanceSheet.title).toBe('Balance Sheet');
      expect(enDocuments.balanceSheet.totalAssets).toBe('Total Assets');
      expect(enDocuments.balanceSheet.totalEquity).toBe('Total Equity');
    });

    test('should contain common labels', () => {
      expect(enDocuments.common).toBeDefined();
      expect(enDocuments.common.total).toBe('Total');
      expect(enDocuments.common.date).toBe('Date');
      expect(enDocuments.common.months).toHaveLength(12);
    });

    test('should contain currency format settings', () => {
      expect(enDocuments.currencyFormats).toBeDefined();
      expect(enDocuments.currencyFormats.GBP.symbol).toBe('£');
      expect(enDocuments.currencyFormats.EUR.symbol).toBe('€');
    });
  });

  describe('Turkish Document Locale (tr/documents.json)', () => {
    test('should contain invoice labels in Turkish', () => {
      expect(trDocuments.invoice).toBeDefined();
      expect(trDocuments.invoice.title).toBe('FATURA');
      expect(trDocuments.invoice.invoiceNumber).toBe('Fatura Numarası');
      expect(trDocuments.invoice.vatNumber).toBe('KDV Numarası');
    });

    test('should contain VAT return labels in Turkish', () => {
      expect(trDocuments.vatReturn).toBeDefined();
      expect(trDocuments.vatReturn.title).toBe('KDV BEYANNAMESI');
      expect(trDocuments.vatReturn.box1Label).toBe('Kutu 1');
      expect(trDocuments.vatReturn.netVatPayable).toBe('Ödenecek Net KDV');
    });

    test('should contain profit & loss labels in Turkish', () => {
      expect(trDocuments.profitLoss).toBeDefined();
      expect(trDocuments.profitLoss.title).toBe('Kar/Zarar Raporu');
      expect(trDocuments.profitLoss.income).toBe('Gelir');
      expect(trDocuments.profitLoss.expenses).toBe('Giderler');
    });

    test('should contain balance sheet labels in Turkish', () => {
      expect(trDocuments.balanceSheet).toBeDefined();
      expect(trDocuments.balanceSheet.title).toBe('Bilanço');
      expect(trDocuments.balanceSheet.totalAssets).toBe('Toplam Varlıklar');
      expect(trDocuments.balanceSheet.totalEquity).toBe('Toplam Öz Sermaye');
    });

    test('should contain common labels in Turkish', () => {
      expect(trDocuments.common).toBeDefined();
      expect(trDocuments.common.total).toBe('Toplam');
      expect(trDocuments.common.date).toBe('Tarih');
      expect(trDocuments.common.months).toHaveLength(12);
      expect(trDocuments.common.months[0]).toBe('Ocak');
    });
  });
});

describe('Document Localization - Invoice Template', () => {
  test('should return English labels by default', () => {
    const labels = invoiceTemplate.getLabels();
    expect(labels.title).toBe('INVOICE');
    expect(labels.billTo).toBe('Bill To');
  });

  test('should return English labels when en specified', () => {
    const labels = invoiceTemplate.getLabels('en');
    expect(labels.title).toBe('INVOICE');
    expect(labels.vatBreakdown).toBe('VAT Breakdown');
  });

  test('should return Turkish labels when tr specified', () => {
    const labels = invoiceTemplate.getLabels('tr');
    expect(labels.title).toBe('FATURA');
    expect(labels.vatBreakdown).toBe('KDV Dökümü');
    expect(labels.billTo).toBe('Fatura Adresi');
  });

  test('should fallback to English for unknown language', () => {
    const labels = invoiceTemplate.getLabels('de');
    expect(labels.title).toBe('INVOICE');
  });

  test('should have status labels in both languages', () => {
    const enLabels = invoiceTemplate.getLabels('en');
    const trLabels = invoiceTemplate.getLabels('tr');

    expect(enLabels.statuses.paid).toBe('PAID');
    expect(trLabels.statuses.paid).toBe('ÖDENDİ');
    expect(enLabels.statuses.overdue).toBe('OVERDUE');
    expect(trLabels.statuses.overdue).toBe('GECİKMİŞ');
  });
});

describe('Document Localization - VAT Return Template', () => {
  test('should return all nine box labels in English', () => {
    const labels = vatReturnTemplate.getLabels('en');
    expect(labels.box1Label).toBe('Box 1');
    expect(labels.box5Label).toBe('Box 5');
    expect(labels.box9Label).toBe('Box 9');
  });

  test('should return all nine box labels in Turkish', () => {
    const labels = vatReturnTemplate.getLabels('tr');
    expect(labels.box1Label).toBe('Kutu 1');
    expect(labels.box5Label).toBe('Kutu 5');
    expect(labels.box9Label).toBe('Kutu 9');
  });

  test('should have status labels in both languages', () => {
    const enLabels = vatReturnTemplate.getLabels('en');
    const trLabels = vatReturnTemplate.getLabels('tr');

    expect(enLabels.statuses.submitted).toBe('SUBMITTED');
    expect(trLabels.statuses.submitted).toBe('GÖNDERİLDİ');
  });

  test('should have disclaimer in both languages', () => {
    const enLabels = vatReturnTemplate.getLabels('en');
    const trLabels = vatReturnTemplate.getLabels('tr');

    expect(enLabels.disclaimer).toContain('IMPORTANT');
    expect(trLabels.disclaimer).toContain('ÖNEMLİ');
  });
});

describe('Document Localization - Profit & Loss Template', () => {
  test('should return labels in English by default', () => {
    const labels = profitLossTemplate.getLabels();
    expect(labels.title).toBe('Profit & Loss Report');
    expect(labels.income).toBe('Income');
    expect(labels.netProfit).toBe('Net Profit');
  });

  test('should return labels in Turkish', () => {
    const labels = profitLossTemplate.getLabels('tr');
    expect(labels.title).toBe('Kar/Zarar Raporu');
    expect(labels.income).toBe('Gelir');
    expect(labels.netProfit).toBe('Net Kar');
  });

  test('should get month names correctly', () => {
    expect(profitLossTemplate.getMonthName(1, 'en')).toBe('January');
    expect(profitLossTemplate.getMonthName(1, 'tr')).toBe('Ocak');
    expect(profitLossTemplate.getMonthName(12, 'en')).toBe('December');
    expect(profitLossTemplate.getMonthName(12, 'tr')).toBe('Aralık');
  });
});

describe('Document Localization - Balance Sheet Template', () => {
  test('should return labels in English by default', () => {
    const labels = balanceSheetTemplate.getLabels();
    expect(labels.title).toBe('Balance Sheet');
    expect(labels.totalAssets).toBe('Total Assets');
    expect(labels.totalEquity).toBe('Total Equity');
  });

  test('should return labels in Turkish', () => {
    const labels = balanceSheetTemplate.getLabels('tr');
    expect(labels.title).toBe('Bilanço');
    expect(labels.totalAssets).toBe('Toplam Varlıklar');
    expect(labels.totalEquity).toBe('Toplam Öz Sermaye');
  });

  test('should have balance check labels in both languages', () => {
    const enLabels = balanceSheetTemplate.getLabels('en');
    const trLabels = balanceSheetTemplate.getLabels('tr');

    expect(enLabels.balanced).toBe('Balanced');
    expect(trLabels.balanced).toBe('Dengeli');
    expect(enLabels.notBalanced).toBe('NOT BALANCED');
    expect(trLabels.notBalanced).toBe('DENGELİ DEĞİL');
  });
});

describe('Document Localization - Invoice PDF Generation', () => {
  const mockInvoice = {
    invoiceNumber: 'INV-2026-0001',
    status: 'pending',
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    customerName: 'Test Company Ltd',
    customerAddress: '123 Test Street',
    subtotal: 10000,
    vatAmount: 2000,
    totalAmount: 12000,
    currency: 'GBP',
    items: [
      { description: 'Test Service', quantity: '1', unitPrice: 10000, vatRatePercent: 20, vatAmount: 2000, lineTotal: 12000 }
    ]
  };

  const mockBusinessDetails = {
    businessName: 'Smith Consulting Ltd',
    businessAddress: '456 Business Park',
    vatNumber: 'GB123456789'
  };

  test('should generate invoice PDF in English', async () => {
    const pdfBuffer = await pdfGenerator.generateInvoicePdf(mockInvoice, mockBusinessDetails, { lang: 'en' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('should generate invoice PDF in Turkish', async () => {
    const pdfBuffer = await pdfGenerator.generateInvoicePdf(mockInvoice, mockBusinessDetails, { lang: 'tr' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Document Localization - VAT Return PDF Generation', () => {
  const mockVatReturn = {
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    status: 'draft',
    box1: 1000000,
    box2: 0,
    box3: 1000000,
    box4: 250000,
    box5: 750000,
    box6: 5000000,
    box7: 1250000,
    box8: 0,
    box9: 0,
    notes: 'Test VAT return'
  };

  const mockBusinessDetails = {
    businessName: 'Test Ltd',
    vatNumber: 'GB987654321'
  };

  test('should generate VAT return PDF in English', async () => {
    const pdfBuffer = await pdfGenerator.generateVatReturnPdf(mockVatReturn, mockBusinessDetails, { lang: 'en' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('should generate VAT return PDF in Turkish', async () => {
    const pdfBuffer = await pdfGenerator.generateVatReturnPdf(mockVatReturn, mockBusinessDetails, { lang: 'tr' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Document Localization - Profit & Loss PDF Generation', () => {
  const mockReport = {
    period: {
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      taxYear: '2025-26'
    },
    summary: {
      totalRevenue: 10000000,
      totalExpenses: 4000000,
      netProfit: 6000000,
      profitMargin: 60,
      transactionCount: 100
    },
    income: {
      categories: [
        { categoryCode: '4000', categoryName: 'Sales', amount: 8000000, vatAmount: 1600000, totalAmount: 9600000, transactionCount: 50 }
      ],
      total: { amount: 10000000, vatAmount: 2000000, totalAmount: 12000000, transactionCount: 60 }
    },
    expenses: {
      categories: [
        { categoryCode: '6000', categoryName: 'Operating Expenses', amount: 3000000, vatAmount: 600000, totalAmount: 3600000, transactionCount: 30 }
      ],
      total: { amount: 4000000, vatAmount: 800000, totalAmount: 4800000, transactionCount: 40 }
    }
  };

  const mockBusinessDetails = {
    businessName: 'Test Company Ltd'
  };

  test('should generate profit & loss PDF in English', async () => {
    const pdfBuffer = await reportPdfGenerator.generateProfitLossPdf(mockReport, mockBusinessDetails, { lang: 'en' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('should generate profit & loss PDF in Turkish', async () => {
    const pdfBuffer = await reportPdfGenerator.generateProfitLossPdf(mockReport, mockBusinessDetails, { lang: 'tr' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Document Localization - Balance Sheet PDF Generation', () => {
  const mockReport = {
    asOfDate: '2026-03-31',
    assets: {
      currentAssets: {
        categories: [
          { categoryCode: '1100', categoryName: 'Bank Current Account', amount: 5000000 }
        ],
        total: 5000000
      },
      fixedAssets: {
        categories: [
          { categoryCode: '1400', categoryName: 'Fixed Assets', amount: 3000000 }
        ],
        total: 3000000
      },
      total: 8000000
    },
    liabilities: {
      currentLiabilities: {
        categories: [
          { categoryCode: '2000', categoryName: 'Accounts Payable', amount: 2000000 }
        ],
        total: 2000000
      },
      longTermLiabilities: {
        categories: [],
        total: 0
      },
      total: 2000000
    },
    equity: {
      categories: [
        { categoryCode: '3000', categoryName: 'Share Capital', amount: 1000000 }
      ],
      retainedEarnings: 4000000,
      currentPeriodEarnings: 1000000,
      total: 6000000
    }
  };

  const mockBusinessDetails = {
    businessName: 'Test Company Ltd'
  };

  test('should generate balance sheet PDF in English', async () => {
    const pdfBuffer = await reportPdfGenerator.generateBalanceSheetPdf(mockReport, mockBusinessDetails, { lang: 'en' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('should generate balance sheet PDF in Turkish', async () => {
    const pdfBuffer = await reportPdfGenerator.generateBalanceSheetPdf(mockReport, mockBusinessDetails, { lang: 'tr' });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('should validate balance sheet report', () => {
    const result = reportPdfGenerator.validateReportForPdf(mockReport, 'balance-sheet');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should fail validation for missing assets', () => {
    const invalidReport = { asOfDate: '2026-03-31' };
    const result = reportPdfGenerator.validateReportForPdf(invalidReport, 'balance-sheet');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Assets data is required');
  });
});

describe('Document Localization - Reports Template Integration', () => {
  test('should return labels from main reports template in English', () => {
    const labels = reportsTemplate.getLabels('en');
    expect(labels.profitLoss.title).toBe('Profit & Loss Report');
    expect(labels.common.total).toBe('Total');
  });

  test('should return labels from main reports template in Turkish', () => {
    const labels = reportsTemplate.getLabels('tr');
    expect(labels.profitLoss.title).toBe('Kar/Zarar Raporu');
    expect(labels.common.total).toBe('Toplam');
  });

  test('should get month names correctly', () => {
    expect(reportsTemplate.getMonthName(1, 'en')).toBe('January');
    expect(reportsTemplate.getMonthName(1, 'tr')).toBe('Ocak');
  });
});

describe('Date and Currency Format Consistency', () => {
  test('should format dates correctly for UK format', () => {
    const date = pdfGenerator.formatPdfDate('2026-01-15');
    expect(date).toBe('15/01/2026');
  });

  test('should format money correctly with GBP symbol', () => {
    const money = pdfGenerator.formatMoney(123456, 'GBP');
    expect(money).toBe('£1234.56');
  });

  test('should format money correctly with EUR symbol', () => {
    const money = pdfGenerator.formatMoney(123456, 'EUR');
    expect(money).toBe('€1234.56');
  });

  test('should handle empty date', () => {
    const date = pdfGenerator.formatPdfDate(null);
    expect(date).toBe('');
  });

  test('should handle empty date in report generator', () => {
    const date = reportPdfGenerator.formatPdfDate(null);
    expect(date).toBe('');
  });
});
