/**
 * Balance Sheet Service
 * 
 * Provides Balance Sheet report calculations for financial reporting.
 * Shows the financial position at a specific point in time.
 * Follows the accounting equation: Assets = Liabilities + Equity
 * 
 * Balance Sheet Structure:
 * - Assets: Current Assets + Non-Current Assets
 * - Liabilities: Current Liabilities + Non-Current Liabilities
 * - Equity: Owner's Equity + Retained Earnings (including current period earnings)
 * 
 * @module services/balanceSheetService
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
 * Validates the as-of date for Balance Sheet report.
 * 
 * @param {string} asOfDate - Date in YYYY-MM-DD format
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
function validateAsOfDate(asOfDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!asOfDate || !dateRegex.test(asOfDate)) {
    return { isValid: false, error: 'Invalid date format (YYYY-MM-DD required)' };
  }
  
  const date = new Date(asOfDate);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date' };
  }
  
  return { isValid: true };
}

/**
 * Calculates the previous period date for comparison.
 * 
 * @param {string} asOfDate - The current as-of date
 * @returns {string} Previous period date (one year earlier)
 */
function getPreviousPeriodDate(asOfDate) {
  const date = new Date(asOfDate);
  date.setFullYear(date.getFullYear() - 1);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Gets assets grouped by category up to a specific date.
 * Assets have positive balances from debit entries.
 * 
 * For balance sheet purposes:
 * - Income transactions in asset categories increase assets
 * - Expense transactions in asset categories decrease assets
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @returns {Array} Assets by category with balances
 */
function getAssetsByCategory(userId, asOfDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(
        CASE 
          WHEN t.type = 'income' THEN t.amount
          WHEN t.type = 'expense' THEN -t.amount
          ELSE 0
        END
      ), 0) as balance,
      COUNT(t.id) as transactionCount
    FROM categories c
    LEFT JOIN transactions t ON t.categoryId = c.id 
      AND t.userId = ?
      AND t.status != 'void'
      AND t.transactionDate <= ?
    WHERE c.type = 'asset'
      AND c.isActive = 1
    GROUP BY c.id
    HAVING balance != 0 OR transactionCount > 0
    ORDER BY c.displayOrder ASC, c.code ASC, c.name ASC
  `, [userId, asOfDate]);
  
  return results.map(row => ({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode || 'UNCATEGORIZED',
    categoryName: row.categoryName || 'Uncategorized',
    categoryNameTr: row.categoryNameTr || 'Kategorisiz',
    balance: row.balance,
    transactionCount: row.transactionCount
  }));
}

/**
 * Gets liabilities grouped by category up to a specific date.
 * Liabilities have positive balances from credit entries.
 * 
 * For balance sheet purposes:
 * - Income transactions in liability categories increase liabilities
 * - Expense transactions in liability categories decrease liabilities
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @returns {Array} Liabilities by category with balances
 */
function getLiabilitiesByCategory(userId, asOfDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(
        CASE 
          WHEN t.type = 'income' THEN t.amount
          WHEN t.type = 'expense' THEN -t.amount
          ELSE 0
        END
      ), 0) as balance,
      COUNT(t.id) as transactionCount
    FROM categories c
    LEFT JOIN transactions t ON t.categoryId = c.id 
      AND t.userId = ?
      AND t.status != 'void'
      AND t.transactionDate <= ?
    WHERE c.type = 'liability'
      AND c.isActive = 1
    GROUP BY c.id
    HAVING balance != 0 OR transactionCount > 0
    ORDER BY c.displayOrder ASC, c.code ASC, c.name ASC
  `, [userId, asOfDate]);
  
  return results.map(row => ({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode || 'UNCATEGORIZED',
    categoryName: row.categoryName || 'Uncategorized',
    categoryNameTr: row.categoryNameTr || 'Kategorisiz',
    balance: row.balance,
    transactionCount: row.transactionCount
  }));
}

/**
 * Gets equity accounts grouped by category up to a specific date.
 * Equity represents owner's investment and retained earnings.
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @returns {Array} Equity by category with balances
 */
