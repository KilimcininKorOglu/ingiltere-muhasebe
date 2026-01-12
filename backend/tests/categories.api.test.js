/**
 * Unit tests for Categories API endpoints.
 * Tests read-only operations for UK chart of accounts categories.
 * 
 * @module tests/categories.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { generateToken } = require('../utils/jwt');

// Use unique test database with worker ID for parallel test isolation
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DB_PATH = path.join(__dirname, `../data/test-categories-api-${workerId}.sqlite`);

// Test user data
let testUser;
let authToken;
let db;
let app;

/**
 * Setup test database before all tests.
 */
beforeAll(async () => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Remove existing test database if it exists
  [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(f => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    }
  });
  
  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  
  // Clear require cache to ensure fresh database connection
  delete require.cache[require.resolve('../database/index')];
  delete require.cache[require.resolve('../database/migrate')];
  delete require.cache[require.resolve('../app')];
  
  // Open database and run migrations
  const { openDatabase, closeDatabase } = require('../database/index');
  const { runMigrations } = require('../database/migrate');
  
  db = openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Import app after database is set up
  app = require('../app');
  
  // Create test user directly in database
  const { createUser } = require('../database/models/User');
  const result = await createUser({
    email: `testuser-categories-${workerId}@example.com`,
    password: 'ValidPass123',
    name: 'Test User'
  });
  
  testUser = result.data;
  authToken = generateToken(testUser);
  
  // Seed categories for testing
  const { seedCategories } = require('../database/seeds/categories');
  seedCategories();
});

/**
 * Clean up test database after all tests.
 */
afterAll(() => {
  try {
    const { closeDatabase } = require('../database/index');
    closeDatabase();
    // Small delay to ensure database is released
    setTimeout(() => {
      [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].forEach(f => {
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
        }
      });
    }, 100);
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('Categories API', () => {
  describe('Authentication', () => {
    it('should return 401 for requests without auth token', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should return 401 for requests with invalid auth token', async () => {
      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('GET /api/categories', () => {
    it('should return all categories with pagination', async () => {
      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data.categories.length).toBeGreaterThan(0);
      expect(response.body.data.total).toBeGreaterThan(0);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(100);
    });

    it('should include both English and Turkish names', async () => {
      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const category = response.body.data.categories.find(c => c.code === '1000');
      expect(category).toBeDefined();
      expect(category.name).toBe('Assets');
      expect(category.nameTr).toBe('Varlıklar');
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/categories?type=asset')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories.every(c => c.type === 'asset')).toBe(true);
    });

    it('should return error for invalid type', async () => {
      const response = await request(app)
        .get('/api/categories?type=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/categories?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.categories.length).toBeLessThanOrEqual(10);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });
  });

  describe('GET /api/categories/type/:type', () => {
    it('should return categories by type', async () => {
      const response = await request(app)
        .get('/api/categories/type/income')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.every(c => c.type === 'income')).toBe(true);
      expect(response.body.meta.count).toBeGreaterThan(0);
    });

    it('should return categories for all valid types', async () => {
      const types = ['asset', 'liability', 'equity', 'income', 'expense'];
      
      for (const type of types) {
        const response = await request(app)
          .get(`/api/categories/type/${type}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.every(c => c.type === type)).toBe(true);
      }
    });

    it('should return error for invalid type', async () => {
      const response = await request(app)
        .get('/api/categories/type/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return category by ID', async () => {
      // First get a category to know its ID
      const listResponse = await request(app)
        .get('/api/categories?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const categoryId = listResponse.body.data.categories[0].id;

      const response = await request(app)
        .get(`/api/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(categoryId);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .get('/api/categories/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });
  });

  describe('GET /api/categories/code/:code', () => {
    it('should return category by code', async () => {
      const response = await request(app)
        .get('/api/categories/code/1000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe('1000');
      expect(response.body.data.name).toBe('Assets');
      expect(response.body.data.nameTr).toBe('Varlıklar');
    });

    it('should return 404 for non-existent code', async () => {
      const response = await request(app)
        .get('/api/categories/code/NONEXISTENT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_NOT_FOUND');
    });
  });

  describe('GET /api/categories/tree', () => {
    it('should return hierarchical category tree', async () => {
      const response = await request(app)
        .get('/api/categories/tree')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      // Check that root categories have children
      const assetsRoot = response.body.data.find(c => c.code === '1000');
      expect(assetsRoot).toBeDefined();
      expect(assetsRoot.children).toBeInstanceOf(Array);
      expect(assetsRoot.children.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/categories/top-level', () => {
    it('should return only top-level categories', async () => {
      const response = await request(app)
        .get('/api/categories/top-level')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      // Verify all returned categories have no parent
      const hasParent = response.body.data.some(c => c.parentId !== null);
      expect(hasParent).toBe(false);
    });
  });

  describe('GET /api/categories/search', () => {
    it('should search categories by name', async () => {
      const response = await request(app)
        .get('/api/categories/search?q=Sales')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.some(c => c.name.includes('Sales'))).toBe(true);
    });

    it('should search categories by code', async () => {
      const response = await request(app)
        .get('/api/categories/search?q=1000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.some(c => c.code === '1000')).toBe(true);
    });

    it('should search categories by Turkish name', async () => {
      const response = await request(app)
        .get('/api/categories/search?q=Varlık')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return error for missing search query', async () => {
      const response = await request(app)
        .get('/api/categories/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/categories/stats', () => {
    it('should return category counts by type', async () => {
      const response = await request(app)
        .get('/api/categories/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('asset');
      expect(response.body.data).toHaveProperty('liability');
      expect(response.body.data).toHaveProperty('equity');
      expect(response.body.data).toHaveProperty('income');
      expect(response.body.data).toHaveProperty('expense');
      
      // All counts should be numbers >= 0
      expect(typeof response.body.data.asset).toBe('number');
      expect(response.body.data.asset).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/categories/types', () => {
    it('should return valid category types with labels', async () => {
      const response = await request(app)
        .get('/api/categories/types')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(5);
      
      // Check structure
      const assetType = response.body.data.find(t => t.value === 'asset');
      expect(assetType).toBeDefined();
      expect(assetType.label.en).toBe('Asset');
      expect(assetType.label.tr).toBe('Varlık');
    });
  });

  describe('Response format', () => {
    it('should include meta information in responses', async () => {
      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.language).toBe('en');
    });

    it('should respect lang query parameter', async () => {
      const response = await request(app)
        .get('/api/categories?lang=tr')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta.language).toBe('tr');
    });
  });
});
