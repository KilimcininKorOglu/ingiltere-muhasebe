/**
 * Supplier Routes
 * API routes for supplier CRUD operations.
 * All routes are prefixed with /api/suppliers
 * 
 * @module routes/suppliers
 */

const express = require('express');
const router = express.Router();

const {
  create,
  getById,
  list,
  update,
  remove,
  changeStatus,
  getStats,
  getActive,
  getVatRegistered,
  search,
  getTransactionHistory,
  getSummary
} = require('../controllers/supplierController');

const { authenticateToken } = require('../middleware/validation');

/**
 * @route   GET /api/suppliers/stats
 * @desc    Get supplier counts by status
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { active: number, inactive: number, archived: number } }
 */
router.get('/stats', authenticateToken, getStats);

/**
 * @route   GET /api/suppliers/active
 * @desc    Get all active suppliers
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: SupplierData[] }
 */
router.get('/active', authenticateToken, getActive);

/**
 * @route   GET /api/suppliers/vat-registered
 * @desc    Get all VAT registered suppliers
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: SupplierData[] }
 */
router.get('/vat-registered', authenticateToken, getVatRegistered);

/**
 * @route   GET /api/suppliers/search
 * @desc    Search suppliers by name, contact name, or city
 * @header  Authorization: Bearer <token>
 * @query   q - Search query string
 * @access  Private
 * @returns { success: true, data: SupplierData[] }
 */
router.get('/search', authenticateToken, search);

/**
 * @route   GET /api/suppliers
 * @desc    List suppliers with pagination and filtering
 * @header  Authorization: Bearer <token>
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @query   status - Filter by status (active, inactive, archived)
 * @query   sortBy - Sort field (name, contactName, city, status, createdAt, paymentTerms)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @query   search - Search term
 * @access  Private
 * @returns { success: true, data: { suppliers: SupplierData[], total: number, page: number, limit: number } }
 */
router.get('/', authenticateToken, list);

/**
 * @route   GET /api/suppliers/:id/transactions
 * @desc    Get transaction history for a specific supplier
 * @header  Authorization: Bearer <token>
 * @param   id - Supplier ID
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   categoryId - Filter by category ID
 * @query   startDate - Start date filter (YYYY-MM-DD)
 * @query   endDate - End date filter (YYYY-MM-DD)
 * @query   sortBy - Sort field (transactionDate, amount, totalAmount, type, status, createdAt)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @access  Private
 * @returns { success: true, data: { transactions: TransactionData[], total: number, page: number, limit: number } }
 */
router.get('/:id/transactions', authenticateToken, getTransactionHistory);

/**
 * @route   GET /api/suppliers/:id/summary
 * @desc    Get summary information for a specific supplier including expense totals, VAT reclaimed, and category breakdown
 * @header  Authorization: Bearer <token>
 * @param   id - Supplier ID
 * @access  Private
 * @returns { success: true, data: SupplierSummaryData }
 */
router.get('/:id/summary', authenticateToken, getSummary);

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get a supplier by ID
 * @header  Authorization: Bearer <token>
 * @param   id - Supplier ID
 * @access  Private
 * @returns { success: true, data: SupplierData }
 */
router.get('/:id', authenticateToken, getById);

/**
 * @route   POST /api/suppliers
 * @desc    Create a new supplier
 * @header  Authorization: Bearer <token>
 * @body    {
 *            name: string (required),
 *            contactName?: string,
 *            email?: string,
 *            phoneNumber?: string,
 *            address?: string,
 *            city?: string,
 *            postcode?: string,
 *            country?: string,
 *            vatNumber?: string,
 *            isVatRegistered?: boolean,
 *            companyNumber?: string,
 *            paymentTerms?: string,
 *            paymentTermsDays?: number,
 *            currency?: string,
 *            bankAccountName?: string,
 *            bankAccountNumber?: string,
 *            bankSortCode?: string,
 *            iban?: string,
 *            swift?: string,
 *            defaultExpenseCategory?: string,
 *            status?: string,
 *            notes?: string
 *          }
 * @access  Private
 * @returns { success: true, data: SupplierData }
 */
router.post('/', authenticateToken, create);

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update a supplier
 * @header  Authorization: Bearer <token>
 * @param   id - Supplier ID
 * @body    Partial supplier data to update
 * @access  Private
 * @returns { success: true, data: SupplierData }
 */
router.put('/:id', authenticateToken, update);

/**
 * @route   PATCH /api/suppliers/:id/status
 * @desc    Update supplier status
 * @header  Authorization: Bearer <token>
 * @param   id - Supplier ID
 * @body    { status: 'active' | 'inactive' | 'archived' }
 * @access  Private
 * @returns { success: true, data: SupplierData }
 */
router.patch('/:id/status', authenticateToken, changeStatus);

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete a supplier (soft delete by default)
 * @header  Authorization: Bearer <token>
 * @param   id - Supplier ID
 * @query   hard - Set to 'true' for hard delete (permanent)
 * @access  Private
 * @returns { success: true, message: string }
 */
router.delete('/:id', authenticateToken, remove);

module.exports = router;
