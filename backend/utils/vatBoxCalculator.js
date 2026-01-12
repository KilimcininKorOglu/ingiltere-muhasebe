/**
 * VAT Box Calculator Utility
 * 
 * Calculates all nine HMRC VAT return boxes according to UK tax regulations.
 * Implements HMRC rounding rules and supports both standard and cash accounting schemes.
 * 
 * HMRC VAT Return Boxes:
 * - Box 1: VAT due on sales and other outputs
 * - Box 2: VAT due on acquisitions from EU (legacy, now 0 post-Brexit)
 * - Box 3: Total VAT due (Box 1 + Box 2)
 * - Box 4: VAT reclaimed on purchases and other inputs
 * - Box 5: Net VAT to pay or reclaim (Box 3 - Box 4)
 * - Box 6: Total value of sales and outputs (excluding VAT)
 * - Box 7: Total value of purchases and inputs (excluding VAT)
 * - Box 8: Total value of supplies to EU (excluding VAT) - now 0 post-Brexit
 * - Box 9: Total value of acquisitions from EU (excluding VAT) - now 0 post-Brexit
 * 
 * HMRC Rounding Rules:
 * - All monetary values are calculated in pence (smallest currency unit)
 * - Final box values should be rounded to nearest pound for submission
 * - For internal calculations, we maintain pence precision
 * 
 * @module utils/vatBoxCalculator
 */

/**
 * Accounting scheme types supported for VAT calculations.
 * @type {Object.<string, string>}
 */
const ACCOUNTING_SCHEMES = {
  STANDARD: 'standard',  // VAT due when invoice issued
  CASH: 'cash'           // VAT due when payment received
};

/**
 * VAT box descriptions for reference.
 * @type {Object.<string, Object>}
 */
const VAT_BOX_DESCRIPTIONS = {
  box1: {
    name: {
      en: 'VAT due on sales',
      tr: 'Satışlardan doğan KDV'
    },
    description: {
      en: 'VAT due on sales and other outputs',
      tr: 'Satış ve diğer çıktılardan doğan KDV'
    }
  },
  box2: {
    name: {
      en: 'VAT due on EU acquisitions',
      tr: 'AB alımlarından doğan KDV'
    },
    description: {
      en: 'VAT due on acquisitions from EU member states (legacy)',
      tr: 'AB üye devletlerinden alımlardan doğan KDV (eski)'
    }
  },
  box3: {
    name: {
      en: 'Total VAT due',
      tr: 'Toplam KDV borcu'
    },
    description: {
      en: 'Total VAT due (Box 1 + Box 2)',
      tr: 'Toplam KDV borcu (Kutu 1 + Kutu 2)'
    }
  },
  box4: {
    name: {
      en: 'VAT reclaimed',
      tr: 'Geri alınan KDV'
    },
    description: {
      en: 'VAT reclaimed on purchases and other inputs',
      tr: 'Satın almalar ve diğer girdilerden geri alınan KDV'
    }
  },
  box5: {
    name: {
      en: 'Net VAT',
      tr: 'Net KDV'
    },
    description: {
      en: 'Net VAT to pay or reclaim (Box 3 - Box 4)',
      tr: 'Ödenecek veya geri alınacak net KDV (Kutu 3 - Kutu 4)'
    }
  },
  box6: {
    name: {
      en: 'Total sales',
      tr: 'Toplam satışlar'
    },
    description: {
      en: 'Total value of sales and outputs (excluding VAT)',
      tr: 'Satış ve çıktıların toplam değeri (KDV hariç)'
    }
  },
  box7: {
    name: {
      en: 'Total purchases',
      tr: 'Toplam alımlar'
    },
    description: {
      en: 'Total value of purchases and inputs (excluding VAT)',
      tr: 'Satın alma ve girdilerin toplam değeri (KDV hariç)'
    }
  },
  box8: {
    name: {
      en: 'EU supplies',
      tr: 'AB teslimleri'
    },
    description: {
      en: 'Total value of supplies to EU (excluding VAT)',
      tr: 'AB\'ye teslimlerin toplam değeri (KDV hariç)'
    }
  },
  box9: {
    name: {
      en: 'EU acquisitions',
      tr: 'AB alımları'
    },
    description: {
      en: 'Total value of acquisitions from EU (excluding VAT)',
      tr: 'AB\'den alımların toplam değeri (KDV hariç)'
    }
  }
};

