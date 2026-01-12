/**
 * VAT Calculation Service
 * 
 * Provides VAT return calculation functionality by aggregating transactions
 * and invoices to compute all nine HMRC VAT return boxes.
 * 
 * Supports both standard and cash accounting schemes as per HMRC requirements.
 * 
 * HMRC VAT Return Boxes:
 * - Box 1: VAT due on sales and other outputs
 * - Box 2: VAT due on acquisitions from EU (now 0 post-Brexit)
 * - Box 3: Total VAT due (Box 1 + Box 2)
 * - Box 4: VAT reclaimed on purchases and other inputs
 * - Box 5: Net VAT to pay or reclaim (Box 3 - Box 4)
 * - Box 6: Total value of sales and outputs (excluding VAT)
 * - Box 7: Total value of purchases and inputs (excluding VAT)
 * - Box 8: Total value of supplies to EU (now 0 post-Brexit)
 * - Box 9: Total value of acquisitions from EU (now 0 post-Brexit)
 * 
 * @module services/vatCalculationService
 */

const { query, queryOne } = require('../database/index');
const {
  calculateAllBoxes,
  validateBoxCalculations,
  createCalculationSummary,
  formatForSubmission,
  ACCOUNTING_SCHEMES
} = require('../utils/vatBoxCalculator');

/**
 * Validates date format (YYYY-MM-DD).
 * 
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates the VAT calculation parameters.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @returns {Object} Validation result with isValid and errors
 */
function validateCalculationParams(userId, periodStart, periodEnd) {
  const errors = {};
  
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    errors.userId = 'Valid userId is required';
  }
  
  if (!isValidDate(periodStart)) {
    errors.periodStart = 'Invalid periodStart format (YYYY-MM-DD required)';
  }
  
  if (!isValidDate(periodEnd)) {
    errors.periodEnd = 'Invalid periodEnd format (YYYY-MM-DD required)';
  }
  
  if (isValidDate(periodStart) && isValidDate(periodEnd)) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (start > end) {
      errors.periodEnd = 'periodEnd must be on or after periodStart';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Gets income transactions for a VAT period.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Query options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @returns {Array} Array of income transactions
 */
function getIncomeTransactions(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD } = options;
  
  // For standard accounting, we use transaction date
  // For cash accounting, we would ideally use payment date, but
  // for simplicity we'll use transactions with 'confirmed' or 'cleared' status
  let sql;
  let params;
  
  if (accountingScheme === ACCOUNTING_SCHEMES.CASH) {
    // Cash accounting: Only include transactions that represent actual payments received
    // 'cleared' and 'reconciled' indicate confirmed payments
    sql = `
      SELECT * FROM transactions
      WHERE userId = ?
        AND type = 'income'
        AND status IN ('cleared', 'reconciled')
        AND transactionDate >= ?
        AND transactionDate <= ?
      ORDER BY transactionDate ASC
    `;
    params = [userId, periodStart, periodEnd];
  } else {
    // Standard accounting: Include all non-void income transactions
    sql = `
      SELECT * FROM transactions
      WHERE userId = ?
        AND type = 'income'
        AND status != 'void'
        AND transactionDate >= ?
        AND transactionDate <= ?
      ORDER BY transactionDate ASC
    `;
    params = [userId, periodStart, periodEnd];
  }
  
  return query(sql, params);
}

/**
 * Gets expense transactions for a VAT period.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Query options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @returns {Array} Array of expense transactions
 */
function getExpenseTransactions(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD } = options;
  
  let sql;
  let params;
  
  if (accountingScheme === ACCOUNTING_SCHEMES.CASH) {
    // Cash accounting: Only include transactions that represent actual payments made
    // 'cleared' and 'reconciled' indicate confirmed payments
    sql = `
      SELECT * FROM transactions
      WHERE userId = ?
        AND type = 'expense'
        AND status IN ('cleared', 'reconciled')
        AND transactionDate >= ?
        AND transactionDate <= ?
      ORDER BY transactionDate ASC
    `;
    params = [userId, periodStart, periodEnd];
  } else {
    // Standard accounting: Include all non-void expense transactions
    sql = `
      SELECT * FROM transactions
      WHERE userId = ?
        AND type = 'expense'
        AND status != 'void'
        AND transactionDate >= ?
        AND transactionDate <= ?
      ORDER BY transactionDate ASC
    `;
    params = [userId, periodStart, periodEnd];
  }
  
  return query(sql, params);
}

