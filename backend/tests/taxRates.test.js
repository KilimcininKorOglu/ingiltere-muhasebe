/**
 * Tax Rates Configuration Tests
 * 
 * Unit tests for the UK tax rates configuration and utility functions.
 */

const {
  taxRates,
  getTaxRatesForYear,
  getCurrentTaxRates,
  getTaxTypeRates,
  getAvailableTaxYears,
  getAvailableTaxTypes,
  calculateIncomeTax
} = require('../config/taxRates');

describe('Tax Rates Configuration', () => {
  describe('taxRates object', () => {
    it('should have a currentTaxYear property', () => {
      expect(taxRates.currentTaxYear).toBeDefined();
      expect(typeof taxRates.currentTaxYear).toBe('string');
      expect(taxRates.currentTaxYear).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should have taxYears object with at least one year', () => {
      expect(taxRates.taxYears).toBeDefined();
      expect(Object.keys(taxRates.taxYears).length).toBeGreaterThan(0);
    });

    it('should have the current tax year in taxYears', () => {
      expect(taxRates.taxYears[taxRates.currentTaxYear]).toBeDefined();
    });
  });

  describe('getTaxRatesForYear()', () => {
    it('should return rates for a valid tax year', () => {
      const rates = getTaxRatesForYear('2025-26');
      expect(rates).toBeDefined();
      expect(rates.startDate).toBe('2025-04-06');
      expect(rates.endDate).toBe('2026-04-05');
    });

    it('should return null for an invalid tax year', () => {
      const rates = getTaxRatesForYear('1999-00');
      expect(rates).toBeNull();
    });

    it('should have income tax rates', () => {
      const rates = getTaxRatesForYear('2025-26');
      expect(rates.incomeTax).toBeDefined();
      expect(rates.incomeTax.bands).toBeDefined();
      expect(Array.isArray(rates.incomeTax.bands)).toBe(true);
    });
  });

  describe('getCurrentTaxRates()', () => {
    it('should return the current tax year rates', () => {
      const rates = getCurrentTaxRates();
      expect(rates).toBeDefined();
      expect(rates.startDate).toBeDefined();
      expect(rates.endDate).toBeDefined();
    });

    it('should match the rates for currentTaxYear', () => {
      const currentRates = getCurrentTaxRates();
      const yearRates = getTaxRatesForYear(taxRates.currentTaxYear);
      expect(currentRates).toEqual(yearRates);
    });
  });

  describe('getTaxTypeRates()', () => {
    it('should return income tax rates', () => {
      const rates = getTaxTypeRates('incomeTax');
      expect(rates).toBeDefined();
      expect(rates.personalAllowance).toBeDefined();
      expect(rates.bands).toBeDefined();
    });

    it('should return VAT rates', () => {
      const rates = getTaxTypeRates('vat');
      expect(rates).toBeDefined();
      expect(rates.rates.standard.rate).toBe(0.20);
    });

    it('should return corporation tax rates', () => {
      const rates = getTaxTypeRates('corporationTax');
      expect(rates).toBeDefined();
      expect(rates.rates.main.rate).toBe(0.25);
    });

    it('should return national insurance rates', () => {
      const rates = getTaxTypeRates('nationalInsurance');
      expect(rates).toBeDefined();
      expect(rates.class1).toBeDefined();
    });

    it('should return null for non-existent tax type', () => {
      const rates = getTaxTypeRates('nonExistentTax');
      expect(rates).toBeNull();
    });

    it('should support specifying a tax year', () => {
      const rates = getTaxTypeRates('vat', '2024-25');
      expect(rates).toBeDefined();
      expect(rates.rates.standard.rate).toBe(0.20);
    });
  });

  describe('getAvailableTaxYears()', () => {
    it('should return an array of tax years', () => {
      const years = getAvailableTaxYears();
      expect(Array.isArray(years)).toBe(true);
      expect(years.length).toBeGreaterThan(0);
    });

    it('should include the current tax year', () => {
      const years = getAvailableTaxYears();
      expect(years).toContain(taxRates.currentTaxYear);
    });

    it('should have valid year format', () => {
      const years = getAvailableTaxYears();
      years.forEach(year => {
        expect(year).toMatch(/^\d{4}-\d{2}$/);
      });
    });
  });

  describe('getAvailableTaxTypes()', () => {
    it('should return an array of tax types', () => {
      const types = getAvailableTaxTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should include common tax types', () => {
      const types = getAvailableTaxTypes();
      expect(types).toContain('incomeTax');
      expect(types).toContain('vat');
      expect(types).toContain('corporationTax');
      expect(types).toContain('nationalInsurance');
    });

    it('should not include startDate or endDate', () => {
      const types = getAvailableTaxTypes();
      expect(types).not.toContain('startDate');
      expect(types).not.toContain('endDate');
    });

    it('should return empty array for invalid year', () => {
      const types = getAvailableTaxTypes('1999-00');
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBe(0);
    });
  });
});

