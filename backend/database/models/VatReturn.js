/**
 * VatReturn model for managing VAT return records with HMRC compliance.
 * Provides CRUD operations and validation for VAT return data.
 * 
 * HMRC VAT Return Boxes:
 * - Box 1: VAT due on sales and other outputs
 * - Box 2: VAT due on acquisitions from EU (legacy, now 0 post-Brexit)
 * - Box 3: Total VAT due (Box 1 + Box 2)
 * - Box 4: VAT reclaimed on purchases and other inputs
 * - Box 5: Net VAT to pay or reclaim (Box 3 - Box 4)
 * - Box 6: Total value of sales and outputs (excluding VAT)
 * - Box 7: Total value of purchases and inputs (excluding VAT)
 * - Box 8: Total value of supplies to EU (excluding VAT)
 * - Box 9: Total value of acquisitions from EU (excluding VAT)
 * 
 * @module models/VatReturn
 */

const validator = require('validator');
const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { VALID_STATUSES } = require('../migrations/009_create_vat_returns_table');

/**
 * Valid VAT return status values.
 */
const VAT_RETURN_STATUSES = VALID_STATUSES;

/**
 * VatReturn field definitions with validation rules.
 * @typedef {Object} VatReturnFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * VatReturn field definitions for validation.
 * @type {Object.<string, VatReturnFieldDefinition>}
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
  periodStart: {
    type: 'string',
    required: true,
    validate: (value) => {
      // Format: YYYY-MM-DD
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid periodStart format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  periodEnd: {
    type: 'string',
    required: true,
    validate: (value) => {
      // Format: YYYY-MM-DD
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid periodEnd format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  status: {
    type: 'string',
    required: false,
    default: 'draft',
    validate: (value) => {
      if (value && !VAT_RETURN_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${VAT_RETURN_STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  box1: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box1 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box1 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box2: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box2 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box2 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box3: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box3 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box3 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box4: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box4 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box4 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box5: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      // Box 5 can be negative (refund due)
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box5 must be an integer (in pence)';
      }
      return null;
    }
  },
  box6: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box6 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box6 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box7: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box7 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box7 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box8: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box8 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box8 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  box9: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'box9 must be an integer (in pence)';
      }
      if (value !== undefined && value < 0) {
        return 'box9 must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  submittedAt: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && value.trim()) {
        // Allow ISO 8601 datetime format
        if (!validator.isISO8601(value)) {
          return 'Invalid submittedAt format (ISO 8601)';
        }
      }
      return null;
    }
  },
  hmrcReceiptId: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 5000
  }
};

/**
 * VatReturn data object
 * @typedef {Object} VatReturnData
 * @property {number} [id] - VAT Return ID (auto-generated)
 * @property {number} userId - User ID who owns the VAT return
 * @property {string} periodStart - Start date of VAT period (YYYY-MM-DD)
 * @property {string} periodEnd - End date of VAT period (YYYY-MM-DD)
 * @property {string} [status] - VAT return status
 * @property {number} [box1] - VAT due on sales (in pence)
 * @property {number} [box2] - VAT due on EU acquisitions (in pence)
 * @property {number} [box3] - Total VAT due (in pence)
 * @property {number} [box4] - VAT reclaimed on purchases (in pence)
 * @property {number} [box5] - Net VAT to pay/reclaim (in pence)
 * @property {number} [box6] - Total value of sales (in pence)
 * @property {number} [box7] - Total value of purchases (in pence)
 * @property {number} [box8] - Total value of EU supplies (in pence)
 * @property {number} [box9] - Total value of EU acquisitions (in pence)
 * @property {string} [submittedAt] - Submission timestamp
 * @property {string} [hmrcReceiptId] - HMRC receipt ID
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
 * Validates VAT return data against field definitions.
 * 
 * @param {Partial<VatReturnData>} vatReturnData - VAT return data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateVatReturnData(vatReturnData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = vatReturnData[fieldName];

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

  // Cross-field validation: periodEnd must be >= periodStart
  if (vatReturnData.periodStart && vatReturnData.periodEnd) {
    const periodStart = new Date(vatReturnData.periodStart);
    const periodEnd = new Date(vatReturnData.periodEnd);
    if (periodEnd < periodStart) {
      errors.periodEnd = 'periodEnd must be on or after periodStart';
    }
  }

  // Cross-field validation: box3 should equal box1 + box2
  if (vatReturnData.box1 !== undefined && vatReturnData.box2 !== undefined && vatReturnData.box3 !== undefined) {
    const expectedBox3 = vatReturnData.box1 + vatReturnData.box2;
    if (vatReturnData.box3 !== expectedBox3) {
      errors.box3 = `box3 should equal box1 + box2 (expected ${expectedBox3}, got ${vatReturnData.box3})`;
    }
  }

  // Cross-field validation: box5 should equal box3 - box4
  if (vatReturnData.box3 !== undefined && vatReturnData.box4 !== undefined && vatReturnData.box5 !== undefined) {
    const expectedBox5 = vatReturnData.box3 - vatReturnData.box4;
    if (vatReturnData.box5 !== expectedBox5) {
      errors.box5 = `box5 should equal box3 - box4 (expected ${expectedBox5}, got ${vatReturnData.box5})`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Calculates derived box values (box3 and box5).
 * 
 * @param {Partial<VatReturnData>} vatReturnData - VAT return data
 * @returns {Partial<VatReturnData>} Data with calculated values
 */
