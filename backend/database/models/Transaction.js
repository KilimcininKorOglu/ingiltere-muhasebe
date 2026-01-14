/**
 * Transaction model for pre-accounting transaction management.
 * Provides CRUD operations and validation for transaction data.
 * 
 * @module models/Transaction
 */

const validator = require('validator');
const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { VALID_TRANSACTION_TYPES, VALID_TRANSACTION_STATUSES, VALID_PAYMENT_METHODS } = require('../migrations/003_create_transactions_table');
const { dateToTimestamp, timestampToDate, isValidDateString } = require('../../utils/dateUtils');

/**
 * Valid transaction type values.
 */
const TRANSACTION_TYPES = VALID_TRANSACTION_TYPES;

/**
 * Valid transaction status values.
 */
const TRANSACTION_STATUSES = VALID_TRANSACTION_STATUSES;

/**
 * Valid payment method values.
 */
const PAYMENT_METHODS = VALID_PAYMENT_METHODS;

/**
 * Valid currencies.
 */
const VALID_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * Valid recurring frequencies.
 */
const VALID_RECURRING_FREQUENCIES = ['weekly', 'monthly', 'yearly'];

/**
 * Transaction field definitions with validation rules.
 * @typedef {Object} TransactionFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Transaction field definitions for validation.
 * @type {Object.<string, TransactionFieldDefinition>}
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
  categoryId: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== null && value !== undefined && (!Number.isInteger(value) || value <= 0)) {
        return 'categoryId must be a positive integer or null';
      }
      return null;
    }
  },
  type: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!TRANSACTION_TYPES.includes(value)) {
        return `Invalid type. Must be one of: ${TRANSACTION_TYPES.join(', ')}`;
      }
      return null;
    }
  },
  status: {
    type: 'string',
    required: false,
    default: 'pending',
    validate: (value) => {
      if (value && !TRANSACTION_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${TRANSACTION_STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  transactionDate: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!isValidDateString(value)) {
        return 'Invalid transactionDate format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  description: {
    type: 'string',
    required: true,
    maxLength: 500,
    validate: (value) => {
      if (!value || value.trim().length < 2) {
        return 'description must be at least 2 characters long';
      }
      return null;
    }
  },
  reference: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  amount: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'amount must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  vatAmount: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'vatAmount must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  totalAmount: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'totalAmount must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  vatRate: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 10000)) {
        return 'vatRate must be between 0 and 10000 (representing 0% to 100%)';
      }
      return null;
    }
  },
  currency: {
    type: 'string',
    required: false,
    default: 'GBP',
    validate: (value) => {
      if (value && !VALID_CURRENCIES.includes(value.toUpperCase())) {
        return `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}`;
      }
      return null;
    }
  },
  paymentMethod: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && !PAYMENT_METHODS.includes(value)) {
        return `Invalid paymentMethod. Must be one of: ${PAYMENT_METHODS.join(', ')}`;
      }
      return null;
    }
  },
  payee: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  receiptPath: {
    type: 'string',
    required: false,
    maxLength: 500
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 2000
  },
  isRecurring: {
    type: 'boolean',
    required: false,
    default: false
  },
  recurringFrequency: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && !VALID_RECURRING_FREQUENCIES.includes(value)) {
        return `Invalid recurringFrequency. Must be one of: ${VALID_RECURRING_FREQUENCIES.join(', ')}`;
      }
      return null;
    }
  },
  linkedTransactionId: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== null && value !== undefined && (!Number.isInteger(value) || value <= 0)) {
        return 'linkedTransactionId must be a positive integer or null';
      }
      return null;
    }
  },
  bankAccountId: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== null && value !== undefined && (!Number.isInteger(value) || value <= 0)) {
        return 'bankAccountId must be a positive integer or null';
      }
      return null;
    }
  }
};

/**
 * Transaction data object
 * @typedef {Object} TransactionData
 * @property {number} [id] - Transaction ID (auto-generated)
 * @property {number} userId - User ID who owns this transaction
 * @property {number} [categoryId] - Category ID
 * @property {string} type - Transaction type (income, expense, transfer)
 * @property {string} [status] - Transaction status
 * @property {string} transactionDate - Date of transaction (YYYY-MM-DD)
 * @property {string} description - Transaction description
 * @property {string} [reference] - External reference number
 * @property {number} [amount] - Amount in pence (before VAT)
 * @property {number} [vatAmount] - VAT amount in pence
 * @property {number} [totalAmount] - Total amount in pence
 * @property {number} [vatRate] - VAT rate in basis points
 * @property {string} [currency] - Currency code
 * @property {string} [paymentMethod] - Payment method
 * @property {string} [payee] - Person/company paid or received from
 * @property {string} [receiptPath] - Path to receipt file
 * @property {string} [notes] - Additional notes
 * @property {boolean} [isRecurring] - Whether recurring
 * @property {string} [recurringFrequency] - Recurrence frequency
 * @property {number} [linkedTransactionId] - Linked transaction ID
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
 * Validates transaction data against field definitions.
 * 
 * @param {Partial<TransactionData>} transactionData - Transaction data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateTransactionData(transactionData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = transactionData[fieldName];

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

  // Cross-field validation: isRecurring requires recurringFrequency
  if (transactionData.isRecurring && !transactionData.recurringFrequency) {
    if (!isUpdate) {
      errors.recurringFrequency = 'recurringFrequency is required when isRecurring is true';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Sanitizes transaction data for output.
 * Converts SQLite integers to booleans where appropriate.
 * 
 * @param {TransactionData} transaction - Transaction data object
 * @returns {TransactionData} Sanitized transaction data
 */
