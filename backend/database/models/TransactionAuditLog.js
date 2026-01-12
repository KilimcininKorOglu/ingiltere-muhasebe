/**
 * TransactionAuditLog model for tracking transaction changes.
 * Provides CRUD operations for audit log entries.
 * 
 * @module models/TransactionAuditLog
 */

const { query, queryOne, execute, openDatabase } = require('../index');
const { VALID_AUDIT_ACTIONS } = require('../migrations/004_create_transaction_audit_log_table');

/**
 * Valid audit action types.
 */
const AUDIT_ACTIONS = VALID_AUDIT_ACTIONS;

/**
 * Audit log entry data object
 * @typedef {Object} AuditLogEntry
 * @property {number} [id] - Audit log entry ID (auto-generated)
 * @property {number} transactionId - ID of the transaction that was changed
 * @property {number} userId - ID of the user who made the change
 * @property {string} action - Type of action (create, update, delete)
 * @property {Object|null} [previousValues] - Previous values before the change
 * @property {Object|null} [newValues] - New values after the change
 * @property {string[]|null} [changedFields] - Array of field names that changed
 * @property {string|null} [ipAddress] - IP address of the user
 * @property {string|null} [userAgent] - User agent of the client
 * @property {string} [createdAt] - Timestamp of the change
 */

/**
 * Validates audit log data.
 * 
 * @param {Object} auditData - Audit data to validate
 * @returns {{isValid: boolean, errors: Object.<string, string>}}
 */
