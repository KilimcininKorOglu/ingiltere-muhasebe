/**
 * InvoiceItem model for invoice line items with UK VAT compliance.
 * Provides CRUD operations and validation for invoice item data.
 * 
 * @module models/InvoiceItem
 */

const { query, queryOne, execute, transaction, openDatabase } = require('../index');

/**
 * Valid VAT rate identifiers.
 * These correspond to the UK VAT rates defined in the vatRates data module.
 */
const VALID_VAT_RATE_IDS = ['standard', 'reduced', 'zero', 'exempt', 'outside-scope'];

/**
 * VAT rate percentages by ID.
 */
const VAT_RATE_PERCENTAGES = {
  'standard': 20,
  'reduced': 5,
  'zero': 0,
  'exempt': 0,
  'outside-scope': null
};

/**
 * Invoice item field definitions with validation rules.
 * @typedef {Object} InvoiceItemFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Invoice item field definitions for validation.
 * @type {Object.<string, InvoiceItemFieldDefinition>}
 */
const fieldDefinitions = {
  invoiceId: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value <= 0) {
        return 'invoiceId must be a positive integer';
      }
      return null;
    }
  },
  description: {
    type: 'string',
    required: true,
    maxLength: 1000,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'description is required';
      }
      return null;
    }
  },
  quantity: {
    type: 'string',
    required: false,
    default: '1',
    validate: (value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'quantity must be a positive number';
        }
      }
      return null;
    }
  },
  unitPrice: {
    type: 'number',
    required: true,
    validate: (value) => {
      if (!Number.isInteger(value) || value < 0) {
        return 'unitPrice must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  vatRateId: {
    type: 'string',
    required: false,
    default: 'standard',
    validate: (value) => {
      if (value && !VALID_VAT_RATE_IDS.includes(value)) {
        return `Invalid vatRateId. Must be one of: ${VALID_VAT_RATE_IDS.join(', ')}`;
      }
      return null;
    }
  },
  vatRatePercent: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== undefined && value !== null && (typeof value !== 'number' || value < 0)) {
        return 'vatRatePercent must be a non-negative number';
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
  lineTotal: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'lineTotal must be a non-negative integer (in pence)';
      }
      return null;
    }
  },
  sortOrder: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        return 'sortOrder must be a non-negative integer';
      }
      return null;
    }
  }
};

/**
 * Invoice item data object
 * @typedef {Object} InvoiceItemData
 * @property {number} [id] - Item ID (auto-generated)
 * @property {number} invoiceId - Parent invoice ID
 * @property {string} description - Item description
 * @property {string} [quantity] - Quantity (as string for decimal precision)
 * @property {number} unitPrice - Unit price in pence
 * @property {string} [vatRateId] - VAT rate identifier
 * @property {number} [vatRatePercent] - VAT rate percentage
 * @property {number} [vatAmount] - VAT amount in pence
 * @property {number} [lineTotal] - Line total in pence
 * @property {number} [sortOrder] - Display order
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
 * Validates invoice item data against field definitions.
 * 
 * @param {Partial<InvoiceItemData>} itemData - Item data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateInvoiceItemData(itemData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = itemData[fieldName];

    // Check required fields (only for create operations)
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
 * Calculates VAT and line total for an invoice item.
 * 
 * @param {number} unitPrice - Unit price in pence
 * @param {string} quantity - Quantity as string
 * @param {string} vatRateId - VAT rate identifier
 * @returns {{vatRatePercent: number|null, vatAmount: number, lineTotal: number}}
 */
function calculateLineAmounts(unitPrice, quantity, vatRateId) {
  const qty = parseFloat(quantity) || 1;
  const subtotal = Math.round(unitPrice * qty);
  const vatRatePercent = VAT_RATE_PERCENTAGES[vatRateId];
  
  let vatAmount = 0;
  if (vatRatePercent !== null && vatRatePercent > 0) {
    vatAmount = Math.round(subtotal * (vatRatePercent / 100));
  }
  
  const lineTotal = subtotal + vatAmount;
  
  return {
    vatRatePercent: vatRatePercent !== null ? vatRatePercent : 0,
    vatAmount,
    lineTotal
  };
}

/**
 * Creates a new invoice item in the database.
 * 
 * @param {InvoiceItemData} itemData - Item data to create
 * @returns {{success: boolean, data?: InvoiceItemData, errors?: Object.<string, string>}}
 */
