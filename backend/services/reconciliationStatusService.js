/**
 * Reconciliation Status Service
 * 
 * Provides comprehensive reconciliation status summary and balance calculations
 * to show users their reconciliation progress. Calculates accurate counts,
 * balance discrepancies, and tracks last reconciliation dates.
 * 
 * @module services/reconciliationStatusService
 */

const { query, queryOne } = require('../database/index');
const BankTransaction = require('../database/models/BankTransaction');
const Reconciliation = require('../database/models/Reconciliation');
const BankAccount = require('../database/models/BankAccount');
const { timestampToDate, dateToTimestamp } = require('../utils/dateUtils');

/**
 * Reconciliation status summary object
 * @typedef {Object} ReconciliationStatusSummary
 * @property {number} totalTransactions - Total bank transactions count
 * @property {number} reconciledCount - Fully reconciled transactions count
 * @property {number} partiallyReconciledCount - Partially reconciled transactions count
 * @property {number} unreconciledCount - Unreconciled transactions count
 * @property {number} excludedCount - Excluded transactions count
 * @property {number} pendingMatchesCount - Pending reconciliation suggestions count
 * @property {number} reconciliationProgress - Reconciliation progress percentage (0-100)
 */

/**
 * Balance calculation result object
 * @typedef {Object} BalanceCalculation
 * @property {number} bankBalance - Current bank balance from transactions
 * @property {number} bookBalance - Book balance from reconciled app transactions
 * @property {number} unreconciledCredits - Total unreconciled credit amounts
 * @property {number} unreconciledDebits - Total unreconciled debit amounts
 * @property {number} discrepancy - Difference between bank and book balances
 * @property {boolean} isBalanced - Whether balances match
 */

/**
 * Gets the reconciliation status summary for a bank account.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {{success: boolean, data?: ReconciliationStatusSummary, error?: string}}
 */
function getReconciliationStatusSummary(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  try {
    // Verify bank account exists
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }

    // Build date filter clause
    let dateFilter = '';
    const params = [bankAccountId];
    
    if (startDate) {
      dateFilter += ' AND transactionDate >= ?';
      params.push(dateToTimestamp(startDate));
    }
    
    if (endDate) {
      const endTs = dateToTimestamp(endDate);
      dateFilter += ' AND transactionDate <= ?';
      params.push(endTs ? endTs + 86399 : endDate);
    }

    // Get transaction counts by reconciliation status
    const statusCounts = queryOne(`
      SELECT 
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN reconciliationStatus = 'matched' OR isReconciled = 1 THEN 1 ELSE 0 END), 0) as reconciledCount,
        COALESCE(SUM(CASE WHEN reconciliationStatus = 'partial' THEN 1 ELSE 0 END), 0) as partiallyReconciledCount,
        COALESCE(SUM(CASE WHEN reconciliationStatus = 'unmatched' AND isReconciled = 0 THEN 1 ELSE 0 END), 0) as unreconciledCount,
        COALESCE(SUM(CASE WHEN reconciliationStatus = 'excluded' THEN 1 ELSE 0 END), 0) as excludedCount
      FROM bank_transactions
      WHERE bankAccountId = ?${dateFilter}
    `, params);

    // Get pending matches count from reconciliations table
    const pendingMatchesResult = queryOne(`
      SELECT COUNT(*) as pendingMatchesCount
      FROM reconciliations r
      JOIN bank_transactions bt ON r.bankTransactionId = bt.id
      WHERE bt.bankAccountId = ? AND r.status = 'pending'${dateFilter.replace(/transactionDate/g, 'bt.transactionDate')}
    `, params);

    const totalTransactions = statusCounts?.totalTransactions || 0;
    const reconciledCount = statusCounts?.reconciledCount || 0;
    const partiallyReconciledCount = statusCounts?.partiallyReconciledCount || 0;
    const unreconciledCount = statusCounts?.unreconciledCount || 0;
    const excludedCount = statusCounts?.excludedCount || 0;
    const pendingMatchesCount = pendingMatchesResult?.pendingMatchesCount || 0;

    // Calculate reconciliation progress (exclude excluded transactions from denominator)
    const effectiveTotal = totalTransactions - excludedCount;
    const fullyReconciled = reconciledCount;
    const partiallyReconciled = partiallyReconciledCount * 0.5; // Count partial as 50%
    const reconciliationProgress = effectiveTotal > 0 
      ? Math.round(((fullyReconciled + partiallyReconciled) / effectiveTotal) * 100)
      : 100;

    return {
      success: true,
      data: {
        totalTransactions,
        reconciledCount,
        partiallyReconciledCount,
        unreconciledCount,
        excludedCount,
        pendingMatchesCount,
        reconciliationProgress: Math.min(100, Math.max(0, reconciliationProgress))
      }
    };
  } catch (error) {
    console.error('Error getting reconciliation status summary:', error.message);
    return { success: false, error: 'Failed to get reconciliation status summary' };
  }
}

