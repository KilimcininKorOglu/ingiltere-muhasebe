/**
 * User model for authentication and business profile management.
 * Provides CRUD operations and validation for user data.
 * 
 * @module models/User
 */

const bcrypt = require('bcrypt');
const validator = require('validator');
const { openDatabase, query, queryOne, execute, transaction } = require('../index');

/**
 * Number of salt rounds for bcrypt password hashing.
 * Higher values increase security but also computation time.
 */
const SALT_ROUNDS = 12;

/**
 * Valid language codes for preferred language.
 */
const VALID_LANGUAGES = ['en', 'tr'];

/**
 * Valid VAT accounting schemes recognized by HMRC.
 * - standard: Standard VAT accounting (default)
 * - flat_rate: Flat Rate Scheme - simplified fixed percentage
 * - cash: Cash Accounting Scheme - VAT on cash received/paid
 * - annual: Annual Accounting Scheme - annual VAT payments
 * - retail: Retail Schemes - for retail businesses
 */
const VALID_VAT_SCHEMES = ['standard', 'flat_rate', 'cash', 'annual', 'retail'];

/**
 * User field definitions with validation rules.
 * @typedef {Object} UserFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * User field definitions for validation.
 * @type {Object.<string, UserFieldDefinition>}
 */
const fieldDefinitions = {
  email: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (!validator.isEmail(value)) {
        return 'Invalid email format';
      }
      return null;
    }
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    maxLength: 128,
    validate: (value) => {
      if (value.length < 8) {
        return 'Password must be at least 8 characters long';
      }
      // Check for at least one uppercase, one lowercase, and one number
      if (!/[A-Z]/.test(value)) {
        return 'Password must contain at least one uppercase letter';
      }
      if (!/[a-z]/.test(value)) {
        return 'Password must contain at least one lowercase letter';
      }
      if (!/[0-9]/.test(value)) {
        return 'Password must contain at least one number';
      }
      return null;
    }
  },
  name: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (value.trim().length < 2) {
        return 'Name must be at least 2 characters long';
      }
      return null;
    }
  },
  businessName: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  businessAddress: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  vatNumber: {
    type: 'string',
    required: false,
    maxLength: 20,
    validate: (value) => {
      if (value && value.trim()) {
        // UK VAT number format: GB followed by 9 or 12 digits (with optional spaces)
        const cleanedValue = value.replace(/\s/g, '').toUpperCase();
        const vatRegex = /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/;
        if (!vatRegex.test(cleanedValue)) {
          return 'Invalid UK VAT number format (e.g., GB123456789)';
        }
      }
      return null;
    }
  },
  isVatRegistered: {
    type: 'boolean',
    required: false,
    default: false
  },
  companyNumber: {
    type: 'string',
    required: false,
    maxLength: 20,
    validate: (value) => {
      if (value && value.trim()) {
        // UK company number format: 8 characters (letters or digits)
        const cleanedValue = value.replace(/\s/g, '').toUpperCase();
        const companyRegex = /^[A-Z0-9]{8}$/;
        if (!companyRegex.test(cleanedValue)) {
          return 'Invalid UK company number format (must be 8 alphanumeric characters)';
        }
      }
      return null;
    }
  },
  taxYearStart: {
    type: 'string',
    required: false,
    default: '04-06',
    validate: (value) => {
      // Format: MM-DD
      const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      if (!dateRegex.test(value)) {
        return 'Invalid tax year start format (MM-DD)';
      }
      return null;
    }
  },
  preferredLanguage: {
    type: 'string',
    required: false,
    default: 'en',
    validate: (value) => {
      if (!VALID_LANGUAGES.includes(value)) {
        return `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}`;
      }
      return null;
    }
  },
  invoicePrefix: {
    type: 'string',
    required: false,
    default: 'INV',
    maxLength: 20,
    validate: (value) => {
      if (value && value.trim()) {
        // Allow alphanumeric characters, hyphens, and underscores
        const prefixRegex = /^[A-Za-z0-9\-_]+$/;
        if (!prefixRegex.test(value.trim())) {
          return 'Invoice prefix can only contain letters, numbers, hyphens, and underscores';
        }
        if (value.trim().length < 1) {
          return 'Invoice prefix must be at least 1 character long';
        }
      }
      return null;
    }
  },
  nextInvoiceNumber: {
    type: 'number',
    required: false,
    default: 1,
    validate: (value) => {
      if (value !== undefined && value !== null) {
        if (!Number.isInteger(value) || value < 1) {
          return 'Next invoice number must be a positive integer';
        }
      }
      return null;
    }
  },
  vatScheme: {
    type: 'string',
    required: false,
    default: 'standard',
    validate: (value) => {
      if (value && !VALID_VAT_SCHEMES.includes(value)) {
        return `Invalid VAT scheme. Must be one of: ${VALID_VAT_SCHEMES.join(', ')}`;
      }
      return null;
    }
  },
  currency: {
    type: 'string',
    required: false,
    default: 'GBP',
    validate: (value) => {
      const validCurrencies = ['GBP', 'EUR', 'USD'];
      if (value && !validCurrencies.includes(value)) {
        return `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`;
      }
      return null;
    }
  },
  dateFormat: {
    type: 'string',
    required: false,
    default: 'DD/MM/YYYY',
    validate: (value) => {
      const validFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
      if (value && !validFormats.includes(value)) {
        return `Invalid date format. Must be one of: ${validFormats.join(', ')}`;
      }
      return null;
    }
  }
};

