/**
 * Unit Tests for Reconciliation Report Service
 */

const ReconciliationReportService = require('../services/reconciliationReportService');

describe('ReconciliationReportService', () => {
  describe('validateReportRequest', () => {
    it('should return valid for a valid bank account ID', () => {
      const result = ReconciliationReportService.validateReportRequest(1, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for a null bank account ID', () => {
      const result = ReconciliationReportService.validateReportRequest(null, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid bank account ID is required');
    });

    it('should return invalid for a zero bank account ID', () => {
      const result = ReconciliationReportService.validateReportRequest(0, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid bank account ID is required');
    });

    it('should return invalid for a negative bank account ID', () => {
      const result = ReconciliationReportService.validateReportRequest(-1, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid bank account ID is required');
    });

    it('should return invalid for a non-integer bank account ID', () => {
      const result = ReconciliationReportService.validateReportRequest(1.5, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid bank account ID is required');
    });

    it('should return valid for valid date range', () => {
      const result = ReconciliationReportService.validateReportRequest(1, {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when start date is after end date', () => {
      const result = ReconciliationReportService.validateReportRequest(1, {
        startDate: '2024-12-31',
        endDate: '2024-01-01'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    it('should return valid when only start date is provided', () => {
      const result = ReconciliationReportService.validateReportRequest(1, {
        startDate: '2024-01-01'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid when only end date is provided', () => {
      const result = ReconciliationReportService.validateReportRequest(1, {
        endDate: '2024-12-31'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Service exports', () => {
    it('should export generateReconciliationReport function', () => {
      expect(typeof ReconciliationReportService.generateReconciliationReport).toBe('function');
    });

    it('should export getReportDataForPdf function', () => {
      expect(typeof ReconciliationReportService.getReportDataForPdf).toBe('function');
    });

    it('should export getReconciledPairs function', () => {
      expect(typeof ReconciliationReportService.getReconciledPairs).toBe('function');
    });

    it('should export getUnreconciledBankTransactions function', () => {
      expect(typeof ReconciliationReportService.getUnreconciledBankTransactions).toBe('function');
    });

    it('should export getExcludedTransactions function', () => {
      expect(typeof ReconciliationReportService.getExcludedTransactions).toBe('function');
    });

    it('should export calculateReportBalances function', () => {
      expect(typeof ReconciliationReportService.calculateReportBalances).toBe('function');
    });

    it('should export getReportSummary function', () => {
      expect(typeof ReconciliationReportService.getReportSummary).toBe('function');
    });

    it('should export validateReportRequest function', () => {
      expect(typeof ReconciliationReportService.validateReportRequest).toBe('function');
    });
  });
});