/**
 * Calculates balance information for reconciliation.
 * Compares bank transaction totals with reconciled book transaction totals.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {{success: boolean, data?: BalanceCalculation, error?: string}}
 */
function calculateBalances(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  try {
    // Verify bank account exists
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }

    // Build date filter clause
    let dateFilter = '';
    const params = [bankAccountId];
    
    if (startDate) {
      dateFilter += ' AND transactionDate >= ?';
      params.push(dateToTimestamp(startDate));
    }
    
    if (endDate) {
      const endTs = dateToTimestamp(endDate);
      dateFilter += ' AND transactionDate <= ?';
      params.push(endTs ? endTs + 86399 : endDate);
    }

    // Calculate bank balance from bank transactions (credits - debits)
    const bankBalanceResult = queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as totalCredits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as totalDebits
      FROM bank_transactions
      WHERE bankAccountId = ?${dateFilter}
    `, params);

    const bankCredits = bankBalanceResult?.totalCredits || 0;
    const bankDebits = bankBalanceResult?.totalDebits || 0;
    const bankBalance = bankCredits - bankDebits;

    // Calculate book balance from reconciled app transactions
    const bookBalanceResult = queryOne(`
      SELECT 
        COALESCE(SUM(r.matchAmount), 0) as totalMatchedAmount
      FROM reconciliations r
      JOIN bank_transactions bt ON r.bankTransactionId = bt.id
      WHERE bt.bankAccountId = ? AND r.status = 'confirmed'${dateFilter.replace(/transactionDate/g, 'bt.transactionDate')}
    `, params);

    // Get reconciled credit and debit amounts separately
    const reconciledAmountsResult = queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN bt.transactionType = 'credit' THEN r.matchAmount ELSE 0 END), 0) as reconciledCredits,
        COALESCE(SUM(CASE WHEN bt.transactionType = 'debit' THEN r.matchAmount ELSE 0 END), 0) as reconciledDebits
      FROM reconciliations r
      JOIN bank_transactions bt ON r.bankTransactionId = bt.id
      WHERE bt.bankAccountId = ? AND r.status = 'confirmed'${dateFilter.replace(/transactionDate/g, 'bt.transactionDate')}
    `, params);

    const reconciledCredits = reconciledAmountsResult?.reconciledCredits || 0;
    const reconciledDebits = reconciledAmountsResult?.reconciledDebits || 0;
    const bookBalance = reconciledCredits - reconciledDebits;

    // Calculate unreconciled amounts
    const unreconciledCredits = bankCredits - reconciledCredits;
    const unreconciledDebits = bankDebits - reconciledDebits;

    // Calculate discrepancy
    const discrepancy = bankBalance - bookBalance;
    const isBalanced = discrepancy === 0;

    return {
      success: true,
      data: {
        bankBalance,
        bookBalance,
        unreconciledCredits,
        unreconciledDebits,
        discrepancy,
        isBalanced
      }
    };
  } catch (error) {
    console.error('Error calculating balances:', error.message);
    return { success: false, error: 'Failed to calculate balances' };
  }
}

