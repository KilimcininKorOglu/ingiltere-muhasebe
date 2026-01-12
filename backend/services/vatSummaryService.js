/**
 * VAT Summary Service
 * 
 * Provides VAT summary report generation for a specified period,
 * separate from the formal VAT return. Offers detailed breakdown
 * of VAT collected (output VAT) and VAT paid (input VAT) with
 * breakdowns by rate and transaction type.
 * 
 * @module services/vatSummaryService
 */

const { query, queryOne } = require('../database/index');

/**
 * UK tax year runs from April 6th to April 5th of the following year.
 */

/**
 * Calculates the UK tax year for a given date.
 * 
 * @param {Date|string} date - The date to check
 * @returns {string} Tax year in 'YYYY-YY' format (e.g., '2025-26')
 */
function getTaxYearForDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 0-indexed
  const day = d.getDate();
  
  // Before April 6th = previous tax year
  if (month < 4 || (month === 4 && day < 6)) {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
  
  return `${year}-${String(year + 1).slice(-2)}`;
}

/**
 * Gets the start and end dates for a UK tax year.
 * 
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {{startDate: string, endDate: string}} Tax year date range
 */
function getTaxYearDates(taxYear) {
  const [startYear] = taxYear.split('-').map(Number);
  
  return {
    startDate: `${startYear}-04-06`,
    endDate: `${startYear + 1}-04-05`
  };
}

/**
 * Gets the English name for a month.
 * 
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
function getMonthName(month) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1] || '';
}

/**
 * Validates date range for VAT summary report.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
function validateDateRange(startDate, endDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!startDate || !dateRegex.test(startDate)) {
    return { isValid: false, error: 'Invalid start date format (YYYY-MM-DD required)' };
  }
  
  if (!endDate || !dateRegex.test(endDate)) {
    return { isValid: false, error: 'Invalid end date format (YYYY-MM-DD required)' };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'Invalid start date' };
  }
  
  if (isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid end date' };
  }
  
  if (start > end) {
    return { isValid: false, error: 'Start date must be before or equal to end date' };
  }
  
  return { isValid: true };
}

/**
 * VAT rate names for display.
 * @type {Object.<number, {en: string, tr: string}>}
 */
const VAT_RATE_NAMES = {
  2000: { en: 'Standard Rate (20%)', tr: 'Standart Oran (%20)' },
  500: { en: 'Reduced Rate (5%)', tr: 'İndirimli Oran (%5)' },
  0: { en: 'Zero Rate (0%)', tr: 'Sıfır Oran (%0)' }
};

/**
 * Gets human-readable name for a VAT rate.
 * 
 * @param {number} vatRate - VAT rate in basis points
 * @param {string} [lang='en'] - Language code
 * @returns {string} Human-readable rate name
 */
function getVatRateName(vatRate, lang = 'en') {
  if (VAT_RATE_NAMES[vatRate]) {
    return VAT_RATE_NAMES[vatRate][lang] || VAT_RATE_NAMES[vatRate].en;
  }
  // For custom rates, show the percentage
  const percentage = vatRate / 100;
  return lang === 'tr' ? `Özel Oran (%${percentage})` : `Custom Rate (${percentage}%)`;
}

/**
 * Gets output VAT (VAT collected on sales) breakdown by rate for a period.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array<Object>} Output VAT breakdown by rate
 */
function getOutputVatByRate(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      vatRate,
      COUNT(*) as transactionCount,
      COALESCE(SUM(amount), 0) as netAmount,
      COALESCE(SUM(vatAmount), 0) as vatAmount,
      COALESCE(SUM(totalAmount), 0) as grossAmount
    FROM transactions
    WHERE userId = ?
      AND type = 'income'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
    GROUP BY vatRate
    ORDER BY vatRate DESC
  `, [userId, startDate, endDate]);
  
  return results.map(row => ({
    vatRate: row.vatRate || 0,
    vatRatePercent: (row.vatRate || 0) / 100,
    transactionCount: row.transactionCount || 0,
    netAmount: row.netAmount || 0,
    vatAmount: row.vatAmount || 0,
    grossAmount: row.grossAmount || 0
  }));
}

/**
 * Gets input VAT (VAT paid on purchases) breakdown by rate for a period.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array<Object>} Input VAT breakdown by rate
 */
function getInputVatByRate(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      vatRate,
      COUNT(*) as transactionCount,
      COALESCE(SUM(amount), 0) as netAmount,
      COALESCE(SUM(vatAmount), 0) as vatAmount,
      COALESCE(SUM(totalAmount), 0) as grossAmount
    FROM transactions
    WHERE userId = ?
      AND type = 'expense'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
    GROUP BY vatRate
    ORDER BY vatRate DESC
  `, [userId, startDate, endDate]);
  
  return results.map(row => ({
    vatRate: row.vatRate || 0,
    vatRatePercent: (row.vatRate || 0) / 100,
    transactionCount: row.transactionCount || 0,
    netAmount: row.netAmount || 0,
    vatAmount: row.vatAmount || 0,
    grossAmount: row.grossAmount || 0
  }));
}

