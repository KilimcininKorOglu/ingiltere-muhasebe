/**
 * Unit tests for TransactionAuditLog model.
 * Tests validation, CRUD operations, and audit trail functionality.
 * 
 * @module tests/TransactionAuditLog.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const TransactionAuditLog = require('../database/models/TransactionAuditLog');
const Transaction = require('../database/models/Transaction');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-audit-log-database.sqlite');

// Test user and transaction IDs
let testUserId;
let testTransactionId;

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
  
  // Create a test user for foreign key relationships
  executeMany(`
    INSERT INTO users (email, passwordHash, name, businessName)
    VALUES ('testaudit@example.com', 'hashedpassword', 'Test Audit User', 'Test Audit Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testaudit@example.com');
  testUserId = user.id;
  
  // Create a test transaction
  const txnResult = Transaction.createTransaction({
    userId: testUserId,
    type: 'expense',
    transactionDate: '2026-01-15',
    description: 'Test transaction for audit',
    amount: 5000
  });
  testTransactionId = txnResult.data.id;
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
 * Clean up audit log table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM transaction_audit_log;');
});

describe('TransactionAuditLog Model', () => {
  describe('validateAuditData', () => {
    test('should fail validation for missing transactionId', () => {
      const result = TransactionAuditLog.validateAuditData({
        userId: 1,
        action: 'create'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.transactionId).toBeDefined();
    });

    test('should fail validation for missing userId', () => {
      const result = TransactionAuditLog.validateAuditData({
        transactionId: 1,
        action: 'create'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
    });

    test('should fail validation for invalid action', () => {
      const result = TransactionAuditLog.validateAuditData({
        transactionId: 1,
        userId: 1,
        action: 'invalid'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.action).toBeDefined();
    });

    test('should pass validation for valid data', () => {
      const result = TransactionAuditLog.validateAuditData({
        transactionId: 1,
        userId: 1,
        action: 'create'
      });
      expect(result.isValid).toBe(true);
    });

    test('should pass validation for all valid actions', () => {
      const actions = ['create', 'update', 'delete'];
      for (const action of actions) {
        const result = TransactionAuditLog.validateAuditData({
          transactionId: 1,
          userId: 1,
          action
        });
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('calculateChangedFields', () => {
    test('should detect changed fields correctly', () => {
      const previousValues = {
        description: 'Old description',
        amount: 1000,
        status: 'pending'
      };
      const newValues = {
        description: 'New description',
        amount: 2000,
        status: 'pending'
      };
      
      const changed = TransactionAuditLog.calculateChangedFields(previousValues, newValues);
      expect(changed).toContain('description');
      expect(changed).toContain('amount');
      expect(changed).not.toContain('status');
    });

    test('should handle null values', () => {
      const previousValues = { reference: null };
      const newValues = { reference: 'REF-001' };
      
      const changed = TransactionAuditLog.calculateChangedFields(previousValues, newValues);
      expect(changed).toContain('reference');
    });

    test('should return empty array for null inputs', () => {
      expect(TransactionAuditLog.calculateChangedFields(null, null)).toEqual([]);
      expect(TransactionAuditLog.calculateChangedFields(null, {})).toEqual([]);
      expect(TransactionAuditLog.calculateChangedFields({}, null)).toEqual([]);
    });

    test('should skip updatedAt and createdAt fields', () => {
      const previousValues = {
        description: 'Test',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      };
      const newValues = {
        description: 'Test',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02'
      };
      
      const changed = TransactionAuditLog.calculateChangedFields(previousValues, newValues);
      expect(changed).not.toContain('createdAt');
      expect(changed).not.toContain('updatedAt');
    });
  });

  describe('logCreate', () => {
    test('should log transaction creation', () => {
      const newValues = {
        id: testTransactionId,
        userId: testUserId,
        type: 'expense',
        description: 'New transaction'
      };

      const result = TransactionAuditLog.logCreate(
        testTransactionId,
        testUserId,
        newValues
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.action).toBe('create');
      expect(result.data.transactionId).toBe(testTransactionId);
      expect(result.data.previousValues).toBeNull();
      expect(result.data.newValues).toBeDefined();
    });

    test('should store metadata (IP and user agent)', () => {
      const result = TransactionAuditLog.logCreate(
        testTransactionId,
        testUserId,
        { id: testTransactionId },
        { ipAddress: '192.168.1.1', userAgent: 'Test Browser' }
      );

      expect(result.success).toBe(true);
      expect(result.data.ipAddress).toBe('192.168.1.1');
      expect(result.data.userAgent).toBe('Test Browser');
    });
  });

  describe('logUpdate', () => {
    test('should log transaction update with previous values', () => {
      const previousValues = {
        description: 'Old description',
        amount: 1000
      };
      const newValues = {
        description: 'New description',
        amount: 2000
      };

      const result = TransactionAuditLog.logUpdate(
        testTransactionId,
        testUserId,
        previousValues,
        newValues
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('update');
      expect(result.data.previousValues).toEqual(previousValues);
      expect(result.data.newValues).toEqual(newValues);
      expect(result.data.changedFields).toContain('description');
      expect(result.data.changedFields).toContain('amount');
    });
  });

  describe('logDelete', () => {
    test('should log transaction deletion', () => {
      const deletedValues = {
        id: testTransactionId,
        description: 'Deleted transaction',
        amount: 5000
      };

      const result = TransactionAuditLog.logDelete(
        testTransactionId,
        testUserId,
        deletedValues
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('delete');
      expect(result.data.previousValues).toEqual(deletedValues);
      expect(result.data.newValues).toBeNull();
    });
  });

  describe('getTransactionHistory', () => {
    beforeEach(() => {
      // Create multiple audit entries
      TransactionAuditLog.logCreate(testTransactionId, testUserId, { id: testTransactionId, amount: 1000 });
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, { amount: 1000 }, { amount: 2000 });
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, { amount: 2000 }, { amount: 3000 });
    });

    test('should return all history entries', () => {
      const result = TransactionAuditLog.getTransactionHistory(testTransactionId);
      
      expect(result.entries).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    test('should filter by action type', () => {
      const result = TransactionAuditLog.getTransactionHistory(testTransactionId, { action: 'update' });
      
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every(e => e.action === 'update')).toBe(true);
    });

    test('should respect pagination', () => {
      const result = TransactionAuditLog.getTransactionHistory(testTransactionId, { page: 1, limit: 2 });
      
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    test('should sort by createdAt in DESC order by default', () => {
      const result = TransactionAuditLog.getTransactionHistory(testTransactionId);
      
      // Most recent should be first
      expect(result.entries[0].action).toBe('update');
    });

    test('should support ASC sort order', () => {
      const result = TransactionAuditLog.getTransactionHistory(testTransactionId, { sortOrder: 'ASC' });
      
      // Oldest (create) should be first
      expect(result.entries[0].action).toBe('create');
    });
  });

  describe('getLatestEntry', () => {
    test('should return the most recent entry', () => {
      TransactionAuditLog.logCreate(testTransactionId, testUserId, { id: testTransactionId });
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, { status: 'pending' }, { status: 'cleared' });
      
      const latest = TransactionAuditLog.getLatestEntry(testTransactionId);
      
      expect(latest).toBeDefined();
      expect(latest.action).toBe('update');
    });

    test('should return null for non-existent transaction', () => {
      const latest = TransactionAuditLog.getLatestEntry(99999);
      expect(latest).toBeNull();
    });
  });

  describe('countByTransactionId', () => {
    test('should return correct count', () => {
      TransactionAuditLog.logCreate(testTransactionId, testUserId, {});
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, {}, {});
      
      const count = TransactionAuditLog.countByTransactionId(testTransactionId);
      expect(count).toBe(2);
    });

    test('should return 0 for non-existent transaction', () => {
      const count = TransactionAuditLog.countByTransactionId(99999);
      expect(count).toBe(0);
    });
  });

  describe('getAuditSummary', () => {
    test('should return counts by action type', () => {
      TransactionAuditLog.logCreate(testTransactionId, testUserId, {});
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, {}, {});
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, {}, {});
      
      const summary = TransactionAuditLog.getAuditSummary(testTransactionId);
      
      expect(summary.create).toBe(1);
      expect(summary.update).toBe(2);
      expect(summary.delete).toBe(0);
    });
  });

  describe('getAuditLogsByUserId', () => {
    test('should return logs for a specific user', () => {
      TransactionAuditLog.logCreate(testTransactionId, testUserId, {});
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, {}, {});
      
      const result = TransactionAuditLog.getAuditLogsByUserId(testUserId);
      
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every(e => e.userId === testUserId)).toBe(true);
    });

    test('should filter by action', () => {
      TransactionAuditLog.logCreate(testTransactionId, testUserId, {});
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, {}, {});
      
      const result = TransactionAuditLog.getAuditLogsByUserId(testUserId, { action: 'create' });
      
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].action).toBe('create');
    });
  });

  describe('deleteByTransactionId', () => {
    test('should delete all audit logs for a transaction', () => {
      TransactionAuditLog.logCreate(testTransactionId, testUserId, {});
      TransactionAuditLog.logUpdate(testTransactionId, testUserId, {}, {});
      
      const result = TransactionAuditLog.deleteByTransactionId(testTransactionId);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      
      const remaining = TransactionAuditLog.countByTransactionId(testTransactionId);
      expect(remaining).toBe(0);
    });
  });
});
