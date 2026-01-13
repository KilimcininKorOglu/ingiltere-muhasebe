/**
 * Employee model for employee record management.
 * Provides CRUD operations and validation for employee data.
 * 
 * @module models/Employee
 */

const validator = require('validator');
const { query, queryOne, execute } = require('../index');
const { VALID_STATUSES } = require('../migrations/016_create_employees_table');

/**
 * Valid employee status values.
 */
const EMPLOYEE_STATUSES = VALID_STATUSES;

/**
 * Valid pay frequency values.
 */
const VALID_PAY_FREQUENCIES = ['weekly', 'biweekly', 'monthly'];

/**
 * Valid student loan plan types.
 */
const VALID_STUDENT_LOAN_PLANS = ['plan1', 'plan2', 'plan4', 'postgrad'];

/**
 * Regular expression for validating UK National Insurance numbers.
 * Format: Two letters, six digits, one letter (A, B, C, or D)
 * First two letters cannot be: D, F, I, Q, U, V
 * Second letter cannot be: O
 * Prefixes BG, GB, NK, KN, TN, NT, ZZ are not allowed
 */
const NI_NUMBER_REGEX = /^(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/i;

/**
 * Regular expression for validating UK HMRC tax codes.
 * Common formats:
 * - Standard: 1257L, 1185L, etc.
 * - K codes (negative allowance): K475, SK100, etc.
 * - Emergency: 1257L W1, 1257L M1, 1257L X
 * - Special: BR, D0, D1, NT, 0T
 * - Scottish: S1257L, SK475
 * - Welsh: C1257L
 */
const TAX_CODE_REGEX = /^(([SC]?K\d{1,4})|([SCW]?\d{1,4}[LMNPTY](\s?(W1|M1|X))?)|(BR|D0|D1|NT|0T))$/i;

/**
 * Validates a UK National Insurance number.
 * 
 * @param {string} niNumber - National Insurance number to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateNINumber(niNumber) {
  if (!niNumber || !niNumber.trim()) {
    return null; // NI number is optional
  }
  
  // Remove spaces and convert to uppercase
  const cleanedNI = niNumber.replace(/\s/g, '').toUpperCase();
  
  if (!NI_NUMBER_REGEX.test(cleanedNI)) {
    return 'Invalid UK National Insurance number format (e.g., AB123456C)';
  }
  
  return null;
}

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
 * Employee field definitions with validation rules.
 * @typedef {Object} EmployeeFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Employee field definitions for validation.
 * @type {Object.<string, EmployeeFieldDefinition>}
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
  employeeNumber: {
    type: 'string',
    required: true,
    maxLength: 50,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'employeeNumber is required';
      }
      // Allow alphanumeric, dashes, and underscores
      if (!/^[A-Za-z0-9\-_]+$/.test(value.trim())) {
        return 'employeeNumber can only contain letters, numbers, dashes, and underscores';
      }
      return null;
    }
  },
  firstName: {
    type: 'string',
    required: true,
    maxLength: 100,
    validate: (value) => {
      if (!value || value.trim().length < 1) {
        return 'firstName is required';
      }
      return null;
    }
  },
  lastName: {
    type: 'string',
    required: true,
    maxLength: 100,
    validate: (value) => {
      if (!value || value.trim().length < 1) {
        return 'lastName is required';
      }
      return null;
    }
  },
  email: {
    type: 'string',
    required: false,
    maxLength: 255,
    validate: (value) => {
      if (value && value.trim() && !validator.isEmail(value)) {
        return 'Invalid email format';
      }
      return null;
    }
  },
  niNumber: {
    type: 'string',
    required: false,
    maxLength: 13,
    validate: validateNINumber
  },
  taxCode: {
    type: 'string',
    required: false,
    default: '1257L',
    maxLength: 15,
    validate: validateTaxCode
  },
  dateOfBirth: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && value.trim()) {
        if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
          return 'Invalid dateOfBirth format (YYYY-MM-DD)';
        }
        // Validate reasonable age range (16-100)
        const dob = new Date(value);
        const today = new Date();
        const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 16 || age > 100) {
          return 'Employee must be between 16 and 100 years old';
        }
      }
      return null;
    }
  },
  startDate: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid startDate format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  endDate: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && value.trim()) {
        if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
          return 'Invalid endDate format (YYYY-MM-DD)';
        }
      }
      return null;
    }
  },
  status: {
    type: 'string',
    required: false,
    default: 'active',
    validate: (value) => {
      if (value && !EMPLOYEE_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${EMPLOYEE_STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  payFrequency: {
    type: 'string',
    required: false,
    default: 'monthly',
    validate: (value) => {
      if (value && !VALID_PAY_FREQUENCIES.includes(value)) {
        return `Invalid payFrequency. Must be one of: ${VALID_PAY_FREQUENCIES.join(', ')}`;
      }
      return null;
    }
  },
  annualSalary: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'annualSalary must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  hourlyRate: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'hourlyRate must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  address: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  phoneNumber: {
    type: 'string',
    required: false,
    maxLength: 30,
    validate: (value) => {
      if (value && value.trim()) {
        // Basic phone number validation (allows +, digits, spaces, dashes, parentheses)
        const cleanedPhone = value.replace(/[\s\-()]/g, '');
        if (!/^\+?\d{7,15}$/.test(cleanedPhone)) {
          return 'Invalid phone number format';
        }
      }
      return null;
    }
  },
  bankAccountNumber: {
    type: 'string',
    required: false,
    maxLength: 20,
    validate: (value) => {
      if (value && value.trim()) {
        // UK bank account numbers are 8 digits
        const cleanedAccount = value.replace(/[\s\-]/g, '');
        if (!/^\d{8}$/.test(cleanedAccount)) {
          return 'Invalid UK bank account number (must be 8 digits)';
        }
      }
      return null;
    }
  },
  bankSortCode: {
    type: 'string',
    required: false,
    maxLength: 10,
    validate: (value) => {
      if (value && value.trim()) {
        // UK sort codes are 6 digits (often formatted as XX-XX-XX)
        const cleanedSortCode = value.replace(/[\s\-]/g, '');
        if (!/^\d{6}$/.test(cleanedSortCode)) {
          return 'Invalid UK bank sort code (must be 6 digits)';
        }
      }
      return null;
    }
  },
  studentLoanPlan: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && value.trim() && !VALID_STUDENT_LOAN_PLANS.includes(value)) {
        return `Invalid studentLoanPlan. Must be one of: ${VALID_STUDENT_LOAN_PLANS.join(', ')}`;
      }
      return null;
    }
  },
  pensionOptIn: {
    type: 'boolean',
    required: false,
    default: false
  },
  pensionContribution: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 10000)) {
        return 'pensionContribution must be between 0 and 10000 (representing 0% to 100.00%)';
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
 * Employee data object
 * @typedef {Object} EmployeeData
 * @property {number} [id] - Employee ID (auto-generated)
 * @property {number} userId - User ID who employs this person
 * @property {string} employeeNumber - Unique employee number
 * @property {string} firstName - First name
 * @property {string} lastName - Last name
 * @property {string} [email] - Email address
 * @property {string} [niNumber] - National Insurance number
 * @property {string} [taxCode] - HMRC tax code
 * @property {string} [dateOfBirth] - Date of birth (YYYY-MM-DD)
 * @property {string} startDate - Employment start date
 * @property {string} [endDate] - Employment end date
 * @property {string} [status] - Employment status
 * @property {string} [payFrequency] - Payment frequency
 * @property {number} [annualSalary] - Annual salary in pence
 * @property {number} [hourlyRate] - Hourly rate in pence
 * @property {string} [address] - Home address
 * @property {string} [phoneNumber] - Contact phone
 * @property {string} [bankAccountNumber] - Bank account number
 * @property {string} [bankSortCode] - Bank sort code
 * @property {string} [studentLoanPlan] - Student loan plan type
 * @property {boolean} [pensionOptIn] - Pension opt-in status
 * @property {number} [pensionContribution] - Pension contribution percentage
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
 * Validates employee data against field definitions.
 * 
 * @param {Partial<EmployeeData>} employeeData - Employee data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateEmployeeData(employeeData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = employeeData[fieldName];

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

  // Cross-field validation: endDate must be >= startDate
  if (employeeData.startDate && employeeData.endDate) {
    const startDate = new Date(employeeData.startDate);
    const endDate = new Date(employeeData.endDate);
    if (endDate < startDate) {
      errors.endDate = 'endDate must be on or after startDate';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Sanitizes employee data for output.
 * Converts SQLite integers to booleans where appropriate.
 * 
 * @param {EmployeeData} employee - Employee data object
 * @returns {EmployeeData} Sanitized employee data
 */
function sanitizeEmployee(employee) {
  if (!employee) return null;

  const sanitized = { ...employee };
  
  // Convert SQLite integer to boolean for pensionOptIn
  if (sanitized.pensionOptIn !== undefined) {
    sanitized.pensionOptIn = Boolean(sanitized.pensionOptIn);
  }
  
  return sanitized;
}

/**
 * Generates a new employee number.
 * Format: EMP-NNNN (e.g., EMP-0001)
 * 
 * @param {number} userId - User ID for scoping
 * @returns {string} Generated employee number
 */
function generateEmployeeNumber(userId) {
  const prefix = 'EMP-';
  
  // Get the highest employee number for this user
  const result = queryOne(`
    SELECT employeeNumber FROM employees 
    WHERE userId = ? AND employeeNumber LIKE ?
    ORDER BY employeeNumber DESC LIMIT 1
  `, [userId, `${prefix}%`]);
  
  let nextNumber = 1;
  if (result && result.employeeNumber) {
    const currentNumber = parseInt(result.employeeNumber.split('-')[1], 10);
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1;
    }
  }
  
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Creates a new employee in the database.
 * 
 * @param {EmployeeData} employeeData - Employee data to create
 * @returns {{success: boolean, data?: EmployeeData, errors?: Object.<string, string>}}
 */
function createEmployee(employeeData) {
  // Generate employee number if not provided
  if (!employeeData.employeeNumber && employeeData.userId) {
    employeeData.employeeNumber = generateEmployeeNumber(employeeData.userId);
  }

  // Validate input data
  const validation = validateEmployeeData(employeeData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if employee number already exists for this user
  const existingEmployee = findByEmployeeNumber(employeeData.userId, employeeData.employeeNumber);
  if (existingEmployee) {
    return { success: false, errors: { employeeNumber: 'Employee number already exists for this user' } };
  }

  try {
    // Prepare the insert data
    const insertData = {
      userId: employeeData.userId,
      employeeNumber: employeeData.employeeNumber.trim().toUpperCase(),
      firstName: employeeData.firstName.trim(),
      lastName: employeeData.lastName.trim(),
      email: employeeData.email?.toLowerCase().trim() || null,
      niNumber: employeeData.niNumber?.replace(/\s/g, '').toUpperCase() || null,
      taxCode: (employeeData.taxCode || '1257L').replace(/\s/g, '').toUpperCase(),
      dateOfBirth: employeeData.dateOfBirth || null,
      startDate: employeeData.startDate,
      endDate: employeeData.endDate || null,
      status: employeeData.status || 'active',
      payFrequency: employeeData.payFrequency || 'monthly',
      annualSalary: employeeData.annualSalary || 0,
      hourlyRate: employeeData.hourlyRate || 0,
      address: employeeData.address?.trim() || null,
      phoneNumber: employeeData.phoneNumber?.trim() || null,
      bankAccountNumber: employeeData.bankAccountNumber?.replace(/[\s\-]/g, '') || null,
      bankSortCode: employeeData.bankSortCode?.replace(/[\s\-]/g, '') || null,
      studentLoanPlan: employeeData.studentLoanPlan || null,
      pensionOptIn: employeeData.pensionOptIn ? 1 : 0,
      pensionContribution: employeeData.pensionContribution || 0,
      notes: employeeData.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO employees (
        userId, employeeNumber, firstName, lastName, email,
        niNumber, taxCode, dateOfBirth, startDate, endDate,
        status, payFrequency, annualSalary, hourlyRate, address,
        phoneNumber, bankAccountNumber, bankSortCode, studentLoanPlan,
        pensionOptIn, pensionContribution, notes
      ) VALUES (
        @userId, @employeeNumber, @firstName, @lastName, @email,
        @niNumber, @taxCode, @dateOfBirth, @startDate, @endDate,
        @status, @payFrequency, @annualSalary, @hourlyRate, @address,
        @phoneNumber, @bankAccountNumber, @bankSortCode, @studentLoanPlan,
        @pensionOptIn, @pensionContribution, @notes
      )
    `, insertData);

    // Fetch the created employee
    const createdEmployee = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeEmployee(createdEmployee) };

  } catch (error) {
    console.error('Error creating employee:', error.message);
    return { success: false, errors: { general: 'Failed to create employee' } };
  }
}

/**
 * Finds an employee by ID.
 * 
 * @param {number} id - Employee ID
 * @returns {EmployeeData|null} Employee data or null if not found
 */
function findById(id) {
  const employee = queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  return employee || null;
}

/**
 * Finds an employee by employee number for a specific user.
 * 
 * @param {number} userId - User ID
 * @param {string} employeeNumber - Employee number
 * @returns {EmployeeData|null} Employee data or null if not found
 */
function findByEmployeeNumber(userId, employeeNumber) {
  if (!employeeNumber) return null;
  const employee = queryOne(
    'SELECT * FROM employees WHERE userId = ? AND employeeNumber = ?',
    [userId, employeeNumber.trim().toUpperCase()]
  );
  return employee || null;
}

/**
 * Finds an employee by National Insurance number.
 * 
 * @param {string} niNumber - National Insurance number
 * @returns {EmployeeData|null} Employee data or null if not found
 */
function findByNINumber(niNumber) {
  if (!niNumber) return null;
  const cleanedNI = niNumber.replace(/\s/g, '').toUpperCase();
  const employee = queryOne(
    'SELECT * FROM employees WHERE niNumber = ?',
    [cleanedNI]
  );
  return employee || null;
}

/**
 * Gets all employees for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.sortBy='lastName'] - Sort field
 * @param {string} [options.sortOrder='ASC'] - Sort order
 * @returns {{employees: EmployeeData[], total: number, page: number, limit: number}}
 */
function getEmployeesByUserId(userId, { page = 1, limit = 10, status, sortBy = 'lastName', sortOrder = 'ASC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['lastName', 'firstName', 'employeeNumber', 'startDate', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'lastName';
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (status && EMPLOYEE_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  const employees = query(
    `SELECT * FROM employees ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM employees ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    employees: employees.map(sanitizeEmployee),
    total,
    page,
    limit
  };
}

/**
 * Updates an employee's data.
 * 
 * @param {number} id - Employee ID
 * @param {Partial<EmployeeData>} employeeData - Data to update
 * @returns {{success: boolean, data?: EmployeeData, errors?: Object.<string, string>}}
 */
function updateEmployee(id, employeeData) {
  // Validate input data
  const validation = validateEmployeeData(employeeData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if employee exists
  const existingEmployee = findById(id);
  if (!existingEmployee) {
    return { success: false, errors: { general: 'Employee not found' } };
  }

  // Check if employee number is being changed and is already taken
  if (employeeData.employeeNumber && 
      employeeData.employeeNumber.trim().toUpperCase() !== existingEmployee.employeeNumber) {
    const numberEmployee = findByEmployeeNumber(existingEmployee.userId, employeeData.employeeNumber);
    if (numberEmployee) {
      return { success: false, errors: { employeeNumber: 'Employee number already exists for this user' } };
    }
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (employeeData.employeeNumber !== undefined) {
      updateFields.push('employeeNumber = @employeeNumber');
      updateParams.employeeNumber = employeeData.employeeNumber.trim().toUpperCase();
    }

    if (employeeData.firstName !== undefined) {
      updateFields.push('firstName = @firstName');
      updateParams.firstName = employeeData.firstName.trim();
    }

    if (employeeData.lastName !== undefined) {
      updateFields.push('lastName = @lastName');
      updateParams.lastName = employeeData.lastName.trim();
    }

    if (employeeData.email !== undefined) {
      updateFields.push('email = @email');
      updateParams.email = employeeData.email?.toLowerCase().trim() || null;
    }

    if (employeeData.niNumber !== undefined) {
      updateFields.push('niNumber = @niNumber');
      updateParams.niNumber = employeeData.niNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (employeeData.taxCode !== undefined) {
      updateFields.push('taxCode = @taxCode');
      updateParams.taxCode = employeeData.taxCode.replace(/\s/g, '').toUpperCase();
    }

    if (employeeData.dateOfBirth !== undefined) {
      updateFields.push('dateOfBirth = @dateOfBirth');
      updateParams.dateOfBirth = employeeData.dateOfBirth || null;
    }

    if (employeeData.startDate !== undefined) {
      updateFields.push('startDate = @startDate');
      updateParams.startDate = employeeData.startDate;
    }

    if (employeeData.endDate !== undefined) {
      updateFields.push('endDate = @endDate');
      updateParams.endDate = employeeData.endDate || null;
    }

    if (employeeData.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = employeeData.status;
    }

    if (employeeData.payFrequency !== undefined) {
      updateFields.push('payFrequency = @payFrequency');
      updateParams.payFrequency = employeeData.payFrequency;
    }

    if (employeeData.annualSalary !== undefined) {
      updateFields.push('annualSalary = @annualSalary');
      updateParams.annualSalary = employeeData.annualSalary;
    }

    if (employeeData.hourlyRate !== undefined) {
      updateFields.push('hourlyRate = @hourlyRate');
      updateParams.hourlyRate = employeeData.hourlyRate;
    }

    if (employeeData.address !== undefined) {
      updateFields.push('address = @address');
      updateParams.address = employeeData.address?.trim() || null;
    }

    if (employeeData.phoneNumber !== undefined) {
      updateFields.push('phoneNumber = @phoneNumber');
      updateParams.phoneNumber = employeeData.phoneNumber?.trim() || null;
    }

    if (employeeData.bankAccountNumber !== undefined) {
      updateFields.push('bankAccountNumber = @bankAccountNumber');
      updateParams.bankAccountNumber = employeeData.bankAccountNumber?.replace(/[\s\-]/g, '') || null;
    }

    if (employeeData.bankSortCode !== undefined) {
      updateFields.push('bankSortCode = @bankSortCode');
      updateParams.bankSortCode = employeeData.bankSortCode?.replace(/[\s\-]/g, '') || null;
    }

    if (employeeData.studentLoanPlan !== undefined) {
      updateFields.push('studentLoanPlan = @studentLoanPlan');
      updateParams.studentLoanPlan = employeeData.studentLoanPlan || null;
    }

    if (employeeData.pensionOptIn !== undefined) {
      updateFields.push('pensionOptIn = @pensionOptIn');
      updateParams.pensionOptIn = employeeData.pensionOptIn ? 1 : 0;
    }

    if (employeeData.pensionContribution !== undefined) {
      updateFields.push('pensionContribution = @pensionContribution');
      updateParams.pensionContribution = employeeData.pensionContribution;
    }

    if (employeeData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = employeeData.notes?.trim() || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeEmployee(existingEmployee) };
    }

    execute(
      `UPDATE employees SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated employee
    const updatedEmployee = findById(id);
    return { success: true, data: sanitizeEmployee(updatedEmployee) };

  } catch (error) {
    console.error('Error updating employee:', error.message);
    return { success: false, errors: { general: 'Failed to update employee' } };
  }
}

/**
 * Deletes an employee by ID.
 * 
 * @param {number} id - Employee ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteEmployee(id) {
  const existingEmployee = findById(id);
  if (!existingEmployee) {
    return { success: false, error: 'Employee not found' };
  }

  try {
    execute('DELETE FROM employees WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting employee:', error.message);
    return { success: false, error: 'Failed to delete employee' };
  }
}

/**
 * Updates employee status.
 * 
 * @param {number} id - Employee ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: EmployeeData, error?: string}}
 */
function updateStatus(id, status) {
  if (!EMPLOYEE_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${EMPLOYEE_STATUSES.join(', ')}` };
  }

  const existingEmployee = findById(id);
  if (!existingEmployee) {
    return { success: false, error: 'Employee not found' };
  }

  try {
    execute(
      `UPDATE employees SET status = @status, updatedAt = strftime('%s', 'now') WHERE id = @id`,
      { id, status }
    );

    const updatedEmployee = findById(id);
    return { success: true, data: sanitizeEmployee(updatedEmployee) };
  } catch (error) {
    console.error('Error updating employee status:', error.message);
    return { success: false, error: 'Failed to update employee status' };
  }
}

/**
 * Gets employees by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - Employee status
 * @returns {EmployeeData[]} Array of employees
 */
function getByStatus(userId, status) {
  if (!EMPLOYEE_STATUSES.includes(status)) {
    return [];
  }
  const employees = query(
    'SELECT * FROM employees WHERE userId = ? AND status = ? ORDER BY lastName, firstName ASC',
    [userId, status]
  );
  return employees.map(sanitizeEmployee);
}

/**
 * Gets active employees for a user.
 * 
 * @param {number} userId - User ID
 * @returns {EmployeeData[]} Array of active employees
 */
function getActiveEmployees(userId) {
  const employees = query(
    'SELECT * FROM employees WHERE userId = ? AND status = ? ORDER BY lastName, firstName ASC',
    [userId, 'active']
  );
  return employees.map(sanitizeEmployee);
}

/**
 * Gets employee count by status for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM employees 
     WHERE userId = ? 
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of EMPLOYEE_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Searches employees by name.
 * 
 * @param {number} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {EmployeeData[]} Array of matching employees
 */
function searchByName(userId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const term = `%${searchTerm.trim()}%`;
  const employees = query(
    `SELECT * FROM employees 
     WHERE userId = ? AND (firstName LIKE ? OR lastName LIKE ? OR employeeNumber LIKE ?)
     ORDER BY lastName, firstName ASC`,
    [userId, term, term, term]
  );
  return employees.map(sanitizeEmployee);
}

module.exports = {
  // CRUD operations
  createEmployee,
  findById,
  findByEmployeeNumber,
  findByNINumber,
  getEmployeesByUserId,
  updateEmployee,
  deleteEmployee,
  
  // Status operations
  updateStatus,
  getByStatus,
  getActiveEmployees,
  getStatusCounts,
  
  // Search
  searchByName,
  
  // Utilities
  generateEmployeeNumber,
  sanitizeEmployee,
  
  // Validation
  validateEmployeeData,
  validateNINumber,
  validateTaxCode,
  fieldDefinitions,
  
  // Constants
  EMPLOYEE_STATUSES,
  VALID_PAY_FREQUENCIES,
  VALID_STUDENT_LOAN_PLANS,
  NI_NUMBER_REGEX,
  TAX_CODE_REGEX
};