/**
 * Gets total VAT summary for income and expenses.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} VAT totals
 */
function getVatTotals(userId, startDate, endDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as outputNetAmount,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as outputVatAmount,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as outputGrossAmount,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as outputTransactionCount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as inputNetAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as inputVatAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as inputGrossAmount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as inputTransactionCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  return {
    output: {
      netAmount: result?.outputNetAmount || 0,
      vatAmount: result?.outputVatAmount || 0,
      grossAmount: result?.outputGrossAmount || 0,
      transactionCount: result?.outputTransactionCount || 0
    },
    input: {
      netAmount: result?.inputNetAmount || 0,
      vatAmount: result?.inputVatAmount || 0,
      grossAmount: result?.inputGrossAmount || 0,
      transactionCount: result?.inputTransactionCount || 0
    }
  };
}

/**
 * Gets monthly VAT breakdown for the period.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array<Object>} Monthly VAT summary
 */
function getMonthlyVatSummary(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      strftime('%Y', transactionDate) as year,
      strftime('%m', transactionDate) as month,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as outputVat,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as inputVat,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as outputCount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as inputCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
    GROUP BY strftime('%Y', transactionDate), strftime('%m', transactionDate)
    ORDER BY year ASC, month ASC
  `, [userId, startDate, endDate]);
  
  return results.map(row => {
    const outputVat = row.outputVat || 0;
    const inputVat = row.inputVat || 0;
    const netVat = outputVat - inputVat;
    
    return {
      year: parseInt(row.year, 10),
      month: parseInt(row.month, 10),
      monthName: getMonthName(parseInt(row.month, 10)),
      outputVat,
      inputVat,
      netVat,
      isRefundDue: netVat < 0,
      outputTransactionCount: row.outputCount || 0,
      inputTransactionCount: row.inputCount || 0,
      totalTransactionCount: (row.outputCount || 0) + (row.inputCount || 0)
    };
  });
}

/**
 * Gets VAT breakdown by category for a period.
 * 
 * @param {number} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} type - Transaction type ('income' or 'expense')
 * @returns {Array<Object>} VAT breakdown by category
 */
function getVatByCategory(userId, startDate, endDate, type) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COUNT(t.id) as transactionCount,
      COALESCE(SUM(t.amount), 0) as netAmount,
      COALESCE(SUM(t.vatAmount), 0) as vatAmount,
      COALESCE(SUM(t.totalAmount), 0) as grossAmount
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ?
      AND t.type = ?
      AND t.status != 'void'
      AND t.transactionDate >= ?
      AND t.transactionDate <= ?
    GROUP BY c.id
    ORDER BY vatAmount DESC
  `, [userId, type, startDate, endDate]);
  
  return results.map(row => ({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode || 'UNCATEGORIZED',
    categoryName: row.categoryName || 'Uncategorized',
    categoryNameTr: row.categoryNameTr || 'Kategorisiz',
    transactionCount: row.transactionCount || 0,
    netAmount: row.netAmount || 0,
    vatAmount: row.vatAmount || 0,
    grossAmount: row.grossAmount || 0
  }));
}

/**
 * Generates a comprehensive VAT summary report for a given period.
 * This is separate from the formal VAT return and provides a detailed
 * overview of VAT collected and paid.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Report options
 * @param {boolean} [options.includeCategoryBreakdown=false] - Include breakdown by category
 * @param {boolean} [options.includeMonthlyBreakdown=true] - Include monthly breakdown
 * @returns {Object} VAT summary report
 */
