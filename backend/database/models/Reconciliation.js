/**
 * Reconciliation model for linking bank transactions to application transactions.
 * Provides CRUD operations and validation for reconciliation data.
 * 
 * Reconciliation is the process of matching bank statement transactions
 * with transactions recorded in the application for verification.
 * 
 * @module models/Reconciliation
 */

const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { VALID_MATCH_TYPES, VALID_STATUSES } = require('../migrations/012_create_reconciliations_table');

/**
 * Valid match types.
 */
const MATCH_TYPES = VALID_MATCH_TYPES;

/**
 * Valid reconciliation statuses.
 */
const STATUSES = VALID_STATUSES;

/**
 * Reconciliation field definitions with validation rules.
 * @typedef {Object} ReconciliationFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Reconciliation field definitions for validation.
 * @type {Object.<string, ReconciliationFieldDefinition>}
 */
const fieldDefinitions = {
  bankTransactionId: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value <= 0) {
        return 'bankTransactionId must be a positive integer';
      }
      return null;
    }
  },
  transactionId: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value <= 0) {
        return 'transactionId must be a positive integer';
      }
      return null;
    }
  },
  matchType: {
    type: 'string',
    required: false,
    default: 'exact',
    validate: (value) => {
      if (value && !MATCH_TYPES.includes(value)) {
        return `Invalid matchType. Must be one of: ${MATCH_TYPES.join(', ')}`;
      }
      return null;
    }
  },
  matchAmount: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value < 0) {
        return 'matchAmount must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  matchConfidence: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 100)) {
        return 'matchConfidence must be an integer between 0 and 100';
      }
      return null;
    }
  },
  status: {
    type: 'string',
    required: false,
    default: 'pending',
    validate: (value) => {
      if (value && !STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  reconciledBy: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) {
        return 'reconciledBy must be a positive integer or null';
      }
      return null;
    }
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 2000
  }
};

/**
 * Reconciliation data object
 * @typedef {Object} ReconciliationData
 * @property {number} [id] - Reconciliation ID (auto-generated)
 * @property {number} bankTransactionId - Bank Transaction ID
 * @property {number} transactionId - Application Transaction ID
 * @property {string} [matchType] - Type of match
 * @property {number} matchAmount - Matched amount in pence
 * @property {number} [matchConfidence] - System confidence score (0-100)
 * @property {string} [status] - Reconciliation status
 * @property {number} [reconciledBy] - User ID who reconciled
 * @property {string} [reconciledAt] - Reconciliation timestamp
 * @property {string} [notes] - Notes about the reconciliation
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
 * Validates reconciliation data against field definitions.
 * 
 * @param {Partial<ReconciliationData>} reconciliationData - Data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateReconciliationData(reconciliationData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = reconciliationData[fieldName];

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
 * Sanitizes reconciliation data for output.
 * 
 * @param {ReconciliationData} reconciliation - Reconciliation data object
 * @returns {ReconciliationData} Sanitized reconciliation data
 */
function sanitizeReconciliation(reconciliation) {
  if (!reconciliation) return null;
  return { ...reconciliation };
}

/**
 * Creates a new reconciliation record.
 * 
 * @param {ReconciliationData} reconciliationData - Reconciliation data to create
 * @returns {{success: boolean, data?: ReconciliationData, errors?: Object.<string, string>}}
 */
