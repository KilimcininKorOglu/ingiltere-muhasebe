/**
 * Dashboard Service
 * 
 * Provides dashboard summary metrics and recent activity for the home page.
 * Aggregates key financial indicators from transactions, invoices, payroll,
 * and VAT threshold data.
 * 
 * @module services/dashboardService
 */

const { query, queryOne } = require('../database/index');

/**
 * Alert thresholds for dashboard widgets (in pence).
 */
const ALERT_THRESHOLDS = {
  // Cash flow warning if net cash flow is below this amount
  CASH_FLOW_WARNING: -10000, // -£100
  // Overdue invoice count that triggers a warning
  OVERDUE_INVOICE_COUNT: 3,
  // VAT threshold percentage that triggers a warning (85% of registration threshold)
  VAT_THRESHOLD_PERCENTAGE: 85,
  // Outstanding payroll reminder threshold (days before deadline)
  PAYROLL_DEADLINE_DAYS: 7
};

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
 * Formats a date to YYYY-MM-DD string.
 * 
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the start of current month.
 * 
 * @returns {string} First day of current month in YYYY-MM-DD format
 */
function getMonthStart() {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/**
 * Gets today's date.
 * 
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function getToday() {
  return formatDate(new Date());
}

/**
 * Gets the date 30 days ago.
 * 
 * @returns {string} Date 30 days ago in YYYY-MM-DD format
 */
function get30DaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return formatDate(date);
}

/**
 * Gets income and expense summary for the current month.
 * 
 * @param {number} userId - The user ID
 * @returns {Object} Income and expense totals for current month
 */
function getCurrentMonthSummary(userId) {
  const startDate = getMonthStart();
  const endDate = getToday();
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as totalIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as totalExpenses,
      COUNT(CASE WHEN type = 'income' AND status != 'void' THEN 1 END) as incomeCount,
      COUNT(CASE WHEN type = 'expense' AND status != 'void' THEN 1 END) as expenseCount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  const totalIncome = result?.totalIncome || 0;
  const totalExpenses = result?.totalExpenses || 0;
  
  return {
    period: {
      startDate,
      endDate,
      monthName: getMonthName(new Date().getMonth() + 1),
      year: new Date().getFullYear()
    },
    income: {
      amount: totalIncome,
      transactionCount: result?.incomeCount || 0
    },
    expenses: {
      amount: totalExpenses,
      transactionCount: result?.expenseCount || 0
    },
    netCashFlow: totalIncome - totalExpenses
  };
}

/**
 * Gets outstanding invoice summary.
 * 
 * @param {number} userId - The user ID
 * @returns {Object} Outstanding invoice metrics
 */
