import { describe, it, expect, beforeEach } from 'vitest';
import {
  WarningService,
  warningService,
  WARNING_SEVERITY,
  WARNING_CATEGORY,
  UK_TAX_THRESHOLDS,
  patternDetectors,
  complianceCheckers,
} from '../../services/warningService';

describe('warningService', () => {
  let service;

  beforeEach(() => {
    service = new WarningService();
  });

  describe('WarningService', () => {
    it('should add and retrieve warnings', () => {
      service.addWarning({
        id: 'test-1',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      const warnings = service.getActiveWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].id).toBe('test-1');
    });

    it('should not add warnings without id', () => {
      service.addWarning({
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
      });

      expect(service.getActiveWarnings()).toHaveLength(0);
    });

    it('should remove warnings', () => {
      service.addWarning({
        id: 'test-1',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      service.removeWarning('test-1');
      expect(service.getActiveWarnings()).toHaveLength(0);
    });

    it('should dismiss warnings', () => {
      service.addWarning({
        id: 'test-1',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
        dismissible: true,
      });

      service.dismissWarning('test-1');
      expect(service.getActiveWarnings()).toHaveLength(0);
    });

    it('should not dismiss non-dismissible warnings', () => {
      service.addWarning({
        id: 'test-1',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'test.message',
        dismissible: false,
      });

      service.dismissWarning('test-1');
      expect(service.getActiveWarnings()).toHaveLength(1);
    });

    it('should sort warnings by severity', () => {
      service.addWarning({
        id: 'info',
        severity: WARNING_SEVERITY.INFO,
        messageKey: 'test.info',
      });

      service.addWarning({
        id: 'critical',
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'test.critical',
      });

      service.addWarning({
        id: 'warning',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.warning',
      });

      const warnings = service.getActiveWarnings();
      expect(warnings[0].id).toBe('critical');
      expect(warnings[1].id).toBe('warning');
      expect(warnings[2].id).toBe('info');
    });

    it('should filter warnings by category', () => {
      service.addWarning({
        id: 'compliance-1',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      service.addWarning({
        id: 'tax-1',
        category: WARNING_CATEGORY.TAX,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      const complianceWarnings = service.getWarningsByCategory(WARNING_CATEGORY.COMPLIANCE);
      expect(complianceWarnings).toHaveLength(1);
      expect(complianceWarnings[0].id).toBe('compliance-1');
    });

    it('should filter warnings by severity', () => {
      service.addWarning({
        id: 'warning-1',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      service.addWarning({
        id: 'error-1',
        severity: WARNING_SEVERITY.ERROR,
        messageKey: 'test.message',
      });

      const errorWarnings = service.getWarningsBySeverity(WARNING_SEVERITY.ERROR);
      expect(errorWarnings).toHaveLength(1);
      expect(errorWarnings[0].id).toBe('error-1');
    });

    it('should get warning counts', () => {
      service.addWarning({
        id: 'critical-1',
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'test.message',
      });

      service.addWarning({
        id: 'warning-1',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      service.addWarning({
        id: 'warning-2',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      const counts = service.getWarningCounts();
      expect(counts[WARNING_SEVERITY.CRITICAL]).toBe(1);
      expect(counts[WARNING_SEVERITY.WARNING]).toBe(2);
      expect(counts.total).toBe(3);
    });

    it('should check for critical warnings', () => {
      expect(service.hasCriticalWarnings()).toBe(false);

      service.addWarning({
        id: 'critical-1',
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'test.message',
      });

      expect(service.hasCriticalWarnings()).toBe(true);
    });

    it('should notify subscribers', () => {
      let notifiedWarnings = null;

      const unsubscribe = service.subscribe((warnings) => {
        notifiedWarnings = warnings;
      });

      service.addWarning({
        id: 'test-1',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      expect(notifiedWarnings).toHaveLength(1);

      unsubscribe();

      service.addWarning({
        id: 'test-2',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      // Should still have length 1 since subscriber was removed
      expect(notifiedWarnings).toHaveLength(1);
    });

    it('should clear all warnings', () => {
      service.addWarning({
        id: 'test-1',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      service.addWarning({
        id: 'test-2',
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'test.message',
      });

      service.clearAll();
      expect(service.getActiveWarnings()).toHaveLength(0);
    });
  });

  describe('patternDetectors', () => {
    describe('unusualExpense', () => {
      it('should detect unusually high expenses', () => {
        const expense = { amount: 1000 };
        const previousExpenses = [
          { amount: 50 },
          { amount: 60 },
          { amount: 55 },
          { amount: 45 },
          { amount: 70 },
        ];

        const warning = patternDetectors.unusualExpense(expense, previousExpenses);
        expect(warning).not.toBeNull();
        expect(warning.category).toBe(WARNING_CATEGORY.PATTERN);
      });

      it('should not flag normal expenses', () => {
        const expense = { amount: 55 };
        const previousExpenses = [
          { amount: 50 },
          { amount: 60 },
          { amount: 55 },
          { amount: 45 },
          { amount: 70 },
        ];

        const warning = patternDetectors.unusualExpense(expense, previousExpenses);
        expect(warning).toBeNull();
      });
    });

    describe('duplicateEntry', () => {
      it('should detect duplicate entries', () => {
        const entry = {
          id: '2',
          amount: 100,
          date: '2024-01-15',
          description: 'Office supplies',
        };

        const existingEntries = [
          {
            id: '1',
            amount: 100,
            date: '2024-01-15',
            description: 'Office supplies',
          },
        ];

        const warning = patternDetectors.duplicateEntry(entry, existingEntries);
        expect(warning).not.toBeNull();
        expect(warning.category).toBe(WARNING_CATEGORY.DATA_QUALITY);
      });
    });

    describe('roundNumberExpense', () => {
      it('should flag round number expenses', () => {
        const warning = patternDetectors.roundNumberExpense({ amount: 500 });
        expect(warning).not.toBeNull();
        expect(warning.severity).toBe(WARNING_SEVERITY.INFO);
      });

      it('should not flag non-round expenses', () => {
        const warning = patternDetectors.roundNumberExpense({ amount: 123.45 });
        expect(warning).toBeNull();
      });
    });

    describe('weekendTransaction', () => {
      it('should flag weekend transactions', () => {
        // A known Saturday
        const warning = patternDetectors.weekendTransaction({ date: '2024-01-13' });
        expect(warning).not.toBeNull();
      });

      it('should not flag weekday transactions', () => {
        // A known Monday
        const warning = patternDetectors.weekendTransaction({ date: '2024-01-15' });
        expect(warning).toBeNull();
      });
    });
  });

  describe('complianceCheckers', () => {
    describe('vatRegistration', () => {
      it('should require VAT registration when over threshold', () => {
        const warning = complianceCheckers.vatRegistration(
          UK_TAX_THRESHOLDS.vatRegistrationThreshold + 1,
          false
        );

        expect(warning).not.toBeNull();
        expect(warning.severity).toBe(WARNING_SEVERITY.CRITICAL);
      });

      it('should warn when approaching threshold', () => {
        const warning = complianceCheckers.vatRegistration(
          UK_TAX_THRESHOLDS.vatRegistrationThreshold * 0.92,
          false
        );

        expect(warning).not.toBeNull();
        expect(warning.severity).toBe(WARNING_SEVERITY.WARNING);
      });

      it('should not warn if already registered', () => {
        const warning = complianceCheckers.vatRegistration(
          UK_TAX_THRESHOLDS.vatRegistrationThreshold + 1,
          true
        );

        expect(warning).toBeNull();
      });
    });

    describe('missingReceipt', () => {
      it('should warn for expenses over £25 without receipt', () => {
        const warning = complianceCheckers.missingReceipt({
          id: '1',
          amount: 50,
          hasReceipt: false,
        });

        expect(warning).not.toBeNull();
        expect(warning.severity).toBe(WARNING_SEVERITY.WARNING);
      });

      it('should not warn for small expenses without receipt', () => {
        const warning = complianceCheckers.missingReceipt({
          id: '1',
          amount: 20,
          hasReceipt: false,
        });

        expect(warning).toBeNull();
      });
    });

    describe('personalAllowanceReduction', () => {
      it('should calculate reduction for income over £100,000', () => {
        const warning = complianceCheckers.personalAllowanceReduction(120000);

        expect(warning).not.toBeNull();
        expect(warning.params.reduction).toBe(10000);
        expect(warning.params.effectiveAllowance).toBe(
          UK_TAX_THRESHOLDS.personalAllowance - 10000
        );
      });

      it('should not warn for income under £100,000', () => {
        const warning = complianceCheckers.personalAllowanceReduction(80000);
        expect(warning).toBeNull();
      });
    });
  });

  describe('singleton warningService', () => {
    it('should be an instance of WarningService', () => {
      expect(warningService).toBeInstanceOf(WarningService);
    });
  });

  describe('UK_TAX_THRESHOLDS', () => {
    it('should have correct VAT registration threshold', () => {
      expect(UK_TAX_THRESHOLDS.vatRegistrationThreshold).toBe(90000);
    });

    it('should have correct personal allowance', () => {
      expect(UK_TAX_THRESHOLDS.personalAllowance).toBe(12570);
    });
  });
});