function getEquityByCategory(userId, asOfDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(
        CASE 
          WHEN t.type = 'income' THEN t.amount
          WHEN t.type = 'expense' THEN -t.amount
          ELSE 0
        END
      ), 0) as balance,
      COUNT(t.id) as transactionCount
    FROM categories c
    LEFT JOIN transactions t ON t.categoryId = c.id 
      AND t.userId = ?
      AND t.status != 'void'
      AND t.transactionDate <= ?
    WHERE c.type = 'equity'
      AND c.isActive = 1
    GROUP BY c.id
    HAVING balance != 0 OR transactionCount > 0
    ORDER BY c.displayOrder ASC, c.code ASC, c.name ASC
  `, [userId, asOfDate]);
  
  return results.map(row => ({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode || 'UNCATEGORIZED',
    categoryName: row.categoryName || 'Uncategorized',
    categoryNameTr: row.categoryNameTr || 'Kategorisiz',
    balance: row.balance,
    transactionCount: row.transactionCount
  }));
}

/**
 * Calculates retained earnings up to a specific date.
 * Retained earnings = All historical income - All historical expenses
 * This represents the accumulated profits that have been retained in the business.
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @returns {number} Retained earnings amount
 */
function calculateRetainedEarnings(userId, asOfDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status != 'void' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status != 'void' THEN t.amount ELSE 0 END), 0) as retainedEarnings
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.transactionDate <= ?
      AND c.type IN ('income', 'expense')
  `, [userId, asOfDate]);
  
  return result?.retainedEarnings || 0;
}

/**
 * Calculates current period earnings (for the current tax year or fiscal year).
 * This is the net income for the current period that hasn't been closed yet.
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @returns {{income: number, expenses: number, netIncome: number, periodStart: string, periodEnd: string}}
 */
function calculateCurrentPeriodEarnings(userId, asOfDate) {
  // Determine the start of the current tax year
  const taxYear = getTaxYearForDate(asOfDate);
  const { startDate: periodStart } = getTaxYearDates(taxYear);
  
  // If as-of date is before the tax year start, use as-of date as period end
  const effectivePeriodStart = periodStart > asOfDate ? `${parseInt(taxYear.split('-')[0]) - 1}-04-06` : periodStart;
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status != 'void' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status != 'void' THEN t.amount ELSE 0 END), 0) as expenses
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.transactionDate >= ?
      AND t.transactionDate <= ?
      AND c.type IN ('income', 'expense')
  `, [userId, effectivePeriodStart, asOfDate]);
  
  const income = result?.income || 0;
  const expenses = result?.expenses || 0;
  
  return {
    income,
    expenses,
    netIncome: income - expenses,
    periodStart: effectivePeriodStart,
    periodEnd: asOfDate
  };
}

/**
 * Gets the summary totals for assets, liabilities, and equity.
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @returns {Object} Totals for assets, liabilities, and equity
 */
function getSummaryTotals(userId, asOfDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE 
        WHEN c.type = 'asset' THEN 
          CASE WHEN t.type = 'income' THEN t.amount WHEN t.type = 'expense' THEN -t.amount ELSE 0 END
        ELSE 0 
      END), 0) as totalAssets,
      COALESCE(SUM(CASE 
        WHEN c.type = 'liability' THEN 
          CASE WHEN t.type = 'income' THEN t.amount WHEN t.type = 'expense' THEN -t.amount ELSE 0 END
        ELSE 0 
      END), 0) as totalLiabilities,
      COALESCE(SUM(CASE 
        WHEN c.type = 'equity' THEN 
          CASE WHEN t.type = 'income' THEN t.amount WHEN t.type = 'expense' THEN -t.amount ELSE 0 END
        ELSE 0 
      END), 0) as totalEquityAccounts,
      COUNT(DISTINCT CASE WHEN c.type = 'asset' THEN t.id END) as assetTransactionCount,
      COUNT(DISTINCT CASE WHEN c.type = 'liability' THEN t.id END) as liabilityTransactionCount,
      COUNT(DISTINCT CASE WHEN c.type = 'equity' THEN t.id END) as equityTransactionCount
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.status != 'void'
      AND t.transactionDate <= ?
  `, [userId, asOfDate]);
  
  return {
    totalAssets: result?.totalAssets || 0,
    totalLiabilities: result?.totalLiabilities || 0,
    totalEquityAccounts: result?.totalEquityAccounts || 0,
    assetTransactionCount: result?.assetTransactionCount || 0,
    liabilityTransactionCount: result?.liabilityTransactionCount || 0,
    equityTransactionCount: result?.equityTransactionCount || 0
  };
}

