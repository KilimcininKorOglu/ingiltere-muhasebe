/**
 * Cash Flow Statement Service
 * 
 * Provides Cash Flow Statement report calculations for financial reporting.
 * Shows the movement of cash during a specified period, tracking opening and closing balances.
 * Categorizes cash movements by type and reconciles with bank account movements.
 * 
 * Cash Flow Statement Structure:
 * - Opening Balance: Cash at the beginning of the period
 * - Cash Inflows: All cash receipts during the period
 * - Cash Outflows: All cash payments during the period
 * - Net Cash Change: Inflows - Outflows
 * - Closing Balance: Opening Balance + Net Cash Change
 * 
 * @module services/cashFlowService
 */

const { query, queryOne } = require('../database/index');
const BankAccount = require('../database/models/BankAccount');
const BankTransaction = require('../database/models/BankTransaction');

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
 * Validates date range for Cash Flow report.
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
 * Calculates the previous period dates for comparison.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{startDate: string, endDate: string}} Previous period dates
 */
function getPreviousPeriodDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate the duration of the current period in milliseconds
  const duration = end.getTime() - start.getTime();
  
  // Previous period ends one day before current period starts
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000); // Subtract one day
  // Previous period starts duration before that
  const prevStart = new Date(prevEnd.getTime() - duration);
  
  // Format dates
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    startDate: formatDate(prevStart),
    endDate: formatDate(prevEnd)
  };
}

/**
 * Calculates the opening balance before a given date.
 * This is the sum of all cash inflows minus outflows before the start date.
 * 
 * Uses bank transactions to calculate the actual bank balance at the start of period.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @returns {number} Opening balance (in pence)
 */
function calculateOpeningBalance(userId, startDate) {
  // Get all bank accounts for user
  const bankAccounts = BankAccount.getActiveBankAccounts(userId);
  
  if (!bankAccounts || bankAccounts.length === 0) {
    // Fall back to transaction-based calculation
    return calculateOpeningBalanceFromTransactions(userId, startDate);
  }
  
  let totalOpeningBalance = 0;
  
  for (const account of bankAccounts) {
    // Start with the opening balance of the account
    let balance = account.openingBalance || 0;
    
    // Add all transactions before the start date
    const result = queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as debits
      FROM bank_transactions
      WHERE bankAccountId = ? AND transactionDate < ?
    `, [account.id, startDate]);
    
    if (result) {
      balance += (result.credits || 0) - (result.debits || 0);
    }
    
    totalOpeningBalance += balance;
  }
  
  return totalOpeningBalance;
}

/**
 * Calculates opening balance from transactions when no bank accounts exist.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @returns {number} Opening balance from transactions (in pence)
 */
function calculateOpeningBalanceFromTransactions(userId, startDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expenses
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.transactionDate < ?
      AND t.status != 'void'
      AND c.type IN ('asset')
      AND c.code LIKE '%CASH%' OR c.code LIKE '%BANK%'
  `, [userId, startDate]);
  
  return (result?.income || 0) - (result?.expenses || 0);
}

/**
 * Calculates the closing balance at the end of a given date.
 * 
 * @param {number} userId - The user ID
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {number} Closing balance (in pence)
 */
function calculateClosingBalance(userId, endDate) {
  // Get all bank accounts for user
  const bankAccounts = BankAccount.getActiveBankAccounts(userId);
  
  if (!bankAccounts || bankAccounts.length === 0) {
    return calculateClosingBalanceFromTransactions(userId, endDate);
  }
  
  let totalClosingBalance = 0;
  
  for (const account of bankAccounts) {
    // Start with the opening balance of the account
    let balance = account.openingBalance || 0;
    
    // Add all transactions up to and including the end date
    const result = queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as debits
      FROM bank_transactions
      WHERE bankAccountId = ? AND transactionDate <= ?
    `, [account.id, endDate]);
    
    if (result) {
      balance += (result.credits || 0) - (result.debits || 0);
    }
    
    totalClosingBalance += balance;
  }
  
  return totalClosingBalance;
}

/**
 * Calculates closing balance from transactions when no bank accounts exist.
 * 
 * @param {number} userId - The user ID
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {number} Closing balance from transactions (in pence)
 */
function calculateClosingBalanceFromTransactions(userId, endDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expenses
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.transactionDate <= ?
      AND t.status != 'void'
      AND c.type IN ('asset')
      AND c.code LIKE '%CASH%' OR c.code LIKE '%BANK%'
  `, [userId, endDate]);
  
  return (result?.income || 0) - (result?.expenses || 0);
}

