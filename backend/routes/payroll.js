/**
 * Payroll Routes
 * API routes for payroll calculation and management operations.
 * All routes are prefixed with /api/payroll
 * 
 * @module routes/payroll
 */

const express = require('express');
const router = express.Router();

const {
  calculatePayroll,
  createPayrollEntry,
  getPayrollEntries,
  getPayrollEntry,
  getEmployeePayrollEntries,
  updatePayrollEntry,
  updatePayrollStatus,
  deletePayrollEntry,
  getPayrollSummary,
  getPayrollStatusCounts
} = require('../controllers/payrollController');

const { requireAuth } = require('../middleware/auth');

// All payroll routes require authentication
router.use(requireAuth);

/**
 * @route   POST /api/payroll/calculate
 * @desc    Calculate payroll for an employee without saving
 * @body    {
 *            employeeId: number,
 *            grossPay?: number (in pence),
 *            payFrequency?: string,
 *            periodNumber?: number,
 *            bonus?: number (in pence),
 *            commission?: number (in pence),
 *            otherDeductions?: number (in pence),
 *            cumulativeTaxableIncome?: number,
 *            cumulativeTaxPaid?: number,
 *            taxYear?: string
 *          }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { employee, calculation, breakdown } }
 */
router.post('/calculate', calculatePayroll);

/**
 * @route   GET /api/payroll/summary
 * @desc    Get payroll summary for a date range
 * @query   startDate - Start date (YYYY-MM-DD)
 * @query   endDate - End date (YYYY-MM-DD)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { period, summary } }
 */
router.get('/summary', getPayrollSummary);

/**
 * @route   GET /api/payroll/counts
 * @desc    Get payroll entry counts by status
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { draft: number, approved: number, paid: number, ... } }
 */
router.get('/counts', getPayrollStatusCounts);

/**
 * @route   GET /api/payroll/employee/:employeeId
 * @desc    Get payroll entries for a specific employee
 * @param   employeeId - Employee ID
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10, max: 100)
 * @query   status - Filter by status
 * @query   sortBy - Sort field (default: 'payDate')
 * @query   sortOrder - Sort order (default: 'DESC')
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { employee, entries } }
 */
router.get('/employee/:employeeId', getEmployeePayrollEntries);

/**
 * @route   GET /api/payroll
 * @desc    Get all payroll entries for the authenticated user
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10, max: 100)
 * @query   status - Filter by status
 * @query   startDate - Filter from date (YYYY-MM-DD)
 * @query   endDate - Filter to date (YYYY-MM-DD)
 * @query   sortBy - Sort field (default: 'payDate')
 * @query   sortOrder - Sort order (default: 'DESC')
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: PayrollEntry[], meta: { page, limit, total, ... } }
 */
router.get('/', getPayrollEntries);

/**
 * @route   GET /api/payroll/:id
 * @desc    Get a single payroll entry by ID
 * @param   id - Payroll entry ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: PayrollEntry }
 */
router.get('/:id', getPayrollEntry);

/**
 * @route   POST /api/payroll
 * @desc    Create a new payroll entry (calculates and saves)
 * @body    {
 *            employeeId: number,
 *            payPeriodStart: string (YYYY-MM-DD),
 *            payPeriodEnd: string (YYYY-MM-DD),
 *            payDate: string (YYYY-MM-DD),
 *            grossPay?: number (in pence),
 *            hoursWorked?: number,
 *            overtimeHours?: number,
 *            overtimeRate?: number,
 *            bonus?: number (in pence),
 *            commission?: number (in pence),
 *            otherDeductions?: number (in pence),
 *            otherDeductionsNotes?: string,
 *            notes?: string,
 *            status?: string,
 *            taxYear?: string
 *          }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: PayrollEntry }
 */
router.post('/', createPayrollEntry);

/**
 * @route   PUT /api/payroll/:id
 * @desc    Update an existing payroll entry
 * @param   id - Payroll entry ID
 * @body    Partial<PayrollEntryData>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: PayrollEntry }
 */
router.put('/:id', updatePayrollEntry);

/**
 * @route   PATCH /api/payroll/:id/status
 * @desc    Update payroll entry status
 * @param   id - Payroll entry ID
 * @body    { status: string }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: PayrollEntry }
 */
router.patch('/:id/status', updatePayrollStatus);

/**
 * @route   DELETE /api/payroll/:id
 * @desc    Delete a draft payroll entry
 * @param   id - Payroll entry ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, message: {...} }
 */
router.delete('/:id', deletePayrollEntry);

module.exports = router;