/**
 * Calculates percentage change between two values.
 * 
 * @param {number} current - Current period value
 * @param {number} previous - Previous period value
 * @returns {number|null} Percentage change or null if previous is 0
 */
function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100; // 2 decimal places
}

/**
 * Generates a Balance Sheet report for a given user as of a specific date.
 * 
 * The balance sheet shows the financial position at a point in time.
 * 
 * @param {number} userId - The user ID
 * @param {string} asOfDate - The as-of date in YYYY-MM-DD format
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.includeComparison=false] - Include previous period comparison
 * @returns {{
 *   asOfDate: string,
 *   taxYear: string,
 *   assets: {
 *     categories: Array,
 *     total: number,
 *     transactionCount: number
 *   },
 *   liabilities: {
 *     categories: Array,
 *     total: number,
 *     transactionCount: number
 *   },
 *   equity: {
 *     categories: Array,
 *     retainedEarnings: number,
 *     currentPeriodEarnings: Object,
 *     total: number,
 *     transactionCount: number
 *   },
 *   summary: {
 *     totalAssets: number,
 *     totalLiabilities: number,
 *     totalEquity: number,
 *     isBalanced: boolean,
 *     balanceDifference: number
 *   },
 *   comparison?: Object
 * }}
 */
function generateBalanceSheetReport(userId, asOfDate, options = {}) {
  const { includeComparison = false } = options;
  
  // Get the tax year for the as-of date
  const taxYear = getTaxYearForDate(asOfDate);
  
  // Get assets by category
  const assetCategories = getAssetsByCategory(userId, asOfDate);
  
  // Get liabilities by category
  const liabilityCategories = getLiabilitiesByCategory(userId, asOfDate);
  
  // Get equity accounts by category
  const equityCategories = getEquityByCategory(userId, asOfDate);
  
  // Get summary totals
  const summaryTotals = getSummaryTotals(userId, asOfDate);
  
  // Calculate retained earnings (cumulative profits)
  const retainedEarnings = calculateRetainedEarnings(userId, asOfDate);
  
  // Calculate current period earnings
  const currentPeriodEarnings = calculateCurrentPeriodEarnings(userId, asOfDate);
  
  // Calculate total assets
  const totalAssets = assetCategories.reduce((sum, cat) => sum + cat.balance, 0);
  const assetTransactionCount = assetCategories.reduce((sum, cat) => sum + cat.transactionCount, 0);
  
  // Calculate total liabilities
  const totalLiabilities = liabilityCategories.reduce((sum, cat) => sum + cat.balance, 0);
  const liabilityTransactionCount = liabilityCategories.reduce((sum, cat) => sum + cat.transactionCount, 0);
  
  // Calculate total equity (equity accounts + retained earnings)
  const totalEquityAccounts = equityCategories.reduce((sum, cat) => sum + cat.balance, 0);
  const equityTransactionCount = equityCategories.reduce((sum, cat) => sum + cat.transactionCount, 0);
  const totalEquity = totalEquityAccounts + retainedEarnings;
  
  // Check if the balance sheet balances (Assets = Liabilities + Equity)
  const expectedTotal = totalLiabilities + totalEquity;
  const balanceDifference = totalAssets - expectedTotal;
  const isBalanced = Math.abs(balanceDifference) < 1; // Allow for small rounding differences
  
  const report = {
    asOfDate,
    taxYear,
    assets: {
      categories: assetCategories,
      total: totalAssets,
      transactionCount: assetTransactionCount
    },
    liabilities: {
      categories: liabilityCategories,
      total: totalLiabilities,
      transactionCount: liabilityTransactionCount
    },
    equity: {
      categories: equityCategories,
      retainedEarnings,
      currentPeriodEarnings,
      total: totalEquity,
      transactionCount: equityTransactionCount
    },
    summary: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
      balanceDifference
    }
  };
  
  // Include period comparison if requested
  if (includeComparison) {
    const prevDate = getPreviousPeriodDate(asOfDate);
    
    // Get previous period totals
    const prevAssetCategories = getAssetsByCategory(userId, prevDate);
    const prevLiabilityCategories = getLiabilitiesByCategory(userId, prevDate);
    const prevEquityCategories = getEquityByCategory(userId, prevDate);
    const prevRetainedEarnings = calculateRetainedEarnings(userId, prevDate);
    
    const prevTotalAssets = prevAssetCategories.reduce((sum, cat) => sum + cat.balance, 0);
    const prevTotalLiabilities = prevLiabilityCategories.reduce((sum, cat) => sum + cat.balance, 0);
    const prevTotalEquityAccounts = prevEquityCategories.reduce((sum, cat) => sum + cat.balance, 0);
    const prevTotalEquity = prevTotalEquityAccounts + prevRetainedEarnings;
    
    report.comparison = {
      previousDate: prevDate,
      previous: {
        totalAssets: prevTotalAssets,
        totalLiabilities: prevTotalLiabilities,
        totalEquity: prevTotalEquity
      },
      changes: {
        assetChange: totalAssets - prevTotalAssets,
        assetChangePercent: calculatePercentageChange(totalAssets, prevTotalAssets),
        liabilityChange: totalLiabilities - prevTotalLiabilities,
        liabilityChangePercent: calculatePercentageChange(totalLiabilities, prevTotalLiabilities),
        equityChange: totalEquity - prevTotalEquity,
        equityChangePercent: calculatePercentageChange(totalEquity, prevTotalEquity)
      }
    };
  }
  
  return report;
}

