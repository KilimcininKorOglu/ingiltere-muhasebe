/**
 * Invoice Calculator Utility
 * Provides calculation functions for invoice totals with UK VAT compliance.
 * 
 * All monetary values are handled in pence (smallest currency unit) for precision.
 * This avoids floating-point rounding errors that can occur with decimal amounts.
 * 
 * HMRC Requirements:
 * - VAT must be calculated per line item, then summed
 * - Rounding should be done at line item level (HMRC allows either direction)
 * - VAT rates must be applied correctly based on goods/services type
 * 
 * @module utils/invoiceCalculator
 */

/**
 * Standard UK VAT rates by identifier.
 * @type {Object.<string, number|null>}
 */
const VAT_RATES = {
  'standard': 20,
  'reduced': 5,
  'zero': 0,
  'exempt': 0,
  'outside-scope': null
};

/**
 * Valid VAT rate identifiers.
 * @type {string[]}
 */
const VALID_VAT_RATE_IDS = ['standard', 'reduced', 'zero', 'exempt', 'outside-scope'];

/**
 * Calculates the VAT amount for a line item.
 * 
 * @param {number} netAmount - Net amount in pence (before VAT)
 * @param {number} vatRatePercent - VAT rate percentage (e.g., 20 for 20%)
 * @returns {number} VAT amount in pence (rounded to nearest integer)
 */
function calculateVatAmount(netAmount, vatRatePercent) {
  if (typeof netAmount !== 'number' || typeof vatRatePercent !== 'number') {
    return 0;
  }
  
  if (vatRatePercent === null || vatRatePercent <= 0) {
    return 0;
  }
  
  // Calculate VAT and round to nearest pence
  return Math.round(netAmount * (vatRatePercent / 100));
}

/**
 * Calculates line item amounts (net, VAT, and gross).
 * 
 * @param {Object} item - Line item data
 * @param {string} item.description - Item description
 * @param {number} item.quantity - Quantity (can be decimal for fractional units)
 * @param {number} item.unitPrice - Unit price in pence
 * @param {number|string} [item.vatRate=20] - VAT rate percentage or rate identifier
 * @returns {Object} Calculated line item with all amounts
 */
function calculateLineItem(item) {
  const quantity = parseFloat(item.quantity) || 1;
  const unitPrice = parseInt(item.unitPrice, 10) || 0;
  
  // Determine VAT rate
  let vatRatePercent = 20; // Default to standard rate
  let vatRateId = 'standard';
  
  if (item.vatRate !== undefined && item.vatRate !== null) {
    if (typeof item.vatRate === 'string' && VALID_VAT_RATE_IDS.includes(item.vatRate)) {
      vatRateId = item.vatRate;
      vatRatePercent = VAT_RATES[item.vatRate] !== null ? VAT_RATES[item.vatRate] : 0;
    } else if (typeof item.vatRate === 'number') {
      vatRatePercent = item.vatRate;
      // Determine vatRateId based on percentage
      if (vatRatePercent === 20) vatRateId = 'standard';
      else if (vatRatePercent === 5) vatRateId = 'reduced';
      else if (vatRatePercent === 0) vatRateId = 'zero';
      else vatRateId = 'standard'; // Custom rate defaults to standard ID
    }
  }
  
  // Calculate net amount (quantity * unit price)
  const netAmount = Math.round(quantity * unitPrice);
  
  // Calculate VAT amount
  const vatAmount = calculateVatAmount(netAmount, vatRatePercent);
  
  // Calculate gross amount (net + VAT)
  const lineTotal = netAmount + vatAmount;
  
  return {
    description: item.description || '',
    quantity: String(quantity),
    unitPrice: unitPrice,
    vatRateId: vatRateId,
    vatRatePercent: vatRatePercent,
    vatAmount: vatAmount,
    lineTotal: lineTotal,
    netAmount: netAmount
  };
}

