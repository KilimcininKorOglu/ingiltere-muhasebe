/**
 * Unit tests for Invoice Number Generator utility.
 * Tests sequential generation, uniqueness validation, and thread-safety.
 * 
 * @module tests/invoiceNumberGenerator.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany, execute, queryOne } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const invoiceNumberGenerator = require('../utils/invoiceNumberGenerator');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-invoice-number-generator.sqlite');

// Test user data
let testUserId;
let testUser2Id;

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
  
  // Create test users with invoice settings
  execute(`
    INSERT INTO users (email, passwordHash, name, businessName, invoicePrefix, nextInvoiceNumber)
    VALUES ('testinvoicegen@example.com', 'hashedpassword', 'Test User', 'Test Business', 'TEST', 1)
  `);
  
  execute(`
    INSERT INTO users (email, passwordHash, name, businessName, invoicePrefix, nextInvoiceNumber)
    VALUES ('testinvoicegen2@example.com', 'hashedpassword', 'Test User 2', 'Test Business 2', 'ACME', 100)
  `);
  
  // Get the test user IDs
  const user1 = queryOne('SELECT id FROM users WHERE email = ?', ['testinvoicegen@example.com']);
  const user2 = queryOne('SELECT id FROM users WHERE email = ?', ['testinvoicegen2@example.com']);
  testUserId = user1.id;
  testUser2Id = user2.id;
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
 * Reset user invoice settings before each test.
 */
beforeEach(() => {
  executeMany(`
    DELETE FROM invoices;
    UPDATE users SET nextInvoiceNumber = 1, invoicePrefix = 'TEST' WHERE email = 'testinvoicegen@example.com';
    UPDATE users SET nextInvoiceNumber = 100, invoicePrefix = 'ACME' WHERE email = 'testinvoicegen2@example.com';
  `);
});

