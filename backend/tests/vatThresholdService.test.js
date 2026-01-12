/**
 * Unit Tests for VAT Threshold Service
 * 
 * Tests the VAT registration threshold monitoring service including:
 * - Rolling 12-month turnover calculation
 * - Warning level determination
 * - Dashboard summary generation
 */

const {
  getVatThresholdStatus,
  getDashboardSummary,
  calculateRolling12MonthTurnover,
  calculateProjected30DayTurnover,
  getRolling12MonthRange,
  getVatThresholdConfig,
  determineWarningLevel,
  getWarningMessage,
  formatCurrency,
  WARNING_LEVELS
} = require('../services/vatThresholdService');

// Mock the database module
jest.mock('../database/index', () => ({
  query: jest.fn(),
  queryOne: jest.fn()
}));

// Mock the tax rates module
jest.mock('../config/taxRates', () => ({
  getCurrentTaxRates: jest.fn(() => ({
    vat: {
      thresholds: {
        registration: { amount: 90000 },
        deregistration: { amount: 88000 }
      },
      warningLevels: {
        approaching: { 
          percentage: 0.75,
          description: {
            en: 'Approaching VAT threshold',
            tr: 'KDV eşiğine yaklaşıyorsunuz'
          }
        },
        imminent: { 
          percentage: 0.90,
          description: {
            en: 'VAT registration imminent',
            tr: 'KDV kaydı yakın'
          }
        },
        exceeded: { 
          percentage: 1.00,
          description: {
            en: 'VAT threshold exceeded',
            tr: 'KDV eşiği aşıldı'
          }
        }
      }
    }
  }))
}));

const { query, queryOne } = require('../database/index');

