/**
 * API integration tests for Reports endpoints.
 * Tests PAYE summary report generation operations.
 * 
 * @module tests/reports.api.test
 */

const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../app');
const { openDatabase, closeDatabase, execute } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const Employee = require('../database/models/Employee');
const PayrollEntry = require('../database/models/PayrollEntry');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-reports-api-database.sqlite');

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
      email: 'reports-test@example.com',
      password: 'TestPassword123!',
      name: 'Reports Test User'
    });
  
  if (registerRes.status === 201) {
    authToken = registerRes.body.data.token;
    testUserId = registerRes.body.data.user.id;
  } else {
    // User might already exist, try login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'reports-test@example.com',
        password: 'TestPassword123!'
      });
    
    authToken = loginRes.body.data.token;
    testUserId = loginRes.body.data.user.id;
  }
  
  // Create a test employee
  const employeeResult = Employee.createEmployee({
    userId: testUserId,
    employeeNumber: 'REP-0001',
    firstName: 'Alice',
    lastName: 'Johnson',
    startDate: '2024-01-01',
    taxCode: '1257L',
    payFrequency: 'monthly',
    annualSalary: 3600000 // £36,000 annual
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
  execute('DELETE FROM payroll_entries WHERE userId = ?', [testUserId]);
});

describe('Reports API', () => {
  describe('GET /api/reports/paye-summary', () => {
    test('should get PAYE summary for date range', async () => {
      // Create a payroll entry first
      PayrollEntry.createPayrollEntry({
        employeeId: testEmployeeId,
        userId: testUserId,
        payPeriodStart: '2025-01-01',
        payPeriodEnd: '2025-01-31',
        payDate: '2025-01-31',
        status: 'paid',
        grossPay: 300000,
        taxableIncome: 195000,
        incomeTax: 39000,
        employeeNI: 20000,
        employerNI: 30000,
        studentLoanDeduction: 5000,
        pensionEmployeeContribution: 15000,
        pensionEmployerContribution: 9000,
        netPay: 221000,
        taxCode: '1257L'
      });

      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Check period info
      expect(res.body.data.period.startDate).toBe('2025-01-01');
      expect(res.body.data.period.endDate).toBe('2025-01-31');
      
      // Check totals
      expect(res.body.data.totals.grossPay).toBe(300000);
      expect(res.body.data.totals.incomeTax).toBe(39000);
      expect(res.body.data.totals.employeeNI).toBe(20000);
      expect(res.body.data.totals.employerNI).toBe(30000);
      
      // Check HMRC liability
      expect(res.body.data.hmrcLiability.totalLiability).toBe(94000); // 39000 + 20000 + 30000 + 5000
      expect(res.body.data.hmrcLiability.paymentDeadline).toBe('2025-02-22');
      
      // Check employee breakdown
      expect(res.body.data.employeeBreakdown).toHaveLength(1);
      expect(res.body.data.employeeBreakdown[0].firstName).toBe('Alice');
      
      // Check monthly summary
      expect(res.body.data.monthlySummary).toHaveLength(1);
      expect(res.body.data.monthlySummary[0].monthName).toBe('January');
    });

    test('should return empty summary when no payroll entries exist', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-06-01',
          endDate: '2025-06-30'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totals.grossPay).toBe(0);
      expect(res.body.data.employeeBreakdown).toHaveLength(0);
      expect(res.body.data.entriesCount).toBe(0);
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.status).toBe(401);
    });

    test('should fail without start date', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          endDate: '2025-01-31'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail without end date', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid date format', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '01-01-2025',
          endDate: '31-01-2025'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail when start date is after end date', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-02-01',
          endDate: '2025-01-01'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reports/paye-summary/tax-year/:taxYear', () => {
    test('should get PAYE summary for tax year', async () => {
      // Create a payroll entry in tax year 2025-26
      PayrollEntry.createPayrollEntry({
        employeeId: testEmployeeId,
        userId: testUserId,
        payPeriodStart: '2025-05-01',
        payPeriodEnd: '2025-05-31',
        payDate: '2025-05-31',
        status: 'paid',
        grossPay: 300000,
        incomeTax: 39000,
        employeeNI: 20000,
        employerNI: 30000,
        netPay: 241000,
        taxCode: '1257L'
      });

      const res = await request(app)
        .get('/api/reports/paye-summary/tax-year/2025-26')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.startDate).toBe('2025-04-06');
      expect(res.body.data.period.endDate).toBe('2026-04-05');
      expect(res.body.data.period.taxYear).toBe('2025-26');
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/tax-year/2025-26');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid tax year format', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/tax-year/2025')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid tax year sequence', async () => {
      // 2025-27 is invalid (should be 2025-26)
      const res = await request(app)
        .get('/api/reports/paye-summary/tax-year/2025-27')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reports/paye-summary/monthly/:year/:month', () => {
    test('should get PAYE summary for specific month', async () => {
      // Create a payroll entry for January 2025
      PayrollEntry.createPayrollEntry({
        employeeId: testEmployeeId,
        userId: testUserId,
        payPeriodStart: '2025-01-01',
        payPeriodEnd: '2025-01-31',
        payDate: '2025-01-31',
        status: 'paid',
        grossPay: 300000,
        incomeTax: 39000,
        employeeNI: 20000,
        employerNI: 30000,
        netPay: 241000,
        taxCode: '1257L'
      });

      const res = await request(app)
        .get('/api/reports/paye-summary/monthly/2025/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.startDate).toBe('2025-01-01');
      expect(res.body.data.period.endDate).toBe('2025-01-31');
      expect(res.body.meta.monthName).toBe('January');
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/monthly/2025/1');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid year', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/monthly/1999/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid month (too low)', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/monthly/2025/0')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should fail with invalid month (too high)', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/monthly/2025/13')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/reports/paye-summary/deadline/:year/:month', () => {
    test('should get payment deadline for month', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/deadline/2025/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period.year).toBe(2025);
      expect(res.body.data.period.month).toBe(1);
      expect(res.body.data.period.monthName).toBe('January');
      expect(res.body.data.deadlines.electronic.date).toBe('2025-02-22');
      expect(res.body.data.deadlines.postal.date).toBe('2025-02-19');
    });

    test('should handle December correctly (year rollover)', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/deadline/2025/12')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.deadlines.electronic.date).toBe('2026-01-22');
      expect(res.body.data.deadlines.postal.date).toBe('2026-01-19');
    });

    test('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/deadline/2025/1');
      
      expect(res.status).toBe(401);
    });

    test('should fail with invalid year', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/deadline/1999/1')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
    });

    test('should fail with invalid month', async () => {
      const res = await request(app)
        .get('/api/reports/paye-summary/deadline/2025/13')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(400);
    });
  });

  describe('PAYE Summary Calculations', () => {
    test('should calculate total payroll cost correctly', async () => {
      // Gross + Employer NI + Employer Pension
      PayrollEntry.createPayrollEntry({
        employeeId: testEmployeeId,
        userId: testUserId,
        payPeriodStart: '2025-01-01',
        payPeriodEnd: '2025-01-31',
        payDate: '2025-01-31',
        status: 'paid',
        grossPay: 300000,
        employerNI: 30000,
        pensionEmployerContribution: 9000,
        incomeTax: 39000,
        employeeNI: 20000,
        netPay: 241000,
        taxCode: '1257L'
      });

      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      // Total payroll cost = gross (300000) + employer NI (30000) + employer pension (9000)
      expect(res.body.data.totals.totalPayrollCost).toBe(339000);
    });

    test('should aggregate multiple payroll entries correctly', async () => {
      // Create second employee
      const employee2 = Employee.createEmployee({
        userId: testUserId,
        employeeNumber: 'REP-0002',
        firstName: 'Bob',
        lastName: 'Williams',
        startDate: '2024-01-01',
        taxCode: '1257L',
        payFrequency: 'monthly',
        annualSalary: 4800000
      });

      // Create payroll for employee 1
      PayrollEntry.createPayrollEntry({
        employeeId: testEmployeeId,
        userId: testUserId,
        payPeriodStart: '2025-01-01',
        payPeriodEnd: '2025-01-31',
        payDate: '2025-01-31',
        status: 'paid',
        grossPay: 300000,
        incomeTax: 39000,
        employeeNI: 20000,
        employerNI: 30000,
        netPay: 241000,
        taxCode: '1257L'
      });

      // Create payroll for employee 2
      PayrollEntry.createPayrollEntry({
        employeeId: employee2.data.id,
        userId: testUserId,
        payPeriodStart: '2025-01-01',
        payPeriodEnd: '2025-01-31',
        payDate: '2025-01-31',
        status: 'paid',
        grossPay: 400000,
        incomeTax: 58000,
        employeeNI: 28000,
        employerNI: 40000,
        netPay: 314000,
        taxCode: '1257L'
      });

      const res = await request(app)
        .get('/api/reports/paye-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        });
      
      expect(res.body.data.entriesCount).toBe(2);
      expect(res.body.data.totals.grossPay).toBe(700000);
      expect(res.body.data.totals.incomeTax).toBe(97000);
      expect(res.body.data.totals.employeeNI).toBe(48000);
      expect(res.body.data.totals.employerNI).toBe(70000);
      expect(res.body.data.employeeBreakdown).toHaveLength(2);
    });
  });
});