function sanitizeTransaction(transactionData) {
  if (!transactionData) return null;

  const sanitized = { ...transactionData };
  
  // Convert SQLite integers to booleans
  if (sanitized.isRecurring !== undefined) {
    sanitized.isRecurring = Boolean(sanitized.isRecurring);
  }
  
  // Convert timestamp to date string for output
  if (sanitized.transactionDate !== undefined && sanitized.transactionDate !== null) {
    sanitized.transactionDate = timestampToDate(sanitized.transactionDate);
  }
  
  return sanitized;
}

/**
 * Calculates VAT and total amounts based on amount and VAT rate.
 * 
 * @param {number} amount - Amount in pence (before VAT)
 * @param {number} vatRate - VAT rate in basis points (e.g., 2000 = 20%)
 * @returns {{vatAmount: number, totalAmount: number}}
 */
function calculateVat(amount, vatRate) {
  const vatAmount = Math.round((amount * vatRate) / 10000);
  const totalAmount = amount + vatAmount;
  return { vatAmount, totalAmount };
}

/**
 * Creates a new transaction in the database.
 * 
 * @param {TransactionData} transactionData - Transaction data to create
 * @returns {{success: boolean, data?: TransactionData, errors?: Object.<string, string>}}
 */
function createTransaction(transactionData) {
  // Validate input data
  const validation = validateTransactionData(transactionData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Calculate VAT if amount and vatRate are provided but vatAmount/totalAmount are not
    let vatAmount = transactionData.vatAmount || 0;
    let totalAmount = transactionData.totalAmount || 0;
    
    if (transactionData.amount && transactionData.vatRate && !transactionData.vatAmount) {
      const calculated = calculateVat(transactionData.amount, transactionData.vatRate);
      vatAmount = calculated.vatAmount;
      totalAmount = calculated.totalAmount;
    }

    // Prepare the insert data
    const insertData = {
      userId: transactionData.userId,
      categoryId: transactionData.categoryId || null,
      type: transactionData.type,
      status: transactionData.status || 'pending',
      transactionDate: dateToTimestamp(transactionData.transactionDate),
      description: transactionData.description.trim(),
      reference: transactionData.reference?.trim() || null,
      amount: transactionData.amount || 0,
      vatAmount,
      totalAmount,
      vatRate: transactionData.vatRate || 0,
      currency: (transactionData.currency || 'GBP').toUpperCase(),
      paymentMethod: transactionData.paymentMethod || null,
      payee: transactionData.payee?.trim() || null,
      receiptPath: transactionData.receiptPath?.trim() || null,
      notes: transactionData.notes?.trim() || null,
      isRecurring: transactionData.isRecurring ? 1 : 0,
      recurringFrequency: transactionData.recurringFrequency || null,
      linkedTransactionId: transactionData.linkedTransactionId || null,
      bankAccountId: transactionData.bankAccountId || null
    };

    const result = execute(`
      INSERT INTO transactions (
        userId, categoryId, type, status, transactionDate,
        description, reference, amount, vatAmount, totalAmount,
        vatRate, currency, paymentMethod, payee, receiptPath,
        notes, isRecurring, recurringFrequency, linkedTransactionId, bankAccountId
      ) VALUES (
        @userId, @categoryId, @type, @status, @transactionDate,
        @description, @reference, @amount, @vatAmount, @totalAmount,
        @vatRate, @currency, @paymentMethod, @payee, @receiptPath,
        @notes, @isRecurring, @recurringFrequency, @linkedTransactionId, @bankAccountId
      )
    `, insertData);

    // Fetch the created transaction
    const createdTransaction = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeTransaction(createdTransaction) };

  } catch (error) {
    console.error('Error creating transaction:', error.message);
    return { success: false, errors: { general: 'Failed to create transaction' } };
  }
}

