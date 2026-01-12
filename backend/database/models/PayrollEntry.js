/**
 * PayrollEntry model for payroll record management.
 * Provides CRUD operations and validation for payroll entry data.
 * 
 * @module models/PayrollEntry
 */

const validator = require('validator');
const { query, queryOne, execute } = require('../index');
const { VALID_STATUSES } = require('../migrations/017_create_payroll_entries_table');

/**
 * Valid payroll entry status values.
 */
const PAYROLL_ENTRY_STATUSES = VALID_STATUSES;

/**
 * Valid NI category letters.
 * A - Standard
 * B - Married women/widows
 * C - Employees over state pension age
 * H - Apprentice under 25
 * J - Deferment
 * M - Employees under 21
 * Z - Employees under 21 with deferment
 */
const VALID_NI_CATEGORIES = ['A', 'B', 'C', 'H', 'J', 'M', 'Z'];

/**
 * Regular expression for validating UK HMRC tax codes.
 * Same as in Employee model for consistency.
 * Formats:
 * - Standard: 1257L, 1185L, etc.
 * - K codes (negative allowance): K475, SK100, etc.
 * - Emergency: 1257L W1, 1257L M1, 1257L X
 * - Special: BR, D0, D1, NT, 0T
 * - Scottish: S1257L, SK475
 * - Welsh: C1257L
 */
const TAX_CODE_REGEX = /^(([SC]?K\d{1,4})|([SCW]?\d{1,4}[LMNPTY](\s?(W1|M1|X))?)|(BR|D0|D1|NT|0T))$/i;

/**
 * Validates a UK HMRC tax code.
 * 
 * @param {string} taxCode - Tax code to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateTaxCode(taxCode) {
  if (!taxCode || !taxCode.trim()) {
    return 'Tax code is required';
  }
  
  // Remove spaces and convert to uppercase for validation
  const cleanedTaxCode = taxCode.replace(/\s/g, '').toUpperCase();
  
  if (!TAX_CODE_REGEX.test(cleanedTaxCode)) {
    return 'Invalid UK tax code format (e.g., 1257L, BR, D0)';
  }
  
  return null;
}

/**
 * PayrollEntry field definitions with validation rules.
 * @typedef {Object} PayrollEntryFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * PayrollEntry field definitions for validation.
 * @type {Object.<string, PayrollEntryFieldDefinition>}
 */
const fieldDefinitions = {
  employeeId: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value <= 0) {
        return 'employeeId must be a positive integer';
      }
      return null;
    }
  },
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
  payPeriodStart: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid payPeriodStart format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  payPeriodEnd: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid payPeriodEnd format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  payDate: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid payDate format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  status: {
    type: 'string',
    required: false,
    default: 'draft',
    validate: (value) => {
      if (value && !PAYROLL_ENTRY_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${PAYROLL_ENTRY_STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  grossPay: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'grossPay must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  taxableIncome: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'taxableIncome must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  incomeTax: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'incomeTax must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  employeeNI: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'employeeNI must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  employerNI: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'employerNI must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  studentLoanDeduction: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'studentLoanDeduction must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  pensionEmployeeContribution: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'pensionEmployeeContribution must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  pensionEmployerContribution: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'pensionEmployerContribution must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  otherDeductions: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'otherDeductions must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  otherDeductionsNotes: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  netPay: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'netPay must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  hoursWorked: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        return 'hoursWorked must be a non-negative number';
      }
      return null;
    }
  },
  overtimeHours: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        return 'overtimeHours must be a non-negative number';
      }
      return null;
    }
  },
  overtimeRate: {
    type: 'number',
    required: false,
    default: 1.5,
    validate: (value) => {
      if (value !== undefined && (typeof value !== 'number' || value < 1)) {
        return 'overtimeRate must be at least 1.0';
      }
      return null;
    }
  },
  bonus: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'bonus must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  commission: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'commission must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  taxCode: {
    type: 'string',
    required: true,
    maxLength: 15,
    validate: validateTaxCode
  },
  niCategory: {
    type: 'string',
    required: false,
    default: 'A',
    maxLength: 1,
    validate: (value) => {
      if (value && !VALID_NI_CATEGORIES.includes(value.toUpperCase())) {
        return `Invalid niCategory. Must be one of: ${VALID_NI_CATEGORIES.join(', ')}`;
      }
      return null;
    }
  },
  cumulativeTaxableIncome: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'cumulativeTaxableIncome must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  cumulativeTaxPaid: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'cumulativeTaxPaid must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 5000
  }
};

