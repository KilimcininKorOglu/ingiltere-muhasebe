/**
 * Customer Routes
 * API routes for customer CRUD operations.
 * All routes are prefixed with /api/customers
 * 
 * @module routes/customers
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
  getB2B,
  search
} = require('../controllers/customerController');

const { authenticate } = require('../middleware/auth');
const {
  validateCustomerCreate,
  validateCustomerUpdate,
  sanitizeCustomer
} = require('../middleware/validation');

/**
 * @route   GET /api/customers/stats
 * @desc    Get customer counts by status
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { active: number, inactive: number, archived: number } }
 */
router.get('/stats', authenticate, getStats);

/**
 * @route   GET /api/customers/active
 * @desc    Get all active customers
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: CustomerData[] }
 */
router.get('/active', authenticate, getActive);

/**
 * @route   GET /api/customers/b2b
 * @desc    Get all B2B customers (with VAT numbers)
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: CustomerData[] }
 */
router.get('/b2b', authenticate, getB2B);

/**
 * @route   GET /api/customers/search
 * @desc    Search customers by name, trading name, email, or customer number
 * @header  Authorization: Bearer <token>
 * @query   q - Search query string
 * @access  Private
 * @returns { success: true, data: CustomerData[] }
 */
router.get('/search', authenticate, search);

/**
 * @route   GET /api/customers
 * @desc    List customers with pagination and filtering
 * @header  Authorization: Bearer <token>
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @query   status - Filter by status (active, inactive, archived)
 * @query   sortBy - Sort field (name, customerNumber, email, city, status, createdAt)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @query   search - Search term
 * @access  Private
 * @returns { success: true, data: { customers: CustomerData[], total: number, page: number, limit: number } }
 */
router.get('/', authenticate, list);

/**
 * @route   GET /api/customers/:id
 * @desc    Get a customer by ID
 * @header  Authorization: Bearer <token>
 * @param   id - Customer ID
 * @access  Private
 * @returns { success: true, data: CustomerData }
 */
router.get('/:id', authenticate, getById);

/**
 * @route   POST /api/customers
 * @desc    Create a new customer
 * @header  Authorization: Bearer <token>
 * @body    {
 *            name: string (required),
 *            customerNumber?: string,
 *            tradingName?: string,
 *            email?: string,
 *            phone?: string,
 *            website?: string,
 *            vatNumber?: string,
 *            companyNumber?: string,
 *            addressLine1?: string,
 *            addressLine2?: string,
 *            city?: string,
 *            county?: string,
 *            postcode?: string,
 *            country?: string,
 *            deliveryAddressLine1?: string,
 *            deliveryAddressLine2?: string,
 *            deliveryCity?: string,
 *            deliveryCounty?: string,
 *            deliveryPostcode?: string,
 *            deliveryCountry?: string,
 *            contactName?: string,
 *            contactEmail?: string,
 *            contactPhone?: string,
 *            paymentTerms?: number,
 *            creditLimit?: number,
 *            currency?: string,
 *            notes?: string
 *          }
 * @access  Private
 * @returns { success: true, data: CustomerData }
 */
router.post('/', authenticate, sanitizeCustomer, validateCustomerCreate, create);

/**
 * @route   PUT /api/customers/:id
 * @desc    Update a customer
 * @header  Authorization: Bearer <token>
 * @param   id - Customer ID
 * @body    Partial customer data to update
 * @access  Private
 * @returns { success: true, data: CustomerData }
 */
router.put('/:id', authenticate, sanitizeCustomer, validateCustomerUpdate, update);

/**
 * @route   PATCH /api/customers/:id/status
 * @desc    Update customer status
 * @header  Authorization: Bearer <token>
 * @param   id - Customer ID
 * @body    { status: 'active' | 'inactive' | 'archived' }
 * @access  Private
 * @returns { success: true, data: CustomerData }
 */
router.patch('/:id/status', authenticate, changeStatus);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete a customer (soft delete by default)
 * @header  Authorization: Bearer <token>
 * @param   id - Customer ID
 * @query   hard - Set to 'true' for hard delete (permanent)
 * @access  Private
 * @returns { success: true, message: string }
 */
router.delete('/:id', authenticate, remove);

module.exports = router;
