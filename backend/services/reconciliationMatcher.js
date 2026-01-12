/**
 * Reconciliation Matcher Service
 * 
 * Provides intelligent matching between bank transactions and application transactions.
 * Uses multiple criteria to suggest potential matches with confidence scores.
 * 
 * Matching criteria include:
 * - Exact amount match
 * - Date proximity
 * - Reference/description similarity
 * - Transaction type compatibility
 * 
 * @module services/reconciliationMatcher
 */

const BankTransaction = require('../database/models/BankTransaction');
const Transaction = require('../database/models/Transaction');
const Reconciliation = require('../database/models/Reconciliation');
const BankAccount = require('../database/models/BankAccount');
const { query, queryOne, execute, openDatabase, transaction: dbTransaction } = require('../database/index');

/**
 * Matching configuration defaults
 */
const MATCHING_CONFIG = {
  // Maximum date difference (in days) to consider for matching
  maxDateDifferenceInDays: 7,
  
  // Score weights (must sum to 100)
  weights: {
    amountMatch: 50,     // 50% weight for exact amount match
    dateProximity: 25,   // 25% weight for date proximity
    descriptionMatch: 15, // 15% weight for description similarity
    referenceMatch: 10   // 10% weight for reference match
  },
  
  // Minimum confidence score to suggest a match
  minConfidenceThreshold: 50,
  
  // Maximum number of suggestions per bank transaction
  maxSuggestionsPerTransaction: 5
};

/**
 * Calculates similarity between two strings using simple word overlap.
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const words1 = new Set(normalize(str1).split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalize(str2).split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let matchCount = 0;
  for (const word of words1) {
    if (words2.has(word)) matchCount++;
  }
  
  // Jaccard similarity
  const union = new Set([...words1, ...words2]);
  return matchCount / union.size;
}

/**
 * Calculates the number of days between two dates.
 * 
 * @param {string} date1 - First date (YYYY-MM-DD)
 * @param {string} date2 - Second date (YYYY-MM-DD)
 * @returns {number} Absolute difference in days
 */
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determines if bank transaction type is compatible with app transaction type.
 * 
 * Bank credit (money in) should match income transactions.
 * Bank debit (money out) should match expense transactions.
 * 
 * @param {string} bankType - Bank transaction type ('credit' or 'debit')
 * @param {string} appType - App transaction type ('income', 'expense', 'transfer')
 * @returns {boolean} True if types are compatible
 */
function areTypesCompatible(bankType, appType) {
  if (bankType === 'credit') {
    return appType === 'income' || appType === 'transfer';
  }
  if (bankType === 'debit') {
    return appType === 'expense' || appType === 'transfer';
  }
  return false;
}

/**
 * Calculates match confidence score between a bank transaction and an app transaction.
 * 
 * @param {Object} bankTransaction - Bank transaction object
 * @param {Object} appTransaction - Application transaction object
 * @param {Object} [config] - Optional matching configuration
 * @returns {{score: number, details: Object}} Confidence score (0-100) and details
 */