/**
 * Rounds a value according to HMRC rounding rules.
 * Standard rounding: values less than 0.50 round down, 0.50 and above round up.
 * 
 * @param {number} value - Value in pence to round
 * @returns {number} Rounded value in pence
 */
function hmrcRound(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return Math.round(value);
}

/**
 * Rounds a value in pence to whole pounds (for final submission).
 * HMRC allows rounding to nearest pound for VAT returns.
 * 
 * @param {number} valueInPence - Value in pence
 * @returns {number} Value rounded to nearest pound (still in pence for consistency)
 */
function roundToPounds(valueInPence) {
  if (typeof valueInPence !== 'number' || isNaN(valueInPence)) {
    return 0;
  }
  // Round to nearest 100 pence (1 pound)
  return Math.round(valueInPence / 100) * 100;
}

/**
 * Calculates Box 1: VAT due on sales and other outputs.
 * 
 * For standard accounting: Sum of VAT on all issued sales invoices in the period.
 * For cash accounting: Sum of VAT on payments received in the period.
 * 
 * @param {Array<Object>} transactions - Array of income transactions
 * @param {Array<Object>} invoices - Array of sales invoices (for standard accounting)
 * @param {Object} options - Calculation options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @returns {number} Box 1 value in pence
 */
function calculateBox1(transactions, invoices, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD } = options;
  
  let totalVat = 0;
  
  if (accountingScheme === ACCOUNTING_SCHEMES.CASH) {
    // Cash accounting: Only count VAT on received payments
    // Use transactions that represent actual payments received
    if (Array.isArray(transactions)) {
      for (const txn of transactions) {
        if (txn.type === 'income' && txn.status !== 'void') {
          totalVat += txn.vatAmount || 0;
        }
      }
    }
  } else {
    // Standard accounting: Sum VAT from all sales invoices issued in the period
    // Include only invoices with status that indicates VAT liability
    if (Array.isArray(invoices) && invoices.length > 0) {
      for (const invoice of invoices) {
        // Include draft, pending, paid invoices but exclude voided/cancelled
        if (invoice.status !== 'void' && invoice.status !== 'cancelled') {
          totalVat += invoice.vatAmount || 0;
        }
      }
    } else if (Array.isArray(transactions)) {
      // Fallback to transactions if no invoices provided
      for (const txn of transactions) {
        if (txn.type === 'income' && txn.status !== 'void') {
          totalVat += txn.vatAmount || 0;
        }
      }
    }
  }
  
  return hmrcRound(totalVat);
}

/**
 * Calculates Box 2: VAT due on EU acquisitions.
 * Post-Brexit, this is typically 0 for UK VAT returns.
 * 
 * @param {Array<Object>} _transactions - Array of transactions (unused post-Brexit)
 * @param {Object} _options - Calculation options (unused)
 * @returns {number} Box 2 value in pence (always 0 post-Brexit)
 */
function calculateBox2(_transactions, _options = {}) {
  // Post-Brexit: EU acquisitions are now handled differently
  // This box is kept for legacy/transitional purposes but returns 0
  return 0;
}

/**
 * Calculates Box 3: Total VAT due.
 * This is simply Box 1 + Box 2.
 * 
 * @param {number} box1 - Box 1 value in pence
 * @param {number} box2 - Box 2 value in pence
 * @returns {number} Box 3 value in pence
 */
function calculateBox3(box1, box2) {
  return hmrcRound((box1 || 0) + (box2 || 0));
}