/**
 * Gets sales invoices for a VAT period.
 * Used primarily for standard accounting scheme.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @returns {Array} Array of sales invoices
 */
function getSalesInvoices(userId, periodStart, periodEnd) {
  const sql = `
    SELECT * FROM invoices
    WHERE userId = ?
      AND status NOT IN ('void', 'cancelled')
      AND issueDate >= ?
      AND issueDate <= ?
    ORDER BY issueDate ASC
  `;
  
  return query(sql, [userId, periodStart, periodEnd]);
}

/**
 * Calculates VAT return boxes for a given period.
 * This is the main entry point for VAT calculations.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {Object} options - Calculation options
 * @param {string} [options.accountingScheme='standard'] - 'standard' or 'cash'
 * @param {boolean} [options.roundToPounds=false] - Round to whole pounds for submission
 * @param {boolean} [options.includeBreakdown=false] - Include detailed breakdown
 * @returns {Object} Calculation result
 */
function calculateVatReturn(userId, periodStart, periodEnd, options = {}) {
  const {
    accountingScheme = ACCOUNTING_SCHEMES.STANDARD,
    roundToPounds = false,
    includeBreakdown = false
  } = options;
  
  // Validate parameters
  const validation = validateCalculationParams(userId, periodStart, periodEnd);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }
  
  // Validate accounting scheme
  if (!Object.values(ACCOUNTING_SCHEMES).includes(accountingScheme)) {
    return {
      success: false,
      errors: {
        accountingScheme: `Invalid accounting scheme. Must be one of: ${Object.values(ACCOUNTING_SCHEMES).join(', ')}`
      }
    };
  }
  
  try {
    // Fetch data for the period
    const incomeTransactions = getIncomeTransactions(userId, periodStart, periodEnd, { accountingScheme });
    const expenseTransactions = getExpenseTransactions(userId, periodStart, periodEnd, { accountingScheme });
    const salesInvoices = accountingScheme === ACCOUNTING_SCHEMES.STANDARD
      ? getSalesInvoices(userId, periodStart, periodEnd)
      : [];
    
    // Calculate all boxes
    const boxes = calculateAllBoxes(
      {
        incomeTransactions,
        expenseTransactions,
        salesInvoices
      },
      {
        accountingScheme,
        roundToPounds
      }
    );
    
    // Validate the calculations
    const boxValidation = validateBoxCalculations(boxes);
    
    // Build result
    const result = {
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd
        },
        accountingScheme,
        boxes: {
          box1: boxes.box1,
          box2: boxes.box2,
          box3: boxes.box3,
          box4: boxes.box4,
          box5: boxes.box5,
          box6: boxes.box6,
          box7: boxes.box7,
          box8: boxes.box8,
          box9: boxes.box9
        },
        summary: {
          vatDue: boxes.box3,
          vatReclaimed: boxes.box4,
          netVat: boxes.box5,
          isRefundDue: boxes.box5 < 0,
          totalSales: boxes.box6,
          totalPurchases: boxes.box7
        },
        validation: boxValidation,
        metadata: boxes.metadata
      }
    };
    
    // Include breakdown if requested
    if (includeBreakdown) {
      result.data.breakdown = {
        income: {
          transactionCount: incomeTransactions.length,
          invoiceCount: salesInvoices.length,
          totalVat: boxes.box1,
          totalNet: boxes.box6
        },
        expense: {
          transactionCount: expenseTransactions.length,
          totalVat: boxes.box4,
          totalNet: boxes.box7
        }
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('Error calculating VAT return:', error.message);
    return {
      success: false,
      errors: {
        general: 'Failed to calculate VAT return'
      }
    };
  }
}

/**
 * Calculates VAT return and creates/updates a VatReturn record.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {Object} options - Calculation options
 * @returns {Object} Result with calculated values for saving
 */
function calculateAndPrepareVatReturn(userId, periodStart, periodEnd, options = {}) {
  const calculationResult = calculateVatReturn(userId, periodStart, periodEnd, options);
  
  if (!calculationResult.success) {
    return calculationResult;
  }
  
  const { boxes } = calculationResult.data;
  
  // Prepare data for VatReturn model
  return {
    success: true,
    data: {
      userId,
      periodStart,
      periodEnd,
      box1: boxes.box1,
      box2: boxes.box2,
      box3: boxes.box3,
      box4: boxes.box4,
      box5: boxes.box5,
      box6: boxes.box6,
      box7: boxes.box7,
      box8: boxes.box8,
      box9: boxes.box9,
      status: 'draft',
      accountingScheme: options.accountingScheme || ACCOUNTING_SCHEMES.STANDARD
    },
    calculationDetails: calculationResult.data
  };
}

