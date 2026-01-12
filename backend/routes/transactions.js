/**
 * Transaction Routes
 * API routes for transaction management.
 * All routes are prefixed with /api/transactions
 * 
 * @module routes/transactions
 */

const express = require('express');
const router = express.Router();

const {
  create,
  list,
  getById,
  update,
  remove,
  getSummary,
  getVatSummary,
  search,
  getStats,
  updateStatus,
  getHistory
} = require('../controllers/transactionController');

const { authenticate } = require('../middleware/auth');
const { 
  validateTransactionCreate, 
  validateTransactionUpdate, 
  sanitizeTransaction 
} = require('../middleware/validation');

/**
 * @route   GET /api/transactions/summary
 * @desc    Get transaction summary for date range
 * @header  Authorization: Bearer <token>
 * @query   startDate - Start date (YYYY-MM-DD)
 * @query   endDate - End date (YYYY-MM-DD)
 * @access  Private
 * @returns { success: true, data: { income, expense, netAmount, vatCollected, vatPaid } }
 */
router.get('/summary', authenticate, getSummary);

/**
 * @route   GET /api/transactions/vat-summary
 * @desc    Get VAT summary for date range
 * @header  Authorization: Bearer <token>
 * @query   startDate - Start date (YYYY-MM-DD)
 * @query   endDate - End date (YYYY-MM-DD)
 * @access  Private
 * @returns { success: true, data: { outputVat, inputVat, netVat, totalSales, totalPurchases } }
 */
router.get('/vat-summary', authenticate, getVatSummary);

/**
 * @route   GET /api/transactions/search
 * @desc    Search transactions by description, payee, reference, or notes
 * @header  Authorization: Bearer <token>
 * @query   q - Search query
 * @access  Private
 * @returns { success: true, data: TransactionData[] }
 */
router.get('/search', authenticate, search);

/**
 * @route   GET /api/transactions/stats
 * @desc    Get transaction counts by type and status
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { byType, byStatus } }
 */
router.get('/stats', authenticate, getStats);

/**
 * @route   GET /api/transactions
 * @desc    List all transactions for authenticated user with pagination and filtering
 * @header  Authorization: Bearer <token>
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   type - Filter by type (income, expense, transfer)
 * @query   status - Filter by status (pending, cleared, reconciled, void)
 * @query   categoryId - Filter by category
 * @query   startDate - Start date for date range filter
 * @query   endDate - End date for date range filter
 * @query   sortBy - Sort field (transactionDate, amount, totalAmount, type, status, createdAt)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @access  Private
 * @returns { success: true, data: { transactions, total, page, limit } }
 */
router.get('/', authenticate, list);

/**
 * @route   GET /api/transactions/:id/history
 * @desc    Get audit history for a transaction
 * @header  Authorization: Bearer <token>
 * @param   id - Transaction ID
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50)
 * @query   action - Filter by action type (create, update, delete)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @access  Private
 * @returns { success: true, data: { entries, total, page, limit } }
 */
router.get('/:id/history', authenticate, getHistory);

/**
 * @route   GET /api/transactions/:id
 * @desc    Get a transaction by ID
 * @header  Authorization: Bearer <token>
 * @param   id - Transaction ID
 * @access  Private
 * @returns { success: true, data: TransactionData }
 */
router.get('/:id', authenticate, getById);

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction
 * @header  Authorization: Bearer <token>
 * @body    { categoryId?, type, status?, transactionDate, description, reference?, 
 *            amount, vatRate?, vatAmount?, totalAmount?, currency?, paymentMethod?, 
 *            payee?, receiptPath?, notes?, isRecurring?, recurringFrequency?, linkedTransactionId? }
 * @access  Private
 * @returns { success: true, data: TransactionData }
 */
router.post('/', authenticate, sanitizeTransaction, validateTransactionCreate, create);

/**
 * @route   PUT /api/transactions/:id
 * @desc    Update a transaction
 * @header  Authorization: Bearer <token>
 * @param   id - Transaction ID
 * @body    { categoryId?, type?, status?, transactionDate?, description?, reference?,
 *            amount?, vatRate?, vatAmount?, totalAmount?, currency?, paymentMethod?,
 *            payee?, receiptPath?, notes?, isRecurring?, recurringFrequency?, linkedTransactionId? }
 * @access  Private
 * @returns { success: true, data: TransactionData }
 */
router.put('/:id', authenticate, sanitizeTransaction, validateTransactionUpdate, update);

/**
 * @route   PATCH /api/transactions/:id/status
 * @desc    Update transaction status
 * @header  Authorization: Bearer <token>
 * @param   id - Transaction ID
 * @body    { status: 'pending' | 'cleared' | 'reconciled' | 'void' }
 * @access  Private
 * @returns { success: true, data: TransactionData }
 */
router.patch('/:id/status', authenticate, updateStatus);

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete a transaction
 * @header  Authorization: Bearer <token>
 * @param   id - Transaction ID
 * @access  Private
 * @returns { success: true, message: { en, tr } }
 */
router.delete('/:id', authenticate, remove);

module.exports = router;
