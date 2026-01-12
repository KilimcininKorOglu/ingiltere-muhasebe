/**
 * Invoice Routes
 * API routes for invoice CRUD operations.
 * All routes are prefixed with /api/invoices
 * 
 * @module routes/invoices
 */

const express = require('express');
const router = express.Router();

const {
  create,
  getById,
  list,
  remove,
  changeStatus,
  getStats,
  getOverdue
} = require('../controllers/invoiceController');

const { authenticate } = require('../middleware/auth');
const {
  validateInvoiceCreate,
  sanitizeInvoice
} = require('../middleware/validation');

/**
 * @route   GET /api/invoices/stats
 * @desc    Get invoice statistics (counts by status, overdue totals)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { statusCounts: Object, overdueCount: number, overdueTotal: number } }
 */
router.get('/stats', authenticate, getStats);

/**
 * @route   GET /api/invoices/overdue
 * @desc    Get all overdue invoices
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: InvoiceData[] }
 */
router.get('/overdue', authenticate, getOverdue);

/**
 * @route   GET /api/invoices
 * @desc    List invoices with pagination and filtering
 * @header  Authorization: Bearer <token>
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @query   status - Filter by status (draft, pending, paid, overdue, cancelled, refunded)
 * @query   sortBy - Sort field (issueDate, dueDate, invoiceNumber, totalAmount, status, createdAt)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @access  Private
 * @returns { success: true, data: { invoices: InvoiceData[], total: number, page: number, limit: number } }
 */
router.get('/', authenticate, list);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get an invoice by ID with its line items
 * @header  Authorization: Bearer <token>
 * @param   id - Invoice ID
 * @access  Private
 * @returns { success: true, data: InvoiceData with items }
 */
router.get('/:id', authenticate, getById);

/**
 * @route   POST /api/invoices
 * @desc    Create a new invoice with line items
 * @header  Authorization: Bearer <token>
 * @body    {
 *            customerId: number (required) - ID of the customer,
 *            invoiceDate: string (required) - Invoice date in YYYY-MM-DD format,
 *            dueDate: string (required) - Due date in YYYY-MM-DD format,
 *            taxPoint?: string - Tax point date for UK VAT (YYYY-MM-DD),
 *            notes?: string - Additional notes or payment terms,
 *            currency?: string - Currency code (GBP, EUR, USD, default: GBP),
 *            items: [
 *              {
 *                description: string (required) - Item description,
 *                quantity?: number - Quantity (default: 1),
 *                unitPrice: number (required) - Unit price in pence,
 *                vatRate?: string|number - VAT rate (standard, reduced, zero, exempt, or percentage)
 *              }
 *            ]
 *          }
 * @access  Private
 * @returns { success: true, data: InvoiceData with items }
 * 
 * @example
 * POST /api/invoices
 * {
 *   "customerId": 1,
 *   "invoiceDate": "2026-01-12",
 *   "dueDate": "2026-02-12",
 *   "taxPoint": "2026-01-12",
 *   "notes": "Payment terms: Net 30 days",
 *   "items": [
 *     { "description": "Consulting Service", "quantity": 2, "unitPrice": 10000, "vatRate": 20 },
 *     { "description": "Software License", "quantity": 1, "unitPrice": 50000, "vatRate": "standard" }
 *   ]
 * }
 */
router.post('/', authenticate, sanitizeInvoice, validateInvoiceCreate, create);

/**
 * @route   PATCH /api/invoices/:id/status
 * @desc    Update invoice status
 * @header  Authorization: Bearer <token>
 * @param   id - Invoice ID
 * @body    { status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' }
 * @access  Private
 * @returns { success: true, data: InvoiceData }
 * 
 * @notes   Status transitions are validated:
 *          - draft → pending, cancelled
 *          - pending → paid, overdue, cancelled
 *          - paid → refunded
 *          - overdue → paid, cancelled
 *          - cancelled → (no transitions)
 *          - refunded → (no transitions)
 */
router.patch('/:id/status', authenticate, changeStatus);

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete an invoice (only draft invoices can be deleted)
 * @header  Authorization: Bearer <token>
 * @param   id - Invoice ID
 * @access  Private
 * @returns { success: true, message: string }
 * 
 * @notes   Only invoices with status 'draft' can be deleted.
 *          For other statuses, change the status to 'cancelled' instead.
 */
router.delete('/:id', authenticate, remove);

module.exports = router;