function calculateMatchScore(bankTransaction, appTransaction, config = MATCHING_CONFIG) {
  const details = {
    amountScore: 0,
    dateScore: 0,
    descriptionScore: 0,
    referenceScore: 0,
    typeCompatible: false
  };
  
  // Check type compatibility - if not compatible, no match possible
  if (!areTypesCompatible(bankTransaction.transactionType, appTransaction.type)) {
    return { score: 0, details: { ...details, reason: 'Incompatible transaction types' } };
  }
  details.typeCompatible = true;
  
  // 1. Amount matching (50% weight by default)
  // Compare bank transaction amount with app transaction totalAmount
  const bankAmount = bankTransaction.amount;
  const appAmount = appTransaction.totalAmount || appTransaction.amount;
  
  if (bankAmount === appAmount) {
    details.amountScore = config.weights.amountMatch;
  } else {
    // Partial score for close amounts (within 5%)
    const difference = Math.abs(bankAmount - appAmount);
    const maxAmount = Math.max(bankAmount, appAmount);
    const percentDiff = (difference / maxAmount) * 100;
    
    if (percentDiff <= 1) {
      details.amountScore = config.weights.amountMatch * 0.9; // 90% for 1% difference
    } else if (percentDiff <= 5) {
      details.amountScore = config.weights.amountMatch * 0.5; // 50% for 5% difference
    }
    // Otherwise 0
  }
  
  // 2. Date proximity (25% weight by default)
  const daysDiff = getDaysDifference(bankTransaction.transactionDate, appTransaction.transactionDate);
  
  if (daysDiff === 0) {
    details.dateScore = config.weights.dateProximity;
  } else if (daysDiff <= 1) {
    details.dateScore = config.weights.dateProximity * 0.9;
  } else if (daysDiff <= 3) {
    details.dateScore = config.weights.dateProximity * 0.7;
  } else if (daysDiff <= config.maxDateDifferenceInDays) {
    details.dateScore = config.weights.dateProximity * (1 - daysDiff / config.maxDateDifferenceInDays);
  }
  // Otherwise 0
  
  // 3. Description matching (15% weight by default)
  const descriptionSimilarity = calculateStringSimilarity(
    bankTransaction.description,
    appTransaction.description
  );
  details.descriptionScore = config.weights.descriptionMatch * descriptionSimilarity;
  
  // 4. Reference matching (10% weight by default)
  if (bankTransaction.reference && appTransaction.reference) {
    const refSimilarity = calculateStringSimilarity(
      bankTransaction.reference,
      appTransaction.reference
    );
    details.referenceScore = config.weights.referenceMatch * refSimilarity;
    
    // Bonus for exact reference match
    if (bankTransaction.reference.toLowerCase().trim() === appTransaction.reference.toLowerCase().trim()) {
      details.referenceScore = config.weights.referenceMatch;
    }
  } else if (bankTransaction.reference || appTransaction.reference) {
    // Check if reference appears in the other's description
    const ref = bankTransaction.reference || appTransaction.reference;
    const desc = bankTransaction.reference ? appTransaction.description : bankTransaction.description;
    if (desc && desc.toLowerCase().includes(ref.toLowerCase())) {
      details.referenceScore = config.weights.referenceMatch * 0.5;
    }
  }
  
  const totalScore = Math.round(
    details.amountScore + 
    details.dateScore + 
    details.descriptionScore + 
    details.referenceScore
  );
  
  return {
    score: Math.min(100, Math.max(0, totalScore)),
    details
  };
}

/**
 * Finds potential matching app transactions for a bank transaction.
 * 
 * @param {number} bankTransactionId - Bank transaction ID
 * @param {Object} [options] - Options
 * @param {number} [options.limit=5] - Maximum number of suggestions
 * @param {number} [options.minConfidence=50] - Minimum confidence threshold
 * @returns {{success: boolean, matches?: Array, error?: string}}
 */
function findPotentialMatches(bankTransactionId, options = {}) {
  const {
    limit = MATCHING_CONFIG.maxSuggestionsPerTransaction,
    minConfidence = MATCHING_CONFIG.minConfidenceThreshold
  } = options;
  
  try {
    // Get the bank transaction
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return { success: false, error: 'Bank transaction not found' };
    }
    
    // Skip if already reconciled
    if (bankTransaction.isReconciled) {
      return { success: false, error: 'Bank transaction is already reconciled' };
    }
    
    // Get the bank account to find the user
    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }
    
    const userId = bankAccount.userId;
    
    // Determine the date range for searching
    const bankDate = new Date(bankTransaction.transactionDate);
    const startDate = new Date(bankDate);
    startDate.setDate(startDate.getDate() - MATCHING_CONFIG.maxDateDifferenceInDays);
    const endDate = new Date(bankDate);
    endDate.setDate(endDate.getDate() + MATCHING_CONFIG.maxDateDifferenceInDays);
    
    // Get app transactions within the date range that are not already reconciled
    const appTransactions = query(`
      SELECT * FROM transactions
      WHERE userId = ?
        AND transactionDate >= ?
        AND transactionDate <= ?
        AND status != 'void'
        AND (status != 'reconciled' OR isReconciled IS NULL OR isReconciled = 0)
      ORDER BY transactionDate DESC
    `, [
      userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);
    
    // Calculate match scores for each app transaction
    const matches = [];
    for (const appTxn of appTransactions) {
      // Skip if already has a confirmed reconciliation with this bank transaction
      if (Reconciliation.hasConfirmedReconciliation(bankTransactionId, appTxn.id)) {
        continue;
      }
      
      const { score, details } = calculateMatchScore(bankTransaction, appTxn);
      
      if (score >= minConfidence) {
        matches.push({
          transactionId: appTxn.id,
          transaction: Transaction.sanitizeTransaction(appTxn),
          matchConfidence: score,
          matchDetails: details
        });
      }
    }
    
    // Sort by confidence score (highest first) and limit results
    matches.sort((a, b) => b.matchConfidence - a.matchConfidence);
    const topMatches = matches.slice(0, limit);
    
    return {
      success: true,
      bankTransaction: BankTransaction.sanitizeBankTransaction(bankTransaction),
      matches: topMatches,
      totalCandidates: appTransactions.length,
      matchesAboveThreshold: matches.length
    };
  } catch (error) {
    console.error('Error finding potential matches:', error.message);
    return { success: false, error: 'Failed to find potential matches' };
  }
}

