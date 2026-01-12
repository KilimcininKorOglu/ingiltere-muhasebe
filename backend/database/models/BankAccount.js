/**
 * BankAccount model for managing bank account records with UK-specific banking details.
 * Provides CRUD operations and validation for bank account data.
 * 
 * UK Banking Details:
 * - Sort Code: 6-digit code identifying the bank branch (format: XX-XX-XX)
 * - Account Number: 8-digit account number
 * - IBAN: Optional International Bank Account Number
 * - BIC/SWIFT: Optional Bank Identifier Code
 * 
 * @module models/BankAccount
 */

const validator = require('validator');
const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { VALID_ACCOUNT_TYPES, VALID_CURRENCIES } = require('../migrations/010_create_bank_accounts_table');

/**
 * Valid bank account types.
 */
const BANK_ACCOUNT_TYPES = VALID_ACCOUNT_TYPES;

/**
 * Valid currency codes.
 */
const BANK_CURRENCIES = VALID_CURRENCIES;

/**
 * UK Sort Code regex pattern.
 * Format: 6 digits, optionally with hyphens (XX-XX-XX or XXXXXX)
 */
const SORT_CODE_REGEX = /^(\d{2})-?(\d{2})-?(\d{2})$/;

/**
 * UK Account Number regex pattern.
 * Format: 8 digits
 */
const ACCOUNT_NUMBER_REGEX = /^\d{8}$/;

/**
 * IBAN regex pattern (basic validation).
 * Format: 2 letters (country) + 2 digits (check) + up to 30 alphanumeric characters
 */
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;

/**
 * BIC/SWIFT regex pattern.
 * Format: 8 or 11 alphanumeric characters
 */
const BIC_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/**
 * BankAccount field definitions with validation rules.
 * @typedef {Object} BankAccountFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * BankAccount field definitions for validation.
 * @type {Object.<string, BankAccountFieldDefinition>}
 */
const fieldDefinitions = {
  userId: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value <= 0) {
        return 'userId must be a positive integer';
      }
      return null;
    }
  },
  accountName: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (value && value.trim().length < 2) {
        return 'accountName must be at least 2 characters long';
      }
      return null;
    }
  },
  bankName: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (value && value.trim().length < 2) {
        return 'bankName must be at least 2 characters long';
      }
      return null;
    }
  },
  accountType: {
    type: 'string',
    required: false,
    default: 'current',
    validate: (value) => {
      if (value && !BANK_ACCOUNT_TYPES.includes(value)) {
        return `Invalid accountType. Must be one of: ${BANK_ACCOUNT_TYPES.join(', ')}`;
      }
      return null;
    }
  },
  sortCode: {
    type: 'string',
    required: true,
    maxLength: 8,
    validate: (value) => {
      if (!value) return null;
      const cleanedValue = value.replace(/-/g, '');
      if (!/^\d{6}$/.test(cleanedValue)) {
        return 'Invalid UK sort code format. Must be 6 digits (e.g., 12-34-56 or 123456)';
      }
      return null;
    }
  },
  accountNumber: {
    type: 'string',
    required: true,
    maxLength: 8,
    validate: (value) => {
      if (!value) return null;
      if (!ACCOUNT_NUMBER_REGEX.test(value)) {
        return 'Invalid UK account number format. Must be 8 digits';
      }
      return null;
    }
  },
  iban: {
    type: 'string',
    required: false,
    maxLength: 34,
    validate: (value) => {
      if (value && value.trim()) {
        const cleanedValue = value.replace(/\s/g, '').toUpperCase();
        if (!IBAN_REGEX.test(cleanedValue)) {
          return 'Invalid IBAN format';
        }
      }
      return null;
    }
  },
  bic: {
    type: 'string',
    required: false,
    maxLength: 11,
    validate: (value) => {
      if (value && value.trim()) {
        const cleanedValue = value.replace(/\s/g, '').toUpperCase();
        if (!BIC_REGEX.test(cleanedValue)) {
          return 'Invalid BIC/SWIFT code format';
        }
      }
      return null;
    }
  },
  currency: {
    type: 'string',
    required: false,
    default: 'GBP',
    validate: (value) => {
      if (value && !BANK_CURRENCIES.includes(value.toUpperCase())) {
        return `Invalid currency. Must be one of: ${BANK_CURRENCIES.join(', ')}`;
      }
      return null;
    }
  },
  openingBalance: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'openingBalance must be an integer (in pence)';
      }
      return null;
    }
  },
  currentBalance: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'currentBalance must be an integer (in pence)';
      }
      return null;
    }
  },
  isDefault: {
    type: 'boolean',
    required: false,
    default: false
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 5000
  }
};

