/**
 * Tax Rates API Tests
 * 
 * Integration tests for the Tax Rates API endpoints.
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-tax-rates-api-${workerId}.sqlite`);

let app;
let authToken;
let testUserId;

beforeAll(async () => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Remove existing test database
  [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(f => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    }
  });
  
  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  
  // Clear require cache
  delete require.cache[require.resolve('../database/index')];
  delete require.cache[require.resolve('../database/migrate')];
  delete require.cache[require.resolve('../app')];
  
  // Open database and run migrations
  const { openDatabase } = require('../database/index');
  const { runMigrations } = require('../database/migrate');
  
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Import app after database is set up
  app = require('../app');
  
  // Create test user
  const { createUser } = require('../database/models/User');
  const result = await createUser({
    email: `taxrates-test-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Tax Rates Test User'
  });
  
  testUserId = result.data.id;
  authToken = generateToken(result.data);
});

afterAll(() => {
  try {
    const { closeDatabase } = require('../database/index');
    closeDatabase();
    
    setTimeout(() => {
      [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(f => {
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
        }
      });
    }, 100);
  } catch (e) {
    console.error('Error during cleanup:', e);
  }
});

describe('Tax Rates API', () => {
  describe('GET /api/tax-rates', () => {
    it('should return tax rates with authentication', async () => {
      const res = await request(app)
        .get('/api/tax-rates')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/tax-rates');
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tax-rates/years', () => {
    it('should return available tax years', async () => {
      const res = await request(app)
        .get('/api/tax-rates/years')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/tax-rates/grouped', () => {
    it('should return tax rates grouped by category', async () => {
      const res = await request(app)
        .get('/api/tax-rates/grouped')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/tax-rates/vat-thresholds', () => {
    it('should return VAT thresholds', async () => {
      const res = await request(app)
        .get('/api/tax-rates/vat-thresholds')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
