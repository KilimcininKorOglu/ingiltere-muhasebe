/**
 * Integration Tests for Employee API Endpoints
 * Tests CRUD operations, validation, and authorization.
 * 
 * @module __tests__/employees.api.test
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const { generateToken } = require('../utils/jwt');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-employees-api-database.sqlite');

// Test user data
const testUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User'
};

const anotherUser = {
  id: 2,
  email: 'other@example.com',
  name: 'Other User'
};

let authToken;
let otherAuthToken;

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
  process.env.NODE_ENV = 'test';
  
  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Generate auth tokens
  authToken = generateToken(testUser);
  otherAuthToken = generateToken(anotherUser);
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
  // Insert test users
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (1, 'test@example.com', 'hash', 'Test User'),
           (2, 'other@example.com', 'hash', 'Other User');
  `);
});

// Valid employee data for testing
const validEmployeeData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  niNumber: 'AB123456C',
  taxCode: '1257L',
  dateOfBirth: '1990-05-15',
  startDate: '2024-01-15',
  status: 'active',
  payFrequency: 'monthly',
  annualSalary: 3500000,
  address: '123 Test Street, London',
  phoneNumber: '+447123456789',
  bankAccountNumber: '12345678',
  bankSortCode: '123456',
  pensionOptIn: true,
  pensionContribution: 500
};

describe('Employee API', () => {
  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const response = await request(app)
        .get('/api/employees')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('POST /api/employees', () => {
    it('should create a new employee', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validEmployeeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.firstName).toBe('John');
      expect(response.body.data.lastName).toBe('Doe');
      expect(response.body.data.niNumber).toBe('AB123456C');
      expect(response.body.data.employeeNumber).toMatch(/^EMP-\d{4}$/);
    });

    it('should normalize NI number format', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validEmployeeData,
          niNumber: 'ab 12 34 56 c'
        })
        .expect(201);

      expect(response.body.data.niNumber).toBe('AB123456C');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    it('should return 400 for invalid NI number', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validEmployeeData,
          niNumber: 'INVALID'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.find(d => d.field === 'niNumber')).toBeDefined();
    });

    it('should return 400 for invalid tax code', async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validEmployeeData,
          taxCode: 'INVALID'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.find(d => d.field === 'taxCode')).toBeDefined();
    });
  });

  describe('GET /api/employees', () => {
    beforeEach(async () => {
      // Create test employees
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0001' });
      
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0002', firstName: 'Jane', status: 'terminated' });
    });

    it('should return only active employees by default', async () => {
      const response = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('active');
    });

    it('should return all employees when includeAll=true', async () => {
      const response = await request(app)
        .get('/api/employees?includeAll=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/employees?includeAll=true&page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(1);
      expect(response.body.meta.total).toBe(2);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/employees?status=terminated')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('terminated');
    });
  });

  describe('GET /api/employees/:id', () => {
    let employeeId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validEmployeeData);
      employeeId = response.body.data.id;
    });

    it('should return an employee by ID', async () => {
      const response = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(employeeId);
      expect(response.body.data.firstName).toBe('John');
    });

    it('should return 404 for non-existent employee', async () => {
      const response = await request(app)
        .get('/api/employees/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should return 403 for employee owned by another user', async () => {
      const response = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHZ_RESOURCE_OWNER_ONLY');
    });

    it('should return 400 for invalid employee ID', async () => {
      const response = await request(app)
        .get('/api/employees/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/employees/:id', () => {
    let employeeId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validEmployeeData);
      employeeId = response.body.data.id;
    });

    it('should update an employee', async () => {
      const response = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Jane', annualSalary: 4000000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Jane');
      expect(response.body.data.annualSalary).toBe(4000000);
    });

    it('should return 404 for non-existent employee', async () => {
      const response = await request(app)
        .put('/api/employees/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Jane' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for employee owned by another user', async () => {
      const response = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send({ firstName: 'Hacked' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ niNumber: 'INVALID' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/employees/:id (Soft Delete)', () => {
    let employeeId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validEmployeeData);
      employeeId = response.body.data.id;
    });

    it('should soft delete an employee (set end date and terminated status)', async () => {
      const response = await request(app)
        .delete(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('terminated');
      expect(response.body.data.endDate).toBeDefined();
      
      // Verify employee still exists
      const getResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(getResponse.body.data.status).toBe('terminated');
    });

    it('should return 404 for non-existent employee', async () => {
      const response = await request(app)
        .delete('/api/employees/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for employee owned by another user', async () => {
      const response = await request(app)
        .delete(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/employees/:id/permanent', () => {
    let employeeId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validEmployeeData);
      employeeId = response.body.data.id;
    });

    it('should permanently delete an employee', async () => {
      const response = await request(app)
        .delete(`/api/employees/${employeeId}/permanent`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify employee is gone
      const getResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(getResponse.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
    });
  });

  describe('GET /api/employees/search', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0001', firstName: 'John', lastName: 'Doe' });
      
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0002', firstName: 'Jane', lastName: 'Smith' });
    });

    it('should search employees by first name', async () => {
      const response = await request(app)
        .get('/api/employees/search?q=John')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].firstName).toBe('John');
    });

    it('should search employees by last name', async () => {
      const response = await request(app)
        .get('/api/employees/search?q=Smith')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].lastName).toBe('Smith');
    });

    it('should search employees by employee number', async () => {
      const response = await request(app)
        .get('/api/employees/search?q=EMP-0002')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should return 400 for missing search query', async () => {
      const response = await request(app)
        .get('/api/employees/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/employees/counts', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0001', status: 'active' });
      
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0002', status: 'active' });
      
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validEmployeeData, employeeNumber: 'EMP-0003', status: 'terminated' });
    });

    it('should return employee counts by status', async () => {
      const response = await request(app)
        .get('/api/employees/counts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(2);
      expect(response.body.data.terminated).toBe(1);
    });
  });

  describe('POST /api/employees/validate/ni-number', () => {
    it('should validate a valid NI number', async () => {
      const response = await request(app)
        .post('/api/employees/validate/ni-number')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ niNumber: 'AB123456C' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.niNumber).toBe('AB123456C');
    });

    it('should normalize and validate NI number with spaces', async () => {
      const response = await request(app)
        .post('/api/employees/validate/ni-number')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ niNumber: 'AB 12 34 56 C' })
        .expect(200);

      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.niNumber).toBe('AB123456C');
    });

    it('should return invalid for bad NI number', async () => {
      const response = await request(app)
        .post('/api/employees/validate/ni-number')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ niNumber: 'INVALID' })
        .expect(200);

      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });

    it('should reject NI number with invalid prefix', async () => {
      const response = await request(app)
        .post('/api/employees/validate/ni-number')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ niNumber: 'BG123456A' })
        .expect(200);

      expect(response.body.data.isValid).toBe(false);
    });

    it('should return 400 for missing NI number', async () => {
      const response = await request(app)
        .post('/api/employees/validate/ni-number')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/employees/validate/tax-code', () => {
    it('should validate a standard tax code', async () => {
      const response = await request(app)
        .post('/api/employees/validate/tax-code')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ taxCode: '1257L' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.taxCode).toBe('1257L');
    });

    it('should validate Scottish tax code', async () => {
      const response = await request(app)
        .post('/api/employees/validate/tax-code')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ taxCode: 'S1257L' })
        .expect(200);

      expect(response.body.data.isValid).toBe(true);
    });

    it('should validate special tax codes', async () => {
      const response = await request(app)
        .post('/api/employees/validate/tax-code')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ taxCode: 'BR' })
        .expect(200);

      expect(response.body.data.isValid).toBe(true);
    });

    it('should return invalid for bad tax code', async () => {
      const response = await request(app)
        .post('/api/employees/validate/tax-code')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ taxCode: 'INVALID' })
        .expect(200);

      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });

    it('should return 400 for missing tax code', async () => {
      const response = await request(app)
        .post('/api/employees/validate/tax-code')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
