/**
 * Unit Tests for Reconciliation Report PDF Generation
 */

const { 
  validateReportDataForPdf, 
  formatMoney, 
  formatPdfDate,
  truncateText
} = require('../services/pdfGenerator');

describe('Reconciliation Report PDF Generator', () => {
  describe('validateReportDataForPdf', () => {
    it('should return valid for complete report data', () => {
      const reportData = {
        bankAccount: {
          accountName: 'Test Account',
          bankName: 'Test Bank',
          currency: 'GBP'
        },
        summary: {
          totalTransactions: 10,
          reconciledCount: 5,
          unreconciledCount: 5
        },
        balances: {
          bank: { credits: '100.00', debits: '50.00', net: '50.00' },
          reconciled: { credits: '50.00', debits: '25.00', net: '25.00' },
          unreconciled: { credits: '50.00', debits: '25.00', net: '25.00' }
        }
      };

      const result = validateReportDataForPdf(reportData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for null report data', () => {
      const result = validateReportDataForPdf(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Report data is required');
    });

    it('should return invalid for undefined report data', () => {
      const result = validateReportDataForPdf(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Report data is required');
    });

    it('should return invalid for missing bank account', () => {
      const reportData = {
        summary: {},
        balances: {}
      };

      const result = validateReportDataForPdf(reportData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bank account data is required');
    });

    it('should return invalid for missing summary', () => {
      const reportData = {
        bankAccount: {},
        balances: {}
      };

      const result = validateReportDataForPdf(reportData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Summary data is required');
    });

    it('should return invalid for missing balances', () => {
      const reportData = {
        bankAccount: {},
        summary: {}
      };

      const result = validateReportDataForPdf(reportData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Balance data is required');
    });

    it('should collect multiple errors', () => {
      const reportData = {};

      const result = validateReportDataForPdf(reportData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('formatMoney', () => {
    it('should format pence to pounds with currency symbol', () => {
      expect(formatMoney(10000, 'GBP')).toBe('£100.00');
    });

    it('should format small amounts correctly', () => {
      expect(formatMoney(50, 'GBP')).toBe('£0.50');
    });

    it('should format zero correctly', () => {
      expect(formatMoney(0, 'GBP')).toBe('£0.00');
    });

    it('should use GBP by default', () => {
      expect(formatMoney(10000)).toBe('£100.00');
    });

    it('should format EUR correctly', () => {
      expect(formatMoney(10000, 'EUR')).toBe('€100.00');
    });

    it('should format USD correctly', () => {
      expect(formatMoney(10000, 'USD')).toBe('$100.00');
    });
  });

  describe('formatPdfDate', () => {
    it('should format ISO date to UK format', () => {
      const result = formatPdfDate('2024-12-25');
      // Should be DD/MM/YYYY format
      expect(result).toBe('25/12/2024');
    });

    it('should handle empty date', () => {
      const result = formatPdfDate('');
      expect(result).toBe('');
    });

    it('should handle null date', () => {
      const result = formatPdfDate(null);
      expect(result).toBe('');
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
    });

    it('should handle exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('should handle null', () => {
      expect(truncateText(null, 10)).toBe('');
    });

    it('should handle undefined', () => {
      expect(truncateText(undefined, 10)).toBe('');
    });
  });
});