/**
 * Calculates all invoice totals from line items.
 * 
 * @param {Array<Object>} items - Array of line items
 * @returns {Object} Invoice totals
 * @property {number} subtotal - Total before VAT in pence
 * @property {number} vatAmount - Total VAT in pence
 * @property {number} totalAmount - Total including VAT in pence
 * @property {Array<Object>} calculatedItems - Items with calculated amounts
 * @property {Array<Object>} vatBreakdown - VAT breakdown by rate
 */
function calculateInvoiceTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      vatAmount: 0,
      totalAmount: 0,
      calculatedItems: [],
      vatBreakdown: []
    };
  }
  
  const calculatedItems = [];
  const vatByRate = {};
  let subtotal = 0;
  let totalVat = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const calculated = calculateLineItem(item);
    calculated.sortOrder = item.sortOrder !== undefined ? item.sortOrder : i;
    
    calculatedItems.push(calculated);
    
    // Accumulate totals
    subtotal += calculated.netAmount;
    totalVat += calculated.vatAmount;
    
    // Build VAT breakdown
    const rateKey = `${calculated.vatRateId}-${calculated.vatRatePercent}`;
    if (!vatByRate[rateKey]) {
      vatByRate[rateKey] = {
        vatRateId: calculated.vatRateId,
        vatRatePercent: calculated.vatRatePercent,
        netAmount: 0,
        vatAmount: 0
      };
    }
    vatByRate[rateKey].netAmount += calculated.netAmount;
    vatByRate[rateKey].vatAmount += calculated.vatAmount;
  }
  
  // Convert VAT breakdown to array
  const vatBreakdown = Object.values(vatByRate).sort((a, b) => b.vatRatePercent - a.vatRatePercent);
  
  return {
    subtotal: subtotal,
    vatAmount: totalVat,
    totalAmount: subtotal + totalVat,
    calculatedItems: calculatedItems,
    vatBreakdown: vatBreakdown
  };
}

/**
 * Validates line item data for invoice creation.
 * 
 * @param {Object} item - Line item to validate
 * @param {number} index - Item index for error messages
 * @returns {Array<Object>} Array of validation errors (empty if valid)
 */
function validateLineItem(item, index = 0) {
  const errors = [];
  const prefix = `items[${index}]`;
  
  // Description validation
  if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
    errors.push({
      field: `${prefix}.description`,
      message: 'Item description is required',
      messageTr: 'Öğe açıklaması zorunludur'
    });
  } else if (item.description.length > 1000) {
    errors.push({
      field: `${prefix}.description`,
      message: 'Item description must not exceed 1000 characters',
      messageTr: 'Öğe açıklaması 1000 karakteri geçmemelidir'
    });
  }
  
  // Quantity validation
  if (item.quantity !== undefined && item.quantity !== null && item.quantity !== '') {
    const qty = parseFloat(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      errors.push({
        field: `${prefix}.quantity`,
        message: 'Quantity must be a positive number',
        messageTr: 'Miktar pozitif bir sayı olmalıdır'
      });
    }
  }
  
  // Unit price validation
  if (item.unitPrice === undefined || item.unitPrice === null) {
    errors.push({
      field: `${prefix}.unitPrice`,
      message: 'Unit price is required',
      messageTr: 'Birim fiyatı zorunludur'
    });
  } else if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
    errors.push({
      field: `${prefix}.unitPrice`,
      message: 'Unit price must be a non-negative integer (in pence)',
      messageTr: 'Birim fiyatı negatif olmayan bir tam sayı olmalıdır (peni cinsinden)'
    });
  }
  
  // VAT rate validation
  if (item.vatRate !== undefined && item.vatRate !== null) {
    if (typeof item.vatRate === 'string' && !VALID_VAT_RATE_IDS.includes(item.vatRate)) {
      errors.push({
        field: `${prefix}.vatRate`,
        message: `Invalid VAT rate. Must be one of: ${VALID_VAT_RATE_IDS.join(', ')}`,
        messageTr: `Geçersiz KDV oranı. Şunlardan biri olmalıdır: ${VALID_VAT_RATE_IDS.join(', ')}`
      });
    } else if (typeof item.vatRate === 'number' && (item.vatRate < 0 || item.vatRate > 100)) {
      errors.push({
        field: `${prefix}.vatRate`,
        message: 'VAT rate must be between 0 and 100',
        messageTr: 'KDV oranı 0 ile 100 arasında olmalıdır'
      });
    }
  }
  
  return errors;
}

