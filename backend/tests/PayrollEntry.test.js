/**
 * Unit tests for PayrollEntry model.
 * Tests validation, CRUD operations, and tax code validation.
 * 
 * @module tests/PayrollEntry.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Employee = require('../database/models/Employee');
const PayrollEntry = require('../database/models/PayrollEntry');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-payroll-database.sqlite');

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

// Store test employee ID for use in tests
let testEmployeeId;

/**
 * Clean up tables before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM payroll_entries;');
  executeMany('DELETE FROM employees;');
  executeMany('DELETE FROM users;');
  // Insert a test user for foreign key constraint
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (1, 'test@example.com', 'hash', 'Test User');
  `);
  // Insert a test employee
  const employeeResult = Employee.createEmployee({
    userId: 1,
    employeeNumber: 'EMP-0001',
    firstName: 'John',
    lastName: 'Doe',
    startDate: '2024-01-15',
    taxCode: '1257L'
  });
  testEmployeeId = employeeResult.data.id;
});

describe('PayrollEntry Model', () => {
  describe('Tax Code Validation', () => {
    test('should accept standard tax codes', () => {
      expect(PayrollEntry.validateTaxCode('1257L')).toBeNull();
      expect(PayrollEntry.validateTaxCode('1185L')).toBeNull();
      expect(PayrollEntry.validateTaxCode('K475')).toBeNull();
    });

    test('should accept Scottish tax codes', () => {
      expect(PayrollEntry.validateTaxCode('S1257L')).toBeNull();
    });

    test('should accept Welsh tax codes', () => {
      expect(PayrollEntry.validateTaxCode('C1257L')).toBeNull();
    });

    test('should accept emergency tax codes', () => {
      expect(PayrollEntry.validateTaxCode('1257L W1')).toBeNull();
      expect(PayrollEntry.validateTaxCode('1257L M1')).toBeNull();
      expect(PayrollEntry.validateTaxCode('1257L X')).toBeNull();
    });

    test('should accept special tax codes', () => {
      expect(PayrollEntry.validateTaxCode('BR')).toBeNull();
      expect(PayrollEntry.validateTaxCode('D0')).toBeNull();
      expect(PayrollEntry.validateTaxCode('D1')).toBeNull();
      expect(PayrollEntry.validateTaxCode('NT')).toBeNull();
      expect(PayrollEntry.validateTaxCode('0T')).toBeNull();
    });

    test('should reject invalid tax codes', () => {
      expect(PayrollEntry.validateTaxCode('INVALID')).not.toBeNull();
      expect(PayrollEntry.validateTaxCode('12345L')).not.toBeNull();
    });

    test('should reject empty tax code', () => {
      expect(PayrollEntry.validateTaxCode('')).not.toBeNull();
    });
  });

  describe('validatePayrollEntryData', () => {
    const validEntryData = {
      employeeId: 1,
      userId: 1,
      payPeriodStart: '2024-01-01',
      payPeriodEnd: '2024-01-31',
      payDate: '2024-01-31',
      taxCode: '1257L'
    };

    test('should pass validation for valid data', () => {
      const result = PayrollEntry.validatePayrollEntryData(validEntryData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    test('should fail for missing required fields', () => {
      const result = PayrollEntry.validatePayrollEntryData({});
      expect(result.isValid).toBe(false);
      expect(result.errors.employeeId).toBeDefined();
      expect(result.errors.userId).toBeDefined();
      expect(result.errors.payPeriodStart).toBeDefined();
      expect(result.errors.payPeriodEnd).toBeDefined();
      expect(result.errors.payDate).toBeDefined();
      expect(result.errors.taxCode).toBeDefined();
    });

    test('should validate date formats', () => {
      const result = PayrollEntry.validatePayrollEntryData({
        ...validEntryData,
        payPeriodStart: 'invalid-date'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.payPeriodStart).toContain('Invalid');
    });

    test('should validate payPeriodEnd is after payPeriodStart', () => {
      const result = PayrollEntry.validatePayrollEntryData({
        ...validEntryData,
        payPeriodEnd: '2023-12-31' // Before payPeriodStart
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.payPeriodEnd).toContain('on or after');
    });

    test('should validate status values', () => {
      const result = PayrollEntry.validatePayrollEntryData({
        ...validEntryData,
        status: 'invalid_status'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.status).toContain('Invalid status');
    });

    test('should validate NI category values', () => {
      const result = PayrollEntry.validatePayrollEntryData({
        ...validEntryData,
        niCategory: 'X'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.niCategory).toContain('Invalid niCategory');
    });

    test('should validate monetary values are non-negative integers', () => {
      const result = PayrollEntry.validatePayrollEntryData({
        ...validEntryData,
        grossPay: -1000
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.grossPay).toContain('non-negative');
    });

    test('should validate overtimeRate is at least 1.0', () => {
      const result = PayrollEntry.validatePayrollEntryData({
        ...validEntryData,
        overtimeRate: 0.5
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.overtimeRate).toContain('at least 1.0');
    });

    test('should allow partial updates', () => {
      const result = PayrollEntry.validatePayrollEntryData({ grossPay: 300000 }, true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    const getValidEntryData = () => ({
      employeeId: testEmployeeId,
      userId: 1,
      payPeriodStart: '2024-01-01',
      payPeriodEnd: '2024-01-31',
      payDate: '2024-01-31',
      taxCode: '1257L',
      grossPay: 300000, // £3,000 in pence
      taxableIncome: 280000,
      incomeTax: 45000,
      employeeNI: 25000,
      employerNI: 30000,
      netPay: 230000
    });

    describe('createPayrollEntry', () => {
      test('should create a payroll entry successfully', () => {
        const result = PayrollEntry.createPayrollEntry(getValidEntryData());
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.grossPay).toBe(300000);
        expect(result.data.taxCode).toBe('1257L');
      });

      test('should normalize tax code to uppercase', () => {
        const result = PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          taxCode: '1257l'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.taxCode).toBe('1257L');
      });

      test('should set default values', () => {
        const minimalData = {
          employeeId: testEmployeeId,
          userId: 1,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31',
          taxCode: '1257L'
        };
        
        const result = PayrollEntry.createPayrollEntry(minimalData);
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('draft');
        expect(result.data.niCategory).toBe('A');
        expect(result.data.overtimeRate).toBe(1.5);
        expect(result.data.grossPay).toBe(0);
      });

      test('should fail for invalid data', () => {
        const result = PayrollEntry.createPayrollEntry({
          employeeId: testEmployeeId,
          userId: 1
          // Missing required fields
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe('findById', () => {
      test('should find payroll entry by ID', () => {
        const createResult = PayrollEntry.createPayrollEntry(getValidEntryData());
        const entry = PayrollEntry.findById(createResult.data.id);
        
        expect(entry).toBeDefined();
        expect(entry.grossPay).toBe(300000);
      });

      test('should return null for non-existent ID', () => {
        const entry = PayrollEntry.findById(99999);
        expect(entry).toBeNull();
      });
    });

    describe('getEntriesByEmployeeId', () => {
      test('should return paginated entries', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-03-01',
          payPeriodEnd: '2024-03-31'
        });
        
        const result = PayrollEntry.getEntriesByEmployeeId(testEmployeeId, { page: 1, limit: 2 });
        
        expect(result.entries.length).toBe(2);
        expect(result.total).toBe(3);
      });

      test('should filter by status', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          status: 'draft'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          status: 'paid'
        });
        
        const result = PayrollEntry.getEntriesByEmployeeId(testEmployeeId, { status: 'draft' });
        
        expect(result.entries.length).toBe(1);
        expect(result.entries[0].status).toBe('draft');
      });
    });

    describe('getEntriesByUserId', () => {
      test('should return entries for user', () => {
        PayrollEntry.createPayrollEntry(getValidEntryData());
        
        const result = PayrollEntry.getEntriesByUserId(1, { page: 1, limit: 10 });
        
        expect(result.entries.length).toBe(1);
        expect(result.total).toBe(1);
      });

      test('should filter by date range', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payDate: '2024-01-31'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-03-01',
          payPeriodEnd: '2024-03-31',
          payDate: '2024-03-31'
        });
        
        const result = PayrollEntry.getEntriesByUserId(1, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });
        
        expect(result.entries.length).toBe(1);
      });
    });

    describe('updatePayrollEntry', () => {
      test('should update entry successfully', () => {
        const createResult = PayrollEntry.createPayrollEntry(getValidEntryData());
        const result = PayrollEntry.updatePayrollEntry(createResult.data.id, {
          grossPay: 350000,
          netPay: 260000
        });
        
        expect(result.success).toBe(true);
        expect(result.data.grossPay).toBe(350000);
        expect(result.data.netPay).toBe(260000);
      });

      test('should fail for non-existent entry', () => {
        const result = PayrollEntry.updatePayrollEntry(99999, { grossPay: 100000 });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('Payroll entry not found');
      });
    });

    describe('deletePayrollEntry', () => {
      test('should delete entry successfully', () => {
        const createResult = PayrollEntry.createPayrollEntry(getValidEntryData());
        const result = PayrollEntry.deletePayrollEntry(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const entry = PayrollEntry.findById(createResult.data.id);
        expect(entry).toBeNull();
      });

      test('should fail for non-existent entry', () => {
        const result = PayrollEntry.deletePayrollEntry(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Payroll entry not found');
      });
    });

    describe('updateStatus', () => {
      test('should update status successfully', () => {
        const createResult = PayrollEntry.createPayrollEntry(getValidEntryData());
        const result = PayrollEntry.updateStatus(createResult.data.id, 'approved');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('approved');
      });

      test('should fail for invalid status', () => {
        const createResult = PayrollEntry.createPayrollEntry(getValidEntryData());
        const result = PayrollEntry.updateStatus(createResult.data.id, 'invalid');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });
    });
  });

  describe('Utility Functions', () => {
    const getValidEntryData = () => ({
      employeeId: testEmployeeId,
      userId: 1,
      payPeriodStart: '2024-01-01',
      payPeriodEnd: '2024-01-31',
      payDate: '2024-01-31',
      taxCode: '1257L',
      grossPay: 300000,
      incomeTax: 45000,
      employeeNI: 25000,
      employerNI: 30000,
      netPay: 230000
    });

    describe('getLatestEntryForEmployee', () => {
      test('should return most recent entry', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payDate: '2024-01-31'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29'
        });
        
        const latest = PayrollEntry.getLatestEntryForEmployee(testEmployeeId);
        
        expect(latest).toBeDefined();
        expect(latest.payDate).toBe('2024-02-29');
      });

      test('should return null for employee with no entries', () => {
        const latest = PayrollEntry.getLatestEntryForEmployee(testEmployeeId);
        expect(latest).toBeNull();
      });
    });

    describe('getEntriesByPayPeriod', () => {
      test('should return entries for specific pay period', () => {
        PayrollEntry.createPayrollEntry(getValidEntryData());
        
        const entries = PayrollEntry.getEntriesByPayPeriod(1, '2024-01-01', '2024-01-31');
        
        expect(entries.length).toBe(1);
      });
    });

    describe('getPayrollSummary', () => {
      test('should calculate summary correctly', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          status: 'paid'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29',
          status: 'paid'
        });
        
        const summary = PayrollEntry.getPayrollSummary(1, '2024-01-01', '2024-12-31');
        
        expect(summary.totalGross).toBe(600000); // 2 x 300000
        expect(summary.totalNet).toBe(460000);   // 2 x 230000
        expect(summary.totalTax).toBe(90000);    // 2 x 45000
        expect(summary.entryCount).toBe(2);
      });

      test('should exclude cancelled entries', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          status: 'paid'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29',
          status: 'cancelled'
        });
        
        const summary = PayrollEntry.getPayrollSummary(1, '2024-01-01', '2024-12-31');
        
        expect(summary.entryCount).toBe(1);
        expect(summary.totalGross).toBe(300000);
      });
    });

    describe('getStatusCounts', () => {
      test('should return counts by status', () => {
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          status: 'draft'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29',
          status: 'draft'
        });
        PayrollEntry.createPayrollEntry({
          ...getValidEntryData(),
          payPeriodStart: '2024-03-01',
          payPeriodEnd: '2024-03-31',
          payDate: '2024-03-31',
          status: 'paid'
        });
        
        const counts = PayrollEntry.getStatusCounts(1);
        
        expect(counts.draft).toBe(2);
        expect(counts.paid).toBe(1);
        expect(counts.approved).toBe(0);
      });
    });

    describe('calculateNetPay', () => {
      test('should calculate net pay correctly', () => {
        const netPay = PayrollEntry.calculateNetPay(
          300000, // grossPay
          45000,  // incomeTax
          25000,  // employeeNI
          5000,   // studentLoanDeduction
          15000,  // pensionEmployeeContribution
          0       // otherDeductions
        );
        
        expect(netPay).toBe(210000);
      });

      test('should handle zero deductions', () => {
        const netPay = PayrollEntry.calculateNetPay(300000);
        expect(netPay).toBe(300000);
      });
    });
  });

  describe('Constants', () => {
    test('should export valid statuses', () => {
      expect(PayrollEntry.PAYROLL_ENTRY_STATUSES).toContain('draft');
      expect(PayrollEntry.PAYROLL_ENTRY_STATUSES).toContain('approved');
      expect(PayrollEntry.PAYROLL_ENTRY_STATUSES).toContain('paid');
      expect(PayrollEntry.PAYROLL_ENTRY_STATUSES).toContain('cancelled');
    });

    test('should export valid NI categories', () => {
      expect(PayrollEntry.VALID_NI_CATEGORIES).toContain('A');
      expect(PayrollEntry.VALID_NI_CATEGORIES).toContain('B');
      expect(PayrollEntry.VALID_NI_CATEGORIES).toContain('C');
      expect(PayrollEntry.VALID_NI_CATEGORIES).toContain('H');
      expect(PayrollEntry.VALID_NI_CATEGORIES).toContain('M');
    });
  });
});
