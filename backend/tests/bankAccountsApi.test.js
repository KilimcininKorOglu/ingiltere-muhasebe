/**
 * Unit tests for Bank Accounts API endpoints.
 * Tests CRUD operations, validation, and authentication.
 * 
 * @module tests/bankAccountsApi.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Mock http request/response for testing
function createMockRequest(body = {}, query = {}, headers = {}, params = {}) {
  return {
    body,
    query,
    headers,
    params,
    user: null
  };
}

function createMockResponse() {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
}

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-bank-accounts-api-database.sqlite');

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
  executeMany('DELETE FROM bank_accounts;');
  executeMany('DELETE FROM users;');
  // Insert a test user for foreign key constraint
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (1, 'test@example.com', 'hash', 'Test User');
  `);
  executeMany(`
    INSERT INTO users (id, email, passwordHash, name) 
    VALUES (2, 'test2@example.com', 'hash', 'Test User 2');
  `);
});

// Import modules for unit testing
const {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
  reactivateBankAccount,
  searchBankAccounts
} = require('../controllers/bankAccountController');

const {
  validateCreateBankAccount,
  validateUpdateBankAccount,
  sanitizeBankAccountData,
  authenticateToken
} = require('../middleware/validation');

const { generateToken } = require('../utils/jwt');
const BankAccount = require('../database/models/BankAccount');

describe('Bank Accounts API', () => {
  describe('Authentication Middleware', () => {
    test('should reject request without authorization header', () => {
      const req = createMockRequest({}, {}, {});
      const res = createMockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    test('should reject request with invalid token', () => {
      const req = createMockRequest({}, {}, { authorization: 'Bearer invalid.token.here' });
      const res = createMockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.jsonData.success).toBe(false);
    });

    test('should accept request with valid token', () => {
      const token = generateToken({ id: 1, email: 'test@example.com', name: 'Test User' });
      const req = createMockRequest({}, {}, { authorization: `Bearer ${token}` });
      const res = createMockResponse();
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(1);
    });
  });

  describe('Bank Account Validation', () => {
    describe('validateCreateBankAccount', () => {
      test('should pass validation for valid data', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      test('should reject missing account name', () => {
        const req = createMockRequest({
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'accountName')).toBe(true);
      });

      test('should reject missing bank name', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'bankName')).toBe(true);
      });

      test('should reject invalid sort code format', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '123',
          accountNumber: '12345678'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'sortCode')).toBe(true);
      });

      test('should reject invalid account number format', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '1234567'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'accountNumber')).toBe(true);
      });

      test('should accept valid sort code without hyphens', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '123456',
          accountNumber: '12345678'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      test('should reject invalid account type', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678',
          accountType: 'invalid'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'accountType')).toBe(true);
      });

      test('should reject invalid currency', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678',
          currency: 'XYZ'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'currency')).toBe(true);
      });

      test('should reject non-integer opening balance', () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678',
          openingBalance: 100.50
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateCreateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.jsonData.error.details.some(e => e.field === 'openingBalance')).toBe(true);
      });
    });

    describe('validateUpdateBankAccount', () => {
      test('should pass validation for partial update', () => {
        const req = createMockRequest({
          accountName: 'Updated Account Name'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateUpdateBankAccount(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      test('should reject invalid sort code in update', () => {
        const req = createMockRequest({
          sortCode: '12345'
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateUpdateBankAccount(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
      });
    });

    describe('sanitizeBankAccountData', () => {
      test('should sanitize bank account data', () => {
        const req = createMockRequest({
          accountName: '  Barclays Business  ',
          bankName: '  Barclays Bank PLC  ',
          iban: 'gb82 west 1234 5698 7654 32',
          bic: 'westgb2l',
          currency: 'gbp',
          notes: '  Some notes  '
        });
        const res = createMockResponse();
        const next = jest.fn();

        sanitizeBankAccountData(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.accountName).toBe('Barclays Business');
        expect(req.body.bankName).toBe('Barclays Bank PLC');
        expect(req.body.iban).toBe('GB82WEST12345698765432');
        expect(req.body.bic).toBe('WESTGB2L');
        expect(req.body.currency).toBe('GBP');
        expect(req.body.notes).toBe('Some notes');
      });
    });
  });

  describe('Bank Account Controller', () => {
    describe('createBankAccount', () => {
      test('should create bank account successfully', async () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        req.user = { id: 1, email: 'test@example.com', name: 'Test User' };
        const res = createMockResponse();

        await createBankAccount(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount).toBeDefined();
        expect(res.jsonData.data.bankAccount.accountName).toBe('Barclays Business');
        expect(res.jsonData.data.bankAccount.sortCodeFormatted).toBe('12-34-56');
      });

      test('should create bank account with all optional fields', async () => {
        const req = createMockRequest({
          accountName: 'HSBC Business',
          bankName: 'HSBC UK',
          sortCode: '40-01-02',
          accountNumber: '87654321',
          accountType: 'business',
          iban: 'GB82WEST12345698765432',
          bic: 'WESTGB2L',
          currency: 'GBP',
          openingBalance: 100000,
          isDefault: true,
          notes: 'Main business account'
        });
        req.user = { id: 1, email: 'test@example.com', name: 'Test User' };
        const res = createMockResponse();

        await createBankAccount(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount.accountType).toBe('business');
        expect(res.jsonData.data.bankAccount.isDefault).toBe(true);
        expect(res.jsonData.data.bankAccount.openingBalance).toBe(100000);
        expect(res.jsonData.data.bankAccount.currentBalance).toBe(100000);
      });

      test('should reject request without authentication', async () => {
        const req = createMockRequest({
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        const res = createMockResponse();

        await createBankAccount(req, res);

        expect(res.statusCode).toBe(401);
        expect(res.jsonData.success).toBe(false);
      });

      test('should reject duplicate sort code and account number', async () => {
        // First create
        const req1 = createMockRequest({
          accountName: 'Account 1',
          bankName: 'Bank',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        req1.user = { id: 1 };
        const res1 = createMockResponse();
        await createBankAccount(req1, res1);
        expect(res1.statusCode).toBe(201);

        // Second create with same details
        const req2 = createMockRequest({
          accountName: 'Account 2',
          bankName: 'Bank',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        req2.user = { id: 1 };
        const res2 = createMockResponse();
        await createBankAccount(req2, res2);

        expect(res2.statusCode).toBe(400);
        expect(res2.jsonData.success).toBe(false);
        expect(res2.jsonData.error.details.some(e => e.field === 'sortCode')).toBe(true);
      });
    });

    describe('getBankAccounts', () => {
      beforeEach(async () => {
        // Create some test bank accounts
        const accounts = [
          { userId: 1, accountName: 'Account A', bankName: 'Bank A', sortCode: '111111', accountNumber: '11111111', isDefault: true },
          { userId: 1, accountName: 'Account B', bankName: 'Bank B', sortCode: '222222', accountNumber: '22222222', accountType: 'savings' },
          { userId: 1, accountName: 'Account C', bankName: 'Bank C', sortCode: '333333', accountNumber: '33333333', isActive: false },
          { userId: 2, accountName: 'Other User Account', bankName: 'Bank', sortCode: '444444', accountNumber: '44444444' }
        ];
        accounts.forEach(acc => BankAccount.createBankAccount(acc));
      });

      test('should get all bank accounts for authenticated user', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.query = {};
        const res = createMockResponse();

        await getBankAccounts(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccounts).toHaveLength(3);
        expect(res.jsonData.data.pagination).toBeDefined();
        expect(res.jsonData.data.summary).toBeDefined();
      });

      test('should filter active accounts only', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.query = { activeOnly: 'true' };
        const res = createMockResponse();

        await getBankAccounts(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.data.bankAccounts).toHaveLength(2);
        expect(res.jsonData.data.bankAccounts.every(acc => acc.isActive === true)).toBe(true);
      });

      test('should paginate results', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.query = { page: '1', limit: '2' };
        const res = createMockResponse();

        await getBankAccounts(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.data.bankAccounts).toHaveLength(2);
        expect(res.jsonData.data.pagination.total).toBe(3);
        expect(res.jsonData.data.pagination.totalPages).toBe(2);
      });
    });

    describe('getBankAccountById', () => {
      let testAccountId;

      beforeEach(() => {
        const result = BankAccount.createBankAccount({
          userId: 1,
          accountName: 'Test Account',
          bankName: 'Test Bank',
          sortCode: '123456',
          accountNumber: '12345678'
        });
        testAccountId = result.data.id;
      });

      test('should get bank account by ID', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await getBankAccountById(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount.accountName).toBe('Test Account');
      });

      test('should return 404 for non-existent account', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: '999999' };
        req.query = {};
        const res = createMockResponse();

        await getBankAccountById(req, res);

        expect(res.statusCode).toBe(404);
        expect(res.jsonData.success).toBe(false);
      });

      test('should return 403 for account owned by another user', async () => {
        const req = createMockRequest();
        req.user = { id: 2 }; // Different user
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await getBankAccountById(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.jsonData.success).toBe(false);
      });
    });

    describe('updateBankAccount', () => {
      let testAccountId;

      beforeEach(() => {
        const result = BankAccount.createBankAccount({
          userId: 1,
          accountName: 'Original Account',
          bankName: 'Original Bank',
          sortCode: '123456',
          accountNumber: '12345678'
        });
        testAccountId = result.data.id;
      });

      test('should update bank account successfully', async () => {
        const req = createMockRequest({
          accountName: 'Updated Account',
          bankName: 'Updated Bank'
        });
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await updateBankAccount(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount.accountName).toBe('Updated Account');
        expect(res.jsonData.data.bankAccount.bankName).toBe('Updated Bank');
      });

      test('should return 404 for non-existent account', async () => {
        const req = createMockRequest({ accountName: 'Updated' });
        req.user = { id: 1 };
        req.params = { id: '999999' };
        req.query = {};
        const res = createMockResponse();

        await updateBankAccount(req, res);

        expect(res.statusCode).toBe(404);
      });

      test('should return 403 for account owned by another user', async () => {
        const req = createMockRequest({ accountName: 'Updated' });
        req.user = { id: 2 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await updateBankAccount(req, res);

        expect(res.statusCode).toBe(403);
      });
    });

    describe('deleteBankAccount', () => {
      let testAccountId;

      beforeEach(() => {
        const result = BankAccount.createBankAccount({
          userId: 1,
          accountName: 'Account to Delete',
          bankName: 'Bank',
          sortCode: '123456',
          accountNumber: '12345678'
        });
        testAccountId = result.data.id;
      });

      test('should soft delete (deactivate) bank account', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await deleteBankAccount(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount.isActive).toBe(false);
        
        // Account should still exist
        const account = BankAccount.findById(testAccountId);
        expect(account).not.toBeNull();
        expect(account.isActive).toBe(0);
      });

      test('should hard delete with force=true', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = { force: 'true' };
        const res = createMockResponse();

        await deleteBankAccount(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        
        // Account should be deleted
        const account = BankAccount.findById(testAccountId);
        expect(account).toBeNull();
      });

      test('should return 404 for non-existent account', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: '999999' };
        req.query = {};
        const res = createMockResponse();

        await deleteBankAccount(req, res);

        expect(res.statusCode).toBe(404);
      });

      test('should return 403 for account owned by another user', async () => {
        const req = createMockRequest();
        req.user = { id: 2 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await deleteBankAccount(req, res);

        expect(res.statusCode).toBe(403);
      });
    });

    describe('setDefaultBankAccount', () => {
      let testAccountId;

      beforeEach(() => {
        const result = BankAccount.createBankAccount({
          userId: 1,
          accountName: 'Account',
          bankName: 'Bank',
          sortCode: '123456',
          accountNumber: '12345678',
          isDefault: false
        });
        testAccountId = result.data.id;
      });

      test('should set bank account as default', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await setDefaultBankAccount(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount.isDefault).toBe(true);
      });

      test('should fail for inactive account', async () => {
        // Deactivate the account first
        BankAccount.deactivateBankAccount(testAccountId);

        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await setDefaultBankAccount(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.jsonData.success).toBe(false);
      });
    });

    describe('reactivateBankAccount', () => {
      let testAccountId;

      beforeEach(() => {
        const result = BankAccount.createBankAccount({
          userId: 1,
          accountName: 'Inactive Account',
          bankName: 'Bank',
          sortCode: '123456',
          accountNumber: '12345678',
          isActive: false
        });
        testAccountId = result.data.id;
      });

      test('should reactivate bank account', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.params = { id: testAccountId.toString() };
        req.query = {};
        const res = createMockResponse();

        await reactivateBankAccount(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccount.isActive).toBe(true);
      });
    });

    describe('searchBankAccounts', () => {
      beforeEach(() => {
        BankAccount.createBankAccount({
          userId: 1,
          accountName: 'Barclays Business',
          bankName: 'Barclays Bank PLC',
          sortCode: '111111',
          accountNumber: '11111111'
        });
        BankAccount.createBankAccount({
          userId: 1,
          accountName: 'HSBC Current',
          bankName: 'HSBC UK Bank',
          sortCode: '222222',
          accountNumber: '22222222'
        });
      });

      test('should search by account name', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.query = { q: 'Barclays' };
        const res = createMockResponse();

        await searchBankAccounts(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.success).toBe(true);
        expect(res.jsonData.data.bankAccounts).toHaveLength(1);
        expect(res.jsonData.data.bankAccounts[0].accountName).toBe('Barclays Business');
      });

      test('should search by bank name', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.query = { q: 'HSBC' };
        const res = createMockResponse();

        await searchBankAccounts(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonData.data.bankAccounts).toHaveLength(1);
        expect(res.jsonData.data.bankAccounts[0].bankName).toBe('HSBC UK Bank');
      });

      test('should return 400 for empty search term', async () => {
        const req = createMockRequest();
        req.user = { id: 1 };
        req.query = { q: '' };
        const res = createMockResponse();

        await searchBankAccounts(req, res);

        expect(res.statusCode).toBe(400);
      });
    });
  });

  describe('List Returns Balances', () => {
    test('should return summary with total balance', async () => {
      // Create accounts with different balances
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account 1',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        currentBalance: 100000
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account 2',
        bankName: 'Bank',
        sortCode: '222222',
        accountNumber: '22222222',
        currentBalance: 50000
      });

      const req = createMockRequest();
      req.user = { id: 1 };
      req.query = {};
      const res = createMockResponse();

      await getBankAccounts(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.summary.totalBalance).toBe(150000);
      expect(res.jsonData.data.summary.accountCount).toBe(2);
    });
  });
});
