/**
 * Supplier model for supplier record management.
 * Provides CRUD operations and validation for supplier data.
 * 
 * @module models/Supplier
 */

const validator = require('validator');
const { query, queryOne, execute } = require('../index');
const { VALID_STATUSES, VALID_PAYMENT_TERMS } = require('../migrations/015_create_suppliers_table');

/**
 * Valid supplier status values.
 */
const SUPPLIER_STATUSES = VALID_STATUSES;

/**
 * Valid payment terms values.
 */
const SUPPLIER_PAYMENT_TERMS = VALID_PAYMENT_TERMS;

/**
 * Valid currency codes.
 */
const VALID_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * Regular expression for validating UK VAT numbers.
 * Format: GB followed by 9 digits, or GB followed by 12 digits (branch traders)
 * Also supports numbers without GB prefix for validation convenience
 */
const UK_VAT_REGEX = /^(GB)?(\d{9}|\d{12})$/i;

/**
 * Regular expression for validating UK postcodes.
 */
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/**
 * Regular expression for validating Companies House numbers.
 * Format: 8 characters (letters and/or digits)
 */
const COMPANY_NUMBER_REGEX = /^[A-Z0-9]{8}$/i;

/**
 * Validates a UK VAT number.
 * 
 * @param {string} vatNumber - VAT number to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateVATNumber(vatNumber) {
  if (!vatNumber || !vatNumber.trim()) {
    return null; // VAT number is optional
  }
  
  // Remove spaces and convert to uppercase
  const cleanedVAT = vatNumber.replace(/\s/g, '').toUpperCase();
  
  if (!UK_VAT_REGEX.test(cleanedVAT)) {
    return 'Invalid UK VAT number format (e.g., GB123456789)';
  }
  
  return null;
}

/**
 * Validates a UK postcode.
 * 
 * @param {string} postcode - Postcode to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validatePostcode(postcode) {
  if (!postcode || !postcode.trim()) {
    return null; // Postcode is optional
  }
  
  const cleanedPostcode = postcode.trim().toUpperCase();
  
  if (!UK_POSTCODE_REGEX.test(cleanedPostcode)) {
    return 'Invalid UK postcode format (e.g., SW1A 1AA)';
  }
  
  return null;
}

/**
 * Validates a Companies House number.
 * 
 * @param {string} companyNumber - Company number to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateCompanyNumber(companyNumber) {
  if (!companyNumber || !companyNumber.trim()) {
    return null; // Company number is optional
  }
  
  const cleanedNumber = companyNumber.replace(/\s/g, '').toUpperCase();
  
  if (!COMPANY_NUMBER_REGEX.test(cleanedNumber)) {
    return 'Invalid Companies House number format (must be 8 characters)';
  }
  
  return null;
}

/**
 * Supplier field definitions with validation rules.
 * @typedef {Object} SupplierFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Supplier field definitions for validation.
 * @type {Object.<string, SupplierFieldDefinition>}
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
  name: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (!value || value.trim().length < 1) {
        return 'Supplier name is required';
      }
      return null;
    }
  },
  contactName: {
    type: 'string',
    required: false,
    maxLength: 200
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
  address: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  city: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  postcode: {
    type: 'string',
    required: false,
    maxLength: 15,
    validate: validatePostcode
  },
  country: {
    type: 'string',
    required: false,
    default: 'United Kingdom',
    maxLength: 100
  },
  vatNumber: {
    type: 'string',
    required: false,
    maxLength: 20,
    validate: validateVATNumber
  },
  isVatRegistered: {
    type: 'boolean',
    required: false,
    default: false
  },
  companyNumber: {
    type: 'string',
    required: false,
    maxLength: 15,
    validate: validateCompanyNumber
  },
  paymentTerms: {
    type: 'string',
    required: false,
    default: 'net30',
    validate: (value) => {
      if (value && !SUPPLIER_PAYMENT_TERMS.includes(value)) {
        return `Invalid paymentTerms. Must be one of: ${SUPPLIER_PAYMENT_TERMS.join(', ')}`;
      }
      return null;
    }
  },
  paymentTermsDays: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== undefined && value !== null) {
        if (!Number.isInteger(value) || value < 0 || value > 365) {
          return 'paymentTermsDays must be an integer between 0 and 365';
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
      if (value && !VALID_CURRENCIES.includes(value.toUpperCase())) {
        return `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}`;
      }
      return null;
    }
  },
  bankAccountName: {
    type: 'string',
    required: false,
    maxLength: 100
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
  iban: {
    type: 'string',
    required: false,
    maxLength: 34,
    validate: (value) => {
      if (value && value.trim()) {
        // Basic IBAN validation (2 letters + 2 digits + up to 30 alphanumeric)
        const cleanedIban = value.replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleanedIban)) {
          return 'Invalid IBAN format';
        }
      }
      return null;
    }
  },
  swift: {
    type: 'string',
    required: false,
    maxLength: 11,
    validate: (value) => {
      if (value && value.trim()) {
        // SWIFT/BIC code: 8 or 11 characters
        const cleanedSwift = value.replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleanedSwift)) {
          return 'Invalid SWIFT/BIC code format (8 or 11 characters)';
        }
      }
      return null;
    }
  },
  defaultExpenseCategory: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  status: {
    type: 'string',
    required: false,
    default: 'active',
    validate: (value) => {
      if (value && !SUPPLIER_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${SUPPLIER_STATUSES.join(', ')}`;
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
 * Supplier data object
 * @typedef {Object} SupplierData
 * @property {number} [id] - Supplier ID (auto-generated)
 * @property {number} userId - User ID who owns this supplier record
 * @property {string} name - Supplier company/business name
 * @property {string} [contactName] - Primary contact person name
 * @property {string} [email] - Email address
 * @property {string} [phoneNumber] - Contact phone
 * @property {string} [address] - Supplier address
 * @property {string} [city] - City
 * @property {string} [postcode] - UK postcode
 * @property {string} [country] - Country
 * @property {string} [vatNumber] - VAT registration number
 * @property {boolean} [isVatRegistered] - Whether supplier is VAT registered
 * @property {string} [companyNumber] - Companies House registration number
 * @property {string} [paymentTerms] - Default payment terms
 * @property {number} [paymentTermsDays] - Custom payment terms days
 * @property {string} [currency] - Currency code
 * @property {string} [bankAccountName] - Bank account name
 * @property {string} [bankAccountNumber] - Bank account number
 * @property {string} [bankSortCode] - Bank sort code
 * @property {string} [iban] - International Bank Account Number
 * @property {string} [swift] - SWIFT/BIC code
 * @property {string} [defaultExpenseCategory] - Default expense category
 * @property {string} [status] - Supplier status
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
 * Validates supplier data against field definitions.
 * 
 * @param {Partial<SupplierData>} supplierData - Supplier data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateSupplierData(supplierData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = supplierData[fieldName];

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

  // Cross-field validation: if paymentTerms is 'custom', paymentTermsDays should be set
  if (supplierData.paymentTerms === 'custom' && 
      (supplierData.paymentTermsDays === undefined || supplierData.paymentTermsDays === null)) {
    errors.paymentTermsDays = 'paymentTermsDays is required when paymentTerms is "custom"';
  }

  // Cross-field validation: if VAT number is provided, isVatRegistered should be true
  if (supplierData.vatNumber && supplierData.vatNumber.trim() && supplierData.isVatRegistered === false) {
    errors.isVatRegistered = 'isVatRegistered should be true when VAT number is provided';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Sanitizes supplier data for output.
 * Converts SQLite integers to booleans where appropriate.
 * 
 * @param {SupplierData} supplier - Supplier data object
 * @returns {SupplierData} Sanitized supplier data
 */