function createInvoiceItem(itemData) {
  // Validate input data
  const validation = validateInvoiceItemData(itemData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if invoice exists
  const invoice = queryOne('SELECT id FROM invoices WHERE id = ?', [itemData.invoiceId]);
  if (!invoice) {
    return { success: false, errors: { invoiceId: 'Invoice not found' } };
  }

  try {
    const quantity = itemData.quantity || '1';
    const vatRateId = itemData.vatRateId || 'standard';
    
    // Calculate amounts
    const calculated = calculateLineAmounts(itemData.unitPrice, quantity, vatRateId);
    
    // Get next sort order if not provided
    let sortOrder = itemData.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      const maxOrder = queryOne(
        'SELECT MAX(sortOrder) as maxOrder FROM invoice_items WHERE invoiceId = ?',
        [itemData.invoiceId]
      );
      sortOrder = (maxOrder?.maxOrder ?? -1) + 1;
    }

    // Prepare the insert data
    const insertData = {
      invoiceId: itemData.invoiceId,
      description: itemData.description.trim(),
      quantity: quantity,
      unitPrice: itemData.unitPrice,
      vatRateId: vatRateId,
      vatRatePercent: itemData.vatRatePercent !== undefined ? itemData.vatRatePercent : calculated.vatRatePercent,
      vatAmount: itemData.vatAmount !== undefined ? itemData.vatAmount : calculated.vatAmount,
      lineTotal: itemData.lineTotal !== undefined ? itemData.lineTotal : calculated.lineTotal,
      sortOrder: sortOrder
    };

    const result = execute(`
      INSERT INTO invoice_items (
        invoiceId, description, quantity, unitPrice, vatRateId,
        vatRatePercent, vatAmount, lineTotal, sortOrder
      ) VALUES (
        @invoiceId, @description, @quantity, @unitPrice, @vatRateId,
        @vatRatePercent, @vatAmount, @lineTotal, @sortOrder
      )
    `, insertData);

    // Fetch the created item
    const createdItem = findById(result.lastInsertRowid);
    return { success: true, data: createdItem };

  } catch (error) {
    console.error('Error creating invoice item:', error.message);
    return { success: false, errors: { general: 'Failed to create invoice item' } };
  }
}

/**
 * Finds an invoice item by ID.
 * 
 * @param {number} id - Item ID
 * @returns {InvoiceItemData|null} Item data or null if not found
 */
function findById(id) {
  const item = queryOne('SELECT * FROM invoice_items WHERE id = ?', [id]);
  return item || null;
}

/**
 * Gets all items for an invoice (ordered by sortOrder).
 * 
 * @param {number} invoiceId - Invoice ID
 * @returns {InvoiceItemData[]} Array of invoice items
 */
function getByInvoiceId(invoiceId) {
  return query(
    'SELECT * FROM invoice_items WHERE invoiceId = ? ORDER BY sortOrder ASC',
    [invoiceId]
  );
}

/**
 * Updates an invoice item's data.
 * 
 * @param {number} id - Item ID
 * @param {Partial<InvoiceItemData>} itemData - Data to update
 * @returns {{success: boolean, data?: InvoiceItemData, errors?: Object.<string, string>}}
 */