function validateAuditData(auditData) {
  const errors = {};

  if (!auditData.transactionId || !Number.isInteger(auditData.transactionId) || auditData.transactionId <= 0) {
    errors.transactionId = 'transactionId must be a positive integer';
  }

  if (!auditData.userId || !Number.isInteger(auditData.userId) || auditData.userId <= 0) {
    errors.userId = 'userId must be a positive integer';
  }

  if (!auditData.action || !AUDIT_ACTIONS.includes(auditData.action)) {
    errors.action = `action must be one of: ${AUDIT_ACTIONS.join(', ')}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Calculates the changed fields between previous and new values.
 * 
 * @param {Object|null} previousValues - Previous transaction values
 * @param {Object|null} newValues - New transaction values
 * @returns {string[]} Array of field names that changed
 */
function calculateChangedFields(previousValues, newValues) {
  if (!previousValues || !newValues) {
    return [];
  }

  const changedFields = [];
  const allKeys = new Set([...Object.keys(previousValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    // Skip metadata fields
    if (key === 'updatedAt' || key === 'createdAt') {
      continue;
    }

    const prevValue = previousValues[key];
    const newValue = newValues[key];

    // Handle null/undefined comparisons
    if (prevValue === null && newValue === null) continue;
    if (prevValue === undefined && newValue === undefined) continue;
    
    // Compare values
    if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

/**
 * Sanitizes audit log entry for output.
 * Parses JSON strings back to objects.
 * 
 * @param {Object} auditEntry - Raw audit log entry from database
 * @returns {AuditLogEntry} Sanitized audit log entry
 */
function sanitizeAuditEntry(auditEntry) {
  if (!auditEntry) return null;

  const sanitized = { ...auditEntry };

  // Parse JSON fields
  if (sanitized.previousValues) {
    try {
      sanitized.previousValues = JSON.parse(sanitized.previousValues);
    } catch (e) {
      sanitized.previousValues = null;
    }
  }

  if (sanitized.newValues) {
    try {
      sanitized.newValues = JSON.parse(sanitized.newValues);
    } catch (e) {
      sanitized.newValues = null;
    }
  }

  if (sanitized.changedFields) {
    try {
      sanitized.changedFields = JSON.parse(sanitized.changedFields);
    } catch (e) {
      sanitized.changedFields = [];
    }
  }

  return sanitized;
}

/**
 * Creates a new audit log entry.
 * 
 * @param {Object} auditData - Audit log data
 * @param {number} auditData.transactionId - ID of the transaction
 * @param {number} auditData.userId - ID of the user making the change
 * @param {string} auditData.action - Type of action (create, update, delete)
 * @param {Object|null} [auditData.previousValues] - Previous transaction values
 * @param {Object|null} [auditData.newValues] - New transaction values
 * @param {string|null} [auditData.ipAddress] - IP address
 * @param {string|null} [auditData.userAgent] - User agent
 * @returns {{success: boolean, data?: AuditLogEntry, errors?: Object.<string, string>}}
 */
function createAuditLog(auditData) {
  // Validate input data
  const validation = validateAuditData(auditData);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Calculate changed fields for update actions
    let changedFields = null;
    if (auditData.action === 'update' && auditData.previousValues && auditData.newValues) {
      changedFields = calculateChangedFields(auditData.previousValues, auditData.newValues);
    }

    const insertData = {
      transactionId: auditData.transactionId,
      userId: auditData.userId,
      action: auditData.action,
      previousValues: auditData.previousValues ? JSON.stringify(auditData.previousValues) : null,
      newValues: auditData.newValues ? JSON.stringify(auditData.newValues) : null,
      changedFields: changedFields ? JSON.stringify(changedFields) : null,
      ipAddress: auditData.ipAddress || null,
      userAgent: auditData.userAgent || null
    };

    const result = execute(`
      INSERT INTO transaction_audit_log (
        transactionId, userId, action, previousValues, newValues,
        changedFields, ipAddress, userAgent
      ) VALUES (
        @transactionId, @userId, @action, @previousValues, @newValues,
        @changedFields, @ipAddress, @userAgent
      )
    `, insertData);

    // Fetch the created entry
    const createdEntry = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeAuditEntry(createdEntry) };

  } catch (error) {
    console.error('Error creating audit log entry:', error.message);
    return { success: false, errors: { general: 'Failed to create audit log entry' } };
  }
}

/**
 * Logs a transaction creation.
 * 
 * @param {number} transactionId - ID of the created transaction
 * @param {number} userId - ID of the user who created the transaction
 * @param {Object} newValues - The transaction data
 * @param {Object} [metadata] - Additional metadata (ipAddress, userAgent)
 * @returns {{success: boolean, data?: AuditLogEntry, errors?: Object}}
 */
function logCreate(transactionId, userId, newValues, metadata = {}) {
  return createAuditLog({
    transactionId,
    userId,
    action: 'create',
    previousValues: null,
    newValues,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  });
}

/**
 * Logs a transaction update.
 * 
 * @param {number} transactionId - ID of the updated transaction
 * @param {number} userId - ID of the user who updated the transaction
 * @param {Object} previousValues - The transaction data before update
 * @param {Object} newValues - The transaction data after update
 * @param {Object} [metadata] - Additional metadata (ipAddress, userAgent)
 * @returns {{success: boolean, data?: AuditLogEntry, errors?: Object}}
 */
function logUpdate(transactionId, userId, previousValues, newValues, metadata = {}) {
  return createAuditLog({
    transactionId,
    userId,
    action: 'update',
    previousValues,
    newValues,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  });
}

/**
 * Logs a transaction deletion.
 * 
 * @param {number} transactionId - ID of the deleted transaction
 * @param {number} userId - ID of the user who deleted the transaction
 * @param {Object} previousValues - The transaction data before deletion
 * @param {Object} [metadata] - Additional metadata (ipAddress, userAgent)
 * @returns {{success: boolean, data?: AuditLogEntry, errors?: Object}}
 */
function logDelete(transactionId, userId, previousValues, metadata = {}) {
  return createAuditLog({
    transactionId,
    userId,
    action: 'delete',
    previousValues,
    newValues: null,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  });
}

/**
 * Finds an audit log entry by ID.
 * 
 * @param {number} id - Audit log entry ID
 * @returns {Object|null} Raw audit log entry or null
 */
function findById(id) {
  const entry = queryOne('SELECT * FROM transaction_audit_log WHERE id = ?', [id]);
  return entry || null;
}

/**
 * Gets audit history for a specific transaction.
 * 
 * @param {number} transactionId - Transaction ID
 * @param {Object} [options] - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @param {string} [options.action] - Filter by action type
 * @param {string} [options.sortOrder='DESC'] - Sort order (ASC or DESC)
 * @returns {{entries: AuditLogEntry[], total: number, page: number, limit: number}}
 */
function getTransactionHistory(transactionId, {
  page = 1,
  limit = 50,
  action,
  sortOrder = 'DESC'
} = {}) {
  const offset = (page - 1) * limit;
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let whereClause = 'WHERE transactionId = ?';
  const params = [transactionId];

  if (action && AUDIT_ACTIONS.includes(action)) {
    whereClause += ' AND action = ?';
    params.push(action);
  }

  const entries = query(
    `SELECT * FROM transaction_audit_log ${whereClause} ORDER BY createdAt ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM transaction_audit_log ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    entries: entries.map(sanitizeAuditEntry),
    total,
    page,
    limit
  };
}

