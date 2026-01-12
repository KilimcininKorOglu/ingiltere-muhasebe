/**
 * VAT Routes
 * API routes for VAT-related operations including threshold monitoring.
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
  getTurnoverBreakdown
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

module.exports = router;
