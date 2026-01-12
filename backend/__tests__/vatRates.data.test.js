/**
 * Unit Tests for VAT Rates Data Module
 */

const {
  vatRates,
  vatThresholds,
  getAllVatRates,
  getAllVatRatesMultilingual,
  getVatRateById,
  getVatRateByCode,
  getActiveVatRates,
  getVatThresholds,
  searchVatRatesByExample,
  supportedLanguages
} = require('../data/vatRates');

describe('VAT Rates Data', () => {
  describe('vatRates constant', () => {
    it('should contain all 5 UK VAT rate types', () => {
      expect(vatRates).toHaveLength(5);
    });

    it('should have correct rate IDs', () => {
      const ids = vatRates.map(r => r.id);
      expect(ids).toContain('standard');
      expect(ids).toContain('reduced');
      expect(ids).toContain('zero');
      expect(ids).toContain('exempt');
      expect(ids).toContain('outside-scope');
    });

    it('should have correct rate codes', () => {
      const codes = vatRates.map(r => r.code);
      expect(codes).toContain('S');
      expect(codes).toContain('R');
      expect(codes).toContain('Z');
      expect(codes).toContain('E');
      expect(codes).toContain('O');
    });

    it('should have standard rate at 20%', () => {
      const standard = vatRates.find(r => r.id === 'standard');
      expect(standard.rate).toBe(20);
    });

    it('should have reduced rate at 5%', () => {
      const reduced = vatRates.find(r => r.id === 'reduced');
      expect(reduced.rate).toBe(5);
    });

    it('should have zero rate at 0%', () => {
      const zero = vatRates.find(r => r.id === 'zero');
      expect(zero.rate).toBe(0);
    });

    it('should have exempt rate at 0%', () => {
      const exempt = vatRates.find(r => r.id === 'exempt');
      expect(exempt.rate).toBe(0);
    });

    it('should have outside-scope rate as null', () => {
      const outsideScope = vatRates.find(r => r.id === 'outside-scope');
      expect(outsideScope.rate).toBeNull();
    });

    it('should have bilingual content for all rates', () => {
      vatRates.forEach(rate => {
        expect(rate.name).toHaveProperty('en');
        expect(rate.name).toHaveProperty('tr');
        expect(rate.description).toHaveProperty('en');
        expect(rate.description).toHaveProperty('tr');
        expect(rate.examples).toHaveProperty('en');
        expect(rate.examples).toHaveProperty('tr');
        expect(Array.isArray(rate.examples.en)).toBe(true);
        expect(Array.isArray(rate.examples.tr)).toBe(true);
      });
    });

    it('should have examples for all rates', () => {
      vatRates.forEach(rate => {
        expect(rate.examples.en.length).toBeGreaterThan(0);
        expect(rate.examples.tr.length).toBeGreaterThan(0);
      });
    });
  });

  describe('vatThresholds constant', () => {
    it('should have registration threshold of £90,000', () => {
      expect(vatThresholds.registrationThreshold.amount).toBe(90000);
      expect(vatThresholds.registrationThreshold.currency).toBe('GBP');
    });

    it('should have deregistration threshold of £88,000', () => {
      expect(vatThresholds.deregistrationThreshold.amount).toBe(88000);
      expect(vatThresholds.deregistrationThreshold.currency).toBe('GBP');
    });

    it('should have flat rate scheme with £150,000 limit', () => {
      expect(vatThresholds.flatRateScheme.turnoverLimit).toBe(150000);
    });

    it('should have bilingual descriptions', () => {
      expect(vatThresholds.registrationThreshold.description).toHaveProperty('en');
      expect(vatThresholds.registrationThreshold.description).toHaveProperty('tr');
      expect(vatThresholds.deregistrationThreshold.description).toHaveProperty('en');
      expect(vatThresholds.deregistrationThreshold.description).toHaveProperty('tr');
    });
  });

  describe('getAllVatRates', () => {
    it('should return all rates in English by default', () => {
      const rates = getAllVatRates();
      expect(rates).toHaveLength(5);
      rates.forEach(rate => {
        expect(typeof rate.name).toBe('string');
        expect(typeof rate.description).toBe('string');
        expect(Array.isArray(rate.examples)).toBe(true);
      });
    });

    it('should return all rates in Turkish when specified', () => {
      const rates = getAllVatRates('tr');
      expect(rates).toHaveLength(5);
      const standard = rates.find(r => r.id === 'standard');
      expect(standard.name).toBe('Standart Oran');
    });

    it('should default to English for invalid language', () => {
      const rates = getAllVatRates('invalid');
      const standard = rates.find(r => r.id === 'standard');
      expect(standard.name).toBe('Standard Rate');
    });
  });

  describe('getAllVatRatesMultilingual', () => {
    it('should return all rates with all language data', () => {
      const rates = getAllVatRatesMultilingual();
      expect(rates).toHaveLength(5);
      rates.forEach(rate => {
        expect(rate.name).toHaveProperty('en');
        expect(rate.name).toHaveProperty('tr');
      });
    });
  });

  describe('getVatRateById', () => {
    it('should return standard rate by ID', () => {
      const rate = getVatRateById('standard');
      expect(rate).not.toBeNull();
      expect(rate.code).toBe('S');
      expect(rate.rate).toBe(20);
    });

    it('should return rate in Turkish', () => {
      const rate = getVatRateById('standard', 'tr');
      expect(rate.name).toBe('Standart Oran');
    });

    it('should return null for non-existent ID', () => {
      const rate = getVatRateById('non-existent');
      expect(rate).toBeNull();
    });
  });

  describe('getVatRateByCode', () => {
    it('should return standard rate by code S', () => {
      const rate = getVatRateByCode('S');
      expect(rate).not.toBeNull();
      expect(rate.id).toBe('standard');
      expect(rate.rate).toBe(20);
    });

    it('should return rate by lowercase code', () => {
      const rate = getVatRateByCode('r');
      expect(rate).not.toBeNull();
      expect(rate.id).toBe('reduced');
    });

    it('should return null for non-existent code', () => {
      const rate = getVatRateByCode('X');
      expect(rate).toBeNull();
    });
  });

  describe('getActiveVatRates', () => {
    it('should return only active rates', () => {
      const rates = getActiveVatRates();
      rates.forEach(rate => {
        expect(rate.isActive).toBe(true);
      });
    });

    it('should support language parameter', () => {
      const rates = getActiveVatRates('tr');
      const standard = rates.find(r => r.id === 'standard');
      expect(standard.name).toBe('Standart Oran');
    });
  });

  describe('getVatThresholds', () => {
    it('should return thresholds in English by default', () => {
      const thresholds = getVatThresholds();
      expect(thresholds.registrationThreshold.amount).toBe(90000);
      expect(typeof thresholds.registrationThreshold.description).toBe('string');
    });

    it('should return thresholds in Turkish', () => {
      const thresholds = getVatThresholds('tr');
      expect(thresholds.registrationThreshold.description).toContain('KDV');
    });
  });

  describe('searchVatRatesByExample', () => {
    it('should find rates with matching examples', () => {
      const results = searchVatRatesByExample('food');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.matchingExamples.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for no matches', () => {
      const results = searchVatRatesByExample('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('should be case insensitive', () => {
      const results1 = searchVatRatesByExample('FOOD');
      const results2 = searchVatRatesByExample('food');
      expect(results1.length).toBe(results2.length);
    });

    it('should work with Turkish language', () => {
      const results = searchVatRatesByExample('gıda', 'tr');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('supportedLanguages', () => {
    it('should include English and Turkish', () => {
      expect(supportedLanguages).toContain('en');
      expect(supportedLanguages).toContain('tr');
    });
  });
});