function createReconciliation(reconciliationData) {
  // Validate input data
  const validation = validateReconciliationData(reconciliationData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Prepare the insert data
    const insertData = {
      bankTransactionId: reconciliationData.bankTransactionId,
      transactionId: reconciliationData.transactionId,
      matchType: reconciliationData.matchType || 'exact',
      matchAmount: reconciliationData.matchAmount,
      matchConfidence: reconciliationData.matchConfidence || 0,
      status: reconciliationData.status || 'pending',
      reconciledBy: reconciliationData.reconciledBy || null,
      reconciledAt: reconciliationData.status === 'confirmed' ? new Date().toISOString() : null,
      notes: reconciliationData.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO reconciliations (
        bankTransactionId, transactionId, matchType, matchAmount,
        matchConfidence, status, reconciledBy, reconciledAt, notes
      ) VALUES (
        @bankTransactionId, @transactionId, @matchType, @matchAmount,
        @matchConfidence, @status, @reconciledBy, @reconciledAt, @notes
      )
    `, insertData);

    // Fetch the created reconciliation
    const createdReconciliation = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeReconciliation(createdReconciliation) };

  } catch (error) {
    // Check for unique constraint violation
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return { success: false, errors: { general: 'A confirmed reconciliation already exists for this bank transaction and app transaction pair' } };
    }
    // Check for foreign key violation
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      return { success: false, errors: { general: 'Bank transaction or app transaction not found' } };
    }
    console.error('Error creating reconciliation:', error.message);
    return { success: false, errors: { general: 'Failed to create reconciliation' } };
  }
}

/**
 * Creates a reconciliation and confirms it in one operation.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @param {number} transactionId - Application Transaction ID
 * @param {number} matchAmount - Match amount in pence
 * @param {number} userId - User performing the reconciliation
 * @param {Object} [options] - Additional options
 * @param {string} [options.matchType='exact'] - Match type
 * @param {string} [options.notes] - Notes
 * @returns {{success: boolean, data?: ReconciliationData, errors?: Object.<string, string>}}
 */
function reconcile(bankTransactionId, transactionId, matchAmount, userId, { matchType = 'exact', notes = null } = {}) {
  return createReconciliation({
    bankTransactionId,
    transactionId,
    matchType,
    matchAmount,
    matchConfidence: 100, // Manual reconciliation has 100% confidence
    status: 'confirmed',
    reconciledBy: userId,
    notes
  });
}

/**
 * Creates a suggested reconciliation (pending status) based on matching algorithm.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @param {number} transactionId - Application Transaction ID
 * @param {number} matchAmount - Match amount in pence
 * @param {number} confidence - Match confidence (0-100)
 * @param {Object} [options] - Additional options
 * @param {string} [options.matchType='exact'] - Match type
 * @param {string} [options.notes] - Notes
 * @returns {{success: boolean, data?: ReconciliationData, errors?: Object.<string, string>}}
 */
function suggestMatch(bankTransactionId, transactionId, matchAmount, confidence, { matchType = 'exact', notes = null } = {}) {
  return createReconciliation({
    bankTransactionId,
    transactionId,
    matchType,
    matchAmount,
    matchConfidence: confidence,
    status: 'pending',
    notes
  });
}

/**
 * Finds a reconciliation by ID.
 * 
 * @param {number} id - Reconciliation ID
 * @returns {ReconciliationData|null} Reconciliation data or null if not found
 */
function findById(id) {
  const reconciliation = queryOne('SELECT * FROM reconciliations WHERE id = ?', [id]);
  return reconciliation || null;
}

/**
 * Gets all reconciliations for a bank transaction.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @param {Object} [options] - Query options
 * @param {string} [options.status] - Filter by status
 * @returns {ReconciliationData[]} Array of reconciliations
 */
function getByBankTransactionId(bankTransactionId, { status = null } = {}) {
  let sql = 'SELECT * FROM reconciliations WHERE bankTransactionId = ?';
  const params = [bankTransactionId];
  
  if (status && STATUSES.includes(status)) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY createdAt DESC';
  
  const reconciliations = query(sql, params);
  return reconciliations.map(sanitizeReconciliation);
}

/**
 * Gets all reconciliations for an application transaction.
 * 
 * @param {number} transactionId - Application Transaction ID
 * @param {Object} [options] - Query options
 * @param {string} [options.status] - Filter by status
 * @returns {ReconciliationData[]} Array of reconciliations
 */
function getByTransactionId(transactionId, { status = null } = {}) {
  let sql = 'SELECT * FROM reconciliations WHERE transactionId = ?';
  const params = [transactionId];
  
  if (status && STATUSES.includes(status)) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY createdAt DESC';
  
  const reconciliations = query(sql, params);
  return reconciliations.map(sanitizeReconciliation);
}

/**
 * Gets pending reconciliations for review.
 * 
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Max results
 * @param {number} [options.minConfidence] - Minimum confidence filter
 * @returns {ReconciliationData[]} Array of pending reconciliations
 */
function getPendingReconciliations({ limit = 50, minConfidence = null } = {}) {
  let sql = 'SELECT * FROM reconciliations WHERE status = ?';
  const params = ['pending'];
  
  if (minConfidence !== null) {
    sql += ' AND matchConfidence >= ?';
    params.push(minConfidence);
  }
  
  sql += ' ORDER BY matchConfidence DESC, createdAt ASC LIMIT ?';
  params.push(limit);
  
  const reconciliations = query(sql, params);
  return reconciliations.map(sanitizeReconciliation);
}

/**
 * Gets reconciliations with joined bank transaction and app transaction data.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @returns {Array} Array of reconciliations with related data
 */
function getReconciliationsWithDetails(bankTransactionId) {
  const reconciliations = query(`
    SELECT 
      r.*,
      bt.description as bankTransactionDescription,
      bt.amount as bankTransactionAmount,
      bt.transactionType as bankTransactionType,
      bt.transactionDate as bankTransactionDate,
      t.description as appTransactionDescription,
      t.totalAmount as appTransactionAmount,
      t.type as appTransactionType,
      t.transactionDate as appTransactionDate
    FROM reconciliations r
    JOIN bank_transactions bt ON r.bankTransactionId = bt.id
    JOIN transactions t ON r.transactionId = t.id
    WHERE r.bankTransactionId = ?
    ORDER BY r.createdAt DESC
  `, [bankTransactionId]);
  
  return reconciliations;
}

/**
 * Updates a reconciliation's data.
 * 
 * @param {number} id - Reconciliation ID
 * @param {Partial<ReconciliationData>} reconciliationData - Data to update
 * @returns {{success: boolean, data?: ReconciliationData, errors?: Object.<string, string>}}
 */
function updateReconciliation(id, reconciliationData) {
  // Check if reconciliation exists
  const existingReconciliation = findById(id);
  if (!existingReconciliation) {
    return { success: false, errors: { general: 'Reconciliation not found' } };
  }

  // Validate input data
  const validation = validateReconciliationData(reconciliationData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (reconciliationData.matchType !== undefined) {
      updateFields.push('matchType = @matchType');
      updateParams.matchType = reconciliationData.matchType;
    }

    if (reconciliationData.matchAmount !== undefined) {
      updateFields.push('matchAmount = @matchAmount');
      updateParams.matchAmount = reconciliationData.matchAmount;
    }

    if (reconciliationData.matchConfidence !== undefined) {
      updateFields.push('matchConfidence = @matchConfidence');
      updateParams.matchConfidence = reconciliationData.matchConfidence;
    }

    if (reconciliationData.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = reconciliationData.status;
      
      // Set reconciledAt when confirming
      if (reconciliationData.status === 'confirmed' && existingReconciliation.status !== 'confirmed') {
        updateFields.push('reconciledAt = @reconciledAt');
        updateParams.reconciledAt = new Date().toISOString();
      }
    }

    if (reconciliationData.reconciledBy !== undefined) {
      updateFields.push('reconciledBy = @reconciledBy');
      updateParams.reconciledBy = reconciliationData.reconciledBy;
    }

    if (reconciliationData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = reconciliationData.notes?.trim() || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeReconciliation(existingReconciliation) };
    }

    execute(
      `UPDATE reconciliations SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated reconciliation
    const updatedReconciliation = findById(id);
    return { success: true, data: sanitizeReconciliation(updatedReconciliation) };

  } catch (error) {
    console.error('Error updating reconciliation:', error.message);
    return { success: false, errors: { general: 'Failed to update reconciliation' } };
  }
}

/**
 * Confirms a pending reconciliation.
 * 
 * @param {number} id - Reconciliation ID
 * @param {number} userId - User confirming the reconciliation
 * @param {string} [notes] - Optional notes
 * @returns {{success: boolean, data?: ReconciliationData, error?: string}}
 */
function confirmReconciliation(id, userId, notes = null) {
  const existingReconciliation = findById(id);
  if (!existingReconciliation) {
    return { success: false, error: 'Reconciliation not found' };
  }

  if (existingReconciliation.status === 'confirmed') {
    return { success: false, error: 'Reconciliation is already confirmed' };
  }

  const updateData = {
    status: 'confirmed',
    reconciledBy: userId
  };
  
  if (notes) {
    updateData.notes = notes;
  }

  return updateReconciliation(id, updateData);
}

/**
 * Rejects a pending reconciliation.
 * 
 * @param {number} id - Reconciliation ID
 * @param {number} userId - User rejecting the reconciliation
 * @param {string} [reason] - Reason for rejection
 * @returns {{success: boolean, data?: ReconciliationData, error?: string}}
 */
function rejectReconciliation(id, userId, reason = null) {
  const existingReconciliation = findById(id);
  if (!existingReconciliation) {
    return { success: false, error: 'Reconciliation not found' };
  }

  return updateReconciliation(id, {
    status: 'rejected',
    reconciledBy: userId,
    notes: reason || existingReconciliation.notes
  });
}

/**
 * Deletes a reconciliation by ID.
 * 
 * @param {number} id - Reconciliation ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteReconciliation(id) {
  const existingReconciliation = findById(id);
  if (!existingReconciliation) {
    return { success: false, error: 'Reconciliation not found' };
  }

  try {
    execute('DELETE FROM reconciliations WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting reconciliation:', error.message);
    return { success: false, error: 'Failed to delete reconciliation' };
  }
}

/**
 * Deletes all pending reconciliations for a bank transaction.
 * Useful when re-running matching algorithm.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @returns {{success: boolean, deletedCount: number, error?: string}}
 */
function deletePendingByBankTransactionId(bankTransactionId) {
  try {
    const result = execute(
      'DELETE FROM reconciliations WHERE bankTransactionId = ? AND status = ?',
      [bankTransactionId, 'pending']
    );
    return { success: true, deletedCount: result.changes };
  } catch (error) {
    console.error('Error deleting pending reconciliations:', error.message);
    return { success: false, deletedCount: 0, error: 'Failed to delete pending reconciliations' };
  }
}

/**
 * Gets reconciliation summary statistics.
 * 
 * @param {Object} [options] - Query options
 * @param {number} [options.bankAccountId] - Filter by bank account
 * @param {string} [options.startDate] - Start date filter
 * @param {string} [options.endDate] - End date filter
 * @returns {{confirmed: number, pending: number, rejected: number, totalMatchedAmount: number}}
 */
function getSummary({ bankAccountId = null, startDate = null, endDate = null } = {}) {
  let whereClause = '1=1';
  const params = [];
  
  if (bankAccountId) {
    whereClause += ' AND r.bankTransactionId IN (SELECT id FROM bank_transactions WHERE bankAccountId = ?)';
    params.push(bankAccountId);
  }
  
  if (startDate) {
    whereClause += ' AND r.createdAt >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    whereClause += ' AND r.createdAt <= ?';
    params.push(endDate);
  }

  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN matchAmount ELSE 0 END), 0) as totalMatchedAmount
    FROM reconciliations r
    WHERE ${whereClause}
  `, params);

  return {
    confirmed: result.confirmed || 0,
    pending: result.pending || 0,
    rejected: result.rejected || 0,
    totalMatchedAmount: result.totalMatchedAmount || 0
  };
}

/**
 * Gets reconciliations by user.
 * 
 * @param {number} userId - User ID
 * @param {Object} [options] - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @returns {{reconciliations: ReconciliationData[], total: number, page: number, limit: number}}
 */
function getByUserId(userId, { page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  
  const reconciliations = query(
    `SELECT * FROM reconciliations 
     WHERE reconciledBy = ? 
     ORDER BY reconciledAt DESC NULLS LAST, createdAt DESC 
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  
  const totalResult = queryOne(
    'SELECT COUNT(*) as count FROM reconciliations WHERE reconciledBy = ?',
    [userId]
  );
  const total = totalResult?.count || 0;

  return {
    reconciliations: reconciliations.map(sanitizeReconciliation),
    total,
    page,
    limit
  };
}

