/**
 * API integration tests for Payroll endpoints.
 * Tests payroll calculation, creation, and management operations.
 * 
 * @module tests/payroll.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../app');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Employee = require('../database/models/Employee');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-payroll-api-database.sqlite');

// Store test tokens and IDs
let authToken;
let testUserId;
let testEmployeeId;

/**
 * Setup test database before all tests.
 */
beforeAll(async () => {
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
  
  // Create a test user and get auth token
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      email: 'payroll-test@example.com',
      password: 'TestPassword123!',
      name: 'Payroll Test User'
    });
  
  if (registerRes.status === 201) {
    authToken = registerRes.body.data.token;
    testUserId = registerRes.body.data.user.id;
  } else {
    // User might already exist, try login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'payroll-test@example.com',
        password: 'TestPassword123!'
      });
    
    authToken = loginRes.body.data.token;
    testUserId = loginRes.body.data.user.id;
  }
  
  // Create a test employee
  const employeeResult = Employee.createEmployee({
    userId: testUserId,
    employeeNumber: 'PAY-0001',
    firstName: 'Jane',
    lastName: 'Smith',
    startDate: '2024-01-01',
    taxCode: '1257L',
    payFrequency: 'monthly',
    annualSalary: 3600000, // £36,000 annual
    pensionOptIn: true,
    pensionContribution: 500, // 5%
    studentLoanPlan: 'plan1'
  });
  testEmployeeId = employeeResult.data.id;
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
 * Clean up payroll entries before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM payroll_entries;');
});

