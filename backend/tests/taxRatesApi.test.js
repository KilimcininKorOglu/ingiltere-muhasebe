/**
 * Tax Rates API Tests
 * 
 * Integration tests for the Tax Rates API endpoints.
 */

const request = require('supertest');
const app = require('../app');

describe('Tax Rates API', () => {
  describe('GET /api/tax-rates', () => {
    it('should return all tax rates', async () => {
      const res = await request(app).get('/api/tax-rates');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentTaxYear).toBeDefined();
      expect(res.body.data.availableYears).toBeDefined();
      expect(res.body.data.taxRates).toBeDefined();
    });

    it('should include metadata', async () => {
      const res = await request(app).get('/api/tax-rates');
      
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.timestamp).toBeDefined();
      expect(res.body.meta.language).toBe('en');
    });

    it('should support language parameter', async () => {
      const res = await request(app).get('/api/tax-rates?lang=tr');
      
      expect(res.status).toBe(200);
      expect(res.body.meta.language).toBe('tr');
    });
  });

  describe('GET /api/tax-rates/current', () => {
    it('should return current tax year rates', async () => {
      const res = await request(app).get('/api/tax-rates/current');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taxYear).toBeDefined();
      expect(res.body.data.rates).toBeDefined();
    });
  });

  describe('GET /api/tax-rates/years', () => {
    it('should return available tax years', async () => {
      const res = await request(app).get('/api/tax-rates/years');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentTaxYear).toBeDefined();
      expect(res.body.data.availableYears).toBeDefined();
      expect(Array.isArray(res.body.data.availableYears)).toBe(true);
    });

    it('should include start and end dates for each year', async () => {
      const res = await request(app).get('/api/tax-rates/years');
      
      res.body.data.availableYears.forEach(year => {
        expect(year.year).toBeDefined();
        expect(year.startDate).toBeDefined();
        expect(year.endDate).toBeDefined();
      });
    });
  });

  describe('GET /api/tax-rates/types', () => {
    it('should return available tax types', async () => {
      const res = await request(app).get('/api/tax-rates/types');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.availableTypes).toBeDefined();
      expect(Array.isArray(res.body.data.availableTypes)).toBe(true);
    });

    it('should include descriptions for each type', async () => {
      const res = await request(app).get('/api/tax-rates/types');
      
      res.body.data.availableTypes.forEach(type => {
        expect(type.key).toBeDefined();
        expect(type.description).toBeDefined();
      });
    });
  });

  describe('GET /api/tax-rates/year/:taxYear', () => {
    it('should return rates for valid tax year', async () => {
      const res = await request(app).get('/api/tax-rates/year/2025-26');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taxYear).toBe('2025-26');
      expect(res.body.data.rates).toBeDefined();
    });

    it('should return 404 for invalid tax year', async () => {
      const res = await request(app).get('/api/tax-rates/year/1999-00');
      
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.availableYears).toBeDefined();
    });
  });

  describe('GET /api/tax-rates/type/:taxType', () => {
    it('should return income tax rates', async () => {
      const res = await request(app).get('/api/tax-rates/type/incomeTax');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taxType).toBe('incomeTax');
      expect(res.body.data.rates).toBeDefined();
    });

    it('should return VAT rates', async () => {
      const res = await request(app).get('/api/tax-rates/type/vat');
      
      expect(res.status).toBe(200);
      expect(res.body.data.rates.rates.standard).toBeDefined();
    });

    it('should return 404 for non-existent tax type', async () => {
      const res = await request(app).get('/api/tax-rates/type/nonExistent');
      
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.availableTypes).toBeDefined();
    });

    it('should support taxYear query parameter', async () => {
      const res = await request(app).get('/api/tax-rates/type/incomeTax?taxYear=2024-25');
      
      expect(res.status).toBe(200);
      expect(res.body.data.taxYear).toBe('2024-25');
    });
  });

  describe('GET /api/tax-rates/income-tax/bands', () => {
    it('should return England income tax bands by default', async () => {
      const res = await request(app).get('/api/tax-rates/income-tax/bands');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.region).toBe('england');
      expect(res.body.data.bands).toBeDefined();
      expect(Array.isArray(res.body.data.bands)).toBe(true);
    });

    it('should return Scotland income tax bands', async () => {
      const res = await request(app).get('/api/tax-rates/income-tax/bands?region=scotland');
      
      expect(res.status).toBe(200);
      expect(res.body.data.region).toBe('scotland');
      expect(res.body.data.bands.length).toBeGreaterThan(4); // Scotland has more bands
    });

    it('should include personal allowance', async () => {
      const res = await request(app).get('/api/tax-rates/income-tax/bands');
      
      expect(res.body.data.personalAllowance).toBeDefined();
      expect(res.body.data.personalAllowance.amount).toBe(12570);
    });
  });

  describe('POST /api/tax-rates/calculate/income-tax', () => {
    it('should calculate income tax for valid input', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({ annualIncome: 50000 });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
      expect(res.body.data.calculation.totalTax).toBeGreaterThan(0);
    });

    it('should return bilingual summary', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({ annualIncome: 50000 });
      
      expect(res.body.data.summary.en).toBeDefined();
      expect(res.body.data.summary.tr).toBeDefined();
    });

    it('should support region parameter', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({ annualIncome: 50000, region: 'scotland' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.region).toBe('scotland');
    });

    it('should return 400 for missing annual income', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for negative income', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({ annualIncome: -1000 });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid region', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({ annualIncome: 50000, region: 'invalid' });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should calculate zero tax for income within personal allowance', async () => {
      const res = await request(app)
        .post('/api/tax-rates/calculate/income-tax')
        .send({ annualIncome: 10000 });
      
      expect(res.body.data.calculation.totalTax).toBe(0);
    });
  });

  describe('GET /api/tax-rates/vat', () => {
    it('should return VAT rates', async () => {
      const res = await request(app).get('/api/tax-rates/vat');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vat).toBeDefined();
      expect(res.body.data.vat.rates).toBeDefined();
      expect(res.body.data.vat.thresholds).toBeDefined();
    });

    it('should include standard, reduced, and zero rates', async () => {
      const res = await request(app).get('/api/tax-rates/vat');
      
      expect(res.body.data.vat.rates.standard).toBeDefined();
      expect(res.body.data.vat.rates.reduced).toBeDefined();
      expect(res.body.data.vat.rates.zero).toBeDefined();
    });
  });

  describe('GET /api/tax-rates/corporation-tax', () => {
    it('should return corporation tax rates', async () => {
      const res = await request(app).get('/api/tax-rates/corporation-tax');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.corporationTax).toBeDefined();
      expect(res.body.data.corporationTax.rates).toBeDefined();
    });

    it('should include small and main rates', async () => {
      const res = await request(app).get('/api/tax-rates/corporation-tax');
      
      expect(res.body.data.corporationTax.rates.small).toBeDefined();
      expect(res.body.data.corporationTax.rates.main).toBeDefined();
    });
  });

  describe('GET /api/tax-rates/national-insurance', () => {
    it('should return national insurance rates', async () => {
      const res = await request(app).get('/api/tax-rates/national-insurance');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nationalInsurance).toBeDefined();
    });

    it('should include Class 1 employee and employer rates', async () => {
      const res = await request(app).get('/api/tax-rates/national-insurance');
      
      expect(res.body.data.nationalInsurance.class1.employee).toBeDefined();
      expect(res.body.data.nationalInsurance.class1.employer).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('API Info', () => {
    it('should return API information', async () => {
      const res = await request(app).get('/api');
      
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('UK Accounting API');
      expect(res.body.endpoints).toBeDefined();
    });

    it('should include bilingual description', async () => {
      const res = await request(app).get('/api');
      
      expect(res.body.description.en).toBeDefined();
      expect(res.body.description.tr).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const res = await request(app).get('/api/non-existent');
      
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message.en).toBeDefined();
      expect(res.body.error.message.tr).toBeDefined();
    });
  });
});
