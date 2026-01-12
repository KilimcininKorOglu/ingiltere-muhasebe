/**
 * Profit & Loss (Income Statement) Service
 * 
 * Provides Profit & Loss report calculations for financial reporting.
 * Summarizes revenue, costs, and expenses for a specified period.
 * Supports period comparison for year-over-year analysis.
 * 
 * @module services/profitLossService
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
 * Validates date range for P&L report.
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
 * Gets income transactions grouped by category for a date range.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Income by category
 */
function getIncomeByCategory(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(t.amount), 0) as amount,
      COALESCE(SUM(t.vatAmount), 0) as vatAmount,
      COALESCE(SUM(t.totalAmount), 0) as totalAmount,
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
    vatAmount: row.vatAmount,
    totalAmount: row.totalAmount,
    transactionCount: row.transactionCount
  }));
}

/**
 * Gets expense transactions grouped by category for a date range.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Expenses by category
 */
function getExpensesByCategory(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      c.id as categoryId,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr,
      COALESCE(SUM(t.amount), 0) as amount,
      COALESCE(SUM(t.vatAmount), 0) as vatAmount,
      COALESCE(SUM(t.totalAmount), 0) as totalAmount,
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
    vatAmount: row.vatAmount,
    totalAmount: row.totalAmount,
    transactionCount: row.transactionCount
  }));
}

/**
 * Gets income and expense totals for a date range.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} Totals for income and expenses
 */
function getTotals(userId, startDate, endDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as incomeAmount,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as incomeVatAmount,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as incomeTotalAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as expenseAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as expenseVatAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as expenseTotalAmount,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as incomeCount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as expenseCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  return {
    income: {
      amount: result?.incomeAmount || 0,
      vatAmount: result?.incomeVatAmount || 0,
      totalAmount: result?.incomeTotalAmount || 0,
      transactionCount: result?.incomeCount || 0
    },
    expense: {
      amount: result?.expenseAmount || 0,
      vatAmount: result?.expenseVatAmount || 0,
      totalAmount: result?.expenseTotalAmount || 0,
      transactionCount: result?.expenseCount || 0
    }
  };
}

/**
 * Gets monthly breakdown of income and expenses.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Array} Monthly summary
 */