/**
 * BankAccount data object
 * @typedef {Object} BankAccountData
 * @property {number} [id] - Bank Account ID (auto-generated)
 * @property {number} userId - User ID who owns the bank account
 * @property {string} accountName - Friendly name for the account
 * @property {string} bankName - Name of the bank
 * @property {string} [accountType] - Type of account (current, savings, business)
 * @property {string} sortCode - UK sort code (6 digits)
 * @property {string} accountNumber - UK account number (8 digits)
 * @property {string} [iban] - Optional IBAN
 * @property {string} [bic] - Optional BIC/SWIFT code
 * @property {string} [currency] - Account currency (GBP, EUR, USD)
 * @property {number} [openingBalance] - Initial balance in pence
 * @property {number} [currentBalance] - Current balance in pence
 * @property {boolean} [isDefault] - Whether this is the default account
 * @property {boolean} [isActive] - Whether the account is active
 * @property {string} [notes] - Additional notes
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
 * Validates UK sort code format.
 * 
 * @param {string} sortCode - Sort code to validate
 * @returns {string|null} Error message or null if valid
 */
function validateSortCode(sortCode) {
  if (!sortCode) return null;
  const cleanedValue = sortCode.replace(/-/g, '');
  if (!/^\d{6}$/.test(cleanedValue)) {
    return 'Invalid UK sort code format. Must be 6 digits (e.g., 12-34-56 or 123456)';
  }
  return null;
}

/**
 * Validates UK account number format.
 * 
 * @param {string} accountNumber - Account number to validate
 * @returns {string|null} Error message or null if valid
 */
function validateAccountNumber(accountNumber) {
  if (!accountNumber) return null;
  if (!ACCOUNT_NUMBER_REGEX.test(accountNumber)) {
    return 'Invalid UK account number format. Must be 8 digits';
  }
  return null;
}

/**
 * Validates IBAN format.
 * 
 * @param {string} iban - IBAN to validate
 * @returns {string|null} Error message or null if valid
 */
function validateIban(iban) {
  if (!iban || !iban.trim()) return null;
  const cleanedValue = iban.replace(/\s/g, '').toUpperCase();
  if (!IBAN_REGEX.test(cleanedValue)) {
    return 'Invalid IBAN format';
  }
  return null;
}

/**
 * Validates BIC/SWIFT code format.
 * 
 * @param {string} bic - BIC to validate
 * @returns {string|null} Error message or null if valid
 */
function validateBic(bic) {
  if (!bic || !bic.trim()) return null;
  const cleanedValue = bic.replace(/\s/g, '').toUpperCase();
  if (!BIC_REGEX.test(cleanedValue)) {
    return 'Invalid BIC/SWIFT code format';
  }
  return null;
}

/**
 * Formats sort code to standard format (XX-XX-XX).
 * 
 * @param {string} sortCode - Sort code to format
 * @returns {string} Formatted sort code
 */
