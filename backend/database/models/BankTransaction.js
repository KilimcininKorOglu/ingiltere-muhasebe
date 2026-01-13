/**
 * BankTransaction model for managing imported bank statement transactions.
 * Provides CRUD operations and validation for bank transaction data.
 * 
 * Bank transactions are imported from external sources (CSV, Open Banking, etc.)
 * and are used for reconciliation with application transactions.
 * 
 * @module models/BankTransaction
 */

const validator = require('validator');
const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { 
  VALID_TRANSACTION_TYPES, 
  VALID_IMPORT_SOURCES, 
  VALID_RECONCILIATION_STATUSES 
} = require('../migrations/011_create_bank_transactions_table');
const { dateToTimestamp, timestampToDate, isValidDateString } = require('../../utils/dateUtils');

/**
 * Valid bank transaction types.
 */
const TRANSACTION_TYPES = VALID_TRANSACTION_TYPES;

/**
 * Valid import source types.
 */
const IMPORT_SOURCES = VALID_IMPORT_SOURCES;

/**
 * Valid reconciliation status values.
 */
const RECONCILIATION_STATUSES = VALID_RECONCILIATION_STATUSES;

/**
 * BankTransaction field definitions with validation rules.
 * @typedef {Object} BankTransactionFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * BankTransaction field definitions for validation.
 * @type {Object.<string, BankTransactionFieldDefinition>}
 */
