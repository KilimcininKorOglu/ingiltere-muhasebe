/**
 * Unit tests for VAT Return PDF Generation.
 * Tests PDF generation for VAT returns with bilingual support and HMRC compliance.
 * 
 * @module tests/vatReturnPdf.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-vat-return-pdf-database.sqlite');

let pdfGenerator;
let vatReturnTemplate;

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
  vatReturnTemplate = require('../templates/vatReturn');
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

describe('VAT Return Template', () => {
  describe('getLabels', () => {
    test('should return English labels by default', () => {
      const labels = vatReturnTemplate.getLabels();
      expect(labels.title).toBe('VAT RETURN');
      expect(labels.vatNumber).toBe('VAT Registration Number');
      expect(labels.box1Label).toBe('Box 1');
    });

    test('should return English labels when en specified', () => {
      const labels = vatReturnTemplate.getLabels('en');
      expect(labels.title).toBe('VAT RETURN');
      expect(labels.periodLabel).toBe('VAT Period');
      expect(labels.box5Description).toBe('Net VAT to pay to HMRC (or reclaim)');
    });

    test('should return Turkish labels when tr specified', () => {
      const labels = vatReturnTemplate.getLabels('tr');
      expect(labels.title).toBe('KDV BEYANNAMESI');
      expect(labels.periodLabel).toBe('KDV Dönemi');
      expect(labels.vatNumber).toBe('KDV Sicil Numarası');
      expect(labels.box1Label).toBe('Kutu 1');
    });

    test('should fallback to English for unknown language', () => {
      const labels = vatReturnTemplate.getLabels('fr');
      expect(labels.title).toBe('VAT RETURN');
    });

    test('should include all nine box descriptions in English', () => {
      const labels = vatReturnTemplate.getLabels('en');
      expect(labels.box1Description).toBeDefined();
      expect(labels.box2Description).toBeDefined();
      expect(labels.box3Description).toBeDefined();
      expect(labels.box4Description).toBeDefined();
      expect(labels.box5Description).toBeDefined();
      expect(labels.box6Description).toBeDefined();
      expect(labels.box7Description).toBeDefined();
      expect(labels.box8Description).toBeDefined();
      expect(labels.box9Description).toBeDefined();
    });

    test('should include all nine box descriptions in Turkish', () => {
      const labels = vatReturnTemplate.getLabels('tr');
      expect(labels.box1Description).toBeDefined();
      expect(labels.box2Description).toBeDefined();
      expect(labels.box3Description).toBeDefined();
      expect(labels.box4Description).toBeDefined();
      expect(labels.box5Description).toBeDefined();
      expect(labels.box6Description).toBeDefined();
      expect(labels.box7Description).toBeDefined();
      expect(labels.box8Description).toBeDefined();
      expect(labels.box9Description).toBeDefined();
    });

    test('should include disclaimer in both languages', () => {
      const enLabels = vatReturnTemplate.getLabels('en');
      const trLabels = vatReturnTemplate.getLabels('tr');
      
      expect(enLabels.disclaimer).toContain('IMPORTANT');
      expect(enLabels.disclaimer).toContain('record-keeping');
      expect(trLabels.disclaimer).toContain('ÖNEMLİ');
      expect(trLabels.disclaimer).toContain('kayıt tutma');
    });
  });

  describe('getCurrencySymbol', () => {
    test('should return correct currency symbols', () => {
      expect(vatReturnTemplate.getCurrencySymbol('GBP')).toBe('£');
      expect(vatReturnTemplate.getCurrencySymbol('EUR')).toBe('€');
      expect(vatReturnTemplate.getCurrencySymbol('USD')).toBe('$');
    });

    test('should return code with space for unknown currency', () => {
      expect(vatReturnTemplate.getCurrencySymbol('CHF')).toBe('CHF ');
    });
  });

  describe('getStatusLabel', () => {
    test('should return correct status labels in English', () => {
      expect(vatReturnTemplate.getStatusLabel('draft', 'en')).toBe('DRAFT');
      expect(vatReturnTemplate.getStatusLabel('pending', 'en')).toBe('PENDING');
      expect(vatReturnTemplate.getStatusLabel('submitted', 'en')).toBe('SUBMITTED');
      expect(vatReturnTemplate.getStatusLabel('accepted', 'en')).toBe('ACCEPTED');
      expect(vatReturnTemplate.getStatusLabel('rejected', 'en')).toBe('REJECTED');
      expect(vatReturnTemplate.getStatusLabel('amended', 'en')).toBe('AMENDED');
    });

    test('should return correct status labels in Turkish', () => {
      expect(vatReturnTemplate.getStatusLabel('draft', 'tr')).toBe('TASLAK');
      expect(vatReturnTemplate.getStatusLabel('pending', 'tr')).toBe('BEKLEMEDE');
      expect(vatReturnTemplate.getStatusLabel('submitted', 'tr')).toBe('GÖNDERİLDİ');
      expect(vatReturnTemplate.getStatusLabel('accepted', 'tr')).toBe('KABUL EDİLDİ');
      expect(vatReturnTemplate.getStatusLabel('rejected', 'tr')).toBe('REDDEDİLDİ');
    });
  });

  describe('getStatusColor', () => {
    test('should return appropriate colors for each status', () => {
      const statuses = ['draft', 'pending', 'submitted', 'accepted', 'rejected', 'amended'];
      
      for (const status of statuses) {
        const color = vatReturnTemplate.getStatusColor(status);
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    test('should return fallback color for unknown status', () => {
      const color = vatReturnTemplate.getStatusColor('unknown');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('colors', () => {
    test('should have all required colors defined', () => {
      expect(vatReturnTemplate.colors.primary).toBeDefined();
      expect(vatReturnTemplate.colors.secondary).toBeDefined();
      expect(vatReturnTemplate.colors.text).toBeDefined();
      expect(vatReturnTemplate.colors.border).toBeDefined();
      expect(vatReturnTemplate.colors.background).toBeDefined();
      expect(vatReturnTemplate.colors.white).toBeDefined();
      expect(vatReturnTemplate.colors.warning).toBeDefined();
      expect(vatReturnTemplate.colors.success).toBeDefined();
      expect(vatReturnTemplate.colors.danger).toBeDefined();
    });

    test('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      
      Object.values(vatReturnTemplate.colors).forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  describe('layout', () => {
    test('should have valid page size', () => {
      expect(vatReturnTemplate.layout.pageSize).toBe('A4');
    });

    test('should have valid margins', () => {
      expect(vatReturnTemplate.layout.margins.top).toBeGreaterThan(0);
      expect(vatReturnTemplate.layout.margins.bottom).toBeGreaterThan(0);
      expect(vatReturnTemplate.layout.margins.left).toBeGreaterThan(0);
      expect(vatReturnTemplate.layout.margins.right).toBeGreaterThan(0);
    });

    test('should have adequate bottom margin for disclaimer', () => {
      // Bottom margin should be larger to accommodate the disclaimer
      expect(vatReturnTemplate.layout.margins.bottom).toBeGreaterThanOrEqual(70);
    });
  });

  describe('fonts', () => {
    test('should have required font definitions', () => {
      expect(vatReturnTemplate.fonts.regular).toBeDefined();
      expect(vatReturnTemplate.fonts.bold).toBeDefined();
      expect(vatReturnTemplate.fonts.italic).toBeDefined();
    });
  });
});

describe('VAT Return PDF Generator', () => {
  describe('validateVatReturnForPdf', () => {
    test('should validate complete VAT return data', () => {
      const vatReturn = {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        box1: 10000,
        box2: 0,
        box3: 10000,
        box4: 2500,
        box5: 7500,
        box6: 50000,
        box7: 12500,
        box8: 0,
        box9: 0
      };

      const result = pdfGenerator.validateVatReturnForPdf(vatReturn);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation for missing period start', () => {
      const vatReturn = {
        periodEnd: '2026-03-31',
        box1: 10000, box2: 0, box3: 10000, box4: 2500, box5: 7500,
        box6: 50000, box7: 12500, box8: 0, box9: 0
      };

      const result = pdfGenerator.validateVatReturnForPdf(vatReturn);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Period start date is required');
    });

    test('should fail validation for missing period end', () => {
      const vatReturn = {
        periodStart: '2026-01-01',
        box1: 10000, box2: 0, box3: 10000, box4: 2500, box5: 7500,
        box6: 50000, box7: 12500, box8: 0, box9: 0
      };

      const result = pdfGenerator.validateVatReturnForPdf(vatReturn);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Period end date is required');
    });

    test('should fail validation for missing box values', () => {
      const vatReturn = {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        box1: 10000
        // Missing box2-box9
      };

      const result = pdfGenerator.validateVatReturnForPdf(vatReturn);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should pass validation with zero box values', () => {
      const vatReturn = {
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        box1: 0,
        box2: 0,
        box3: 0,
        box4: 0,
        box5: 0,
        box6: 0,
        box7: 0,
        box8: 0,
        box9: 0
      };

      const result = pdfGenerator.validateVatReturnForPdf(vatReturn);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation for null VAT return', () => {
      const result = pdfGenerator.validateVatReturnForPdf(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('VAT return data is required');
    });
  });

  describe('generateVatReturnPdf', () => {
    const mockVatReturn = {
      id: 1,
      userId: 1,
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      status: 'draft',
      box1: 1000000,    // £10,000.00
      box2: 0,
      box3: 1000000,    // £10,000.00
      box4: 250000,     // £2,500.00
      box5: 750000,     // £7,500.00
      box6: 5000000,    // £50,000.00
      box7: 1250000,    // £12,500.00
      box8: 0,
      box9: 0,
      notes: 'Q1 2026 VAT Return - Standard accounting scheme used.'
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
      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        mockVatReturn, 
        mockBusinessDetails, 
        { lang: 'en' }
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Check PDF header
      const pdfHeader = pdfBuffer.slice(0, 5).toString();
      expect(pdfHeader).toBe('%PDF-');
    });

    test('should generate PDF buffer in Turkish', async () => {
      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        mockVatReturn, 
        mockBusinessDetails, 
        { lang: 'tr' }
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Check PDF header
      const pdfHeader = pdfBuffer.slice(0, 5).toString();
      expect(pdfHeader).toBe('%PDF-');
    });

    test('should generate PDF with all nine boxes populated', async () => {
      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        mockVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      // PDF should be a reasonable size (at least a few KB)
      expect(pdfBuffer.length).toBeGreaterThan(5000);
    });

    test('should generate PDF with minimal business details', async () => {
      const minimalBusiness = {
        name: 'Test User'
      };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        mockVatReturn, 
        minimalBusiness
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF without notes', async () => {
      const noNotesVatReturn = { ...mockVatReturn, notes: null };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        noNotesVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF for all VAT return statuses', async () => {
      const statuses = ['draft', 'pending', 'submitted', 'accepted', 'rejected', 'amended'];

      for (const status of statuses) {
        const statusVatReturn = { ...mockVatReturn, status };
        const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
          statusVatReturn, 
          mockBusinessDetails
        );
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);
      }
    });

    test('should generate PDF with negative box5 (refund due)', async () => {
      const refundVatReturn = {
        ...mockVatReturn,
        box3: 100000,   // £1,000.00
        box4: 250000,   // £2,500.00
        box5: -150000   // -£1,500.00 (refund due)
      };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        refundVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF with zero values in all boxes', async () => {
      const zeroVatReturn = {
        id: 2,
        userId: 1,
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        status: 'draft',
        box1: 0, box2: 0, box3: 0, box4: 0, box5: 0,
        box6: 0, box7: 0, box8: 0, box9: 0
      };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        zeroVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF with EU trade values (boxes 8 and 9)', async () => {
      const euTradeVatReturn = {
        ...mockVatReturn,
        box8: 500000,   // £5,000.00 supplies to EU
        box9: 300000    // £3,000.00 acquisitions from EU
      };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        euTradeVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should default to English when no language specified', async () => {
      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        mockVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF with long notes', async () => {
      const longNotesVatReturn = {
        ...mockVatReturn,
        notes: 'This is a very long note for the VAT return. '.repeat(20) +
               'It contains multiple sentences and should wrap correctly in the PDF document. ' +
               'The note section should expand to accommodate all this text without issues.'
      };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        longNotesVatReturn, 
        mockBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    test('should generate PDF with full business address', async () => {
      const fullBusinessDetails = {
        ...mockBusinessDetails,
        businessAddress: '123 Long Street Name, Suite 456, Business District, Greater Manchester, United Kingdom, M1 2AB'
      };

      const pdfBuffer = await pdfGenerator.generateVatReturnPdf(
        mockVatReturn, 
        fullBusinessDetails
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });
});