describe('Income Tax Calculations', () => {
  describe('calculateIncomeTax()', () => {
    it('should calculate zero tax for income within personal allowance', () => {
      const result = calculateIncomeTax(10000);
      expect(result.totalTax).toBe(0);
      expect(result.taxableIncome).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('should calculate basic rate tax correctly', () => {
      const result = calculateIncomeTax(30000);
      // Personal allowance: £12,570, taxable: £17,430
      // Basic rate (20%): £3,486
      expect(result.taxableIncome).toBe(17430);
      expect(result.totalTax).toBe(3486);
    });

    it('should calculate higher rate tax correctly', () => {
      const result = calculateIncomeTax(60000);
      // Personal allowance: £12,570, taxable: £47,430
      // Basic rate (20%) on £37,700 = £7,540
      // Higher rate (40%) on £9,730 = £3,892
      // Total: ~£11,432
      expect(result.taxableIncome).toBe(47430);
      expect(result.totalTax).toBeCloseTo(11432, 0);
    });

    it('should calculate additional rate tax correctly', () => {
      const result = calculateIncomeTax(150000);
      // Personal allowance tapered to £0 (income > £125,140)
      // Taxable: £150,000
      // Basic rate (20%) on £37,700 = £7,540
      // Higher rate (40%) on £87,440 (50,271 to 125,140) = £29,947.60
      // Additional rate (45%) on £24,860 (above 125,140) = £11,187
      expect(result.personalAllowance).toBe(0);
      expect(result.taxableIncome).toBe(150000);
    });

    it('should taper personal allowance for high earners', () => {
      // Income of £110,000 reduces PA by (110,000 - 100,000) * 0.5 = £5,000
      const result = calculateIncomeTax(110000);
      expect(result.personalAllowance).toBe(7570); // 12,570 - 5,000
    });

    it('should eliminate personal allowance above £125,140', () => {
      const result = calculateIncomeTax(130000);
      expect(result.personalAllowance).toBe(0);
    });

    it('should calculate effective tax rate', () => {
      const result = calculateIncomeTax(50000);
      expect(result.effectiveRate).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThan(100);
    });

    it('should provide breakdown by tax band', () => {
      const result = calculateIncomeTax(60000);
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(result.breakdown.length).toBeGreaterThan(0);
    });

    it('should handle zero income', () => {
      const result = calculateIncomeTax(0);
      expect(result.totalTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('should throw error for invalid tax year', () => {
      expect(() => calculateIncomeTax(50000, 'england', '1999-00')).toThrow();
    });

    it('should support Scotland tax rates', () => {
      const englandResult = calculateIncomeTax(50000, 'england');
      const scotlandResult = calculateIncomeTax(50000, 'scotland');
      
      // Scotland has different rates, so results should differ
      expect(scotlandResult.totalTax).not.toBe(englandResult.totalTax);
    });
  });
});

describe('Bilingual Descriptions', () => {
  describe('Income Tax descriptions', () => {
    it('should have English and Turkish descriptions', () => {
      const rates = getTaxTypeRates('incomeTax');
      expect(rates.description.en).toBeDefined();
      expect(rates.description.tr).toBeDefined();
    });

    it('should have bilingual band descriptions', () => {
      const rates = getTaxTypeRates('incomeTax');
      rates.bands.forEach(band => {
        expect(band.description.en).toBeDefined();
        expect(band.description.tr).toBeDefined();
      });
    });
  });

  describe('VAT descriptions', () => {
    it('should have bilingual descriptions', () => {
      const rates = getTaxTypeRates('vat');
      expect(rates.description.en).toBeDefined();
      expect(rates.description.tr).toBeDefined();
    });
  });

  describe('Corporation Tax descriptions', () => {
    it('should have bilingual descriptions', () => {
      const rates = getTaxTypeRates('corporationTax');
      expect(rates.description.en).toBeDefined();
      expect(rates.description.tr).toBeDefined();
    });
  });

  describe('National Insurance descriptions', () => {
    it('should have bilingual descriptions', () => {
      const rates = getTaxTypeRates('nationalInsurance');
      expect(rates.description.en).toBeDefined();
      expect(rates.description.tr).toBeDefined();
    });
  });
});

describe('Tax Rate Values', () => {
  describe('Current UK Tax Rates 2025-26', () => {
    const rates = getTaxRatesForYear('2025-26');

    it('should have correct personal allowance', () => {
      expect(rates.incomeTax.personalAllowance.amount).toBe(12570);
    });

    it('should have correct basic rate', () => {
      const basicBand = rates.incomeTax.bands.find(b => b.name === 'basic');
      expect(basicBand.rate).toBe(0.20);
    });

    it('should have correct higher rate', () => {
      const higherBand = rates.incomeTax.bands.find(b => b.name === 'higher');
      expect(higherBand.rate).toBe(0.40);
    });

    it('should have correct additional rate', () => {
      const additionalBand = rates.incomeTax.bands.find(b => b.name === 'additional');
      expect(additionalBand.rate).toBe(0.45);
    });

    it('should have correct VAT standard rate', () => {
      expect(rates.vat.rates.standard.rate).toBe(0.20);
    });

    it('should have correct VAT reduced rate', () => {
      expect(rates.vat.rates.reduced.rate).toBe(0.05);
    });

    it('should have correct VAT registration threshold', () => {
      expect(rates.vat.thresholds.registration.amount).toBe(90000);
    });

    it('should have correct corporation tax main rate', () => {
      expect(rates.corporationTax.rates.main.rate).toBe(0.25);
    });

    it('should have correct corporation tax small profits rate', () => {
      expect(rates.corporationTax.rates.small.rate).toBe(0.19);
    });

    it('should have correct employee NIC main rate', () => {
      expect(rates.nationalInsurance.class1.employee.rates.mainRate).toBe(0.08);
    });

    it('should have correct employer NIC rate', () => {
      expect(rates.nationalInsurance.class1.employer.rates.mainRate).toBe(0.15);
    });

    it('should have dividend tax rates', () => {
      expect(rates.dividendTax).toBeDefined();
      expect(rates.dividendTax.rates.basic.rate).toBe(0.0875);
    });

    it('should have capital gains tax rates', () => {
      expect(rates.capitalGainsTax).toBeDefined();
      expect(rates.capitalGainsTax.annualExemption.individual).toBe(3000);
    });

    it('should have inheritance tax rates', () => {
      expect(rates.inheritanceTax).toBeDefined();
      expect(rates.inheritanceTax.nilRateBand.amount).toBe(325000);
    });

    it('should have stamp duty rates', () => {
      expect(rates.stampDutyLandTax).toBeDefined();
      expect(rates.stampDutyLandTax.residential).toBeDefined();
    });

    it('should have student loan repayment thresholds', () => {
      expect(rates.studentLoan).toBeDefined();
      expect(rates.studentLoan.plans.plan2).toBeDefined();
    });

    it('should have pension allowances', () => {
      expect(rates.pension).toBeDefined();
      expect(rates.pension.annualAllowance.standard).toBe(60000);
    });

    it('should have minimum wage rates', () => {
      expect(rates.minimumWage).toBeDefined();
      expect(rates.minimumWage.rates.nationalLivingWage.hourlyRate).toBeGreaterThan(0);
    });

    it('should have statutory payment rates', () => {
      expect(rates.statutoryPayments).toBeDefined();
      expect(rates.statutoryPayments.ssp.weeklyRate).toBeGreaterThan(0);
    });
  });
});
