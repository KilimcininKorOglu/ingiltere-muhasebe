/**
 * Dashboard Routes
 * API routes for dashboard summary and metrics operations.
 * All routes are prefixed with /api/dashboard
 * 
 * @module routes/dashboard
 */

const express = require('express');
const router = express.Router();

const {
  getDashboardSummary,
  getQuickSummary,
  getMonthlySummary,
  getAlerts,
  getRecentActivity
} = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get full dashboard summary with all metrics and recent activity
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @query   recentTransactionsLimit - Number of recent transactions (default: 10, max: 50)
 * @query   recentInvoicesLimit - Number of recent invoices (default: 5, max: 50)
 * @query   recentPayrollLimit - Number of recent payroll entries (default: 5, max: 50)
 * @query   includeRecentActivity - Whether to include recent activity (default: true)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     overview: {
 *       currentMonth: {
 *         income: number,
 *         expenses: number,
 *         netCashFlow: number,
 *         period: { startDate, endDate, monthName, year }
 *       },
 *       accountBalance: {
 *         total: number,
 *         activeAccounts: number
 *       }
 *     },
 *     invoices: {
 *       outstanding: { amount: number, count: number },
 *       overdue: { amount: number, count: number },
 *       drafts: { count: number }
 *     },
 *     payroll: {
 *       taxYear: { start: string, end: string },
 *       totalGrossPay: number,
 *       totalNetPay: number,
 *       activeEmployees: number,
 *       payrollEntryCount: number
 *     },
 *     vatStatus: {
 *       isVatRegistered: boolean,
 *       turnover: number,
 *       thresholdPercentage: number,
 *       warningLevel: string
 *     },
 *     alerts: Array<{
 *       type: string,
 *       category: string,
 *       message: { en: string, tr: string },
 *       priority: string
 *     }>,
 *     recentActivity?: {
 *       transactions: Array,
 *       invoices: Array,
 *       payroll: Array
 *     },
 *     generatedAt: string
 *   }
 * }
 */
router.get('/summary', requireAuth, getDashboardSummary);

/**
 * @route   GET /api/dashboard/quick-summary
 * @desc    Get quick summary for dashboard widgets (lighter version)
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     monthlyIncome: number,
 *     monthlyExpenses: number,
 *     netCashFlow: number,
 *     totalBalance: number,
 *     outstandingInvoices: number,
 *     overdueInvoices: number,
 *     vatThresholdPercentage: number,
 *     vatWarningLevel: string,
 *     alertCount: number,
 *     hasUrgentAlerts: boolean,
 *     generatedAt: string
 *   }
 * }
 */
router.get('/quick-summary', requireAuth, getQuickSummary);

/**
 * @route   GET /api/dashboard/monthly-summary
 * @desc    Get current month financial summary
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     period: { startDate, endDate, monthName, year },
 *     income: { amount: number, transactionCount: number },
 *     expenses: { amount: number, transactionCount: number },
 *     netCashFlow: number
 *   }
 * }
 */
router.get('/monthly-summary', requireAuth, getMonthlySummary);

/**
 * @route   GET /api/dashboard/alerts
 * @desc    Get dashboard alerts and notifications
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     alerts: Array<{
 *       type: string,
 *       category: string,
 *       message: { en: string, tr: string },
 *       priority: string
 *     }>,
 *     totalCount: number,
 *     urgentCount: number,
 *     warningCount: number,
 *     infoCount: number
 *   }
 * }
 */
router.get('/alerts', requireAuth, getAlerts);

/**
 * @route   GET /api/dashboard/recent-activity
 * @desc    Get recent activity (transactions, invoices, payroll)
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @query   transactionsLimit - Number of transactions (default: 10, max: 50)
 * @query   invoicesLimit - Number of invoices (default: 5, max: 50)
 * @query   payrollLimit - Number of payroll entries (default: 5, max: 50)
 * @access  Private
 * @returns {
 *   success: true,
 *   data: {
 *     transactions: Array<{
 *       id: number,
 *       type: string,
 *       status: string,
 *       date: string,
 *       description: string,
 *       amount: number,
 *       vatAmount: number,
 *       totalAmount: number,
 *       payee: string,
 *       category: { code, name, nameTr }
 *     }>,
 *     invoices: Array<{
 *       id: number,
 *       invoiceNumber: string,
 *       status: string,
 *       invoiceDate: string,
 *       dueDate: string,
 *       totalAmount: number,
 *       currency: string,
 *       customer: { name, email }
 *     }>,
 *     payroll: Array<{
 *       id: number,
 *       payDate: string,
 *       grossPay: number,
 *       netPay: number,
 *       status: string,
 *       employee: { firstName, lastName, fullName, email }
 *     }>
 *   }
 * }
 */
router.get('/recent-activity', requireAuth, getRecentActivity);

module.exports = router;