const fieldDefinitions = {
  bankAccountId: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value <= 0) {
        return 'bankAccountId must be a positive integer';
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
  postingDate: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && !isValidDateString(value)) {
        return 'Invalid postingDate format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  description: {
    type: 'string',
    required: true,
    maxLength: 500,
    validate: (value) => {
      if (!value || value.trim().length < 1) {
        return 'description is required';
      }
      return null;
    }
  },
  reference: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  transactionType: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!TRANSACTION_TYPES.includes(value)) {
        return `Invalid transactionType. Must be one of: ${TRANSACTION_TYPES.join(', ')}`;
      }
      return null;
    }
  },
  amount: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value < 0) {
        return 'amount must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  runningBalance: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== undefined && value !== null && !Number.isInteger(value)) {
        return 'runningBalance must be an integer (in pence)';
      }
      return null;
    }
  },
  importSource: {
    type: 'string',
    required: false,
    default: 'manual',
    validate: (value) => {
      if (value && !IMPORT_SOURCES.includes(value)) {
        return `Invalid importSource. Must be one of: ${IMPORT_SOURCES.join(', ')}`;
      }
      return null;
    }
  },
  importBatchId: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  rawData: {
    type: 'string',
    required: false,
    maxLength: 10000
  },
  fitId: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  reconciliationStatus: {
    type: 'string',
    required: false,
    default: 'unmatched',
    validate: (value) => {
      if (value && !RECONCILIATION_STATUSES.includes(value)) {
        return `Invalid reconciliationStatus. Must be one of: ${RECONCILIATION_STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  reconciliationNotes: {
    type: 'string',
    required: false,
    maxLength: 2000
  },
  isReconciled: {
    type: 'boolean',
    required: false,
    default: false
  }
};

/**
 * BankTransaction data object
 * @typedef {Object} BankTransactionData
 * @property {number} [id] - Bank Transaction ID (auto-generated)
 * @property {number} bankAccountId - Bank Account ID
 * @property {string} transactionDate - Date of transaction (YYYY-MM-DD)
 * @property {string} [postingDate] - Date transaction was posted
 * @property {string} description - Transaction description
 * @property {string} [reference] - Bank reference number
 * @property {string} transactionType - Type (credit/debit)
 * @property {number} amount - Amount in pence (absolute value)
 * @property {number} [runningBalance] - Balance after transaction
 * @property {string} [importSource] - Import source type
 * @property {string} [importBatchId] - Batch ID for grouped imports
 * @property {string} [importedAt] - Import timestamp
 * @property {string} [rawData] - Original raw data (JSON)
 * @property {string} [fitId] - Financial Institution Transaction ID
 * @property {string} [reconciliationStatus] - Reconciliation status
 * @property {string} [reconciliationNotes] - Notes about reconciliation
 * @property {boolean} [isReconciled] - Whether fully reconciled
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
 * Validates bank transaction data against field definitions.
 * 
 * @param {Partial<BankTransactionData>} bankTransactionData - Data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateBankTransactionData(bankTransactionData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = bankTransactionData[fieldName];

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
 * Sanitizes bank transaction data for output.
 * Converts SQLite integers to booleans where appropriate.
 * 
 * @param {BankTransactionData} bankTransaction - Bank transaction data object
 * @returns {BankTransactionData} Sanitized bank transaction data
 */
function sanitizeBankTransaction(bankTransaction) {
  if (!bankTransaction) return null;

  return {
    ...bankTransaction,
    isReconciled: Boolean(bankTransaction.isReconciled),
    // Convert timestamps to date strings
    transactionDate: timestampToDate(bankTransaction.transactionDate),
    postingDate: bankTransaction.postingDate ? timestampToDate(bankTransaction.postingDate) : null,
    // Parse rawData JSON if present
    rawDataParsed: bankTransaction.rawData ? tryParseJson(bankTransaction.rawData) : null
  };
}

/**
 * Attempts to parse JSON, returns null on failure.
 * 
 * @param {string} jsonString - JSON string to parse
 * @returns {Object|null} Parsed object or null
 */
function tryParseJson(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Creates a new bank transaction in the database.
 * 
 * @param {BankTransactionData} bankTransactionData - Bank transaction data to create
 * @returns {{success: boolean, data?: BankTransactionData, errors?: Object.<string, string>}}
 */
function createBankTransaction(bankTransactionData) {
  // Validate input data
  const validation = validateBankTransactionData(bankTransactionData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Prepare the insert data
    const insertData = {
      bankAccountId: bankTransactionData.bankAccountId,
      transactionDate: dateToTimestamp(bankTransactionData.transactionDate),
      postingDate: bankTransactionData.postingDate ? dateToTimestamp(bankTransactionData.postingDate) : null,
      description: bankTransactionData.description.trim(),
      reference: bankTransactionData.reference?.trim() || null,
      transactionType: bankTransactionData.transactionType,
      amount: bankTransactionData.amount,
      runningBalance: bankTransactionData.runningBalance !== undefined ? bankTransactionData.runningBalance : null,
      importSource: bankTransactionData.importSource || 'manual',
      importBatchId: bankTransactionData.importBatchId?.trim() || null,
      rawData: bankTransactionData.rawData || null,
      fitId: bankTransactionData.fitId?.trim() || null,
      reconciliationStatus: bankTransactionData.reconciliationStatus || 'unmatched',
      reconciliationNotes: bankTransactionData.reconciliationNotes?.trim() || null,
      isReconciled: bankTransactionData.isReconciled ? 1 : 0
    };

    const result = execute(`
      INSERT INTO bank_transactions (
        bankAccountId, transactionDate, postingDate, description, reference,
        transactionType, amount, runningBalance, importSource, importBatchId,
        rawData, fitId, reconciliationStatus, reconciliationNotes, isReconciled
      ) VALUES (
        @bankAccountId, @transactionDate, @postingDate, @description, @reference,
        @transactionType, @amount, @runningBalance, @importSource, @importBatchId,
        @rawData, @fitId, @reconciliationStatus, @reconciliationNotes, @isReconciled
      )
    `, insertData);

    // Fetch the created bank transaction
    const createdBankTransaction = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeBankTransaction(createdBankTransaction) };

  } catch (error) {
    // Check for unique constraint violation (duplicate fitId)
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return { success: false, errors: { fitId: 'A transaction with this fitId already exists for this bank account' } };
    }
    // Check for foreign key violation
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      return { success: false, errors: { bankAccountId: 'Bank account not found' } };
    }
    console.error('Error creating bank transaction:', error.message);
    return { success: false, errors: { general: 'Failed to create bank transaction' } };
  }
}

/**
 * Creates multiple bank transactions in a batch (for imports).
 * 
 * @param {BankTransactionData[]} transactions - Array of bank transactions to create
 * @param {string} [batchId] - Optional batch ID for grouping
 * @returns {{success: boolean, created: number, failed: number, errors: Array}}
 */
function createBatch(transactions, batchId = null) {
  const generatedBatchId = batchId || `batch_${Date.now()}`;
  let created = 0;
  let failed = 0;
  const errors = [];

  const db = openDatabase();
  
  try {
    db.transaction(() => {
      for (const txn of transactions) {
        const txnWithBatch = { ...txn, importBatchId: generatedBatchId };
        const result = createBankTransaction(txnWithBatch);
        
        if (result.success) {
          created++;
        } else {
          failed++;
          errors.push({ transaction: txn, errors: result.errors });
        }
      }
    })();
    
    return { success: true, created, failed, errors, batchId: generatedBatchId };
  } catch (error) {
    console.error('Error creating batch:', error.message);
    return { success: false, created: 0, failed: transactions.length, errors: [{ general: error.message }] };
  }
}

/**
 * Finds a bank transaction by ID.
 * 
 * @param {number} id - Bank Transaction ID
 * @returns {BankTransactionData|null} Bank transaction data or null if not found
 */
function findById(id) {
  const bankTransaction = queryOne('SELECT * FROM bank_transactions WHERE id = ?', [id]);
  return bankTransaction || null;
}

/**
 * Finds bank transactions by fitId for a bank account (for deduplication).
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {string} fitId - Financial Institution Transaction ID
 * @returns {BankTransactionData|null} Bank transaction or null
 */
function findByFitId(bankAccountId, fitId) {
  if (!fitId) return null;
  const bankTransaction = queryOne(
    'SELECT * FROM bank_transactions WHERE bankAccountId = ? AND fitId = ?',
    [bankAccountId, fitId.trim()]
  );
  return bankTransaction || null;
}

/**
 * Gets all bank transactions for a bank account (paginated).
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @param {string} [options.startDate] - Start date filter
 * @param {string} [options.endDate] - End date filter
 * @param {string} [options.transactionType] - Filter by type (credit/debit)
 * @param {string} [options.reconciliationStatus] - Filter by reconciliation status
 * @param {string} [options.sortBy='transactionDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{transactions: BankTransactionData[], total: number, page: number, limit: number}}
 */
function getBankTransactionsByAccountId(bankAccountId, { 
  page = 1, 
  limit = 50, 
  startDate,
  endDate,
  transactionType,
  reconciliationStatus,
  sortBy = 'transactionDate', 
  sortOrder = 'DESC' 
} = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['transactionDate', 'postingDate', 'amount', 'description', 'createdAt', 'importedAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'transactionDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let whereClause = 'WHERE bankAccountId = ?';
  const params = [bankAccountId];
  
  if (startDate) {
    whereClause += ' AND transactionDate >= ?';
    params.push(dateToTimestamp(startDate));
  }
  
  if (endDate) {
    const endTs = dateToTimestamp(endDate);
    whereClause += ' AND transactionDate <= ?';
    params.push(endTs ? endTs + 86399 : endDate);
  }
  
  if (transactionType && TRANSACTION_TYPES.includes(transactionType)) {
    whereClause += ' AND transactionType = ?';
    params.push(transactionType);
  }
  
  if (reconciliationStatus && RECONCILIATION_STATUSES.includes(reconciliationStatus)) {
    whereClause += ' AND reconciliationStatus = ?';
    params.push(reconciliationStatus);
  }
  
  const transactions = query(
    `SELECT * FROM bank_transactions ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM bank_transactions ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    transactions: transactions.map(sanitizeBankTransaction),
    total,
    page,
    limit
  };
}

/**
 * Gets unreconciled bank transactions for a bank account.
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=100] - Max number of transactions
 * @returns {BankTransactionData[]} Array of unreconciled transactions
 */
function getUnreconciledTransactions(bankAccountId, { limit = 100 } = {}) {
  const transactions = query(
    `SELECT * FROM bank_transactions 
     WHERE bankAccountId = ? AND isReconciled = 0 AND reconciliationStatus = 'unmatched'
     ORDER BY transactionDate DESC
     LIMIT ?`,
    [bankAccountId, limit]
  );
  return transactions.map(sanitizeBankTransaction);
}

/**
 * Gets bank transactions by import batch ID.
 * 
 * @param {string} importBatchId - Import batch ID
 * @returns {BankTransactionData[]} Array of transactions in the batch
 */
function getByImportBatchId(importBatchId) {
  const transactions = query(
    'SELECT * FROM bank_transactions WHERE importBatchId = ? ORDER BY transactionDate DESC',
    [importBatchId]
  );
  return transactions.map(sanitizeBankTransaction);
}

/**
 * Gets transactions for a date range.
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {BankTransactionData[]} Array of transactions
 */
function getByDateRange(bankAccountId, startDate, endDate) {
  const transactions = query(
    `SELECT * FROM bank_transactions 
     WHERE bankAccountId = ? AND transactionDate >= ? AND transactionDate <= ?
     ORDER BY transactionDate DESC`,
    [bankAccountId, startDate, endDate]
  );
  return transactions.map(sanitizeBankTransaction);
}

/**
 * Updates a bank transaction's data.
 * 
 * @param {number} id - Bank Transaction ID
 * @param {Partial<BankTransactionData>} bankTransactionData - Data to update
 * @returns {{success: boolean, data?: BankTransactionData, errors?: Object.<string, string>}}
 */
function updateBankTransaction(id, bankTransactionData) {
  // Check if bank transaction exists
  const existingBankTransaction = findById(id);
  if (!existingBankTransaction) {
    return { success: false, errors: { general: 'Bank transaction not found' } };
  }

  // Validate input data
  const validation = validateBankTransactionData(bankTransactionData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (bankTransactionData.transactionDate !== undefined) {
      updateFields.push('transactionDate = @transactionDate');
      updateParams.transactionDate = dateToTimestamp(bankTransactionData.transactionDate);
    }

    if (bankTransactionData.postingDate !== undefined) {
      updateFields.push('postingDate = @postingDate');
      updateParams.postingDate = bankTransactionData.postingDate ? dateToTimestamp(bankTransactionData.postingDate) : null;
    }

    if (bankTransactionData.description !== undefined) {
      updateFields.push('description = @description');
      updateParams.description = bankTransactionData.description.trim();
    }

    if (bankTransactionData.reference !== undefined) {
      updateFields.push('reference = @reference');
      updateParams.reference = bankTransactionData.reference?.trim() || null;
    }

    if (bankTransactionData.transactionType !== undefined) {
      updateFields.push('transactionType = @transactionType');
      updateParams.transactionType = bankTransactionData.transactionType;
    }

    if (bankTransactionData.amount !== undefined) {
      updateFields.push('amount = @amount');
      updateParams.amount = bankTransactionData.amount;
    }

    if (bankTransactionData.runningBalance !== undefined) {
      updateFields.push('runningBalance = @runningBalance');
      updateParams.runningBalance = bankTransactionData.runningBalance;
    }

    if (bankTransactionData.reconciliationStatus !== undefined) {
      updateFields.push('reconciliationStatus = @reconciliationStatus');
      updateParams.reconciliationStatus = bankTransactionData.reconciliationStatus;
    }

    if (bankTransactionData.reconciliationNotes !== undefined) {
      updateFields.push('reconciliationNotes = @reconciliationNotes');
      updateParams.reconciliationNotes = bankTransactionData.reconciliationNotes?.trim() || null;
    }

    if (bankTransactionData.isReconciled !== undefined) {
      updateFields.push('isReconciled = @isReconciled');
      updateParams.isReconciled = bankTransactionData.isReconciled ? 1 : 0;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeBankTransaction(existingBankTransaction) };
    }

    execute(
      `UPDATE bank_transactions SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated bank transaction
    const updatedBankTransaction = findById(id);
    return { success: true, data: sanitizeBankTransaction(updatedBankTransaction) };

  } catch (error) {
    console.error('Error updating bank transaction:', error.message);
    return { success: false, errors: { general: 'Failed to update bank transaction' } };
  }
}

/**
 * Deletes a bank transaction by ID.
 * 
 * @param {number} id - Bank Transaction ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteBankTransaction(id) {
  const existingBankTransaction = findById(id);
  if (!existingBankTransaction) {
    return { success: false, error: 'Bank transaction not found' };
  }

  try {
    execute('DELETE FROM bank_transactions WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting bank transaction:', error.message);
    return { success: false, error: 'Failed to delete bank transaction' };
  }
}

/**
 * Deletes all bank transactions for an import batch.
 * 
 * @param {string} importBatchId - Import batch ID
 * @returns {{success: boolean, deletedCount: number, error?: string}}
 */
function deleteBatch(importBatchId) {
  try {
    const result = execute('DELETE FROM bank_transactions WHERE importBatchId = ?', [importBatchId]);
    return { success: true, deletedCount: result.changes };
  } catch (error) {
    console.error('Error deleting batch:', error.message);
    return { success: false, deletedCount: 0, error: 'Failed to delete batch' };
  }
}

/**
 * Updates reconciliation status for a bank transaction.
 * 
 * @param {number} id - Bank Transaction ID
 * @param {string} status - New reconciliation status
 * @param {string} [notes] - Optional notes
 * @returns {{success: boolean, data?: BankTransactionData, error?: string}}
 */
function updateReconciliationStatus(id, status, notes = null) {
  if (!RECONCILIATION_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${RECONCILIATION_STATUSES.join(', ')}` };
  }

  const existingBankTransaction = findById(id);
  if (!existingBankTransaction) {
    return { success: false, error: 'Bank transaction not found' };
  }

  try {
    const updateData = {
      id,
      reconciliationStatus: status,
      reconciliationNotes: notes?.trim() || existingBankTransaction.reconciliationNotes,
      isReconciled: status === 'matched' ? 1 : (status === 'excluded' ? 1 : 0)
    };

    execute(
      `UPDATE bank_transactions 
       SET reconciliationStatus = @reconciliationStatus, 
           reconciliationNotes = @reconciliationNotes,
           isReconciled = @isReconciled,
           updatedAt = strftime('%s', 'now') 
       WHERE id = @id`,
      updateData
    );

    const updatedBankTransaction = findById(id);
    return { success: true, data: sanitizeBankTransaction(updatedBankTransaction) };
  } catch (error) {
    console.error('Error updating reconciliation status:', error.message);
    return { success: false, error: 'Failed to update reconciliation status' };
  }
}

