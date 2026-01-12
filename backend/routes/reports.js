/**
 * Reports Routes
 * API routes for report generation operations.
 * All routes are prefixed with /api/reports
 * 
 * @module routes/reports
 */

const express = require('express');
const router = express.Router();

const {
  getPayeSummary,
  getPayeSummaryByTaxYear,
  getPayeSummaryByMonth,
  getPaymentDeadline,
  getProfitLoss,
  getProfitLossByTaxYear,
  getProfitLossByMonth,
  getProfitLossByQuarter,
  getVatSummary,
  getVatSummaryByTaxYear,
  getVatSummaryByMonth,
  getVatSummaryByQuarter
} = require('../controllers/reportController');

const { requireAuth } = require('../middleware/auth');

// All report routes require authentication
router.use(requireAuth);

/**
 * @route   GET /api/reports/paye-summary
 * @desc    Get PAYE summary report for a date range
 * @query   startDate - Start date (YYYY-MM-DD) (required)
 * @query   endDate - End date (YYYY-MM-DD) (required)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { startDate, endDate, taxYear },
 *     totals: {
 *       grossPay, taxableIncome, incomeTax, employeeNI, employerNI,
 *       totalNI, studentLoanDeductions, pensionEmployeeContributions,
 *       pensionEmployerContributions, netPay, totalPayrollCost
 *     },
 *     hmrcLiability: {
 *       paye, employeeNI, employerNI, studentLoans, totalLiability, paymentDeadline
 *     },
 *     employeeBreakdown: [{
 *       employeeId, employeeNumber, firstName, lastName,
 *       grossPay, incomeTax, employeeNI, employerNI, netPay, entriesCount
 *     }],
 *     monthlySummary: [{
 *       month, year, monthName, grossPay, incomeTax, employeeNI,
 *       employerNI, totalLiability, paymentDeadline, entriesCount
 *     }],
 *     entriesCount
 *   }
 * }
 */
router.get('/paye-summary', getPayeSummary);

/**
 * @route   GET /api/reports/paye-summary/tax-year/:taxYear
 * @desc    Get PAYE summary report for a specific UK tax year
 * @param   taxYear - Tax year in YYYY-YY format (e.g., 2025-26)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns PAYE summary for the specified tax year
 */
router.get('/paye-summary/tax-year/:taxYear', getPayeSummaryByTaxYear);

/**
 * @route   GET /api/reports/paye-summary/monthly/:year/:month
 * @desc    Get PAYE summary report for a specific month
 * @param   year - The year (e.g., 2025)
 * @param   month - The month (1-12)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns PAYE summary for the specified month
 */
router.get('/paye-summary/monthly/:year/:month', getPayeSummaryByMonth);

/**
 * @route   GET /api/reports/paye-summary/deadline/:year/:month
 * @desc    Get HMRC payment deadlines for a specific month
 * @param   year - The year (e.g., 2025)
 * @param   month - The month (1-12)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { year, month, monthName },
 *     deadlines: {
 *       electronic: { date, description },
 *       postal: { date, description }
 *     }
 *   }
 * }
 */
router.get('/paye-summary/deadline/:year/:month', getPaymentDeadline);

// =====================================
// Profit & Loss (Income Statement) Routes
// =====================================

/**
 * @route   GET /api/reports/profit-loss
 * @desc    Get Profit & Loss report for a date range
 * @query   startDate - Start date (YYYY-MM-DD) (required)
 * @query   endDate - End date (YYYY-MM-DD) (required)
 * @query   includeComparison - Include previous period comparison (optional, default: false)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { startDate, endDate, taxYear },
 *     income: {
 *       categories: [{ categoryId, categoryCode, categoryName, amount, vatAmount, totalAmount, transactionCount }],
 *       total: { amount, vatAmount, totalAmount, transactionCount }
 *     },
 *     expenses: {
 *       categories: [{ categoryId, categoryCode, categoryName, amount, vatAmount, totalAmount, transactionCount }],
 *       total: { amount, vatAmount, totalAmount, transactionCount }
 *     },
 *     summary: {
 *       totalRevenue, totalExpenses, grossProfit, netProfit, profitMargin, transactionCount
 *     },
 *     monthlySummary: [{
 *       year, month, monthName, income, expense, grossProfit, netProfit
 *     }],
 *     comparison?: { previousPeriod, previous, changes }
 *   }
 * }
 */