function updateInvoiceItem(id, itemData) {
  // Validate input data
  const validation = validateInvoiceItemData(itemData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if item exists
  const existingItem = findById(id);
  if (!existingItem) {
    return { success: false, errors: { general: 'Invoice item not found' } };
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (itemData.description !== undefined) {
      updateFields.push('description = @description');
      updateParams.description = itemData.description.trim();
    }

    if (itemData.quantity !== undefined) {
      updateFields.push('quantity = @quantity');
      updateParams.quantity = itemData.quantity;
    }

    if (itemData.unitPrice !== undefined) {
      updateFields.push('unitPrice = @unitPrice');
      updateParams.unitPrice = itemData.unitPrice;
    }

    if (itemData.vatRateId !== undefined) {
      updateFields.push('vatRateId = @vatRateId');
      updateParams.vatRateId = itemData.vatRateId;
    }

    if (itemData.vatRatePercent !== undefined) {
      updateFields.push('vatRatePercent = @vatRatePercent');
      updateParams.vatRatePercent = itemData.vatRatePercent;
    }

    if (itemData.vatAmount !== undefined) {
      updateFields.push('vatAmount = @vatAmount');
      updateParams.vatAmount = itemData.vatAmount;
    }

    if (itemData.lineTotal !== undefined) {
      updateFields.push('lineTotal = @lineTotal');
      updateParams.lineTotal = itemData.lineTotal;
    }

    if (itemData.sortOrder !== undefined) {
      updateFields.push('sortOrder = @sortOrder');
      updateParams.sortOrder = itemData.sortOrder;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = strftime('%s', 'now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: existingItem };
    }

    execute(
      `UPDATE invoice_items SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // If price-related fields changed, recalculate amounts
    const needsRecalc = itemData.quantity !== undefined || 
                        itemData.unitPrice !== undefined || 
                        itemData.vatRateId !== undefined;
    
    if (needsRecalc && itemData.vatAmount === undefined && itemData.lineTotal === undefined) {
      const updated = findById(id);
      const calculated = calculateLineAmounts(
        updated.unitPrice, 
        updated.quantity, 
        updated.vatRateId
      );
      
      execute(`
        UPDATE invoice_items 
        SET vatRatePercent = @vatRatePercent, vatAmount = @vatAmount, lineTotal = @lineTotal
        WHERE id = @id
      `, {
        id,
        vatRatePercent: calculated.vatRatePercent,
        vatAmount: calculated.vatAmount,
        lineTotal: calculated.lineTotal
      });
    }

    // Fetch the updated item
    const updatedItem = findById(id);
    return { success: true, data: updatedItem };

  } catch (error) {
    console.error('Error updating invoice item:', error.message);
    return { success: false, errors: { general: 'Failed to update invoice item' } };
  }
}

/**
 * Deletes an invoice item by ID.
 * 
 * @param {number} id - Item ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteInvoiceItem(id) {
  const existingItem = findById(id);
  if (!existingItem) {
    return { success: false, error: 'Invoice item not found' };
  }

  try {
    execute('DELETE FROM invoice_items WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting invoice item:', error.message);
    return { success: false, error: 'Failed to delete invoice item' };
  }
}

/**
 * Deletes all items for an invoice.
 * 
 * @param {number} invoiceId - Invoice ID
 * @returns {{success: boolean, deletedCount: number, error?: string}}
 */
function deleteByInvoiceId(invoiceId) {
  try {
    const result = execute('DELETE FROM invoice_items WHERE invoiceId = ?', [invoiceId]);
    return { success: true, deletedCount: result.changes };
  } catch (error) {
    console.error('Error deleting invoice items:', error.message);
    return { success: false, deletedCount: 0, error: 'Failed to delete invoice items' };
  }
}

/**
 * Reorders items for an invoice.
 * 
 * @param {number} invoiceId - Invoice ID
 * @param {number[]} itemIds - Array of item IDs in desired order
 * @returns {{success: boolean, error?: string}}
 */
function reorderItems(invoiceId, itemIds) {
  if (!Array.isArray(itemIds)) {
    return { success: false, error: 'itemIds must be an array' };
  }

  try {
    const db = openDatabase();
    db.transaction(() => {
      for (let i = 0; i < itemIds.length; i++) {
        execute(
          'UPDATE invoice_items SET sortOrder = ? WHERE id = ? AND invoiceId = ?',
          [i, itemIds[i], invoiceId]
        );
      }
    })();
    return { success: true };
  } catch (error) {
    console.error('Error reordering invoice items:', error.message);
    return { success: false, error: 'Failed to reorder invoice items' };
  }
}

/**
 * Gets VAT summary for an invoice (grouped by VAT rate).
 * 
 * @param {number} invoiceId - Invoice ID
 * @returns {Array<{vatRateId: string, vatRatePercent: number, subtotal: number, vatAmount: number}>}
 */
function getVatSummary(invoiceId) {
  return query(`
    SELECT 
      vatRateId,
      vatRatePercent,
      SUM(unitPrice * CAST(quantity AS REAL)) as subtotal,
      SUM(vatAmount) as vatAmount
    FROM invoice_items 
    WHERE invoiceId = ?
    GROUP BY vatRateId, vatRatePercent
    ORDER BY vatRatePercent DESC
  `, [invoiceId]);
}

/**
 * Counts items for an invoice.
 * 
 * @param {number} invoiceId - Invoice ID
 * @returns {number} Number of items
 */
function countByInvoiceId(invoiceId) {
  const result = queryOne(
    'SELECT COUNT(*) as count FROM invoice_items WHERE invoiceId = ?',
    [invoiceId]
  );
  return result?.count || 0;
}

module.exports = {
  // CRUD operations
  createInvoiceItem,
  findById,
  getByInvoiceId,
  updateInvoiceItem,
  deleteInvoiceItem,
  deleteByInvoiceId,
  
  // Utility operations
  reorderItems,
  getVatSummary,
  countByInvoiceId,
  calculateLineAmounts,
  
  // Validation
  validateInvoiceItemData,
  fieldDefinitions,
  
  // Constants
  VALID_VAT_RATE_IDS,
  VAT_RATE_PERCENTAGES
};
