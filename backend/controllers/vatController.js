/**
 * VAT Controller
 * Handles HTTP requests for VAT-related operations including threshold monitoring.
 * 
 * @module controllers/vatController
 */

const { findById } = require('../database/models/User');
const { 
  getVatThresholdStatus, 
  getDashboardSummary,
  getVatThresholdConfig,
  WARNING_LEVELS
} = require('../services/vatThresholdService');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Gets the VAT threshold status for the authenticated user.
 * Calculates rolling 12-month turnover and provides warnings when approaching threshold.
 * 
 * GET /api/vat/threshold-status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {string} [req.query.asOfDate] - Optional date for historical calculation (YYYY-MM-DD)
 * @param {Object} res - Express response object
 */
async function getThresholdStatus(req, res) {
  try {
    const { lang = 'en', asOfDate } = req.query;
    
    // User should be set by auth middleware
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }
    
    // Fetch fresh user data to get VAT registration status
    const user = findById(req.user.id);
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: ERROR_CODES.RES_USER_NOT_FOUND.code,
          message: ERROR_CODES.RES_USER_NOT_FOUND.message
        }
      });
    }
    
    // Parse asOfDate if provided
    let referenceDate = new Date();
    if (asOfDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(asOfDate)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Invalid asOfDate format. Use YYYY-MM-DD',
              tr: 'Geçersiz tarih formatı. YYYY-MM-DD kullanın'
            }
          }
        });
      }
      referenceDate = new Date(asOfDate);
      if (isNaN(referenceDate.getTime())) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Invalid asOfDate value',
              tr: 'Geçersiz tarih değeri'
            }
          }
        });
      }
    }
    
    // Get VAT registration status
    const isVatRegistered = Boolean(user.isVatRegistered);
    
    // Calculate threshold status
    const status = getVatThresholdStatus(req.user.id, isVatRegistered, referenceDate);
    
    // Get dashboard summary
    const summary = getDashboardSummary(status, lang);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...status,
        summary
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT threshold status error:', error);
    
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
 * Gets the current VAT threshold configuration.
 * Returns the registration threshold, deregistration threshold, and warning levels.
 * 
 * GET /api/vat/threshold-config
 * 
 * This endpoint is public and does not require authentication.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getThresholdConfig(req, res) {
  try {
    const { lang = 'en' } = req.query;
    
    const config = getVatThresholdConfig();
    
    // Get warning level descriptions based on language
    const warningDescriptions = {
      approaching: {
        percentage: config.warningLevels.approaching.percentage,
        description: config.warningLevels.approaching.description?.[lang] || 
          config.warningLevels.approaching.description?.en ||
          'Approaching VAT threshold'
      },
      imminent: {
        percentage: config.warningLevels.imminent.percentage,
        description: config.warningLevels.imminent.description?.[lang] ||
          config.warningLevels.imminent.description?.en ||
          'VAT registration imminent'
      },
      exceeded: {
        percentage: config.warningLevels.exceeded.percentage,
        description: config.warningLevels.exceeded.description?.[lang] ||
          config.warningLevels.exceeded.description?.en ||
          'VAT threshold exceeded'
      }
    };
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        registrationThreshold: {
          amount: config.registrationThreshold,
          amountPence: config.registrationThreshold * 100,
          currency: 'GBP',
          description: {
            en: 'VAT Registration Threshold',
            tr: 'KDV Kayıt Eşiği'
          }
        },
        deregistrationThreshold: {
          amount: config.deregistrationThreshold,
          amountPence: config.deregistrationThreshold * 100,
          currency: 'GBP',
          description: {
            en: 'VAT Deregistration Threshold',
            tr: 'KDV Kayıt Silme Eşiği'
          }
        },
        warningLevels: warningDescriptions,
        notes: {
          en: 'VAT registration is required if taxable turnover exceeds the threshold in any rolling 12-month period, or is expected to exceed it in the next 30 days.',
          tr: 'Herhangi bir 12 aylık dönemde vergiye tabi ciro eşiği aşarsa veya önümüzdeki 30 gün içinde aşması bekleniyorsa KDV kaydı gereklidir.'
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT threshold config error:', error);
    
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
 * Gets a simplified dashboard summary for the authenticated user.
 * Returns only the essential information needed for dashboard widgets.
 * 
 * GET /api/vat/dashboard-summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getDashboardStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    
    // User should be set by auth middleware
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }
    
    // Fetch fresh user data to get VAT registration status
    const user = findById(req.user.id);
    
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
    
    // If user is VAT registered, return a simple status
    if (isVatRegistered) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          isVatRegistered: true,
          requiresMonitoring: false,
          message: {
            en: 'You are VAT registered. Threshold monitoring is not required.',
            tr: 'KDV kayıtlısınız. Eşik izlemesi gerekli değildir.'
          }
        },
        meta: {
          language: lang,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Calculate threshold status for non-VAT-registered users
    const status = getVatThresholdStatus(req.user.id, isVatRegistered);
    const summary = getDashboardSummary(status, lang);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        isVatRegistered: false,
        requiresMonitoring: true,
        showWarning: summary.showWarning,
        warningLevel: summary.warningLevel,
        headline: summary.headline,
        details: summary.details,
        turnover: {
          amount: status.turnover.rolling12Month,
          formatted: summary.turnoverFormatted
        },
        threshold: {
          amount: status.threshold.registrationAmount,
          formatted: summary.thresholdFormatted
        },
        progress: {
          percentage: status.warning.percentage,
          formatted: summary.percentageFormatted
        },
        remaining: {
          amount: status.warning.remainingUntilThreshold,
          formatted: summary.remainingFormatted
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT dashboard status error:', error);
    
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
 * Gets monthly turnover breakdown for threshold analysis.
 * Provides detailed month-by-month income data for the rolling 12-month period.
 * 
 * GET /api/vat/turnover-breakdown
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getTurnoverBreakdown(req, res) {
  try {
    const { lang = 'en' } = req.query;
    
    // User should be set by auth middleware
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }
    
    // Fetch fresh user data
    const user = findById(req.user.id);
    
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
    
    // Get full threshold status with breakdown
    const status = getVatThresholdStatus(req.user.id, isVatRegistered);
    
    // Format monthly breakdown with additional details
    const monthNames = {
      en: ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December'],
      tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
           'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    };
    
    const formattedBreakdown = status.turnover.monthlyBreakdown.map(item => {
      const [year, month] = item.month.split('-');
      const monthIndex = parseInt(month, 10) - 1;
      const monthNamesList = monthNames[lang] || monthNames.en;
      
      return {
        month: item.month,
        year: parseInt(year, 10),
        monthNumber: parseInt(month, 10),
        monthName: monthNamesList[monthIndex],
        amount: item.amount,
        formattedAmount: new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP'
        }).format(item.amount / 100)
      };
    });
    
    // Calculate running total for cumulative view
    let runningTotal = 0;
    const cumulativeBreakdown = formattedBreakdown.map(item => {
      runningTotal += item.amount;
      return {
        ...item,
        cumulativeAmount: runningTotal,
        formattedCumulativeAmount: new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP'
        }).format(runningTotal / 100)
      };
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        period: {
          startDate: status.turnover.startDate,
          endDate: status.turnover.endDate
        },
        total: {
          amount: status.turnover.rolling12Month,
          formattedAmount: new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP'
          }).format(status.turnover.rolling12Month / 100),
          transactionCount: status.turnover.transactionCount
        },
        monthlyBreakdown: cumulativeBreakdown,
        threshold: {
          amount: status.threshold.registrationAmount,
          percentage: status.warning.percentage
        },
        projection: {
          next30Days: status.projection.next30Days,
          averageDaily: status.projection.averageDaily
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT turnover breakdown error:', error);
    
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
  getThresholdStatus,
  getThresholdConfig,
  getDashboardStatus,
  getTurnoverBreakdown,
  // Export for testing
  WARNING_LEVELS
};
