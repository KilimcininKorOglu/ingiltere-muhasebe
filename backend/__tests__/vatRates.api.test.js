/**
 * Integration Tests for VAT Rates API Endpoints
 */

const request = require('supertest');
const app = require('../app');

describe('VAT Rates API', () => {
  describe('GET /api/vat-rates', () => {
    it('should return all VAT rates in English by default', async () => {
      const response = await request(app)
        .get('/api/vat-rates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.language).toBe('en');
      expect(response.body.count).toBe(5);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return VAT rates in Turkish when lang=tr', async () => {
      const response = await request(app)
        .get('/api/vat-rates?lang=tr')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.language).toBe('tr');
      
      const standard = response.body.data.find(r => r.id === 'standard');
      expect(standard.name).toBe('Standart Oran');
    });

    it('should return multilingual data when multilingual=true', async () => {
      const response = await request(app)
        .get('/api/vat-rates?multilingual=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.language).toBe('all');
      
      const standard = response.body.data.find(r => r.id === 'standard');
      expect(standard.name).toHaveProperty('en');
      expect(standard.name).toHaveProperty('tr');
    });

    it('should respect Accept-Language header', async () => {
      const response = await request(app)
        .get('/api/vat-rates')
        .set('Accept-Language', 'tr-TR,tr;q=0.9,en;q=0.8')
        .expect(200);

      expect(response.body.language).toBe('tr');
    });

    it('should prioritize query param over Accept-Language header', async () => {
      const response = await request(app)
        .get('/api/vat-rates?lang=en')
        .set('Accept-Language', 'tr-TR')
        .expect(200);

      expect(response.body.language).toBe('en');
    });
  });

  describe('GET /api/vat-rates/active', () => {
    it('should return only active VAT rates', async () => {
      const response = await request(app)
        .get('/api/vat-rates/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(rate => {
        expect(rate.isActive).toBe(true);
      });
    });
  });

  describe('GET /api/vat-rates/thresholds', () => {
    it('should return VAT thresholds', async () => {
      const response = await request(app)
        .get('/api/vat-rates/thresholds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('registrationThreshold');
      expect(response.body.data).toHaveProperty('deregistrationThreshold');
      expect(response.body.data).toHaveProperty('flatRateScheme');
      expect(response.body.data.registrationThreshold.amount).toBe(90000);
    });

    it('should return thresholds in Turkish', async () => {
      const response = await request(app)
        .get('/api/vat-rates/thresholds?lang=tr')
        .expect(200);

      expect(response.body.language).toBe('tr');
      expect(response.body.data.registrationThreshold.description).toContain('KDV');
    });
  });

  describe('GET /api/vat-rates/search', () => {
    it('should search VAT rates by keyword', async () => {
      const response = await request(app)
        .get('/api/vat-rates/search?keyword=food')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.keyword).toBe('food');
      expect(response.body.count).toBeGreaterThan(0);
      
      response.body.data.forEach(result => {
        expect(result.matchingExamples.length).toBeGreaterThan(0);
      });
    });

    it('should return 400 if keyword is missing', async () => {
      const response = await request(app)
        .get('/api/vat-rates/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Search keyword is required');
    });

    it('should return 400 for empty keyword', async () => {
      const response = await request(app)
        .get('/api/vat-rates/search?keyword=')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should search in Turkish', async () => {
      const response = await request(app)
        .get('/api/vat-rates/search?keyword=' + encodeURIComponent('gıda') + '&lang=tr')
        .expect(200);

      expect(response.body.language).toBe('tr');
    });
  });

  describe('GET /api/vat-rates/languages', () => {
    it('should return supported languages', async () => {
      const response = await request(app)
        .get('/api/vat-rates/languages')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.supported).toContain('en');
      expect(response.body.data.supported).toContain('tr');
      expect(response.body.data.default).toBe('en');
      expect(response.body.data.names).toHaveProperty('en', 'English');
      expect(response.body.data.names).toHaveProperty('tr', 'Türkçe');
    });
  });

  describe('GET /api/vat-rates/:id', () => {
    it('should return a VAT rate by ID', async () => {
      const response = await request(app)
        .get('/api/vat-rates/standard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('standard');
      expect(response.body.data.rate).toBe(20);
      expect(response.body.data.code).toBe('S');
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .get('/api/vat-rates/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VAT rate not found');
    });

    it('should return rate in Turkish', async () => {
      const response = await request(app)
        .get('/api/vat-rates/reduced?lang=tr')
        .expect(200);

      expect(response.body.language).toBe('tr');
      expect(response.body.data.name).toBe('İndirimli Oran');
    });
  });

  describe('GET /api/vat-rates/code/:code', () => {
    it('should return a VAT rate by code', async () => {
      const response = await request(app)
        .get('/api/vat-rates/code/S')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('standard');
      expect(response.body.data.code).toBe('S');
      expect(response.body.data.rate).toBe(20);
    });

    it('should work with lowercase code', async () => {
      const response = await request(app)
        .get('/api/vat-rates/code/r')
        .expect(200);

      expect(response.body.data.id).toBe('reduced');
    });

    it('should return 404 for non-existent code', async () => {
      const response = await request(app)
        .get('/api/vat-rates/code/X')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.name).toBe('UK Accounting API');
      expect(response.body.endpoints).toHaveProperty('vatRates');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not Found');
    });
  });
});