describe('VAT Threshold Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRolling12MonthRange', () => {
    it('should return correct date range for a given date', () => {
      const result = getRolling12MonthRange(new Date('2025-06-15'));
      
      expect(result.startDate).toBe('2024-06-16');
      expect(result.endDate).toBe('2025-06-15');
    });

    it('should use current date when no date provided', () => {
      const result = getRolling12MonthRange();
      
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      
      // End date should be today
      const today = new Date();
      const endDate = new Date(result.endDate);
      expect(endDate.toDateString()).toBe(today.toDateString());
    });

    it('should handle string date input', () => {
      const result = getRolling12MonthRange('2025-12-31');
      
      expect(result.startDate).toBe('2025-01-01');
      expect(result.endDate).toBe('2025-12-31');
    });
  });

  describe('getVatThresholdConfig', () => {
    it('should return VAT threshold configuration', () => {
      const config = getVatThresholdConfig();
      
      expect(config.registrationThreshold).toBe(90000);
      expect(config.deregistrationThreshold).toBe(88000);
      expect(config.warningLevels).toBeDefined();
      expect(config.warningLevels.approaching.percentage).toBe(0.75);
      expect(config.warningLevels.imminent.percentage).toBe(0.90);
      expect(config.warningLevels.exceeded.percentage).toBe(1.00);
    });
  });

  describe('determineWarningLevel', () => {
    const warningLevels = {
      approaching: { percentage: 0.75 },
      imminent: { percentage: 0.90 },
      exceeded: { percentage: 1.00 }
    };

    it('should return NONE for turnover below 75% of threshold', () => {
      // 50% of £90,000 = £45,000 = 4,500,000 pence
      const result = determineWarningLevel(4500000, 90000, warningLevels);
      
      expect(result.level).toBe(WARNING_LEVELS.NONE);
      expect(result.percentage).toBe(50);
    });

    it('should return APPROACHING for turnover between 75% and 90%', () => {
      // 80% of £90,000 = £72,000 = 7,200,000 pence
      const result = determineWarningLevel(7200000, 90000, warningLevels);
      
      expect(result.level).toBe(WARNING_LEVELS.APPROACHING);
      expect(result.percentage).toBe(80);
    });

    it('should return IMMINENT for turnover between 90% and 100%', () => {
      // 95% of £90,000 = £85,500 = 8,550,000 pence
      const result = determineWarningLevel(8550000, 90000, warningLevels);
      
      expect(result.level).toBe(WARNING_LEVELS.IMMINENT);
      expect(result.percentage).toBe(95);
    });

    it('should return EXCEEDED for turnover at or above 100%', () => {
      // 100% of £90,000 = £90,000 = 9,000,000 pence
      const result = determineWarningLevel(9000000, 90000, warningLevels);
      
      expect(result.level).toBe(WARNING_LEVELS.EXCEEDED);
      expect(result.percentage).toBe(100);
    });

    it('should return EXCEEDED for turnover above 100%', () => {
      // 120% of £90,000 = £108,000 = 10,800,000 pence
      const result = determineWarningLevel(10800000, 90000, warningLevels);
      
      expect(result.level).toBe(WARNING_LEVELS.EXCEEDED);
      expect(result.percentage).toBe(120);
    });

    it('should calculate remaining until threshold correctly', () => {
      // £50,000 turnover = 5,000,000 pence
      // Remaining = £90,000 - £50,000 = £40,000 = 4,000,000 pence
      const result = determineWarningLevel(5000000, 90000, warningLevels);
      
      expect(result.remainingUntilThreshold).toBe(4000000);
    });

    it('should return 0 remaining when threshold exceeded', () => {
      const result = determineWarningLevel(10000000, 90000, warningLevels);
      
      expect(result.remainingUntilThreshold).toBe(0);
    });
  });

  describe('getWarningMessage', () => {
    const config = {
      warningLevels: {
        approaching: { 
          description: { 
            en: 'Approaching threshold', 
            tr: 'Eşiğe yaklaşılıyor' 
          } 
        },
        imminent: { 
          description: { 
            en: 'Imminent registration', 
            tr: 'Yakın kayıt' 
          } 
        },
        exceeded: { 
          description: { 
            en: 'Threshold exceeded', 
            tr: 'Eşik aşıldı' 
          } 
        }
      }
    };

    it('should return null for NONE level', () => {
      const result = getWarningMessage(WARNING_LEVELS.NONE, config, 'en');
      expect(result).toBeNull();
    });

    it('should return English message for APPROACHING level', () => {
      const result = getWarningMessage(WARNING_LEVELS.APPROACHING, config, 'en');
      expect(result).toBe('Approaching threshold');
    });

    it('should return Turkish message for IMMINENT level', () => {
      const result = getWarningMessage(WARNING_LEVELS.IMMINENT, config, 'tr');
      expect(result).toBe('Yakın kayıt');
    });

    it('should return English message for EXCEEDED level', () => {
      const result = getWarningMessage(WARNING_LEVELS.EXCEEDED, config, 'en');
      expect(result).toBe('Threshold exceeded');
    });
  });

  describe('formatCurrency', () => {
    it('should format pence as GBP currency', () => {
      const result = formatCurrency(5000000); // £50,000
      expect(result).toBe('£50,000.00');
    });

    it('should format zero correctly', () => {
      const result = formatCurrency(0);
      expect(result).toBe('£0.00');
    });

    it('should format with decimal pence', () => {
      const result = formatCurrency(1234);
      expect(result).toBe('£12.34');
    });
  });

  describe('calculateRolling12MonthTurnover', () => {
    it('should calculate turnover from income transactions', () => {
      queryOne.mockReturnValue({
        totalAmount: 5000000,
        transactionCount: 50
      });
      query.mockReturnValue([
        { month: '2024-07', amount: 400000 },
        { month: '2024-08', amount: 450000 },
        { month: '2024-09', amount: 500000 }
      ]);

      const result = calculateRolling12MonthTurnover(1);

      expect(result.turnover).toBe(5000000);
      expect(result.transactionCount).toBe(50);
      expect(result.breakdown).toHaveLength(3);
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('should return zero for users with no transactions', () => {
      queryOne.mockReturnValue({
        totalAmount: 0,
        transactionCount: 0
      });
      query.mockReturnValue([]);

      const result = calculateRolling12MonthTurnover(1);

      expect(result.turnover).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should handle null result from database', () => {
      queryOne.mockReturnValue(null);
      query.mockReturnValue([]);

      const result = calculateRolling12MonthTurnover(1);

      expect(result.turnover).toBe(0);
      expect(result.transactionCount).toBe(0);
    });
  });

  describe('calculateProjected30DayTurnover', () => {
    it('should calculate projected turnover based on past 3 months', () => {
      queryOne.mockReturnValue({
        totalAmount: 9000000, // £90,000 over ~90 days
        firstDate: '2025-03-15',
        lastDate: '2025-06-14'
      });

      const result = calculateProjected30DayTurnover(1, '2025-06-15');

      expect(result.averageDailyTurnover).toBeGreaterThan(0);
      expect(result.projectedAmount).toBeGreaterThan(0);
      expect(result.basedOnDays).toBeGreaterThan(0);
    });

    it('should return zero projection for no transactions', () => {
      queryOne.mockReturnValue({
        totalAmount: 0,
        firstDate: null,
        lastDate: null
      });

      const result = calculateProjected30DayTurnover(1);

      expect(result.averageDailyTurnover).toBe(0);
      expect(result.projectedAmount).toBe(0);
    });
  });

  describe('getVatThresholdStatus', () => {
    beforeEach(() => {
      // Default mock for turnover calculation
      queryOne.mockReturnValue({
        totalAmount: 5000000,
        transactionCount: 50
      });
      query.mockReturnValue([]);
    });

    it('should return complete status for non-VAT-registered user', () => {
      const status = getVatThresholdStatus(1, false);

      expect(status.isVatRegistered).toBe(false);
      expect(status.requiresMonitoring).toBe(true);
      expect(status.turnover).toBeDefined();
      expect(status.turnover.rolling12Month).toBeDefined();
      expect(status.projection).toBeDefined();
      expect(status.threshold).toBeDefined();
      expect(status.warning).toBeDefined();
      expect(status.calculatedAt).toBeDefined();
    });

    it('should indicate no monitoring for VAT-registered user', () => {
      const status = getVatThresholdStatus(1, true);

      expect(status.isVatRegistered).toBe(true);
      expect(status.requiresMonitoring).toBe(false);
      expect(status.warning.level).toBe(WARNING_LEVELS.NONE);
      expect(status.warning.message.en).toBeNull();
    });

    it('should include monthly breakdown', () => {
      query.mockReturnValue([
        { month: '2024-07', amount: 400000 },
        { month: '2024-08', amount: 450000 }
      ]);

      const status = getVatThresholdStatus(1, false);

      expect(status.turnover.monthlyBreakdown).toHaveLength(2);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return summary for non-warning status', () => {
      const status = {
        requiresMonitoring: true,
        turnover: { rolling12Month: 5000000 },
        threshold: { registrationAmount: 9000000 },
        warning: {
          level: WARNING_LEVELS.NONE,
          percentage: 55.56,
          remainingUntilThreshold: 4000000
        }
      };

      const summary = getDashboardSummary(status, 'en');

      expect(summary.showWarning).toBe(false);
      expect(summary.warningLevel).toBe(WARNING_LEVELS.NONE);
      expect(summary.headline).toContain('Below threshold');
      expect(summary.turnoverFormatted).toBe('£50,000.00');
      expect(summary.thresholdFormatted).toBe('£90,000.00');
    });

    it('should return warning summary for approaching status', () => {
      const status = {
        requiresMonitoring: true,
        turnover: { rolling12Month: 7200000 },
        threshold: { registrationAmount: 9000000 },
        warning: {
          level: WARNING_LEVELS.APPROACHING,
          percentage: 80,
          remainingUntilThreshold: 1800000
        }
      };

      const summary = getDashboardSummary(status, 'en');

      expect(summary.showWarning).toBe(true);
      expect(summary.warningLevel).toBe(WARNING_LEVELS.APPROACHING);
      expect(summary.headline).toContain('Approaching');
    });

    it('should return Turkish messages when lang=tr', () => {
      const status = {
        requiresMonitoring: true,
        turnover: { rolling12Month: 9000000 },
        threshold: { registrationAmount: 9000000 },
        warning: {
          level: WARNING_LEVELS.EXCEEDED,
          percentage: 100,
          remainingUntilThreshold: 0
        }
      };

      const summary = getDashboardSummary(status, 'tr');

      expect(summary.headline).toContain('Gerekli');
      expect(summary.details).toContain('KDV');
    });

    it('should not show warning for VAT-registered users', () => {
      const status = {
        requiresMonitoring: false,
        turnover: { rolling12Month: 12000000 },
        threshold: { registrationAmount: 9000000 },
        warning: {
          level: WARNING_LEVELS.NONE,
          percentage: 0,
          remainingUntilThreshold: 0
        }
      };

      const summary = getDashboardSummary(status, 'en');

      expect(summary.showWarning).toBe(false);
    });
  });

  describe('WARNING_LEVELS constants', () => {
    it('should export correct warning level values', () => {
      expect(WARNING_LEVELS.NONE).toBe('none');
      expect(WARNING_LEVELS.APPROACHING).toBe('approaching');
      expect(WARNING_LEVELS.IMMINENT).toBe('imminent');
      expect(WARNING_LEVELS.EXCEEDED).toBe('exceeded');
    });
  });
});