function getInvoiceSummary(userId) {
  const today = getToday();
  
  // Get invoice counts and totals by status
  // Note: The invoices table uses 'pending' for sent invoices and 'paidAt' for paid date
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN status IN ('draft', 'pending', 'overdue') THEN totalAmount ELSE 0 END), 0) as outstandingAmount,
      COUNT(CASE WHEN status IN ('draft', 'pending', 'overdue') THEN 1 END) as outstandingCount,
      COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue') AND dueDate < ? THEN totalAmount ELSE 0 END), 0) as overdueAmount,
      COUNT(CASE WHEN status IN ('pending', 'overdue') AND dueDate < ? THEN 1 END) as overdueCount,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) as draftCount,
      COUNT(CASE WHEN status = 'paid' AND paidAt >= date('now', '-30 days') THEN 1 END) as recentPaidCount,
      COALESCE(SUM(CASE WHEN status = 'paid' AND paidAt >= date('now', '-30 days') THEN totalAmount ELSE 0 END), 0) as recentPaidAmount
    FROM invoices
    WHERE userId = ?
  `, [today, today, userId]);
  
  return {
    outstanding: {
      amount: result?.outstandingAmount || 0,
      count: result?.outstandingCount || 0
    },
    overdue: {
      amount: result?.overdueAmount || 0,
      count: result?.overdueCount || 0
    },
    drafts: {
      count: result?.draftCount || 0
    },
    recentlyPaid: {
      amount: result?.recentPaidAmount || 0,
      count: result?.recentPaidCount || 0
    }
  };
}

/**
 * Gets payroll summary for the current tax year.
 * 
 * @param {number} userId - The user ID
 * @returns {Object} Payroll metrics
 */
function getPayrollSummary(userId) {
  // Determine current UK tax year (April 6 - April 5)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  let taxYearStart, taxYearEnd;
  if (month < 4 || (month === 4 && day < 6)) {
    taxYearStart = `${year - 1}-04-06`;
    taxYearEnd = `${year}-04-05`;
  } else {
    taxYearStart = `${year}-04-06`;
    taxYearEnd = `${year + 1}-04-05`;
  }
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(grossPay), 0) as totalGrossPay,
      COALESCE(SUM(netPay), 0) as totalNetPay,
      COALESCE(SUM(incomeTax + employeeNI), 0) as totalDeductions,
      COALESCE(SUM(employerNI), 0) as totalEmployerNI,
      COUNT(*) as entryCount
    FROM payroll_entries
    WHERE userId = ? 
      AND payDate >= ? 
      AND payDate <= ?
      AND status != 'cancelled'
  `, [userId, taxYearStart, taxYearEnd]);
  
  // Get employee count
  const employeeResult = queryOne(`
    SELECT COUNT(*) as activeEmployees
    FROM employees
    WHERE userId = ? AND status = 'active'
  `, [userId]);
  
  return {
    taxYear: {
      start: taxYearStart,
      end: taxYearEnd
    },
    totalGrossPay: result?.totalGrossPay || 0,
    totalNetPay: result?.totalNetPay || 0,
    totalDeductions: result?.totalDeductions || 0,
    totalEmployerNI: result?.totalEmployerNI || 0,
    payrollEntryCount: result?.entryCount || 0,
    activeEmployees: employeeResult?.activeEmployees || 0
  };
}

/**
 * Gets VAT threshold status summary.
 * 
 * @param {number} userId - The user ID
 * @param {boolean} isVatRegistered - Whether user is VAT registered
 * @returns {Object} VAT threshold metrics
 */
