/**
 * Unit tests for Supplier model.
 * Tests validation, CRUD operations, and VAT/postcode validation.
 * 
 * @module tests/Supplier.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Supplier = require('../database/models/Supplier');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-supplier-database.sqlite');

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
 * Clean up tables before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM suppliers;');
  executeMany('DELETE FROM users;');
  // Insert a test user for foreign key constraint
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (1, 'test@example.com', 'hash', 'Test User');
  `);
});

describe('Supplier Model', () => {
  describe('VAT Number Validation', () => {
    test('should accept valid UK VAT number format', () => {
      expect(Supplier.validateVATNumber('GB123456789')).toBeNull();
      expect(Supplier.validateVATNumber('GB123456789012')).toBeNull();
    });

    test('should accept VAT number with spaces', () => {
      expect(Supplier.validateVATNumber('GB 123 456 789')).toBeNull();
    });

    test('should accept lowercase VAT number', () => {
      expect(Supplier.validateVATNumber('gb123456789')).toBeNull();
    });

    test('should accept VAT number without GB prefix', () => {
      expect(Supplier.validateVATNumber('123456789')).toBeNull();
      expect(Supplier.validateVATNumber('123456789012')).toBeNull();
    });

    test('should reject VAT number with wrong length', () => {
      expect(Supplier.validateVATNumber('GB12345678')).not.toBeNull();
      expect(Supplier.validateVATNumber('GB1234567890')).not.toBeNull();
    });

    test('should allow empty VAT number (optional field)', () => {
      expect(Supplier.validateVATNumber('')).toBeNull();
      expect(Supplier.validateVATNumber(null)).toBeNull();
    });
  });

  describe('Postcode Validation', () => {
    test('should accept valid UK postcode format', () => {
      expect(Supplier.validatePostcode('SW1A 1AA')).toBeNull();
      expect(Supplier.validatePostcode('EC1A 1BB')).toBeNull();
      expect(Supplier.validatePostcode('M1 1AE')).toBeNull();
      expect(Supplier.validatePostcode('B33 8TH')).toBeNull();
    });

    test('should accept postcode without space', () => {
      expect(Supplier.validatePostcode('SW1A1AA')).toBeNull();
    });

    test('should accept lowercase postcode', () => {
      expect(Supplier.validatePostcode('sw1a 1aa')).toBeNull();
    });

    test('should reject invalid postcode format', () => {
      expect(Supplier.validatePostcode('INVALID')).not.toBeNull();
      expect(Supplier.validatePostcode('12345')).not.toBeNull();
    });

    test('should allow empty postcode (optional field)', () => {
      expect(Supplier.validatePostcode('')).toBeNull();
      expect(Supplier.validatePostcode(null)).toBeNull();
    });
  });

  describe('Company Number Validation', () => {
    test('should accept valid company number format', () => {
      expect(Supplier.validateCompanyNumber('12345678')).toBeNull();
      expect(Supplier.validateCompanyNumber('SC123456')).toBeNull();
    });

    test('should accept company number with spaces', () => {
      expect(Supplier.validateCompanyNumber('1234 5678')).toBeNull();
    });

    test('should accept lowercase company number', () => {
      expect(Supplier.validateCompanyNumber('sc123456')).toBeNull();
    });

    test('should reject company number with wrong length', () => {
      expect(Supplier.validateCompanyNumber('1234567')).not.toBeNull();
      expect(Supplier.validateCompanyNumber('123456789')).not.toBeNull();
    });

    test('should allow empty company number (optional field)', () => {
      expect(Supplier.validateCompanyNumber('')).toBeNull();
      expect(Supplier.validateCompanyNumber(null)).toBeNull();
    });
  });

  describe('validateSupplierData', () => {
    const validSupplierData = {
      userId: 1,
      name: 'Test Supplier Ltd'
    };

    test('should pass validation for valid minimal data', () => {
      const result = Supplier.validateSupplierData(validSupplierData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    test('should pass validation for complete data', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        contactName: 'John Doe',
        email: 'supplier@example.com',
        phoneNumber: '+447123456789',
        address: '123 Supplier Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        vatNumber: 'GB123456789',
        isVatRegistered: true,
        companyNumber: '12345678',
        paymentTerms: 'net30',
        currency: 'GBP',
        bankAccountNumber: '12345678',
        bankSortCode: '123456'
      });
      expect(result.isValid).toBe(true);
    });

    test('should fail for missing required fields', () => {
      const result = Supplier.validateSupplierData({});
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
      expect(result.errors.name).toBeDefined();
    });

    test('should validate email format', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        email: 'invalid-email'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Invalid email');
    });

    test('should validate VAT number format', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        vatNumber: 'INVALID'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.vatNumber).toContain('Invalid UK VAT');
    });

    test('should validate postcode format', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        postcode: 'INVALID'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.postcode).toContain('Invalid UK postcode');
    });

    test('should validate bank account number format', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        bankAccountNumber: '12345'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.bankAccountNumber).toContain('8 digits');
    });

    test('should validate sort code format', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        bankSortCode: '123'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.bankSortCode).toContain('6 digits');
    });

    test('should validate status values', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        status: 'invalid_status'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.status).toContain('Invalid status');
    });

    test('should validate payment terms values', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        paymentTerms: 'invalid'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentTerms).toContain('Invalid paymentTerms');
    });

    test('should validate currency values', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        currency: 'XYZ'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.currency).toContain('Invalid currency');
    });

    test('should require paymentTermsDays when paymentTerms is custom', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        paymentTerms: 'custom'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentTermsDays).toContain('required when paymentTerms is "custom"');
    });

    test('should validate isVatRegistered when VAT number is provided', () => {
      const result = Supplier.validateSupplierData({
        ...validSupplierData,
        vatNumber: 'GB123456789',
        isVatRegistered: false
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.isVatRegistered).toContain('should be true');
    });

    test('should allow partial updates', () => {
      const result = Supplier.validateSupplierData({ contactName: 'Jane' }, true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    const validSupplierData = {
      userId: 1,
      name: 'Test Supplier Ltd',
      contactName: 'John Doe',
      email: 'supplier@example.com',
      phoneNumber: '+447123456789',
      address: '123 Supplier Street',
      city: 'London',
      postcode: 'SW1A 1AA',
      vatNumber: 'GB123456789',
      isVatRegistered: true,
      companyNumber: '12345678',
      paymentTerms: 'net30',
      currency: 'GBP',
      bankAccountNumber: '12345678',
      bankSortCode: '123456',
      status: 'active'
    };

    describe('createSupplier', () => {
      test('should create a supplier successfully', () => {
        const result = Supplier.createSupplier(validSupplierData);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.name).toBe('Test Supplier Ltd');
        expect(result.data.contactName).toBe('John Doe');
        expect(result.data.vatNumber).toBe('GB123456789');
        expect(result.data.isVatRegistered).toBe(true);
      });

      test('should normalize VAT number format', () => {
        const result = Supplier.createSupplier({
          ...validSupplierData,
          name: 'Another Supplier',
          vatNumber: '123456789'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.vatNumber).toBe('GB123456789');
      });

      test('should normalize email to lowercase', () => {
        const result = Supplier.createSupplier({
          ...validSupplierData,
          name: 'Email Test Supplier',
          email: 'SUPPLIER@EXAMPLE.COM'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.email).toBe('supplier@example.com');
      });

      test('should normalize postcode to uppercase', () => {
        const result = Supplier.createSupplier({
          ...validSupplierData,
          name: 'Postcode Test Supplier',
          postcode: 'sw1a 1aa'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.postcode).toBe('SW1A 1AA');
      });

      test('should fail for duplicate supplier name', () => {
        Supplier.createSupplier(validSupplierData);
        const result = Supplier.createSupplier(validSupplierData);
        
        expect(result.success).toBe(false);
        expect(result.errors.name).toContain('already exists');
      });

      test('should fail for invalid data', () => {
        const result = Supplier.createSupplier({
          userId: 1
          // Missing required name field
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      test('should use default values', () => {
        const result = Supplier.createSupplier({
          userId: 1,
          name: 'Minimal Supplier'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.country).toBe('United Kingdom');
        expect(result.data.currency).toBe('GBP');
        expect(result.data.paymentTerms).toBe('net30');
        expect(result.data.status).toBe('active');
        expect(result.data.isVatRegistered).toBe(false);
      });
    });

    describe('findById', () => {
      test('should find supplier by ID', () => {
        const createResult = Supplier.createSupplier(validSupplierData);
        const supplier = Supplier.findById(createResult.data.id);
        
        expect(supplier).toBeDefined();
        expect(supplier.name).toBe('Test Supplier Ltd');
      });

      test('should return null for non-existent ID', () => {
        const supplier = Supplier.findById(99999);
        expect(supplier).toBeNull();
      });
    });

    describe('findByName', () => {
      test('should find supplier by name', () => {
        Supplier.createSupplier(validSupplierData);
        const supplier = Supplier.findByName(1, 'Test Supplier Ltd');
        
        expect(supplier).toBeDefined();
        expect(supplier.name).toBe('Test Supplier Ltd');
      });

      test('should find supplier case-insensitively', () => {
        Supplier.createSupplier(validSupplierData);
        const supplier = Supplier.findByName(1, 'test supplier ltd');
        
        expect(supplier).toBeDefined();
      });
    });

    describe('findByVATNumber', () => {
      test('should find supplier by VAT number', () => {
        Supplier.createSupplier(validSupplierData);
        const supplier = Supplier.findByVATNumber('GB123456789');
        
        expect(supplier).toBeDefined();
        expect(supplier.name).toBe('Test Supplier Ltd');
      });

      test('should find supplier with different VAT number format', () => {
        Supplier.createSupplier(validSupplierData);
        const supplier = Supplier.findByVATNumber('123456789');
        
        expect(supplier).toBeDefined();
      });
    });

    describe('findByCompanyNumber', () => {
      test('should find supplier by company number', () => {
        Supplier.createSupplier(validSupplierData);
        const supplier = Supplier.findByCompanyNumber('12345678');
        
        expect(supplier).toBeDefined();
        expect(supplier.name).toBe('Test Supplier Ltd');
      });
    });

    describe('getSuppliersByUserId', () => {
      test('should return paginated suppliers', () => {
        Supplier.createSupplier({ ...validSupplierData, name: 'Supplier A' });
        Supplier.createSupplier({ ...validSupplierData, name: 'Supplier B' });
        Supplier.createSupplier({ ...validSupplierData, name: 'Supplier C' });
        
        const result = Supplier.getSuppliersByUserId(1, { page: 1, limit: 2 });
        
        expect(result.suppliers.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });

      test('should filter by status', () => {
        Supplier.createSupplier({ ...validSupplierData, name: 'Active Supplier', status: 'active' });
        Supplier.createSupplier({ ...validSupplierData, name: 'Blocked Supplier', status: 'blocked' });
        
        const result = Supplier.getSuppliersByUserId(1, { status: 'active' });
        
        expect(result.suppliers.length).toBe(1);
        expect(result.suppliers[0].status).toBe('active');
      });

      test('should sort by name by default', () => {
        Supplier.createSupplier({ ...validSupplierData, name: 'Zebra Ltd' });
        Supplier.createSupplier({ ...validSupplierData, name: 'Alpha Ltd' });
        
        const result = Supplier.getSuppliersByUserId(1);
        
        expect(result.suppliers[0].name).toBe('Alpha Ltd');
        expect(result.suppliers[1].name).toBe('Zebra Ltd');
      });
    });

    describe('updateSupplier', () => {
      test('should update supplier successfully', () => {
        const createResult = Supplier.createSupplier(validSupplierData);
        const result = Supplier.updateSupplier(createResult.data.id, {
          contactName: 'Jane Doe',
          city: 'Manchester'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.contactName).toBe('Jane Doe');
        expect(result.data.city).toBe('Manchester');
      });

      test('should fail for non-existent supplier', () => {
        const result = Supplier.updateSupplier(99999, { contactName: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('Supplier not found');
      });

      test('should prevent duplicate supplier name', () => {
        Supplier.createSupplier({ ...validSupplierData, name: 'Supplier A' });
        const createResult = Supplier.createSupplier({ ...validSupplierData, name: 'Supplier B' });
        
        const result = Supplier.updateSupplier(createResult.data.id, {
          name: 'Supplier A'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.name).toContain('already exists');
      });
    });

    describe('deleteSupplier', () => {
      test('should delete supplier successfully', () => {
        const createResult = Supplier.createSupplier(validSupplierData);
        const result = Supplier.deleteSupplier(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const supplier = Supplier.findById(createResult.data.id);
        expect(supplier).toBeNull();
      });

      test('should fail for non-existent supplier', () => {
        const result = Supplier.deleteSupplier(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Supplier not found');
      });
    });

    describe('updateStatus', () => {
      test('should update status successfully', () => {
        const createResult = Supplier.createSupplier(validSupplierData);
        const result = Supplier.updateStatus(createResult.data.id, 'blocked');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('blocked');
      });

      test('should fail for invalid status', () => {
        const createResult = Supplier.createSupplier(validSupplierData);
        const result = Supplier.updateStatus(createResult.data.id, 'invalid');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getActiveSuppliers', () => {
      test('should return only active suppliers', () => {
        Supplier.createSupplier({
          userId: 1,
          name: 'Active Supplier',
          status: 'active'
        });
        Supplier.createSupplier({
          userId: 1,
          name: 'Blocked Supplier',
          status: 'blocked'
        });
        
        const activeSuppliers = Supplier.getActiveSuppliers(1);
        
        expect(activeSuppliers.length).toBe(1);
        expect(activeSuppliers[0].name).toBe('Active Supplier');
      });
    });

    describe('searchByName', () => {
      test('should search suppliers by name', () => {
        Supplier.createSupplier({
          userId: 1,
          name: 'Acme Corporation'
        });
        Supplier.createSupplier({
          userId: 1,
          name: 'Beta Industries'
        });
        
        const results = Supplier.searchByName(1, 'Acme');
        
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Acme Corporation');
      });

      test('should search by contact name', () => {
        Supplier.createSupplier({
          userId: 1,
          name: 'Test Supplier',
          contactName: 'John Smith'
        });
        
        const results = Supplier.searchByName(1, 'Smith');
        
        expect(results.length).toBe(1);
      });

      test('should search by city', () => {
        Supplier.createSupplier({
          userId: 1,
          name: 'London Supplier',
          city: 'London'
        });
        
        const results = Supplier.searchByName(1, 'London');
        
        expect(results.length).toBe(1);
      });
    });

    describe('getStatusCounts', () => {
      test('should return counts by status', () => {
        Supplier.createSupplier({
          userId: 1,
          name: 'Active 1',
          status: 'active'
        });
        Supplier.createSupplier({
          userId: 1,
          name: 'Active 2',
          status: 'active'
        });
        Supplier.createSupplier({
          userId: 1,
          name: 'Blocked 1',
          status: 'blocked'
        });
        
        const counts = Supplier.getStatusCounts(1);
        
        expect(counts.active).toBe(2);
        expect(counts.blocked).toBe(1);
        expect(counts.inactive).toBe(0);
      });
    });

    describe('getVatRegisteredSuppliers', () => {
      test('should return only VAT registered suppliers', () => {
        Supplier.createSupplier({
          userId: 1,
          name: 'VAT Supplier',
          vatNumber: 'GB123456789',
          isVatRegistered: true
        });
        Supplier.createSupplier({
          userId: 1,
          name: 'Non-VAT Supplier'
        });
        
        const vatSuppliers = Supplier.getVatRegisteredSuppliers(1);
        
        expect(vatSuppliers.length).toBe(1);
        expect(vatSuppliers[0].name).toBe('VAT Supplier');
      });
    });

    describe('sanitizeSupplier', () => {
      test('should convert isVatRegistered to boolean', () => {
        const supplier = {
          id: 1,
          name: 'Test Supplier',
          isVatRegistered: 1
        };
        
        const sanitized = Supplier.sanitizeSupplier(supplier);
        expect(sanitized.isVatRegistered).toBe(true);
      });

      test('should return null for null input', () => {
        expect(Supplier.sanitizeSupplier(null)).toBeNull();
      });
    });

    describe('normalizeVATNumber', () => {
      test('should add GB prefix if missing', () => {
        expect(Supplier.normalizeVATNumber('123456789')).toBe('GB123456789');
      });

      test('should keep existing GB prefix', () => {
        expect(Supplier.normalizeVATNumber('GB123456789')).toBe('GB123456789');
      });

      test('should convert to uppercase', () => {
        expect(Supplier.normalizeVATNumber('gb123456789')).toBe('GB123456789');
      });

      test('should return null for empty input', () => {
        expect(Supplier.normalizeVATNumber('')).toBeNull();
        expect(Supplier.normalizeVATNumber(null)).toBeNull();
      });
    });
  });

  describe('Unique Constraint', () => {
    test('should enforce unique supplier names per user', () => {
      const result1 = Supplier.createSupplier({
        userId: 1,
        name: 'Unique Supplier'
      });
      expect(result1.success).toBe(true);

      const result2 = Supplier.createSupplier({
        userId: 1,
        name: 'Unique Supplier'
      });
      expect(result2.success).toBe(false);
      expect(result2.errors.name).toContain('already exists');
    });

    test('should allow same supplier name for different users', () => {
      // Add another user
      executeMany(`
        INSERT INTO users (id, email, passwordHash, name) 
        VALUES (2, 'test2@example.com', 'hash', 'Test User 2');
      `);

      const result1 = Supplier.createSupplier({
        userId: 1,
        name: 'Shared Name Supplier'
      });
      expect(result1.success).toBe(true);

      const result2 = Supplier.createSupplier({
        userId: 2,
        name: 'Shared Name Supplier'
      });
      expect(result2.success).toBe(true);
    });
  });
});