/**
 * Generates a Balance Sheet report for a specific tax year end.
 * 
 * @param {number} userId - The user ID
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @param {Object} options - Optional parameters
 * @returns {Object} Balance Sheet report for the tax year end
 */
function generateBalanceSheetForTaxYear(userId, taxYear, options = {}) {
  const { endDate } = getTaxYearDates(taxYear);
  return generateBalanceSheetReport(userId, endDate, options);
}

/**
 * Generates a Balance Sheet report for a specific month end.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {Object} options - Optional parameters
 * @returns {Object} Balance Sheet report for the month end
 */
function generateBalanceSheetForMonth(userId, year, month, options = {}) {
  const lastDay = new Date(year, month, 0).getDate();
  const asOfDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateBalanceSheetReport(userId, asOfDate, options);
}

/**
 * Generates a Balance Sheet report for a specific quarter end.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} quarter - The quarter (1-4)
 * @param {Object} options - Optional parameters
 * @returns {Object} Balance Sheet report for the quarter end
 */
function generateBalanceSheetForQuarter(userId, year, quarter, options = {}) {
  const quarterEndMonths = { 1: 3, 2: 6, 3: 9, 4: 12 };
  const endMonth = quarterEndMonths[quarter];
  
  if (!endMonth) {
    throw new Error('Invalid quarter. Must be 1, 2, 3, or 4.');
  }
  
  const lastDay = new Date(year, endMonth, 0).getDate();
  const asOfDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateBalanceSheetReport(userId, asOfDate, options);
}

module.exports = {
  // Main report generation
  generateBalanceSheetReport,
  generateBalanceSheetForTaxYear,
  generateBalanceSheetForMonth,
  generateBalanceSheetForQuarter,
  
  // Component functions (for testing)
  getAssetsByCategory,
  getLiabilitiesByCategory,
  getEquityByCategory,
  calculateRetainedEarnings,
  calculateCurrentPeriodEarnings,
  getSummaryTotals,
  
  // Utility functions
  validateAsOfDate,
  getPreviousPeriodDate,
  calculatePercentageChange,
  getTaxYearForDate,
  getTaxYearDates,
  getMonthName
};
