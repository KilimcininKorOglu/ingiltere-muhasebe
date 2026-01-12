/**
 * Report Controller
 * Handles report generation operations including PAYE summary reports.
 * 
 * @module controllers/reportController
 */

const payeSummaryService = require('../services/payeSummaryService');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Generates a PAYE summary report for a date range.
 * GET /api/reports/paye-summary
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getPayeSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const { startDate, endDate } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Start date and end date are required',
            tr: 'Başlangıç ve bitiş tarihleri gereklidir'
          }
        }
      });
    }
    
    // Validate date format and range
    const validation = payeSummaryService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.error,
            tr: validation.error // TODO: Add Turkish translations
          }
        }
      });
    }
    
    // Generate the PAYE summary
    const summary = payeSummaryService.generatePayeSummary(userId, startDate, endDate);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'paye-summary'
      }
    });
    
  } catch (error) {
    console.error('Get PAYE summary error:', error);
    
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
 * Generates a PAYE summary report for a specific tax year.
 * GET /api/reports/paye-summary/tax-year/:taxYear
 * 
 * URL Parameters:
 * - taxYear: Tax year in YYYY-YY format (e.g., '2025-26')
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getPayeSummaryByTaxYear(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const { taxYear } = req.params;
    
    // Validate tax year format
    const taxYearRegex = /^\d{4}-\d{2}$/;
    if (!taxYear || !taxYearRegex.test(taxYear)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid tax year format. Use YYYY-YY (e.g., 2025-26)',
            tr: 'Geçersiz vergi yılı formatı. YYYY-YY kullanın (örn. 2025-26)'
          }
        }
      });
    }
    
    // Validate tax year parts
    const [startYear, endYearPart] = taxYear.split('-');
    const expectedEndYear = String(parseInt(startYear, 10) + 1).slice(-2);
    if (endYearPart !== expectedEndYear) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: `Invalid tax year. Expected ${startYear}-${expectedEndYear}`,
            tr: `Geçersiz vergi yılı. Beklenen: ${startYear}-${expectedEndYear}`
          }
        }
      });
    }
    
    // Generate the PAYE summary for tax year
    const summary = payeSummaryService.generatePayeSummaryForTaxYear(userId, taxYear);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'paye-summary-tax-year'
      }
    });
    
  } catch (error) {
    console.error('Get PAYE summary by tax year error:', error);
    
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
 * Generates a PAYE summary report for a specific month.
 * GET /api/reports/paye-summary/monthly/:year/:month
 * 
 * URL Parameters:
 * - year: The year (e.g., 2025)
 * - month: The month (1-12)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getPayeSummaryByMonth(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    
    // Validate year
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid year. Must be between 2000 and 2100',
            tr: 'Geçersiz yıl. 2000 ile 2100 arasında olmalıdır'
          }
        }
      });
    }
    
    // Validate month
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid month. Must be between 1 and 12',
            tr: 'Geçersiz ay. 1 ile 12 arasında olmalıdır'
          }
        }
      });
    }
    
    // Generate the PAYE summary for the month
    const summary = payeSummaryService.generatePayeSummaryForMonth(userId, year, month);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'paye-summary-monthly',
        monthName: payeSummaryService.getMonthName(month)
      }
    });
    
  } catch (error) {
    console.error('Get PAYE summary by month error:', error);
    
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
 * Gets HMRC payment deadline for a specific month.
 * GET /api/reports/paye-summary/deadline/:year/:month
 * 
 * URL Parameters:
 * - year: The year (e.g., 2025)
 * - month: The month (1-12)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getPaymentDeadline(req, res) {
  try {
    const { lang = 'en' } = req.query;
    
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    
    // Validate year
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid year. Must be between 2000 and 2100',
            tr: 'Geçersiz yıl. 2000 ile 2100 arasında olmalıdır'
          }
        }
      });
    }
    
    // Validate month
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid month. Must be between 1 and 12',
            tr: 'Geçersiz ay. 1 ile 12 arasında olmalıdır'
          }
        }
      });
    }
    
    const electronicDeadline = payeSummaryService.calculatePaymentDeadline(year, month, true);
    const postalDeadline = payeSummaryService.calculatePaymentDeadline(year, month, false);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        period: {
          year,
          month,
          monthName: payeSummaryService.getMonthName(month)
        },
        deadlines: {
          electronic: {
            date: electronicDeadline,
            description: {
              en: 'Payment deadline for electronic payments (Direct Debit, Faster Payments, CHAPS, BACS)',
              tr: 'Elektronik ödemeler için son ödeme tarihi (Doğrudan Borç, Hızlı Ödemeler, CHAPS, BACS)'
            }
          },
          postal: {
            date: postalDeadline,
            description: {
              en: 'Payment deadline for cheque or postal payments',
              tr: 'Çek veya posta ödemeleri için son ödeme tarihi'
            }
          }
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get payment deadline error:', error);
    
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
  getPayeSummary,
  getPayeSummaryByTaxYear,
  getPayeSummaryByMonth,
  getPaymentDeadline
};
