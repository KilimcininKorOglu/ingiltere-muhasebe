/**
 * Employee Routes
 * API routes for employee management operations.
 * All routes are prefixed with /api/employees
 * 
 * @module routes/employees
 */

const express = require('express');
const router = express.Router();

const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  permanentDeleteEmployee,
  searchEmployees,
  getStatusCounts,
  validateNINumber,
  validateTaxCode
} = require('../controllers/employeeController');

const { requireAuth } = require('../middleware/auth');

// All employee routes require authentication
router.use(requireAuth);

/**
 * @route   GET /api/employees/search
 * @desc    Search employees by name or employee number
 * @query   q - Search query
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: EmployeeData[], meta: { query, count, ... } }
 */
router.get('/search', searchEmployees);

/**
 * @route   GET /api/employees/counts
 * @desc    Get employee counts by status
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { active: number, inactive: number, ... } }
 */
router.get('/counts', getStatusCounts);

/**
 * @route   POST /api/employees/validate/ni-number
 * @desc    Validate a UK National Insurance number
 * @body    { niNumber: string }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { isValid: boolean, niNumber: string, error?: string } }
 */
router.post('/validate/ni-number', validateNINumber);

/**
 * @route   POST /api/employees/validate/tax-code
 * @desc    Validate a UK HMRC tax code
 * @body    { taxCode: string }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { isValid: boolean, taxCode: string, error?: string } }
 */
router.post('/validate/tax-code', validateTaxCode);

/**
 * @route   GET /api/employees
 * @desc    Get all employees for the authenticated user
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10, max: 100)
 * @query   status - Filter by status (default: 'active')
 * @query   sortBy - Sort field (default: 'lastName')
 * @query   sortOrder - Sort order (default: 'ASC')
 * @query   includeAll - Include all statuses if 'true'
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: EmployeeData[], meta: { page, limit, total, totalPages, ... } }
 */
router.get('/', getEmployees);

/**
 * @route   GET /api/employees/:id
 * @desc    Get a single employee by ID
 * @param   id - Employee ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: EmployeeData }
 */
router.get('/:id', getEmployee);

/**
 * @route   POST /api/employees
 * @desc    Create a new employee
 * @body    { 
 *            employeeNumber?: string,
 *            firstName: string,
 *            lastName: string,
 *            email?: string,
 *            niNumber?: string,
 *            taxCode: string,
 *            dateOfBirth?: string,
 *            startDate: string,
 *            endDate?: string,
 *            status?: string,
 *            payFrequency?: string,
 *            annualSalary?: number,
 *            hourlyRate?: number,
 *            address?: string,
 *            phoneNumber?: string,
 *            bankAccountNumber?: string,
 *            bankSortCode?: string,
 *            studentLoanPlan?: string,
 *            pensionOptIn?: boolean,
 *            pensionContribution?: number,
 *            notes?: string
 *          }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: EmployeeData }
 */
router.post('/', createEmployee);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update an existing employee
 * @param   id - Employee ID
 * @body    Partial<EmployeeData>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: EmployeeData }
 */
router.put('/:id', updateEmployee);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Soft delete an employee (sets end date to today and status to terminated)
 * @param   id - Employee ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, message: {...}, data: EmployeeData }
 */
router.delete('/:id', deleteEmployee);

/**
 * @route   DELETE /api/employees/:id/permanent
 * @desc    Permanently delete an employee from the database
 * @param   id - Employee ID
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, message: {...} }
 */
router.delete('/:id/permanent', permanentDeleteEmployee);

module.exports = router;