/**
 * Gets audit logs by user ID.
 * 
 * @param {number} userId - User ID
 * @param {Object} [options] - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @param {string} [options.action] - Filter by action type
 * @param {string} [options.startDate] - Filter from date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter to date (YYYY-MM-DD)
 * @returns {{entries: AuditLogEntry[], total: number, page: number, limit: number}}
 */
function getAuditLogsByUserId(userId, {
  page = 1,
  limit = 50,
  action,
  startDate,
  endDate
} = {}) {
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE userId = ?';
  const params = [userId];

  if (action && AUDIT_ACTIONS.includes(action)) {
    whereClause += ' AND action = ?';
    params.push(action);
  }

  if (startDate) {
    whereClause += ' AND date(createdAt) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND date(createdAt) <= ?';
    params.push(endDate);
  }

  const entries = query(
    `SELECT * FROM transaction_audit_log ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM transaction_audit_log ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    entries: entries.map(sanitizeAuditEntry),
    total,
    page,
    limit
  };
}

/**
 * Gets the most recent audit entry for a transaction.
 * 
 * @param {number} transactionId - Transaction ID
 * @returns {AuditLogEntry|null} Most recent audit entry or null
 */
function getLatestEntry(transactionId) {
  const entry = queryOne(
    'SELECT * FROM transaction_audit_log WHERE transactionId = ? ORDER BY createdAt DESC LIMIT 1',
    [transactionId]
  );
  return entry ? sanitizeAuditEntry(entry) : null;
}

/**
 * Counts audit entries for a transaction.
 * 
 * @param {number} transactionId - Transaction ID
 * @returns {number} Count of audit entries
 */
function countByTransactionId(transactionId) {
  const result = queryOne(
    'SELECT COUNT(*) as count FROM transaction_audit_log WHERE transactionId = ?',
    [transactionId]
  );
  return result?.count || 0;
}

/**
 * Gets audit summary for a transaction (counts by action type).
 * 
 * @param {number} transactionId - Transaction ID
 * @returns {Object.<string, number>} Action counts
 */
function getAuditSummary(transactionId) {
  const results = query(
    `SELECT action, COUNT(*) as count FROM transaction_audit_log 
     WHERE transactionId = ? GROUP BY action`,
    [transactionId]
  );

  const summary = {};
  for (const action of AUDIT_ACTIONS) {
    summary[action] = 0;
  }
  for (const row of results) {
    summary[row.action] = row.count;
  }
  return summary;
}

/**
 * Deletes audit logs for a specific transaction.
 * Note: Use with caution - this permanently removes audit history.
 * 
 * @param {number} transactionId - Transaction ID
 * @returns {{success: boolean, deletedCount: number}}
 */
function deleteByTransactionId(transactionId) {
  try {
    const countResult = queryOne(
      'SELECT COUNT(*) as count FROM transaction_audit_log WHERE transactionId = ?',
      [transactionId]
    );
    const count = countResult?.count || 0;

    execute('DELETE FROM transaction_audit_log WHERE transactionId = ?', [transactionId]);

    return { success: true, deletedCount: count };
  } catch (error) {
    console.error('Error deleting audit logs:', error.message);
    return { success: false, deletedCount: 0 };
  }
}

module.exports = {
  // Core operations
  createAuditLog,
  logCreate,
  logUpdate,
  logDelete,
  
  // Query operations
  findById,
  getTransactionHistory,
  getAuditLogsByUserId,
  getLatestEntry,
  
  // Aggregations
  countByTransactionId,
  getAuditSummary,
  
  // Maintenance
  deleteByTransactionId,
  
  // Utilities
  sanitizeAuditEntry,
  validateAuditData,
  calculateChangedFields,
  
  // Constants
  AUDIT_ACTIONS
};