function getVatThresholdSummary(userId, isVatRegistered) {
  // Calculate rolling 12-month turnover
  const endDate = getToday();
  const startDate = formatDate(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as turnover
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  const turnover = result?.turnover || 0;
  
  // UK VAT registration threshold (in pence) - £90,000 as of 2024/25
  const registrationThreshold = 9000000;
  const percentage = registrationThreshold > 0 ? (turnover / registrationThreshold) * 100 : 0;
  const remainingUntilThreshold = registrationThreshold - turnover;
  
  // Determine warning level
  let warningLevel = 'none';
  if (percentage >= 100) {
    warningLevel = 'exceeded';
  } else if (percentage >= 90) {
    warningLevel = 'imminent';
  } else if (percentage >= 75) {
    warningLevel = 'approaching';
  }
  
  return {
    isVatRegistered,
    turnover: {
      amount: turnover,
      period: {
        startDate,
        endDate
      }
    },
    threshold: {
      amount: registrationThreshold,
      percentage: Math.round(percentage * 100) / 100,
      remaining: Math.max(0, remainingUntilThreshold)
    },
    warningLevel,
    requiresAttention: !isVatRegistered && percentage >= ALERT_THRESHOLDS.VAT_THRESHOLD_PERCENTAGE
  };
}

/**
 * Gets account balance summary.
 * 
 * @param {number} userId - The user ID
 * @returns {Object} Account balance metrics
 */
function getAccountBalanceSummary(userId) {
  // Get bank account balances
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN isActive = 1 THEN currentBalance ELSE 0 END), 0) as totalBalance,
      COUNT(CASE WHEN isActive = 1 THEN 1 END) as activeAccounts
    FROM bank_accounts
    WHERE userId = ?
  `, [userId]);
  
  return {
    totalBalance: result?.totalBalance || 0,
    activeAccounts: result?.activeAccounts || 0
  };
}

/**
 * Gets recent transactions.
 * 
 * @param {number} userId - The user ID
 * @param {number} [limit=10] - Maximum number of transactions to return
 * @returns {Array} Recent transactions
 */
function getRecentTransactions(userId, limit = 10) {
  const transactions = query(`
    SELECT 
      t.id,
      t.type,
      t.status,
      t.transactionDate,
      t.description,
      t.amount,
      t.vatAmount,
      t.totalAmount,
      t.payee,
      c.code as categoryCode,
      c.name as categoryName,
      c.nameTr as categoryNameTr
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? AND t.status != 'void'
    ORDER BY t.transactionDate DESC, t.createdAt DESC
    LIMIT ?
  `, [userId, limit]);
  
  return transactions.map(t => ({
    id: t.id,
    type: t.type,
    status: t.status,
    date: t.transactionDate,
    description: t.description,
    amount: t.amount,
    vatAmount: t.vatAmount,
    totalAmount: t.totalAmount,
    payee: t.payee,
    category: {
      code: t.categoryCode,
      name: t.categoryName,
      nameTr: t.categoryNameTr
    }
  }));
}

/**
 * Gets recent invoices.
 * 
 * @param {number} userId - The user ID
 * @param {number} [limit=5] - Maximum number of invoices to return
 * @returns {Array} Recent invoices
 */
function getRecentInvoices(userId, limit = 5) {
  // Note: The invoices table stores customer data directly, not via a foreign key
  const invoices = query(`
    SELECT 
      id,
      invoiceNumber,
      status,
      issueDate as invoiceDate,
      dueDate,
      totalAmount,
      currency,
      customerName,
      customerEmail
    FROM invoices
    WHERE userId = ?
    ORDER BY issueDate DESC, createdAt DESC
    LIMIT ?
  `, [userId, limit]);
  
  return invoices.map(inv => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    totalAmount: inv.totalAmount,
    currency: inv.currency || 'GBP',
    customer: {
      name: inv.customerName,
      email: inv.customerEmail
    }
  }));
}

/**
 * Gets recent payroll entries.
 * 
 * @param {number} userId - The user ID
 * @param {number} [limit=5] - Maximum number of entries to return
 * @returns {Array} Recent payroll entries
 */
function getRecentPayrollEntries(userId, limit = 5) {
  const entries = query(`
    SELECT 
      p.id,
      p.payDate,
      p.grossPay,
      p.netPay,
      p.status,
      e.firstName,
      e.lastName,
      e.email
    FROM payroll_entries p
    LEFT JOIN employees e ON p.employeeId = e.id
    WHERE p.userId = ?
    ORDER BY p.payDate DESC, p.createdAt DESC
    LIMIT ?
  `, [userId, limit]);
  
  return entries.map(entry => ({
    id: entry.id,
    payDate: entry.payDate,
    grossPay: entry.grossPay,
    netPay: entry.netPay,
    status: entry.status,
    employee: {
      firstName: entry.firstName,
      lastName: entry.lastName,
      fullName: `${entry.firstName || ''} ${entry.lastName || ''}`.trim(),
      email: entry.email
    }
  }));
}

/**
 * Generates dashboard alerts based on current financial status.
 * 
 * @param {Object} metrics - Dashboard metrics
 * @param {Object} options - Options
 * @returns {Array} List of alerts
 */
function generateAlerts(metrics, options = {}) {
  const alerts = [];
  
  // Cash flow warning
  if (metrics.cashFlow && metrics.cashFlow.netCashFlow < ALERT_THRESHOLDS.CASH_FLOW_WARNING) {
    alerts.push({
      type: 'warning',
      category: 'cash_flow',
      message: {
        en: 'Negative cash flow this month. Expenses exceed income.',
        tr: 'Bu ay negatif nakit akışı. Giderler geliri aşıyor.'
      },
      priority: 'medium'
    });
  }
  
  // Overdue invoices
  if (metrics.invoices && metrics.invoices.overdue.count >= ALERT_THRESHOLDS.OVERDUE_INVOICE_COUNT) {
    alerts.push({
      type: 'urgent',
      category: 'invoices',
      message: {
        en: `You have ${metrics.invoices.overdue.count} overdue invoices requiring attention.`,
        tr: `Dikkat gerektiren ${metrics.invoices.overdue.count} vadesi geçmiş faturanız var.`
      },
      priority: 'high'
    });
  } else if (metrics.invoices && metrics.invoices.overdue.count > 0) {
    alerts.push({
      type: 'warning',
      category: 'invoices',
      message: {
        en: `You have ${metrics.invoices.overdue.count} overdue invoice(s).`,
        tr: `${metrics.invoices.overdue.count} vadesi geçmiş faturanız var.`
      },
      priority: 'medium'
    });
  }
  
  // VAT threshold warning
  if (metrics.vatThreshold && metrics.vatThreshold.requiresAttention) {
    if (metrics.vatThreshold.warningLevel === 'exceeded') {
      alerts.push({
        type: 'urgent',
        category: 'vat',
        message: {
          en: 'Your turnover has exceeded the VAT registration threshold. You must register for VAT.',
          tr: 'Cironuz KDV kayıt eşiğini aştı. KDV için kayıt olmanız gerekmektedir.'
        },
        priority: 'high'
      });
    } else if (metrics.vatThreshold.warningLevel === 'imminent') {
      alerts.push({
        type: 'warning',
        category: 'vat',
        message: {
          en: 'You are approaching the VAT registration threshold. Consider registering for VAT.',
          tr: 'KDV kayıt eşiğine yaklaşıyorsunuz. KDV için kayıt olmayı düşünün.'
        },
        priority: 'high'
      });
    } else if (metrics.vatThreshold.warningLevel === 'approaching') {
      alerts.push({
        type: 'info',
        category: 'vat',
        message: {
          en: 'Your turnover is approaching the VAT threshold. Monitor your income closely.',
          tr: 'Cironuz KDV eşiğine yaklaşıyor. Gelirinizi yakından takip edin.'
        },
        priority: 'medium'
      });
    }
  }
  
  // Draft invoices reminder
  if (metrics.invoices && metrics.invoices.drafts && metrics.invoices.drafts.count > 0) {
    alerts.push({
      type: 'info',
      category: 'invoices',
      message: {
        en: `You have ${metrics.invoices.drafts.count} draft invoice(s) waiting to be sent.`,
        tr: `Gönderilmeyi bekleyen ${metrics.invoices.drafts.count} taslak faturanız var.`
      },
      priority: 'low'
    });
  }
  
  // Sort alerts by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return alerts;
}

/**
 * Generates a comprehensive dashboard summary.
 * 
 * @param {number} userId - The user ID
 * @param {Object} options - Options
 * @param {boolean} [options.isVatRegistered=false] - Whether user is VAT registered
 * @param {number} [options.recentTransactionsLimit=10] - Limit for recent transactions
 * @param {number} [options.recentInvoicesLimit=5] - Limit for recent invoices
 * @param {number} [options.recentPayrollLimit=5] - Limit for recent payroll entries
 * @param {boolean} [options.includeRecentActivity=true] - Whether to include recent activity
 * @returns {Object} Dashboard summary data
 */
function generateDashboardSummary(userId, options = {}) {
  const {
    isVatRegistered = false,
    recentTransactionsLimit = 10,
    recentInvoicesLimit = 5,
    recentPayrollLimit = 5,
    includeRecentActivity = true
  } = options;
  
  // Get all metrics
  const cashFlow = getCurrentMonthSummary(userId);
  const invoices = getInvoiceSummary(userId);
  const payroll = getPayrollSummary(userId);
  const vatThreshold = getVatThresholdSummary(userId, isVatRegistered);
  const accountBalance = getAccountBalanceSummary(userId);
  
  // Compile metrics
  const metrics = {
    cashFlow,
    invoices,
    payroll,
    vatThreshold,
    accountBalance
  };
  
  // Generate alerts
  const alerts = generateAlerts(metrics);
  
  // Build response
  const summary = {
    overview: {
      currentMonth: {
        income: cashFlow.income.amount,
        expenses: cashFlow.expenses.amount,
        netCashFlow: cashFlow.netCashFlow,
        period: cashFlow.period
      },
      accountBalance: {
        total: accountBalance.totalBalance,
        activeAccounts: accountBalance.activeAccounts
      }
    },
    invoices: {
      outstanding: invoices.outstanding,
      overdue: invoices.overdue,
      drafts: invoices.drafts
    },
    payroll: {
      taxYear: payroll.taxYear,
      totalGrossPay: payroll.totalGrossPay,
      totalNetPay: payroll.totalNetPay,
      activeEmployees: payroll.activeEmployees,
      payrollEntryCount: payroll.payrollEntryCount
    },
    vatStatus: {
      isVatRegistered: vatThreshold.isVatRegistered,
      turnover: vatThreshold.turnover.amount,
      thresholdPercentage: vatThreshold.threshold.percentage,
      warningLevel: vatThreshold.warningLevel
    },
    alerts,
    generatedAt: new Date().toISOString()
  };
  
  // Include recent activity if requested
  if (includeRecentActivity) {
    summary.recentActivity = {
      transactions: getRecentTransactions(userId, recentTransactionsLimit),
      invoices: getRecentInvoices(userId, recentInvoicesLimit),
      payroll: getRecentPayrollEntries(userId, recentPayrollLimit)
    };
  }
  
  return summary;
}

/**
 * Gets a quick summary for dashboard widgets.
 * This is a lighter version of the full summary for faster loading.
 * 
 * @param {number} userId - The user ID
 * @param {boolean} [isVatRegistered=false] - Whether user is VAT registered
 * @returns {Object} Quick summary data
 */
function getQuickSummary(userId, isVatRegistered = false) {
  const cashFlow = getCurrentMonthSummary(userId);
  const invoices = getInvoiceSummary(userId);
  const vatThreshold = getVatThresholdSummary(userId, isVatRegistered);
  const accountBalance = getAccountBalanceSummary(userId);
  
  // Generate alerts based on metrics
  const metrics = {
    cashFlow,
    invoices,
    vatThreshold
  };
  const alerts = generateAlerts(metrics);
  
  return {
    monthlyIncome: cashFlow.income.amount,
    monthlyExpenses: cashFlow.expenses.amount,
    netCashFlow: cashFlow.netCashFlow,
    totalBalance: accountBalance.totalBalance,
    outstandingInvoices: invoices.outstanding.count,
    overdueInvoices: invoices.overdue.count,
    vatThresholdPercentage: vatThreshold.threshold.percentage,
    vatWarningLevel: vatThreshold.warningLevel,
    alertCount: alerts.filter(a => a.priority === 'high').length,
    hasUrgentAlerts: alerts.some(a => a.type === 'urgent'),
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  // Main functions
  generateDashboardSummary,
  getQuickSummary,
  
  // Component functions (for testing)
  getCurrentMonthSummary,
  getInvoiceSummary,
  getPayrollSummary,
  getVatThresholdSummary,
  getAccountBalanceSummary,
  getRecentTransactions,
  getRecentInvoices,
  getRecentPayrollEntries,
  generateAlerts,
  
  // Utility functions
  getMonthName,
  formatDate,
  getMonthStart,
  getToday,
  get30DaysAgo,
  
  // Constants
  ALERT_THRESHOLDS
};