/**
 * Creates a reconciliation match between a bank transaction and an app transaction.
 * 
 * @param {number} bankTransactionId - Bank transaction ID
 * @param {number} transactionId - App transaction ID
 * @param {number} userId - User performing the reconciliation
 * @param {Object} [options] - Options
 * @param {string} [options.matchType='exact'] - Match type
 * @param {string} [options.notes] - Notes
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function createMatch(bankTransactionId, transactionId, userId, options = {}) {
  const { matchType = 'exact', notes = null } = options;
  
  try {
    // Get the bank transaction
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return { success: false, error: 'Bank transaction not found' };
    }
    
    // Get the app transaction
    const appTransaction = Transaction.findById(transactionId);
    if (!appTransaction) {
      return { success: false, error: 'Application transaction not found' };
    }
    
    // Validate user ownership via bank account
    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }
    
    if (bankAccount.userId !== userId) {
      return { success: false, error: 'Bank transaction does not belong to this user' };
    }
    
    // Validate app transaction ownership
    if (appTransaction.userId !== userId) {
      return { success: false, error: 'Application transaction does not belong to this user' };
    }
    
    // Check type compatibility
    if (!areTypesCompatible(bankTransaction.transactionType, appTransaction.type)) {
      return { success: false, error: 'Transaction types are not compatible for matching' };
    }
    
    // Check if already reconciled
    if (Reconciliation.hasConfirmedReconciliation(bankTransactionId, transactionId)) {
      return { success: false, error: 'These transactions are already reconciled' };
    }
    
    // Determine match amount (use app transaction totalAmount)
    const matchAmount = appTransaction.totalAmount || appTransaction.amount;
    
    // Determine match type based on amounts
    let actualMatchType = matchType;
    if (matchAmount !== bankTransaction.amount) {
      actualMatchType = 'partial';
    }
    
    // Calculate confidence score for audit trail
    const { score } = calculateMatchScore(bankTransaction, appTransaction);
    
    // Create the reconciliation with confirmed status
    const result = Reconciliation.reconcile(
      bankTransactionId,
      transactionId,
      matchAmount,
      userId,
      {
        matchType: actualMatchType,
        notes
      }
    );
    
    if (!result.success) {
      return { success: false, error: result.errors?.general || 'Failed to create reconciliation' };
    }
    
    // The database triggers should have updated both transactions, but let's verify
    const updatedBankTxn = BankTransaction.findById(bankTransactionId);
    const updatedAppTxn = Transaction.findById(transactionId);
    
    return {
      success: true,
      data: {
        reconciliation: result.data,
        bankTransaction: BankTransaction.sanitizeBankTransaction(updatedBankTxn),
        appTransaction: Transaction.sanitizeTransaction(updatedAppTxn),
        matchConfidence: score
      }
    };
  } catch (error) {
    console.error('Error creating match:', error.message);
    return { success: false, error: 'Failed to create reconciliation match' };
  }
}

/**
 * Removes a reconciliation match (unreconciles transactions).
 * 
 * @param {number} reconciliationId - Reconciliation ID
 * @param {number} userId - User performing the action
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function removeMatch(reconciliationId, userId) {
  try {
    // Get the reconciliation
    const reconciliation = Reconciliation.findById(reconciliationId);
    if (!reconciliation) {
      return { success: false, error: 'Reconciliation not found' };
    }
    
    // Get the bank transaction to verify ownership
    const bankTransaction = BankTransaction.findById(reconciliation.bankTransactionId);
    if (!bankTransaction) {
      return { success: false, error: 'Bank transaction not found' };
    }
    
    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return { success: false, error: 'Unauthorized to remove this reconciliation' };
    }
    
    const transactionId = reconciliation.transactionId;
    const bankTransactionId = reconciliation.bankTransactionId;
    
    // Delete the reconciliation
    const deleteResult = Reconciliation.deleteReconciliation(reconciliationId);
    if (!deleteResult.success) {
      return { success: false, error: deleteResult.error || 'Failed to delete reconciliation' };
    }
    
    // Update bank transaction status if no more confirmed reconciliations
    const remainingReconciliations = Reconciliation.getByBankTransactionId(bankTransactionId, { status: 'confirmed' });
    if (remainingReconciliations.length === 0) {
      BankTransaction.updateReconciliationStatus(bankTransactionId, 'unmatched');
    }
    
    // Update app transaction status if no more confirmed reconciliations
    const appReconciliations = Reconciliation.getByTransactionId(transactionId, { status: 'confirmed' });
    if (appReconciliations.length === 0) {
      Transaction.updateStatus(transactionId, 'cleared');
    }
    
    // Get updated transactions
    const updatedBankTxn = BankTransaction.findById(bankTransactionId);
    const updatedAppTxn = Transaction.findById(transactionId);
    
    return {
      success: true,
      data: {
        bankTransaction: BankTransaction.sanitizeBankTransaction(updatedBankTxn),
        appTransaction: Transaction.sanitizeTransaction(updatedAppTxn),
        message: 'Reconciliation removed successfully'
      }
    };
  } catch (error) {
    console.error('Error removing match:', error.message);
    return { success: false, error: 'Failed to remove reconciliation' };
  }
}

/**
 * Removes all reconciliations for a bank transaction (unreconciles completely).
 * 
 * @param {number} bankTransactionId - Bank transaction ID
 * @param {number} userId - User performing the action
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function unreconcileBankTransaction(bankTransactionId, userId) {
  try {
    // Get the bank transaction to verify ownership
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return { success: false, error: 'Bank transaction not found' };
    }
    
    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return { success: false, error: 'Unauthorized to unreconcile this transaction' };
    }
    
    // Get all reconciliations for this bank transaction
    const reconciliations = Reconciliation.getByBankTransactionId(bankTransactionId);
    const affectedAppTransactions = new Set();
    
    // Delete each reconciliation
    for (const recon of reconciliations) {
      affectedAppTransactions.add(recon.transactionId);
      Reconciliation.deleteReconciliation(recon.id);
    }
    
    // Update bank transaction status
    BankTransaction.updateReconciliationStatus(bankTransactionId, 'unmatched');
    
    // Update affected app transactions
    for (const txnId of affectedAppTransactions) {
      const appReconciliations = Reconciliation.getByTransactionId(txnId, { status: 'confirmed' });
      if (appReconciliations.length === 0) {
        Transaction.updateStatus(txnId, 'cleared');
      }
    }
    
    const updatedBankTxn = BankTransaction.findById(bankTransactionId);
    
    return {
      success: true,
      data: {
        bankTransaction: BankTransaction.sanitizeBankTransaction(updatedBankTxn),
        removedReconciliations: reconciliations.length,
        affectedAppTransactions: affectedAppTransactions.size
      }
    };
  } catch (error) {
    console.error('Error unreconciling bank transaction:', error.message);
    return { success: false, error: 'Failed to unreconcile bank transaction' };
  }
}

/**
 * Auto-reconciles transactions based on high-confidence matches.
 * Only creates matches with confidence >= threshold.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @param {number} userId - User performing auto-reconciliation
 * @param {Object} [options] - Options
 * @param {number} [options.minConfidence=90] - Minimum confidence for auto-match
 * @param {boolean} [options.dryRun=false] - If true, returns suggestions without creating matches
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function autoReconcile(bankAccountId, userId, options = {}) {
  const { minConfidence = 90, dryRun = false } = options;
  
  try {
    // Verify bank account ownership
    const bankAccount = BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      return { success: false, error: 'Bank account not found' };
    }
    
    if (bankAccount.userId !== userId) {
      return { success: false, error: 'Unauthorized to reconcile this bank account' };
    }
    
    // Get unreconciled bank transactions
    const unreconciledBankTxns = BankTransaction.getUnreconciledTransactions(bankAccountId);
    
    const suggestions = [];
    const matches = [];
    const skipped = [];
    
    for (const bankTxn of unreconciledBankTxns) {
      const result = findPotentialMatches(bankTxn.id, { limit: 1, minConfidence });
      
      if (result.success && result.matches.length > 0) {
        const topMatch = result.matches[0];
        
        if (topMatch.matchConfidence >= minConfidence) {
          if (dryRun) {
            suggestions.push({
              bankTransaction: result.bankTransaction,
              suggestedMatch: topMatch
            });
          } else {
            // Create the match
            const matchResult = createMatch(
              bankTxn.id,
              topMatch.transactionId,
              userId,
              { matchType: 'exact', notes: `Auto-matched with ${topMatch.matchConfidence}% confidence` }
            );
            
            if (matchResult.success) {
              matches.push(matchResult.data);
            } else {
              skipped.push({
                bankTransactionId: bankTxn.id,
                reason: matchResult.error
              });
            }
          }
        }
      }
    }
    
    if (dryRun) {
      return {
        success: true,
        data: {
          suggestions,
          suggestedCount: suggestions.length,
          unreconciledCount: unreconciledBankTxns.length
        }
      };
    }
    
    return {
      success: true,
      data: {
        matches,
        matchedCount: matches.length,
        skippedCount: skipped.length,
        skipped,
        unreconciledRemaining: unreconciledBankTxns.length - matches.length
      }
    };
  } catch (error) {
    console.error('Error in auto-reconcile:', error.message);
    return { success: false, error: 'Failed to auto-reconcile transactions' };
  }
}

/**
 * Validates that a match can be created between two transactions.
 * Checks amounts, types, and existing reconciliations.
 * 
 * @param {number} bankTransactionId - Bank transaction ID
 * @param {number} transactionId - App transaction ID
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateMatch(bankTransactionId, transactionId) {
  const errors = [];
  
  const bankTransaction = BankTransaction.findById(bankTransactionId);
  if (!bankTransaction) {
    errors.push('Bank transaction not found');
    return { valid: false, errors };
  }
  
  const appTransaction = Transaction.findById(transactionId);
  if (!appTransaction) {
    errors.push('Application transaction not found');
    return { valid: false, errors };
  }
  
  // Check type compatibility
  if (!areTypesCompatible(bankTransaction.transactionType, appTransaction.type)) {
    errors.push(`Bank transaction type '${bankTransaction.transactionType}' is not compatible with app transaction type '${appTransaction.type}'`);
  }
  
  // Check if already reconciled
  if (Reconciliation.hasConfirmedReconciliation(bankTransactionId, transactionId)) {
    errors.push('These transactions are already reconciled together');
  }
  
  // Check if bank transaction is marked as excluded
  if (bankTransaction.reconciliationStatus === 'excluded') {
    errors.push('Bank transaction is excluded from reconciliation');
  }
  
  // Check if app transaction is voided
  if (appTransaction.status === 'void') {
    errors.push('Application transaction is voided');
  }
  
  // Check amount mismatch (warning, not error)
  const bankAmount = bankTransaction.amount;
  const appAmount = appTransaction.totalAmount || appTransaction.amount;
  
  if (bankAmount !== appAmount) {
    const diff = Math.abs(bankAmount - appAmount);
    const percentDiff = ((diff / Math.max(bankAmount, appAmount)) * 100).toFixed(1);
    errors.push(`Amount mismatch: Bank £${(bankAmount / 100).toFixed(2)} vs App £${(appAmount / 100).toFixed(2)} (${percentDiff}% difference)`);
  }
  
  return {
    valid: errors.length === 0 || (errors.length === 1 && errors[0].startsWith('Amount mismatch')),
    errors,
    bankTransaction: BankTransaction.sanitizeBankTransaction(bankTransaction),
    appTransaction: Transaction.sanitizeTransaction(appTransaction)
  };
}

module.exports = {
  // Core matching functions
  findPotentialMatches,
  calculateMatchScore,
  validateMatch,
  
  // Reconciliation operations
  createMatch,
  removeMatch,
  unreconcileBankTransaction,
  autoReconcile,
  
  // Utility functions
  calculateStringSimilarity,
  getDaysDifference,
  areTypesCompatible,
  
  // Configuration
  MATCHING_CONFIG
};