function getMonthlySummary(userId, startDate, endDate) {
  const results = query(`
    SELECT 
      strftime('%Y', transactionDate) as year,
      strftime('%m', transactionDate) as month,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as incomeAmount,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as incomeTotalAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as expenseAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as expenseTotalAmount,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as incomeCount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as expenseCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
    GROUP BY strftime('%Y', transactionDate), strftime('%m', transactionDate)
    ORDER BY year ASC, month ASC
  `, [userId, startDate, endDate]);
  
  return results.map(row => {
    const income = row.incomeAmount || 0;
    const expense = row.expenseAmount || 0;
    const netProfit = income - expense;
    
    return {
      year: parseInt(row.year, 10),
      month: row.month,
      monthName: getMonthName(parseInt(row.month, 10)),
      income: {
        amount: income,
        totalAmount: row.incomeTotalAmount || 0,
        transactionCount: row.incomeCount || 0
      },
      expense: {
        amount: expense,
        totalAmount: row.expenseTotalAmount || 0,
        transactionCount: row.expenseCount || 0
      },
      grossProfit: income,
      netProfit: netProfit
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
 * Generates a Profit & Loss report for a given user and period.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.includeComparison=false] - Include previous period comparison
 * @returns {{
 *   period: {startDate: string, endDate: string, taxYear: string},
 *   income: {
 *     categories: Array,
 *     total: {amount: number, vatAmount: number, totalAmount: number, transactionCount: number}
 *   },
 *   expenses: {
 *     categories: Array,
 *     total: {amount: number, vatAmount: number, totalAmount: number, transactionCount: number}
 *   },
 *   summary: {
 *     totalRevenue: number,
 *     totalExpenses: number,
 *     grossProfit: number,
 *     netProfit: number,
 *     profitMargin: number
 *   },
 *   monthlySummary: Array,
 *   comparison?: Object
 * }}
 */
function generateProfitLossReport(userId, startDate, endDate, options = {}) {
  const { includeComparison = false } = options;
  
  // Get the tax year for the period
  const taxYear = getTaxYearForDate(startDate);
  
  // Get income by category
  const incomeCategories = getIncomeByCategory(userId, startDate, endDate);
  
  // Get expenses by category
  const expenseCategories = getExpensesByCategory(userId, startDate, endDate);
  
  // Get totals
  const totals = getTotals(userId, startDate, endDate);
  
  // Get monthly summary
  const monthlySummary = getMonthlySummary(userId, startDate, endDate);
  
  // Calculate P&L summary
  const totalRevenue = totals.income.amount;
  const totalExpenses = totals.expense.amount;
  const grossProfit = totalRevenue; // For a basic P&L, gross profit equals revenue
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 
    ? Math.round((netProfit / totalRevenue) * 10000) / 100 
    : 0;
  
  const report = {
    period: {
      startDate,
      endDate,
      taxYear
    },
    income: {
      categories: incomeCategories,
      total: totals.income
    },
    expenses: {
      categories: expenseCategories,
      total: totals.expense
    },
    summary: {
      totalRevenue,
      totalExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      transactionCount: totals.income.transactionCount + totals.expense.transactionCount
    },
    monthlySummary
  };
  
  // Include period comparison if requested
  if (includeComparison) {
    const prevPeriod = getPreviousPeriodDates(startDate, endDate);
    const prevTotals = getTotals(userId, prevPeriod.startDate, prevPeriod.endDate);
    
    const prevRevenue = prevTotals.income.amount;
    const prevExpenses = prevTotals.expense.amount;
    const prevNetProfit = prevRevenue - prevExpenses;
    
    report.comparison = {
      previousPeriod: {
        startDate: prevPeriod.startDate,
        endDate: prevPeriod.endDate
      },
      previous: {
        totalRevenue: prevRevenue,
        totalExpenses: prevExpenses,
        grossProfit: prevRevenue,
        netProfit: prevNetProfit
      },
      changes: {
        revenueChange: totalRevenue - prevRevenue,
        revenueChangePercent: calculatePercentageChange(totalRevenue, prevRevenue),
        expenseChange: totalExpenses - prevExpenses,
        expenseChangePercent: calculatePercentageChange(totalExpenses, prevExpenses),
        netProfitChange: netProfit - prevNetProfit,
        netProfitChangePercent: calculatePercentageChange(netProfit, prevNetProfit)
      }
    };
  }
  
  return report;
}

/**
 * Generates a Profit & Loss report for a specific tax year.
 * 
 * @param {number} userId - The user ID
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @param {Object} options - Optional parameters
 * @returns {Object} Profit & Loss report for the tax year
 */
function generateProfitLossForTaxYear(userId, taxYear, options = {}) {
  const { startDate, endDate } = getTaxYearDates(taxYear);
  return generateProfitLossReport(userId, startDate, endDate, options);
}

/**
 * Generates a Profit & Loss report for a specific month.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {Object} options - Optional parameters
 * @returns {Object} Profit & Loss report for the month
 */
function generateProfitLossForMonth(userId, year, month, options = {}) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateProfitLossReport(userId, startDate, endDate, options);
}

/**
 * Generates a Profit & Loss report for a specific quarter.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} quarter - The quarter (1-4)
 * @param {Object} options - Optional parameters
 * @returns {Object} Profit & Loss report for the quarter
 */
function generateProfitLossForQuarter(userId, year, quarter, options = {}) {
  const quarterStartMonths = { 1: 1, 2: 4, 3: 7, 4: 10 };
  const startMonth = quarterStartMonths[quarter];
  
  if (!startMonth) {
    throw new Error('Invalid quarter. Must be 1, 2, 3, or 4.');
  }
  
  const endMonth = startMonth + 2;
  
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateProfitLossReport(userId, startDate, endDate, options);
}

module.exports = {
  // Main report generation
  generateProfitLossReport,
  generateProfitLossForTaxYear,
  generateProfitLossForMonth,
  generateProfitLossForQuarter,
  
  // Component functions (for testing)
  getIncomeByCategory,
  getExpensesByCategory,
  getTotals,
  getMonthlySummary,
  
  // Utility functions
  validateDateRange,
  getPreviousPeriodDates,
  calculatePercentageChange,
  getTaxYearForDate,
  getTaxYearDates,
  getMonthName
};