/**
 * User data object
 * @typedef {Object} UserData
 * @property {number} [id] - User ID (auto-generated)
 * @property {string} email - User email
 * @property {string} [password] - Plain text password (for creation/update)
 * @property {string} [passwordHash] - Hashed password (from database)
 * @property {string} name - User's full name
 * @property {string} [businessName] - Business/company name
 * @property {string} [businessAddress] - Business address
 * @property {string} [vatNumber] - VAT registration number
 * @property {boolean} [isVatRegistered] - VAT registration status
 * @property {string} [companyNumber] - Company registration number
 * @property {string} [taxYearStart] - Tax year start date (MM-DD format)
 * @property {string} [preferredLanguage] - Preferred language ('en' or 'tr')
 * @property {string} [createdAt] - Creation timestamp
 * @property {string} [updatedAt] - Last update timestamp
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Object.<string, string>} errors - Field-specific error messages
 */

/**
 * Validates user data against field definitions.
 * 
 * @param {Partial<UserData>} userData - User data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateUserData(userData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = userData[fieldName];

    // Skip password validation if not provided on update
    if (isUpdate && fieldName === 'password' && value === undefined) {
      continue;
    }

    // Check required fields (only for create operations or if field is provided)
    if (definition.required && !isUpdate) {
      if (value === undefined || value === null || value === '') {
        errors[fieldName] = `${fieldName} is required`;
        continue;
      }
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type validation
    if (definition.type === 'string' && typeof value !== 'string') {
      errors[fieldName] = `${fieldName} must be a string`;
      continue;
    }

    if (definition.type === 'boolean' && typeof value !== 'boolean') {
      errors[fieldName] = `${fieldName} must be a boolean`;
      continue;
    }

    // Length validation
    if (definition.maxLength && typeof value === 'string' && value.length > definition.maxLength) {
      errors[fieldName] = `${fieldName} must not exceed ${definition.maxLength} characters`;
      continue;
    }

    if (definition.minLength && typeof value === 'string' && value.length < definition.minLength) {
      errors[fieldName] = `${fieldName} must be at least ${definition.minLength} characters`;
      continue;
    }

    // Custom validation
    if (definition.validate) {
      const validationError = definition.validate(value);
      if (validationError) {
        errors[fieldName] = validationError;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Hashes a plain text password using bcrypt.
 * 
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password.
 * 
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Sanitizes user data for output (removes sensitive fields).
 * 
 * @param {UserData} user - User data object
 * @returns {UserData} Sanitized user data (without passwordHash)
 */
function sanitizeUser(user) {
  if (!user) return null;
  
  const { passwordHash, ...sanitizedUser } = user;
  // Convert SQLite integer to boolean for isVatRegistered
  if (sanitizedUser.isVatRegistered !== undefined) {
    sanitizedUser.isVatRegistered = Boolean(sanitizedUser.isVatRegistered);
  }
  return sanitizedUser;
}

