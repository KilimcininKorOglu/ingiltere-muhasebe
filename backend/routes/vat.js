/**
 * VAT Routes
 * API routes for VAT-related operations including threshold monitoring
 * and VAT return CRUD operations.
 * All routes are prefixed with /api/vat
 * 
 * @module routes/vat
 */

const express = require('express');
const router = express.Router();

const {
  getThresholdStatus,
  getThresholdConfig,
  getDashboardStatus,
  getTurnoverBreakdown,
  // VAT Return CRUD operations
  createVatReturn,
  listVatReturns,
  getVatReturnById,
  updateVatReturnById,
  deleteVatReturnById,
  updateVatReturnStatus,
  previewVatReturn
} = require('../controllers/vatController');
const { requireAuth } = require('../middleware/auth');

/**
 * @route   GET /api/vat/threshold-status
 * @desc    Get complete VAT threshold status for the authenticated user
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @query   asOfDate - Optional date for historical calculation (YYYY-MM-DD)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     isVatRegistered: boolean,
 *     requiresMonitoring: boolean,
 *     turnover: {
 *       rolling12Month: number,
 *       startDate: string,
 *       endDate: string,
 *       transactionCount: number,
 *       monthlyBreakdown: Array
 *     },
 *     projection: {
 *       next30Days: number,
 *       averageDaily: number
 *     },
 *     threshold: {
 *       registrationAmount: number,
 *       deregistrationAmount: number
 *     },
 *     warning: {
 *       level: string,
 *       percentage: number,
 *       remainingUntilThreshold: number,
 *       message: { en: string|null, tr: string|null }
 *     },
 *     summary: {
 *       showWarning: boolean,
 *       warningLevel: string,
 *       headline: string,
 *       details: string,
 *       turnoverFormatted: string,
 *       thresholdFormatted: string,
 *       percentageFormatted: string,
 *       remainingFormatted: string
 *     },
 *     calculatedAt: string
 *   }
 * }
 */
router.get('/threshold-status', requireAuth, getThresholdStatus);

/**
 * @route   GET /api/vat/threshold-config
 * @desc    Get current VAT threshold configuration and warning levels
 * @query   lang - Language preference (en/tr)
 * @access  Public (no authentication required - reference data)
 * @returns {
 *   success: true,
 *   data: {
 *     registrationThreshold: { amount: number, amountPence: number, currency: string },
 *     deregistrationThreshold: { amount: number, amountPence: number, currency: string },
 *     warningLevels: {
 *       approaching: { percentage: number, description: string },
 *       imminent: { percentage: number, description: string },
 *       exceeded: { percentage: number, description: string }
 *     },
 *     notes: { en: string, tr: string }
 *   }
 * }
 */
router.get('/threshold-config', getThresholdConfig);

/**
 * @route   GET /api/vat/dashboard-summary
 * @desc    Get simplified VAT threshold summary for dashboard widgets
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     isVatRegistered: boolean,
 *     requiresMonitoring: boolean,
 *     showWarning: boolean,
 *     warningLevel: string,
 *     headline: string,
 *     details: string,
 *     turnover: { amount: number, formatted: string },
 *     threshold: { amount: number, formatted: string },
 *     progress: { percentage: number, formatted: string },
 *     remaining: { amount: number, formatted: string }
 *   }
 * }
 */
router.get('/dashboard-summary', requireAuth, getDashboardStatus);

/**
 * @route   GET /api/vat/turnover-breakdown
 * @desc    Get monthly turnover breakdown for threshold analysis
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { startDate: string, endDate: string },
 *     total: { amount: number, formattedAmount: string, transactionCount: number },
 *     monthlyBreakdown: Array<{
 *       month: string,
 *       year: number,
 *       monthNumber: number,
 *       monthName: string,
 *       amount: number,
 *       formattedAmount: string,
 *       cumulativeAmount: number,
 *       formattedCumulativeAmount: string
 *     }>,
 *     threshold: { amount: number, percentage: number },
 *     projection: { next30Days: number, averageDaily: number }
 *   }
 * }
 */
router.get('/turnover-breakdown', requireAuth, getTurnoverBreakdown);

// ==========================================
// VAT RETURN CRUD ROUTES
// ==========================================

/**
 * @route   GET /api/vat/returns/preview
 * @desc    Preview VAT return calculation without saving
 * @header  Authorization: Bearer <token>
 * @query   periodStart - Period start date (YYYY-MM-DD)
 * @query   periodEnd - Period end date (YYYY-MM-DD)
 * @query   accountingScheme - 'standard' or 'cash' (default: standard)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { start: string, end: string },
 *     accountingScheme: string,
 *     boxes: { box1-box9 values },
 *     summary: { vatDue, vatReclaimed, netVat, isRefundDue },
 *     formattedSummary: object,
 *     submissionFormat: object
 *   }
 * }
 */
router.get('/returns/preview', requireAuth, previewVatReturn);

/**
 * @route   GET /api/vat/returns
 * @desc    List all VAT returns for authenticated user with pagination
 * @header  Authorization: Bearer <token>
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @query   status - Filter by status (draft, pending, submitted, accepted, rejected, amended)
 * @query   sortBy - Sort field (periodEnd, periodStart, status, createdAt)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     vatReturns: Array<VatReturnData>,
 *     pagination: { total, page, limit, totalPages },
 *     statusCounts: { draft, pending, submitted, accepted, rejected, amended }
 *   }
 * }
 */
router.get('/returns', requireAuth, listVatReturns);

/**
 * @route   GET /api/vat/returns/:id
 * @desc    Get a VAT return by ID with full details
 * @header  Authorization: Bearer <token>
 * @param   id - VAT return ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: VatReturnData with formatted values
 * }
 */
router.get('/returns/:id', requireAuth, getVatReturnById);

/**
 * @route   POST /api/vat/returns
 * @desc    Create a new VAT return with calculated values
 * @header  Authorization: Bearer <token>
 * @body    {
 *   periodStart: string (YYYY-MM-DD),
 *   periodEnd: string (YYYY-MM-DD),
 *   accountingScheme?: 'standard' | 'cash',
 *   autoCalculate?: boolean (default: true),
 *   notes?: string,
 *   box1-box9?: number (only when autoCalculate is false)
 * }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: VatReturnData }
 */
router.post('/returns', requireAuth, createVatReturn);

/**
 * @route   PUT /api/vat/returns/:id
 * @desc    Update a VAT return (only draft/pending/rejected/amended returns)
 * @header  Authorization: Bearer <token>
 * @param   id - VAT return ID
 * @body    {
 *   periodStart?: string,
 *   periodEnd?: string,
 *   box1-box9?: number,
 *   notes?: string,
 *   hmrcReceiptId?: string
 * }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: VatReturnData }
 */
router.put('/returns/:id', requireAuth, updateVatReturnById);

/**
 * @route   PATCH /api/vat/returns/:id/status
 * @desc    Update VAT return status with transition validation
 * @header  Authorization: Bearer <token>
 * @param   id - VAT return ID
 * @body    { status: 'draft' | 'pending' | 'submitted' | 'accepted' | 'rejected' | 'amended' }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: VatReturnData }
 */
router.patch('/returns/:id/status', requireAuth, updateVatReturnStatus);

/**
 * @route   DELETE /api/vat/returns/:id
 * @desc    Delete a VAT return (only draft returns can be deleted)
 * @header  Authorization: Bearer <token>
 * @param   id - VAT return ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, message: { en, tr } }
 */
router.delete('/returns/:id', requireAuth, deleteVatReturnById);

module.exports = router;