describe('Payroll API', () => {
  describe('POST /api/payroll/calculate', () => {
    test('should calculate payroll without saving', async () => {
      const res = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
      expect(res.body.data.calculation.grossPay).toBeGreaterThan(0);
      expect(res.body.data.calculation.incomeTax).toBeGreaterThan(0);
      expect(res.body.data.calculation.employeeNI).toBeGreaterThan(0);
      expect(res.body.data.calculation.employerNI).toBeGreaterThan(0);
      expect(res.body.data.calculation.netPay).toBeGreaterThan(0);
    });

    test('should calculate payroll with custom gross pay', async () => {
      const res = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          grossPay: 400000 // £4,000
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.calculation.grossPay).toBe(400000);
    });

    test('should calculate payroll with bonus and commission', async () => {
      const res = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          bonus: 50000, // £500
          commission: 30000 // £300
        });
      
      expect(res.status).toBe(200);
      // Gross should include bonus and commission
      expect(res.body.data.calculation.grossPay).toBeGreaterThan(300000);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/payroll/calculate')
        .send({
          employeeId: testEmployeeId
        });
      
      expect(res.status).toBe(401);
    });

    test('should fail for non-existent employee', async () => {
      const res = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: 99999
        });
      
      expect(res.status).toBe(404);
    });

    test('should fail without employee ID', async () => {
      const res = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/payroll', () => {
    test('should create a payroll entry', async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.grossPay).toBeGreaterThan(0);
      expect(res.body.data.incomeTax).toBeGreaterThanOrEqual(0);
      expect(res.body.data.employeeNI).toBeGreaterThanOrEqual(0);
      expect(res.body.data.netPay).toBeGreaterThan(0);
      expect(res.body.data.status).toBe('draft');
    });

    test('should create payroll entry with custom values', async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29',
          grossPay: 350000,
          bonus: 50000,
          notes: 'February payroll with performance bonus'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.grossPay).toBe(400000); // 350000 + 50000
      expect(res.body.data.bonus).toBe(50000);
      expect(res.body.data.notes).toBe('February payroll with performance bonus');
    });

    test('should fail without required dates', async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/payroll', () => {
    beforeEach(async () => {
      // Create some test entries
      await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      
      await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29'
        });
    });

    test('should list payroll entries', async () => {
      const res = await request(app)
        .get('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    test('should paginate results', async () => {
      const res = await request(app)
        .get('/api/payroll?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(1);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    test('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/payroll?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/payroll/:id', () => {
    let testEntryId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      testEntryId = res.body.data.id;
    });

    test('should get a single payroll entry', async () => {
      const res = await request(app)
        .get(`/api/payroll/${testEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testEntryId);
      expect(res.body.data.employee).toBeDefined();
    });

    test('should return 404 for non-existent entry', async () => {
      const res = await request(app)
        .get('/api/payroll/99999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/payroll/employee/:employeeId', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
    });

    test('should get payroll entries for an employee', async () => {
      const res = await request(app)
        .get(`/api/payroll/employee/${testEmployeeId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee).toBeDefined();
      expect(res.body.data.entries).toBeInstanceOf(Array);
    });

    test('should return 404 for non-existent employee', async () => {
      const res = await request(app)
        .get('/api/payroll/employee/99999')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/payroll/:id', () => {
    let testEntryId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      testEntryId = res.body.data.id;
    });

    test('should update a draft payroll entry', async () => {
      const res = await request(app)
        .put(`/api/payroll/${testEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Updated notes'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated notes');
    });

    test('should not update a paid entry', async () => {
      // First mark as paid
      await request(app)
        .patch(`/api/payroll/${testEntryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'paid' });
      
      // Try to update
      const res = await request(app)
        .put(`/api/payroll/${testEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Try to update paid entry'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ENTRY_LOCKED');
    });
  });

  describe('PATCH /api/payroll/:id/status', () => {
    let testEntryId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      testEntryId = res.body.data.id;
    });

    test('should update status to approved', async () => {
      const res = await request(app)
        .patch(`/api/payroll/${testEntryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    test('should update status to paid', async () => {
      const res = await request(app)
        .patch(`/api/payroll/${testEntryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'paid' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });

    test('should fail for invalid status', async () => {
      const res = await request(app)
        .patch(`/api/payroll/${testEntryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid' });
      
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/payroll/:id', () => {
    let testEntryId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      testEntryId = res.body.data.id;
    });

    test('should delete a draft entry', async () => {
      const res = await request(app)
        .delete(`/api/payroll/${testEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Verify deletion
      const getRes = await request(app)
        .get(`/api/payroll/${testEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(404);
    });

    test('should not delete a non-draft entry', async () => {
      // Mark as approved
      await request(app)
        .patch(`/api/payroll/${testEntryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });
      
      // Try to delete
      const res = await request(app)
        .delete(`/api/payroll/${testEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ENTRY_LOCKED');
    });
  });

  describe('GET /api/payroll/summary', () => {
    beforeEach(async () => {
      // Create some test entries
      await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      
      await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29'
        });
    });

    test('should return payroll summary', async () => {
      const res = await request(app)
        .get('/api/payroll/summary?startDate=2024-01-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalGross).toBeGreaterThan(0);
      expect(res.body.data.summary.totalNet).toBeGreaterThan(0);
      expect(res.body.data.summary.entryCount).toBeGreaterThanOrEqual(2);
    });

    test('should fail without date range', async () => {
      const res = await request(app)
        .get('/api/payroll/summary')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/payroll/counts', () => {
    beforeEach(async () => {
      // Create entries with different statuses
      const entry1 = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-01-01',
          payPeriodEnd: '2024-01-31',
          payDate: '2024-01-31'
        });
      
      const entry2 = await request(app)
        .post('/api/payroll')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: testEmployeeId,
          payPeriodStart: '2024-02-01',
          payPeriodEnd: '2024-02-29',
          payDate: '2024-02-29'
        });
      
      // Mark one as paid
      await request(app)
        .patch(`/api/payroll/${entry2.body.data.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'paid' });
    });

    test('should return status counts', async () => {
      const res = await request(app)
        .get('/api/payroll/counts')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.draft).toBeGreaterThanOrEqual(1);
      expect(res.body.data.paid).toBeGreaterThanOrEqual(1);
    });
  });
});
