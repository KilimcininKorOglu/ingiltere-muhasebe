/**
 * Unit Tests for VAT Calculator Utility
 */

const {
  calculateVatFromNet,
  calculateVatFromGross,
  calculateNetFromGross,
  calculateTransactionAmounts,
  calculateTransactionAmountsFromTotal,
  getVatRateBasisPoints,
  getVatRatePercentage,
  validateVatRate,
  validateAmount,
  percentageToBasisPoints,
  basisPointsToPercentage,
  formatVatRate,
  VAT_RATES_BASIS_POINTS,
  VALID_VAT_RATE_IDS
} = require('../utils/vatCalculator');

describe('VAT Calculator Utility', () => {
  describe('calculateVatFromNet', () => {
    it('should calculate VAT for standard rate (20%)', () => {
      // 10000 pence * 2000 basis points / 10000 = 2000 pence VAT
      expect(calculateVatFromNet(10000, 2000)).toBe(2000);
    });

    it('should calculate VAT for reduced rate (5%)', () => {
      // 10000 pence * 500 basis points / 10000 = 500 pence VAT
      expect(calculateVatFromNet(10000, 500)).toBe(500);
    });

    it('should return 0 for zero rate', () => {
      expect(calculateVatFromNet(10000, 0)).toBe(0);
    });

    it('should return 0 for negative rate', () => {
      expect(calculateVatFromNet(10000, -500)).toBe(0);
    });

    it('should return 0 for negative amount', () => {
      expect(calculateVatFromNet(-10000, 2000)).toBe(0);
    });

    it('should round to nearest pence', () => {
      // 333 pence * 2000 / 10000 = 66.6 -> rounds to 67
      expect(calculateVatFromNet(333, 2000)).toBe(67);
    });

    it('should handle non-number inputs', () => {
      expect(calculateVatFromNet('100', 2000)).toBe(0);
      expect(calculateVatFromNet(100, 'twenty')).toBe(0);
    });

    it('should handle large amounts correctly', () => {
      // 10000000 pence (£100,000) * 2000 / 10000 = 2000000 pence (£20,000)
      expect(calculateVatFromNet(10000000, 2000)).toBe(2000000);
    });
  });

  describe('calculateVatFromGross', () => {
    it('should calculate VAT from gross for standard rate (20%)', () => {
      // Gross = 12000 pence, VAT = 12000 * 2000 / 12000 = 2000 pence
      expect(calculateVatFromGross(12000, 2000)).toBe(2000);
    });

    it('should calculate VAT from gross for reduced rate (5%)', () => {
      // Gross = 10500 pence, VAT = 10500 * 500 / 10500 = 500 pence
      expect(calculateVatFromGross(10500, 500)).toBe(500);
    });

    it('should return 0 for zero rate', () => {
      expect(calculateVatFromGross(10000, 0)).toBe(0);
    });

    it('should handle non-number inputs', () => {
      expect(calculateVatFromGross('12000', 2000)).toBe(0);
    });
  });

  describe('calculateNetFromGross', () => {
    it('should calculate net from gross for standard rate', () => {
      // Gross = 12000, Net = 12000 * 10000 / 12000 = 10000
      expect(calculateNetFromGross(12000, 2000)).toBe(10000);
    });

    it('should calculate net from gross for reduced rate', () => {
      // Gross = 10500, Net = 10500 * 10000 / 10500 = 10000
      expect(calculateNetFromGross(10500, 500)).toBe(10000);
    });

    it('should return gross if rate is 0', () => {
      expect(calculateNetFromGross(10000, 0)).toBe(10000);
    });

    it('should handle non-number inputs', () => {
      expect(calculateNetFromGross('12000', 2000)).toBe(0);
    });
  });

  describe('calculateTransactionAmounts', () => {
    it('should calculate all amounts for standard rate', () => {
      const result = calculateTransactionAmounts(10000, 2000);
      
      expect(result.amount).toBe(10000);
      expect(result.vatRate).toBe(2000);
      expect(result.vatAmount).toBe(2000);
      expect(result.totalAmount).toBe(12000);
    });

    it('should calculate all amounts for zero rate', () => {
      const result = calculateTransactionAmounts(10000, 0);
      
      expect(result.amount).toBe(10000);
      expect(result.vatRate).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(10000);
    });

    it('should handle undefined inputs', () => {
      const result = calculateTransactionAmounts(undefined, undefined);
      
      expect(result.amount).toBe(0);
      expect(result.vatRate).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  describe('calculateTransactionAmountsFromTotal', () => {
    it('should calculate amounts from total for standard rate', () => {
      const result = calculateTransactionAmountsFromTotal(12000, 2000);
      
      expect(result.totalAmount).toBe(12000);
      expect(result.vatRate).toBe(2000);
      expect(result.vatAmount).toBe(2000);
      expect(result.amount).toBe(10000);
    });

    it('should calculate amounts from total for zero rate', () => {
      const result = calculateTransactionAmountsFromTotal(10000, 0);
      
      expect(result.totalAmount).toBe(10000);
      expect(result.vatAmount).toBe(0);
      expect(result.amount).toBe(10000);
    });
  });

  describe('getVatRateBasisPoints', () => {
    it('should return correct basis points for string identifiers', () => {
      expect(getVatRateBasisPoints('standard')).toBe(2000);
      expect(getVatRateBasisPoints('reduced')).toBe(500);
      expect(getVatRateBasisPoints('zero')).toBe(0);
      expect(getVatRateBasisPoints('exempt')).toBe(0);
      expect(getVatRateBasisPoints('outside-scope')).toBe(0);
    });

    it('should return the number if already in valid range', () => {
      expect(getVatRateBasisPoints(2000)).toBe(2000);
      expect(getVatRateBasisPoints(500)).toBe(500);
    });

    it('should return 0 for invalid numbers', () => {
      expect(getVatRateBasisPoints(15000)).toBe(0);
      expect(getVatRateBasisPoints(-100)).toBe(0);
    });

    it('should return standard rate for invalid strings', () => {
      expect(getVatRateBasisPoints('invalid')).toBe(2000);
    });
  });

  describe('getVatRatePercentage', () => {
    it('should return correct percentages for string identifiers', () => {
      expect(getVatRatePercentage('standard')).toBe(20);
      expect(getVatRatePercentage('reduced')).toBe(5);
      expect(getVatRatePercentage('zero')).toBe(0);
    });

    it('should convert basis points to percentage for numbers', () => {
      expect(getVatRatePercentage(2000)).toBe(20);
      expect(getVatRatePercentage(500)).toBe(5);
    });

    it('should return null for outside-scope', () => {
      expect(getVatRatePercentage('outside-scope')).toBe(null);
    });

    it('should return null for invalid string', () => {
      expect(getVatRatePercentage('invalid')).toBe(null);
    });
  });

  describe('validateVatRate', () => {
    it('should return valid for correct rates', () => {
      expect(validateVatRate(2000).isValid).toBe(true);
      expect(validateVatRate(0).isValid).toBe(true);
      expect(validateVatRate(10000).isValid).toBe(true);
    });

    it('should return error for non-number', () => {
      const result = validateVatRate('2000');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('VAT rate must be a number');
    });

    it('should return error for non-integer', () => {
      const result = validateVatRate(20.5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('VAT rate must be an integer (in basis points)');
    });

    it('should return error for out of range', () => {
      expect(validateVatRate(-100).isValid).toBe(false);
      expect(validateVatRate(15000).isValid).toBe(false);
    });
  });

  describe('validateAmount', () => {
    it('should return valid for correct amounts', () => {
      expect(validateAmount(10000).isValid).toBe(true);
      expect(validateAmount(0).isValid).toBe(true);
    });

    it('should return valid for undefined', () => {
      expect(validateAmount(undefined).isValid).toBe(true);
      expect(validateAmount(null).isValid).toBe(true);
    });

    it('should return error for non-number', () => {
      const result = validateAmount('10000', 'amount');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('amount must be a number');
    });

    it('should return error for negative', () => {
      const result = validateAmount(-100, 'amount');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('amount cannot be negative');
    });
  });

  describe('percentageToBasisPoints', () => {
    it('should convert percentage to basis points', () => {
      expect(percentageToBasisPoints(20)).toBe(2000);
      expect(percentageToBasisPoints(5)).toBe(500);
      expect(percentageToBasisPoints(0)).toBe(0);
    });

    it('should handle non-numbers', () => {
      expect(percentageToBasisPoints('20')).toBe(0);
    });

    it('should round correctly', () => {
      expect(percentageToBasisPoints(12.5)).toBe(1250);
    });
  });

  describe('basisPointsToPercentage', () => {
    it('should convert basis points to percentage', () => {
      expect(basisPointsToPercentage(2000)).toBe(20);
      expect(basisPointsToPercentage(500)).toBe(5);
      expect(basisPointsToPercentage(0)).toBe(0);
    });

    it('should handle non-numbers', () => {
      expect(basisPointsToPercentage('2000')).toBe(0);
    });
  });

  describe('formatVatRate', () => {
    it('should format VAT rate correctly', () => {
      expect(formatVatRate(2000)).toBe('20%');
      expect(formatVatRate(500)).toBe('5%');
      expect(formatVatRate(0)).toBe('0%');
    });
  });

  describe('Constants', () => {
    it('should have correct VAT rates in basis points', () => {
      expect(VAT_RATES_BASIS_POINTS.standard).toBe(2000);
      expect(VAT_RATES_BASIS_POINTS.reduced).toBe(500);
      expect(VAT_RATES_BASIS_POINTS.zero).toBe(0);
      expect(VAT_RATES_BASIS_POINTS.exempt).toBe(0);
      expect(VAT_RATES_BASIS_POINTS['outside-scope']).toBe(0);
    });

    it('should have all valid VAT rate IDs', () => {
      expect(VALID_VAT_RATE_IDS).toContain('standard');
      expect(VALID_VAT_RATE_IDS).toContain('reduced');
      expect(VALID_VAT_RATE_IDS).toContain('zero');
      expect(VALID_VAT_RATE_IDS).toContain('exempt');
      expect(VALID_VAT_RATE_IDS).toContain('outside-scope');
    });
  });
});
