/**
 * Unit tests for Customer model.
 * Tests validation, CRUD operations, and UK VAT-related validation.
 * 
 * @module tests/Customer.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Customer = require('../database/models/Customer');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-customer-database.sqlite');

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
  executeMany('DELETE FROM customers;');
  executeMany('DELETE FROM users;');
  // Insert a test user for foreign key constraint
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (1, 'test@example.com', 'hash', 'Test User');
  `);
});

describe('Customer Model', () => {
  describe('VAT Number Validation', () => {
    test('should accept valid UK VAT number format', () => {
      expect(Customer.validateVatNumber('GB123456789')).toBeNull();
      expect(Customer.validateVatNumber('GB999999973')).toBeNull();
    });

    test('should accept valid EU VAT number formats', () => {
      expect(Customer.validateVatNumber('DE123456789')).toBeNull();
      expect(Customer.validateVatNumber('FR12345678901')).toBeNull();
      expect(Customer.validateVatNumber('NL123456789B01')).toBeNull();
    });

    test('should accept VAT number with spaces', () => {
      expect(Customer.validateVatNumber('GB 123 456 789')).toBeNull();
    });

    test('should accept lowercase VAT number', () => {
      expect(Customer.validateVatNumber('gb123456789')).toBeNull();
    });

    test('should reject VAT number with invalid format', () => {
      expect(Customer.validateVatNumber('123456789')).not.toBeNull();
      expect(Customer.validateVatNumber('X123456789')).not.toBeNull();
    });

    test('should reject VAT number that is too short', () => {
      // GB12 has 4 chars after country code but minimum is 2, so 'GB1' would fail
      expect(Customer.validateVatNumber('G1')).not.toBeNull();
      expect(Customer.validateVatNumber('X')).not.toBeNull();
    });

    test('should allow empty VAT number (optional field)', () => {
      expect(Customer.validateVatNumber('')).toBeNull();
      expect(Customer.validateVatNumber(null)).toBeNull();
    });
  });

  describe('Company Number Validation', () => {
    test('should accept valid 8-digit company number', () => {
      expect(Customer.validateCompanyNumber('12345678')).toBeNull();
      expect(Customer.validateCompanyNumber('00123456')).toBeNull();
    });

    test('should accept valid 2-letter prefix company number', () => {
      expect(Customer.validateCompanyNumber('SC123456')).toBeNull();
      expect(Customer.validateCompanyNumber('NI123456')).toBeNull();
    });

    test('should accept company number with spaces', () => {
      expect(Customer.validateCompanyNumber('12 34 56 78')).toBeNull();
    });

    test('should accept lowercase company number', () => {
      expect(Customer.validateCompanyNumber('sc123456')).toBeNull();
    });

    test('should reject company number with invalid format', () => {
      expect(Customer.validateCompanyNumber('1234567')).not.toBeNull();
      expect(Customer.validateCompanyNumber('ABC12345')).not.toBeNull();
    });

    test('should allow empty company number (optional field)', () => {
      expect(Customer.validateCompanyNumber('')).toBeNull();
      expect(Customer.validateCompanyNumber(null)).toBeNull();
    });
  });

  describe('UK Postcode Validation', () => {
    test('should accept valid UK postcodes', () => {
      expect(Customer.validatePostcode('SW1A 1AA', 'GB')).toBeNull();
      expect(Customer.validatePostcode('EC1A 1BB', 'GB')).toBeNull();
      expect(Customer.validatePostcode('M1 1AE', 'GB')).toBeNull();
      expect(Customer.validatePostcode('B33 8TH', 'GB')).toBeNull();
    });

    test('should accept postcode without space', () => {
      expect(Customer.validatePostcode('SW1A1AA', 'GB')).toBeNull();
    });

    test('should accept lowercase postcode', () => {
      expect(Customer.validatePostcode('sw1a 1aa', 'GB')).toBeNull();
    });

    test('should reject invalid UK postcode format', () => {
      expect(Customer.validatePostcode('INVALID', 'GB')).not.toBeNull();
      expect(Customer.validatePostcode('12345', 'GB')).not.toBeNull();
    });

    test('should skip validation for non-UK countries', () => {
      expect(Customer.validatePostcode('12345', 'US')).toBeNull();
      expect(Customer.validatePostcode('INVALID', 'FR')).toBeNull();
    });

    test('should allow empty postcode (optional field)', () => {
      expect(Customer.validatePostcode('', 'GB')).toBeNull();
      expect(Customer.validatePostcode(null, 'GB')).toBeNull();
    });
  });

  describe('validateCustomerData', () => {
    const validCustomerData = {
      userId: 1,
      customerNumber: 'CUST-0001',
      name: 'Test Company Ltd'
    };

    test('should pass validation for valid data', () => {
      const result = Customer.validateCustomerData(validCustomerData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    test('should fail for missing required fields', () => {
      const result = Customer.validateCustomerData({});
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
      expect(result.errors.customerNumber).toBeDefined();
      expect(result.errors.name).toBeDefined();
    });

    test('should fail for name too short', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        name: 'A'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toContain('at least 2 characters');
    });

    test('should validate email format', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        email: 'invalid-email'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Invalid email');
    });

    test('should validate phone format', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        phone: '123'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.phone).toContain('Invalid phone');
    });

    test('should validate website format', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        website: 'not-a-url'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.website).toContain('Invalid website');
    });

    test('should validate VAT number format', () => {
      // Test a clearly invalid VAT format (only 1 letter at start)
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        vatNumber: 'X'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.vatNumber).toContain('Invalid VAT');
    });

    test('should validate company number format', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        companyNumber: 'INVALID'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.companyNumber).toContain('Invalid UK company');
    });

    test('should validate country code format', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        country: 'INVALID'
      });
      expect(result.isValid).toBe(false);
      // The validation may fail on length first (maxLength: 2)
      expect(result.errors.country).toBeDefined();
    });

    test('should validate payment terms range', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        paymentTerms: 500
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentTerms).toContain('between 0 and 365');
    });

    test('should validate credit limit is non-negative', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        creditLimit: -100
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.creditLimit).toContain('non-negative');
    });

    test('should validate currency values', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        currency: 'INVALID'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.currency).toContain('Invalid currency');
    });

    test('should validate status values', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        status: 'invalid_status'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.status).toContain('Invalid status');
    });

    test('should validate contact email format', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        contactEmail: 'invalid-email'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.contactEmail).toContain('Invalid contact email');
    });

    test('should validate UK postcode format for GB country', () => {
      const result = Customer.validateCustomerData({
        ...validCustomerData,
        postcode: 'INVALID',
        country: 'GB'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.postcode).toContain('Invalid UK postcode');
    });

    test('should allow partial updates', () => {
      const result = Customer.validateCustomerData({ name: 'Updated Name' }, true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    const validCustomerData = {
      userId: 1,
      customerNumber: 'CUST-0001',
      name: 'Test Company Ltd',
      tradingName: 'Test Co',
      email: 'info@testcompany.com',
      phone: '+447123456789',
      website: 'www.testcompany.com',
      vatNumber: 'GB123456789',
      companyNumber: '12345678',
      addressLine1: '123 Test Street',
      addressLine2: 'Test Area',
      city: 'London',
      county: 'Greater London',
      postcode: 'SW1A 1AA',
      country: 'GB',
      contactName: 'John Smith',
      contactEmail: 'john@testcompany.com',
      contactPhone: '+447987654321',
      paymentTerms: 30,
      creditLimit: 500000, // £5,000 in pence
      currency: 'GBP',
      status: 'active',
      notes: 'Important customer'
    };

    describe('createCustomer', () => {
      test('should create a customer successfully', () => {
        const result = Customer.createCustomer(validCustomerData);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.name).toBe('Test Company Ltd');
        expect(result.data.vatNumber).toBe('GB123456789');
        expect(result.data.status).toBe('active');
      });

      test('should auto-generate customer number if not provided', () => {
        const dataWithoutNumber = { ...validCustomerData };
        delete dataWithoutNumber.customerNumber;
        
        const result = Customer.createCustomer(dataWithoutNumber);
        
        expect(result.success).toBe(true);
        expect(result.data.customerNumber).toMatch(/^CUST-\d{4}$/);
      });

      test('should normalize VAT number format', () => {
        const result = Customer.createCustomer({
          ...validCustomerData,
          vatNumber: 'gb 123 456 789'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.vatNumber).toBe('GB123456789');
      });

      test('should normalize email to lowercase', () => {
        const result = Customer.createCustomer({
          ...validCustomerData,
          email: 'INFO@TESTCOMPANY.COM'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.email).toBe('info@testcompany.com');
      });

      test('should normalize postcode format', () => {
        const result = Customer.createCustomer({
          ...validCustomerData,
          postcode: 'sw1a 1aa'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.postcode).toBe('SW1A1AA');
      });

      test('should fail for duplicate customer name', () => {
        Customer.createCustomer(validCustomerData);
        const result = Customer.createCustomer({
          ...validCustomerData,
          customerNumber: 'CUST-0002'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.name).toContain('already exists');
      });

      test('should fail for invalid data', () => {
        const result = Customer.createCustomer({
          userId: 1,
          name: 'A' // Too short
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      test('should set default values correctly', () => {
        const result = Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'Minimal Customer'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.country).toBe('GB');
        expect(result.data.currency).toBe('GBP');
        expect(result.data.status).toBe('active');
        expect(result.data.paymentTerms).toBe(30);
        expect(result.data.creditLimit).toBe(0);
      });
    });

    describe('findById', () => {
      test('should find customer by ID', () => {
        const createResult = Customer.createCustomer(validCustomerData);
        const customer = Customer.findById(createResult.data.id);
        
        expect(customer).toBeDefined();
        expect(customer.name).toBe('Test Company Ltd');
      });

      test('should return null for non-existent ID', () => {
        const customer = Customer.findById(99999);
        expect(customer).toBeNull();
      });
    });

    describe('findByName', () => {
      test('should find customer by name', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByName(1, 'Test Company Ltd');
        
        expect(customer).toBeDefined();
        expect(customer.name).toBe('Test Company Ltd');
      });

      test('should return null for non-existent name', () => {
        const customer = Customer.findByName(1, 'Non-Existent Company');
        expect(customer).toBeNull();
      });
    });

    describe('findByCustomerNumber', () => {
      test('should find customer by customer number', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByCustomerNumber(1, 'CUST-0001');
        
        expect(customer).toBeDefined();
        expect(customer.name).toBe('Test Company Ltd');
      });

      test('should find customer case-insensitively', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByCustomerNumber(1, 'cust-0001');
        
        expect(customer).toBeDefined();
      });
    });

    describe('findByVatNumber', () => {
      test('should find customer by VAT number', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByVatNumber('GB123456789');
        
        expect(customer).toBeDefined();
        expect(customer.name).toBe('Test Company Ltd');
      });

      test('should find customer with spaces in VAT number', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByVatNumber('GB 123 456 789');
        
        expect(customer).toBeDefined();
      });
    });

    describe('findByEmail', () => {
      test('should find customer by email', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByEmail(1, 'info@testcompany.com');
        
        expect(customer).toBeDefined();
        expect(customer.name).toBe('Test Company Ltd');
      });

      test('should find customer case-insensitively', () => {
        Customer.createCustomer(validCustomerData);
        const customer = Customer.findByEmail(1, 'INFO@TESTCOMPANY.COM');
        
        expect(customer).toBeDefined();
      });
    });

    describe('getCustomersByUserId', () => {
      test('should return paginated customers', () => {
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0001', name: 'Company A' });
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0002', name: 'Company B' });
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0003', name: 'Company C' });
        
        const result = Customer.getCustomersByUserId(1, { page: 1, limit: 2 });
        
        expect(result.customers.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });

      test('should filter by status', () => {
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0001', name: 'Company A', status: 'active' });
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0002', name: 'Company B', status: 'inactive' });
        
        const result = Customer.getCustomersByUserId(1, { status: 'active' });
        
        expect(result.customers.length).toBe(1);
        expect(result.customers[0].status).toBe('active');
      });

      test('should sort by name by default', () => {
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0001', name: 'Zebra Corp' });
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0002', name: 'Alpha Ltd' });
        
        const result = Customer.getCustomersByUserId(1);
        
        expect(result.customers[0].name).toBe('Alpha Ltd');
        expect(result.customers[1].name).toBe('Zebra Corp');
      });
    });

    describe('updateCustomer', () => {
      test('should update customer successfully', () => {
        const createResult = Customer.createCustomer(validCustomerData);
        const result = Customer.updateCustomer(createResult.data.id, {
          name: 'Updated Company Ltd',
          paymentTerms: 45
        });
        
        expect(result.success).toBe(true);
        expect(result.data.name).toBe('Updated Company Ltd');
        expect(result.data.paymentTerms).toBe(45);
      });

      test('should fail for non-existent customer', () => {
        const result = Customer.updateCustomer(99999, { name: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('Customer not found');
      });

      test('should prevent duplicate customer name', () => {
        Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0001', name: 'Company A' });
        const createResult = Customer.createCustomer({ ...validCustomerData, customerNumber: 'CUST-0002', name: 'Company B' });
        
        const result = Customer.updateCustomer(createResult.data.id, {
          name: 'Company A'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.name).toContain('already exists');
      });

      test('should update updatedAt timestamp', async () => {
        const createResult = Customer.createCustomer(validCustomerData);
        const originalUpdatedAt = createResult.data.updatedAt;
        
        // Wait a bit to ensure timestamp can change
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        Customer.updateCustomer(createResult.data.id, { notes: 'Updated notes' });
        const updatedCustomer = Customer.findById(createResult.data.id);
        
        // The updatedAt should change after update
        expect(updatedCustomer.updatedAt).not.toBe(originalUpdatedAt);
      });
    });

    describe('deleteCustomer', () => {
      test('should delete customer successfully', () => {
        const createResult = Customer.createCustomer(validCustomerData);
        const result = Customer.deleteCustomer(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const customer = Customer.findById(createResult.data.id);
        expect(customer).toBeNull();
      });

      test('should fail for non-existent customer', () => {
        const result = Customer.deleteCustomer(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Customer not found');
      });
    });

    describe('updateStatus', () => {
      test('should update status successfully', () => {
        const createResult = Customer.createCustomer(validCustomerData);
        const result = Customer.updateStatus(createResult.data.id, 'inactive');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('inactive');
      });

      test('should fail for invalid status', () => {
        const createResult = Customer.createCustomer(validCustomerData);
        const result = Customer.updateStatus(createResult.data.id, 'invalid');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });

      test('should fail for non-existent customer', () => {
        const result = Customer.updateStatus(99999, 'inactive');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Customer not found');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('generateCustomerNumber', () => {
      test('should generate sequential customer numbers', () => {
        const num1 = Customer.generateCustomerNumber(1);
        expect(num1).toBe('CUST-0001');
        
        Customer.createCustomer({
          userId: 1,
          customerNumber: num1,
          name: 'First Company'
        });
        
        const num2 = Customer.generateCustomerNumber(1);
        expect(num2).toBe('CUST-0002');
      });
    });

    describe('getActiveCustomers', () => {
      test('should return only active customers', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'Active Company',
          status: 'active'
        });
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0002',
          name: 'Inactive Company',
          status: 'inactive'
        });
        
        const activeCustomers = Customer.getActiveCustomers(1);
        
        expect(activeCustomers.length).toBe(1);
        expect(activeCustomers[0].name).toBe('Active Company');
      });
    });

    describe('searchByName', () => {
      test('should search customers by name', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'ABC Corporation'
        });
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0002',
          name: 'XYZ Limited'
        });
        
        const results = Customer.searchByName(1, 'ABC');
        
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('ABC Corporation');
      });

      test('should search by trading name', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'Long Company Name Ltd',
          tradingName: 'QuickBrand'
        });
        
        const results = Customer.searchByName(1, 'QuickBrand');
        
        expect(results.length).toBe(1);
      });

      test('should search by email', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'Test Company',
          email: 'unique@email.com'
        });
        
        const results = Customer.searchByName(1, 'unique@email');
        
        expect(results.length).toBe(1);
      });

      test('should return empty array for no matches', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'Test Company'
        });
        
        const results = Customer.searchByName(1, 'NonExistent');
        
        expect(results.length).toBe(0);
      });
    });

    describe('getB2BCustomers', () => {
      test('should return only customers with VAT numbers', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'B2B Company',
          vatNumber: 'GB123456789'
        });
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0002',
          name: 'B2C Company'
          // No VAT number
        });
        
        const b2bCustomers = Customer.getB2BCustomers(1);
        
        expect(b2bCustomers.length).toBe(1);
        expect(b2bCustomers[0].name).toBe('B2B Company');
      });
    });

    describe('getStatusCounts', () => {
      test('should return counts by status', () => {
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0001',
          name: 'Active 1',
          status: 'active'
        });
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0002',
          name: 'Active 2',
          status: 'active'
        });
        Customer.createCustomer({
          userId: 1,
          customerNumber: 'CUST-0003',
          name: 'Inactive 1',
          status: 'inactive'
        });
        
        const counts = Customer.getStatusCounts(1);
        
        expect(counts.active).toBe(2);
        expect(counts.inactive).toBe(1);
        expect(counts.archived).toBe(0);
      });
    });

    describe('formatAddress', () => {
      test('should format billing address correctly', () => {
        const customer = {
          addressLine1: '123 Test Street',
          addressLine2: 'Suite 456',
          city: 'London',
          county: 'Greater London',
          postcode: 'SW1A1AA',
          country: 'GB'
        };
        
        const address = Customer.formatAddress(customer);
        
        expect(address).toBe('123 Test Street, Suite 456, London, Greater London, SW1A1AA, GB');
      });

      test('should format delivery address correctly', () => {
        const customer = {
          deliveryAddressLine1: '789 Delivery Road',
          deliveryCity: 'Manchester',
          deliveryPostcode: 'M11AE',
          deliveryCountry: 'GB'
        };
        
        const address = Customer.formatAddress(customer, true);
        
        expect(address).toBe('789 Delivery Road, Manchester, M11AE, GB');
      });

      test('should handle missing address parts', () => {
        const customer = {
          addressLine1: '123 Test Street',
          city: 'London',
          postcode: 'SW1A1AA'
        };
        
        const address = Customer.formatAddress(customer);
        
        expect(address).toBe('123 Test Street, London, SW1A1AA');
      });

      test('should return empty string for null customer', () => {
        const address = Customer.formatAddress(null);
        expect(address).toBe('');
      });
    });
  });

  describe('Constants', () => {
    test('should export CUSTOMER_STATUSES', () => {
      expect(Customer.CUSTOMER_STATUSES).toContain('active');
      expect(Customer.CUSTOMER_STATUSES).toContain('inactive');
      expect(Customer.CUSTOMER_STATUSES).toContain('archived');
    });

    test('should export VALID_CURRENCIES', () => {
      expect(Customer.VALID_CURRENCIES).toContain('GBP');
      expect(Customer.VALID_CURRENCIES).toContain('EUR');
      expect(Customer.VALID_CURRENCIES).toContain('USD');
    });

    test('should export VAT_NUMBER_REGEX', () => {
      expect(Customer.VAT_NUMBER_REGEX).toBeDefined();
      expect(Customer.VAT_NUMBER_REGEX.test('GB123456789')).toBe(true);
    });

    test('should export COMPANY_NUMBER_REGEX', () => {
      expect(Customer.COMPANY_NUMBER_REGEX).toBeDefined();
      expect(Customer.COMPANY_NUMBER_REGEX.test('12345678')).toBe(true);
    });

    test('should export UK_POSTCODE_REGEX', () => {
      expect(Customer.UK_POSTCODE_REGEX).toBeDefined();
      expect(Customer.UK_POSTCODE_REGEX.test('SW1A1AA')).toBe(true);
    });
  });
});
