/**
 * Reconciliation Report Service
 * 
 * Generates comprehensive reconciliation reports for audit purposes and record-keeping.
 * Provides detailed data for PDF export including:
 * - Reconciled pairs (bank transaction + app transaction)
 * - Unreconciled items clearly marked
 * - Balance calculations
 * - Summary statistics
 * 
 * @module services/reconciliationReportService
 */

const { query, queryOne } = require('../database/index');
const BankTransaction = require('../database/models/BankTransaction');
const Reconciliation = require('../database/models/Reconciliation');
const BankAccount = require('../database/models/BankAccount');
const ReconciliationStatusService = require('./reconciliationStatusService');

/**
 * Report data types
 * @typedef {Object} ReconciliationReportData
 * @property {Object} reportInfo - Report metadata
 * @property {Object} bankAccount - Bank account details
 * @property {Object} summary - Summary statistics
 * @property {Array} reconciledPairs - Reconciled transaction pairs
 * @property {Array} unreconciledBankTransactions - Unreconciled bank transactions
 * @property {Object} balances - Balance calculations
 */

/**
 * Gets all reconciled transaction pairs for a bank account.
 * Returns bank transactions paired with their matched app transactions.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {Array} Array of reconciled pairs
 */
function getReconciledPairs(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [bankAccountId];

  if (startDate) {
    dateFilter += ' AND bt.transactionDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ' AND bt.transactionDate <= ?';
    params.push(endDate);
  }

  const pairs = query(`
    SELECT 
      bt.id as bankTransactionId,
      bt.transactionDate as bankTransactionDate,
      bt.description as bankTransactionDescription,
      bt.reference as bankTransactionReference,
      bt.transactionType as bankTransactionType,
      bt.amount as bankTransactionAmount,
      bt.reconciliationStatus,
      r.id as reconciliationId,
      r.matchType,
      r.matchAmount,
      r.matchConfidence,
      r.status as reconciliationStatus,
      r.reconciledAt,
      r.notes as reconciliationNotes,
      t.id as appTransactionId,
      t.transactionDate as appTransactionDate,
      t.description as appTransactionDescription,
      t.reference as appTransactionReference,
      t.type as appTransactionType,
      t.totalAmount as appTransactionAmount,
      t.invoiceNumber,
      u.name as reconciledByName
    FROM bank_transactions bt
    INNER JOIN reconciliations r ON bt.id = r.bankTransactionId AND r.status = 'confirmed'
    INNER JOIN transactions t ON r.transactionId = t.id
    LEFT JOIN users u ON r.reconciledBy = u.id
    WHERE bt.bankAccountId = ?${dateFilter}
    ORDER BY bt.transactionDate DESC, bt.id DESC
  `, params);

  return pairs.map(pair => ({
    bankTransaction: {
      id: pair.bankTransactionId,
      transactionDate: pair.bankTransactionDate,
      description: pair.bankTransactionDescription,
      reference: pair.bankTransactionReference,
      transactionType: pair.bankTransactionType,
      amount: pair.bankTransactionAmount
    },
    appTransaction: {
      id: pair.appTransactionId,
      transactionDate: pair.appTransactionDate,
      description: pair.appTransactionDescription,
      reference: pair.appTransactionReference,
      type: pair.appTransactionType,
      amount: pair.appTransactionAmount,
      invoiceNumber: pair.invoiceNumber
    },
    reconciliation: {
      id: pair.reconciliationId,
      matchType: pair.matchType,
      matchAmount: pair.matchAmount,
      matchConfidence: pair.matchConfidence,
      reconciledAt: pair.reconciledAt,
      notes: pair.reconciliationNotes,
      reconciledByName: pair.reconciledByName
    }
  }));
}

/**
 * Gets all unreconciled bank transactions for a bank account.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {Array} Array of unreconciled bank transactions
 */
function getUnreconciledBankTransactions(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [bankAccountId];

  if (startDate) {
    dateFilter += ' AND transactionDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ' AND transactionDate <= ?';
    params.push(endDate);
  }

  const transactions = query(`
    SELECT 
      id,
      transactionDate,
      description,
      reference,
      transactionType,
      amount,
      runningBalance,
      reconciliationStatus,
      reconciliationNotes,
      createdAt
    FROM bank_transactions
    WHERE bankAccountId = ? 
      AND isReconciled = 0 
      AND reconciliationStatus != 'excluded'${dateFilter}
    ORDER BY transactionDate DESC, id DESC
  `, params);

  return transactions.map(t => ({
    id: t.id,
    transactionDate: t.transactionDate,
    description: t.description,
    reference: t.reference,
    transactionType: t.transactionType,
    amount: t.amount,
    runningBalance: t.runningBalance,
    status: t.reconciliationStatus,
    notes: t.reconciliationNotes,
    createdAt: t.createdAt
  }));
}