function generateVatSummaryReport(userId, startDate, endDate, options = {}) {
  const {
    includeCategoryBreakdown = false,
    includeMonthlyBreakdown = true
  } = options;
  
  // Get tax year for the period
  const taxYear = getTaxYearForDate(startDate);
  
  // Get VAT breakdown by rate for output (sales) and input (purchases)
  const outputVatByRate = getOutputVatByRate(userId, startDate, endDate);
  const inputVatByRate = getInputVatByRate(userId, startDate, endDate);
  
  // Get totals
  const totals = getVatTotals(userId, startDate, endDate);
  
  // Calculate net VAT position
  const netVatAmount = totals.output.vatAmount - totals.input.vatAmount;
  const isRefundDue = netVatAmount < 0;
  
  // Build the report
  const report = {
    period: {
      startDate,
      endDate,
      taxYear
    },
    outputVat: {
      byRate: outputVatByRate.map(rate => ({
        ...rate,
        rateName: {
          en: getVatRateName(rate.vatRate, 'en'),
          tr: getVatRateName(rate.vatRate, 'tr')
        }
      })),
      totals: totals.output
    },
    inputVat: {
      byRate: inputVatByRate.map(rate => ({
        ...rate,
        rateName: {
          en: getVatRateName(rate.vatRate, 'en'),
          tr: getVatRateName(rate.vatRate, 'tr')
        }
      })),
      totals: totals.input
    },
    netPosition: {
      outputVat: totals.output.vatAmount,
      inputVat: totals.input.vatAmount,
      netVat: netVatAmount,
      isRefundDue,
      description: {
        en: isRefundDue 
          ? `VAT refund due: £${Math.abs(netVatAmount / 100).toFixed(2)}`
          : `VAT payable: £${(netVatAmount / 100).toFixed(2)}`,
        tr: isRefundDue 
          ? `KDV iadesi alınacak: £${Math.abs(netVatAmount / 100).toFixed(2)}`
          : `Ödenecek KDV: £${(netVatAmount / 100).toFixed(2)}`
      }
    },
    transactionCounts: {
      output: totals.output.transactionCount,
      input: totals.input.transactionCount,
      total: totals.output.transactionCount + totals.input.transactionCount
    }
  };
  
  // Add monthly breakdown if requested
  if (includeMonthlyBreakdown) {
    report.monthlyBreakdown = getMonthlyVatSummary(userId, startDate, endDate);
  }
  
  // Add category breakdown if requested
  if (includeCategoryBreakdown) {
    report.categoryBreakdown = {
      output: getVatByCategory(userId, startDate, endDate, 'income'),
      input: getVatByCategory(userId, startDate, endDate, 'expense')
    };
  }
  
  return report;
}

/**
 * Generates a VAT summary report for a specific tax year.
 * 
 * @param {number} userId - The user ID
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @param {Object} options - Report options
 * @returns {Object} VAT summary report for the tax year
 */
function generateVatSummaryForTaxYear(userId, taxYear, options = {}) {
  const { startDate, endDate } = getTaxYearDates(taxYear);
  return generateVatSummaryReport(userId, startDate, endDate, options);
}

/**
 * Generates a VAT summary report for a specific month.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {Object} options - Report options
 * @returns {Object} VAT summary report for the month
 */
function generateVatSummaryForMonth(userId, year, month, options = {}) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  // Monthly reports don't need monthly breakdown by default
  const adjustedOptions = {
    ...options,
    includeMonthlyBreakdown: options.includeMonthlyBreakdown !== undefined 
      ? options.includeMonthlyBreakdown 
      : false
  };
  
  return generateVatSummaryReport(userId, startDate, endDate, adjustedOptions);
}

/**
 * Generates a VAT summary report for a specific quarter.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} quarter - The quarter (1-4)
 * @param {Object} options - Report options
 * @returns {Object} VAT summary report for the quarter
 */
function generateVatSummaryForQuarter(userId, year, quarter, options = {}) {
  const quarterStartMonths = { 1: 1, 2: 4, 3: 7, 4: 10 };
  const startMonth = quarterStartMonths[quarter];
  
  if (!startMonth) {
    throw new Error('Invalid quarter. Must be 1, 2, 3, or 4.');
  }
  
  const endMonth = startMonth + 2;
  
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateVatSummaryReport(userId, startDate, endDate, options);
}

module.exports = {
  // Main report generation
  generateVatSummaryReport,
  generateVatSummaryForTaxYear,
  generateVatSummaryForMonth,
  generateVatSummaryForQuarter,
  
  // Component functions (for testing)
  getOutputVatByRate,
  getInputVatByRate,
  getVatTotals,
  getMonthlyVatSummary,
  getVatByCategory,
  
  // Utility functions
  validateDateRange,
  getVatRateName,
  getTaxYearForDate,
  getTaxYearDates,
  getMonthName
};
