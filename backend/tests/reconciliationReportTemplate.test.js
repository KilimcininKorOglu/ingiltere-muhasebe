/**
 * Unit Tests for Reconciliation Report Template
 */

const {
  getLabels,
  getCurrencySymbol,
  getMatchTypeName,
  getStatusLabel,
  colors,
  fonts,
  layout
} = require('../templates/reconciliationReport');

describe('Reconciliation Report Template', () => {
  describe('getLabels', () => {
    it('should return English labels by default', () => {
      const labels = getLabels();
      expect(labels.title).toBe('RECONCILIATION REPORT');
      expect(labels.balanceSummary).toBe('Balance Summary');
    });

    it('should return English labels for "en"', () => {
      const labels = getLabels('en');
      expect(labels.title).toBe('RECONCILIATION REPORT');
    });

    it('should return Turkish labels for "tr"', () => {
      const labels = getLabels('tr');
      expect(labels.title).toBe('MUTABAKAT RAPORU');
      expect(labels.balanceSummary).toBe('Bakiye Özeti');
    });

    it('should fallback to English for unknown language', () => {
      const labels = getLabels('unknown');
      expect(labels.title).toBe('RECONCILIATION REPORT');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return £ for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('should return € for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return $ for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return currency code with space for unknown currency', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ ');
    });
  });

  describe('getMatchTypeName', () => {
    it('should return "Exact Match" for exact type in English', () => {
      expect(getMatchTypeName('exact', 'en')).toBe('Exact Match');
    });

    it('should return "Tam Eşleşme" for exact type in Turkish', () => {
      expect(getMatchTypeName('exact', 'tr')).toBe('Tam Eşleşme');
    });

    it('should return "Partial Match" for partial type', () => {
      expect(getMatchTypeName('partial', 'en')).toBe('Partial Match');
    });

    it('should return "Manual Match" for manual type', () => {
      expect(getMatchTypeName('manual', 'en')).toBe('Manual Match');
    });

    it('should return match type as-is for unknown type', () => {
      expect(getMatchTypeName('unknown', 'en')).toBe('unknown');
    });
  });

  describe('getStatusLabel', () => {
    it('should return "Unmatched" for unmatched status in English', () => {
      expect(getStatusLabel('unmatched', 'en')).toBe('Unmatched');
    });

    it('should return "Eşleşmemiş" for unmatched status in Turkish', () => {
      expect(getStatusLabel('unmatched', 'tr')).toBe('Eşleşmemiş');
    });

    it('should return "Matched" for matched status', () => {
      expect(getStatusLabel('matched', 'en')).toBe('Matched');
    });

    it('should return "Excluded" for excluded status', () => {
      expect(getStatusLabel('excluded', 'en')).toBe('Excluded');
    });

    it('should return status as-is for unknown status', () => {
      expect(getStatusLabel('unknown', 'en')).toBe('unknown');
    });
  });

  describe('colors', () => {
    it('should have primary color defined', () => {
      expect(colors.primary).toBeDefined();
      expect(typeof colors.primary).toBe('string');
    });

    it('should have success color defined', () => {
      expect(colors.success).toBeDefined();
    });

    it('should have warning color defined', () => {
      expect(colors.warning).toBeDefined();
    });

    it('should have error color defined', () => {
      expect(colors.error).toBeDefined();
    });

    it('should have credit color defined', () => {
      expect(colors.credit).toBeDefined();
    });

    it('should have debit color defined', () => {
      expect(colors.debit).toBeDefined();
    });
  });

  describe('fonts', () => {
    it('should have regular font defined', () => {
      expect(fonts.regular).toBe('Helvetica');
    });

    it('should have bold font defined', () => {
      expect(fonts.bold).toBe('Helvetica-Bold');
    });

    it('should have italic font defined', () => {
      expect(fonts.italic).toBe('Helvetica-Oblique');
    });
  });

  describe('layout', () => {
    it('should have A4 page size', () => {
      expect(layout.pageSize).toBe('A4');
    });

    it('should have margins defined', () => {
      expect(layout.margins).toBeDefined();
      expect(layout.margins.top).toBeDefined();
      expect(layout.margins.bottom).toBeDefined();
      expect(layout.margins.left).toBeDefined();
      expect(layout.margins.right).toBeDefined();
    });

    it('should have font sizes defined', () => {
      expect(layout.fontSize).toBeDefined();
      expect(layout.fontSize.title).toBeDefined();
      expect(layout.fontSize.normal).toBeDefined();
      expect(layout.fontSize.small).toBeDefined();
    });
  });
});
