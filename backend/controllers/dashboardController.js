/**
 * Dashboard Controller
 * Handles HTTP requests for dashboard summary operations.
 * Provides key financial metrics and recent activity for the home page.
 * 
 * @module controllers/dashboardController
 */

const dashboardService = require('../services/dashboardService');
const { findById } = require('../database/models/User');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Gets the full dashboard summary with all metrics and recent activity.
 * GET /api/dashboard/summary
 * 
 * Query Parameters:
 * - lang: Language preference (en/tr)
 * - recentTransactionsLimit: Number of recent transactions (default: 10)
 * - recentInvoicesLimit: Number of recent invoices (default: 5)
 * - recentPayrollLimit: Number of recent payroll entries (default: 5)
 * - includeRecentActivity: Whether to include recent activity (default: true)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getDashboardSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    // Parse query parameters
    const recentTransactionsLimit = parseInt(req.query.recentTransactionsLimit, 10) || 10;
    const recentInvoicesLimit = parseInt(req.query.recentInvoicesLimit, 10) || 5;
    const recentPayrollLimit = parseInt(req.query.recentPayrollLimit, 10) || 5;
    const includeRecentActivity = req.query.includeRecentActivity !== 'false';
    
    // Validate limits
    if (recentTransactionsLimit < 1 || recentTransactionsLimit > 50) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'recentTransactionsLimit must be between 1 and 50',
            tr: 'recentTransactionsLimit 1 ile 50 arasında olmalıdır'
          }
        }
      });
    }
    
    if (recentInvoicesLimit < 1 || recentInvoicesLimit > 50) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'recentInvoicesLimit must be between 1 and 50',
            tr: 'recentInvoicesLimit 1 ile 50 arasında olmalıdır'
          }
        }
      });
    }
    
    if (recentPayrollLimit < 1 || recentPayrollLimit > 50) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'recentPayrollLimit must be between 1 and 50',
            tr: 'recentPayrollLimit 1 ile 50 arasında olmalıdır'
          }
        }
      });
    }
    
    // Get user data for VAT registration status
    const user = findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: ERROR_CODES.RES_USER_NOT_FOUND.code,
          message: ERROR_CODES.RES_USER_NOT_FOUND.message
        }
      });
    }
    
    const isVatRegistered = Boolean(user.isVatRegistered);
    
    // Generate dashboard summary
    const summary = dashboardService.generateDashboardSummary(userId, {
      isVatRegistered,
      recentTransactionsLimit,
      recentInvoicesLimit,
      recentPayrollLimit,
      includeRecentActivity
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets a quick summary for dashboard widgets.
 * This is a lighter version of the full summary for faster loading.
 * GET /api/dashboard/quick-summary
 * 
 * Query Parameters:
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getQuickSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    // Get user data for VAT registration status
    const user = findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: ERROR_CODES.RES_USER_NOT_FOUND.code,
          message: ERROR_CODES.RES_USER_NOT_FOUND.message
        }
      });
    }
    
    const isVatRegistered = Boolean(user.isVatRegistered);
    
    // Generate quick summary
    const summary = dashboardService.getQuickSummary(userId, isVatRegistered);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get quick summary error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets current month financial summary.
 * GET /api/dashboard/monthly-summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getMonthlySummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const summary = dashboardService.getCurrentMonthSummary(userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get monthly summary error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets dashboard alerts.
 * GET /api/dashboard/alerts
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getAlerts(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    // Get user data for VAT registration status
    const user = findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: ERROR_CODES.RES_USER_NOT_FOUND.code,
          message: ERROR_CODES.RES_USER_NOT_FOUND.message
        }
      });
    }
    
    const isVatRegistered = Boolean(user.isVatRegistered);
    
    // Get metrics for alert generation
    const cashFlow = dashboardService.getCurrentMonthSummary(userId);
    const invoices = dashboardService.getInvoiceSummary(userId);
    const vatThreshold = dashboardService.getVatThresholdSummary(userId, isVatRegistered);
    
    // Generate alerts
    const alerts = dashboardService.generateAlerts({
      cashFlow,
      invoices,
      vatThreshold
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        alerts,
        totalCount: alerts.length,
        urgentCount: alerts.filter(a => a.type === 'urgent').length,
        warningCount: alerts.filter(a => a.type === 'warning').length,
        infoCount: alerts.filter(a => a.type === 'info').length
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get alerts error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets recent activity (transactions, invoices, payroll).
 * GET /api/dashboard/recent-activity
 * 
 * Query Parameters:
 * - transactionsLimit: Number of transactions (default: 10)
 * - invoicesLimit: Number of invoices (default: 5)
 * - payrollLimit: Number of payroll entries (default: 5)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getRecentActivity(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    // Parse limits
    const transactionsLimit = Math.min(50, Math.max(1, parseInt(req.query.transactionsLimit, 10) || 10));
    const invoicesLimit = Math.min(50, Math.max(1, parseInt(req.query.invoicesLimit, 10) || 5));
    const payrollLimit = Math.min(50, Math.max(1, parseInt(req.query.payrollLimit, 10) || 5));
    
    // Get recent activity
    const transactions = dashboardService.getRecentTransactions(userId, transactionsLimit);
    const invoices = dashboardService.getRecentInvoices(userId, invoicesLimit);
    const payroll = dashboardService.getRecentPayrollEntries(userId, payrollLimit);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transactions,
        invoices,
        payroll
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        limits: {
          transactions: transactionsLimit,
          invoices: invoicesLimit,
          payroll: payrollLimit
        }
      }
    });
    
  } catch (error) {
    console.error('Get recent activity error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

module.exports = {
  getDashboardSummary,
  getQuickSummary,
  getMonthlySummary,
  getAlerts,
  getRecentActivity
};