/**
 * Gets unreconciled totals that identify discrepancies.
 * Groups unreconciled transactions by type and provides detailed breakdown.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getUnreconciledTotals(bankAccountId, options = {}) {
  const { startDate, endDate } = options;

  try {
    // Verify bank account exists
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }

    // Build date filter clause
    let dateFilter = '';
    const params = [bankAccountId];
    
    if (startDate) {
      dateFilter += ' AND transactionDate >= ?';
      params.push(dateToTimestamp(startDate));
    }
    
    if (endDate) {
      const endTs = dateToTimestamp(endDate);
      dateFilter += ' AND transactionDate <= ?';
      params.push(endTs ? endTs + 86399 : endDate);
    }

    // Get unreconciled transaction totals
    const unreconciledTotals = queryOne(`
      SELECT 
        COUNT(*) as unreconciledCount,
        COALESCE(SUM(amount), 0) as totalUnreconciledAmount,
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as unreconciledCredits,
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN 1 ELSE 0 END), 0) as unreconciledCreditsCount,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as unreconciledDebits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN 1 ELSE 0 END), 0) as unreconciledDebitsCount
      FROM bank_transactions
      WHERE bankAccountId = ? AND isReconciled = 0 AND reconciliationStatus != 'excluded'${dateFilter}
    `, params);

    // Get oldest unreconciled transaction date
    const oldestUnreconciled = queryOne(`
      SELECT MIN(transactionDate) as oldestDate
      FROM bank_transactions
      WHERE bankAccountId = ? AND isReconciled = 0 AND reconciliationStatus != 'excluded'${dateFilter}
    `, params);

    // Get unreconciled transactions grouped by month (for trend analysis)
    const unreconciledByMonth = query(`
      SELECT 
        strftime('%Y-%m', transactionDate, 'unixepoch') as month,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN transactionType = 'credit' THEN amount ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN transactionType = 'debit' THEN amount ELSE 0 END), 0) as debits
      FROM bank_transactions
      WHERE bankAccountId = ? AND isReconciled = 0 AND reconciliationStatus != 'excluded'${dateFilter}
      GROUP BY strftime('%Y-%m', transactionDate, 'unixepoch')
      ORDER BY month DESC
      LIMIT 12
    `, params);

    // Calculate net unreconciled amount
    const netUnreconciledAmount = 
      (unreconciledTotals?.unreconciledCredits || 0) - (unreconciledTotals?.unreconciledDebits || 0);

    return {
      success: true,
      data: {
        summary: {
          unreconciledCount: unreconciledTotals?.unreconciledCount || 0,
          totalUnreconciledAmount: unreconciledTotals?.totalUnreconciledAmount || 0,
          netUnreconciledAmount,
          oldestUnreconciledDate: oldestUnreconciled?.oldestDate 
            ? timestampToDate(oldestUnreconciled.oldestDate) 
            : null
        },
        credits: {
          count: unreconciledTotals?.unreconciledCreditsCount || 0,
          amount: unreconciledTotals?.unreconciledCredits || 0
        },
        debits: {
          count: unreconciledTotals?.unreconciledDebitsCount || 0,
          amount: unreconciledTotals?.unreconciledDebits || 0
        },
        byMonth: unreconciledByMonth
      }
    };
  } catch (error) {
    console.error('Error getting unreconciled totals:', error.message);
    return { success: false, error: 'Failed to get unreconciled totals' };
  }
}

/**
 * Gets the last reconciliation date and related information.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getLastReconciliationDate(bankAccountId) {
  try {
    // Verify bank account exists
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }

    // Get the most recent confirmed reconciliation date
    const lastReconciliation = queryOne(`
      SELECT 
        MAX(r.reconciledAt) as lastReconciliationDate,
        r.reconciledBy
      FROM reconciliations r
      JOIN bank_transactions bt ON r.bankTransactionId = bt.id
      WHERE bt.bankAccountId = ? AND r.status = 'confirmed' AND r.reconciledAt IS NOT NULL
      GROUP BY r.reconciledBy
      ORDER BY r.reconciledAt DESC
      LIMIT 1
    `, [bankAccountId]);

    // Get count of reconciliations done today
    const todayReconciliations = queryOne(`
      SELECT COUNT(*) as todayCount
      FROM reconciliations r
      JOIN bank_transactions bt ON r.bankTransactionId = bt.id
      WHERE bt.bankAccountId = ? 
        AND r.status = 'confirmed' 
        AND DATE(r.reconciledAt) = DATE('now')
    `, [bankAccountId]);

    // Get most recent bank transaction date that was reconciled
    const lastReconciledTransactionDate = queryOne(`
      SELECT MAX(bt.transactionDate) as lastReconciledTransactionDate
      FROM bank_transactions bt
      WHERE bt.bankAccountId = ? AND bt.isReconciled = 1
    `, [bankAccountId]);

    // Get user who performed last reconciliation
    let lastReconciledByUser = null;
    if (lastReconciliation?.reconciledBy) {
      const user = queryOne(
        'SELECT id, name, email FROM users WHERE id = ?',
        [lastReconciliation.reconciledBy]
      );
      if (user) {
        lastReconciledByUser = {
          id: user.id,
          name: user.name,
          email: user.email
        };
      }
    }

    return {
      success: true,
      data: {
        lastReconciliationDate: lastReconciliation?.lastReconciliationDate || null,
        lastReconciledTransactionDate: lastReconciledTransactionDate?.lastReconciledTransactionDate 
          ? timestampToDate(lastReconciledTransactionDate.lastReconciledTransactionDate) 
          : null,
        lastReconciledBy: lastReconciledByUser,
        reconciliationsToday: todayReconciliations?.todayCount || 0
      }
    };
  } catch (error) {
    console.error('Error getting last reconciliation date:', error.message);
    return { success: false, error: 'Failed to get last reconciliation date' };
  }
}

/**
 * Gets a comprehensive reconciliation status report combining all metrics.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {Object} [options] - Options
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getFullReconciliationStatus(bankAccountId, options = {}) {
  try {
    // Verify bank account exists
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }

    // Get all components
    const statusSummary = getReconciliationStatusSummary(bankAccountId, options);
    const balances = calculateBalances(bankAccountId, options);
    const unreconciledTotals = getUnreconciledTotals(bankAccountId, options);
    const lastReconciliation = getLastReconciliationDate(bankAccountId);

    // Check for any failures
    if (!statusSummary.success) {
      return statusSummary;
    }
    if (!balances.success) {
      return balances;
    }
    if (!unreconciledTotals.success) {
      return unreconciledTotals;
    }
    if (!lastReconciliation.success) {
      return lastReconciliation;
    }

    // Combine all data
    return {
      success: true,
      data: {
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount),
        statusSummary: statusSummary.data,
        balances: balances.data,
        unreconciledTotals: unreconciledTotals.data,
        lastReconciliation: lastReconciliation.data,
        dateRange: {
          startDate: options.startDate || null,
          endDate: options.endDate || null
        }
      }
    };
  } catch (error) {
    console.error('Error getting full reconciliation status:', error.message);
    return { success: false, error: 'Failed to get full reconciliation status' };
  }
}

/**
 * Gets reconciliation status for multiple bank accounts (user overview).
 * 
 * @param {number} userId - User ID
 * @returns {{success: boolean, data?: Object[], error?: string}}
 */