function sanitizeSupplier(supplier) {
  if (!supplier) return null;

  const sanitized = { ...supplier };
  
  // Convert SQLite integer to boolean for isVatRegistered
  if (sanitized.isVatRegistered !== undefined) {
    sanitized.isVatRegistered = Boolean(sanitized.isVatRegistered);
  }
  
  return sanitized;
}

/**
 * Normalizes a VAT number to standard format.
 * 
 * @param {string} vatNumber - VAT number to normalize
 * @returns {string|null} Normalized VAT number or null
 */
function normalizeVATNumber(vatNumber) {
  if (!vatNumber || !vatNumber.trim()) {
    return null;
  }
  
  // Remove spaces and convert to uppercase
  let cleaned = vatNumber.replace(/\s/g, '').toUpperCase();
  
  // Add GB prefix if not present and it's a valid UK VAT number
  if (/^\d{9}$/.test(cleaned) || /^\d{12}$/.test(cleaned)) {
    cleaned = 'GB' + cleaned;
  }
  
  return cleaned;
}

/**
 * Creates a new supplier in the database.
 * 
 * @param {SupplierData} supplierData - Supplier data to create
 * @returns {{success: boolean, data?: SupplierData, errors?: Object.<string, string>}}
 */
function createSupplier(supplierData) {
  // Validate input data
  const validation = validateSupplierData(supplierData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if supplier name already exists for this user
  const existingSupplier = findByName(supplierData.userId, supplierData.name);
  if (existingSupplier) {
    return { success: false, errors: { name: 'A supplier with this name already exists' } };
  }

  try {
    // Prepare the insert data
    const insertData = {
      userId: supplierData.userId,
      name: supplierData.name.trim(),
      contactName: supplierData.contactName?.trim() || null,
      email: supplierData.email?.toLowerCase().trim() || null,
      phoneNumber: supplierData.phoneNumber?.trim() || null,
      address: supplierData.address?.trim() || null,
      city: supplierData.city?.trim() || null,
      postcode: supplierData.postcode?.toUpperCase().trim() || null,
      country: supplierData.country?.trim() || 'United Kingdom',
      vatNumber: normalizeVATNumber(supplierData.vatNumber),
      isVatRegistered: supplierData.isVatRegistered ? 1 : 0,
      companyNumber: supplierData.companyNumber?.replace(/\s/g, '').toUpperCase() || null,
      paymentTerms: supplierData.paymentTerms || 'net30',
      paymentTermsDays: supplierData.paymentTermsDays ?? null,
      currency: (supplierData.currency || 'GBP').toUpperCase(),
      bankAccountName: supplierData.bankAccountName?.trim() || null,
      bankAccountNumber: supplierData.bankAccountNumber?.replace(/[\s\-]/g, '') || null,
      bankSortCode: supplierData.bankSortCode?.replace(/[\s\-]/g, '') || null,
      iban: supplierData.iban?.replace(/\s/g, '').toUpperCase() || null,
      swift: supplierData.swift?.replace(/\s/g, '').toUpperCase() || null,
      defaultExpenseCategory: supplierData.defaultExpenseCategory?.trim() || null,
      status: supplierData.status || 'active',
      notes: supplierData.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO suppliers (
        userId, name, contactName, email, phoneNumber,
        address, city, postcode, country, vatNumber,
        isVatRegistered, companyNumber, paymentTerms, paymentTermsDays, currency,
        bankAccountName, bankAccountNumber, bankSortCode, iban, swift,
        defaultExpenseCategory, status, notes
      ) VALUES (
        @userId, @name, @contactName, @email, @phoneNumber,
        @address, @city, @postcode, @country, @vatNumber,
        @isVatRegistered, @companyNumber, @paymentTerms, @paymentTermsDays, @currency,
        @bankAccountName, @bankAccountNumber, @bankSortCode, @iban, @swift,
        @defaultExpenseCategory, @status, @notes
      )
    `, insertData);

    // Fetch the created supplier
    const createdSupplier = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeSupplier(createdSupplier) };

  } catch (error) {
    console.error('Error creating supplier:', error.message);
    return { success: false, errors: { general: 'Failed to create supplier' } };
  }
}

/**
 * Finds a supplier by ID.
 * 
 * @param {number} id - Supplier ID
 * @returns {SupplierData|null} Supplier data or null if not found
 */
function findById(id) {
  const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
  return supplier || null;
}

/**
 * Finds a supplier by name for a specific user.
 * 
 * @param {number} userId - User ID
 * @param {string} name - Supplier name
 * @returns {SupplierData|null} Supplier data or null if not found
 */
function findByName(userId, name) {
  if (!name) return null;
  const supplier = queryOne(
    'SELECT * FROM suppliers WHERE userId = ? AND LOWER(name) = LOWER(?)',
    [userId, name.trim()]
  );
  return supplier || null;
}

/**
 * Finds a supplier by VAT number.
 * 
 * @param {string} vatNumber - VAT number
 * @returns {SupplierData|null} Supplier data or null if not found
 */
function findByVATNumber(vatNumber) {
  if (!vatNumber) return null;
  const normalizedVAT = normalizeVATNumber(vatNumber);
  const supplier = queryOne(
    'SELECT * FROM suppliers WHERE vatNumber = ?',
    [normalizedVAT]
  );
  return supplier || null;
}

/**
 * Finds a supplier by company number.
 * 
 * @param {string} companyNumber - Company number
 * @returns {SupplierData|null} Supplier data or null if not found
 */
function findByCompanyNumber(companyNumber) {
  if (!companyNumber) return null;
  const cleanedNumber = companyNumber.replace(/\s/g, '').toUpperCase();
  const supplier = queryOne(
    'SELECT * FROM suppliers WHERE companyNumber = ?',
    [cleanedNumber]
  );
  return supplier || null;
}

/**
 * Gets all suppliers for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.sortBy='name'] - Sort field
 * @param {string} [options.sortOrder='ASC'] - Sort order
 * @returns {{suppliers: SupplierData[], total: number, page: number, limit: number}}
 */
function getSuppliersByUserId(userId, { page = 1, limit = 10, status, sortBy = 'name', sortOrder = 'ASC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['name', 'contactName', 'city', 'status', 'createdAt', 'paymentTerms'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (status && SUPPLIER_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  const suppliers = query(
    `SELECT * FROM suppliers ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM suppliers ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    suppliers: suppliers.map(sanitizeSupplier),
    total,
    page,
    limit
  };
}

/**
 * Updates a supplier's data.
 * 
 * @param {number} id - Supplier ID
 * @param {Partial<SupplierData>} supplierData - Data to update
 * @returns {{success: boolean, data?: SupplierData, errors?: Object.<string, string>}}
 */
function updateSupplier(id, supplierData) {
  // Validate input data
  const validation = validateSupplierData(supplierData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if supplier exists
  const existingSupplier = findById(id);
  if (!existingSupplier) {
    return { success: false, errors: { general: 'Supplier not found' } };
  }

  // Check if name is being changed and is already taken
  if (supplierData.name && 
      supplierData.name.trim().toLowerCase() !== existingSupplier.name.toLowerCase()) {
    const nameSupplier = findByName(existingSupplier.userId, supplierData.name);
    if (nameSupplier) {
      return { success: false, errors: { name: 'A supplier with this name already exists' } };
    }
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (supplierData.name !== undefined) {
      updateFields.push('name = @name');
      updateParams.name = supplierData.name.trim();
    }

    if (supplierData.contactName !== undefined) {
      updateFields.push('contactName = @contactName');
      updateParams.contactName = supplierData.contactName?.trim() || null;
    }

    if (supplierData.email !== undefined) {
      updateFields.push('email = @email');
      updateParams.email = supplierData.email?.toLowerCase().trim() || null;
    }

    if (supplierData.phoneNumber !== undefined) {
      updateFields.push('phoneNumber = @phoneNumber');
      updateParams.phoneNumber = supplierData.phoneNumber?.trim() || null;
    }

    if (supplierData.address !== undefined) {
      updateFields.push('address = @address');
      updateParams.address = supplierData.address?.trim() || null;
    }

    if (supplierData.city !== undefined) {
      updateFields.push('city = @city');
      updateParams.city = supplierData.city?.trim() || null;
    }

    if (supplierData.postcode !== undefined) {
      updateFields.push('postcode = @postcode');
      updateParams.postcode = supplierData.postcode?.toUpperCase().trim() || null;
    }

    if (supplierData.country !== undefined) {
      updateFields.push('country = @country');
      updateParams.country = supplierData.country?.trim() || 'United Kingdom';
    }

    if (supplierData.vatNumber !== undefined) {
      updateFields.push('vatNumber = @vatNumber');
      updateParams.vatNumber = normalizeVATNumber(supplierData.vatNumber);
    }

    if (supplierData.isVatRegistered !== undefined) {
      updateFields.push('isVatRegistered = @isVatRegistered');
      updateParams.isVatRegistered = supplierData.isVatRegistered ? 1 : 0;
    }

    if (supplierData.companyNumber !== undefined) {
      updateFields.push('companyNumber = @companyNumber');
      updateParams.companyNumber = supplierData.companyNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (supplierData.paymentTerms !== undefined) {
      updateFields.push('paymentTerms = @paymentTerms');
      updateParams.paymentTerms = supplierData.paymentTerms;
    }

    if (supplierData.paymentTermsDays !== undefined) {
      updateFields.push('paymentTermsDays = @paymentTermsDays');
      updateParams.paymentTermsDays = supplierData.paymentTermsDays ?? null;
    }

    if (supplierData.currency !== undefined) {
      updateFields.push('currency = @currency');
      updateParams.currency = (supplierData.currency || 'GBP').toUpperCase();
    }

    if (supplierData.bankAccountName !== undefined) {
      updateFields.push('bankAccountName = @bankAccountName');
      updateParams.bankAccountName = supplierData.bankAccountName?.trim() || null;
    }

    if (supplierData.bankAccountNumber !== undefined) {
      updateFields.push('bankAccountNumber = @bankAccountNumber');
      updateParams.bankAccountNumber = supplierData.bankAccountNumber?.replace(/[\s\-]/g, '') || null;
    }

    if (supplierData.bankSortCode !== undefined) {
      updateFields.push('bankSortCode = @bankSortCode');
      updateParams.bankSortCode = supplierData.bankSortCode?.replace(/[\s\-]/g, '') || null;
    }

    if (supplierData.iban !== undefined) {
      updateFields.push('iban = @iban');
      updateParams.iban = supplierData.iban?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (supplierData.swift !== undefined) {
      updateFields.push('swift = @swift');
      updateParams.swift = supplierData.swift?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (supplierData.defaultExpenseCategory !== undefined) {
      updateFields.push('defaultExpenseCategory = @defaultExpenseCategory');
      updateParams.defaultExpenseCategory = supplierData.defaultExpenseCategory?.trim() || null;
    }

    if (supplierData.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = supplierData.status;
    }

    if (supplierData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = supplierData.notes?.trim() || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeSupplier(existingSupplier) };
    }

    execute(
      `UPDATE suppliers SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated supplier
    const updatedSupplier = findById(id);
    return { success: true, data: sanitizeSupplier(updatedSupplier) };

  } catch (error) {
    console.error('Error updating supplier:', error.message);
    return { success: false, errors: { general: 'Failed to update supplier' } };
  }
}

/**
 * Deletes a supplier by ID.
 * 
 * @param {number} id - Supplier ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteSupplier(id) {
  const existingSupplier = findById(id);
  if (!existingSupplier) {
    return { success: false, error: 'Supplier not found' };
  }

  try {
    execute('DELETE FROM suppliers WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting supplier:', error.message);
    return { success: false, error: 'Failed to delete supplier' };
  }
}

/**
 * Updates supplier status.
 * 
 * @param {number} id - Supplier ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: SupplierData, error?: string}}
 */
function updateStatus(id, status) {
  if (!SUPPLIER_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${SUPPLIER_STATUSES.join(', ')}` };
  }

  const existingSupplier = findById(id);
  if (!existingSupplier) {
    return { success: false, error: 'Supplier not found' };
  }

  try {
    execute(
      `UPDATE suppliers SET status = @status, updatedAt = strftime('%s', 'now') WHERE id = @id`,
      { id, status }
    );

    const updatedSupplier = findById(id);
    return { success: true, data: sanitizeSupplier(updatedSupplier) };
  } catch (error) {
    console.error('Error updating supplier status:', error.message);
    return { success: false, error: 'Failed to update supplier status' };
  }
}

/**
 * Gets suppliers by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - Supplier status
 * @returns {SupplierData[]} Array of suppliers
 */
function getByStatus(userId, status) {
  if (!SUPPLIER_STATUSES.includes(status)) {
    return [];
  }
  const suppliers = query(
    'SELECT * FROM suppliers WHERE userId = ? AND status = ? ORDER BY name ASC',
    [userId, status]
  );
  return suppliers.map(sanitizeSupplier);
}

/**
 * Gets active suppliers for a user.
 * 
 * @param {number} userId - User ID
 * @returns {SupplierData[]} Array of active suppliers
 */
function getActiveSuppliers(userId) {
  const suppliers = query(
    'SELECT * FROM suppliers WHERE userId = ? AND status = ? ORDER BY name ASC',
    [userId, 'active']
  );
  return suppliers.map(sanitizeSupplier);
}

/**
 * Gets supplier count by status for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM suppliers 
     WHERE userId = ? 
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of SUPPLIER_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Searches suppliers by name.
 * 
 * @param {number} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {SupplierData[]} Array of matching suppliers
 */
function searchByName(userId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const term = `%${searchTerm.trim()}%`;
  const suppliers = query(
    `SELECT * FROM suppliers 
     WHERE userId = ? AND (name LIKE ? OR contactName LIKE ? OR city LIKE ?)
     ORDER BY name ASC`,
    [userId, term, term, term]
  );
  return suppliers.map(sanitizeSupplier);
}

/**
 * Gets VAT registered suppliers for a user.
 * 
 * @param {number} userId - User ID
 * @returns {SupplierData[]} Array of VAT registered suppliers
 */
function getVatRegisteredSuppliers(userId) {
  const suppliers = query(
    'SELECT * FROM suppliers WHERE userId = ? AND isVatRegistered = 1 ORDER BY name ASC',
    [userId]
  );
  return suppliers.map(sanitizeSupplier);
}

module.exports = {
  // CRUD operations
  createSupplier,
  findById,
  findByName,
  findByVATNumber,
  findByCompanyNumber,
  getSuppliersByUserId,
  updateSupplier,
  deleteSupplier,
  
  // Status operations
  updateStatus,
  getByStatus,
  getActiveSuppliers,
  getStatusCounts,
  
  // Search
  searchByName,
  
  // Special queries
  getVatRegisteredSuppliers,
  
  // Utilities
  sanitizeSupplier,
  normalizeVATNumber,
  
  // Validation
  validateSupplierData,
  validateVATNumber,
  validatePostcode,
  validateCompanyNumber,
  fieldDefinitions,
  
  // Constants
  SUPPLIER_STATUSES,
  SUPPLIER_PAYMENT_TERMS,
  VALID_CURRENCIES,
  UK_VAT_REGEX,
  UK_POSTCODE_REGEX,
  COMPANY_NUMBER_REGEX
};