/**
 * Calculates Box 4: VAT reclaimed on purchases.
 * 
 * For standard accounting: Sum of VAT on all purchase invoices received in the period.
 * For cash accounting: Sum of VAT on payments made in the period.
 * 
 * Note: Only VAT-registered purchases with valid VAT invoices can be reclaimed.
 * Exempt and outside-scope items should not be included.
 * 
 * @param {Array<Object>} transactions - Array of expense transactions
 * @param {Object} options - Calculation options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @returns {number} Box 4 value in pence
 */
function calculateBox4(transactions, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD } = options;
  
  let totalVat = 0;
  
  if (!Array.isArray(transactions)) {
    return 0;
  }
  
  for (const txn of transactions) {
    // Only count expense transactions that are not voided
    if (txn.type === 'expense' && txn.status !== 'void') {
      // For cash accounting, we would typically check payment date
      // For standard accounting, we use invoice/transaction date
      // Both are filtered by date range before calling this function
      totalVat += txn.vatAmount || 0;
    }
  }
  
  return hmrcRound(totalVat);
}

/**
 * Calculates Box 5: Net VAT to pay or reclaim.
 * This is Box 3 - Box 4. A positive value means VAT to pay,
 * a negative value means VAT to reclaim.
 * 
 * @param {number} box3 - Box 3 value in pence
 * @param {number} box4 - Box 4 value in pence
 * @returns {number} Box 5 value in pence (can be negative)
 */
function calculateBox5(box3, box4) {
  return hmrcRound((box3 || 0) - (box4 || 0));
}

/**
 * Calculates Box 6: Total value of sales and outputs.
 * This is the net value (excluding VAT) of all sales and outputs.
 * 
 * @param {Array<Object>} transactions - Array of income transactions
 * @param {Array<Object>} invoices - Array of sales invoices
 * @param {Object} options - Calculation options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @returns {number} Box 6 value in pence
 */
function calculateBox6(transactions, invoices, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD } = options;
  
  let totalNet = 0;
  
  if (accountingScheme === ACCOUNTING_SCHEMES.CASH) {
    // Cash accounting: Net value of actual payments received
    if (Array.isArray(transactions)) {
      for (const txn of transactions) {
        if (txn.type === 'income' && txn.status !== 'void') {
          totalNet += txn.amount || 0;
        }
      }
    }
  } else {
    // Standard accounting: Net value from invoices
    if (Array.isArray(invoices) && invoices.length > 0) {
      for (const invoice of invoices) {
        if (invoice.status !== 'void' && invoice.status !== 'cancelled') {
          totalNet += invoice.subtotal || 0;
        }
      }
    } else if (Array.isArray(transactions)) {
      // Fallback to transactions
      for (const txn of transactions) {
        if (txn.type === 'income' && txn.status !== 'void') {
          totalNet += txn.amount || 0;
        }
      }
    }
  }
  
  return hmrcRound(totalNet);
}

/**
 * Calculates Box 7: Total value of purchases and inputs.
 * This is the net value (excluding VAT) of all purchases and inputs.
 * 
 * @param {Array<Object>} transactions - Array of expense transactions
 * @param {Object} options - Calculation options
 * @returns {number} Box 7 value in pence
 */
function calculateBox7(transactions, options = {}) {
  let totalNet = 0;
  
  if (!Array.isArray(transactions)) {
    return 0;
  }
  
  for (const txn of transactions) {
    if (txn.type === 'expense' && txn.status !== 'void') {
      totalNet += txn.amount || 0;
    }
  }
  
  return hmrcRound(totalNet);
}

/**
 * Calculates Box 8: Total value of supplies to EU.
 * Post-Brexit, this is typically 0 for UK VAT returns.
 * 
 * @param {Array<Object>} _transactions - Array of transactions (unused post-Brexit)
 * @param {Object} _options - Calculation options (unused)
 * @returns {number} Box 8 value in pence (always 0 post-Brexit)
 */
function calculateBox8(_transactions, _options = {}) {
  // Post-Brexit: EU supplies are now exports and handled differently
  return 0;
}

