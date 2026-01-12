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

module.exports = router;
