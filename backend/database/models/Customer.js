/**
 * Customer model for customer record management.
 * Provides CRUD operations and validation for customer data
 * with UK VAT-compliant invoicing support.
 * 
 * @module models/Customer
 */

const validator = require('validator');
const { query, queryOne, execute } = require('../index');
const { VALID_STATUSES } = require('../migrations/014_create_customers_table');

/**
 * Valid customer status values.
 */
const CUSTOMER_STATUSES = VALID_STATUSES;

/**
 * Valid currency codes.
 */
const VALID_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * Regular expression for validating UK/EU VAT numbers.
 * Format: Two letters (country code) followed by alphanumeric characters.
 * - UK: GB followed by 9 or 12 digits
 * - EU: 2 letter code followed by 2-12 alphanumeric characters
 */
const VAT_NUMBER_REGEX = /^[A-Z]{2}[A-Z0-9]{2,12}$/i;

/**
 * Regular expression for validating UK Companies House registration numbers.
 * Format: 8 characters - either 2 letters followed by 6 digits, or 8 digits
 */
const COMPANY_NUMBER_REGEX = /^([A-Z]{2}\d{6}|\d{8})$/i;

/**
 * Regular expression for validating UK postcodes.
 * Covers various UK postcode formats.
 */
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;

/**
 * Validates a UK/EU VAT number.
 * 
 * @param {string} vatNumber - VAT number to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateVatNumber(vatNumber) {
  if (!vatNumber || !vatNumber.trim()) {
    return null; // VAT number is optional
  }
  
  // Remove spaces and convert to uppercase
  const cleanedVat = vatNumber.replace(/\s/g, '').toUpperCase();
  
  if (!VAT_NUMBER_REGEX.test(cleanedVat)) {
    return 'Invalid VAT number format (e.g., GB123456789)';
  }
  
  return null;
}

/**
 * Validates a UK company registration number.
 * 
 * @param {string} companyNumber - Company number to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateCompanyNumber(companyNumber) {
  if (!companyNumber || !companyNumber.trim()) {
    return null; // Company number is optional
  }
  
  // Remove spaces and convert to uppercase
  const cleanedNumber = companyNumber.replace(/\s/g, '').toUpperCase();
  
  if (!COMPANY_NUMBER_REGEX.test(cleanedNumber)) {
    return 'Invalid UK company number format (e.g., 12345678 or AB123456)';
  }
  
  return null;
}

/**
 * Validates a UK postcode.
 * 
 * @param {string} postcode - Postcode to validate
 * @param {string} country - Country code
 * @returns {string|null} Error message if invalid, null if valid
 */
function validatePostcode(postcode, country) {
  if (!postcode || !postcode.trim()) {
    return null; // Postcode is optional
  }
  
  // Only validate format for UK postcodes
  if (country && country.toUpperCase() !== 'GB') {
    return null; // Don't validate non-UK postcodes
  }
  
  const cleanedPostcode = postcode.replace(/\s/g, '').toUpperCase();
  
  if (!UK_POSTCODE_REGEX.test(cleanedPostcode)) {
    return 'Invalid UK postcode format (e.g., SW1A 1AA)';
  }
  
  return null;
}