function getReconciliationStatusByUser(userId) {
  try {
    // Get all active bank accounts for user
    const bankAccounts = BankAccount.getActiveBankAccounts(userId);
    
    if (!bankAccounts || bankAccounts.length === 0) {
      return {
        success: true,
        data: {
          accounts: [],
          overallProgress: 100,
          totalUnreconciled: 0
        }
      };
    }

    const accountStatuses = [];
    let totalTransactions = 0;
    let totalReconciled = 0;
    let totalUnreconciledAmount = 0;

    for (const account of bankAccounts) {
      const statusResult = getReconciliationStatusSummary(account.id);
      const balanceResult = calculateBalances(account.id);
      const lastReconciliation = getLastReconciliationDate(account.id);

      if (statusResult.success && balanceResult.success && lastReconciliation.success) {
        const status = statusResult.data;
        const balance = balanceResult.data;
        const lastRecon = lastReconciliation.data;

        accountStatuses.push({
          bankAccount: {
            id: account.id,
            accountName: account.accountName,
            bankName: account.bankName,
            sortCodeFormatted: account.sortCodeFormatted,
            accountNumber: account.accountNumber,
            currentBalance: account.currentBalance,
            currency: account.currency
          },
          status: {
            totalTransactions: status.totalTransactions,
            reconciledCount: status.reconciledCount,
            unreconciledCount: status.unreconciledCount,
            reconciliationProgress: status.reconciliationProgress,
            pendingMatchesCount: status.pendingMatchesCount
          },
          balance: {
            discrepancy: balance.discrepancy,
            isBalanced: balance.isBalanced,
            unreconciledCredits: balance.unreconciledCredits,
            unreconciledDebits: balance.unreconciledDebits
          },
          lastReconciliation: lastRecon
        });

        totalTransactions += status.totalTransactions;
        totalReconciled += status.reconciledCount;
        totalUnreconciledAmount += balance.unreconciledCredits + balance.unreconciledDebits;
      }
    }

    // Calculate overall progress
    const overallProgress = totalTransactions > 0
      ? Math.round((totalReconciled / totalTransactions) * 100)
      : 100;

    return {
      success: true,
      data: {
        accounts: accountStatuses,
        summary: {
          totalAccounts: bankAccounts.length,
          overallProgress,
          totalTransactions,
          totalReconciled,
          totalUnreconciled: totalTransactions - totalReconciled,
          totalUnreconciledAmount
        }
      }
    };
  } catch (error) {
    console.error('Error getting reconciliation status by user:', error.message);
    return { success: false, error: 'Failed to get reconciliation status by user' };
  }
}

module.exports = {
  // Core functions
  getReconciliationStatusSummary,
  calculateBalances,
  getUnreconciledTotals,
  getLastReconciliationDate,
  
  // Combined reports
  getFullReconciliationStatus,
  getReconciliationStatusByUser
};
