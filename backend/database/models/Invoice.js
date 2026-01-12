/**
 * Invoice model for invoice management with UK VAT compliance.
 * Provides CRUD operations and validation for invoice data.
 * 
 * @module models/Invoice
 */

const validator = require('validator');
const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { VALID_STATUSES } = require('../migrations/005_create_invoices_table');

/**
 * Valid invoice status values.
 */
const INVOICE_STATUSES = VALID_STATUSES;

/**
 * Valid currency codes.
 */
const VALID_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * Invoice field definitions with validation rules.
 * @typedef {Object} InvoiceFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Invoice field definitions for validation.
 * @type {Object.<string, InvoiceFieldDefinition>}
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
  invoiceNumber: {
    type: 'string',
    required: true,
    maxLength: 50,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'invoiceNumber is required';
      }
      // Allow alphanumeric, dashes, and underscores
      if (!/^[A-Za-z0-9\-_]+$/.test(value.trim())) {
        return 'invoiceNumber can only contain letters, numbers, dashes, and underscores';
      }
      return null;
    }
  },
  status: {
    type: 'string',
    required: false,
    default: 'draft',
    validate: (value) => {
      if (value && !INVOICE_STATUSES.includes(value)) {
        return `Invalid status. Must be one of: ${INVOICE_STATUSES.join(', ')}`;
      }
      return null;
    }
  },
  issueDate: {
    type: 'string',
    required: true,
    validate: (value) => {
      // Format: YYYY-MM-DD
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid issueDate format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  dueDate: {
    type: 'string',
    required: true,
    validate: (value) => {
      // Format: YYYY-MM-DD
      if (!validator.isDate(value, { format: 'YYYY-MM-DD', strictMode: true })) {
        return 'Invalid dueDate format (YYYY-MM-DD)';
      }
      return null;
    }
  },
  customerName: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (!value || value.trim().length < 2) {
        return 'customerName must be at least 2 characters long';
      }
      return null;
    }
  },
  customerAddress: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  customerEmail: {
    type: 'string',
    required: false,
    maxLength: 255,
    validate: (value) => {
      if (value && value.trim() && !validator.isEmail(value)) {
        return 'Invalid customerEmail format';
      }
      return null;
    }
  },
  customerVatNumber: {
    type: 'string',
    required: false,
    maxLength: 20,
    validate: (value) => {
      if (value && value.trim()) {
        // UK/EU VAT number format validation (basic check)
        const cleanedValue = value.replace(/\s/g, '').toUpperCase();
        // Allow UK format (GB + 9/12 digits) or generic EU format (2 letters + alphanumeric)
        const vatRegex = /^[A-Z]{2}[A-Z0-9]{2,12}$/;
        if (!vatRegex.test(cleanedValue)) {
          return 'Invalid VAT number format';
        }
      }
      return null;
    }
  },
  subtotal: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'subtotal must be a non-negative integer (in pence)';
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
  notes: {
    type: 'string',
    required: false,
    maxLength: 5000
  },
  paidAt: {
    type: 'string',
    required: false,
    validate: (value) => {
      if (value && value.trim()) {
        // Allow ISO 8601 datetime format
        if (!validator.isISO8601(value)) {
          return 'Invalid paidAt format (ISO 8601)';
        }
      }
      return null;
    }
  }
};