/**
 * Calculates Box 9: Total value of acquisitions from EU.
 * Post-Brexit, this is typically 0 for UK VAT returns.
 * 
 * @param {Array<Object>} _transactions - Array of transactions (unused post-Brexit)
 * @param {Object} _options - Calculation options (unused)
 * @returns {number} Box 9 value in pence (always 0 post-Brexit)
 */
function calculateBox9(_transactions, _options = {}) {
  // Post-Brexit: EU acquisitions are now imports and handled differently
  return 0;
}

/**
 * Calculates all nine HMRC VAT return boxes.
 * 
 * @param {Object} data - Data for VAT calculation
 * @param {Array<Object>} data.incomeTransactions - Income transactions for the period
 * @param {Array<Object>} data.expenseTransactions - Expense transactions for the period
 * @param {Array<Object>} [data.salesInvoices] - Sales invoices for the period (for standard accounting)
 * @param {Object} options - Calculation options
 * @param {string} [options.accountingScheme='standard'] - 'standard' or 'cash'
 * @param {boolean} [options.roundToPounds=false] - Whether to round final values to pounds
 * @returns {Object} All nine box values and metadata
 */
function calculateAllBoxes(data, options = {}) {
  const {
    incomeTransactions = [],
    expenseTransactions = [],
    salesInvoices = []
  } = data;
  
  const {
    accountingScheme = ACCOUNTING_SCHEMES.STANDARD,
    roundToPounds: shouldRoundToPounds = false
  } = options;
  
  // Calculate individual boxes
  const box1 = calculateBox1(incomeTransactions, salesInvoices, { accountingScheme });
  const box2 = calculateBox2(incomeTransactions, { accountingScheme });
  const box3 = calculateBox3(box1, box2);
  const box4 = calculateBox4(expenseTransactions, { accountingScheme });
  const box5 = calculateBox5(box3, box4);
  const box6 = calculateBox6(incomeTransactions, salesInvoices, { accountingScheme });
  const box7 = calculateBox7(expenseTransactions, { accountingScheme });
  const box8 = calculateBox8(incomeTransactions, { accountingScheme });
  const box9 = calculateBox9(expenseTransactions, { accountingScheme });
  
  // Apply rounding to pounds if requested (for final submission)
  const applyRounding = shouldRoundToPounds ? roundToPounds : (v) => v;
  
  return {
    box1: applyRounding(box1),
    box2: applyRounding(box2),
    box3: applyRounding(box3),
    box4: applyRounding(box4),
    box5: applyRounding(box5),
    box6: applyRounding(box6),
    box7: applyRounding(box7),
    box8: applyRounding(box8),
    box9: applyRounding(box9),
    metadata: {
      accountingScheme,
      calculatedAt: new Date().toISOString(),
      incomeTransactionCount: incomeTransactions.length,
      expenseTransactionCount: expenseTransactions.length,
      salesInvoiceCount: salesInvoices.length,
      roundedToPounds: shouldRoundToPounds
    }
  };
}

/**
 * Validates calculated box values for internal consistency.
 * 
 * @param {Object} boxes - Object containing box1 through box9
 * @returns {Object} Validation result with isValid and errors array
 */