/**
 * Marks a bank transaction as excluded from reconciliation.
 * 
 * @param {number} id - Bank Transaction ID
 * @param {string} [notes] - Reason for exclusion
 * @returns {{success: boolean, data?: BankTransactionData, error?: string}}
 */
function excludeFromReconciliation(id, notes = null) {
  return updateReconciliationStatus(id, 'excluded', notes);
}

/**
 * Gets summary statistics for bank transactions.
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {string} [startDate] - Optional start date
 * @param {string} [endDate] - Optional end date
 * @returns {{totalCredits: number, totalDebits: number, creditCount: number, debitCount: number, unreconciledCount: number}}
 */
function getSummary(bankAccountId, startDate = null, endDate = null) {
  let whereClause = 'WHERE bankAccountId = ?';
  const params = [bankAccountId];
  
  if (startDate) {
    whereClause += ' AND transactionDate >= ?';
    params.push(dateToTimestamp(startDate));
  }
  
  if (endDate) {
    const endTs = dateToTimestamp(endDate);
    whereClause += ' AND transactionDate <= ?';
    params.push(endTs ? endTs + 86399 : endDate);
  }

  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as totalCredits,
      COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as totalDebits,
      COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN 1 ELSE 0 END), 0) as creditCount,
      COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN 1 ELSE 0 END), 0) as debitCount,
      COALESCE(SUM(CASE WHEN isReconciled = 0 THEN 1 ELSE 0 END), 0) as unreconciledCount
    FROM bank_transactions
    ${whereClause}
  `, params);

  return {
    totalCredits: result.totalCredits || 0,
    totalDebits: result.totalDebits || 0,
    creditCount: result.creditCount || 0,
    debitCount: result.debitCount || 0,
    unreconciledCount: result.unreconciledCount || 0,
    netAmount: (result.totalCredits || 0) - (result.totalDebits || 0)
  };
}

/**
 * Gets reconciliation status counts for a bank account.
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @returns {Object.<string, number>} Status counts
 */
function getReconciliationStatusCounts(bankAccountId) {
  const results = query(
    `SELECT reconciliationStatus, COUNT(*) as count 
     FROM bank_transactions 
     WHERE bankAccountId = ?
     GROUP BY reconciliationStatus`,
    [bankAccountId]
  );
  
  const counts = {};
  for (const status of RECONCILIATION_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.reconciliationStatus] = row.count;
  }
  return counts;
}

/**
 * Searches bank transactions by description or reference.
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {string} searchTerm - Search term
 * @returns {BankTransactionData[]} Array of matching transactions
 */
function searchBankTransactions(bankAccountId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const term = `%${searchTerm.trim()}%`;
  const transactions = query(
    `SELECT * FROM bank_transactions 
     WHERE bankAccountId = ? AND (description LIKE ? OR reference LIKE ?)
     ORDER BY transactionDate DESC`,
    [bankAccountId, term, term]
  );
  return transactions.map(sanitizeBankTransaction);
}

/**
 * Checks if a transaction with the given fitId already exists.
 * 
 * @param {number} bankAccountId - Bank Account ID
 * @param {string} fitId - Financial Institution Transaction ID
 * @returns {boolean} True if exists
 */
function fitIdExists(bankAccountId, fitId) {
  if (!fitId) return false;
  const result = queryOne(
    'SELECT COUNT(*) as count FROM bank_transactions WHERE bankAccountId = ? AND fitId = ?',
    [bankAccountId, fitId.trim()]
  );
  return result?.count > 0;
}

module.exports = {
  // CRUD operations
  createBankTransaction,
  createBatch,
  findById,
  findByFitId,
  getBankTransactionsByAccountId,
  getUnreconciledTransactions,
  getByImportBatchId,
  getByDateRange,
  updateBankTransaction,
  deleteBankTransaction,
  deleteBatch,
  
  // Reconciliation operations
  updateReconciliationStatus,
  excludeFromReconciliation,
  getReconciliationStatusCounts,
  
  // Aggregations
  getSummary,
  
  // Search
  searchBankTransactions,
  fitIdExists,
  
  // Validation
  validateBankTransactionData,
  sanitizeBankTransaction,
  fieldDefinitions,
  
  // Constants
  TRANSACTION_TYPES,
  IMPORT_SOURCES,
  RECONCILIATION_STATUSES
};