/**
 * PayrollEntry data object
 * @typedef {Object} PayrollEntryData
 * @property {number} [id] - PayrollEntry ID (auto-generated)
 * @property {number} employeeId - Employee ID
 * @property {number} userId - User ID (employer)
 * @property {string} payPeriodStart - Pay period start date
 * @property {string} payPeriodEnd - Pay period end date
 * @property {string} payDate - Payment date
 * @property {string} [status] - Entry status
 * @property {number} [grossPay] - Gross pay in pence
 * @property {number} [taxableIncome] - Taxable income in pence
 * @property {number} [incomeTax] - Income tax in pence
 * @property {number} [employeeNI] - Employee NI in pence
 * @property {number} [employerNI] - Employer NI in pence
 * @property {number} [studentLoanDeduction] - Student loan deduction in pence
 * @property {number} [pensionEmployeeContribution] - Employee pension in pence
 * @property {number} [pensionEmployerContribution] - Employer pension in pence
 * @property {number} [otherDeductions] - Other deductions in pence
 * @property {string} [otherDeductionsNotes] - Notes for other deductions
 * @property {number} [netPay] - Net pay in pence
 * @property {number} [hoursWorked] - Hours worked
 * @property {number} [overtimeHours] - Overtime hours
 * @property {number} [overtimeRate] - Overtime rate multiplier
 * @property {number} [bonus] - Bonus in pence
 * @property {number} [commission] - Commission in pence
 * @property {string} taxCode - Tax code used
 * @property {string} [niCategory] - NI category letter
 * @property {number} [cumulativeTaxableIncome] - Cumulative taxable income
 * @property {number} [cumulativeTaxPaid] - Cumulative tax paid
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
 * Validates payroll entry data against field definitions.
 * 
 * @param {Partial<PayrollEntryData>} entryData - PayrollEntry data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validatePayrollEntryData(entryData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = entryData[fieldName];

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

    // Type validation (special handling for hoursWorked, overtimeHours, overtimeRate which can be floats)
    const floatFields = ['hoursWorked', 'overtimeHours', 'overtimeRate'];
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

  // Cross-field validation: payPeriodEnd must be >= payPeriodStart
  if (entryData.payPeriodStart && entryData.payPeriodEnd) {
    const startDate = new Date(entryData.payPeriodStart);
    const endDate = new Date(entryData.payPeriodEnd);
    if (endDate < startDate) {
      errors.payPeriodEnd = 'payPeriodEnd must be on or after payPeriodStart';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Creates a new payroll entry in the database.
 * 
 * @param {PayrollEntryData} entryData - PayrollEntry data to create
 * @returns {{success: boolean, data?: PayrollEntryData, errors?: Object.<string, string>}}
 */