describe('Invoice Number Generator', () => {
  describe('generateNextInvoiceNumber', () => {
    test('should generate invoice number in correct format', () => {
      const result = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.invoiceNumber).toBeDefined();
      
      const currentYear = new Date().getFullYear();
      expect(result.invoiceNumber).toBe(`TEST-${currentYear}-0001`);
    });

    test('should generate sequential invoice numbers', () => {
      const result1 = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      const result2 = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      const result3 = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      
      const year = new Date().getFullYear();
      expect(result1.invoiceNumber).toBe(`TEST-${year}-0001`);
      expect(result2.invoiceNumber).toBe(`TEST-${year}-0002`);
      expect(result3.invoiceNumber).toBe(`TEST-${year}-0003`);
    });

    test('should use user-specific prefix', () => {
      const result = invoiceNumberGenerator.generateNextInvoiceNumber(testUser2Id);
      
      expect(result.success).toBe(true);
      const year = new Date().getFullYear();
      expect(result.invoiceNumber).toBe(`ACME-${year}-0100`);
    });

    test('should use custom year if provided', () => {
      const result = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId, { year: 2025 });
      
      expect(result.success).toBe(true);
      expect(result.invoiceNumber).toBe('TEST-2025-0001');
    });

    test('should use custom padding if provided', () => {
      const result = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId, { padding: 6 });
      
      expect(result.success).toBe(true);
      const year = new Date().getFullYear();
      expect(result.invoiceNumber).toBe(`TEST-${year}-000001`);
    });

    test('should increment nextInvoiceNumber in database', () => {
      invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      
      const user = queryOne('SELECT nextInvoiceNumber FROM users WHERE id = ?', [testUserId]);
      expect(user.nextInvoiceNumber).toBe(3);
    });

    test('should fail for invalid userId', () => {
      const result1 = invoiceNumberGenerator.generateNextInvoiceNumber(null);
      const result2 = invoiceNumberGenerator.generateNextInvoiceNumber(-1);
      const result3 = invoiceNumberGenerator.generateNextInvoiceNumber('invalid');
      
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Valid userId is required');
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });

    test('should fail for non-existent user', () => {
      const result = invoiceNumberGenerator.generateNextInvoiceNumber(99999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('getInvoiceSettings', () => {
    test('should return current invoice settings', () => {
      const result = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      
      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
      expect(result.settings.prefix).toBe('TEST');
      expect(result.settings.nextNumber).toBe(1);
    });

    test('should return settings for user with custom start number', () => {
      const result = invoiceNumberGenerator.getInvoiceSettings(testUser2Id);
      
      expect(result.success).toBe(true);
      expect(result.settings.prefix).toBe('ACME');
      expect(result.settings.nextNumber).toBe(100);
    });

    test('should fail for invalid userId', () => {
      const result = invoiceNumberGenerator.getInvoiceSettings(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Valid userId is required');
    });

    test('should fail for non-existent user', () => {
      const result = invoiceNumberGenerator.getInvoiceSettings(99999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('updateInvoicePrefix', () => {
    test('should update invoice prefix successfully', () => {
      const result = invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'NEWPREFIX');
      
      expect(result.success).toBe(true);
      
      const settings = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      expect(settings.settings.prefix).toBe('NEWPREFIX');
    });

    test('should normalize prefix to uppercase', () => {
      invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'lowercase');
      
      const settings = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      expect(settings.settings.prefix).toBe('LOWERCASE');
    });

    test('should allow hyphens and underscores', () => {
      const result1 = invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'MY-INV');
      expect(result1.success).toBe(true);
      
      const result2 = invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'MY_INV');
      expect(result2.success).toBe(true);
    });

    test('should reject invalid characters', () => {
      const result = invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'INV@123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('only contain letters, numbers');
    });

    test('should reject empty prefix', () => {
      const result = invoiceNumberGenerator.updateInvoicePrefix(testUserId, '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Prefix is required');
    });

    test('should reject prefix longer than 20 characters', () => {
      const result = invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'A'.repeat(21));
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('between 1 and 20 characters');
    });

    test('should fail for non-existent user', () => {
      const result = invoiceNumberGenerator.updateInvoicePrefix(99999, 'PREFIX');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('updateNextInvoiceNumber', () => {
    test('should update next invoice number successfully', () => {
      const result = invoiceNumberGenerator.updateNextInvoiceNumber(testUserId, 50);
      
      expect(result.success).toBe(true);
      
      const settings = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      expect(settings.settings.nextNumber).toBe(50);
    });

    test('should reject non-integer values', () => {
      const result = invoiceNumberGenerator.updateNextInvoiceNumber(testUserId, 1.5);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('positive integer');
    });

    test('should reject zero or negative values', () => {
      const result1 = invoiceNumberGenerator.updateNextInvoiceNumber(testUserId, 0);
      const result2 = invoiceNumberGenerator.updateNextInvoiceNumber(testUserId, -1);
      
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    test('should fail for non-existent user', () => {
      const result = invoiceNumberGenerator.updateNextInvoiceNumber(99999, 50);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('validateInvoiceNumberUniqueness', () => {
    test('should return true for unique invoice number', () => {
      const result = invoiceNumberGenerator.validateInvoiceNumberUniqueness(
        testUserId, 
        'UNIQUE-INV-001'
      );
      
      expect(result.success).toBe(true);
      expect(result.isUnique).toBe(true);
    });

    test('should return false for duplicate invoice number', () => {
      // Create an invoice first
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, issueDate, dueDate, customerName)
        VALUES (?, 'TEST-2026-0001', '2026-01-01', '2026-01-31', 'Test Customer')
      `, [testUserId]);
      
      const result = invoiceNumberGenerator.validateInvoiceNumberUniqueness(
        testUserId, 
        'TEST-2026-0001'
      );
      
      expect(result.success).toBe(true);
      expect(result.isUnique).toBe(false);
    });

    test('should be case-insensitive', () => {
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, issueDate, dueDate, customerName)
        VALUES (?, 'TEST-2026-0001', '2026-01-01', '2026-01-31', 'Test Customer')
      `, [testUserId]);
      
      const result = invoiceNumberGenerator.validateInvoiceNumberUniqueness(
        testUserId, 
        'test-2026-0001'
      );
      
      expect(result.success).toBe(true);
      expect(result.isUnique).toBe(false);
    });

    test('should exclude specific invoice ID when updating', () => {
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, issueDate, dueDate, customerName)
        VALUES (?, 'TEST-2026-0001', '2026-01-01', '2026-01-31', 'Test Customer')
      `, [testUserId]);
      
      const invoice = queryOne('SELECT id FROM invoices WHERE invoiceNumber = ?', ['TEST-2026-0001']);
      
      const result = invoiceNumberGenerator.validateInvoiceNumberUniqueness(
        testUserId, 
        'TEST-2026-0001',
        invoice.id
      );
      
      expect(result.success).toBe(true);
      expect(result.isUnique).toBe(true);
    });

    test('should reject invalid invoice number format', () => {
      const result = invoiceNumberGenerator.validateInvoiceNumberUniqueness(
        testUserId, 
        'INV@123!'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('only contain letters, numbers');
    });

    test('should reject empty invoice number', () => {
      const result = invoiceNumberGenerator.validateInvoiceNumberUniqueness(testUserId, '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice number is required');
    });
  });

  describe('previewNextInvoiceNumber', () => {
    test('should preview without incrementing counter', () => {
      const preview1 = invoiceNumberGenerator.previewNextInvoiceNumber(testUserId);
      const preview2 = invoiceNumberGenerator.previewNextInvoiceNumber(testUserId);
      
      expect(preview1.success).toBe(true);
      expect(preview2.success).toBe(true);
      expect(preview1.invoiceNumber).toBe(preview2.invoiceNumber);
      
      // Verify counter wasn't incremented
      const settings = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      expect(settings.settings.nextNumber).toBe(1);
    });

    test('should use custom year if provided', () => {
      const result = invoiceNumberGenerator.previewNextInvoiceNumber(testUserId, { year: 2025 });
      
      expect(result.success).toBe(true);
      expect(result.invoiceNumber).toBe('TEST-2025-0001');
    });
  });

  describe('parseInvoiceNumber', () => {
    test('should parse valid invoice number', () => {
      const result = invoiceNumberGenerator.parseInvoiceNumber('INV-2026-0042');
      
      expect(result.success).toBe(true);
      expect(result.components).toEqual({
        prefix: 'INV',
        year: 2026,
        number: 42
      });
    });

    test('should handle complex prefixes', () => {
      const result = invoiceNumberGenerator.parseInvoiceNumber('ACME-CORP-2026-0001');
      
      expect(result.success).toBe(true);
      expect(result.components).toEqual({
        prefix: 'ACME-CORP',
        year: 2026,
        number: 1
      });
    });

    test('should be case-insensitive', () => {
      const result = invoiceNumberGenerator.parseInvoiceNumber('inv-2026-0001');
      
      expect(result.success).toBe(true);
      expect(result.components.prefix).toBe('INV');
    });

    test('should fail for invalid format', () => {
      const result1 = invoiceNumberGenerator.parseInvoiceNumber('INVALID');
      const result2 = invoiceNumberGenerator.parseInvoiceNumber('INV-YEAR-001');
      
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    test('should reject empty input', () => {
      const result = invoiceNumberGenerator.parseInvoiceNumber('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice number is required');
    });
  });

  describe('validateSequenceIntegrity', () => {
    test('should validate that proposed number maintains sequence', () => {
      // No existing invoices - any number should be valid
      const result = invoiceNumberGenerator.validateSequenceIntegrity(testUserId, 1);
      
      expect(result.success).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.highestUsed).toBe(0);
    });

    test('should detect sequence break', () => {
      const year = new Date().getFullYear();
      
      // Create an invoice with number 10
      execute(
        'INSERT INTO invoices (userId, invoiceNumber, issueDate, dueDate, customerName) VALUES (?, ?, ?, ?, ?)',
        [testUserId, `TEST-${year}-0010`, '2026-01-01', '2026-01-31', 'Test Customer']
      );
      
      // Trying to set next number to 5 should fail
      const result = invoiceNumberGenerator.validateSequenceIntegrity(testUserId, 5);
      
      expect(result.success).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.highestUsed).toBe(10);
    });

    test('should accept valid sequence continuation', () => {
      const year = new Date().getFullYear();
      
      execute(
        'INSERT INTO invoices (userId, invoiceNumber, issueDate, dueDate, customerName) VALUES (?, ?, ?, ?, ?)',
        [testUserId, `TEST-${year}-0010`, '2026-01-01', '2026-01-31', 'Test Customer']
      );
      
      const result = invoiceNumberGenerator.validateSequenceIntegrity(testUserId, 11);
      
      expect(result.success).toBe(true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Thread-safety (concurrent requests)', () => {
    test('should generate unique numbers under concurrent requests', async () => {
      // Reset counter
      execute('UPDATE users SET nextInvoiceNumber = 1 WHERE id = ?', [testUserId]);
      
      // Simulate concurrent requests by generating multiple numbers quickly
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(invoiceNumberGenerator.generateNextInvoiceNumber(testUserId));
      }
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All invoice numbers should be unique
      const invoiceNumbers = results.map(r => r.invoiceNumber);
      const uniqueNumbers = new Set(invoiceNumbers);
      expect(uniqueNumbers.size).toBe(10);
      
      // Counter should be at 11 now
      const settings = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      expect(settings.settings.nextNumber).toBe(11);
    });

    test('should maintain sequence across rapid generations', () => {
      execute('UPDATE users SET nextInvoiceNumber = 1 WHERE id = ?', [testUserId]);
      
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(invoiceNumberGenerator.generateNextInvoiceNumber(testUserId));
      }
      
      const year = new Date().getFullYear();
      expect(results[0].invoiceNumber).toBe(`TEST-${year}-0001`);
      expect(results[1].invoiceNumber).toBe(`TEST-${year}-0002`);
      expect(results[2].invoiceNumber).toBe(`TEST-${year}-0003`);
      expect(results[3].invoiceNumber).toBe(`TEST-${year}-0004`);
      expect(results[4].invoiceNumber).toBe(`TEST-${year}-0005`);
    });
  });

  describe('User isolation', () => {
    test('should maintain separate sequences per user', () => {
      const result1 = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      const result2 = invoiceNumberGenerator.generateNextInvoiceNumber(testUser2Id);
      const result3 = invoiceNumberGenerator.generateNextInvoiceNumber(testUserId);
      
      const year = new Date().getFullYear();
      
      // User 1 should have sequential numbers with TEST prefix
      expect(result1.invoiceNumber).toBe(`TEST-${year}-0001`);
      expect(result3.invoiceNumber).toBe(`TEST-${year}-0002`);
      
      // User 2 should have its own sequence with ACME prefix
      expect(result2.invoiceNumber).toBe(`ACME-${year}-0100`);
    });

    test('should not affect other users when updating settings', () => {
      invoiceNumberGenerator.updateInvoicePrefix(testUserId, 'CHANGED');
      
      const settings1 = invoiceNumberGenerator.getInvoiceSettings(testUserId);
      const settings2 = invoiceNumberGenerator.getInvoiceSettings(testUser2Id);
      
      expect(settings1.settings.prefix).toBe('CHANGED');
      expect(settings2.settings.prefix).toBe('ACME');
    });
  });
});