/**
 * Finds a transaction by ID.
 * 
 * @param {number} id - Transaction ID
 * @returns {TransactionData|null} Transaction data or null if not found
 */
function findById(id) {
  const txn = queryOne('SELECT * FROM transactions WHERE id = ?', [id]);
  return txn || null;
}

/**
 * Finds transactions by reference.
 * 
 * @param {number} userId - User ID
 * @param {string} reference - Reference number
 * @returns {TransactionData[]} Array of transactions
 */
function findByReference(userId, reference) {
  if (!reference) return [];
  const transactions = query(
    'SELECT * FROM transactions WHERE userId = ? AND reference = ? ORDER BY transactionDate DESC',
    [userId, reference.trim()]
  );
  return transactions.map(sanitizeTransaction);
}

/**
 * Gets all transactions for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.type] - Filter by type
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.categoryId] - Filter by category
 * @param {string} [options.startDate] - Start date for date range
 * @param {string} [options.endDate] - End date for date range
 * @param {string} [options.sortBy='transactionDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{transactions: TransactionData[], total: number, page: number, limit: number}}
 */
function getTransactionsByUserId(userId, { 
  page = 1, 
  limit = 20, 
  type, 
  status, 
  categoryId,
  startDate,
  endDate,
  sortBy = 'transactionDate', 
  sortOrder = 'DESC' 
} = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['transactionDate', 'amount', 'totalAmount', 'type', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'transactionDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (type && TRANSACTION_TYPES.includes(type)) {
    whereClause += ' AND type = ?';
    params.push(type);
  }
  
  if (status && TRANSACTION_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  if (categoryId) {
    whereClause += ' AND categoryId = ?';
    params.push(categoryId);
  }
  
  if (startDate) {
    whereClause += ' AND transactionDate >= ?';
    params.push(dateToTimestamp(startDate));
  }
  
  if (endDate) {
    // Add 1 day to include the entire end date
    const endTimestamp = dateToTimestamp(endDate);
    whereClause += ' AND transactionDate <= ?';
    params.push(endTimestamp ? endTimestamp + 86399 : endDate);
  }
  
  const transactions = query(
    `SELECT * FROM transactions ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    transactions: transactions.map(sanitizeTransaction),
    total,
    page,
    limit
  };
}

/**
 * Gets transactions by type.
 * 
 * @param {number} userId - User ID
 * @param {string} type - Transaction type
 * @returns {TransactionData[]} Array of transactions
 */
function getByType(userId, type) {
  if (!TRANSACTION_TYPES.includes(type)) {
    return [];
  }
  const transactions = query(
    'SELECT * FROM transactions WHERE userId = ? AND type = ? ORDER BY transactionDate DESC',
    [userId, type]
  );
  return transactions.map(sanitizeTransaction);
}

/**
 * Gets transactions by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - Transaction status
 * @returns {TransactionData[]} Array of transactions
 */
function getByStatus(userId, status) {
  if (!TRANSACTION_STATUSES.includes(status)) {
    return [];
  }
  const transactions = query(
    'SELECT * FROM transactions WHERE userId = ? AND status = ? ORDER BY transactionDate DESC',
    [userId, status]
  );
  return transactions.map(sanitizeTransaction);
}

/**
 * Gets transactions for a date range.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {TransactionData[]} Array of transactions
 */
function getByDateRange(userId, startDate, endDate) {
  const transactions = query(
    `SELECT * FROM transactions 
     WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
     ORDER BY transactionDate DESC`,
    [userId, startDate, endDate]
  );
  return transactions.map(sanitizeTransaction);
}

/**
 * Gets transactions by category.
 * 
 * @param {number} userId - User ID
 * @param {number} categoryId - Category ID
 * @returns {TransactionData[]} Array of transactions
 */
function getByCategory(userId, categoryId) {
  const transactions = query(
    'SELECT * FROM transactions WHERE userId = ? AND categoryId = ? ORDER BY transactionDate DESC',
    [userId, categoryId]
  );
  return transactions.map(sanitizeTransaction);
}

/**
 * Updates a transaction's data.
 * 
 * @param {number} id - Transaction ID
 * @param {Partial<TransactionData>} transactionData - Data to update
 * @returns {{success: boolean, data?: TransactionData, errors?: Object.<string, string>}}
 */
function updateTransaction(id, transactionData) {
  // Validate input data
  const validation = validateTransactionData(transactionData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if transaction exists
  const existingTransaction = findById(id);
  if (!existingTransaction) {
    return { success: false, errors: { general: 'Transaction not found' } };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (transactionData.categoryId !== undefined) {
      updateFields.push('categoryId = @categoryId');
      updateParams.categoryId = transactionData.categoryId || null;
    }

    if (transactionData.type !== undefined) {
      updateFields.push('type = @type');
      updateParams.type = transactionData.type;
    }

    if (transactionData.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = transactionData.status;
    }

    if (transactionData.transactionDate !== undefined) {
      updateFields.push('transactionDate = @transactionDate');
      updateParams.transactionDate = dateToTimestamp(transactionData.transactionDate);
    }

    if (transactionData.description !== undefined) {
      updateFields.push('description = @description');
      updateParams.description = transactionData.description.trim();
    }

    if (transactionData.reference !== undefined) {
      updateFields.push('reference = @reference');
      updateParams.reference = transactionData.reference?.trim() || null;
    }

    if (transactionData.amount !== undefined) {
      updateFields.push('amount = @amount');
      updateParams.amount = transactionData.amount;
    }

    if (transactionData.vatAmount !== undefined) {
      updateFields.push('vatAmount = @vatAmount');
      updateParams.vatAmount = transactionData.vatAmount;
    }

    if (transactionData.totalAmount !== undefined) {
      updateFields.push('totalAmount = @totalAmount');
      updateParams.totalAmount = transactionData.totalAmount;
    }

    if (transactionData.vatRate !== undefined) {
      updateFields.push('vatRate = @vatRate');
      updateParams.vatRate = transactionData.vatRate;
    }

    if (transactionData.currency !== undefined) {
      updateFields.push('currency = @currency');
      updateParams.currency = transactionData.currency.toUpperCase();
    }

    if (transactionData.paymentMethod !== undefined) {
      updateFields.push('paymentMethod = @paymentMethod');
      updateParams.paymentMethod = transactionData.paymentMethod || null;
    }

    if (transactionData.payee !== undefined) {
      updateFields.push('payee = @payee');
      updateParams.payee = transactionData.payee?.trim() || null;
    }

    if (transactionData.receiptPath !== undefined) {
      updateFields.push('receiptPath = @receiptPath');
      updateParams.receiptPath = transactionData.receiptPath?.trim() || null;
    }

    if (transactionData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = transactionData.notes?.trim() || null;
    }

    if (transactionData.isRecurring !== undefined) {
      updateFields.push('isRecurring = @isRecurring');
      updateParams.isRecurring = transactionData.isRecurring ? 1 : 0;
    }

    if (transactionData.recurringFrequency !== undefined) {
      updateFields.push('recurringFrequency = @recurringFrequency');
      updateParams.recurringFrequency = transactionData.recurringFrequency || null;
    }

    if (transactionData.linkedTransactionId !== undefined) {
      updateFields.push('linkedTransactionId = @linkedTransactionId');
      updateParams.linkedTransactionId = transactionData.linkedTransactionId || null;
    }

    if (transactionData.bankAccountId !== undefined) {
      updateFields.push('bankAccountId = @bankAccountId');
      updateParams.bankAccountId = transactionData.bankAccountId || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeTransaction(existingTransaction) };
    }

    execute(
      `UPDATE transactions SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated transaction
    const updatedTransaction = findById(id);
    return { success: true, data: sanitizeTransaction(updatedTransaction) };

  } catch (error) {
    console.error('Error updating transaction:', error.message);
    return { success: false, errors: { general: 'Failed to update transaction' } };
  }
}

/**
 * Deletes a transaction by ID.
 * 
 * @param {number} id - Transaction ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteTransaction(id) {
  const existingTransaction = findById(id);
  if (!existingTransaction) {
    return { success: false, error: 'Transaction not found' };
  }

  try {
    execute('DELETE FROM transactions WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction:', error.message);
    return { success: false, error: 'Failed to delete transaction' };
  }
}

/**
 * Updates transaction status.
 * 
 * @param {number} id - Transaction ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: TransactionData, error?: string}}
 */
function updateStatus(id, status) {
  if (!TRANSACTION_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${TRANSACTION_STATUSES.join(', ')}` };
  }

  const existingTransaction = findById(id);
  if (!existingTransaction) {
    return { success: false, error: 'Transaction not found' };
  }

  try {
    execute(
      `UPDATE transactions SET status = @status, updatedAt = strftime('%s', 'now') WHERE id = @id`,
      { id, status }
    );

    const updatedTransaction = findById(id);
    return { success: true, data: sanitizeTransaction(updatedTransaction) };
  } catch (error) {
    console.error('Error updating transaction status:', error.message);
    return { success: false, error: 'Failed to update transaction status' };
  }
}

/**
 * Voids a transaction.
 * 
 * @param {number} id - Transaction ID
 * @returns {{success: boolean, data?: TransactionData, error?: string}}
 */
function voidTransaction(id) {
  return updateStatus(id, 'void');
}

/**
 * Gets transaction summary for a date range.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {{income: number, expense: number, netAmount: number, vatCollected: number, vatPaid: number}}
 */
function getSummary(userId, startDate, endDate) {
  const startTs = dateToTimestamp(startDate);
  const endTs = dateToTimestamp(endDate);
  const endTsWithTime = endTs ? endTs + 86399 : endTs;
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as expense,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as vatCollected,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as vatPaid
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startTs, endTsWithTime]);

  return {
    income: result.income || 0,
    expense: result.expense || 0,
    netAmount: (result.income || 0) - (result.expense || 0),
    vatCollected: result.vatCollected || 0,
    vatPaid: result.vatPaid || 0
  };
}

/**
 * Gets VAT summary for a date range (for VAT returns).
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {{outputVat: number, inputVat: number, netVat: number, totalSales: number, totalPurchases: number}}
 */
function getVatSummary(userId, startDate, endDate) {
  const startTs = dateToTimestamp(startDate);
  const endTs = dateToTimestamp(endDate);
  const endTsWithTime = endTs ? endTs + 86399 : endTs;
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as outputVat,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as inputVat,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as totalSales,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as totalPurchases
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startTs, endTsWithTime]);

  return {
    outputVat: result.outputVat || 0,
    inputVat: result.inputVat || 0,
    netVat: (result.outputVat || 0) - (result.inputVat || 0),
    totalSales: result.totalSales || 0,
    totalPurchases: result.totalPurchases || 0
  };
}

/**
 * Gets transaction count by type.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Type counts
 */
function getTypeCounts(userId) {
  const results = query(
    `SELECT type, COUNT(*) as count FROM transactions 
     WHERE userId = ? AND status != 'void'
     GROUP BY type`,
    [userId]
  );
  
  const counts = {};
  for (const type of TRANSACTION_TYPES) {
    counts[type] = 0;
  }
  for (const row of results) {
    counts[row.type] = row.count;
  }
  return counts;
}

/**
 * Gets transaction count by status.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM transactions 
     WHERE userId = ?
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of TRANSACTION_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Searches transactions by description or payee.
 * 
 * @param {number} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {TransactionData[]} Array of matching transactions
 */
function searchTransactions(userId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const term = `%${searchTerm.trim()}%`;
  const transactions = query(
    `SELECT * FROM transactions 
     WHERE userId = ? AND (description LIKE ? OR payee LIKE ? OR reference LIKE ? OR notes LIKE ?)
     ORDER BY transactionDate DESC`,
    [userId, term, term, term, term]
  );
  return transactions.map(sanitizeTransaction);
}

module.exports = {
  // CRUD operations
  createTransaction,
  findById,
  findByReference,
  getTransactionsByUserId,
  updateTransaction,
  deleteTransaction,
  
  // Query operations
  getByType,
  getByStatus,
  getByDateRange,
  getByCategory,
  searchTransactions,
  
  // Status operations
  updateStatus,
  voidTransaction,
  
  // Aggregations
  getSummary,
  getVatSummary,
  getTypeCounts,
  getStatusCounts,
  
  // Utilities
  sanitizeTransaction,
  calculateVat,
  
  // Validation
  validateTransactionData,
  fieldDefinitions,
  
  // Constants
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  VALID_CURRENCIES,
  VALID_RECURRING_FREQUENCIES
};
