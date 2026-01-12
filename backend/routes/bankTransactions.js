/**
 * Bank Transactions Routes
 * API routes for bank transaction CRUD operations.
 * All routes are prefixed with /api/bank-transactions
 * 
 * @module routes/bankTransactions
 */

const express = require('express');
const router = express.Router();

const {
  createBankTransaction,
  getBankTransactionById,
  updateBankTransaction,
  deleteBankTransaction,
  updateReconciliationStatus
} = require('../controllers/bankTransactionController');

const {
  getSuggestedMatches,
  reconcileTransaction,
  unreconcileTransaction,
  getReconciliations,
  validateMatch
} = require('../controllers/reconciliationController');

const { authenticate } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/validation');

/**
 * @route   POST /api/bank-transactions
 * @desc    Create a new bank transaction
 * @body    {
 *            bankAccountId: number (required),
 *            transactionDate: string (required, YYYY-MM-DD),
 *            description: string (required),
 *            transactionType: 'credit' | 'debit' (required),
 *            amount: number (required, in pence),
 *            postingDate?: string (YYYY-MM-DD),
 *            reference?: string,
 *            runningBalance?: number,
 *            importSource?: string,
 *            importBatchId?: string,
 *            rawData?: string,
 *            fitId?: string,
 *            reconciliationStatus?: string,
 *            reconciliationNotes?: string
 *          }
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { transaction: BankTransactionData } }
 */
router.post('/', authenticate, createBankTransaction);

/**
 * @route   GET /api/bank-transactions/:id
 * @desc    Get a single bank transaction by ID
 * @param   id - Transaction ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { transaction: BankTransactionData } }
 */
router.get('/:id', authenticate, getBankTransactionById);

/**
 * @route   PUT /api/bank-transactions/:id
 * @desc    Update a bank transaction (cannot update reconciled transactions)
 * @param   id - Transaction ID
 * @body    Partial transaction data to update
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { transaction: BankTransactionData } }
 */
router.put('/:id', authenticate, updateBankTransaction);

/**
 * @route   DELETE /api/bank-transactions/:id
 * @desc    Delete a bank transaction (cannot delete reconciled transactions)
 * @param   id - Transaction ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { message: {...} } }
 */
router.delete('/:id', authenticate, deleteBankTransaction);

/**
 * @route   PATCH /api/bank-transactions/:id/reconciliation
 * @desc    Update reconciliation status of a transaction
 * @param   id - Transaction ID
 * @body    { status: 'unmatched' | 'pending' | 'matched' | 'excluded', notes?: string }
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { transaction: BankTransactionData } }
 */
router.patch('/:id/reconciliation', authenticate, updateReconciliationStatus);

// ==========================================
// Reconciliation Matching Routes
// ==========================================

/**
 * @route   GET /api/bank-transactions/:id/matches
 * @desc    Get suggested matching app transactions for a bank transaction
 * @param   id - Bank transaction ID
 * @query   limit - Maximum number of suggestions (default: 5)
 * @query   minConfidence - Minimum confidence threshold (default: 50)
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankTransaction: {...}, matches: [...], totalCandidates: number } }
 */
router.get('/:id/matches', authenticate, getSuggestedMatches);

/**
 * @route   GET /api/bank-transactions/:id/reconciliations
 * @desc    Get all reconciliations for a bank transaction
 * @param   id - Bank transaction ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankTransaction: {...}, reconciliations: [...], summary: {...} } }
 */
router.get('/:id/reconciliations', authenticate, getReconciliations);

/**
 * @route   POST /api/bank-transactions/:id/reconcile
 * @desc    Create a reconciliation match between bank transaction and app transaction
 * @param   id - Bank transaction ID
 * @body    { transactionId: number, matchType?: 'exact' | 'partial' | 'split' | 'adjustment', notes?: string }
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { reconciliation: {...}, bankTransaction: {...}, appTransaction: {...} } }
 */
router.post('/:id/reconcile', authenticate, reconcileTransaction);

/**
 * @route   DELETE /api/bank-transactions/:id/reconcile
 * @desc    Remove all reconciliations for a bank transaction (unreconcile)
 * @param   id - Bank transaction ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankTransaction: {...}, removedReconciliations: number } }
 */
router.delete('/:id/reconcile', authenticate, unreconcileTransaction);

/**
 * @route   POST /api/bank-transactions/:id/validate-match
 * @desc    Validate a potential match before creating it
 * @param   id - Bank transaction ID
 * @body    { transactionId: number }
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { valid: boolean, errors: [...], matchScore: {...} } }
 */
router.post('/:id/validate-match', authenticate, validateMatch);

module.exports = router;