function formatSortCode(sortCode) {
  if (!sortCode) return '';
  const digits = sortCode.replace(/\D/g, '');
  if (digits.length !== 6) return sortCode;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

/**
 * Normalizes sort code to digits only (for storage).
 * 
 * @param {string} sortCode - Sort code to normalize
 * @returns {string} Normalized sort code (6 digits)
 */
function normalizeSortCode(sortCode) {
  if (!sortCode) return '';
  return sortCode.replace(/\D/g, '');
}

/**
 * Validates bank account data against field definitions.
 * 
 * @param {Partial<BankAccountData>} bankAccountData - Bank account data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateBankAccountData(bankAccountData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = bankAccountData[fieldName];

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

    if (definition.type === 'number' && typeof value !== 'number') {
      errors[fieldName] = `${fieldName} must be a number`;
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
 * Sanitizes bank account data for output (converts SQLite integers to booleans).
 * 
 * @param {BankAccountData} bankAccount - Bank account data object
 * @returns {BankAccountData} Sanitized bank account data
 */
function sanitizeBankAccount(bankAccount) {
  if (!bankAccount) return null;
  
  return {
    ...bankAccount,
    isDefault: Boolean(bankAccount.isDefault),
    isActive: Boolean(bankAccount.isActive),
    // Format sort code for display
    sortCodeFormatted: formatSortCode(bankAccount.sortCode)
  };
}

/**
 * Creates a new bank account in the database.
 * 
 * @param {BankAccountData} bankAccountData - Bank account data to create
 * @returns {{success: boolean, data?: BankAccountData, errors?: Object.<string, string>}}
 */
function createBankAccount(bankAccountData) {
  // Validate input data
  const validation = validateBankAccountData(bankAccountData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Normalize sort code (store without hyphens)
    const normalizedSortCode = normalizeSortCode(bankAccountData.sortCode);

    // Prepare the insert data
    const insertData = {
      userId: bankAccountData.userId,
      accountName: bankAccountData.accountName.trim(),
      bankName: bankAccountData.bankName.trim(),
      accountType: bankAccountData.accountType || 'current',
      sortCode: normalizedSortCode,
      accountNumber: bankAccountData.accountNumber,
      iban: bankAccountData.iban?.replace(/\s/g, '').toUpperCase() || null,
      bic: bankAccountData.bic?.replace(/\s/g, '').toUpperCase() || null,
      currency: (bankAccountData.currency || 'GBP').toUpperCase(),
      openingBalance: bankAccountData.openingBalance || 0,
      currentBalance: bankAccountData.currentBalance !== undefined 
        ? bankAccountData.currentBalance 
        : (bankAccountData.openingBalance || 0),
      isDefault: bankAccountData.isDefault ? 1 : 0,
      isActive: bankAccountData.isActive !== undefined ? (bankAccountData.isActive ? 1 : 0) : 1,
      notes: bankAccountData.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO bank_accounts (
        userId, accountName, bankName, accountType, sortCode, accountNumber,
        iban, bic, currency, openingBalance, currentBalance, isDefault, isActive, notes
      ) VALUES (
        @userId, @accountName, @bankName, @accountType, @sortCode, @accountNumber,
        @iban, @bic, @currency, @openingBalance, @currentBalance, @isDefault, @isActive, @notes
      )
    `, insertData);

    // Fetch the created bank account
    const createdBankAccount = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeBankAccount(createdBankAccount) };

  } catch (error) {
    // Check for unique constraint violation
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return { success: false, errors: { sortCode: 'A bank account with this sort code and account number already exists for this user' } };
    }
    console.error('Error creating bank account:', error.message);
    return { success: false, errors: { general: 'Failed to create bank account' } };
  }
}

/**
 * Finds a bank account by ID.
 * 
 * @param {number} id - Bank Account ID
 * @returns {BankAccountData|null} Bank account data or null if not found
 */
function findById(id) {
  const bankAccount = queryOne('SELECT * FROM bank_accounts WHERE id = ?', [id]);
  return bankAccount || null;
}

/**
 * Finds a bank account by sort code and account number for a user.
 * 
 * @param {number} userId - User ID
 * @param {string} sortCode - UK sort code
 * @param {string} accountNumber - UK account number
 * @returns {BankAccountData|null} Bank account data or null if not found
 */
function findBySortCodeAndAccountNumber(userId, sortCode, accountNumber) {
  const normalizedSortCode = normalizeSortCode(sortCode);
  const bankAccount = queryOne(
    'SELECT * FROM bank_accounts WHERE userId = ? AND sortCode = ? AND accountNumber = ?',
    [userId, normalizedSortCode, accountNumber]
  );
  return bankAccount || null;
}

/**
 * Gets all bank accounts for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {boolean} [options.activeOnly=false] - Filter for active accounts only
 * @param {string} [options.accountType] - Filter by account type
 * @param {string} [options.sortBy='accountName'] - Sort field
 * @param {string} [options.sortOrder='ASC'] - Sort order
 * @returns {{bankAccounts: BankAccountData[], total: number, page: number, limit: number}}
 */
function getBankAccountsByUserId(userId, { page = 1, limit = 10, activeOnly = false, accountType, sortBy = 'accountName', sortOrder = 'ASC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['accountName', 'bankName', 'accountType', 'currentBalance', 'createdAt', 'updatedAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'accountName';
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (activeOnly) {
    whereClause += ' AND isActive = 1';
  }
  
  if (accountType && BANK_ACCOUNT_TYPES.includes(accountType)) {
    whereClause += ' AND accountType = ?';
    params.push(accountType);
  }
  
  const bankAccounts = query(
    `SELECT * FROM bank_accounts ${whereClause} ORDER BY isDefault DESC, ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM bank_accounts ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    bankAccounts: bankAccounts.map(sanitizeBankAccount),
    total,
    page,
    limit
  };
}

/**
 * Gets all active bank accounts for a user (without pagination).
 * 
 * @param {number} userId - User ID
 * @returns {BankAccountData[]} Array of active bank accounts
 */
function getActiveBankAccounts(userId) {
  const bankAccounts = query(
    'SELECT * FROM bank_accounts WHERE userId = ? AND isActive = 1 ORDER BY isDefault DESC, accountName ASC',
    [userId]
  );
  return bankAccounts.map(sanitizeBankAccount);
}

/**
 * Gets the default bank account for a user.
 * 
 * @param {number} userId - User ID
 * @returns {BankAccountData|null} Default bank account or null
 */
function getDefaultBankAccount(userId) {
  const bankAccount = queryOne(
    'SELECT * FROM bank_accounts WHERE userId = ? AND isDefault = 1 AND isActive = 1',
    [userId]
  );
  return bankAccount ? sanitizeBankAccount(bankAccount) : null;
}

/**
 * Updates a bank account's data.
 * 
 * @param {number} id - Bank Account ID
 * @param {Partial<BankAccountData>} bankAccountData - Data to update
 * @returns {{success: boolean, data?: BankAccountData, errors?: Object.<string, string>}}
 */
function updateBankAccount(id, bankAccountData) {
  // Check if bank account exists
  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, errors: { general: 'Bank account not found' } };
  }

  // Validate input data
  const validation = validateBankAccountData(bankAccountData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (bankAccountData.accountName !== undefined) {
      updateFields.push('accountName = @accountName');
      updateParams.accountName = bankAccountData.accountName.trim();
    }

    if (bankAccountData.bankName !== undefined) {
      updateFields.push('bankName = @bankName');
      updateParams.bankName = bankAccountData.bankName.trim();
    }

    if (bankAccountData.accountType !== undefined) {
      updateFields.push('accountType = @accountType');
      updateParams.accountType = bankAccountData.accountType;
    }

    if (bankAccountData.sortCode !== undefined) {
      updateFields.push('sortCode = @sortCode');
      updateParams.sortCode = normalizeSortCode(bankAccountData.sortCode);
    }

    if (bankAccountData.accountNumber !== undefined) {
      updateFields.push('accountNumber = @accountNumber');
      updateParams.accountNumber = bankAccountData.accountNumber;
    }

    if (bankAccountData.iban !== undefined) {
      updateFields.push('iban = @iban');
      updateParams.iban = bankAccountData.iban?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (bankAccountData.bic !== undefined) {
      updateFields.push('bic = @bic');
      updateParams.bic = bankAccountData.bic?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (bankAccountData.currency !== undefined) {
      updateFields.push('currency = @currency');
      updateParams.currency = bankAccountData.currency.toUpperCase();
    }

    if (bankAccountData.openingBalance !== undefined) {
      updateFields.push('openingBalance = @openingBalance');
      updateParams.openingBalance = bankAccountData.openingBalance;
    }

    if (bankAccountData.currentBalance !== undefined) {
      updateFields.push('currentBalance = @currentBalance');
      updateParams.currentBalance = bankAccountData.currentBalance;
    }

    if (bankAccountData.isDefault !== undefined) {
      updateFields.push('isDefault = @isDefault');
      updateParams.isDefault = bankAccountData.isDefault ? 1 : 0;
    }

    if (bankAccountData.isActive !== undefined) {
      updateFields.push('isActive = @isActive');
      updateParams.isActive = bankAccountData.isActive ? 1 : 0;
    }

    if (bankAccountData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = bankAccountData.notes?.trim() || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = datetime('now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeBankAccount(existingBankAccount) };
    }

    execute(
      `UPDATE bank_accounts SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated bank account
    const updatedBankAccount = findById(id);
    return { success: true, data: sanitizeBankAccount(updatedBankAccount) };

  } catch (error) {
    // Check for unique constraint violation
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return { success: false, errors: { sortCode: 'A bank account with this sort code and account number already exists for this user' } };
    }
    console.error('Error updating bank account:', error.message);
    return { success: false, errors: { general: 'Failed to update bank account' } };
  }
}

/**
 * Deletes a bank account by ID.
 * 
 * @param {number} id - Bank Account ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteBankAccount(id) {
  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, error: 'Bank account not found' };
  }

  try {
    execute('DELETE FROM bank_accounts WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting bank account:', error.message);
    return { success: false, error: 'Failed to delete bank account' };
  }
}

/**
 * Sets a bank account as the default for a user.
 * The trigger will automatically unset other defaults.
 * 
 * @param {number} id - Bank Account ID
 * @returns {{success: boolean, data?: BankAccountData, error?: string}}
 */
function setAsDefault(id) {
  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, error: 'Bank account not found' };
  }

  if (!existingBankAccount.isActive) {
    return { success: false, error: 'Cannot set inactive account as default' };
  }

  try {
    execute(
      `UPDATE bank_accounts SET isDefault = 1, updatedAt = datetime('now') WHERE id = ?`,
      [id]
    );

    const updatedBankAccount = findById(id);
    return { success: true, data: sanitizeBankAccount(updatedBankAccount) };
  } catch (error) {
    console.error('Error setting default bank account:', error.message);
    return { success: false, error: 'Failed to set default bank account' };
  }
}

/**
 * Deactivates a bank account.
 * 
 * @param {number} id - Bank Account ID
 * @returns {{success: boolean, data?: BankAccountData, error?: string}}
 */
function deactivateBankAccount(id) {
  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, error: 'Bank account not found' };
  }

  try {
    // If this was the default account, we need to unset it
    execute(
      `UPDATE bank_accounts SET isActive = 0, isDefault = 0, updatedAt = datetime('now') WHERE id = ?`,
      [id]
    );

    const updatedBankAccount = findById(id);
    return { success: true, data: sanitizeBankAccount(updatedBankAccount) };
  } catch (error) {
    console.error('Error deactivating bank account:', error.message);
    return { success: false, error: 'Failed to deactivate bank account' };
  }
}

/**
 * Reactivates a bank account.
 * 
 * @param {number} id - Bank Account ID
 * @returns {{success: boolean, data?: BankAccountData, error?: string}}
 */
function reactivateBankAccount(id) {
  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, error: 'Bank account not found' };
  }

  try {
    execute(
      `UPDATE bank_accounts SET isActive = 1, updatedAt = datetime('now') WHERE id = ?`,
      [id]
    );

    const updatedBankAccount = findById(id);
    return { success: true, data: sanitizeBankAccount(updatedBankAccount) };
  } catch (error) {
    console.error('Error reactivating bank account:', error.message);
    return { success: false, error: 'Failed to reactivate bank account' };
  }
}

/**
 * Updates the current balance of a bank account.
 * 
 * @param {number} id - Bank Account ID
 * @param {number} newBalance - New balance in pence
 * @returns {{success: boolean, data?: BankAccountData, error?: string}}
 */
function updateBalance(id, newBalance) {
  if (!Number.isInteger(newBalance)) {
    return { success: false, error: 'Balance must be an integer (in pence)' };
  }

  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, error: 'Bank account not found' };
  }

  try {
    execute(
      `UPDATE bank_accounts SET currentBalance = ?, updatedAt = datetime('now') WHERE id = ?`,
      [newBalance, id]
    );

    const updatedBankAccount = findById(id);
    return { success: true, data: sanitizeBankAccount(updatedBankAccount) };
  } catch (error) {
    console.error('Error updating bank account balance:', error.message);
    return { success: false, error: 'Failed to update bank account balance' };
  }
}

/**
 * Adjusts the current balance of a bank account by an amount.
 * Positive amount = credit (increase), negative amount = debit (decrease).
 * 
 * @param {number} id - Bank Account ID
 * @param {number} amount - Amount to adjust in pence (positive or negative)
 * @returns {{success: boolean, data?: BankAccountData, error?: string}}
 */
function adjustBalance(id, amount) {
  if (!Number.isInteger(amount)) {
    return { success: false, error: 'Amount must be an integer (in pence)' };
  }

  const existingBankAccount = findById(id);
  if (!existingBankAccount) {
    return { success: false, error: 'Bank account not found' };
  }

  try {
    const newBalance = existingBankAccount.currentBalance + amount;
    execute(
      `UPDATE bank_accounts SET currentBalance = ?, updatedAt = datetime('now') WHERE id = ?`,
      [newBalance, id]
    );

    const updatedBankAccount = findById(id);
    return { success: true, data: sanitizeBankAccount(updatedBankAccount) };
  } catch (error) {
    console.error('Error adjusting bank account balance:', error.message);
    return { success: false, error: 'Failed to adjust bank account balance' };
  }
}

/**
 * Gets bank account count by type for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Type counts
 */
function getTypeCounts(userId) {
  const results = query(
    `SELECT accountType, COUNT(*) as count FROM bank_accounts 
     WHERE userId = ? 
     GROUP BY accountType`,
    [userId]
  );
  
  const counts = {};
  for (const type of BANK_ACCOUNT_TYPES) {
    counts[type] = 0;
  }
  for (const row of results) {
    counts[row.accountType] = row.count;
  }
  return counts;
}

/**
 * Gets total balance across all active accounts for a user.
 * 
 * @param {number} userId - User ID
 * @param {string} [currency='GBP'] - Currency to filter by
 * @returns {{totalBalance: number, accountCount: number}}
 */
function getTotalBalance(userId, currency = 'GBP') {
  const result = queryOne(
    `SELECT 
       COALESCE(SUM(currentBalance), 0) as totalBalance,
       COUNT(*) as accountCount
     FROM bank_accounts 
     WHERE userId = ? AND isActive = 1 AND currency = ?`,
    [userId, currency.toUpperCase()]
  );
  
  return {
    totalBalance: result?.totalBalance || 0,
    accountCount: result?.accountCount || 0
  };
}

/**
 * Searches bank accounts by name or bank name.
 * 
 * @param {number} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {BankAccountData[]} Matching bank accounts
 */
function searchBankAccounts(userId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  
  const term = `%${searchTerm.trim()}%`;
  const bankAccounts = query(
    `SELECT * FROM bank_accounts 
     WHERE userId = ? AND (accountName LIKE ? OR bankName LIKE ?)
     ORDER BY isDefault DESC, accountName ASC`,
    [userId, term, term]
  );
  
  return bankAccounts.map(sanitizeBankAccount);
}

/**
 * Checks if a sort code and account number combination exists for a user.
 * 
 * @param {number} userId - User ID
 * @param {string} sortCode - UK sort code
 * @param {string} accountNumber - UK account number
 * @param {number} [excludeId] - ID to exclude from check (for updates)
 * @returns {boolean} True if combination exists
 */
function accountExists(userId, sortCode, accountNumber, excludeId = null) {
  const normalizedSortCode = normalizeSortCode(sortCode);
  let sql = 'SELECT COUNT(*) as count FROM bank_accounts WHERE userId = ? AND sortCode = ? AND accountNumber = ?';
  const params = [userId, normalizedSortCode, accountNumber];
  
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  
  const result = queryOne(sql, params);
  return result?.count > 0;
}

module.exports = {
  // CRUD operations
  createBankAccount,
  findById,
  findBySortCodeAndAccountNumber,
  getBankAccountsByUserId,
  getActiveBankAccounts,
  getDefaultBankAccount,
  updateBankAccount,
  deleteBankAccount,
  
  // Status operations
  setAsDefault,
  deactivateBankAccount,
  reactivateBankAccount,
  
  // Balance operations
  updateBalance,
  adjustBalance,
  getTotalBalance,
  
  // Query operations
  getTypeCounts,
  searchBankAccounts,
  accountExists,
  
  // Validation functions
  validateBankAccountData,
  validateSortCode,
  validateAccountNumber,
  validateIban,
  validateBic,
  fieldDefinitions,
  
  // Utility functions
  formatSortCode,
  normalizeSortCode,
  sanitizeBankAccount,
  
  // Constants
  BANK_ACCOUNT_TYPES,
  BANK_CURRENCIES
};