/**
 * Invoice data object
 * @typedef {Object} InvoiceData
 * @property {number} [id] - Invoice ID (auto-generated)
 * @property {number} userId - User ID who owns the invoice
 * @property {string} invoiceNumber - Unique invoice number
 * @property {string} [status] - Invoice status
 * @property {string} issueDate - Date invoice was issued (YYYY-MM-DD)
 * @property {string} dueDate - Date payment is due (YYYY-MM-DD)
 * @property {string} customerName - Customer name
 * @property {string} [customerAddress] - Customer billing address
 * @property {string} [customerEmail] - Customer email
 * @property {string} [customerVatNumber] - Customer VAT number
 * @property {number} [subtotal] - Subtotal in pence
 * @property {number} [vatAmount] - VAT amount in pence
 * @property {number} [totalAmount] - Total amount in pence
 * @property {string} [currency] - Currency code
 * @property {string} [notes] - Additional notes
 * @property {string} [paidAt] - Payment timestamp
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
 * Validates invoice data against field definitions.
 * 
 * @param {Partial<InvoiceData>} invoiceData - Invoice data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateInvoiceData(invoiceData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = invoiceData[fieldName];

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

  // Cross-field validation: dueDate must be >= issueDate
  if (invoiceData.issueDate && invoiceData.dueDate) {
    const issueDate = new Date(invoiceData.issueDate);
    const dueDate = new Date(invoiceData.dueDate);
    if (dueDate < issueDate) {
      errors.dueDate = 'dueDate must be on or after issueDate';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Generates a new invoice number.
 * Format: INV-YYYY-NNNN (e.g., INV-2026-0001)
 * 
 * @param {number} userId - User ID for scoping
 * @returns {string} Generated invoice number
 */
function generateInvoiceNumber(userId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  
  // Get the highest invoice number for this year
  const result = queryOne(`
    SELECT invoiceNumber FROM invoices 
    WHERE userId = ? AND invoiceNumber LIKE ?
    ORDER BY invoiceNumber DESC LIMIT 1
  `, [userId, `${prefix}%`]);
  
  let nextNumber = 1;
  if (result && result.invoiceNumber) {
    const currentNumber = parseInt(result.invoiceNumber.split('-')[2], 10);
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1;
    }
  }
  
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Creates a new invoice in the database.
 * 
 * @param {InvoiceData} invoiceData - Invoice data to create
 * @returns {{success: boolean, data?: InvoiceData, errors?: Object.<string, string>}}
 */
function createInvoice(invoiceData) {
  // Generate invoice number if not provided
  if (!invoiceData.invoiceNumber && invoiceData.userId) {
    invoiceData.invoiceNumber = generateInvoiceNumber(invoiceData.userId);
  }

  // Validate input data
  const validation = validateInvoiceData(invoiceData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if invoice number already exists
  const existingInvoice = findByInvoiceNumber(invoiceData.invoiceNumber);
  if (existingInvoice) {
    return { success: false, errors: { invoiceNumber: 'Invoice number already exists' } };
  }

  try {
    // Prepare the insert data
    const insertData = {
      userId: invoiceData.userId,
      invoiceNumber: invoiceData.invoiceNumber.trim().toUpperCase(),
      status: invoiceData.status || 'draft',
      issueDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
      customerName: invoiceData.customerName.trim(),
      customerAddress: invoiceData.customerAddress?.trim() || null,
      customerEmail: invoiceData.customerEmail?.toLowerCase().trim() || null,
      customerVatNumber: invoiceData.customerVatNumber?.replace(/\s/g, '').toUpperCase() || null,
      subtotal: invoiceData.subtotal || 0,
      vatAmount: invoiceData.vatAmount || 0,
      totalAmount: invoiceData.totalAmount || 0,
      currency: (invoiceData.currency || 'GBP').toUpperCase(),
      notes: invoiceData.notes?.trim() || null,
      paidAt: invoiceData.paidAt || null
    };

    const result = execute(`
      INSERT INTO invoices (
        userId, invoiceNumber, status, issueDate, dueDate,
        customerName, customerAddress, customerEmail, customerVatNumber,
        subtotal, vatAmount, totalAmount, currency, notes, paidAt
      ) VALUES (
        @userId, @invoiceNumber, @status, @issueDate, @dueDate,
        @customerName, @customerAddress, @customerEmail, @customerVatNumber,
        @subtotal, @vatAmount, @totalAmount, @currency, @notes, @paidAt
      )
    `, insertData);

    // Fetch the created invoice
    const createdInvoice = findById(result.lastInsertRowid);
    return { success: true, data: createdInvoice };

  } catch (error) {
    console.error('Error creating invoice:', error.message);
    return { success: false, errors: { general: 'Failed to create invoice' } };
  }
}

/**
 * Finds an invoice by ID.
 * 
 * @param {number} id - Invoice ID
 * @returns {InvoiceData|null} Invoice data or null if not found
 */
function findById(id) {
  const invoice = queryOne('SELECT * FROM invoices WHERE id = ?', [id]);
  return invoice || null;
}

/**
 * Finds an invoice by invoice number.
 * 
 * @param {string} invoiceNumber - Invoice number
 * @returns {InvoiceData|null} Invoice data or null if not found
 */
function findByInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber) return null;
  const invoice = queryOne(
    'SELECT * FROM invoices WHERE invoiceNumber = ?',
    [invoiceNumber.trim().toUpperCase()]
  );
  return invoice || null;
}