/**
 * Creates a new user in the database.
 * 
 * @param {UserData} userData - User data to create
 * @returns {Promise<{success: boolean, data?: UserData, errors?: Object.<string, string>}>}
 */
async function createUser(userData) {
  // Validate input data
  const validation = validateUserData(userData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if email already exists
  const existingUser = findByEmail(userData.email);
  if (existingUser) {
    return { success: false, errors: { email: 'Email already registered' } };
  }

  try {
    // Hash the password
    const passwordHash = await hashPassword(userData.password);

    // Prepare the insert data
    const insertData = {
      email: userData.email.toLowerCase().trim(),
      passwordHash,
      name: userData.name.trim(),
      businessName: userData.businessName?.trim() || null,
      businessAddress: userData.businessAddress?.trim() || null,
      vatNumber: userData.vatNumber?.replace(/\s/g, '').toUpperCase() || null,
      isVatRegistered: userData.isVatRegistered ? 1 : 0,
      companyNumber: userData.companyNumber?.replace(/\s/g, '').toUpperCase() || null,
      taxYearStart: userData.taxYearStart || '04-06',
      preferredLanguage: userData.preferredLanguage || 'en',
      invoicePrefix: userData.invoicePrefix?.trim().toUpperCase() || 'INV',
      nextInvoiceNumber: userData.nextInvoiceNumber || 1,
      vatScheme: userData.vatScheme || 'standard',
      currency: userData.currency || 'GBP',
      dateFormat: userData.dateFormat || 'DD/MM/YYYY'
    };

    const result = execute(`
      INSERT INTO users (
        email, passwordHash, name, businessName, businessAddress,
        vatNumber, isVatRegistered, companyNumber, taxYearStart, preferredLanguage,
        invoicePrefix, nextInvoiceNumber, vatScheme, currency, dateFormat
      ) VALUES (
        @email, @passwordHash, @name, @businessName, @businessAddress,
        @vatNumber, @isVatRegistered, @companyNumber, @taxYearStart, @preferredLanguage,
        @invoicePrefix, @nextInvoiceNumber, @vatScheme, @currency, @dateFormat
      )
    `, insertData);

    // Fetch the created user
    const createdUser = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeUser(createdUser) };

  } catch (error) {
    console.error('Error creating user:', error.message);
    return { success: false, errors: { general: 'Failed to create user' } };
  }
}

/**
 * Finds a user by ID.
 * 
 * @param {number} id - User ID
 * @returns {UserData|null} User data or null if not found
 */
function findById(id) {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
  return user || null;
}

/**
 * Finds a user by email.
 * 
 * @param {string} email - User email
 * @returns {UserData|null} User data or null if not found
 */
function findByEmail(email) {
  if (!email) return null;
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  return user || null;
}

/**
 * Gets all users (paginated).
 * 
 * @param {Object} options - Pagination options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @returns {{users: UserData[], total: number, page: number, limit: number}}
 */