function createPayrollEntry(entryData) {
  // Validate input data
  const validation = validatePayrollEntryData(entryData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  try {
    // Prepare the insert data
    const insertData = {
      employeeId: entryData.employeeId,
      userId: entryData.userId,
      payPeriodStart: entryData.payPeriodStart,
      payPeriodEnd: entryData.payPeriodEnd,
      payDate: entryData.payDate,
      status: entryData.status || 'draft',
      grossPay: entryData.grossPay || 0,
      taxableIncome: entryData.taxableIncome || 0,
      incomeTax: entryData.incomeTax || 0,
      employeeNI: entryData.employeeNI || 0,
      employerNI: entryData.employerNI || 0,
      studentLoanDeduction: entryData.studentLoanDeduction || 0,
      pensionEmployeeContribution: entryData.pensionEmployeeContribution || 0,
      pensionEmployerContribution: entryData.pensionEmployerContribution || 0,
      otherDeductions: entryData.otherDeductions || 0,
      otherDeductionsNotes: entryData.otherDeductionsNotes?.trim() || null,
      netPay: entryData.netPay || 0,
      hoursWorked: entryData.hoursWorked || 0,
      overtimeHours: entryData.overtimeHours || 0,
      overtimeRate: entryData.overtimeRate || 1.5,
      bonus: entryData.bonus || 0,
      commission: entryData.commission || 0,
      taxCode: entryData.taxCode.replace(/\s/g, '').toUpperCase(),
      niCategory: (entryData.niCategory || 'A').toUpperCase(),
      cumulativeTaxableIncome: entryData.cumulativeTaxableIncome || 0,
      cumulativeTaxPaid: entryData.cumulativeTaxPaid || 0,
      notes: entryData.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO payroll_entries (
        employeeId, userId, payPeriodStart, payPeriodEnd, payDate,
        status, grossPay, taxableIncome, incomeTax, employeeNI,
        employerNI, studentLoanDeduction, pensionEmployeeContribution,
        pensionEmployerContribution, otherDeductions, otherDeductionsNotes,
        netPay, hoursWorked, overtimeHours, overtimeRate, bonus,
        commission, taxCode, niCategory, cumulativeTaxableIncome,
        cumulativeTaxPaid, notes
      ) VALUES (
        @employeeId, @userId, @payPeriodStart, @payPeriodEnd, @payDate,
        @status, @grossPay, @taxableIncome, @incomeTax, @employeeNI,
        @employerNI, @studentLoanDeduction, @pensionEmployeeContribution,
        @pensionEmployerContribution, @otherDeductions, @otherDeductionsNotes,
        @netPay, @hoursWorked, @overtimeHours, @overtimeRate, @bonus,
        @commission, @taxCode, @niCategory, @cumulativeTaxableIncome,
        @cumulativeTaxPaid, @notes
      )
    `, insertData);

    // Fetch the created entry
    const createdEntry = findById(result.lastInsertRowid);
    return { success: true, data: createdEntry };

  } catch (error) {
    console.error('Error creating payroll entry:', error.message);
    return { success: false, errors: { general: 'Failed to create payroll entry' } };
  }
}

/**
 * Finds a payroll entry by ID.
 * 
 * @param {number} id - PayrollEntry ID
 * @returns {PayrollEntryData|null} PayrollEntry data or null if not found
 */
function findById(id) {
  const entry = queryOne('SELECT * FROM payroll_entries WHERE id = ?', [id]);
  return entry || null;
}

/**
 * Gets all payroll entries for an employee (paginated).
 * 
 * @param {number} employeeId - Employee ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.sortBy='payDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{entries: PayrollEntryData[], total: number, page: number, limit: number}}
 */
function getEntriesByEmployeeId(employeeId, { page = 1, limit = 10, status, sortBy = 'payDate', sortOrder = 'DESC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['payDate', 'payPeriodStart', 'payPeriodEnd', 'grossPay', 'netPay', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'payDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let whereClause = 'WHERE employeeId = ?';
  const params = [employeeId];
  
  if (status && PAYROLL_ENTRY_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  const entries = query(
    `SELECT * FROM payroll_entries ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM payroll_entries ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    entries,
    total,
    page,
    limit
  };
}

/**
 * Gets all payroll entries for a user (paginated).
 * 
 * @param {number} userId - User ID (employer)
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.startDate] - Filter from date
 * @param {string} [options.endDate] - Filter to date
 * @param {string} [options.sortBy='payDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{entries: PayrollEntryData[], total: number, page: number, limit: number}}
 */
function getEntriesByUserId(userId, { page = 1, limit = 10, status, startDate, endDate, sortBy = 'payDate', sortOrder = 'DESC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['payDate', 'payPeriodStart', 'payPeriodEnd', 'grossPay', 'netPay', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'payDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (status && PAYROLL_ENTRY_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  if (startDate) {
    whereClause += ' AND payDate >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    whereClause += ' AND payDate <= ?';
    params.push(endDate);
  }
  
  const entries = query(
    `SELECT * FROM payroll_entries ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM payroll_entries ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    entries,
    total,
    page,
    limit
  };
}

/**
 * Updates a payroll entry's data.
 * 
 * @param {number} id - PayrollEntry ID
 * @param {Partial<PayrollEntryData>} entryData - Data to update
 * @returns {{success: boolean, data?: PayrollEntryData, errors?: Object.<string, string>}}
 */
function updatePayrollEntry(id, entryData) {
  // Validate input data
  const validation = validatePayrollEntryData(entryData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if entry exists
  const existingEntry = findById(id);
  if (!existingEntry) {
    return { success: false, errors: { general: 'Payroll entry not found' } };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    // Iterate through all possible fields
    const updatableFields = [
      'payPeriodStart', 'payPeriodEnd', 'payDate', 'status',
      'grossPay', 'taxableIncome', 'incomeTax', 'employeeNI',
      'employerNI', 'studentLoanDeduction', 'pensionEmployeeContribution',
      'pensionEmployerContribution', 'otherDeductions', 'otherDeductionsNotes',
      'netPay', 'hoursWorked', 'overtimeHours', 'overtimeRate',
      'bonus', 'commission', 'taxCode', 'niCategory',
      'cumulativeTaxableIncome', 'cumulativeTaxPaid', 'notes'
    ];

    for (const field of updatableFields) {
      if (entryData[field] !== undefined) {
        updateFields.push(`${field} = @${field}`);
        
        // Handle special cases
        if (field === 'taxCode') {
          updateParams[field] = entryData[field].replace(/\s/g, '').toUpperCase();
        } else if (field === 'niCategory') {
          updateParams[field] = entryData[field].toUpperCase();
        } else if (field === 'otherDeductionsNotes' || field === 'notes') {
          updateParams[field] = entryData[field]?.trim() || null;
        } else {
          updateParams[field] = entryData[field];
        }
      }
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = datetime('now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: existingEntry };
    }

    execute(
      `UPDATE payroll_entries SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated entry
    const updatedEntry = findById(id);
    return { success: true, data: updatedEntry };

  } catch (error) {
    console.error('Error updating payroll entry:', error.message);
    return { success: false, errors: { general: 'Failed to update payroll entry' } };
  }
}

/**
 * Deletes a payroll entry by ID.
 * 
 * @param {number} id - PayrollEntry ID
 * @returns {{success: boolean, error?: string}}
 */
function deletePayrollEntry(id) {
  const existingEntry = findById(id);
  if (!existingEntry) {
    return { success: false, error: 'Payroll entry not found' };
  }

  try {
    execute('DELETE FROM payroll_entries WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting payroll entry:', error.message);
    return { success: false, error: 'Failed to delete payroll entry' };
  }
}

/**
 * Updates payroll entry status.
 * 
 * @param {number} id - PayrollEntry ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: PayrollEntryData, error?: string}}
 */
function updateStatus(id, status) {
  if (!PAYROLL_ENTRY_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${PAYROLL_ENTRY_STATUSES.join(', ')}` };
  }

  const existingEntry = findById(id);
  if (!existingEntry) {
    return { success: false, error: 'Payroll entry not found' };
  }

  try {
    execute(
      `UPDATE payroll_entries SET status = @status, updatedAt = datetime('now') WHERE id = @id`,
      { id, status }
    );

    const updatedEntry = findById(id);
    return { success: true, data: updatedEntry };
  } catch (error) {
    console.error('Error updating payroll entry status:', error.message);
    return { success: false, error: 'Failed to update payroll entry status' };
  }
}

/**
 * Gets payroll entries by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - PayrollEntry status
 * @returns {PayrollEntryData[]} Array of payroll entries
 */
function getByStatus(userId, status) {
  if (!PAYROLL_ENTRY_STATUSES.includes(status)) {
    return [];
  }
  return query(
    'SELECT * FROM payroll_entries WHERE userId = ? AND status = ? ORDER BY payDate DESC',
    [userId, status]
  );
}

/**
 * Gets payroll entry count by status for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM payroll_entries 
     WHERE userId = ? 
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of PAYROLL_ENTRY_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Gets the most recent payroll entry for an employee.
 * 
 * @param {number} employeeId - Employee ID
 * @returns {PayrollEntryData|null} Most recent payroll entry or null
 */
function getLatestEntryForEmployee(employeeId) {
  const entry = queryOne(
    'SELECT * FROM payroll_entries WHERE employeeId = ? ORDER BY payDate DESC LIMIT 1',
    [employeeId]
  );
  return entry || null;
}

/**
 * Gets payroll entries for a specific pay period.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Pay period start date
 * @param {string} periodEnd - Pay period end date
 * @returns {PayrollEntryData[]} Array of payroll entries
 */
function getEntriesByPayPeriod(userId, periodStart, periodEnd) {
  return query(
    `SELECT * FROM payroll_entries 
     WHERE userId = ? AND payPeriodStart = ? AND payPeriodEnd = ?
     ORDER BY employeeId ASC`,
    [userId, periodStart, periodEnd]
  );
}

/**
 * Calculates payroll summary for a user within a date range.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {{totalGross: number, totalNet: number, totalTax: number, totalEmployeeNI: number, totalEmployerNI: number, entryCount: number}}
 */
function getPayrollSummary(userId, startDate, endDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(grossPay), 0) as totalGross,
      COALESCE(SUM(netPay), 0) as totalNet,
      COALESCE(SUM(incomeTax), 0) as totalTax,
      COALESCE(SUM(employeeNI), 0) as totalEmployeeNI,
      COALESCE(SUM(employerNI), 0) as totalEmployerNI,
      COUNT(*) as entryCount
    FROM payroll_entries 
    WHERE userId = ? AND payDate >= ? AND payDate <= ? AND status != 'cancelled'
  `, [userId, startDate, endDate]);

  return {
    totalGross: result?.totalGross || 0,
    totalNet: result?.totalNet || 0,
    totalTax: result?.totalTax || 0,
    totalEmployeeNI: result?.totalEmployeeNI || 0,
    totalEmployerNI: result?.totalEmployerNI || 0,
    entryCount: result?.entryCount || 0
  };
}

/**
 * Calculates net pay from gross pay and deductions.
 * 
 * @param {number} grossPay - Gross pay in pence
 * @param {number} incomeTax - Income tax in pence
 * @param {number} employeeNI - Employee NI in pence
 * @param {number} studentLoanDeduction - Student loan deduction in pence
 * @param {number} pensionEmployeeContribution - Employee pension in pence
 * @param {number} otherDeductions - Other deductions in pence
 * @returns {number} Net pay in pence
 */
function calculateNetPay(grossPay, incomeTax = 0, employeeNI = 0, studentLoanDeduction = 0, pensionEmployeeContribution = 0, otherDeductions = 0) {
  return grossPay - incomeTax - employeeNI - studentLoanDeduction - pensionEmployeeContribution - otherDeductions;
}

module.exports = {
  // CRUD operations
  createPayrollEntry,
  findById,
  getEntriesByEmployeeId,
  getEntriesByUserId,
  updatePayrollEntry,
  deletePayrollEntry,
  
  // Status operations
  updateStatus,
  getByStatus,
  getStatusCounts,
  
  // Query helpers
  getLatestEntryForEmployee,
  getEntriesByPayPeriod,
  getPayrollSummary,
  
  // Calculations
  calculateNetPay,
  
  // Validation
  validatePayrollEntryData,
  validateTaxCode,
  fieldDefinitions,
  
  // Constants
  PAYROLL_ENTRY_STATUSES,
  VALID_NI_CATEGORIES,
  TAX_CODE_REGEX
};