/**
 * Gets all invoices for a user (paginated).
 * 
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Items per page
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.customerId] - Filter by customer ID (matches invoices by customer name)
 * @param {string} [options.dateFrom] - Filter by issue date from (YYYY-MM-DD)
 * @param {string} [options.dateTo] - Filter by issue date to (YYYY-MM-DD)
 * @param {string} [options.search] - Search in invoice number and customer name
 * @param {string} [options.sortBy='issueDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{invoices: InvoiceData[], total: number, page: number, limit: number}}
 */
function getInvoicesByUserId(userId, { page = 1, limit = 10, status, customerId, dateFrom, dateTo, search, sortBy = 'issueDate', sortOrder = 'DESC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['issueDate', 'dueDate', 'invoiceNumber', 'totalAmount', 'status', 'createdAt', 'customerName'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'issueDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let whereClause = 'WHERE userId = ?';
  const params = [userId];
  
  if (status && INVOICE_STATUSES.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  // Filter by customer ID (look up customer name first if customerId is provided)
  if (customerId) {
    const customer = queryOne('SELECT name FROM customers WHERE id = ?', [customerId]);
    if (customer) {
      whereClause += ' AND customerName = ?';
      params.push(customer.name);
    }
  }
  
  // Filter by date range
  if (dateFrom) {
    whereClause += ' AND issueDate >= ?';
    params.push(dateFrom);
  }
  
  if (dateTo) {
    whereClause += ' AND issueDate <= ?';
    params.push(dateTo);
  }
  
  // Search by invoice number or customer name
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereClause += ' AND (invoiceNumber LIKE ? OR customerName LIKE ?)';
    params.push(searchTerm, searchTerm);
  }
  
  const invoices = query(
    `SELECT * FROM invoices ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM invoices ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;
  
  // Add isOverdue flag to each invoice
  const today = new Date().toISOString().split('T')[0];
  const invoicesWithOverdue = invoices.map(invoice => ({
    ...invoice,
    isOverdue: isInvoiceOverdue(invoice, today)
  }));

  return {
    invoices: invoicesWithOverdue,
    total,
    page,
    limit
  };
}

/**
 * Checks if an invoice is overdue.
 * An invoice is overdue if it's pending and the due date is in the past.
 * 
 * @param {InvoiceData} invoice - Invoice data
 * @param {string} [today] - Today's date in YYYY-MM-DD format (for testing)
 * @returns {boolean} True if the invoice is overdue
 */
function isInvoiceOverdue(invoice, today) {
  if (!today) {
    today = new Date().toISOString().split('T')[0];
  }
  // Invoice is overdue if status is pending/overdue and dueDate is past
  return (invoice.status === 'pending' || invoice.status === 'overdue') && invoice.dueDate < today;
}

/**
 * Updates an invoice's data.
 * 
 * @param {number} id - Invoice ID
 * @param {Partial<InvoiceData>} invoiceData - Data to update
 * @returns {{success: boolean, data?: InvoiceData, errors?: Object.<string, string>}}
 */
function updateInvoice(id, invoiceData) {
  // Validate input data
  const validation = validateInvoiceData(invoiceData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if invoice exists
  const existingInvoice = findById(id);
  if (!existingInvoice) {
    return { success: false, errors: { general: 'Invoice not found' } };
  }

  // Check if invoice number is being changed and is already taken
  if (invoiceData.invoiceNumber && 
      invoiceData.invoiceNumber.trim().toUpperCase() !== existingInvoice.invoiceNumber) {
    const numberInvoice = findByInvoiceNumber(invoiceData.invoiceNumber);
    if (numberInvoice) {
      return { success: false, errors: { invoiceNumber: 'Invoice number already exists' } };
    }
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (invoiceData.invoiceNumber !== undefined) {
      updateFields.push('invoiceNumber = @invoiceNumber');
      updateParams.invoiceNumber = invoiceData.invoiceNumber.trim().toUpperCase();
    }

    if (invoiceData.status !== undefined) {
      updateFields.push('status = @status');
      updateParams.status = invoiceData.status;
    }

    if (invoiceData.issueDate !== undefined) {
      updateFields.push('issueDate = @issueDate');
      updateParams.issueDate = invoiceData.issueDate;
    }

    if (invoiceData.dueDate !== undefined) {
      updateFields.push('dueDate = @dueDate');
      updateParams.dueDate = invoiceData.dueDate;
    }

    if (invoiceData.customerName !== undefined) {
      updateFields.push('customerName = @customerName');
      updateParams.customerName = invoiceData.customerName.trim();
    }

    if (invoiceData.customerAddress !== undefined) {
      updateFields.push('customerAddress = @customerAddress');
      updateParams.customerAddress = invoiceData.customerAddress?.trim() || null;
    }

    if (invoiceData.customerEmail !== undefined) {
      updateFields.push('customerEmail = @customerEmail');
      updateParams.customerEmail = invoiceData.customerEmail?.toLowerCase().trim() || null;
    }

    if (invoiceData.customerVatNumber !== undefined) {
      updateFields.push('customerVatNumber = @customerVatNumber');
      updateParams.customerVatNumber = invoiceData.customerVatNumber?.replace(/\s/g, '').toUpperCase() || null;
    }

    if (invoiceData.subtotal !== undefined) {
      updateFields.push('subtotal = @subtotal');
      updateParams.subtotal = invoiceData.subtotal;
    }

    if (invoiceData.vatAmount !== undefined) {
      updateFields.push('vatAmount = @vatAmount');
      updateParams.vatAmount = invoiceData.vatAmount;
    }

    if (invoiceData.totalAmount !== undefined) {
      updateFields.push('totalAmount = @totalAmount');
      updateParams.totalAmount = invoiceData.totalAmount;
    }

    if (invoiceData.currency !== undefined) {
      updateFields.push('currency = @currency');
      updateParams.currency = invoiceData.currency.toUpperCase();
    }

    if (invoiceData.notes !== undefined) {
      updateFields.push('notes = @notes');
      updateParams.notes = invoiceData.notes?.trim() || null;
    }

    if (invoiceData.paidAt !== undefined) {
      updateFields.push('paidAt = @paidAt');
      updateParams.paidAt = invoiceData.paidAt;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = datetime('now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: existingInvoice };
    }

    execute(
      `UPDATE invoices SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated invoice
    const updatedInvoice = findById(id);
    return { success: true, data: updatedInvoice };

  } catch (error) {
    console.error('Error updating invoice:', error.message);
    return { success: false, errors: { general: 'Failed to update invoice' } };
  }
}

/**
 * Deletes an invoice by ID.
 * 
 * @param {number} id - Invoice ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteInvoice(id) {
  const existingInvoice = findById(id);
  if (!existingInvoice) {
    return { success: false, error: 'Invoice not found' };
  }

  try {
    execute('DELETE FROM invoices WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting invoice:', error.message);
    return { success: false, error: 'Failed to delete invoice' };
  }
}

/**
 * Updates invoice status.
 * 
 * @param {number} id - Invoice ID
 * @param {string} status - New status
 * @returns {{success: boolean, data?: InvoiceData, error?: string}}
 */
function updateStatus(id, status) {
  if (!INVOICE_STATUSES.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${INVOICE_STATUSES.join(', ')}` };
  }

  const existingInvoice = findById(id);
  if (!existingInvoice) {
    return { success: false, error: 'Invoice not found' };
  }

  try {
    const updateParams = { id, status };
    
    // If marking as paid, set paidAt timestamp
    if (status === 'paid') {
      execute(
        `UPDATE invoices SET status = @status, paidAt = datetime('now'), updatedAt = datetime('now') WHERE id = @id`,
        updateParams
      );
    } else {
      execute(
        `UPDATE invoices SET status = @status, updatedAt = datetime('now') WHERE id = @id`,
        updateParams
      );
    }

    const updatedInvoice = findById(id);
    return { success: true, data: updatedInvoice };
  } catch (error) {
    console.error('Error updating invoice status:', error.message);
    return { success: false, error: 'Failed to update invoice status' };
  }
}

/**
 * Recalculates invoice totals from invoice items.
 * 
 * @param {number} invoiceId - Invoice ID
 * @returns {{success: boolean, data?: InvoiceData, error?: string}}
 */
function recalculateTotals(invoiceId) {
  const invoice = findById(invoiceId);
  if (!invoice) {
    return { success: false, error: 'Invoice not found' };
  }

  try {
    // Sum up all invoice items
    const totals = queryOne(`
      SELECT 
        COALESCE(SUM(unitPrice * CAST(quantity AS REAL)), 0) as subtotal,
        COALESCE(SUM(vatAmount), 0) as vatAmount,
        COALESCE(SUM(lineTotal), 0) as totalAmount
      FROM invoice_items 
      WHERE invoiceId = ?
    `, [invoiceId]);

    execute(`
      UPDATE invoices 
      SET subtotal = @subtotal, vatAmount = @vatAmount, totalAmount = @totalAmount, updatedAt = datetime('now')
      WHERE id = @id
    `, {
      id: invoiceId,
      subtotal: Math.round(totals.subtotal) || 0,
      vatAmount: totals.vatAmount || 0,
      totalAmount: totals.totalAmount || 0
    });

    const updatedInvoice = findById(invoiceId);
    return { success: true, data: updatedInvoice };
  } catch (error) {
    console.error('Error recalculating invoice totals:', error.message);
    return { success: false, error: 'Failed to recalculate invoice totals' };
  }
}

/**
 * Gets invoices by status.
 * 
 * @param {number} userId - User ID
 * @param {string} status - Invoice status
 * @returns {InvoiceData[]} Array of invoices
 */
function getByStatus(userId, status) {
  if (!INVOICE_STATUSES.includes(status)) {
    return [];
  }
  return query(
    'SELECT * FROM invoices WHERE userId = ? AND status = ? ORDER BY issueDate DESC',
    [userId, status]
  );
}

/**
 * Gets overdue invoices.
 * 
 * @param {number} userId - User ID
 * @returns {InvoiceData[]} Array of overdue invoices
 */
function getOverdueInvoices(userId) {
  const today = new Date().toISOString().split('T')[0];
  return query(
    `SELECT * FROM invoices 
     WHERE userId = ? AND status = 'pending' AND dueDate < ?
     ORDER BY dueDate ASC`,
    [userId, today]
  );
}

/**
 * Gets invoice count by status for a user.
 * 
 * @param {number} userId - User ID
 * @returns {Object.<string, number>} Status counts
 */
function getStatusCounts(userId) {
  const results = query(
    `SELECT status, COUNT(*) as count FROM invoices 
     WHERE userId = ? 
     GROUP BY status`,
    [userId]
  );
  
  const counts = {};
  for (const status of INVOICE_STATUSES) {
    counts[status] = 0;
  }
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

module.exports = {
  // CRUD operations
  createInvoice,
  findById,
  findByInvoiceNumber,
  getInvoicesByUserId,
  updateInvoice,
  deleteInvoice,
  
  // Status operations
  updateStatus,
  getByStatus,
  getOverdueInvoices,
  getStatusCounts,
  
  // Calculations
  recalculateTotals,
  generateInvoiceNumber,
  isInvoiceOverdue,
  
  // Validation
  validateInvoiceData,
  fieldDefinitions,
  
  // Constants
  INVOICE_STATUSES,
  VALID_CURRENCIES
};