function getAllUsers({ page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  
  const users = query(
    'SELECT * FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  
  const totalResult = queryOne('SELECT COUNT(*) as count FROM users');
  const total = totalResult?.count || 0;

  return {
    users: users.map(sanitizeUser),
    total,
    page,
    limit
  };
}

/**
 * Updates a user's data.
 * 
 * @param {number} id - User ID
 * @param {Partial<UserData>} userData - Data to update
 * @returns {Promise<{success: boolean, data?: UserData, errors?: Object.<string, string>}>}
 */
async function updateUser(id, userData) {
  // Validate input data
  const validation = validateUserData(userData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if user exists
  const existingUser = findById(id);
  if (!existingUser) {
    return { success: false, errors: { general: 'User not found' } };
  }

  // Check if email is being changed and is already taken
  if (userData.email && userData.email.toLowerCase().trim() !== existingUser.email) {
    const emailUser = findByEmail(userData.email);
    if (emailUser) {
      return { success: false, errors: { email: 'Email already registered' } };
    }
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (userData.email !== undefined) {
      updateFields.push('email = @email');
      updateParams.email = userData.email.toLowerCase().trim();
    }

    if (userData.password !== undefined) {
      updateFields.push('passwordHash = @passwordHash');
      updateParams.passwordHash = await hashPassword(userData.password);
    }

    if (userData.name !== undefined) {
      updateFields.push('name = @name');
      updateParams.name = userData.name.trim();
    }

    if (userData.businessName !== undefined) {
      updateFields.push('businessName = @businessName');
      updateParams.businessName = userData.businessName?.trim() || null;
    }

    if (userData.businessAddress !== undefined) {
      updateFields.push('businessAddress = @businessAddress');
      updateParams.businessAddress = userData.businessAddress?.trim() || null;
    }

    if (userData.vatNumber !== undefined) {
      updateFields.push('vatNumber = @vatNumber');
      updateParams.vatNumber = userData.vatNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (userData.isVatRegistered !== undefined) {
      updateFields.push('isVatRegistered = @isVatRegistered');
      updateParams.isVatRegistered = userData.isVatRegistered ? 1 : 0;
    }

    if (userData.companyNumber !== undefined) {
      updateFields.push('companyNumber = @companyNumber');
      updateParams.companyNumber = userData.companyNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (userData.taxYearStart !== undefined) {
      updateFields.push('taxYearStart = @taxYearStart');
      updateParams.taxYearStart = userData.taxYearStart;
    }

    if (userData.preferredLanguage !== undefined) {
      updateFields.push('preferredLanguage = @preferredLanguage');
      updateParams.preferredLanguage = userData.preferredLanguage;
    }

    if (userData.invoicePrefix !== undefined) {
      updateFields.push('invoicePrefix = @invoicePrefix');
      updateParams.invoicePrefix = userData.invoicePrefix?.trim().toUpperCase() || 'INV';
    }

    if (userData.nextInvoiceNumber !== undefined) {
      updateFields.push('nextInvoiceNumber = @nextInvoiceNumber');
      updateParams.nextInvoiceNumber = userData.nextInvoiceNumber;
    }

    if (userData.vatScheme !== undefined) {
      updateFields.push('vatScheme = @vatScheme');
      updateParams.vatScheme = userData.vatScheme || 'standard';
    }

    if (userData.currency !== undefined) {
      updateFields.push('currency = @currency');
      updateParams.currency = userData.currency || 'GBP';
    }

    if (userData.dateFormat !== undefined) {
      updateFields.push('dateFormat = @dateFormat');
      updateParams.dateFormat = userData.dateFormat || 'DD/MM/YYYY';
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeUser(existingUser) };
    }

    execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated user
    const updatedUser = findById(id);
    return { success: true, data: sanitizeUser(updatedUser) };

  } catch (error) {
    console.error('Error updating user:', error.message);
    return { success: false, errors: { general: 'Failed to update user' } };
  }
}

/**
 * Deletes a user by ID.
 * 
 * @param {number} id - User ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteUser(id) {
  const existingUser = findById(id);
  if (!existingUser) {
    return { success: false, error: 'User not found' };
  }

  try {
    execute('DELETE FROM users WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error.message);
    return { success: false, error: 'Failed to delete user' };
  }
}

/**
 * Authenticates a user with email and password.
 * 
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<{success: boolean, user?: UserData, error?: string}>}
 */
async function authenticate(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const user = findByEmail(email);
  if (!user) {
    // Use same error message to prevent user enumeration
    return { success: false, error: 'Invalid email or password' };
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  return { success: true, user: sanitizeUser(user) };
}

/**
 * Updates user's password.
 * 
 * @param {number} id - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updatePassword(id, currentPassword, newPassword) {
  const user = findById(id);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Verify current password
  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  // Validate new password
  const passwordValidation = fieldDefinitions.password.validate(newPassword);
  if (passwordValidation) {
    return { success: false, error: passwordValidation };
  }

  // Update password
  const result = await updateUser(id, { password: newPassword });
  if (!result.success) {
    return { success: false, error: 'Failed to update password' };
  }

  return { success: true };
}

module.exports = {
  // CRUD operations
  createUser,
  findById,
  findByEmail,
  getAllUsers,
  updateUser,
  deleteUser,
  
  // Authentication
  authenticate,
  updatePassword,
  hashPassword,
  comparePassword,
  
  // Validation
  validateUserData,
  fieldDefinitions,
  
  // Utilities
  sanitizeUser,
  
  // Constants
  VALID_LANGUAGES,
  VALID_VAT_SCHEMES,
  SALT_ROUNDS
};
