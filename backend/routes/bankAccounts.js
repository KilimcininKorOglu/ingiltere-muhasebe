/**
 * Bank Accounts Routes
 * API routes for bank account CRUD operations.
 * All routes are prefixed with /api/bank-accounts
 * 
 * @module routes/bankAccounts
 */

const express = require('express');
const router = express.Router();

const {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
  reactivateBankAccount,
  searchBankAccounts
} = require('../controllers/bankAccountController');

const {
  getBankTransactions,
  getTransactionSummary,
  searchBankTransactions
} = require('../controllers/bankTransactionController');

const {
  autoReconcile,
  getReconciliationSummary
} = require('../controllers/reconciliationController');

const {
  validateCreateBankAccount,
  validateUpdateBankAccount,
  sanitizeBankAccountData,
  authenticateToken
} = require('../middleware/validation');

/**
 * @route   GET /api/bank-accounts/search
 * @desc    Search bank accounts by name or bank name
 * @query   q - Search term
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccounts: BankAccountData[], count: number } }
 */
router.get('/search', authenticateToken, searchBankAccounts);

/**
 * @route   GET /api/bank-accounts
 * @desc    Get all bank accounts for the authenticated user
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @query   activeOnly - Filter for active accounts only (default: false)
 * @query   accountType - Filter by account type (current, savings, business)
 * @query   sortBy - Sort field (default: accountName)
 * @query   sortOrder - Sort order (default: ASC)
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccounts: BankAccountData[], pagination: {...}, summary: {...} } }
 */
router.get('/', authenticateToken, getBankAccounts);

/**
 * @route   GET /api/bank-accounts/:id
 * @desc    Get a single bank account by ID
 * @param   id - Bank account ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: BankAccountData } }
 */
router.get('/:id', authenticateToken, getBankAccountById);

/**
 * @route   POST /api/bank-accounts
 * @desc    Create a new bank account
 * @body    { 
 *            accountName: string,
 *            bankName: string,
 *            sortCode: string,
 *            accountNumber: string,
 *            accountType?: 'current' | 'savings' | 'business',
 *            iban?: string,
 *            bic?: string,
 *            currency?: 'GBP' | 'EUR' | 'USD',
 *            openingBalance?: number,
 *            isDefault?: boolean,
 *            notes?: string
 *          }
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: BankAccountData } }
 */
router.post('/', authenticateToken, sanitizeBankAccountData, validateCreateBankAccount, createBankAccount);

/**
 * @route   PUT /api/bank-accounts/:id
 * @desc    Update a bank account
 * @param   id - Bank account ID
 * @body    Partial bank account data to update
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: BankAccountData } }
 */
router.put('/:id', authenticateToken, sanitizeBankAccountData, validateUpdateBankAccount, updateBankAccount);

/**
 * @route   DELETE /api/bank-accounts/:id
 * @desc    Soft delete (deactivate) a bank account
 * @param   id - Bank account ID
 * @query   force - Force hard delete (default: false)
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: BankAccountData, message: {...} } }
 */
router.delete('/:id', authenticateToken, deleteBankAccount);

/**
 * @route   POST /api/bank-accounts/:id/default
 * @desc    Set a bank account as the default
 * @param   id - Bank account ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: BankAccountData } }
 */
router.post('/:id/default', authenticateToken, setDefaultBankAccount);

/**
 * @route   POST /api/bank-accounts/:id/reactivate
 * @desc    Reactivate a deactivated bank account
 * @param   id - Bank account ID
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: BankAccountData } }
 */
router.post('/:id/reactivate', authenticateToken, reactivateBankAccount);

// ==========================================
// Bank Transaction Routes (nested under bank accounts)
// ==========================================

/**
 * @route   GET /api/bank-accounts/:bankAccountId/transactions/search
 * @desc    Search transactions by description or reference
 * @param   bankAccountId - Bank account ID
 * @query   q - Search term
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { transactions: BankTransactionData[], count: number } }
 */
router.get('/:bankAccountId/transactions/search', authenticateToken, searchBankTransactions);

/**
 * @route   GET /api/bank-accounts/:bankAccountId/transactions/summary
 * @desc    Get transaction summary for a bank account
 * @param   bankAccountId - Bank account ID
 * @query   startDate - Start date (YYYY-MM-DD)
 * @query   endDate - End date (YYYY-MM-DD)
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { summary: {...}, reconciliationCounts: {...}, bankAccount: {...} } }
 */
router.get('/:bankAccountId/transactions/summary', authenticateToken, getTransactionSummary);

/**
 * @route   GET /api/bank-accounts/:bankAccountId/transactions
 * @desc    Get all transactions for a bank account with pagination and filtering
 * @param   bankAccountId - Bank account ID
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50)
 * @query   startDate - Filter by start date (YYYY-MM-DD)
 * @query   endDate - Filter by end date (YYYY-MM-DD)
 * @query   transactionType - Filter by type (credit/debit)
 * @query   reconciliationStatus - Filter by reconciliation status
 * @query   sortBy - Sort field (default: transactionDate)
 * @query   sortOrder - Sort order (default: DESC)
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { transactions: BankTransactionData[], pagination: {...}, summary: {...} } }
 */
router.get('/:bankAccountId/transactions', authenticateToken, getBankTransactions);

// ==========================================
// Reconciliation Routes (nested under bank accounts)
// ==========================================

/**
 * @route   GET /api/bank-accounts/:bankAccountId/reconciliation-summary
 * @desc    Get reconciliation summary for a bank account
 * @param   bankAccountId - Bank account ID
 * @query   startDate - Filter by start date (YYYY-MM-DD)
 * @query   endDate - Filter by end date (YYYY-MM-DD)
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { bankAccount: {...}, bankTransactionSummary: {...}, reconciliationSummary: {...} } }
 */
router.get('/:bankAccountId/reconciliation-summary', authenticateToken, getReconciliationSummary);

/**
 * @route   POST /api/bank-accounts/:bankAccountId/auto-reconcile
 * @desc    Auto-reconcile bank transactions based on high-confidence matches
 * @param   bankAccountId - Bank account ID
 * @body    { minConfidence?: number (default: 90), dryRun?: boolean (default: false) }
 * @query   lang - Language preference (en/tr)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { matches: [...], matchedCount: number, skippedCount: number } }
 */
router.post('/:bankAccountId/auto-reconcile', authenticateToken, autoReconcile);

module.exports = router;