/**
 * Gets cash inflows (receipts) for a date range, grouped by category.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Cash inflows by category
 */
function getCashInflows(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(t.amount), 0) as amount,
      COUNT(t.id) as transactionCount
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.type = 'income'
      AND t.status != 'void'
      AND t.transactionDate >= ?
      AND t.transactionDate <= ?
    GROUP BY c.id
    ORDER BY c.displayOrder ASC, c.name ASC
  `, [userId, startDate, endDate]);
  
  return results.map(row => ({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode || 'UNCATEGORIZED',
    categoryName: row.categoryName || 'Uncategorized',
    categoryNameTr: row.categoryNameTr || 'Kategorisiz',
    amount: row.amount,
    transactionCount: row.transactionCount
  }));
}

/**
 * Gets cash outflows (payments) for a date range, grouped by category.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Cash outflows by category
 */
function getCashOutflows(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(t.amount), 0) as amount,
      COUNT(t.id) as transactionCount
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? 
      AND t.type = 'expense'
      AND t.status != 'void'
      AND t.transactionDate >= ?
      AND t.transactionDate <= ?
    GROUP BY c.id
    ORDER BY c.displayOrder ASC, c.name ASC
  `, [userId, startDate, endDate]);
  
  return results.map(row => ({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode || 'UNCATEGORIZED',
    categoryName: row.categoryName || 'Uncategorized',
    categoryNameTr: row.categoryNameTr || 'Kategorisiz',
    amount: row.amount,
    transactionCount: row.transactionCount
  }));
}

/**
 * Gets total cash inflows and outflows for a date range.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} Totals for inflows and outflows
 */
function getCashTotals(userId, startDate, endDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as totalInflows,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as totalOutflows,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as inflowCount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as outflowCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  return {
    totalInflows: result?.totalInflows || 0,
    totalOutflows: result?.totalOutflows || 0,
    inflowCount: result?.inflowCount || 0,
    outflowCount: result?.outflowCount || 0
  };
}

/**
 * Gets bank account movements for a date range.
 * Provides a summary of movements per bank account.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Bank account movements
 */
function getBankAccountMovements(userId, startDate, endDate) {
  const bankAccounts = BankAccount.getActiveBankAccounts(userId);
  
  if (!bankAccounts || bankAccounts.length === 0) {
    return [];
  }
  
  const movements = [];
  
  for (const account of bankAccounts) {
    // Calculate opening balance for this account
    let openingBalance = account.openingBalance || 0;
    const openingResult = queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as debits
      FROM bank_transactions
      WHERE bankAccountId = ? AND transactionDate < ?
    `, [account.id, startDate]);
    
    if (openingResult) {
      openingBalance += (openingResult.credits || 0) - (openingResult.debits || 0);
    }
    
    // Get movements during the period
    const periodResult = queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as debits,
        COUNT(*) as transactionCount
      FROM bank_transactions
      WHERE bankAccountId = ? AND transactionDate >= ? AND transactionDate <= ?
    `, [account.id, startDate, endDate]);
    
    const periodCredits = periodResult?.credits || 0;
    const periodDebits = periodResult?.debits || 0;
    const netChange = periodCredits - periodDebits;
    const closingBalance = openingBalance + netChange;
    
    movements.push({
      bankAccountId: account.id,
      accountName: account.accountName,
      bankName: account.bankName,
      sortCodeFormatted: account.sortCodeFormatted,
      accountNumber: account.accountNumber,
      currency: account.currency,
      openingBalance,
      credits: periodCredits,
      debits: periodDebits,
      netChange,
      closingBalance,
      transactionCount: periodResult?.transactionCount || 0
    });
  }
  
  return movements;
}