function calculateDerivedBoxes(vatReturnData) {
  const data = { ...vatReturnData };
  
  // Box 3 = Box 1 + Box 2
  if (data.box1 !== undefined || data.box2 !== undefined) {
    data.box3 = (data.box1 || 0) + (data.box2 || 0);
  }
  
  // Box 5 = Box 3 - Box 4
  if (data.box3 !== undefined || data.box4 !== undefined) {
    data.box5 = (data.box3 || 0) - (data.box4 || 0);
  }
  
  return data;
}

/**
 * Creates a new VAT return in the database.
 * 
 * @param {VatReturnData} vatReturnData - VAT return data to create
 * @returns {{success: boolean, data?: VatReturnData, errors?: Object.<string, string>}}
 */
function createVatReturn(vatReturnData) {
  // Calculate derived boxes if not provided
  const dataWithDerived = calculateDerivedBoxes(vatReturnData);

  // Validate input data
  const validation = validateVatReturnData(dataWithDerived, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Prepare the insert data
    const insertData = {
      userId: dataWithDerived.userId,
      periodStart: dataWithDerived.periodStart,
      periodEnd: dataWithDerived.periodEnd,
      status: dataWithDerived.status || 'draft',
      box1: dataWithDerived.box1 || 0,
      box2: dataWithDerived.box2 || 0,
      box3: dataWithDerived.box3 || 0,
      box4: dataWithDerived.box4 || 0,
      box5: dataWithDerived.box5 || 0,
      box6: dataWithDerived.box6 || 0,
      box7: dataWithDerived.box7 || 0,
      box8: dataWithDerived.box8 || 0,
      box9: dataWithDerived.box9 || 0,
      submittedAt: dataWithDerived.submittedAt || null,
      hmrcReceiptId: dataWithDerived.hmrcReceiptId?.trim() || null,
      notes: dataWithDerived.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO vat_returns (
        userId, periodStart, periodEnd, status,
        box1, box2, box3, box4, box5, box6, box7, box8, box9,
        submittedAt, hmrcReceiptId, notes
      ) VALUES (
        @userId, @periodStart, @periodEnd, @status,
        @box1, @box2, @box3, @box4, @box5, @box6, @box7, @box8, @box9,
        @submittedAt, @hmrcReceiptId, @notes
      )
    `, insertData);

    // Fetch the created VAT return
    const createdVatReturn = findById(result.lastInsertRowid);
    return { success: true, data: createdVatReturn };

  } catch (error) {
    // Check for overlapping period constraint
    if (error.message && error.message.includes('Overlapping VAT return period')) {
      return { success: false, errors: { periodStart: 'Overlapping VAT return period exists for this user' } };
    }
    console.error('Error creating VAT return:', error.message);
    return { success: false, errors: { general: 'Failed to create VAT return' } };
  }
}

/**
 * Finds a VAT return by ID.
 * 
 * @param {number} id - VAT Return ID
 * @returns {VatReturnData|null} VAT return data or null if not found
 */
function findById(id) {
  const vatReturn = queryOne('SELECT * FROM vat_returns WHERE id = ?', [id]);
  return vatReturn || null;
}

/**
 * Finds VAT returns by user ID for a specific period.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @returns {VatReturnData|null} VAT return data or null if not found
 */
function findByPeriod(userId, periodStart, periodEnd) {
  const vatReturn = queryOne(
    'SELECT * FROM vat_returns WHERE userId = ? AND periodStart = ? AND periodEnd = ?',
    [userId, periodStart, periodEnd]
  );
  return vatReturn || null;
}

/**
 * Gets all VAT returns for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.sortBy='periodEnd'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{vatReturns: VatReturnData[], total: number, page: number, limit: number}}
 */
function getVatReturnsByUserId(userId, { page = 1, limit = 10, status, sortBy = 'periodEnd', sortOrder = 'DESC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['periodStart', 'periodEnd', 'status', 'box5', 'createdAt', 'submittedAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'periodEnd';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (status && VAT_RETURN_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  const vatReturns = query(
    `SELECT * FROM vat_returns ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM vat_returns ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    vatReturns,
    total,
    page,
    limit
  };
}

/**
 * Updates a VAT return's data.
 * 
 * @param {number} id - VAT Return ID
 * @param {Partial<VatReturnData>} vatReturnData - Data to update
 * @returns {{success: boolean, data?: VatReturnData, errors?: Object.<string, string>}}
 */
function updateVatReturn(id, vatReturnData) {
  // Check if VAT return exists
  const existingVatReturn = findById(id);
  if (!existingVatReturn) {
    return { success: false, errors: { general: 'VAT return not found' } };
  }

  // Calculate derived boxes if relevant fields are being updated
  let dataWithDerived = { ...vatReturnData };
  if (vatReturnData.box1 !== undefined || vatReturnData.box2 !== undefined || 
      vatReturnData.box3 !== undefined || vatReturnData.box4 !== undefined) {
    // Merge with existing data for calculation
    const mergedData = {
      box1: vatReturnData.box1 !== undefined ? vatReturnData.box1 : existingVatReturn.box1,
      box2: vatReturnData.box2 !== undefined ? vatReturnData.box2 : existingVatReturn.box2,
      box4: vatReturnData.box4 !== undefined ? vatReturnData.box4 : existingVatReturn.box4
    };
    const calculated = calculateDerivedBoxes(mergedData);
    dataWithDerived.box3 = calculated.box3;
    dataWithDerived.box5 = calculated.box5;
  }

  // Validate input data
  const validation = validateVatReturnData(dataWithDerived, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (dataWithDerived.periodStart !== undefined) {
      updateFields.push('periodStart = @periodStart');
      updateParams.periodStart = dataWithDerived.periodStart;
    }

    if (dataWithDerived.periodEnd !== undefined) {
      updateFields.push('periodEnd = @periodEnd');
      updateParams.periodEnd = dataWithDerived.periodEnd;
    }

    if (dataWithDerived.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = dataWithDerived.status;
    }

    if (dataWithDerived.box1 !== undefined) {
      updateFields.push('box1 = @box1');
      updateParams.box1 = dataWithDerived.box1;
    }

    if (dataWithDerived.box2 !== undefined) {
      updateFields.push('box2 = @box2');
      updateParams.box2 = dataWithDerived.box2;
    }

    if (dataWithDerived.box3 !== undefined) {
      updateFields.push('box3 = @box3');
      updateParams.box3 = dataWithDerived.box3;
    }

    if (dataWithDerived.box4 !== undefined) {
      updateFields.push('box4 = @box4');
      updateParams.box4 = dataWithDerived.box4;
    }

    if (dataWithDerived.box5 !== undefined) {
      updateFields.push('box5 = @box5');
      updateParams.box5 = dataWithDerived.box5;
    }

    if (dataWithDerived.box6 !== undefined) {
      updateFields.push('box6 = @box6');
      updateParams.box6 = dataWithDerived.box6;
    }

    if (dataWithDerived.box7 !== undefined) {
      updateFields.push('box7 = @box7');
      updateParams.box7 = dataWithDerived.box7;
    }

    if (dataWithDerived.box8 !== undefined) {
      updateFields.push('box8 = @box8');
      updateParams.box8 = dataWithDerived.box8;
    }

    if (dataWithDerived.box9 !== undefined) {
      updateFields.push('box9 = @box9');
      updateParams.box9 = dataWithDerived.box9;
    }

    if (dataWithDerived.submittedAt !== undefined) {
      updateFields.push('submittedAt = @submittedAt');
      updateParams.submittedAt = dataWithDerived.submittedAt;
    }

    if (dataWithDerived.hmrcReceiptId !== undefined) {
      updateFields.push('hmrcReceiptId = @hmrcReceiptId');
      updateParams.hmrcReceiptId = dataWithDerived.hmrcReceiptId?.trim() || null;
    }

    if (dataWithDerived.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = dataWithDerived.notes?.trim() || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = datetime('now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: existingVatReturn };
    }

    execute(
      `UPDATE vat_returns SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated VAT return
    const updatedVatReturn = findById(id);
    return { success: true, data: updatedVatReturn };

  } catch (error) {
    // Check for overlapping period constraint
    if (error.message && error.message.includes('Overlapping VAT return period')) {
      return { success: false, errors: { periodStart: 'Overlapping VAT return period exists for this user' } };
    }
    console.error('Error updating VAT return:', error.message);
    return { success: false, errors: { general: 'Failed to update VAT return' } };
  }
}

/**
 * Deletes a VAT return by ID.
 * 
 * @param {number} id - VAT Return ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteVatReturn(id) {
  const existingVatReturn = findById(id);
  if (!existingVatReturn) {
    return { success: false, error: 'VAT return not found' };
  }

  // Prevent deletion of submitted/accepted returns
  if (['submitted', 'accepted'].includes(existingVatReturn.status)) {
    return { success: false, error: 'Cannot delete a submitted or accepted VAT return' };
  }

  try {
    execute('DELETE FROM vat_returns WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting VAT return:', error.message);
    return { success: false, error: 'Failed to delete VAT return' };
  }
}

/**
 * Updates VAT return status.
 * 
 * @param {number} id - VAT Return ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: VatReturnData, error?: string}}
 */
function updateStatus(id, status) {
  if (!VAT_RETURN_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${VAT_RETURN_STATUSES.join(', ')}` };
  }

  const existingVatReturn = findById(id);
  if (!existingVatReturn) {
    return { success: false, error: 'VAT return not found' };
  }

  try {
    const updateParams = { id, status };
    
    // If marking as submitted, set submittedAt timestamp
    if (status === 'submitted' && !existingVatReturn.submittedAt) {
      execute(
        `UPDATE vat_returns SET status = @status, submittedAt = datetime('now'), updatedAt = datetime('now') WHERE id = @id`,
        updateParams
      );
    } else {
      execute(
        `UPDATE vat_returns SET status = @status, updatedAt = datetime('now') WHERE id = @id`,
        updateParams
      );
    }

    const updatedVatReturn = findById(id);
    return { success: true, data: updatedVatReturn };
  } catch (error) {
    console.error('Error updating VAT return status:', error.message);
    return { success: false, error: 'Failed to update VAT return status' };
  }
}

/**
 * Gets VAT returns by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - VAT return status
 * @returns {VatReturnData[]} Array of VAT returns
 */
function getByStatus(userId, status) {
  if (!VAT_RETURN_STATUSES.includes(status)) {
    return [];
  }
  return query(
    'SELECT * FROM vat_returns WHERE userId = ? AND status = ? ORDER BY periodEnd DESC',
    [userId, status]
  );
}

/**
 * Gets pending VAT returns (ready for submission).
 * 
 * @param {number} userId - User ID
 * @returns {VatReturnData[]} Array of pending VAT returns
 */
function getPendingVatReturns(userId) {
  return query(
    `SELECT * FROM vat_returns 
     WHERE userId = ? AND status = 'pending'
     ORDER BY periodEnd ASC`,
    [userId]
  );
}

/**
 * Gets VAT return count by status for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM vat_returns 
     WHERE userId = ? 
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of VAT_RETURN_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Gets VAT returns for a date range (periods that overlap with the given range).
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {VatReturnData[]} Array of VAT returns
 */
function getByDateRange(userId, startDate, endDate) {
  return query(
    `SELECT * FROM vat_returns 
     WHERE userId = ? 
       AND periodEnd >= ? 
       AND periodStart <= ?
     ORDER BY periodStart ASC`,
    [userId, startDate, endDate]
  );
}

/**
 * Gets the latest VAT return for a user.
 * 
 * @param {number} userId - User ID
 * @returns {VatReturnData|null} Latest VAT return or null
 */
function getLatest(userId) {
  const vatReturn = queryOne(
    'SELECT * FROM vat_returns WHERE userId = ? ORDER BY periodEnd DESC LIMIT 1',
    [userId]
  );
  return vatReturn || null;
}

/**
 * Checks if a period overlaps with existing VAT returns (for validation before creation).
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {number} [excludeId] - ID to exclude from check (for updates)
 * @returns {boolean} True if overlapping period exists
 */
function hasOverlappingPeriod(userId, periodStart, periodEnd, excludeId = null) {
  let sql = `
    SELECT COUNT(*) as count FROM vat_returns
    WHERE userId = ?
      AND (
        (? >= periodStart AND ? <= periodEnd)
        OR (? >= periodStart AND ? <= periodEnd)
        OR (? <= periodStart AND ? >= periodEnd)
      )
  `;
  const params = [userId, periodStart, periodStart, periodEnd, periodEnd, periodStart, periodEnd];
  
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  
  const result = queryOne(sql, params);
  return result?.count > 0;
}

/**
 * Gets yearly VAT summary for a user.
 * 
 * @param {number} userId - User ID
 * @param {number} year - Tax year
 * @returns {{totalVatDue: number, totalVatReclaimed: number, netVat: number, returnCount: number}}
 */
function getYearlySummary(userId, year) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  const result = queryOne(
    `SELECT 
       COALESCE(SUM(box3), 0) as totalVatDue,
       COALESCE(SUM(box4), 0) as totalVatReclaimed,
       COALESCE(SUM(box5), 0) as netVat,
       COUNT(*) as returnCount
     FROM vat_returns 
     WHERE userId = ? 
       AND periodEnd >= ? 
       AND periodStart <= ?
       AND status IN ('submitted', 'accepted')`,
    [userId, startDate, endDate]
  );
  
  return {
    totalVatDue: result?.totalVatDue || 0,
    totalVatReclaimed: result?.totalVatReclaimed || 0,
    netVat: result?.netVat || 0,
    returnCount: result?.returnCount || 0
  };
}

module.exports = {
  // CRUD operations
  createVatReturn,
  findById,
  findByPeriod,
  getVatReturnsByUserId,
  updateVatReturn,
  deleteVatReturn,
  
  // Status operations
  updateStatus,
  getByStatus,
  getPendingVatReturns,
  getStatusCounts,
  
  // Query operations
  getByDateRange,
  getLatest,
  hasOverlappingPeriod,
  getYearlySummary,
  
  // Validation and calculation
  validateVatReturnData,
  calculateDerivedBoxes,
  fieldDefinitions,
  
  // Constants
  VAT_RETURN_STATUSES
};