/**
 * Gets a VAT calculation preview without saving.
 * Useful for showing users what their VAT return would look like.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {Object} options - Calculation options
 * @param {string} [options.language='en'] - Language for descriptions
 * @returns {Object} Preview result with formatted summary
 */
function getVatReturnPreview(userId, periodStart, periodEnd, options = {}) {
  const { language = 'en', ...calcOptions } = options;
  
  const calculationResult = calculateVatReturn(userId, periodStart, periodEnd, {
    ...calcOptions,
    includeBreakdown: true
  });
  
  if (!calculationResult.success) {
    return calculationResult;
  }
  
  const { boxes } = calculationResult.data;
  const summary = createCalculationSummary(boxes, language);
  
  return {
    success: true,
    data: {
      ...calculationResult.data,
      formattedSummary: summary,
      submissionFormat: formatForSubmission(boxes)
    }
  };
}

/**
 * Compares VAT calculations between two periods.
 * Useful for period-over-period analysis.
 * 
 * @param {number} userId - User ID
 * @param {Object} currentPeriod - Current period dates
 * @param {string} currentPeriod.start - Start date
 * @param {string} currentPeriod.end - End date
 * @param {Object} previousPeriod - Previous period dates
 * @param {string} previousPeriod.start - Start date
 * @param {string} previousPeriod.end - End date
 * @param {Object} options - Calculation options
 * @returns {Object} Comparison result
 */
function compareVatPeriods(userId, currentPeriod, previousPeriod, options = {}) {
  const currentResult = calculateVatReturn(
    userId,
    currentPeriod.start,
    currentPeriod.end,
    options
  );
  
  const previousResult = calculateVatReturn(
    userId,
    previousPeriod.start,
    previousPeriod.end,
    options
  );
  
  if (!currentResult.success) {
    return { success: false, errors: { current: currentResult.errors } };
  }
  
  if (!previousResult.success) {
    return { success: false, errors: { previous: previousResult.errors } };
  }
  
  const current = currentResult.data.boxes;
  const previous = previousResult.data.boxes;
  
  // Calculate changes
  const changes = {};
  for (let i = 1; i <= 9; i++) {
    const boxKey = `box${i}`;
    const currentValue = current[boxKey] || 0;
    const previousValue = previous[boxKey] || 0;
    const change = currentValue - previousValue;
    const percentChange = previousValue !== 0
      ? Math.round((change / Math.abs(previousValue)) * 10000) / 100
      : (currentValue !== 0 ? null : 0);
    
    changes[boxKey] = {
      current: currentValue,
      previous: previousValue,
      change,
      percentChange
    };
  }
  
  return {
    success: true,
    data: {
      currentPeriod: currentResult.data,
      previousPeriod: previousResult.data,
      changes
    }
  };
}

/**
 * Estimates VAT liability for a future period based on historical data.
 * Uses average of previous periods.
 * 
 * @param {number} userId - User ID
 * @param {number} periodsToAverage - Number of previous periods to average
 * @param {Object} options - Calculation options
 * @returns {Object} Estimated VAT liability
 */
function estimateVatLiability(userId, periodsToAverage = 4, options = {}) {
  // Get the most recent VAT returns for averaging
  const recentReturns = query(`
    SELECT * FROM vat_returns
    WHERE userId = ?
      AND status IN ('submitted', 'accepted')
    ORDER BY periodEnd DESC
    LIMIT ?
  `, [userId, periodsToAverage]);
  
  if (!recentReturns || recentReturns.length === 0) {
    return {
      success: true,
      data: {
        estimated: false,
        message: 'No historical data available for estimation',
        averages: null
      }
    };
  }
  
  // Calculate averages
  const averages = {
    box1: 0, box2: 0, box3: 0, box4: 0, box5: 0,
    box6: 0, box7: 0, box8: 0, box9: 0
  };
  
  for (const vatReturn of recentReturns) {
    for (let i = 1; i <= 9; i++) {
      const boxKey = `box${i}`;
      averages[boxKey] += vatReturn[boxKey] || 0;
    }
  }
  
  const count = recentReturns.length;
  for (const key in averages) {
    averages[key] = Math.round(averages[key] / count);
  }
  
  return {
    success: true,
    data: {
      estimated: true,
      periodsUsed: count,
      averages,
      estimatedNetVat: averages.box5,
      isEstimatedRefund: averages.box5 < 0
    }
  };
}

