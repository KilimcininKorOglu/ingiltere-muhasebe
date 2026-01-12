/**
 * Unit tests for BankAccount model.
 * Tests validation, CRUD operations, and UK-specific banking field validation.
 * 
 * @module tests/BankAccount.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations } = require('../database/migrate');
const BankAccount = require('../database/models/BankAccount');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-bank-account-database.sqlite');

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

describe('BankAccount Model', () => {
  describe('Sort Code Validation', () => {
    test('should accept valid UK sort code format with hyphens', () => {
      expect(BankAccount.validateSortCode('12-34-56')).toBeNull();
      expect(BankAccount.validateSortCode('00-00-00')).toBeNull();
      expect(BankAccount.validateSortCode('99-99-99')).toBeNull();
    });

    test('should accept valid UK sort code format without hyphens', () => {
      expect(BankAccount.validateSortCode('123456')).toBeNull();
      expect(BankAccount.validateSortCode('000000')).toBeNull();
      expect(BankAccount.validateSortCode('999999')).toBeNull();
    });

    test('should reject invalid sort code formats', () => {
      expect(BankAccount.validateSortCode('12345')).not.toBeNull();
      expect(BankAccount.validateSortCode('1234567')).not.toBeNull();
      expect(BankAccount.validateSortCode('12-34-5')).not.toBeNull();
      expect(BankAccount.validateSortCode('AB-CD-EF')).not.toBeNull();
    });

    test('should allow empty sort code in validation function', () => {
      expect(BankAccount.validateSortCode('')).toBeNull();
      expect(BankAccount.validateSortCode(null)).toBeNull();
    });
  });

  describe('Account Number Validation', () => {
    test('should accept valid 8-digit account number', () => {
      expect(BankAccount.validateAccountNumber('12345678')).toBeNull();
      expect(BankAccount.validateAccountNumber('00000000')).toBeNull();
      expect(BankAccount.validateAccountNumber('99999999')).toBeNull();
    });

    test('should reject invalid account number formats', () => {
      expect(BankAccount.validateAccountNumber('1234567')).not.toBeNull();
      expect(BankAccount.validateAccountNumber('123456789')).not.toBeNull();
      expect(BankAccount.validateAccountNumber('ABCDEFGH')).not.toBeNull();
    });

    test('should allow empty account number in validation function', () => {
      expect(BankAccount.validateAccountNumber('')).toBeNull();
      expect(BankAccount.validateAccountNumber(null)).toBeNull();
    });
  });

  describe('IBAN Validation', () => {
    test('should accept valid IBAN formats', () => {
      expect(BankAccount.validateIban('GB82WEST12345698765432')).toBeNull();
      expect(BankAccount.validateIban('DE89370400440532013000')).toBeNull();
      expect(BankAccount.validateIban('FR7630006000011234567890189')).toBeNull();
    });

    test('should accept IBAN with spaces', () => {
      expect(BankAccount.validateIban('GB82 WEST 1234 5698 7654 32')).toBeNull();
    });

    test('should accept lowercase IBAN', () => {
      expect(BankAccount.validateIban('gb82west12345698765432')).toBeNull();
    });

    test('should reject invalid IBAN formats', () => {
      expect(BankAccount.validateIban('INVALID')).not.toBeNull();
      expect(BankAccount.validateIban('123456')).not.toBeNull();
      expect(BankAccount.validateIban('XX')).not.toBeNull();
    });

    test('should allow empty IBAN (optional field)', () => {
      expect(BankAccount.validateIban('')).toBeNull();
      expect(BankAccount.validateIban(null)).toBeNull();
    });
  });

  describe('BIC/SWIFT Validation', () => {
    test('should accept valid 8-character BIC', () => {
      expect(BankAccount.validateBic('WESTGB2L')).toBeNull();
      expect(BankAccount.validateBic('DEUTDEFF')).toBeNull();
    });

    test('should accept valid 11-character BIC', () => {
      expect(BankAccount.validateBic('WESTGB2LXXX')).toBeNull();
      expect(BankAccount.validateBic('DEUTDEFF500')).toBeNull();
    });

    test('should accept lowercase BIC', () => {
      expect(BankAccount.validateBic('westgb2l')).toBeNull();
    });

    test('should reject invalid BIC formats', () => {
      expect(BankAccount.validateBic('WEST')).not.toBeNull();
      expect(BankAccount.validateBic('WESTGB2')).not.toBeNull();
      expect(BankAccount.validateBic('12345678')).not.toBeNull();
    });

    test('should allow empty BIC (optional field)', () => {
      expect(BankAccount.validateBic('')).toBeNull();
      expect(BankAccount.validateBic(null)).toBeNull();
    });
  });

  describe('Sort Code Formatting', () => {
    test('should format sort code with hyphens', () => {
      expect(BankAccount.formatSortCode('123456')).toBe('12-34-56');
    });

    test('should preserve already formatted sort code', () => {
      expect(BankAccount.formatSortCode('12-34-56')).toBe('12-34-56');
    });

    test('should handle empty sort code', () => {
      expect(BankAccount.formatSortCode('')).toBe('');
      expect(BankAccount.formatSortCode(null)).toBe('');
    });
  });

  describe('Sort Code Normalization', () => {
    test('should remove hyphens from sort code', () => {
      expect(BankAccount.normalizeSortCode('12-34-56')).toBe('123456');
    });

    test('should keep already normalized sort code', () => {
      expect(BankAccount.normalizeSortCode('123456')).toBe('123456');
    });

    test('should handle empty sort code', () => {
      expect(BankAccount.normalizeSortCode('')).toBe('');
      expect(BankAccount.normalizeSortCode(null)).toBe('');
    });
  });

  describe('validateBankAccountData', () => {
    const validBankAccountData = {
      userId: 1,
      accountName: 'Barclays Business Account',
      bankName: 'Barclays Bank PLC',
      sortCode: '12-34-56',
      accountNumber: '12345678'
    };

    test('should pass validation for valid data', () => {
      const result = BankAccount.validateBankAccountData(validBankAccountData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    test('should pass validation with all optional fields', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        accountType: 'business',
        iban: 'GB82WEST12345698765432',
        bic: 'WESTGB2L',
        currency: 'GBP',
        openingBalance: 100000,
        isDefault: true,
        isActive: true,
        notes: 'Main business account'
      });
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    test('should fail for missing required fields', () => {
      const result = BankAccount.validateBankAccountData({});
      expect(result.isValid).toBe(false);
      expect(result.errors.userId).toBeDefined();
      expect(result.errors.accountName).toBeDefined();
      expect(result.errors.bankName).toBeDefined();
      expect(result.errors.sortCode).toBeDefined();
      expect(result.errors.accountNumber).toBeDefined();
    });

    test('should fail for accountName too short', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        accountName: 'A'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.accountName).toContain('at least 2 characters');
    });

    test('should fail for invalid sort code', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        sortCode: '12345'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.sortCode).toContain('Invalid UK sort code');
    });

    test('should fail for invalid account number', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        accountNumber: '1234567'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.accountNumber).toContain('Invalid UK account number');
    });

    test('should fail for invalid account type', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        accountType: 'invalid'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.accountType).toContain('Invalid accountType');
    });

    test('should fail for invalid currency', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        currency: 'XYZ'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.currency).toContain('Invalid currency');
    });

    test('should fail for non-integer balance', () => {
      const result = BankAccount.validateBankAccountData({
        ...validBankAccountData,
        openingBalance: 100.50
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.openingBalance).toContain('must be an integer');
    });

    test('should allow update without required fields', () => {
      const result = BankAccount.validateBankAccountData({ accountName: 'New Name' }, true);
      expect(result.isValid).toBe(true);
    });
  });

  describe('createBankAccount', () => {
    const validBankAccountData = {
      userId: 1,
      accountName: 'Barclays Business Account',
      bankName: 'Barclays Bank PLC',
      sortCode: '12-34-56',
      accountNumber: '12345678'
    };

    test('should create a bank account with valid data', () => {
      const result = BankAccount.createBankAccount(validBankAccountData);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.accountName).toBe('Barclays Business Account');
      expect(result.data.bankName).toBe('Barclays Bank PLC');
      expect(result.data.sortCode).toBe('123456');
      expect(result.data.sortCodeFormatted).toBe('12-34-56');
      expect(result.data.accountNumber).toBe('12345678');
      expect(result.data.accountType).toBe('current');
      expect(result.data.currency).toBe('GBP');
      expect(result.data.openingBalance).toBe(0);
      expect(result.data.currentBalance).toBe(0);
      expect(result.data.isDefault).toBe(false);
      expect(result.data.isActive).toBe(true);
    });

    test('should create a bank account with all optional fields', () => {
      const result = BankAccount.createBankAccount({
        ...validBankAccountData,
        accountType: 'business',
        iban: 'GB82 WEST 1234 5698 7654 32',
        bic: 'WESTGB2L',
        currency: 'gbp',
        openingBalance: 100000,
        isDefault: true,
        notes: 'Main business account'
      });
      expect(result.success).toBe(true);
      expect(result.data.accountType).toBe('business');
      expect(result.data.iban).toBe('GB82WEST12345698765432');
      expect(result.data.bic).toBe('WESTGB2L');
      expect(result.data.currency).toBe('GBP');
      expect(result.data.openingBalance).toBe(100000);
      expect(result.data.currentBalance).toBe(100000);
      expect(result.data.isDefault).toBe(true);
      expect(result.data.notes).toBe('Main business account');
    });

    test('should fail to create bank account with invalid data', () => {
      const result = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'A',
        bankName: 'B',
        sortCode: '123',
        accountNumber: '123'
      });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should prevent duplicate sort code and account number for same user', () => {
      BankAccount.createBankAccount(validBankAccountData);
      const result = BankAccount.createBankAccount(validBankAccountData);
      expect(result.success).toBe(false);
      expect(result.errors.sortCode).toContain('already exists');
    });

    test('should allow same sort code and account number for different users', () => {
      BankAccount.createBankAccount(validBankAccountData);
      const result = BankAccount.createBankAccount({
        ...validBankAccountData,
        userId: 2
      });
      expect(result.success).toBe(true);
    });
  });

  describe('findById', () => {
    test('should find bank account by ID', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Test Account',
        bankName: 'Test Bank',
        sortCode: '123456',
        accountNumber: '12345678'
      });
      const found = BankAccount.findById(created.data.id);
      expect(found).not.toBeNull();
      expect(found.accountName).toBe('Test Account');
    });

    test('should return null for non-existent ID', () => {
      const found = BankAccount.findById(999999);
      expect(found).toBeNull();
    });
  });

  describe('findBySortCodeAndAccountNumber', () => {
    test('should find bank account by sort code and account number', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Test Account',
        bankName: 'Test Bank',
        sortCode: '12-34-56',
        accountNumber: '12345678'
      });
      const found = BankAccount.findBySortCodeAndAccountNumber(1, '123456', '12345678');
      expect(found).not.toBeNull();
      expect(found.accountName).toBe('Test Account');
    });

    test('should find with hyphenated sort code', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Test Account',
        bankName: 'Test Bank',
        sortCode: '123456',
        accountNumber: '12345678'
      });
      const found = BankAccount.findBySortCodeAndAccountNumber(1, '12-34-56', '12345678');
      expect(found).not.toBeNull();
    });

    test('should return null for non-existent combination', () => {
      const found = BankAccount.findBySortCodeAndAccountNumber(1, '999999', '99999999');
      expect(found).toBeNull();
    });
  });

  describe('getBankAccountsByUserId', () => {
    beforeEach(() => {
      // Create multiple bank accounts
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account A',
        bankName: 'Bank A',
        sortCode: '111111',
        accountNumber: '11111111',
        accountType: 'current',
        isDefault: true
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account B',
        bankName: 'Bank B',
        sortCode: '222222',
        accountNumber: '22222222',
        accountType: 'savings'
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account C',
        bankName: 'Bank C',
        sortCode: '333333',
        accountNumber: '33333333',
        accountType: 'business',
        isActive: false
      });
    });

    test('should get all bank accounts for user', () => {
      const result = BankAccount.getBankAccountsByUserId(1);
      expect(result.bankAccounts).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    test('should filter active accounts only', () => {
      const result = BankAccount.getBankAccountsByUserId(1, { activeOnly: true });
      expect(result.bankAccounts).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('should filter by account type', () => {
      const result = BankAccount.getBankAccountsByUserId(1, { accountType: 'savings' });
      expect(result.bankAccounts).toHaveLength(1);
      expect(result.bankAccounts[0].accountType).toBe('savings');
    });

    test('should paginate results', () => {
      const result = BankAccount.getBankAccountsByUserId(1, { page: 1, limit: 2 });
      expect(result.bankAccounts).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    test('should sort default account first', () => {
      const result = BankAccount.getBankAccountsByUserId(1);
      expect(result.bankAccounts[0].isDefault).toBe(true);
    });
  });

  describe('getActiveBankAccounts', () => {
    test('should get only active bank accounts', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Active Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isActive: true
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Inactive Account',
        bankName: 'Bank',
        sortCode: '222222',
        accountNumber: '22222222',
        isActive: false
      });

      const accounts = BankAccount.getActiveBankAccounts(1);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].accountName).toBe('Active Account');
    });
  });

  describe('getDefaultBankAccount', () => {
    test('should get default bank account', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Default Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isDefault: true
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Other Account',
        bankName: 'Bank',
        sortCode: '222222',
        accountNumber: '22222222'
      });

      const defaultAccount = BankAccount.getDefaultBankAccount(1);
      expect(defaultAccount).not.toBeNull();
      expect(defaultAccount.accountName).toBe('Default Account');
    });

    test('should return null if no default account', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isDefault: false
      });

      const defaultAccount = BankAccount.getDefaultBankAccount(1);
      expect(defaultAccount).toBeNull();
    });

    test('should not return inactive default account', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Inactive Default',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isDefault: true,
        isActive: false
      });

      const defaultAccount = BankAccount.getDefaultBankAccount(1);
      expect(defaultAccount).toBeNull();
    });
  });

  describe('updateBankAccount', () => {
    let accountId;

    beforeEach(() => {
      const result = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Original Account',
        bankName: 'Original Bank',
        sortCode: '111111',
        accountNumber: '11111111'
      });
      accountId = result.data.id;
    });

    test('should update bank account fields', () => {
      const result = BankAccount.updateBankAccount(accountId, {
        accountName: 'Updated Account',
        bankName: 'Updated Bank'
      });
      expect(result.success).toBe(true);
      expect(result.data.accountName).toBe('Updated Account');
      expect(result.data.bankName).toBe('Updated Bank');
    });

    test('should update sort code and account number', () => {
      const result = BankAccount.updateBankAccount(accountId, {
        sortCode: '99-99-99',
        accountNumber: '99999999'
      });
      expect(result.success).toBe(true);
      expect(result.data.sortCode).toBe('999999');
      expect(result.data.accountNumber).toBe('99999999');
    });

    test('should fail for non-existent account', () => {
      const result = BankAccount.updateBankAccount(999999, { accountName: 'New Name' });
      expect(result.success).toBe(false);
      expect(result.errors.general).toContain('not found');
    });

    test('should fail for invalid data', () => {
      const result = BankAccount.updateBankAccount(accountId, { sortCode: '123' });
      expect(result.success).toBe(false);
      expect(result.errors.sortCode).toBeDefined();
    });

    test('should prevent duplicate sort code and account number', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Other Account',
        bankName: 'Other Bank',
        sortCode: '222222',
        accountNumber: '22222222'
      });

      const result = BankAccount.updateBankAccount(accountId, {
        sortCode: '222222',
        accountNumber: '22222222'
      });
      expect(result.success).toBe(false);
      expect(result.errors.sortCode).toContain('already exists');
    });
  });

  describe('deleteBankAccount', () => {
    test('should delete bank account', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'To Delete',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111'
      });

      const result = BankAccount.deleteBankAccount(created.data.id);
      expect(result.success).toBe(true);
      expect(BankAccount.findById(created.data.id)).toBeNull();
    });

    test('should fail for non-existent account', () => {
      const result = BankAccount.deleteBankAccount(999999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('setAsDefault', () => {
    test('should set account as default', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isDefault: false
      });

      const result = BankAccount.setAsDefault(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.isDefault).toBe(true);
    });

    test('should unset previous default when setting new default', () => {
      const first = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'First',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isDefault: true
      });

      const second = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Second',
        bankName: 'Bank',
        sortCode: '222222',
        accountNumber: '22222222',
        isDefault: false
      });

      BankAccount.setAsDefault(second.data.id);

      const firstUpdated = BankAccount.findById(first.data.id);
      const secondUpdated = BankAccount.findById(second.data.id);

      expect(firstUpdated.isDefault).toBe(0);
      expect(secondUpdated.isDefault).toBe(1);
    });

    test('should fail for inactive account', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Inactive',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isActive: false
      });

      const result = BankAccount.setAsDefault(created.data.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('inactive');
    });
  });

  describe('deactivateBankAccount', () => {
    test('should deactivate bank account', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Active',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isActive: true
      });

      const result = BankAccount.deactivateBankAccount(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
    });

    test('should also unset default when deactivating', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Default Active',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isDefault: true,
        isActive: true
      });

      const result = BankAccount.deactivateBankAccount(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
      expect(result.data.isDefault).toBe(false);
    });
  });

  describe('reactivateBankAccount', () => {
    test('should reactivate bank account', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Inactive',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        isActive: false
      });

      const result = BankAccount.reactivateBankAccount(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
    });
  });

  describe('Balance Operations', () => {
    let accountId;

    beforeEach(() => {
      const result = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        openingBalance: 100000,
        currentBalance: 100000
      });
      accountId = result.data.id;
    });

    test('should update balance', () => {
      const result = BankAccount.updateBalance(accountId, 200000);
      expect(result.success).toBe(true);
      expect(result.data.currentBalance).toBe(200000);
    });

    test('should adjust balance positively', () => {
      const result = BankAccount.adjustBalance(accountId, 50000);
      expect(result.success).toBe(true);
      expect(result.data.currentBalance).toBe(150000);
    });

    test('should adjust balance negatively', () => {
      const result = BankAccount.adjustBalance(accountId, -30000);
      expect(result.success).toBe(true);
      expect(result.data.currentBalance).toBe(70000);
    });

    test('should fail for non-integer balance', () => {
      const result = BankAccount.updateBalance(accountId, 100.50);
      expect(result.success).toBe(false);
      expect(result.error).toContain('integer');
    });

    test('should fail for non-integer adjustment', () => {
      const result = BankAccount.adjustBalance(accountId, 50.25);
      expect(result.success).toBe(false);
      expect(result.error).toContain('integer');
    });
  });

  describe('getTotalBalance', () => {
    beforeEach(() => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'GBP Account 1',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        currency: 'GBP',
        currentBalance: 100000
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'GBP Account 2',
        bankName: 'Bank',
        sortCode: '222222',
        accountNumber: '22222222',
        currency: 'GBP',
        currentBalance: 50000
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'EUR Account',
        bankName: 'Bank',
        sortCode: '333333',
        accountNumber: '33333333',
        currency: 'EUR',
        currentBalance: 75000
      });
    });

    test('should get total balance for GBP accounts', () => {
      const result = BankAccount.getTotalBalance(1, 'GBP');
      expect(result.totalBalance).toBe(150000);
      expect(result.accountCount).toBe(2);
    });

    test('should get total balance for EUR accounts', () => {
      const result = BankAccount.getTotalBalance(1, 'EUR');
      expect(result.totalBalance).toBe(75000);
      expect(result.accountCount).toBe(1);
    });

    test('should return zero for no accounts in currency', () => {
      const result = BankAccount.getTotalBalance(1, 'USD');
      expect(result.totalBalance).toBe(0);
      expect(result.accountCount).toBe(0);
    });
  });

  describe('getTypeCounts', () => {
    beforeEach(() => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Current 1',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111',
        accountType: 'current'
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Current 2',
        bankName: 'Bank',
        sortCode: '222222',
        accountNumber: '22222222',
        accountType: 'current'
      });
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Savings',
        bankName: 'Bank',
        sortCode: '333333',
        accountNumber: '33333333',
        accountType: 'savings'
      });
    });

    test('should get account type counts', () => {
      const counts = BankAccount.getTypeCounts(1);
      expect(counts.current).toBe(2);
      expect(counts.savings).toBe(1);
      expect(counts.business).toBe(0);
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

    test('should search by account name', () => {
      const results = BankAccount.searchBankAccounts(1, 'Barclays');
      expect(results).toHaveLength(1);
      expect(results[0].accountName).toBe('Barclays Business');
    });

    test('should search by bank name', () => {
      const results = BankAccount.searchBankAccounts(1, 'HSBC');
      expect(results).toHaveLength(1);
      expect(results[0].bankName).toBe('HSBC UK Bank');
    });

    test('should be case insensitive', () => {
      const results = BankAccount.searchBankAccounts(1, 'barclays');
      expect(results).toHaveLength(1);
    });

    test('should return empty for no matches', () => {
      const results = BankAccount.searchBankAccounts(1, 'Natwest');
      expect(results).toHaveLength(0);
    });

    test('should return empty for empty search term', () => {
      const results = BankAccount.searchBankAccounts(1, '');
      expect(results).toHaveLength(0);
    });
  });

  describe('accountExists', () => {
    test('should return true for existing account', () => {
      BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111'
      });

      expect(BankAccount.accountExists(1, '111111', '11111111')).toBe(true);
      expect(BankAccount.accountExists(1, '11-11-11', '11111111')).toBe(true);
    });

    test('should return false for non-existing account', () => {
      expect(BankAccount.accountExists(1, '999999', '99999999')).toBe(false);
    });

    test('should exclude specified ID', () => {
      const created = BankAccount.createBankAccount({
        userId: 1,
        accountName: 'Account',
        bankName: 'Bank',
        sortCode: '111111',
        accountNumber: '11111111'
      });

      expect(BankAccount.accountExists(1, '111111', '11111111', created.data.id)).toBe(false);
    });
  });

  describe('Constants', () => {
    test('should export valid account types', () => {
      expect(BankAccount.BANK_ACCOUNT_TYPES).toContain('current');
      expect(BankAccount.BANK_ACCOUNT_TYPES).toContain('savings');
      expect(BankAccount.BANK_ACCOUNT_TYPES).toContain('business');
    });

    test('should export valid currencies', () => {
      expect(BankAccount.BANK_CURRENCIES).toContain('GBP');
      expect(BankAccount.BANK_CURRENCIES).toContain('EUR');
      expect(BankAccount.BANK_CURRENCIES).toContain('USD');
    });
  });
});
