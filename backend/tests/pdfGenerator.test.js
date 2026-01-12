/**
 * Unit tests for PDF Generator Service.
 * Tests PDF generation and helper functions.
 * 
 * @module tests/pdfGenerator.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-pdf-generator-database.sqlite');

let pdfGenerator;
let invoiceTemplate;

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
  invoiceTemplate = require('../templates/invoice');
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

describe('PDF Generator Service', () => {
  describe('formatMoney', () => {
    test('should format GBP amounts correctly', () => {
      expect(pdfGenerator.formatMoney(12345, 'GBP')).toBe('£123.45');
      expect(pdfGenerator.formatMoney(100, 'GBP')).toBe('£1.00');
      expect(pdfGenerator.formatMoney(0, 'GBP')).toBe('£0.00');
      expect(pdfGenerator.formatMoney(50, 'GBP')).toBe('£0.50');
    });

    test('should format EUR amounts correctly', () => {
      expect(pdfGenerator.formatMoney(12345, 'EUR')).toBe('€123.45');
    });

    test('should format USD amounts correctly', () => {
      expect(pdfGenerator.formatMoney(12345, 'USD')).toBe('$123.45');
    });

    test('should default to GBP when no currency specified', () => {
      expect(pdfGenerator.formatMoney(12345)).toBe('£123.45');
    });
  });

  describe('formatPdfDate', () => {
    test('should format ISO dates to UK format', () => {
      expect(pdfGenerator.formatPdfDate('2026-01-15')).toBe('15/01/2026');
      expect(pdfGenerator.formatPdfDate('2026-12-25')).toBe('25/12/2026');
    });

    test('should return empty string for null or undefined', () => {
      expect(pdfGenerator.formatPdfDate(null)).toBe('');
      expect(pdfGenerator.formatPdfDate(undefined)).toBe('');
      expect(pdfGenerator.formatPdfDate('')).toBe('');
    });
  });

  describe('calculateVatBreakdown', () => {
    test('should calculate VAT breakdown for single rate', () => {
      const items = [
        { vatRateId: 'standard', vatRatePercent: 20, lineTotal: 1200, vatAmount: 200 },
        { vatRateId: 'standard', vatRatePercent: 20, lineTotal: 2400, vatAmount: 400 }
      ];

      const breakdown = pdfGenerator.calculateVatBreakdown(items);

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].vatRateId).toBe('standard');
      expect(breakdown[0].vatRatePercent).toBe(20);
      expect(breakdown[0].netAmount).toBe(3000); // (1200-200) + (2400-400)
      expect(breakdown[0].vatAmount).toBe(600);
    });

    test('should calculate VAT breakdown for multiple rates', () => {
      const items = [
        { vatRateId: 'standard', vatRatePercent: 20, lineTotal: 1200, vatAmount: 200 },
        { vatRateId: 'reduced', vatRatePercent: 5, lineTotal: 1050, vatAmount: 50 },
        { vatRateId: 'zero', vatRatePercent: 0, lineTotal: 500, vatAmount: 0 }
      ];

      const breakdown = pdfGenerator.calculateVatBreakdown(items);

      expect(breakdown).toHaveLength(3);
      
      // Should be sorted by rate descending
      expect(breakdown[0].vatRatePercent).toBe(20);
      expect(breakdown[1].vatRatePercent).toBe(5);
      expect(breakdown[2].vatRatePercent).toBe(0);
    });

    test('should handle empty items array', () => {
      const breakdown = pdfGenerator.calculateVatBreakdown([]);
      expect(breakdown).toHaveLength(0);
    });
  });

  describe('validateInvoiceForPdf', () => {
    test('should validate complete invoice data', () => {
      const invoice = {
        invoiceNumber: 'INV-2026-0001',
        issueDate: '2026-01-15',
        customerName: 'Test Customer',
        totalAmount: 12000,
        items: [
          { description: 'Test Item', quantity: 1, unitPrice: 10000, lineTotal: 12000, vatAmount: 2000 }
        ]
      };

      const result = pdfGenerator.validateInvoiceForPdf(invoice);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation for missing invoice number', () => {
      const invoice = {
        issueDate: '2026-01-15',
        customerName: 'Test Customer',
        totalAmount: 12000,
        items: [{ description: 'Test', lineTotal: 12000 }]
      };

      const result = pdfGenerator.validateInvoiceForPdf(invoice);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invoice number is required');
    });

    test('should fail validation for missing customer name', () => {
      const invoice = {
        invoiceNumber: 'INV-2026-0001',
        issueDate: '2026-01-15',
        totalAmount: 12000,
        items: [{ description: 'Test', lineTotal: 12000 }]
      };

      const result = pdfGenerator.validateInvoiceForPdf(invoice);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer name is required');
    });

    test('should fail validation for missing items', () => {
      const invoice = {
        invoiceNumber: 'INV-2026-0001',
        issueDate: '2026-01-15',
        customerName: 'Test Customer',
        totalAmount: 12000
      };

      const result = pdfGenerator.validateInvoiceForPdf(invoice);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one line item is required');
    });

    test('should fail validation for empty items array', () => {
      const invoice = {
        invoiceNumber: 'INV-2026-0001',
        issueDate: '2026-01-15',
        customerName: 'Test Customer',
        totalAmount: 12000,
        items: []
      };

      const result = pdfGenerator.validateInvoiceForPdf(invoice);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one line item is required');
    });

    test('should fail validation for null invoice', () => {
      const result = pdfGenerator.validateInvoiceForPdf(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invoice data is required');
    });
  });

  describe('generateInvoicePdf', () => {
    const mockInvoice = {
      id: 1,
      invoiceNumber: 'INV-2026-0001',
      status: 'pending',
      issueDate: '2026-01-15',
      dueDate: '2026-02-15',
      taxPoint: '2026-01-15',
      customerName: 'ABC Company Ltd',
      customerAddress: '123 High Street, London, SW1A 1AA',
      customerEmail: 'billing@abccompany.co.uk',
      customerVatNumber: 'GB123456789',
      subtotal: 10000,
      vatAmount: 2000,
      totalAmount: 12000,
      currency: 'GBP',
      notes: 'Thank you for your business. Payment terms: Net 30 days.',
      items: [
        {
          description: 'Professional Consulting Services',
          quantity: '2',
          unitPrice: 5000,
          vatRateId: 'standard',
          vatRatePercent: 20,
          vatAmount: 2000,
          lineTotal: 12000
        }
      ]
    };

    const mockBusinessDetails = {
      name: 'John Smith',
      businessName: 'Smith Consulting Ltd',
      businessAddress: '456 Business Park, Manchester, M1 2AB',
      email: 'info@smithconsulting.co.uk',
      vatNumber: 'GB987654321',
      companyNumber: '12345678',
      isVatRegistered: true
    };

    test('should generate PDF buffer in English', async () => {
      const pdfBuffer = await pdfGenerator.generateInvoicePdf(mockInvoice, mockBusinessDetails, { lang: 'en' });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Check PDF header
      const pdfHeader = pdfBuffer.slice(0, 5).toString();
      expect(pdfHeader).toBe('%PDF-');
    });

    test('should generate PDF buffer in Turkish', async () => {
      const pdfBuffer = await pdfGenerator.generateInvoicePdf(mockInvoice, mockBusinessDetails, { lang: 'tr' });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Check PDF header
      const pdfHeader = pdfBuffer.slice(0, 5).toString();
      expect(pdfHeader).toBe('%PDF-');
    });

    test('should generate PDF with minimal invoice data', async () => {
      const minimalInvoice = {
        invoiceNumber: 'INV-001',
        status: 'draft',
        issueDate: '2026-01-15',
        customerName: 'Test Customer',
        subtotal: 1000,
        vatAmount: 200,
        totalAmount: 1200,
        currency: 'GBP',
        items: [
          {
            description: 'Test Service',
            quantity: '1',
            unitPrice: 1000,
            vatRatePercent: 20,
            vatAmount: 200,
            lineTotal: 1200
          }
        ]
      };

      const minimalBusiness = {
        name: 'Test User'
      };

      const pdfBuffer = await pdfGenerator.generateInvoicePdf(minimalInvoice, minimalBusiness);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should handle multiple line items', async () => {
      const multiItemInvoice = {
        ...mockInvoice,
        items: [
          { description: 'Item 1', quantity: '1', unitPrice: 1000, vatRatePercent: 20, vatAmount: 200, lineTotal: 1200 },
          { description: 'Item 2', quantity: '2', unitPrice: 500, vatRatePercent: 20, vatAmount: 200, lineTotal: 1200 },
          { description: 'Item 3', quantity: '3', unitPrice: 333, vatRatePercent: 5, vatAmount: 50, lineTotal: 1049 },
          { description: 'Item 4 with a very long description that should wrap correctly in the PDF', quantity: '1', unitPrice: 2500, vatRatePercent: 0, vatAmount: 0, lineTotal: 2500 }
        ],
        subtotal: 5000,
        vatAmount: 450,
        totalAmount: 5450
      };

      const pdfBuffer = await pdfGenerator.generateInvoicePdf(multiItemInvoice, mockBusinessDetails);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should handle different currencies', async () => {
      const eurInvoice = { ...mockInvoice, currency: 'EUR' };
      const usdInvoice = { ...mockInvoice, currency: 'USD' };

      const eurPdf = await pdfGenerator.generateInvoicePdf(eurInvoice, mockBusinessDetails);
      const usdPdf = await pdfGenerator.generateInvoicePdf(usdInvoice, mockBusinessDetails);

      expect(eurPdf).toBeInstanceOf(Buffer);
      expect(usdPdf).toBeInstanceOf(Buffer);
    });

    test('should handle invoice without notes', async () => {
      const noNotesInvoice = { ...mockInvoice, notes: null };

      const pdfBuffer = await pdfGenerator.generateInvoicePdf(noNotesInvoice, mockBusinessDetails);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should handle all invoice statuses', async () => {
      const statuses = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'];

      for (const status of statuses) {
        const statusInvoice = { ...mockInvoice, status };
        const pdfBuffer = await pdfGenerator.generateInvoicePdf(statusInvoice, mockBusinessDetails);
        expect(pdfBuffer).toBeInstanceOf(Buffer);
      }
    });
  });
});

describe('Invoice Template', () => {
  describe('getLabels', () => {
    test('should return English labels by default', () => {
      const labels = invoiceTemplate.getLabels();
      expect(labels.title).toBe('INVOICE');
      expect(labels.vatNumber).toBe('VAT Number');
    });

    test('should return English labels when en specified', () => {
      const labels = invoiceTemplate.getLabels('en');
      expect(labels.title).toBe('INVOICE');
      expect(labels.invoiceNumber).toBe('Invoice Number');
    });

    test('should return Turkish labels when tr specified', () => {
      const labels = invoiceTemplate.getLabels('tr');
      expect(labels.title).toBe('FATURA');
      expect(labels.invoiceNumber).toBe('Fatura Numarası');
      expect(labels.vatNumber).toBe('KDV Numarası');
    });

    test('should fallback to English for unknown language', () => {
      const labels = invoiceTemplate.getLabels('fr');
      expect(labels.title).toBe('INVOICE');
    });
  });

  describe('getCurrencySymbol', () => {
    test('should return correct currency symbols', () => {
      expect(invoiceTemplate.getCurrencySymbol('GBP')).toBe('£');
      expect(invoiceTemplate.getCurrencySymbol('EUR')).toBe('€');
      expect(invoiceTemplate.getCurrencySymbol('USD')).toBe('$');
    });

    test('should return code with space for unknown currency', () => {
      expect(invoiceTemplate.getCurrencySymbol('CHF')).toBe('CHF ');
    });
  });

  describe('getVatRateName', () => {
    test('should return correct VAT rate names in English', () => {
      expect(invoiceTemplate.getVatRateName('standard', 'en')).toBe('Standard Rate (20%)');
      expect(invoiceTemplate.getVatRateName('reduced', 'en')).toBe('Reduced Rate (5%)');
      expect(invoiceTemplate.getVatRateName('zero', 'en')).toBe('Zero Rate (0%)');
      expect(invoiceTemplate.getVatRateName('exempt', 'en')).toBe('Exempt');
    });

    test('should return correct VAT rate names in Turkish', () => {
      expect(invoiceTemplate.getVatRateName('standard', 'tr')).toBe('Standart Oran (%20)');
      expect(invoiceTemplate.getVatRateName('reduced', 'tr')).toBe('İndirimli Oran (%5)');
      expect(invoiceTemplate.getVatRateName('zero', 'tr')).toBe('Sıfır Oran (%0)');
    });

    test('should return vatRateId with % suffix for unknown rate', () => {
      expect(invoiceTemplate.getVatRateName('custom', 'en')).toBe('custom%');
    });
  });

  describe('getStatusLabel', () => {
    test('should return correct status labels in English', () => {
      expect(invoiceTemplate.getStatusLabel('draft', 'en')).toBe('DRAFT');
      expect(invoiceTemplate.getStatusLabel('pending', 'en')).toBe('PENDING PAYMENT');
      expect(invoiceTemplate.getStatusLabel('paid', 'en')).toBe('PAID');
      expect(invoiceTemplate.getStatusLabel('overdue', 'en')).toBe('OVERDUE');
    });

    test('should return correct status labels in Turkish', () => {
      expect(invoiceTemplate.getStatusLabel('draft', 'tr')).toBe('TASLAK');
      expect(invoiceTemplate.getStatusLabel('pending', 'tr')).toBe('ÖDEME BEKLİYOR');
      expect(invoiceTemplate.getStatusLabel('paid', 'tr')).toBe('ÖDENDİ');
    });
  });

  describe('getStatusColor', () => {
    test('should return appropriate colors for each status', () => {
      const colors = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'];
      
      for (const status of colors) {
        const color = invoiceTemplate.getStatusColor(status);
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    test('should return fallback color for unknown status', () => {
      const color = invoiceTemplate.getStatusColor('unknown');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('colors', () => {
    test('should have all required colors defined', () => {
      expect(invoiceTemplate.colors.primary).toBeDefined();
      expect(invoiceTemplate.colors.secondary).toBeDefined();
      expect(invoiceTemplate.colors.text).toBeDefined();
      expect(invoiceTemplate.colors.border).toBeDefined();
      expect(invoiceTemplate.colors.background).toBeDefined();
      expect(invoiceTemplate.colors.white).toBeDefined();
    });

    test('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      
      Object.values(invoiceTemplate.colors).forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  describe('layout', () => {
    test('should have valid page size', () => {
      expect(invoiceTemplate.layout.pageSize).toBe('A4');
    });

    test('should have valid margins', () => {
      expect(invoiceTemplate.layout.margins.top).toBeGreaterThan(0);
      expect(invoiceTemplate.layout.margins.bottom).toBeGreaterThan(0);
      expect(invoiceTemplate.layout.margins.left).toBeGreaterThan(0);
      expect(invoiceTemplate.layout.margins.right).toBeGreaterThan(0);
    });
  });

  describe('getDefaultPaymentTerms', () => {
    test('should return English payment terms', () => {
      const terms = invoiceTemplate.getDefaultPaymentTerms('en');
      expect(terms).toContain('30 days');
    });

    test('should return Turkish payment terms', () => {
      const terms = invoiceTemplate.getDefaultPaymentTerms('tr');
      expect(terms).toContain('30 gün');
    });

    test('should default to English for unknown language', () => {
      const terms = invoiceTemplate.getDefaultPaymentTerms('fr');
      expect(terms).toContain('30 days');
    });
  });
});