/**
 * Gets VAT summary statistics for a user.
 * 
 * @param {number} userId - User ID
 * @param {number} year - Year to get stats for
 * @returns {Object} Summary statistics
 */
function getVatStatistics(userId, year) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  // Get all transactions for the year
  const incomeResult = queryOne(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as totalNet,
      COALESCE(SUM(vatAmount), 0) as totalVat,
      COALESCE(SUM(totalAmount), 0) as total
    FROM transactions
    WHERE userId = ?
      AND type = 'income'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  const expenseResult = queryOne(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as totalNet,
      COALESCE(SUM(vatAmount), 0) as totalVat,
      COALESCE(SUM(totalAmount), 0) as total
    FROM transactions
    WHERE userId = ?
      AND type = 'expense'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  const invoiceResult = queryOne(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(subtotal), 0) as totalNet,
      COALESCE(SUM(vatAmount), 0) as totalVat,
      COALESCE(SUM(totalAmount), 0) as total
    FROM invoices
    WHERE userId = ?
      AND status NOT IN ('void', 'cancelled')
      AND issueDate >= ?
      AND issueDate <= ?
  `, [userId, startDate, endDate]);
  
  const vatReturnResult = queryOne(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(box1), 0) as totalBox1,
      COALESCE(SUM(box4), 0) as totalBox4,
      COALESCE(SUM(box5), 0) as totalBox5
    FROM vat_returns
    WHERE userId = ?
      AND periodStart >= ?
      AND periodEnd <= ?
      AND status IN ('submitted', 'accepted')
  `, [userId, startDate, endDate]);
  
  return {
    success: true,
    data: {
      year,
      income: {
        transactionCount: incomeResult?.count || 0,
        totalNet: incomeResult?.totalNet || 0,
        totalVat: incomeResult?.totalVat || 0,
        totalGross: incomeResult?.total || 0
      },
      expenses: {
        transactionCount: expenseResult?.count || 0,
        totalNet: expenseResult?.totalNet || 0,
        totalVat: expenseResult?.totalVat || 0,
        totalGross: expenseResult?.total || 0
      },
      invoices: {
        count: invoiceResult?.count || 0,
        totalNet: invoiceResult?.totalNet || 0,
        totalVat: invoiceResult?.totalVat || 0,
        totalGross: invoiceResult?.total || 0
      },
      vatReturns: {
        count: vatReturnResult?.count || 0,
        totalVatDue: vatReturnResult?.totalBox1 || 0,
        totalVatReclaimed: vatReturnResult?.totalBox4 || 0,
        netVat: vatReturnResult?.totalBox5 || 0
      },
      summary: {
        outputVat: incomeResult?.totalVat || 0,
        inputVat: expenseResult?.totalVat || 0,
        estimatedNetVat: (incomeResult?.totalVat || 0) - (expenseResult?.totalVat || 0)
      }
    }
  };
}

/**
 * Validates if a VAT return calculation matches a saved return.
 * Useful for verifying data integrity before submission.
 * 
 * @param {Object} savedReturn - Saved VAT return from database
 * @param {Object} calculatedBoxes - Freshly calculated boxes
 * @returns {Object} Validation result
 */
function validateAgainstSaved(savedReturn, calculatedBoxes) {
  const discrepancies = [];
  
  for (let i = 1; i <= 9; i++) {
    const boxKey = `box${i}`;
    const savedValue = savedReturn[boxKey] || 0;
    const calculatedValue = calculatedBoxes[boxKey] || 0;
    
    if (savedValue !== calculatedValue) {
      discrepancies.push({
        box: boxKey,
        saved: savedValue,
        calculated: calculatedValue,
        difference: calculatedValue - savedValue
      });
    }
  }
  
  return {
    isValid: discrepancies.length === 0,
    discrepancies
  };
}

module.exports = {
  // Main calculation functions
  calculateVatReturn,
  calculateAndPrepareVatReturn,
  getVatReturnPreview,
  
  // Comparison and analysis
  compareVatPeriods,
  estimateVatLiability,
  getVatStatistics,
  
  // Data retrieval
  getIncomeTransactions,
  getExpenseTransactions,
  getSalesInvoices,
  
  // Validation
  validateCalculationParams,
  validateAgainstSaved,
  
  // Constants
  ACCOUNTING_SCHEMES
};