/**
 * Checks if a confirmed reconciliation exists for the given pair.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @param {number} transactionId - Application Transaction ID
 * @returns {boolean} True if confirmed reconciliation exists
 */
function hasConfirmedReconciliation(bankTransactionId, transactionId) {
  const result = queryOne(
    `SELECT COUNT(*) as count FROM reconciliations 
     WHERE bankTransactionId = ? AND transactionId = ? AND status = 'confirmed'`,
    [bankTransactionId, transactionId]
  );
  return result?.count > 0;
}

/**
 * Gets the total matched amount for a bank transaction.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @returns {number} Total matched amount in pence
 */
function getTotalMatchedAmount(bankTransactionId) {
  const result = queryOne(
    `SELECT COALESCE(SUM(matchAmount), 0) as total 
     FROM reconciliations 
     WHERE bankTransactionId = ? AND status = 'confirmed'`,
    [bankTransactionId]
  );
  return result?.total || 0;
}

/**
 * Gets the remaining unmatched amount for a bank transaction.
 * 
 * @param {number} bankTransactionId - Bank Transaction ID
 * @param {number} bankTransactionAmount - Original bank transaction amount
 * @returns {number} Remaining unmatched amount in pence
 */
function getRemainingAmount(bankTransactionId, bankTransactionAmount) {
  const matchedAmount = getTotalMatchedAmount(bankTransactionId);
  return Math.max(0, bankTransactionAmount - matchedAmount);
}

module.exports = {
  // CRUD operations
  createReconciliation,
  reconcile,
  suggestMatch,
  findById,
  getByBankTransactionId,
  getByTransactionId,
  getPendingReconciliations,
  getReconciliationsWithDetails,
  updateReconciliation,
  deleteReconciliation,
  deletePendingByBankTransactionId,
  
  // Status operations
  confirmReconciliation,
  rejectReconciliation,
  
  // Query operations
  getByUserId,
  getSummary,
  hasConfirmedReconciliation,
  getTotalMatchedAmount,
  getRemainingAmount,
  
  // Validation
  validateReconciliationData,
  sanitizeReconciliation,
  fieldDefinitions,
  
  // Constants
  MATCH_TYPES,
  STATUSES
};
