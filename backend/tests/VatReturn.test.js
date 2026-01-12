/**
 * Unit tests for VatReturn model.
 * Tests validation, CRUD operations, overlapping period constraints, and business logic.
 * 
 * @module tests/VatReturn.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations, rollbackAllMigrations } = require('../database/migrate');
const VatReturn = require('../database/models/VatReturn');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-vat-return-database.sqlite');

// Test user data (created in users table for foreign key)
let testUserId;

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
  const result = executeMany(`
    INSERT INTO users (email, passwordHash, name, businessName)
    VALUES ('testvat@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testvat@example.com');
  testUserId = user.id;
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
 * Clean up vat_returns table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM vat_returns;');
});

describe('VatReturn Model', () => {
  describe('validateVatReturnData', () => {
    describe('required fields', () => {
      test('should fail validation for missing userId', () => {
        const result = VatReturn.validateVatReturnData({
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.userId).toBeDefined();
      });

      test('should fail validation for missing periodStart', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodEnd: '2026-03-31'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.periodStart).toBeDefined();
      });

      test('should fail validation for missing periodEnd', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.periodEnd).toBeDefined();
      });
    });

    describe('date validation', () => {
      test('should fail validation for invalid periodStart format', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '01-01-2026',
          periodEnd: '2026-03-31'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.periodStart).toContain('Invalid periodStart format');
      });

      test('should fail validation for invalid periodEnd format', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '31-03-2026'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.periodEnd).toContain('Invalid periodEnd format');
      });

      test('should fail validation when periodEnd is before periodStart', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-03-31',
          periodEnd: '2026-01-01'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.periodEnd).toContain('periodEnd must be on or after periodStart');
      });
    });

    describe('status validation', () => {
      test('should fail validation for invalid status', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          status: 'invalid-status'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.status).toContain('Invalid status');
      });

      test('should pass validation for all valid status values', () => {
        const statuses = ['draft', 'pending', 'submitted', 'accepted', 'rejected', 'amended'];
        for (const status of statuses) {
          const result = VatReturn.validateVatReturnData({
            userId: 1,
            periodStart: '2026-01-01',
            periodEnd: '2026-03-31',
            status
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('box value validation', () => {
      test('should fail validation for negative box1', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box1: -100
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.box1).toContain('non-negative integer');
      });

      test('should fail validation for non-integer box values', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box1: 100.50
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.box1).toContain('must be an integer');
      });

      test('should allow negative box5 (refund)', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box5: -5000
        });
        expect(result.isValid).toBe(true);
      });

      test('should validate box3 equals box1 + box2', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box1: 10000,
          box2: 500,
          box3: 9000 // Wrong, should be 10500
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.box3).toContain('box3 should equal box1 + box2');
      });

      test('should validate box5 equals box3 - box4', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box3: 10000,
          box4: 3000,
          box5: 5000 // Wrong, should be 7000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.box5).toContain('box5 should equal box3 - box4');
      });

      test('should pass when box calculations are correct', () => {
        const result = VatReturn.validateVatReturnData({
          userId: 1,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box1: 10000,
          box2: 500,
          box3: 10500,
          box4: 3000,
          box5: 7500
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('update validation', () => {
      test('should allow partial updates without required fields', () => {
        const result = VatReturn.validateVatReturnData({ notes: 'Updated notes' }, true);
        expect(result.isValid).toBe(true);
      });

      test('should still validate provided fields on update', () => {
        const result = VatReturn.validateVatReturnData({ status: 'invalid' }, true);
        expect(result.isValid).toBe(false);
        expect(result.errors.status).toBeDefined();
      });
    });
  });

  describe('calculateDerivedBoxes', () => {
    test('should calculate box3 from box1 and box2', () => {
      const result = VatReturn.calculateDerivedBoxes({
        box1: 10000,
        box2: 500
      });
      expect(result.box3).toBe(10500);
    });

    test('should calculate box5 from box3 and box4', () => {
      const result = VatReturn.calculateDerivedBoxes({
        box1: 10000,
        box2: 500,
        box4: 3000
      });
      expect(result.box3).toBe(10500);
      expect(result.box5).toBe(7500);
    });

    test('should handle negative box5 (refund)', () => {
      const result = VatReturn.calculateDerivedBoxes({
        box1: 5000,
        box2: 0,
        box4: 8000
      });
      expect(result.box3).toBe(5000);
      expect(result.box5).toBe(-3000);
    });

    test('should handle missing values as zero', () => {
      const result = VatReturn.calculateDerivedBoxes({
        box1: 10000
      });
      expect(result.box3).toBe(10000);
      expect(result.box5).toBe(10000);
    });
  });

  describe('CRUD operations', () => {
    const validVatReturnData = {
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      box1: 10000,
      box2: 0,
      box4: 3000,
      box6: 50000,
      box7: 15000,
      box8: 0,
      box9: 0,
      notes: 'Q1 2026 VAT Return'
    };

    describe('createVatReturn', () => {
      test('should create a VAT return successfully', () => {
        const result = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.periodStart).toBe('2026-01-01');
        expect(result.data.periodEnd).toBe('2026-03-31');
        expect(result.data.status).toBe('draft');
      });

      test('should auto-calculate box3 and box5', () => {
        const result = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        expect(result.success).toBe(true);
        expect(result.data.box3).toBe(10000); // box1 + box2
        expect(result.data.box5).toBe(7000); // box3 - box4
      });

      test('should fail to create VAT return with invalid data', () => {
        const result = VatReturn.createVatReturn({
          userId: testUserId,
          periodStart: 'invalid',
          periodEnd: '2026-03-31'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      test('should enforce overlapping period constraint', () => {
        // Create first VAT return
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        // Try to create overlapping return
        const result = VatReturn.createVatReturn({
          ...validVatReturnData,
          userId: testUserId,
          periodStart: '2026-02-01',
          periodEnd: '2026-04-30'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.periodStart).toContain('Overlapping');
      });

      test('should allow non-overlapping periods', () => {
        // Create Q1 return
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        // Create Q2 return
        const result = VatReturn.createVatReturn({
          ...validVatReturnData,
          userId: testUserId,
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30',
          notes: 'Q2 2026 VAT Return'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.periodStart).toBe('2026-04-01');
      });
    });

    describe('findById', () => {
      test('should find VAT return by ID', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const vatReturn = VatReturn.findById(createResult.data.id);
        
        expect(vatReturn).toBeDefined();
        expect(vatReturn.periodStart).toBe('2026-01-01');
      });

      test('should return null for non-existent ID', () => {
        const vatReturn = VatReturn.findById(99999);
        expect(vatReturn).toBeNull();
      });
    });

    describe('findByPeriod', () => {
      test('should find VAT return by period', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const vatReturn = VatReturn.findByPeriod(testUserId, '2026-01-01', '2026-03-31');
        
        expect(vatReturn).toBeDefined();
        expect(vatReturn.notes).toBe('Q1 2026 VAT Return');
      });

      test('should return null for non-existent period', () => {
        const vatReturn = VatReturn.findByPeriod(testUserId, '2099-01-01', '2099-03-31');
        expect(vatReturn).toBeNull();
      });
    });

    describe('getVatReturnsByUserId', () => {
      test('should return paginated VAT returns for user', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-07-01', periodEnd: '2026-09-30' });
        
        const result = VatReturn.getVatReturnsByUserId(testUserId, { page: 1, limit: 2 });
        
        expect(result.vatReturns.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });

      test('should filter by status', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, status: 'draft' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30', status: 'submitted' });
        
        const result = VatReturn.getVatReturnsByUserId(testUserId, { status: 'submitted' });
        
        expect(result.vatReturns.length).toBe(1);
        expect(result.vatReturns[0].status).toBe('submitted');
      });

      test('should sort by periodEnd descending by default', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30' });
        
        const result = VatReturn.getVatReturnsByUserId(testUserId);
        
        expect(result.vatReturns[0].periodEnd).toBe('2026-06-30');
        expect(result.vatReturns[1].periodEnd).toBe('2026-03-31');
      });
    });

    describe('updateVatReturn', () => {
      test('should update VAT return successfully', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const result = VatReturn.updateVatReturn(createResult.data.id, {
          notes: 'Updated notes',
          box6: 60000
        });
        
        expect(result.success).toBe(true);
        expect(result.data.notes).toBe('Updated notes');
        expect(result.data.box6).toBe(60000);
      });

      test('should recalculate derived boxes when updating box values', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const result = VatReturn.updateVatReturn(createResult.data.id, {
          box1: 15000,
          box4: 5000
        });
        
        expect(result.success).toBe(true);
        expect(result.data.box3).toBe(15000); // Updated box1 + existing box2
        expect(result.data.box5).toBe(10000); // Updated box3 - updated box4
      });

      test('should fail to update non-existent VAT return', () => {
        const result = VatReturn.updateVatReturn(99999, { notes: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('VAT return not found');
      });

      test('should enforce overlapping period constraint on update', () => {
        // Create two non-overlapping returns
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const createResult2 = VatReturn.createVatReturn({
          ...validVatReturnData,
          userId: testUserId,
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30'
        });
        
        // Try to update second return to overlap with first
        const result = VatReturn.updateVatReturn(createResult2.data.id, {
          periodStart: '2026-02-01'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.periodStart).toContain('Overlapping');
      });
    });

    describe('deleteVatReturn', () => {
      test('should delete VAT return successfully', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const result = VatReturn.deleteVatReturn(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const vatReturn = VatReturn.findById(createResult.data.id);
        expect(vatReturn).toBeNull();
      });

      test('should fail to delete non-existent VAT return', () => {
        const result = VatReturn.deleteVatReturn(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('VAT return not found');
      });

      test('should prevent deletion of submitted VAT return', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, status: 'submitted' });
        const result = VatReturn.deleteVatReturn(createResult.data.id);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot delete a submitted');
      });

      test('should prevent deletion of accepted VAT return', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, status: 'accepted' });
        const result = VatReturn.deleteVatReturn(createResult.data.id);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot delete');
      });
    });
  });

  describe('Status operations', () => {
    const validVatReturnData = {
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      box1: 10000,
      box4: 3000
    };

    describe('updateStatus', () => {
      test('should update status successfully', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const result = VatReturn.updateStatus(createResult.data.id, 'pending');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('pending');
      });

      test('should set submittedAt when marking as submitted', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const result = VatReturn.updateStatus(createResult.data.id, 'submitted');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('submitted');
        expect(result.data.submittedAt).toBeDefined();
      });

      test('should reject invalid status', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        const result = VatReturn.updateStatus(createResult.data.id, 'invalid');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });

      test('should fail for non-existent VAT return', () => {
        const result = VatReturn.updateStatus(99999, 'pending');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('VAT return not found');
      });
    });

    describe('getByStatus', () => {
      test('should return VAT returns by status', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, status: 'draft' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30', status: 'submitted' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-07-01', periodEnd: '2026-09-30', status: 'submitted' });
        
        const results = VatReturn.getByStatus(testUserId, 'submitted');
        
        expect(results.length).toBe(2);
        results.forEach(r => expect(r.status).toBe('submitted'));
      });

      test('should return empty array for invalid status', () => {
        const results = VatReturn.getByStatus(testUserId, 'invalid');
        expect(results).toEqual([]);
      });
    });

    describe('getStatusCounts', () => {
      test('should return status counts for user', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, status: 'draft' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30', status: 'draft' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-07-01', periodEnd: '2026-09-30', status: 'submitted' });
        
        const counts = VatReturn.getStatusCounts(testUserId);
        
        expect(counts.draft).toBe(2);
        expect(counts.submitted).toBe(1);
        expect(counts.pending).toBe(0);
        expect(counts.accepted).toBe(0);
      });
    });

    describe('getPendingVatReturns', () => {
      test('should return pending VAT returns ordered by periodEnd', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, status: 'pending' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30', status: 'pending' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-07-01', periodEnd: '2026-09-30', status: 'draft' });
        
        const results = VatReturn.getPendingVatReturns(testUserId);
        
        expect(results.length).toBe(2);
        expect(results[0].periodEnd).toBe('2026-03-31');
        expect(results[1].periodEnd).toBe('2026-06-30');
      });
    });
  });

  describe('Query operations', () => {
    const validVatReturnData = {
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      box1: 10000,
      box4: 3000
    };

    describe('getLatest', () => {
      test('should return latest VAT return by periodEnd', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-07-01', periodEnd: '2026-09-30' });
        
        const latest = VatReturn.getLatest(testUserId);
        
        expect(latest).toBeDefined();
        expect(latest.periodEnd).toBe('2026-09-30');
      });

      test('should return null for user with no VAT returns', () => {
        const latest = VatReturn.getLatest(99999);
        expect(latest).toBeNull();
      });
    });

    describe('getByDateRange', () => {
      test('should return VAT returns overlapping with date range', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-04-01', periodEnd: '2026-06-30' });
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId, periodStart: '2026-07-01', periodEnd: '2026-09-30' });
        
        const results = VatReturn.getByDateRange(testUserId, '2026-03-01', '2026-05-01');
        
        expect(results.length).toBe(2);
        expect(results[0].periodEnd).toBe('2026-03-31');
        expect(results[1].periodEnd).toBe('2026-06-30');
      });
    });

    describe('hasOverlappingPeriod', () => {
      test('should detect overlapping periods', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        const hasOverlap = VatReturn.hasOverlappingPeriod(testUserId, '2026-02-01', '2026-04-30');
        
        expect(hasOverlap).toBe(true);
      });

      test('should not detect non-overlapping periods', () => {
        VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        const hasOverlap = VatReturn.hasOverlappingPeriod(testUserId, '2026-04-01', '2026-06-30');
        
        expect(hasOverlap).toBe(false);
      });

      test('should exclude specified ID from check', () => {
        const createResult = VatReturn.createVatReturn({ ...validVatReturnData, userId: testUserId });
        
        const hasOverlap = VatReturn.hasOverlappingPeriod(
          testUserId, 
          '2026-01-01', 
          '2026-03-31', 
          createResult.data.id
        );
        
        expect(hasOverlap).toBe(false);
      });
    });

    describe('getYearlySummary', () => {
      test('should return yearly VAT summary', () => {
        // Create some VAT returns with different statuses
        VatReturn.createVatReturn({
          userId: testUserId,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box1: 10000,
          box4: 3000,
          status: 'accepted'
        });
        VatReturn.createVatReturn({
          userId: testUserId,
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30',
          box1: 15000,
          box4: 5000,
          status: 'submitted'
        });
        VatReturn.createVatReturn({
          userId: testUserId,
          periodStart: '2026-07-01',
          periodEnd: '2026-09-30',
          box1: 8000,
          box4: 2000,
          status: 'draft' // Should not be included
        });
        
        const summary = VatReturn.getYearlySummary(testUserId, 2026);
        
        expect(summary.totalVatDue).toBe(25000); // 10000 + 15000
        expect(summary.totalVatReclaimed).toBe(8000); // 3000 + 5000
        expect(summary.netVat).toBe(17000); // 7000 + 10000
        expect(summary.returnCount).toBe(2);
      });

      test('should return zeros for year with no submitted returns', () => {
        VatReturn.createVatReturn({
          userId: testUserId,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
          box1: 10000,
          box4: 3000,
          status: 'draft'
        });
        
        const summary = VatReturn.getYearlySummary(testUserId, 2026);
        
        expect(summary.totalVatDue).toBe(0);
        expect(summary.totalVatReclaimed).toBe(0);
        expect(summary.netVat).toBe(0);
        expect(summary.returnCount).toBe(0);
      });
    });
  });

  describe('Overlapping period constraint', () => {
    const baseData = {
      userId: undefined, // Will be set in tests
      box1: 10000,
      box4: 3000
    };

    beforeEach(() => {
      baseData.userId = testUserId;
    });

    test('should prevent period that starts during existing period', () => {
      VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31'
      });
      
      const result = VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-02-01', // Starts during existing
        periodEnd: '2026-04-30'
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.periodStart).toContain('Overlapping');
    });

    test('should prevent period that ends during existing period', () => {
      VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30'
      });
      
      const result = VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-03-01',
        periodEnd: '2026-05-15' // Ends during existing
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.periodStart).toContain('Overlapping');
    });

    test('should prevent period that completely contains existing period', () => {
      VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28'
      });
      
      const result = VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-01-01', // Contains existing
        periodEnd: '2026-03-31'
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.periodStart).toContain('Overlapping');
    });

    test('should prevent period that is completely contained by existing period', () => {
      VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30'
      });
      
      const result = VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-02-01', // Contained by existing
        periodEnd: '2026-03-31'
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.periodStart).toContain('Overlapping');
    });

    test('should allow adjacent periods (touching dates)', () => {
      VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31'
      });
      
      const result = VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-04-01', // Day after previous ends
        periodEnd: '2026-06-30'
      });
      
      expect(result.success).toBe(true);
    });

    test('should allow same period for different users', () => {
      // Create a second test user
      executeMany(`
        INSERT INTO users (email, passwordHash, name, businessName)
        VALUES ('testuser2@example.com', 'hashedpassword', 'Test User 2', 'Test Business 2');
      `);
      const db = openDatabase();
      const user2 = db.prepare('SELECT id FROM users WHERE email = ?').get('testuser2@example.com');
      
      VatReturn.createVatReturn({
        ...baseData,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31'
      });
      
      const result = VatReturn.createVatReturn({
        ...baseData,
        userId: user2.id,
        periodStart: '2026-01-01', // Same period, different user
        periodEnd: '2026-03-31'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('All nine HMRC boxes', () => {
    test('should store and retrieve all nine HMRC boxes correctly', () => {
      const fullVatReturnData = {
        userId: testUserId,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        box1: 100000, // VAT due on sales
        box2: 500,    // VAT due on EU acquisitions
        box3: 100500, // Total VAT due (box1 + box2)
        box4: 30000,  // VAT reclaimed on purchases
        box5: 70500,  // Net VAT (box3 - box4)
        box6: 500000, // Total value of sales
        box7: 150000, // Total value of purchases
        box8: 25000,  // Total value of EU supplies
        box9: 10000   // Total value of EU acquisitions
      };
      
      const createResult = VatReturn.createVatReturn(fullVatReturnData);
      expect(createResult.success).toBe(true);
      
      const vatReturn = VatReturn.findById(createResult.data.id);
      
      expect(vatReturn.box1).toBe(100000);
      expect(vatReturn.box2).toBe(500);
      expect(vatReturn.box3).toBe(100500);
      expect(vatReturn.box4).toBe(30000);
      expect(vatReturn.box5).toBe(70500);
      expect(vatReturn.box6).toBe(500000);
      expect(vatReturn.box7).toBe(150000);
      expect(vatReturn.box8).toBe(25000);
      expect(vatReturn.box9).toBe(10000);
    });

    test('should default all boxes to 0', () => {
      const createResult = VatReturn.createVatReturn({
        userId: testUserId,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31'
      });
      
      expect(createResult.success).toBe(true);
      
      const vatReturn = VatReturn.findById(createResult.data.id);
      
      expect(vatReturn.box1).toBe(0);
      expect(vatReturn.box2).toBe(0);
      expect(vatReturn.box3).toBe(0);
      expect(vatReturn.box4).toBe(0);
      expect(vatReturn.box5).toBe(0);
      expect(vatReturn.box6).toBe(0);
      expect(vatReturn.box7).toBe(0);
      expect(vatReturn.box8).toBe(0);
      expect(vatReturn.box9).toBe(0);
    });
  });
});