function validateBoxCalculations(boxes) {
  const errors = [];
  
  // Check Box 3 = Box 1 + Box 2
  const expectedBox3 = (boxes.box1 || 0) + (boxes.box2 || 0);
  if (boxes.box3 !== expectedBox3) {
    errors.push({
      box: 'box3',
      message: `Box 3 should equal Box 1 + Box 2 (expected ${expectedBox3}, got ${boxes.box3})`,
      messageTr: `Kutu 3, Kutu 1 + Kutu 2'ye eşit olmalıdır (beklenen ${expectedBox3}, bulunan ${boxes.box3})`
    });
  }
  
  // Check Box 5 = Box 3 - Box 4
  const expectedBox5 = (boxes.box3 || 0) - (boxes.box4 || 0);
  if (boxes.box5 !== expectedBox5) {
    errors.push({
      box: 'box5',
      message: `Box 5 should equal Box 3 - Box 4 (expected ${expectedBox5}, got ${boxes.box5})`,
      messageTr: `Kutu 5, Kutu 3 - Kutu 4'e eşit olmalıdır (beklenen ${expectedBox5}, bulunan ${boxes.box5})`
    });
  }
  
  // Check non-negative constraints for boxes that shouldn't be negative
  const nonNegativeBoxes = ['box1', 'box2', 'box3', 'box4', 'box6', 'box7', 'box8', 'box9'];
  for (const boxName of nonNegativeBoxes) {
    if (boxes[boxName] < 0) {
      errors.push({
        box: boxName,
        message: `${boxName.toUpperCase()} should not be negative`,
        messageTr: `${boxName.toUpperCase()} negatif olmamalıdır`
      });
    }
  }
  
  // Check EC boxes are 0 (post-Brexit)
  if (boxes.box2 !== 0) {
    errors.push({
      box: 'box2',
      message: 'Box 2 (EU acquisitions) should be 0 post-Brexit',
      messageTr: 'Kutu 2 (AB alımları) Brexit sonrası 0 olmalıdır'
    });
  }
  
  if (boxes.box8 !== 0) {
    errors.push({
      box: 'box8',
      message: 'Box 8 (EU supplies) should be 0 post-Brexit',
      messageTr: 'Kutu 8 (AB teslimleri) Brexit sonrası 0 olmalıdır'
    });
  }
  
  if (boxes.box9 !== 0) {
    errors.push({
      box: 'box9',
      message: 'Box 9 (EU acquisitions) should be 0 post-Brexit',
      messageTr: 'Kutu 9 (AB alımları) Brexit sonrası 0 olmalıdır'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a summary of the VAT calculation for display.
 * 
 * @param {Object} boxes - Calculated box values
 * @param {string} [language='en'] - Language for descriptions
 * @returns {Object} Summary object with formatted descriptions
 */
function createCalculationSummary(boxes, language = 'en') {
  const lang = ['en', 'tr'].includes(language) ? language : 'en';
  
  const summary = [];
  
  for (let i = 1; i <= 9; i++) {
    const boxKey = `box${i}`;
    const value = boxes[boxKey] || 0;
    const description = VAT_BOX_DESCRIPTIONS[boxKey];
    
    summary.push({
      box: i,
      key: boxKey,
      value: value,
      valueInPounds: value / 100,
      name: description.name[lang],
      description: description.description[lang]
    });
  }
  
  return {
    boxes: summary,
    vatDue: boxes.box3 || 0,
    vatReclaimed: boxes.box4 || 0,
    netVat: boxes.box5 || 0,
    isRefundDue: (boxes.box5 || 0) < 0,
    metadata: boxes.metadata || {}
  };
}

/**
 * Formats box values for HMRC submission.
 * HMRC requires values in pounds and pence, not just pence.
 * 
 * @param {Object} boxes - Calculated box values in pence
 * @returns {Object} Box values formatted for submission
 */
function formatForSubmission(boxes) {
  const formatted = {};
  
  for (let i = 1; i <= 9; i++) {
    const boxKey = `box${i}`;
    const valueInPence = boxes[boxKey] || 0;
    // Convert to decimal pounds for submission
    formatted[boxKey] = valueInPence / 100;
  }
  
  return formatted;
}

module.exports = {
  // Individual box calculations
  calculateBox1,
  calculateBox2,
  calculateBox3,
  calculateBox4,
  calculateBox5,
  calculateBox6,
  calculateBox7,
  calculateBox8,
  calculateBox9,
  
  // Combined calculation
  calculateAllBoxes,
  
  // Validation and formatting
  validateBoxCalculations,
  createCalculationSummary,
  formatForSubmission,
  
  // Rounding utilities
  hmrcRound,
  roundToPounds,
  
  // Constants
  ACCOUNTING_SCHEMES,
  VAT_BOX_DESCRIPTIONS
};