router.get('/profit-loss', getProfitLoss);

/**
 * @route   GET /api/reports/profit-loss/tax-year/:taxYear
 * @desc    Get Profit & Loss report for a specific UK tax year
 * @param   taxYear - Tax year in YYYY-YY format (e.g., 2025-26)
 * @query   includeComparison - Include previous period comparison (optional)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns Profit & Loss report for the specified tax year
 */
router.get('/profit-loss/tax-year/:taxYear', getProfitLossByTaxYear);

/**
 * @route   GET /api/reports/profit-loss/monthly/:year/:month
 * @desc    Get Profit & Loss report for a specific month
 * @param   year - The year (e.g., 2025)
 * @param   month - The month (1-12)
 * @query   includeComparison - Include previous period comparison (optional)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns Profit & Loss report for the specified month
 */
router.get('/profit-loss/monthly/:year/:month', getProfitLossByMonth);

/**
 * @route   GET /api/reports/profit-loss/quarterly/:year/:quarter
 * @desc    Get Profit & Loss report for a specific quarter
 * @param   year - The year (e.g., 2025)
 * @param   quarter - The quarter (1-4)
 * @query   includeComparison - Include previous period comparison (optional)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns Profit & Loss report for the specified quarter
 */
router.get('/profit-loss/quarterly/:year/:quarter', getProfitLossByQuarter);

// =====================================
// VAT Summary Report Routes
// =====================================

/**
 * @route   GET /api/reports/vat-summary
 * @desc    Get VAT summary report for a date range
 * @query   startDate - Start date (YYYY-MM-DD) (required)
 * @query   endDate - End date (YYYY-MM-DD) (required)
 * @query   includeCategoryBreakdown - Include category breakdown (optional, default: false)
 * @query   includeMonthlyBreakdown - Include monthly breakdown (optional, default: true)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { startDate, endDate, taxYear },
 *     outputVat: {
 *       byRate: [{ vatRate, vatRatePercent, transactionCount, netAmount, vatAmount, grossAmount, rateName }],
 *       totals: { netAmount, vatAmount, grossAmount, transactionCount }
 *     },
 *     inputVat: {
 *       byRate: [{ vatRate, vatRatePercent, transactionCount, netAmount, vatAmount, grossAmount, rateName }],
 *       totals: { netAmount, vatAmount, grossAmount, transactionCount }
 *     },
 *     netPosition: { outputVat, inputVat, netVat, isRefundDue, description },
 *     transactionCounts: { output, input, total },
 *     monthlyBreakdown?: [...],
 *     categoryBreakdown?: { output: [...], input: [...] }
 *   }
 * }
 */
router.get('/vat-summary', getVatSummary);

/**
 * @route   GET /api/reports/vat-summary/tax-year/:taxYear
 * @desc    Get VAT summary report for a specific UK tax year
 * @param   taxYear - Tax year in YYYY-YY format (e.g., 2025-26)
 * @query   includeCategoryBreakdown - Include category breakdown (optional)
 * @query   includeMonthlyBreakdown - Include monthly breakdown (optional)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns VAT summary report for the specified tax year
 */
router.get('/vat-summary/tax-year/:taxYear', getVatSummaryByTaxYear);

/**
 * @route   GET /api/reports/vat-summary/monthly/:year/:month
 * @desc    Get VAT summary report for a specific month
 * @param   year - The year (e.g., 2025)
 * @param   month - The month (1-12)
 * @query   includeCategoryBreakdown - Include category breakdown (optional)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns VAT summary report for the specified month
 */
router.get('/vat-summary/monthly/:year/:month', getVatSummaryByMonth);

/**
 * @route   GET /api/reports/vat-summary/quarterly/:year/:quarter
 * @desc    Get VAT summary report for a specific quarter
 * @param   year - The year (e.g., 2025)
 * @param   quarter - The quarter (1-4)
 * @query   includeCategoryBreakdown - Include category breakdown (optional)
 * @query   includeMonthlyBreakdown - Include monthly breakdown (optional)
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns VAT summary report for the specified quarter
 */
router.get('/vat-summary/quarterly/:year/:quarter', getVatSummaryByQuarter);

module.exports = router;
