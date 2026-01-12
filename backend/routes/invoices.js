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
  update,
  remove,
  changeStatus,
  getStats,
  getOverdue
} = require('../controllers/invoiceController');

const { authenticate } = require('../middleware/auth');
const {
  validateInvoiceCreate,
  validateInvoiceUpdate,
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
 * @query   customerId - Filter by customer ID
 * @query   dateFrom - Filter by issue date from (YYYY-MM-DD)
 * @query   dateTo - Filter by issue date to (YYYY-MM-DD)
 * @query   search - Search in invoice number and customer name
 * @query   sortBy - Sort field (issueDate, dueDate, invoiceNumber, totalAmount, status, createdAt, customerName)
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
 * @route   PUT /api/invoices/:id
 * @desc    Update an invoice with optional line item changes
 * @header  Authorization: Bearer <token>
 * @param   id - Invoice ID
 * @body    {
 *            invoiceDate?: string - Invoice date in YYYY-MM-DD format,
 *            dueDate?: string - Due date in YYYY-MM-DD format,
 *            taxPoint?: string - Tax point date for UK VAT (YYYY-MM-DD),
 *            notes?: string - Additional notes or payment terms,
 *            currency?: string - Currency code (GBP, EUR, USD),
 *            items?: [
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
 * @notes   Restrictions:
 *          - Only draft and pending invoices can be modified
 *          - Paid, cancelled, and refunded invoices cannot be modified
 *          - If items array is provided, all existing items are replaced
 *          - Totals are automatically recalculated when items change
 * 
 * @example
 * PUT /api/invoices/1
 * {
 *   "dueDate": "2026-03-12",
 *   "notes": "Updated payment terms: Net 60 days",
 *   "items": [
 *     { "description": "Consulting Service - Updated", "quantity": 3, "unitPrice": 10000, "vatRate": 20 },
 *     { "description": "New Service", "quantity": 1, "unitPrice": 25000, "vatRate": "standard" }
 *   ]
 * }
 */
router.put('/:id', authenticate, sanitizeInvoice, validateInvoiceUpdate, update);

/**
 * @route   PATCH /api/invoices/:id/status
 * @desc    Update invoice status with optional payment recording
 * @header  Authorization: Bearer <token>
 * @param   id - Invoice ID
 * @body    {
 *            status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' (required),
 *            paymentDetails?: {
 *              paymentDate?: string - Payment date (ISO 8601, defaults to now),
 *              paymentMethod?: 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other',
 *              paymentReference?: string - External payment reference (max 100 chars),
 *              paymentAmount?: number - Amount paid in pence (defaults to invoice total),
 *              notes?: string - Additional payment notes (max 1000 chars)
 *            },
 *            createIncomeTransaction?: boolean - Create income transaction when marking as paid,
 *            incomeCategoryId?: number - Category ID for income transaction (e.g., 4100 for Sales)
 *          }
 * @access  Private
 * @returns { success: true, data: InvoiceData with statusChange, payment?, incomeTransaction? }
 * 
 * @notes   Status transitions are validated:
 *          - draft → pending (mark as sent), cancelled
 *          - pending → paid, overdue, cancelled
 *          - paid → refunded
 *          - overdue → paid, cancelled
 *          - cancelled → (no transitions)
 *          - refunded → (no transitions)
 * 
 *          When marking as paid:
 *          - paidAt timestamp is automatically set
 *          - Payment details can be recorded for tracking
 *          - An income transaction can be created if createIncomeTransaction is true
 * 
 * @example
 * PATCH /api/invoices/1/status
 * {
 *   "status": "paid",
 *   "paymentDetails": {
 *     "paymentMethod": "bank_transfer",
 *     "paymentReference": "BACS-20260112-001",
 *     "notes": "Payment received via BACS"
 *   },
 *   "createIncomeTransaction": true,
 *   "incomeCategoryId": 4100
 * }
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