/**
 * Gets excluded bank transactions for a bank account.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {Array} Array of excluded bank transactions
 */
function getExcludedTransactions(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [bankAccountId];

  if (startDate) {
    dateFilter += ' AND transactionDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ' AND transactionDate <= ?';
    params.push(endDate);
  }

  const transactions = query(`
    SELECT 
      id,
      transactionDate,
      description,
      reference,
      transactionType,
      amount,
      reconciliationNotes,
      updatedAt
    FROM bank_transactions
    WHERE bankAccountId = ? 
      AND reconciliationStatus = 'excluded'${dateFilter}
    ORDER BY transactionDate DESC, id DESC
  `, params);

  return transactions.map(t => ({
    id: t.id,
    transactionDate: t.transactionDate,
    description: t.description,
    reference: t.reference,
    transactionType: t.transactionType,
    amount: t.amount,
    reason: t.reconciliationNotes || 'Not specified',
    excludedAt: t.updatedAt
  }));
}

/**
 * Calculates detailed balance summary for the report.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {Object} Balance calculation details
 */
function calculateReportBalances(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [bankAccountId];

  if (startDate) {
    dateFilter += ' AND transactionDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ' AND transactionDate <= ?';
    params.push(endDate);
  }

  // Get bank transaction totals
  const bankTotals = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as totalCredits,
      COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as totalDebits,
      COUNT(*) as totalTransactions
    FROM bank_transactions
    WHERE bankAccountId = ?${dateFilter}
  `, params);

  // Get reconciled totals
  const reconciledParams = [bankAccountId];
  let reconciledDateFilter = '';
  if (startDate) {
    reconciledDateFilter += ' AND bt.transactionDate >= ?';
    reconciledParams.push(startDate);
  }
  if (endDate) {
    reconciledDateFilter += ' AND bt.transactionDate <= ?';
    reconciledParams.push(endDate);
  }

  const reconciledTotals = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN bt.transactionType = 'credit' THEN r.matchAmount ELSE 0 END), 0) as reconciledCredits,
      COALESCE(SUM(CASE WHEN bt.transactionType = 'debit' THEN r.matchAmount ELSE 0 END), 0) as reconciledDebits,
      COUNT(DISTINCT r.id) as reconciledCount
    FROM reconciliations r
    INNER JOIN bank_transactions bt ON r.bankTransactionId = bt.id
    WHERE bt.bankAccountId = ? AND r.status = 'confirmed'${reconciledDateFilter}
  `, reconciledParams);

  // Get unreconciled totals
  const unreconciledTotals = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as unreconciledCredits,
      COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as unreconciledDebits,
      COUNT(*) as unreconciledCount
    FROM bank_transactions
    WHERE bankAccountId = ? AND isReconciled = 0 AND reconciliationStatus != 'excluded'${dateFilter}
  `, params);

  // Get excluded totals
  const excludedTotals = queryOne(`
    SELECT 
      COALESCE(SUM(amount), 0) as excludedAmount,
      COUNT(*) as excludedCount
    FROM bank_transactions
    WHERE bankAccountId = ? AND reconciliationStatus = 'excluded'${dateFilter}
  `, params);

  const totalBankCredits = bankTotals?.totalCredits || 0;
  const totalBankDebits = bankTotals?.totalDebits || 0;
  const netBankBalance = totalBankCredits - totalBankDebits;

  const reconciledCredits = reconciledTotals?.reconciledCredits || 0;
  const reconciledDebits = reconciledTotals?.reconciledDebits || 0;
  const netReconciledBalance = reconciledCredits - reconciledDebits;

  const unreconciledCredits = unreconciledTotals?.unreconciledCredits || 0;
  const unreconciledDebits = unreconciledTotals?.unreconciledDebits || 0;
  const netUnreconciledBalance = unreconciledCredits - unreconciledDebits;

  const discrepancy = netBankBalance - netReconciledBalance - netUnreconciledBalance;

  return {
    bank: {
      totalCredits: totalBankCredits,
      totalDebits: totalBankDebits,
      netBalance: netBankBalance,
      totalTransactions: bankTotals?.totalTransactions || 0
    },
    reconciled: {
      totalCredits: reconciledCredits,
      totalDebits: reconciledDebits,
      netBalance: netReconciledBalance,
      count: reconciledTotals?.reconciledCount || 0
    },
    unreconciled: {
      totalCredits: unreconciledCredits,
      totalDebits: unreconciledDebits,
      netBalance: netUnreconciledBalance,
      count: unreconciledTotals?.unreconciledCount || 0
    },
    excluded: {
      totalAmount: excludedTotals?.excludedAmount || 0,
      count: excludedTotals?.excludedCount || 0
    },
    discrepancy,
    isBalanced: Math.abs(discrepancy) < 1 // Allow for rounding differences (less than 1 penny)
  };
}

/**
 * Gets reconciliation summary statistics for the report.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {Object} Summary statistics
 */
function getReportSummary(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [bankAccountId];

  if (startDate) {
    dateFilter += ' AND transactionDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += ' AND transactionDate <= ?';
    params.push(endDate);
  }

  // Get status counts
  const statusCounts = queryOne(`
    SELECT 
      COUNT(*) as totalTransactions,
      COALESCE(SUM(CASE WHEN reconciliationStatus = 'matched' OR isReconciled = 1 THEN 1 ELSE 0 END), 0) as reconciledCount,
      COALESCE(SUM(CASE WHEN reconciliationStatus = 'partial' THEN 1 ELSE 0 END), 0) as partialCount,
      COALESCE(SUM(CASE WHEN reconciliationStatus = 'unmatched' AND isReconciled = 0 THEN 1 ELSE 0 END), 0) as unmatchedCount,
      COALESCE(SUM(CASE WHEN reconciliationStatus = 'excluded' THEN 1 ELSE 0 END), 0) as excludedCount
    FROM bank_transactions
    WHERE bankAccountId = ?${dateFilter}
  `, params);

  // Get date range of transactions
  const dateRange = queryOne(`
    SELECT 
      MIN(transactionDate) as earliestDate,
      MAX(transactionDate) as latestDate
    FROM bank_transactions
    WHERE bankAccountId = ?${dateFilter}
  `, params);

  // Get last reconciliation info
  const lastReconciliation = queryOne(`
    SELECT 
      MAX(r.reconciledAt) as lastReconciliationDate,
      u.name as lastReconciledByName
    FROM reconciliations r
    LEFT JOIN users u ON r.reconciledBy = u.id
    INNER JOIN bank_transactions bt ON r.bankTransactionId = bt.id
    WHERE bt.bankAccountId = ? AND r.status = 'confirmed'${dateFilter.replace(/transactionDate/g, 'bt.transactionDate')}
  `, params);

  const total = statusCounts?.totalTransactions || 0;
  const reconciled = statusCounts?.reconciledCount || 0;
  const unreconciled = statusCounts?.unmatchedCount || 0;
  const excluded = statusCounts?.excludedCount || 0;

  // Calculate reconciliation progress
  const effectiveTotal = total - excluded;
  const progressPercentage = effectiveTotal > 0 
    ? Math.round((reconciled / effectiveTotal) * 100) 
    : 100;

  return {
    totalTransactions: total,
    reconciledCount: reconciled,
    partialCount: statusCounts?.partialCount || 0,
    unreconciledCount: unreconciled,
    excludedCount: excluded,
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
    dateRange: {
      earliest: dateRange?.earliestDate || null,
      latest: dateRange?.latestDate || null
    },
    lastReconciliation: {
      date: lastReconciliation?.lastReconciliationDate || null,
      performedBy: lastReconciliation?.lastReconciledByName || null
    }
  };
}

/**
 * Generates a complete reconciliation report for a bank account.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @param {number} [options.userId] - User ID for ownership verification
 * @returns {{success: boolean, data?: ReconciliationReportData, error?: string}}
 */
function generateReconciliationReport(bankAccountId, options = {}) {
  const { startDate, endDate, userId } = options;

  try {
    // Verify bank account exists
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }

    // Verify ownership if userId provided
    if (userId && bankAccount.userId !== userId) {
      return { success: false, error: 'Access denied' };
    }

    // Generate report sections
    const reconciledPairs = getReconciledPairs(bankAccountId, { startDate, endDate });
    const unreconciledTransactions = getUnreconciledBankTransactions(bankAccountId, { startDate, endDate });
    const excludedTransactions = getExcludedTransactions(bankAccountId, { startDate, endDate });
    const balances = calculateReportBalances(bankAccountId, { startDate, endDate });
    const summary = getReportSummary(bankAccountId, { startDate, endDate });

    // Build report metadata
    const reportInfo = {
      generatedAt: new Date().toISOString(),
      reportType: 'reconciliation',
      dateRange: {
        startDate: startDate || summary.dateRange.earliest,
        endDate: endDate || summary.dateRange.latest
      },
      filterApplied: !!(startDate || endDate)
    };

    return {
      success: true,
      data: {
        reportInfo,
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount),
        summary,
        balances,
        reconciledPairs,
        unreconciledTransactions,
        excludedTransactions
      }
    };

  } catch (error) {
    console.error('Error generating reconciliation report:', error.message);
    return { success: false, error: 'Failed to generate reconciliation report' };
  }
}

/**
 * Gets report data formatted for PDF generation.
 * Transforms the raw report data into a format suitable for PDF rendering.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @param {number} [options.userId] - User ID for ownership verification
 * @param {string} [options.lang='en'] - Language code
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getReportDataForPdf(bankAccountId, options = {}) {
  const result = generateReconciliationReport(bankAccountId, options);
  
  if (!result.success) {
    return result;
  }

  const { data } = result;
  const { lang = 'en' } = options;

  // Format currency amounts (from pence to pounds)
  const formatAmount = (amountInPence) => {
    const amount = amountInPence / 100;
    return amount.toFixed(2);
  };

  // Transform reconciled pairs for PDF
  const formattedReconciledPairs = data.reconciledPairs.map(pair => ({
    bankDate: pair.bankTransaction.transactionDate,
    bankDescription: pair.bankTransaction.description,
    bankReference: pair.bankTransaction.reference || '-',
    bankType: pair.bankTransaction.transactionType,
    bankAmount: formatAmount(pair.bankTransaction.amount),
    appDate: pair.appTransaction.transactionDate,
    appDescription: pair.appTransaction.description,
    appReference: pair.appTransaction.invoiceNumber || pair.appTransaction.reference || '-',
    appType: pair.appTransaction.type,
    appAmount: formatAmount(pair.appTransaction.amount),
    matchType: pair.reconciliation.matchType,
    matchAmount: formatAmount(pair.reconciliation.matchAmount),
    reconciledAt: pair.reconciliation.reconciledAt,
    reconciledBy: pair.reconciliation.reconciledByName || 'System'
  }));

  // Transform unreconciled transactions for PDF
  const formattedUnreconciled = data.unreconciledTransactions.map(t => ({
    date: t.transactionDate,
    description: t.description,
    reference: t.reference || '-',
    type: t.transactionType,
    amount: formatAmount(t.amount),
    status: t.status,
    notes: t.notes || '-'
  }));

  // Transform excluded transactions for PDF
  const formattedExcluded = data.excludedTransactions.map(t => ({
    date: t.transactionDate,
    description: t.description,
    reference: t.reference || '-',
    type: t.transactionType,
    amount: formatAmount(t.amount),
    reason: t.reason
  }));

  // Format balances for PDF
  const formattedBalances = {
    bank: {
      credits: formatAmount(data.balances.bank.totalCredits),
      debits: formatAmount(data.balances.bank.totalDebits),
      net: formatAmount(data.balances.bank.netBalance),
      transactionCount: data.balances.bank.totalTransactions
    },
    reconciled: {
      credits: formatAmount(data.balances.reconciled.totalCredits),
      debits: formatAmount(data.balances.reconciled.totalDebits),
      net: formatAmount(data.balances.reconciled.netBalance),
      count: data.balances.reconciled.count
    },
    unreconciled: {
      credits: formatAmount(data.balances.unreconciled.totalCredits),
      debits: formatAmount(data.balances.unreconciled.totalDebits),
      net: formatAmount(data.balances.unreconciled.netBalance),
      count: data.balances.unreconciled.count
    },
    excluded: {
      total: formatAmount(data.balances.excluded.totalAmount),
      count: data.balances.excluded.count
    },
    discrepancy: formatAmount(data.balances.discrepancy),
    isBalanced: data.balances.isBalanced
  };

  return {
    success: true,
    data: {
      reportInfo: data.reportInfo,
      bankAccount: {
        accountName: data.bankAccount.accountName,
        bankName: data.bankAccount.bankName,
        sortCodeFormatted: data.bankAccount.sortCodeFormatted,
        accountNumber: data.bankAccount.accountNumber,
        currency: data.bankAccount.currency || 'GBP'
      },
      summary: {
        ...data.summary,
        progressPercentage: data.summary.progressPercentage
      },
      balances: formattedBalances,
      reconciledPairs: formattedReconciledPairs,
      unreconciledTransactions: formattedUnreconciled,
      excludedTransactions: formattedExcluded,
      lang
    }
  };
}

/**
 * Validates that report can be generated for the given parameters.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateReportRequest(bankAccountId, options = {}) {
  const errors = [];

  if (!bankAccountId || !Number.isInteger(bankAccountId) || bankAccountId <= 0) {
    errors.push('Valid bank account ID is required');
  }

  if (options.startDate && options.endDate) {
    const start = new Date(options.startDate);
    const end = new Date(options.endDate);
    if (start > end) {
      errors.push('Start date must be before end date');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  // Main report generation
  generateReconciliationReport,
  getReportDataForPdf,
  
  // Individual report sections
  getReconciledPairs,
  getUnreconciledBankTransactions,
  getExcludedTransactions,
  calculateReportBalances,
  getReportSummary,
  
  // Validation
  validateReportRequest
};