/**
 * Validates all line items for an invoice.
 * 
 * @param {Array<Object>} items - Array of line items to validate
 * @returns {Object} Validation result
 * @property {boolean} isValid - Whether all items are valid
 * @property {Array<Object>} errors - Array of validation errors
 */
function validateLineItems(items) {
  const errors = [];
  
  if (!Array.isArray(items)) {
    errors.push({
      field: 'items',
      message: 'Items must be an array',
      messageTr: 'Öğeler bir dizi olmalıdır'
    });
    return { isValid: false, errors };
  }
  
  if (items.length === 0) {
    errors.push({
      field: 'items',
      message: 'At least one item is required',
      messageTr: 'En az bir öğe gereklidir'
    });
    return { isValid: false, errors };
  }
  
  // Limit number of items to prevent abuse
  if (items.length > 100) {
    errors.push({
      field: 'items',
      message: 'Maximum 100 items allowed per invoice',
      messageTr: 'Fatura başına en fazla 100 öğeye izin verilir'
    });
    return { isValid: false, errors };
  }
  
  for (let i = 0; i < items.length; i++) {
    const itemErrors = validateLineItem(items[i], i);
    errors.push(...itemErrors);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Formats a monetary amount from pence to display string.
 * 
 * @param {number} amountInPence - Amount in pence
 * @param {string} [currency='GBP'] - Currency code
 * @returns {string} Formatted amount (e.g., "£123.45")
 */
function formatAmount(amountInPence, currency = 'GBP') {
  const amount = amountInPence / 100;
  
  const symbols = {
    'GBP': '£',
    'EUR': '€',
    'USD': '$'
  };
  
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Converts a decimal amount (e.g., 123.45) to pence.
 * 
 * @param {number|string} amount - Amount in decimal format
 * @returns {number} Amount in pence
 */
function toPence(amount) {
  if (typeof amount === 'string') {
    amount = parseFloat(amount);
  }
  if (isNaN(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
}

/**
 * Converts pence to decimal amount.
 * 
 * @param {number} pence - Amount in pence
 * @returns {number} Amount in decimal format
 */
function fromPence(pence) {
  if (typeof pence !== 'number') {
    return 0;
  }
  return pence / 100;
}

/**
 * Calculates the due date based on invoice date and payment terms.
 * 
 * @param {string} invoiceDate - Invoice date in YYYY-MM-DD format
 * @param {number} [paymentTermsDays=30] - Payment terms in days
 * @returns {string} Due date in YYYY-MM-DD format
 */
function calculateDueDate(invoiceDate, paymentTermsDays = 30) {
  const date = new Date(invoiceDate);
  if (isNaN(date.getTime())) {
    // If invalid date, use today + payment terms
    const today = new Date();
    today.setDate(today.getDate() + paymentTermsDays);
    return today.toISOString().split('T')[0];
  }
  
  date.setDate(date.getDate() + paymentTermsDays);
  return date.toISOString().split('T')[0];
}

/**
 * Checks if a date is valid and in YYYY-MM-DD format.
 * 
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  // Check format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
}

module.exports = {
  // Calculation functions
  calculateVatAmount,
  calculateLineItem,
  calculateInvoiceTotals,
  calculateDueDate,
  
  // Validation functions
  validateLineItem,
  validateLineItems,
  isValidDate,
  
  // Formatting functions
  formatAmount,
  toPence,
  fromPence,
  
  // Constants
  VAT_RATES,
  VALID_VAT_RATE_IDS
};