/**
 * Customer field definitions with validation rules.
 * @typedef {Object} CustomerFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Customer field definitions for validation.
 * @type {Object.<string, CustomerFieldDefinition>}
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
  customerNumber: {
    type: 'string',
    required: true,
    maxLength: 50,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'customerNumber is required';
      }
      // Allow alphanumeric, dashes, and underscores
      if (!/^[A-Za-z0-9\-_]+$/.test(value.trim())) {
        return 'customerNumber can only contain letters, numbers, dashes, and underscores';
      }
      return null;
    }
  },
  name: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (!value || value.trim().length < 2) {
        return 'Customer name must be at least 2 characters long';
      }
      return null;
    }
  },
  tradingName: {
    type: 'string',
    required: false,
    maxLength: 255
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
  phone: {
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
  website: {
    type: 'string',
    required: false,
    maxLength: 255,
    validate: (value) => {
      if (value && value.trim()) {
        if (!validator.isURL(value, { require_protocol: false })) {
          return 'Invalid website URL format';
        }
      }
      return null;
    }
  },
  vatNumber: {
    type: 'string',
    required: false,
    maxLength: 20,
    validate: validateVatNumber
  },
  companyNumber: {
    type: 'string',
    required: false,
    maxLength: 15,
    validate: validateCompanyNumber
  },
  addressLine1: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  addressLine2: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  city: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  county: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  postcode: {
    type: 'string',
    required: false,
    maxLength: 15
    // Postcode validation is done with country context in validateCustomerData
  },
  country: {
    type: 'string',
    required: false,
    default: 'GB',
    maxLength: 2,
    validate: (value) => {
      if (value && value.trim()) {
        if (!/^[A-Z]{2}$/i.test(value.trim())) {
          return 'Country must be a 2-letter ISO code (e.g., GB, US)';
        }
      }
      return null;
    }
  },
  deliveryAddressLine1: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  deliveryAddressLine2: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  deliveryCity: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  deliveryCounty: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  deliveryPostcode: {
    type: 'string',
    required: false,
    maxLength: 15
  },
  deliveryCountry: {
    type: 'string',
    required: false,
    maxLength: 2,
    validate: (value) => {
      if (value && value.trim()) {
        if (!/^[A-Z]{2}$/i.test(value.trim())) {
          return 'Delivery country must be a 2-letter ISO code (e.g., GB, US)';
        }
      }
      return null;
    }
  },
  contactName: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  contactEmail: {
    type: 'string',
    required: false,
    maxLength: 255,
    validate: (value) => {
      if (value && value.trim() && !validator.isEmail(value)) {
        return 'Invalid contact email format';
      }
      return null;
    }
  },
  contactPhone: {
    type: 'string',
    required: false,
    maxLength: 30,
    validate: (value) => {
      if (value && value.trim()) {
        const cleanedPhone = value.replace(/[\s\-()]/g, '');
        if (!/^\+?\d{7,15}$/.test(cleanedPhone)) {
          return 'Invalid contact phone number format';
        }
      }
      return null;
    }
  },
  paymentTerms: {
    type: 'number',
    required: false,
    default: 30,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 365)) {
        return 'paymentTerms must be between 0 and 365 days';
      }
      return null;
    }
  },
  creditLimit: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'creditLimit must be a non-negative integer (in pence)';
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
  status: {
    type: 'string',
    required: false,
    default: 'active',
    validate: (value) => {
      if (value && !CUSTOMER_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${CUSTOMER_STATUSES.join(', ')}`;
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
 * Customer data object
 * @typedef {Object} CustomerData
 * @property {number} [id] - Customer ID (auto-generated)
 * @property {number} userId - User ID who owns this customer record
 * @property {string} customerNumber - Unique customer number
 * @property {string} name - Customer/company name
 * @property {string} [tradingName] - Trading name if different
 * @property {string} [email] - Primary email address
 * @property {string} [phone] - Primary phone number
 * @property {string} [website] - Website URL
 * @property {string} [vatNumber] - VAT registration number
 * @property {string} [companyNumber] - Companies House number
 * @property {string} [addressLine1] - Billing address line 1
 * @property {string} [addressLine2] - Billing address line 2
 * @property {string} [city] - Billing city
 * @property {string} [county] - Billing county
 * @property {string} [postcode] - Billing postcode
 * @property {string} [country] - Billing country code
 * @property {string} [deliveryAddressLine1] - Delivery address line 1
 * @property {string} [deliveryAddressLine2] - Delivery address line 2
 * @property {string} [deliveryCity] - Delivery city
 * @property {string} [deliveryCounty] - Delivery county
 * @property {string} [deliveryPostcode] - Delivery postcode
 * @property {string} [deliveryCountry] - Delivery country code
 * @property {string} [contactName] - Primary contact name
 * @property {string} [contactEmail] - Primary contact email
 * @property {string} [contactPhone] - Primary contact phone
 * @property {number} [paymentTerms] - Default payment terms in days
 * @property {number} [creditLimit] - Credit limit in pence
 * @property {string} [currency] - Preferred currency code
 * @property {string} [status] - Customer status
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
 * Validates customer data against field definitions.
 * 
 * @param {Partial<CustomerData>} customerData - Customer data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateCustomerData(customerData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = customerData[fieldName];

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

  // Cross-field validation: postcode format depends on country
  if (customerData.postcode && !errors.postcode) {
    const country = customerData.country || 'GB';
    const postcodeError = validatePostcode(customerData.postcode, country);
    if (postcodeError) {
      errors.postcode = postcodeError;
    }
  }

  // Cross-field validation: delivery postcode format depends on delivery country
  if (customerData.deliveryPostcode && !errors.deliveryPostcode) {
    const country = customerData.deliveryCountry || 'GB';
    const postcodeError = validatePostcode(customerData.deliveryPostcode, country);
    if (postcodeError) {
      errors.deliveryPostcode = postcodeError;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Generates a new customer number.
 * Format: CUST-NNNN (e.g., CUST-0001)
 * 
 * @param {number} userId - User ID for scoping
 * @returns {string} Generated customer number
 */
