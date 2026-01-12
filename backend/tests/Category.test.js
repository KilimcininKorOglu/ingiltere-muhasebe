/**
 * Unit tests for Category model.
 * Tests validation, CRUD operations, and business logic.
 * 
 * @module tests/Category.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Category = require('../database/models/Category');
const { seedCategories } = require('../database/seeds/categories');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-category-database.sqlite');

/**
 * Setup test database before all tests.
 */
beforeAll(() => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;
  
  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
});

/**
 * Clean up test database after all tests.
 */
afterAll(() => {
  try {
    closeDatabase();
    // Remove test database file
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Also remove WAL files if they exist
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch (error) {
    console.error('Error cleaning up test database:', error.message);
  }
});

/**
 * Clean up categories table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM categories;');
});

describe('Category Model', () => {
  describe('validateCategoryData', () => {
    describe('required fields', () => {
      test('should fail validation for missing code', () => {
        const result = Category.validateCategoryData({
          name: 'Test Category',
          type: 'asset'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.code).toBeDefined();
      });

      test('should fail validation for missing name', () => {
        const result = Category.validateCategoryData({
          code: 'TEST-001',
          type: 'asset'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.name).toBeDefined();
      });

      test('should fail validation for missing type', () => {
        const result = Category.validateCategoryData({
          code: 'TEST-001',
          name: 'Test Category'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.type).toBeDefined();
      });
    });

    describe('type validation', () => {
      test('should fail validation for invalid type', () => {
        const result = Category.validateCategoryData({
          code: 'TEST-001',
          name: 'Test Category',
          type: 'invalid-type'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.type).toContain('Invalid type');
      });

      test('should pass validation for all valid types', () => {
        const types = ['asset', 'liability', 'equity', 'income', 'expense'];
        for (const type of types) {
          const result = Category.validateCategoryData({
            code: 'TEST-001',
            name: 'Test Category',
            type
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('code validation', () => {
      test('should fail validation for invalid code format', () => {
        const result = Category.validateCategoryData({
          code: 'TEST 001!',
          name: 'Test Category',
          type: 'asset'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.code).toContain('can only contain letters, numbers, and dashes');
      });

      test('should pass validation for valid code formats', () => {
        const validCodes = ['1000', 'TEST-001', 'ABC123', '1-A-2'];
        for (const code of validCodes) {
          const result = Category.validateCategoryData({
            code,
            name: 'Test Category',
            type: 'asset'
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('VAT rate validation', () => {
      test('should fail validation for invalid VAT rate', () => {
        const result = Category.validateCategoryData({
          code: 'TEST-001',
          name: 'Test Category',
          type: 'asset',
          defaultVatRate: 15000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.defaultVatRate).toContain('must be between 0 and 10000');
      });

      test('should pass validation for valid VAT rates', () => {
        const validRates = [0, 500, 2000, 10000];
        for (const rate of validRates) {
          const result = Category.validateCategoryData({
            code: 'TEST-001',
            name: 'Test Category',
            type: 'asset',
            defaultVatRate: rate
          });
          expect(result.isValid).toBe(true);
        }
      });
    });
  });

  describe('createCategory', () => {
    test('should create a category with valid data', () => {
      const result = Category.createCategory({
        code: 'TEST-001',
        name: 'Test Category',
        nameTr: 'Test Kategori',
        description: 'A test category',
        type: 'asset',
        isSystem: false,
        isActive: true,
        displayOrder: 100,
        vatApplicable: true,
        defaultVatRate: 2000
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.code).toBe('TEST-001');
      expect(result.data.name).toBe('Test Category');
      expect(result.data.nameTr).toBe('Test Kategori');
      expect(result.data.type).toBe('asset');
      expect(result.data.isSystem).toBe(false);
      expect(result.data.isActive).toBe(true);
      expect(result.data.vatApplicable).toBe(true);
      expect(result.data.defaultVatRate).toBe(2000);
    });

    test('should fail for duplicate code', () => {
      Category.createCategory({
        code: 'DUP-001',
        name: 'First Category',
        type: 'asset'
      });

      const result = Category.createCategory({
        code: 'DUP-001',
        name: 'Second Category',
        type: 'expense'
      });

      expect(result.success).toBe(false);
      expect(result.errors.code).toBe('Category code already exists');
    });

    test('should convert code to uppercase', () => {
      const result = Category.createCategory({
        code: 'lower-case',
        name: 'Test Category',
        type: 'asset'
      });

      expect(result.success).toBe(true);
      expect(result.data.code).toBe('LOWER-CASE');
    });
  });

  describe('findById', () => {
    test('should find category by ID', () => {
      const created = Category.createCategory({
        code: 'FIND-001',
        name: 'Find Me',
        type: 'asset'
      });

      const found = Category.findById(created.data.id);
      expect(found).not.toBeNull();
      expect(found.code).toBe('FIND-001');
    });

    test('should return null for non-existent ID', () => {
      const found = Category.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findByCode', () => {
    test('should find category by code', () => {
      Category.createCategory({
        code: 'CODE-001',
        name: 'Find By Code',
        type: 'liability'
      });

      const found = Category.findByCode('CODE-001');
      expect(found).not.toBeNull();
      expect(found.name).toBe('Find By Code');
    });

    test('should find category regardless of case', () => {
      Category.createCategory({
        code: 'UPPER-CASE',
        name: 'Case Test',
        type: 'income'
      });

      const found = Category.findByCode('upper-case');
      expect(found).not.toBeNull();
    });
  });

  describe('updateCategory', () => {
    test('should update category fields', () => {
      const created = Category.createCategory({
        code: 'UPDATE-001',
        name: 'Original Name',
        type: 'expense',
        description: 'Original description'
      });

      const result = Category.updateCategory(created.data.id, {
        name: 'Updated Name',
        description: 'Updated description',
        vatApplicable: true,
        defaultVatRate: 2000
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
      expect(result.data.description).toBe('Updated description');
      expect(result.data.vatApplicable).toBe(true);
      expect(result.data.defaultVatRate).toBe(2000);
    });

    test('should fail to update non-existent category', () => {
      const result = Category.updateCategory(99999, {
        name: 'New Name'
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBe('Category not found');
    });

    test('should prevent modification of system categories', () => {
      const created = Category.createCategory({
        code: 'SYSTEM-001',
        name: 'System Category',
        type: 'asset',
        isSystem: true
      });

      const result = Category.updateCategory(created.data.id, {
        name: 'Modified Name'
      });

      expect(result.success).toBe(false);
      expect(result.errors.general).toBe('System categories cannot be modified');
    });

    test('should allow toggling isActive on system categories', () => {
      const created = Category.createCategory({
        code: 'SYSTEM-002',
        name: 'System Category',
        type: 'asset',
        isSystem: true
      });

      const result = Category.updateCategory(created.data.id, {
        isActive: false
      });

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
    });
  });

  describe('deleteCategory', () => {
    test('should delete category', () => {
      const created = Category.createCategory({
        code: 'DELETE-001',
        name: 'To Delete',
        type: 'expense'
      });

      const result = Category.deleteCategory(created.data.id);
      expect(result.success).toBe(true);

      const found = Category.findById(created.data.id);
      expect(found).toBeNull();
    });

    test('should not delete system category', () => {
      const created = Category.createCategory({
        code: 'SYSTEM-DEL',
        name: 'System',
        type: 'asset',
        isSystem: true
      });

      const result = Category.deleteCategory(created.data.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('System categories cannot be deleted');
    });

    test('should not delete category with children', () => {
      const parent = Category.createCategory({
        code: 'PARENT-001',
        name: 'Parent',
        type: 'asset'
      });

      Category.createCategory({
        code: 'CHILD-001',
        name: 'Child',
        type: 'asset',
        parentId: parent.data.id
      });

      const result = Category.deleteCategory(parent.data.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete category with child categories');
    });
  });

  describe('getByType', () => {
    beforeEach(() => {
      Category.createCategory({ code: 'A1', name: 'Asset 1', type: 'asset', isActive: true });
      Category.createCategory({ code: 'A2', name: 'Asset 2', type: 'asset', isActive: true });
      Category.createCategory({ code: 'E1', name: 'Expense 1', type: 'expense', isActive: true });
      Category.createCategory({ code: 'A3', name: 'Asset 3', type: 'asset', isActive: false });
    });

    test('should return categories by type', () => {
      const assets = Category.getByType('asset');
      expect(assets).toHaveLength(2); // Only active ones
      expect(assets.every(c => c.type === 'asset')).toBe(true);
    });

    test('should include inactive when requested', () => {
      const assets = Category.getByType('asset', false);
      expect(assets).toHaveLength(3);
    });

    test('should return empty array for invalid type', () => {
      const result = Category.getByType('invalid');
      expect(result).toHaveLength(0);
    });
  });

  describe('getCategoryTree', () => {
    beforeEach(() => {
      const parent = Category.createCategory({
        code: 'PARENT',
        name: 'Parent',
        type: 'asset',
        displayOrder: 1
      });

      Category.createCategory({
        code: 'CHILD-1',
        name: 'Child 1',
        type: 'asset',
        parentId: parent.data.id,
        displayOrder: 1
      });

      Category.createCategory({
        code: 'CHILD-2',
        name: 'Child 2',
        type: 'asset',
        parentId: parent.data.id,
        displayOrder: 2
      });
    });

    test('should return hierarchical tree', () => {
      const tree = Category.getCategoryTree();
      expect(tree).toHaveLength(1);
      expect(tree[0].code).toBe('PARENT');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].code).toBe('CHILD-1');
      expect(tree[0].children[1].code).toBe('CHILD-2');
    });
  });

  describe('searchCategories', () => {
    beforeEach(() => {
      Category.createCategory({ code: 'SALES-001', name: 'Sales Revenue', type: 'income', description: 'Main sales' });
      Category.createCategory({ code: 'RENT-001', name: 'Rent Expense', type: 'expense', nameTr: 'Kira Gideri' });
      Category.createCategory({ code: 'BANK-001', name: 'Bank Account', type: 'asset' });
    });

    test('should find categories by name', () => {
      const results = Category.searchCategories('Sales');
      expect(results).toHaveLength(1);
      expect(results[0].code).toBe('SALES-001');
    });

    test('should find categories by code', () => {
      const results = Category.searchCategories('BANK');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bank Account');
    });

    test('should find categories by Turkish name', () => {
      const results = Category.searchCategories('Kira');
      expect(results).toHaveLength(1);
      expect(results[0].code).toBe('RENT-001');
    });

    test('should return empty for no matches', () => {
      const results = Category.searchCategories('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('toggleActive', () => {
    test('should toggle category active status', () => {
      const created = Category.createCategory({
        code: 'TOGGLE-001',
        name: 'Toggle Test',
        type: 'asset',
        isActive: true
      });

      let result = Category.toggleActive(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);

      result = Category.toggleActive(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
    });
  });

  describe('seedCategories', () => {
    test('should seed UK chart of accounts', () => {
      const result = seedCategories();
      expect(result.success).toBe(true);
      expect(result.created).toBeGreaterThan(50); // UK chart has many categories

      // Verify some expected categories
      const assets = Category.findByCode('1000');
      expect(assets).not.toBeNull();
      expect(assets.name).toBe('Assets');
      expect(assets.type).toBe('asset');
      expect(assets.isSystem).toBe(1);

      const sales = Category.findByCode('4100');
      expect(sales).not.toBeNull();
      expect(sales.name).toBe('Sales');
      expect(sales.type).toBe('income');
    });
  });

  describe('getTypeCounts', () => {
    beforeEach(() => {
      Category.createCategory({ code: 'A1', name: 'Asset 1', type: 'asset' });
      Category.createCategory({ code: 'A2', name: 'Asset 2', type: 'asset' });
      Category.createCategory({ code: 'E1', name: 'Expense 1', type: 'expense' });
      Category.createCategory({ code: 'I1', name: 'Income 1', type: 'income' });
    });

    test('should return correct counts by type', () => {
      const counts = Category.getTypeCounts();
      expect(counts.asset).toBe(2);
      expect(counts.expense).toBe(1);
      expect(counts.income).toBe(1);
      expect(counts.liability).toBe(0);
      expect(counts.equity).toBe(0);
    });
  });
});
