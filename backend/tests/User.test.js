/**
 * Unit tests for User model.
 * Tests validation, CRUD operations, and authentication.
 * 
 * @module tests/User.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations, rollbackAllMigrations } = require('../database/migrate');
const User = require('../database/models/User');

// Use in-memory database for testing
const TEST_DB_PATH = path.join(__dirname, '../data/test-database.sqlite');

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
 * Clean up users table before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM users;');
});

describe('User Model', () => {
  describe('validateUserData', () => {
    describe('email validation', () => {
      test('should fail validation for missing email', () => {
        const result = User.validateUserData({ password: 'Test1234', name: 'John' });
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBeDefined();
      });

      test('should fail validation for invalid email format', () => {
        const result = User.validateUserData({
          email: 'invalid-email',
          password: 'Test1234',
          name: 'John Doe'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe('Invalid email format');
      });

      test('should pass validation for valid email', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John Doe'
        });
        expect(result.isValid).toBe(true);
        expect(result.errors.email).toBeUndefined();
      });
    });

    describe('password validation', () => {
      test('should fail validation for missing password', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          name: 'John'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toBeDefined();
      });

      test('should fail validation for short password', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1',
          name: 'John'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toContain('at least 8 characters');
      });

      test('should fail validation for password without uppercase', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'test1234',
          name: 'John'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toContain('uppercase letter');
      });

      test('should fail validation for password without lowercase', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'TEST1234',
          name: 'John'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toContain('lowercase letter');
      });

      test('should fail validation for password without number', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Testtest',
          name: 'John'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toContain('number');
      });

      test('should pass validation for valid password', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'ValidPass123',
          name: 'John'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('name validation', () => {
      test('should fail validation for missing name', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.name).toBeDefined();
      });

      test('should fail validation for short name', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'J'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.name).toContain('at least 2 characters');
      });

      test('should pass validation for valid name', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John Doe'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('VAT number validation', () => {
      test('should pass validation for empty VAT number', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          vatNumber: ''
        });
        expect(result.isValid).toBe(true);
      });

      test('should fail validation for invalid VAT number format', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          vatNumber: '12345'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.vatNumber).toContain('Invalid UK VAT number');
      });

      test('should pass validation for valid VAT number with 9 digits', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          vatNumber: 'GB123456789'
        });
        expect(result.isValid).toBe(true);
      });

      test('should pass validation for valid VAT number with 12 digits', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          vatNumber: 'GB123456789012'
        });
        expect(result.isValid).toBe(true);
      });

      test('should pass validation for VAT number with spaces', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          vatNumber: 'GB 123 456 789'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('company number validation', () => {
      test('should pass validation for empty company number', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          companyNumber: ''
        });
        expect(result.isValid).toBe(true);
      });

      test('should fail validation for invalid company number format', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          companyNumber: '12345'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.companyNumber).toContain('8 alphanumeric');
      });

      test('should pass validation for valid company number', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          companyNumber: '12345678'
        });
        expect(result.isValid).toBe(true);
      });

      test('should pass validation for company number with letters', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          companyNumber: 'SC123456'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('preferredLanguage validation', () => {
      test('should fail validation for invalid language', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          preferredLanguage: 'fr'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.preferredLanguage).toContain('Invalid language');
      });

      test('should pass validation for English', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          preferredLanguage: 'en'
        });
        expect(result.isValid).toBe(true);
      });

      test('should pass validation for Turkish', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          preferredLanguage: 'tr'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('taxYearStart validation', () => {
      test('should fail validation for invalid format', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          taxYearStart: '2024-04-06'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.taxYearStart).toContain('Invalid tax year start format');
      });

      test('should pass validation for valid format', () => {
        const result = User.validateUserData({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'John',
          taxYearStart: '04-06'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('update validation', () => {
      test('should allow partial updates without required fields', () => {
        const result = User.validateUserData({ name: 'Updated Name' }, true);
        expect(result.isValid).toBe(true);
      });

      test('should still validate provided fields on update', () => {
        const result = User.validateUserData({ email: 'invalid' }, true);
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe('Invalid email format');
      });
    });
  });

  describe('Password hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await User.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    test('should compare password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await User.hashPassword(password);
      
      const isValid = await User.comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject wrong password', async () => {
      const password = 'TestPassword123';
      const hash = await User.hashPassword(password);
      
      const isValid = await User.comparePassword('WrongPassword123', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('CRUD operations', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'ValidPass123',
      name: 'John Doe',
      businessName: 'Test Business Ltd',
      businessAddress: '123 Test Street, London',
      vatNumber: 'GB123456789',
      isVatRegistered: true,
      companyNumber: '12345678',
      taxYearStart: '04-06',
      preferredLanguage: 'en'
    };

    describe('createUser', () => {
      test('should create a user successfully', async () => {
        const result = await User.createUser(validUserData);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.name).toBe('John Doe');
        expect(result.data.passwordHash).toBeUndefined(); // Should be sanitized
        expect(result.data.isVatRegistered).toBe(true);
      });

      test('should fail to create user with invalid data', async () => {
        const result = await User.createUser({
          email: 'invalid',
          password: 'weak',
          name: ''
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      test('should prevent duplicate email', async () => {
        await User.createUser(validUserData);
        const result = await User.createUser(validUserData);
        
        expect(result.success).toBe(false);
        expect(result.errors.email).toBe('Email already registered');
      });

      test('should normalize email to lowercase', async () => {
        const result = await User.createUser({
          ...validUserData,
          email: 'TEST@EXAMPLE.COM'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.email).toBe('test@example.com');
      });

      test('should normalize VAT number format', async () => {
        const result = await User.createUser({
          ...validUserData,
          vatNumber: 'gb 123 456 789'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.vatNumber).toBe('GB123456789');
      });
    });

    describe('findById', () => {
      test('should find user by ID', async () => {
        const createResult = await User.createUser(validUserData);
        const user = User.findById(createResult.data.id);
        
        expect(user).toBeDefined();
        expect(user.email).toBe('test@example.com');
      });

      test('should return null for non-existent ID', () => {
        const user = User.findById(99999);
        expect(user).toBeNull();
      });
    });

    describe('findByEmail', () => {
      test('should find user by email', async () => {
        await User.createUser(validUserData);
        const user = User.findByEmail('test@example.com');
        
        expect(user).toBeDefined();
        expect(user.name).toBe('John Doe');
      });

      test('should find user by email case-insensitively', async () => {
        await User.createUser(validUserData);
        const user = User.findByEmail('TEST@EXAMPLE.COM');
        
        expect(user).toBeDefined();
      });

      test('should return null for non-existent email', () => {
        const user = User.findByEmail('nonexistent@example.com');
        expect(user).toBeNull();
      });

      test('should return null for empty email', () => {
        const user = User.findByEmail('');
        expect(user).toBeNull();
      });
    });

    describe('getAllUsers', () => {
      test('should return paginated users', async () => {
        await User.createUser({ ...validUserData, email: 'user1@example.com' });
        await User.createUser({ ...validUserData, email: 'user2@example.com' });
        await User.createUser({ ...validUserData, email: 'user3@example.com' });
        
        const result = User.getAllUsers({ page: 1, limit: 2 });
        
        expect(result.users.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });

      test('should return second page correctly', async () => {
        await User.createUser({ ...validUserData, email: 'user1@example.com' });
        await User.createUser({ ...validUserData, email: 'user2@example.com' });
        await User.createUser({ ...validUserData, email: 'user3@example.com' });
        
        const result = User.getAllUsers({ page: 2, limit: 2 });
        
        expect(result.users.length).toBe(1);
        expect(result.total).toBe(3);
      });

      test('should sanitize user data in results', async () => {
        await User.createUser(validUserData);
        const result = User.getAllUsers();
        
        expect(result.users[0].passwordHash).toBeUndefined();
      });
    });

    describe('updateUser', () => {
      test('should update user successfully', async () => {
        const createResult = await User.createUser(validUserData);
        const result = await User.updateUser(createResult.data.id, {
          name: 'Updated Name',
          businessName: 'Updated Business'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.name).toBe('Updated Name');
        expect(result.data.businessName).toBe('Updated Business');
      });

      test('should fail to update non-existent user', async () => {
        const result = await User.updateUser(99999, { name: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('User not found');
      });

      test('should prevent email change to existing email', async () => {
        await User.createUser(validUserData);
        const createResult2 = await User.createUser({
          ...validUserData,
          email: 'other@example.com'
        });
        
        const result = await User.updateUser(createResult2.data.id, {
          email: 'test@example.com'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.email).toBe('Email already registered');
      });

      test('should update password correctly', async () => {
        const createResult = await User.createUser(validUserData);
        await User.updateUser(createResult.data.id, {
          password: 'NewPassword456'
        });
        
        // Verify password was updated
        const authResult = await User.authenticate(
          validUserData.email,
          'NewPassword456'
        );
        expect(authResult.success).toBe(true);
      });

      test('should update updatedAt timestamp', async () => {
        const createResult = await User.createUser(validUserData);
        const originalUpdatedAt = createResult.data.updatedAt;
        
        // Wait at least 1 second since SQLite uses second precision for datetime
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        await User.updateUser(createResult.data.id, { name: 'New Name' });
        
        const updatedUser = User.findById(createResult.data.id);
        expect(updatedUser.updatedAt).not.toBe(originalUpdatedAt);
      });
    });

    describe('deleteUser', () => {
      test('should delete user successfully', async () => {
        const createResult = await User.createUser(validUserData);
        const result = User.deleteUser(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const user = User.findById(createResult.data.id);
        expect(user).toBeNull();
      });

      test('should fail to delete non-existent user', () => {
        const result = User.deleteUser(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('User not found');
      });
    });
  });

  describe('Authentication', () => {
    const validUserData = {
      email: 'auth@example.com',
      password: 'AuthPass123',
      name: 'Auth User'
    };

    beforeEach(async () => {
      await User.createUser(validUserData);
    });

    describe('authenticate', () => {
      test('should authenticate with correct credentials', async () => {
        const result = await User.authenticate('auth@example.com', 'AuthPass123');
        
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.user.email).toBe('auth@example.com');
        expect(result.user.passwordHash).toBeUndefined();
      });

      test('should reject wrong password', async () => {
        const result = await User.authenticate('auth@example.com', 'WrongPass123');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid email or password');
      });

      test('should reject non-existent email', async () => {
        const result = await User.authenticate('nonexistent@example.com', 'AnyPass123');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid email or password');
      });

      test('should reject empty credentials', async () => {
        const result = await User.authenticate('', '');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Email and password are required');
      });
    });

    describe('updatePassword', () => {
      test('should update password with correct current password', async () => {
        const user = User.findByEmail('auth@example.com');
        const result = await User.updatePassword(
          user.id,
          'AuthPass123',
          'NewAuthPass456'
        );
        
        expect(result.success).toBe(true);
        
        // Verify new password works
        const authResult = await User.authenticate('auth@example.com', 'NewAuthPass456');
        expect(authResult.success).toBe(true);
      });

      test('should reject with wrong current password', async () => {
        const user = User.findByEmail('auth@example.com');
        const result = await User.updatePassword(
          user.id,
          'WrongPass123',
          'NewAuthPass456'
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Current password is incorrect');
      });

      test('should validate new password', async () => {
        const user = User.findByEmail('auth@example.com');
        const result = await User.updatePassword(
          user.id,
          'AuthPass123',
          'weak' // Invalid password
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('at least 8 characters');
      });

      test('should fail for non-existent user', async () => {
        const result = await User.updatePassword(99999, 'AnyPass123', 'NewPass456');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('User not found');
      });
    });
  });

  describe('sanitizeUser', () => {
    test('should remove passwordHash from user object', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        passwordHash: '$2b$12$...',
        name: 'Test User',
        isVatRegistered: 1
      };
      
      const sanitized = User.sanitizeUser(user);
      
      expect(sanitized.passwordHash).toBeUndefined();
      expect(sanitized.id).toBe(1);
      expect(sanitized.email).toBe('test@example.com');
    });

    test('should convert isVatRegistered to boolean', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        passwordHash: 'hash',
        isVatRegistered: 1
      };
      
      const sanitized = User.sanitizeUser(user);
      expect(sanitized.isVatRegistered).toBe(true);
    });

    test('should return null for null input', () => {
      expect(User.sanitizeUser(null)).toBeNull();
    });
  });
});