function generateCustomerNumber(userId) {
  const prefix = 'CUST-';
  
  // Get the highest customer number for this user
  const result = queryOne(`
    SELECT customerNumber FROM customers 
    WHERE userId = ? AND customerNumber LIKE ?
    ORDER BY customerNumber DESC LIMIT 1
  `, [userId, `${prefix}%`]);
  
  let nextNumber = 1;
  if (result && result.customerNumber) {
    const currentNumber = parseInt(result.customerNumber.split('-')[1], 10);
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1;
    }
  }
  
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Creates a new customer in the database.
 * 
 * @param {CustomerData} customerData - Customer data to create
 * @returns {{success: boolean, data?: CustomerData, errors?: Object.<string, string>}}
 */
function createCustomer(customerData) {
  // Generate customer number if not provided
  if (!customerData.customerNumber && customerData.userId) {
    customerData.customerNumber = generateCustomerNumber(customerData.userId);
  }

  // Validate input data
  const validation = validateCustomerData(customerData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if customer name already exists for this user
  const existingCustomer = findByName(customerData.userId, customerData.name);
  if (existingCustomer) {
    return { success: false, errors: { name: 'Customer name already exists for this user' } };
  }

  try {
    // Prepare the insert data
    const insertData = {
      userId: customerData.userId,
      customerNumber: customerData.customerNumber.trim().toUpperCase(),
      name: customerData.name.trim(),
      tradingName: customerData.tradingName?.trim() || null,
      email: customerData.email?.toLowerCase().trim() || null,
      phone: customerData.phone?.trim() || null,
      website: customerData.website?.trim() || null,
      vatNumber: customerData.vatNumber?.replace(/\s/g, '').toUpperCase() || null,
      companyNumber: customerData.companyNumber?.replace(/\s/g, '').toUpperCase() || null,
      addressLine1: customerData.addressLine1?.trim() || null,
      addressLine2: customerData.addressLine2?.trim() || null,
      city: customerData.city?.trim() || null,
      county: customerData.county?.trim() || null,
      postcode: customerData.postcode?.replace(/\s/g, '').toUpperCase() || null,
      country: (customerData.country || 'GB').toUpperCase(),
      deliveryAddressLine1: customerData.deliveryAddressLine1?.trim() || null,
      deliveryAddressLine2: customerData.deliveryAddressLine2?.trim() || null,
      deliveryCity: customerData.deliveryCity?.trim() || null,
      deliveryCounty: customerData.deliveryCounty?.trim() || null,
      deliveryPostcode: customerData.deliveryPostcode?.replace(/\s/g, '').toUpperCase() || null,
      deliveryCountry: customerData.deliveryCountry?.toUpperCase() || null,
      contactName: customerData.contactName?.trim() || null,
      contactEmail: customerData.contactEmail?.toLowerCase().trim() || null,
      contactPhone: customerData.contactPhone?.trim() || null,
      paymentTerms: customerData.paymentTerms ?? 30,
      creditLimit: customerData.creditLimit ?? 0,
      currency: (customerData.currency || 'GBP').toUpperCase(),
      status: customerData.status || 'active',
      notes: customerData.notes?.trim() || null
    };

    const result = execute(`
      INSERT INTO customers (
        userId, customerNumber, name, tradingName, email,
        phone, website, vatNumber, companyNumber,
        addressLine1, addressLine2, city, county, postcode, country,
        deliveryAddressLine1, deliveryAddressLine2, deliveryCity, deliveryCounty, deliveryPostcode, deliveryCountry,
        contactName, contactEmail, contactPhone,
        paymentTerms, creditLimit, currency, status, notes
      ) VALUES (
        @userId, @customerNumber, @name, @tradingName, @email,
        @phone, @website, @vatNumber, @companyNumber,
        @addressLine1, @addressLine2, @city, @county, @postcode, @country,
        @deliveryAddressLine1, @deliveryAddressLine2, @deliveryCity, @deliveryCounty, @deliveryPostcode, @deliveryCountry,
        @contactName, @contactEmail, @contactPhone,
        @paymentTerms, @creditLimit, @currency, @status, @notes
      )
    `, insertData);

    // Fetch the created customer
    const createdCustomer = findById(result.lastInsertRowid);
    return { success: true, data: createdCustomer };

  } catch (error) {
    console.error('Error creating customer:', error.message);
    return { success: false, errors: { general: 'Failed to create customer' } };
  }
}

/**
 * Finds a customer by ID.
 * 
 * @param {number} id - Customer ID
 * @returns {CustomerData|null} Customer data or null if not found
 */
function findById(id) {
  const customer = queryOne('SELECT * FROM customers WHERE id = ?', [id]);
  return customer || null;
}

/**
 * Finds a customer by name for a specific user.
 * 
 * @param {number} userId - User ID
 * @param {string} name - Customer name
 * @returns {CustomerData|null} Customer data or null if not found
 */
function findByName(userId, name) {
  if (!name) return null;
  const customer = queryOne(
    'SELECT * FROM customers WHERE userId = ? AND name = ?',
    [userId, name.trim()]
  );
  return customer || null;
}

/**
 * Finds a customer by customer number for a specific user.
 * 
 * @param {number} userId - User ID
 * @param {string} customerNumber - Customer number
 * @returns {CustomerData|null} Customer data or null if not found
 */
function findByCustomerNumber(userId, customerNumber) {
  if (!customerNumber) return null;
  const customer = queryOne(
    'SELECT * FROM customers WHERE userId = ? AND customerNumber = ?',
    [userId, customerNumber.trim().toUpperCase()]
  );
  return customer || null;
}

/**
 * Finds a customer by VAT number.
 * 
 * @param {string} vatNumber - VAT registration number
 * @returns {CustomerData|null} Customer data or null if not found
 */
function findByVatNumber(vatNumber) {
  if (!vatNumber) return null;
  const cleanedVat = vatNumber.replace(/\s/g, '').toUpperCase();
  const customer = queryOne(
    'SELECT * FROM customers WHERE vatNumber = ?',
    [cleanedVat]
  );
  return customer || null;
}

/**
 * Finds a customer by email address for a specific user.
 * 
 * @param {number} userId - User ID
 * @param {string} email - Email address
 * @returns {CustomerData|null} Customer data or null if not found
 */
function findByEmail(userId, email) {
  if (!email) return null;
  const customer = queryOne(
    'SELECT * FROM customers WHERE userId = ? AND email = ?',
    [userId, email.toLowerCase().trim()]
  );
  return customer || null;
}

/**
 * Gets all customers for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.sortBy='name'] - Sort field
 * @param {string} [options.sortOrder='ASC'] - Sort order
 * @returns {{customers: CustomerData[], total: number, page: number, limit: number}}
 */
function getCustomersByUserId(userId, { page = 1, limit = 10, status, sortBy = 'name', sortOrder = 'ASC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['name', 'customerNumber', 'email', 'city', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (status && CUSTOMER_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  const customers = query(
    `SELECT * FROM customers ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM customers ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    customers,
    total,
    page,
    limit
  };
}

/**
 * Updates a customer's data.
 * 
 * @param {number} id - Customer ID
 * @param {Partial<CustomerData>} customerData - Data to update
 * @returns {{success: boolean, data?: CustomerData, errors?: Object.<string, string>}}
 */
function updateCustomer(id, customerData) {
  // Validate input data
  const validation = validateCustomerData(customerData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if customer exists
  const existingCustomer = findById(id);
  if (!existingCustomer) {
    return { success: false, errors: { general: 'Customer not found' } };
  }

  // Check if name is being changed and is already taken
  if (customerData.name && 
      customerData.name.trim() !== existingCustomer.name) {
    const nameCustomer = findByName(existingCustomer.userId, customerData.name);
    if (nameCustomer) {
      return { success: false, errors: { name: 'Customer name already exists for this user' } };
    }
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (customerData.customerNumber !== undefined) {
      updateFields.push('customerNumber = @customerNumber');
      updateParams.customerNumber = customerData.customerNumber.trim().toUpperCase();
    }

    if (customerData.name !== undefined) {
      updateFields.push('name = @name');
      updateParams.name = customerData.name.trim();
    }

    if (customerData.tradingName !== undefined) {
      updateFields.push('tradingName = @tradingName');
      updateParams.tradingName = customerData.tradingName?.trim() || null;
    }

    if (customerData.email !== undefined) {
      updateFields.push('email = @email');
      updateParams.email = customerData.email?.toLowerCase().trim() || null;
    }

    if (customerData.phone !== undefined) {
      updateFields.push('phone = @phone');
      updateParams.phone = customerData.phone?.trim() || null;
    }

    if (customerData.website !== undefined) {
      updateFields.push('website = @website');
      updateParams.website = customerData.website?.trim() || null;
    }

    if (customerData.vatNumber !== undefined) {
      updateFields.push('vatNumber = @vatNumber');
      updateParams.vatNumber = customerData.vatNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (customerData.companyNumber !== undefined) {
      updateFields.push('companyNumber = @companyNumber');
      updateParams.companyNumber = customerData.companyNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (customerData.addressLine1 !== undefined) {
      updateFields.push('addressLine1 = @addressLine1');
      updateParams.addressLine1 = customerData.addressLine1?.trim() || null;
    }

    if (customerData.addressLine2 !== undefined) {
      updateFields.push('addressLine2 = @addressLine2');
      updateParams.addressLine2 = customerData.addressLine2?.trim() || null;
    }

    if (customerData.city !== undefined) {
      updateFields.push('city = @city');
      updateParams.city = customerData.city?.trim() || null;
    }

    if (customerData.county !== undefined) {
      updateFields.push('county = @county');
      updateParams.county = customerData.county?.trim() || null;
    }

    if (customerData.postcode !== undefined) {
      updateFields.push('postcode = @postcode');
      updateParams.postcode = customerData.postcode?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (customerData.country !== undefined) {
      updateFields.push('country = @country');
      updateParams.country = customerData.country?.toUpperCase() || 'GB';
    }

    if (customerData.deliveryAddressLine1 !== undefined) {
      updateFields.push('deliveryAddressLine1 = @deliveryAddressLine1');
      updateParams.deliveryAddressLine1 = customerData.deliveryAddressLine1?.trim() || null;
    }

    if (customerData.deliveryAddressLine2 !== undefined) {
      updateFields.push('deliveryAddressLine2 = @deliveryAddressLine2');
      updateParams.deliveryAddressLine2 = customerData.deliveryAddressLine2?.trim() || null;
    }

    if (customerData.deliveryCity !== undefined) {
      updateFields.push('deliveryCity = @deliveryCity');
      updateParams.deliveryCity = customerData.deliveryCity?.trim() || null;
    }

    if (customerData.deliveryCounty !== undefined) {
      updateFields.push('deliveryCounty = @deliveryCounty');
      updateParams.deliveryCounty = customerData.deliveryCounty?.trim() || null;
    }

    if (customerData.deliveryPostcode !== undefined) {
      updateFields.push('deliveryPostcode = @deliveryPostcode');
      updateParams.deliveryPostcode = customerData.deliveryPostcode?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (customerData.deliveryCountry !== undefined) {
      updateFields.push('deliveryCountry = @deliveryCountry');
      updateParams.deliveryCountry = customerData.deliveryCountry?.toUpperCase() || null;
    }

    if (customerData.contactName !== undefined) {
      updateFields.push('contactName = @contactName');
      updateParams.contactName = customerData.contactName?.trim() || null;
    }

    if (customerData.contactEmail !== undefined) {
      updateFields.push('contactEmail = @contactEmail');
      updateParams.contactEmail = customerData.contactEmail?.toLowerCase().trim() || null;
    }

    if (customerData.contactPhone !== undefined) {
      updateFields.push('contactPhone = @contactPhone');
      updateParams.contactPhone = customerData.contactPhone?.trim() || null;
    }

    if (customerData.paymentTerms !== undefined) {
      updateFields.push('paymentTerms = @paymentTerms');
      updateParams.paymentTerms = customerData.paymentTerms;
    }

    if (customerData.creditLimit !== undefined) {
      updateFields.push('creditLimit = @creditLimit');
      updateParams.creditLimit = customerData.creditLimit;
    }

    if (customerData.currency !== undefined) {
      updateFields.push('currency = @currency');
      updateParams.currency = customerData.currency.toUpperCase();
    }

    if (customerData.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = customerData.status;
    }

    if (customerData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = customerData.notes?.trim() || null;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = datetime('now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: existingCustomer };
    }

    execute(
      `UPDATE customers SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated customer
    const updatedCustomer = findById(id);
    return { success: true, data: updatedCustomer };

  } catch (error) {
    console.error('Error updating customer:', error.message);
    return { success: false, errors: { general: 'Failed to update customer' } };
  }
}

/**
 * Deletes a customer by ID.
 * 
 * @param {number} id - Customer ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteCustomer(id) {
  const existingCustomer = findById(id);
  if (!existingCustomer) {
    return { success: false, error: 'Customer not found' };
  }

  try {
    execute('DELETE FROM customers WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer:', error.message);
    return { success: false, error: 'Failed to delete customer' };
  }
}

/**
 * Updates customer status.
 * 
 * @param {number} id - Customer ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: CustomerData, error?: string}}
 */
function updateStatus(id, status) {
  if (!CUSTOMER_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${CUSTOMER_STATUSES.join(', ')}` };
  }

  const existingCustomer = findById(id);
  if (!existingCustomer) {
    return { success: false, error: 'Customer not found' };
  }

  try {
    execute(
      `UPDATE customers SET status = @status, updatedAt = datetime('now') WHERE id = @id`,
      { id, status }
    );

    const updatedCustomer = findById(id);
    return { success: true, data: updatedCustomer };
  } catch (error) {
    console.error('Error updating customer status:', error.message);
    return { success: false, error: 'Failed to update customer status' };
  }
}

/**
 * Gets customers by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - Customer status
 * @returns {CustomerData[]} Array of customers
 */
function getByStatus(userId, status) {
  if (!CUSTOMER_STATUSES.includes(status)) {
    return [];
  }
  return query(
    'SELECT * FROM customers WHERE userId = ? AND status = ? ORDER BY name ASC',
    [userId, status]
  );
}

/**
 * Gets active customers for a user.
 * 
 * @param {number} userId - User ID
 * @returns {CustomerData[]} Array of active customers
 */
function getActiveCustomers(userId) {
  return query(
    'SELECT * FROM customers WHERE userId = ? AND status = ? ORDER BY name ASC',
    [userId, 'active']
  );
}

/**
 * Gets customer count by status for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM customers 
     WHERE userId = ? 
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of CUSTOMER_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

/**
 * Searches customers by name or email.
 * 
 * @param {number} userId - User ID
 * @param {string} searchTerm - Search term
 * @returns {CustomerData[]} Array of matching customers
 */
function searchByName(userId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const term = `%${searchTerm.trim()}%`;
  return query(
    `SELECT * FROM customers 
     WHERE userId = ? AND (name LIKE ? OR tradingName LIKE ? OR email LIKE ? OR customerNumber LIKE ?)
     ORDER BY name ASC`,
    [userId, term, term, term, term]
  );
}

/**
 * Gets customers with VAT numbers (B2B customers).
 * 
 * @param {number} userId - User ID
 * @returns {CustomerData[]} Array of B2B customers
 */
function getB2BCustomers(userId) {
  return query(
    `SELECT * FROM customers 
     WHERE userId = ? AND vatNumber IS NOT NULL AND vatNumber != ''
     ORDER BY name ASC`,
    [userId]
  );
}

/**
 * Formats customer address for invoicing.
 * 
 * @param {CustomerData} customer - Customer data
 * @param {boolean} [useDeliveryAddress=false] - Whether to use delivery address
 * @returns {string} Formatted address
 */
function formatAddress(customer, useDeliveryAddress = false) {
  if (!customer) return '';
  
  const parts = useDeliveryAddress ? [
    customer.deliveryAddressLine1,
    customer.deliveryAddressLine2,
    customer.deliveryCity,
    customer.deliveryCounty,
    customer.deliveryPostcode,
    customer.deliveryCountry
  ] : [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.county,
    customer.postcode,
    customer.country
  ];
  
  return parts.filter(Boolean).join(', ');
}

module.exports = {
  // CRUD operations
  createCustomer,
  findById,
  findByName,
  findByCustomerNumber,
  findByVatNumber,
  findByEmail,
  getCustomersByUserId,
  updateCustomer,
  deleteCustomer,
  
  // Status operations
  updateStatus,
  getByStatus,
  getActiveCustomers,
  getStatusCounts,
  
  // Search
  searchByName,
  getB2BCustomers,
  
  // Utilities
  generateCustomerNumber,
  formatAddress,
  
  // Validation
  validateCustomerData,
  validateVatNumber,
  validateCompanyNumber,
  validatePostcode,
  fieldDefinitions,
  
  // Constants
  CUSTOMER_STATUSES,
  VALID_CURRENCIES,
  VAT_NUMBER_REGEX,
  COMPANY_NUMBER_REGEX,
  UK_POSTCODE_REGEX
};