/**
 * Gets monthly breakdown of cash movements.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Monthly cash flow summary
 */
function getMonthlyCashFlow(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      strftime('%Y', transactionDate) as year,
      strftime('%m', transactionDate) as month,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as inflows,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as outflows,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as inflowCount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as outflowCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
    GROUP BY strftime('%Y', transactionDate), strftime('%m', transactionDate)
    ORDER BY year ASC, month ASC
  `, [userId, startDate, endDate]);
  
  return results.map(row => {
    const inflows = row.inflows || 0;
    const outflows = row.outflows || 0;
    const netCashFlow = inflows - outflows;
    
    return {
      year: parseInt(row.year, 10),
      month: row.month,
      monthName: getMonthName(parseInt(row.month, 10)),
      inflows,
      outflows,
      netCashFlow,
      inflowCount: row.inflowCount || 0,
      outflowCount: row.outflowCount || 0
    };
  });
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
 * Generates a Cash Flow Statement report for a given user and period.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.includeComparison=false] - Include previous period comparison
 * @param {boolean} [options.includeBankMovements=true] - Include bank account movements
 * @param {boolean} [options.includeMonthlyBreakdown=true] - Include monthly breakdown
 * @returns {{
 *   period: {startDate: string, endDate: string, taxYear: string},
 *   openingBalance: number,
 *   closingBalance: number,
 *   inflows: {
 *     categories: Array,
 *     total: number,
 *     transactionCount: number
 *   },
 *   outflows: {
 *     categories: Array,
 *     total: number,
 *     transactionCount: number
 *   },
 *   summary: {
 *     openingBalance: number,
 *     totalInflows: number,
 *     totalOutflows: number,
 *     netCashChange: number,
 *     closingBalance: number,
 *     expectedClosingBalance: number,
 *     isReconciled: boolean,
 *     reconciliationDifference: number
 *   },
 *   bankAccountMovements?: Array,
 *   monthlyCashFlow?: Array,
 *   comparison?: Object
 * }}
 */
function generateCashFlowReport(userId, startDate, endDate, options = {}) {
  const { 
    includeComparison = false,
    includeBankMovements = true,
    includeMonthlyBreakdown = true
  } = options;
  
  // Get the tax year for the period
  const taxYear = getTaxYearForDate(startDate);
  
  // Calculate opening and closing balances
  const openingBalance = calculateOpeningBalance(userId, startDate);
  const closingBalance = calculateClosingBalance(userId, endDate);
  
  // Get cash inflows by category
  const inflowCategories = getCashInflows(userId, startDate, endDate);
  
  // Get cash outflows by category
  const outflowCategories = getCashOutflows(userId, startDate, endDate);
  
  // Get totals
  const totals = getCashTotals(userId, startDate, endDate);
  
  // Calculate net cash change
  const netCashChange = totals.totalInflows - totals.totalOutflows;
  
  // Expected closing balance based on opening balance + net change
  const expectedClosingBalance = openingBalance + netCashChange;
  
  // Check if balances reconcile
  const reconciliationDifference = closingBalance - expectedClosingBalance;
  const isReconciled = Math.abs(reconciliationDifference) < 1; // Allow for small rounding differences
  
  const report = {
    period: {
      startDate,
      endDate,
      taxYear
    },
    openingBalance,
    closingBalance,
    inflows: {
      categories: inflowCategories,
      total: totals.totalInflows,
      transactionCount: totals.inflowCount
    },
    outflows: {
      categories: outflowCategories,
      total: totals.totalOutflows,
      transactionCount: totals.outflowCount
    },
    summary: {
      openingBalance,
      totalInflows: totals.totalInflows,
      totalOutflows: totals.totalOutflows,
      netCashChange,
      closingBalance,
      expectedClosingBalance,
      isReconciled,
      reconciliationDifference
    }
  };
  
  // Include bank account movements if requested
  if (includeBankMovements) {
    report.bankAccountMovements = getBankAccountMovements(userId, startDate, endDate);
  }
  
  // Include monthly breakdown if requested
  if (includeMonthlyBreakdown) {
    report.monthlyCashFlow = getMonthlyCashFlow(userId, startDate, endDate);
  }
  
  // Include period comparison if requested
  if (includeComparison) {
    const prevPeriod = getPreviousPeriodDates(startDate, endDate);
    const prevTotals = getCashTotals(userId, prevPeriod.startDate, prevPeriod.endDate);
    
    const prevNetCashChange = prevTotals.totalInflows - prevTotals.totalOutflows;
    
    report.comparison = {
      previousPeriod: {
        startDate: prevPeriod.startDate,
        endDate: prevPeriod.endDate
      },
      previous: {
        totalInflows: prevTotals.totalInflows,
        totalOutflows: prevTotals.totalOutflows,
        netCashChange: prevNetCashChange
      },
      changes: {
        inflowChange: totals.totalInflows - prevTotals.totalInflows,
        inflowChangePercent: calculatePercentageChange(totals.totalInflows, prevTotals.totalInflows),
        outflowChange: totals.totalOutflows - prevTotals.totalOutflows,
        outflowChangePercent: calculatePercentageChange(totals.totalOutflows, prevTotals.totalOutflows),
        netCashChangeChange: netCashChange - prevNetCashChange,
        netCashChangePercent: calculatePercentageChange(netCashChange, prevNetCashChange)
      }
    };
  }
  
  return report;
}

/**
 * Generates a Cash Flow Statement report for a specific tax year.
 * 
 * @param {number} userId - The user ID
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @param {Object} options - Optional parameters
 * @returns {Object} Cash Flow Statement report for the tax year
 */
function generateCashFlowForTaxYear(userId, taxYear, options = {}) {
  const { startDate, endDate } = getTaxYearDates(taxYear);
  return generateCashFlowReport(userId, startDate, endDate, options);
}

/**
 * Generates a Cash Flow Statement report for a specific month.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {Object} options - Optional parameters
 * @returns {Object} Cash Flow Statement report for the month
 */
function generateCashFlowForMonth(userId, year, month, options = {}) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateCashFlowReport(userId, startDate, endDate, {
    ...options,
    includeMonthlyBreakdown: false // Don't need monthly breakdown for single month
  });
}

/**
 * Generates a Cash Flow Statement report for a specific quarter.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} quarter - The quarter (1-4)
 * @param {Object} options - Optional parameters
 * @returns {Object} Cash Flow Statement report for the quarter
 */
function generateCashFlowForQuarter(userId, year, quarter, options = {}) {
  const quarterStartMonths = { 1: 1, 2: 4, 3: 7, 4: 10 };
  const startMonth = quarterStartMonths[quarter];
  
  if (!startMonth) {
    throw new Error('Invalid quarter. Must be 1, 2, 3, or 4.');
  }
  
  const endMonth = startMonth + 2;
  
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateCashFlowReport(userId, startDate, endDate, options);
}

module.exports = {
  // Main report generation
  generateCashFlowReport,
  generateCashFlowForTaxYear,
  generateCashFlowForMonth,
  generateCashFlowForQuarter,
  
  // Component functions (for testing)
  calculateOpeningBalance,
  calculateClosingBalance,
  getCashInflows,
  getCashOutflows,
  getCashTotals,
  getBankAccountMovements,
  getMonthlyCashFlow,
  
  // Utility functions
  validateDateRange,
  getPreviousPeriodDates,
  calculatePercentageChange,
  getTaxYearForDate,
  getTaxYearDates,
  getMonthName
};
