/**
 * Unit tests for Employee model.
 * Tests validation, CRUD operations, and NI number/tax code validation.
 * 
 * @module tests/Employee.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Employee = require('../database/models/Employee');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-employee-database.sqlite');

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
  executeMany('DELETE FROM payroll_entries;');
  executeMany('DELETE FROM employees;');
  executeMany('DELETE FROM users;');
  // Insert a test user for foreign key constraint
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (1, 'test@example.com', 'hash', 'Test User');
  `);
});

describe('Employee Model', () => {
  describe('NI Number Validation', () => {
    test('should accept valid NI number format', () => {
      expect(Employee.validateNINumber('AB123456C')).toBeNull();
      expect(Employee.validateNINumber('JG103759A')).toBeNull();
      expect(Employee.validateNINumber('NZ123456D')).toBeNull();
    });

    test('should accept NI number with spaces', () => {
      expect(Employee.validateNINumber('AB 12 34 56 C')).toBeNull();
      expect(Employee.validateNINumber('JG 103759 A')).toBeNull();
    });

    test('should accept lowercase NI number', () => {
      expect(Employee.validateNINumber('ab123456c')).toBeNull();
    });

    test('should reject NI number with invalid prefix BG', () => {
      expect(Employee.validateNINumber('BG123456A')).not.toBeNull();
    });

    test('should reject NI number with invalid prefix GB', () => {
      expect(Employee.validateNINumber('GB123456A')).not.toBeNull();
    });

    test('should reject NI number with invalid prefix NK', () => {
      expect(Employee.validateNINumber('NK123456A')).not.toBeNull();
    });

    test('should reject NI number with invalid prefix TN', () => {
      expect(Employee.validateNINumber('TN123456A')).not.toBeNull();
    });

    test('should reject NI number with invalid prefix ZZ', () => {
      expect(Employee.validateNINumber('ZZ123456A')).not.toBeNull();
    });

    test('should reject NI number with D as first letter', () => {
      expect(Employee.validateNINumber('DA123456A')).not.toBeNull();
    });

    test('should reject NI number with O as second letter', () => {
      expect(Employee.validateNINumber('AO123456A')).not.toBeNull();
    });

    test('should reject NI number with wrong suffix', () => {
      expect(Employee.validateNINumber('AB123456E')).not.toBeNull();
      expect(Employee.validateNINumber('AB123456Z')).not.toBeNull();
    });

    test('should reject NI number with wrong length', () => {
      expect(Employee.validateNINumber('AB12345C')).not.toBeNull();
      expect(Employee.validateNINumber('AB1234567C')).not.toBeNull();
    });

    test('should allow empty NI number (optional field)', () => {
      expect(Employee.validateNINumber('')).toBeNull();
      expect(Employee.validateNINumber(null)).toBeNull();
    });
  });

  describe('Tax Code Validation', () => {
    test('should accept standard tax codes', () => {
      expect(Employee.validateTaxCode('1257L')).toBeNull();
      expect(Employee.validateTaxCode('1185L')).toBeNull();
      expect(Employee.validateTaxCode('K475')).toBeNull();
      expect(Employee.validateTaxCode('1100M')).toBeNull();
      expect(Employee.validateTaxCode('1100N')).toBeNull();
    });

    test('should accept Scottish tax codes', () => {
      expect(Employee.validateTaxCode('S1257L')).toBeNull();
      expect(Employee.validateTaxCode('SK475')).toBeNull();
    });

    test('should accept Welsh tax codes', () => {
      expect(Employee.validateTaxCode('C1257L')).toBeNull();
    });

    test('should accept emergency tax codes', () => {
      expect(Employee.validateTaxCode('1257L W1')).toBeNull();
      expect(Employee.validateTaxCode('1257L M1')).toBeNull();
      expect(Employee.validateTaxCode('1257L X')).toBeNull();
    });

    test('should accept special tax codes', () => {
      expect(Employee.validateTaxCode('BR')).toBeNull();
      expect(Employee.validateTaxCode('D0')).toBeNull();
      expect(Employee.validateTaxCode('D1')).toBeNull();
      expect(Employee.validateTaxCode('NT')).toBeNull();
      expect(Employee.validateTaxCode('0T')).toBeNull();
    });

    test('should accept lowercase tax codes', () => {
      expect(Employee.validateTaxCode('1257l')).toBeNull();
      expect(Employee.validateTaxCode('br')).toBeNull();
    });

    test('should reject invalid tax codes', () => {
      expect(Employee.validateTaxCode('INVALID')).not.toBeNull();
      expect(Employee.validateTaxCode('12345L')).not.toBeNull();
      expect(Employee.validateTaxCode('ABC')).not.toBeNull();
    });

    test('should reject empty tax code', () => {
      expect(Employee.validateTaxCode('')).not.toBeNull();
    });
  });

  describe('validateEmployeeData', () => {
    const validEmployeeData = {
      userId: 1,
      employeeNumber: 'EMP-0001',
      firstName: 'John',
      lastName: 'Doe',
      startDate: '2024-01-15',
      taxCode: '1257L'
    };

    test('should pass validation for valid data', () => {
      const result = Employee.validateEmployeeData(validEmployeeData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    test('should fail for missing required fields', () => {
      const result = Employee.validateEmployeeData({});
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
      expect(result.errors.employeeNumber).toBeDefined();
      expect(result.errors.firstName).toBeDefined();
      expect(result.errors.lastName).toBeDefined();
      expect(result.errors.startDate).toBeDefined();
    });

    test('should validate email format', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        email: 'invalid-email'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Invalid email');
    });

    test('should validate NI number format', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        niNumber: 'INVALID'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.niNumber).toContain('Invalid UK National Insurance');
    });

    test('should validate date of birth age range', () => {
      // Too young
      const result1 = Employee.validateEmployeeData({
        ...validEmployeeData,
        dateOfBirth: '2015-01-01'
      });
      expect(result1.isValid).toBe(false);
      expect(result1.errors.dateOfBirth).toContain('between 16 and 100');

      // Too old
      const result2 = Employee.validateEmployeeData({
        ...validEmployeeData,
        dateOfBirth: '1920-01-01'
      });
      expect(result2.isValid).toBe(false);
    });

    test('should validate bank account number format', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        bankAccountNumber: '12345'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.bankAccountNumber).toContain('8 digits');
    });

    test('should validate sort code format', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        bankSortCode: '123'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.bankSortCode).toContain('6 digits');
    });

    test('should validate status values', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        status: 'invalid_status'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.status).toContain('Invalid status');
    });

    test('should validate pay frequency values', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        payFrequency: 'invalid'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.payFrequency).toContain('Invalid payFrequency');
    });

    test('should validate student loan plan values', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        studentLoanPlan: 'plan3'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.studentLoanPlan).toContain('Invalid studentLoanPlan');
    });

    test('should validate endDate is after startDate', () => {
      const result = Employee.validateEmployeeData({
        ...validEmployeeData,
        endDate: '2023-01-01' // Before startDate
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.endDate).toContain('on or after startDate');
    });

    test('should allow partial updates', () => {
      const result = Employee.validateEmployeeData({ firstName: 'Jane' }, true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    const validEmployeeData = {
      userId: 1,
      employeeNumber: 'EMP-0001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      niNumber: 'AB123456C',
      taxCode: '1257L',
      dateOfBirth: '1990-05-15',
      startDate: '2024-01-15',
      status: 'active',
      payFrequency: 'monthly',
      annualSalary: 3500000, // £35,000 in pence
      address: '123 Test Street, London',
      phoneNumber: '+447123456789',
      bankAccountNumber: '12345678',
      bankSortCode: '123456',
      pensionOptIn: true,
      pensionContribution: 500 // 5.00%
    };

    describe('createEmployee', () => {
      test('should create an employee successfully', () => {
        const result = Employee.createEmployee(validEmployeeData);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.firstName).toBe('John');
        expect(result.data.lastName).toBe('Doe');
        expect(result.data.niNumber).toBe('AB123456C');
        expect(result.data.pensionOptIn).toBe(true);
      });

      test('should auto-generate employee number if not provided', () => {
        const dataWithoutNumber = { ...validEmployeeData };
        delete dataWithoutNumber.employeeNumber;
        
        const result = Employee.createEmployee(dataWithoutNumber);
        
        expect(result.success).toBe(true);
        expect(result.data.employeeNumber).toMatch(/^EMP-\d{4}$/);
      });

      test('should normalize NI number format', () => {
        const result = Employee.createEmployee({
          ...validEmployeeData,
          niNumber: 'ab 12 34 56 c'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.niNumber).toBe('AB123456C');
      });

      test('should normalize email to lowercase', () => {
        const result = Employee.createEmployee({
          ...validEmployeeData,
          email: 'JOHN.DOE@EXAMPLE.COM'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.email).toBe('john.doe@example.com');
      });

      test('should fail for duplicate employee number', () => {
        Employee.createEmployee(validEmployeeData);
        const result = Employee.createEmployee(validEmployeeData);
        
        expect(result.success).toBe(false);
        expect(result.errors.employeeNumber).toContain('already exists');
      });

      test('should fail for invalid data', () => {
        const result = Employee.createEmployee({
          userId: 1,
          firstName: 'John'
          // Missing required fields
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe('findById', () => {
      test('should find employee by ID', () => {
        const createResult = Employee.createEmployee(validEmployeeData);
        const employee = Employee.findById(createResult.data.id);
        
        expect(employee).toBeDefined();
        expect(employee.firstName).toBe('John');
      });

      test('should return null for non-existent ID', () => {
        const employee = Employee.findById(99999);
        expect(employee).toBeNull();
      });
    });

    describe('findByEmployeeNumber', () => {
      test('should find employee by employee number', () => {
        Employee.createEmployee(validEmployeeData);
        const employee = Employee.findByEmployeeNumber(1, 'EMP-0001');
        
        expect(employee).toBeDefined();
        expect(employee.firstName).toBe('John');
      });

      test('should find employee case-insensitively', () => {
        Employee.createEmployee(validEmployeeData);
        const employee = Employee.findByEmployeeNumber(1, 'emp-0001');
        
        expect(employee).toBeDefined();
      });
    });

    describe('findByNINumber', () => {
      test('should find employee by NI number', () => {
        Employee.createEmployee(validEmployeeData);
        const employee = Employee.findByNINumber('AB123456C');
        
        expect(employee).toBeDefined();
        expect(employee.firstName).toBe('John');
      });

      test('should find employee with spaces in NI number', () => {
        Employee.createEmployee(validEmployeeData);
        const employee = Employee.findByNINumber('AB 12 34 56 C');
        
        expect(employee).toBeDefined();
      });
    });

    describe('getEmployeesByUserId', () => {
      test('should return paginated employees', () => {
        Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0001' });
        Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0002', firstName: 'Jane' });
        Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0003', firstName: 'Bob' });
        
        const result = Employee.getEmployeesByUserId(1, { page: 1, limit: 2 });
        
        expect(result.employees.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });

      test('should filter by status', () => {
        Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0001', status: 'active' });
        Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0002', status: 'terminated' });
        
        const result = Employee.getEmployeesByUserId(1, { status: 'active' });
        
        expect(result.employees.length).toBe(1);
        expect(result.employees[0].status).toBe('active');
      });
    });

    describe('updateEmployee', () => {
      test('should update employee successfully', () => {
        const createResult = Employee.createEmployee(validEmployeeData);
        const result = Employee.updateEmployee(createResult.data.id, {
          firstName: 'Jane',
          annualSalary: 4000000
        });
        
        expect(result.success).toBe(true);
        expect(result.data.firstName).toBe('Jane');
        expect(result.data.annualSalary).toBe(4000000);
      });

      test('should fail for non-existent employee', () => {
        const result = Employee.updateEmployee(99999, { firstName: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('Employee not found');
      });

      test('should prevent duplicate employee number', () => {
        Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0001' });
        const createResult = Employee.createEmployee({ ...validEmployeeData, employeeNumber: 'EMP-0002' });
        
        const result = Employee.updateEmployee(createResult.data.id, {
          employeeNumber: 'EMP-0001'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.employeeNumber).toContain('already exists');
      });
    });

    describe('deleteEmployee', () => {
      test('should delete employee successfully', () => {
        const createResult = Employee.createEmployee(validEmployeeData);
        const result = Employee.deleteEmployee(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const employee = Employee.findById(createResult.data.id);
        expect(employee).toBeNull();
      });

      test('should fail for non-existent employee', () => {
        const result = Employee.deleteEmployee(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Employee not found');
      });
    });

    describe('updateStatus', () => {
      test('should update status successfully', () => {
        const createResult = Employee.createEmployee(validEmployeeData);
        const result = Employee.updateStatus(createResult.data.id, 'terminated');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('terminated');
      });

      test('should fail for invalid status', () => {
        const createResult = Employee.createEmployee(validEmployeeData);
        const result = Employee.updateStatus(createResult.data.id, 'invalid');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('generateEmployeeNumber', () => {
      test('should generate sequential employee numbers', () => {
        const num1 = Employee.generateEmployeeNumber(1);
        expect(num1).toBe('EMP-0001');
        
        Employee.createEmployee({
          userId: 1,
          employeeNumber: num1,
          firstName: 'John',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L'
        });
        
        const num2 = Employee.generateEmployeeNumber(1);
        expect(num2).toBe('EMP-0002');
      });
    });

    describe('getActiveEmployees', () => {
      test('should return only active employees', () => {
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0001',
          firstName: 'John',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L',
          status: 'active'
        });
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0002',
          firstName: 'Jane',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L',
          status: 'terminated'
        });
        
        const activeEmployees = Employee.getActiveEmployees(1);
        
        expect(activeEmployees.length).toBe(1);
        expect(activeEmployees[0].firstName).toBe('John');
      });
    });

    describe('searchByName', () => {
      test('should search employees by name', () => {
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0001',
          firstName: 'John',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L'
        });
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0002',
          firstName: 'Jane',
          lastName: 'Smith',
          startDate: '2024-01-15',
          taxCode: '1257L'
        });
        
        const results = Employee.searchByName(1, 'John');
        
        expect(results.length).toBe(1);
        expect(results[0].firstName).toBe('John');
      });

      test('should search by last name', () => {
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0001',
          firstName: 'John',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L'
        });
        
        const results = Employee.searchByName(1, 'Doe');
        
        expect(results.length).toBe(1);
      });
    });

    describe('getStatusCounts', () => {
      test('should return counts by status', () => {
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0001',
          firstName: 'John',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L',
          status: 'active'
        });
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0002',
          firstName: 'Jane',
          lastName: 'Doe',
          startDate: '2024-01-15',
          taxCode: '1257L',
          status: 'active'
        });
        Employee.createEmployee({
          userId: 1,
          employeeNumber: 'EMP-0003',
          firstName: 'Bob',
          lastName: 'Smith',
          startDate: '2024-01-15',
          taxCode: '1257L',
          status: 'terminated'
        });
        
        const counts = Employee.getStatusCounts(1);
        
        expect(counts.active).toBe(2);
        expect(counts.terminated).toBe(1);
        expect(counts.inactive).toBe(0);
      });
    });

    describe('sanitizeEmployee', () => {
      test('should convert pensionOptIn to boolean', () => {
        const employee = {
          id: 1,
          firstName: 'John',
          pensionOptIn: 1
        };
        
        const sanitized = Employee.sanitizeEmployee(employee);
        expect(sanitized.pensionOptIn).toBe(true);
      });

      test('should return null for null input', () => {
        expect(Employee.sanitizeEmployee(null)).toBeNull();
      });
    });
  });
});
