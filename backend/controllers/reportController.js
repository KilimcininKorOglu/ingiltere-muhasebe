/**
 * Report Controller
 * Handles report generation operations including PAYE summary reports,
 * Profit & Loss (Income Statement) reports, VAT Summary reports, and Cash Flow Statements.
 * 
 * @module controllers/reportController
 */

const payeSummaryService = require('../services/payeSummaryService');
const profitLossService = require('../services/profitLossService');
const vatSummaryService = require('../services/vatSummaryService');
const cashFlowService = require('../services/cashFlowService');
const balanceSheetService = require('../services/balanceSheetService');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

// Import export generators
const csvGenerator = require('../services/csvGenerator');
const reportPdfGenerator = require('../services/reportPdfGenerator');
const { findById } = require('../database/models/User');

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

/**
 * Generates a Profit & Loss report for a date range.
 * GET /api/reports/profit-loss
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - includeComparison: Whether to include previous period comparison (optional, default: false)
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getProfitLoss(req, res) {
  try {
    const { lang = 'en', includeComparison = 'false' } = req.query;
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
    const validation = profitLossService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.error,
            tr: validation.error
          }
        }
      });
    }
    
    // Generate the Profit & Loss report
    const report = profitLossService.generateProfitLossReport(userId, startDate, endDate, {
      includeComparison: includeComparison === 'true' || includeComparison === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'profit-loss'
      }
    });
    
  } catch (error) {
    console.error('Get Profit & Loss error:', error);
    
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
 * Generates a Profit & Loss report for a specific tax year.
 * GET /api/reports/profit-loss/tax-year/:taxYear
 * 
 * URL Parameters:
 * - taxYear: Tax year in YYYY-YY format (e.g., '2025-26')
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getProfitLossByTaxYear(req, res) {
  try {
    const { lang = 'en', includeComparison = 'false' } = req.query;
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
    
    // Generate the Profit & Loss report for tax year
    const report = profitLossService.generateProfitLossForTaxYear(userId, taxYear, {
      includeComparison: includeComparison === 'true' || includeComparison === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'profit-loss-tax-year'
      }
    });
    
  } catch (error) {
    console.error('Get Profit & Loss by tax year error:', error);
    
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
 * Generates a Profit & Loss report for a specific month.
 * GET /api/reports/profit-loss/monthly/:year/:month
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
function getProfitLossByMonth(req, res) {
  try {
    const { lang = 'en', includeComparison = 'false' } = req.query;
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
    
    // Generate the Profit & Loss report for the month
    const report = profitLossService.generateProfitLossForMonth(userId, year, month, {
      includeComparison: includeComparison === 'true' || includeComparison === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'profit-loss-monthly',
        monthName: profitLossService.getMonthName(month)
      }
    });
    
  } catch (error) {
    console.error('Get Profit & Loss by month error:', error);
    
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
 * Generates a Profit & Loss report for a specific quarter.
 * GET /api/reports/profit-loss/quarterly/:year/:quarter
 * 
 * URL Parameters:
 * - year: The year (e.g., 2025)
 * - quarter: The quarter (1-4)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getProfitLossByQuarter(req, res) {
  try {
    const { lang = 'en', includeComparison = 'false' } = req.query;
    const userId = req.user.id;
    
    const year = parseInt(req.params.year, 10);
    const quarter = parseInt(req.params.quarter, 10);
    
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
    
    // Validate quarter
    if (isNaN(quarter) || quarter < 1 || quarter > 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid quarter. Must be between 1 and 4',
            tr: 'Geçersiz çeyrek. 1 ile 4 arasında olmalıdır'
          }
        }
      });
    }
    
    // Generate the Profit & Loss report for the quarter
    const report = profitLossService.generateProfitLossForQuarter(userId, year, quarter, {
      includeComparison: includeComparison === 'true' || includeComparison === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'profit-loss-quarterly',
        quarter: quarter,
        quarterName: `Q${quarter}`
      }
    });
    
  } catch (error) {
    console.error('Get Profit & Loss by quarter error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

// =====================================
// VAT Summary Report Functions
// =====================================

/**
 * Generates a VAT summary report for a date range.
 * GET /api/reports/vat-summary
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - includeCategoryBreakdown: Include category breakdown (optional, default: false)
 * - includeMonthlyBreakdown: Include monthly breakdown (optional, default: true)
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getVatSummary(req, res) {
  try {
    const { 
      lang = 'en',
      includeCategoryBreakdown = 'false',
      includeMonthlyBreakdown = 'true'
    } = req.query;
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
    const validation = vatSummaryService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.error,
            tr: validation.error
          }
        }
      });
    }
    
    // Generate the VAT summary report
    const report = vatSummaryService.generateVatSummaryReport(userId, startDate, endDate, {
      includeCategoryBreakdown: includeCategoryBreakdown === 'true' || includeCategoryBreakdown === true,
      includeMonthlyBreakdown: includeMonthlyBreakdown === 'true' || includeMonthlyBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'vat-summary'
      }
    });
    
  } catch (error) {
    console.error('Get VAT summary error:', error);
    
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
 * Generates a VAT summary report for a specific tax year.
 * GET /api/reports/vat-summary/tax-year/:taxYear
 * 
 * URL Parameters:
 * - taxYear: Tax year in YYYY-YY format (e.g., '2025-26')
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getVatSummaryByTaxYear(req, res) {
  try {
    const { 
      lang = 'en',
      includeCategoryBreakdown = 'false',
      includeMonthlyBreakdown = 'true'
    } = req.query;
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
    
    // Generate the VAT summary report for tax year
    const report = vatSummaryService.generateVatSummaryForTaxYear(userId, taxYear, {
      includeCategoryBreakdown: includeCategoryBreakdown === 'true' || includeCategoryBreakdown === true,
      includeMonthlyBreakdown: includeMonthlyBreakdown === 'true' || includeMonthlyBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'vat-summary-tax-year'
      }
    });
    
  } catch (error) {
    console.error('Get VAT summary by tax year error:', error);
    
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
 * Generates a VAT summary report for a specific month.
 * GET /api/reports/vat-summary/monthly/:year/:month
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
function getVatSummaryByMonth(req, res) {
  try {
    const { 
      lang = 'en',
      includeCategoryBreakdown = 'false'
    } = req.query;
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
    
    // Generate the VAT summary report for the month
    const report = vatSummaryService.generateVatSummaryForMonth(userId, year, month, {
      includeCategoryBreakdown: includeCategoryBreakdown === 'true' || includeCategoryBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'vat-summary-monthly',
        monthName: vatSummaryService.getMonthName(month)
      }
    });
    
  } catch (error) {
    console.error('Get VAT summary by month error:', error);
    
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
 * Generates a VAT summary report for a specific quarter.
 * GET /api/reports/vat-summary/quarterly/:year/:quarter
 * 
 * URL Parameters:
 * - year: The year (e.g., 2025)
 * - quarter: The quarter (1-4)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getVatSummaryByQuarter(req, res) {
  try {
    const { 
      lang = 'en',
      includeCategoryBreakdown = 'false',
      includeMonthlyBreakdown = 'true'
    } = req.query;
    const userId = req.user.id;
    
    const year = parseInt(req.params.year, 10);
    const quarter = parseInt(req.params.quarter, 10);
    
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
    
    // Validate quarter
    if (isNaN(quarter) || quarter < 1 || quarter > 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid quarter. Must be between 1 and 4',
            tr: 'Geçersiz çeyrek. 1 ile 4 arasında olmalıdır'
          }
        }
      });
    }
    
    // Generate the VAT summary report for the quarter
    const report = vatSummaryService.generateVatSummaryForQuarter(userId, year, quarter, {
      includeCategoryBreakdown: includeCategoryBreakdown === 'true' || includeCategoryBreakdown === true,
      includeMonthlyBreakdown: includeMonthlyBreakdown === 'true' || includeMonthlyBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'vat-summary-quarterly',
        quarter: quarter,
        quarterName: `Q${quarter}`
      }
    });
    
  } catch (error) {
    console.error('Get VAT summary by quarter error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

// =====================================
// Cash Flow Statement Report Functions
// =====================================

/**
 * Generates a Cash Flow Statement for a date range.
 * GET /api/reports/cash-flow
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - includeComparison: Include previous period comparison (optional, default: false)
 * - includeBankMovements: Include bank account movements (optional, default: true)
 * - includeMonthlyBreakdown: Include monthly breakdown (optional, default: true)
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getCashFlow(req, res) {
  try {
    const { 
      lang = 'en',
      includeComparison = 'false',
      includeBankMovements = 'true',
      includeMonthlyBreakdown = 'true'
    } = req.query;
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
    const validation = cashFlowService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.error,
            tr: validation.error
          }
        }
      });
    }
    
    // Generate the Cash Flow Statement report
    const report = cashFlowService.generateCashFlowReport(userId, startDate, endDate, {
      includeComparison: includeComparison === 'true' || includeComparison === true,
      includeBankMovements: includeBankMovements === 'true' || includeBankMovements === true,
      includeMonthlyBreakdown: includeMonthlyBreakdown === 'true' || includeMonthlyBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'cash-flow'
      }
    });
    
  } catch (error) {
    console.error('Get Cash Flow error:', error);
    
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
 * Generates a Cash Flow Statement for a specific tax year.
 * GET /api/reports/cash-flow/tax-year/:taxYear
 * 
 * URL Parameters:
 * - taxYear: Tax year in YYYY-YY format (e.g., '2025-26')
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getCashFlowByTaxYear(req, res) {
  try {
    const { 
      lang = 'en',
      includeComparison = 'false',
      includeBankMovements = 'true',
      includeMonthlyBreakdown = 'true'
    } = req.query;
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
    
    // Generate the Cash Flow Statement for tax year
    const report = cashFlowService.generateCashFlowForTaxYear(userId, taxYear, {
      includeComparison: includeComparison === 'true' || includeComparison === true,
      includeBankMovements: includeBankMovements === 'true' || includeBankMovements === true,
      includeMonthlyBreakdown: includeMonthlyBreakdown === 'true' || includeMonthlyBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'cash-flow-tax-year'
      }
    });
    
  } catch (error) {
    console.error('Get Cash Flow by tax year error:', error);
    
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
 * Generates a Cash Flow Statement for a specific month.
 * GET /api/reports/cash-flow/monthly/:year/:month
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
function getCashFlowByMonth(req, res) {
  try {
    const { 
      lang = 'en',
      includeComparison = 'false',
      includeBankMovements = 'true'
    } = req.query;
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
    
    // Generate the Cash Flow Statement for the month
    const report = cashFlowService.generateCashFlowForMonth(userId, year, month, {
      includeComparison: includeComparison === 'true' || includeComparison === true,
      includeBankMovements: includeBankMovements === 'true' || includeBankMovements === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'cash-flow-monthly',
        monthName: cashFlowService.getMonthName(month)
      }
    });
    
  } catch (error) {
    console.error('Get Cash Flow by month error:', error);
    
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
 * Generates a Cash Flow Statement for a specific quarter.
 * GET /api/reports/cash-flow/quarterly/:year/:quarter
 * 
 * URL Parameters:
 * - year: The year (e.g., 2025)
 * - quarter: The quarter (1-4)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getCashFlowByQuarter(req, res) {
  try {
    const { 
      lang = 'en',
      includeComparison = 'false',
      includeBankMovements = 'true',
      includeMonthlyBreakdown = 'true'
    } = req.query;
    const userId = req.user.id;
    
    const year = parseInt(req.params.year, 10);
    const quarter = parseInt(req.params.quarter, 10);
    
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
    
    // Validate quarter
    if (isNaN(quarter) || quarter < 1 || quarter > 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid quarter. Must be between 1 and 4',
            tr: 'Geçersiz çeyrek. 1 ile 4 arasında olmalıdır'
          }
        }
      });
    }
    
    // Generate the Cash Flow Statement for the quarter
    const report = cashFlowService.generateCashFlowForQuarter(userId, year, quarter, {
      includeComparison: includeComparison === 'true' || includeComparison === true,
      includeBankMovements: includeBankMovements === 'true' || includeBankMovements === true,
      includeMonthlyBreakdown: includeMonthlyBreakdown === 'true' || includeMonthlyBreakdown === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'cash-flow-quarterly',
        quarter: quarter,
        quarterName: `Q${quarter}`
      }
    });
    
  } catch (error) {
    console.error('Get Cash Flow by quarter error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

// =====================================
// Balance Sheet Reports
// =====================================

/**
 * Generates a Balance Sheet report as of a specific date.
 * GET /api/reports/balance-sheet
 * 
 * Query Parameters:
 * - asOfDate: Date in YYYY-MM-DD format (optional, defaults to today)
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getBalanceSheet(req, res) {
  try {
    const { lang = 'en', asOfDate, includeComparison = 'false' } = req.query;
    const userId = req.user.id;
    
    // Validate asOfDate if provided
    const dateToUse = asOfDate || new Date().toISOString().split('T')[0];
    const validation = balanceSheetService.validateAsOfDate(dateToUse);
    
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.error,
            tr: 'Geçersiz tarih formatı (YYYY-MM-DD gerekli)'
          }
        }
      });
    }
    
    const report = balanceSheetService.generateBalanceSheetReport(
      userId, 
      dateToUse,
      { includeComparison: includeComparison === 'true' || includeComparison === true }
    );
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'balance-sheet'
      }
    });
    
  } catch (error) {
    console.error('Get Balance Sheet error:', error);
    
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
 * Generates a Balance Sheet report for a specific tax year.
 * GET /api/reports/balance-sheet/tax-year/:taxYear
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getBalanceSheetByTaxYear(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { taxYear } = req.params;
    
    // Validate tax year format (YYYY-YY)
    const taxYearRegex = /^(\d{4})-(\d{2})$/;
    const match = taxYear.match(taxYearRegex);
    
    if (!match) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid tax year format. Use YYYY-YY (e.g., 2024-25)',
            tr: 'Geçersiz vergi yılı formatı. YYYY-YY kullanın (örn. 2024-25)'
          }
        }
      });
    }
    
    // Validate that the years are consecutive
    const startYear = parseInt(match[1], 10);
    const endYearShort = parseInt(match[2], 10);
    const expectedEndYear = (startYear + 1) % 100;
    
    if (endYearShort !== expectedEndYear) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: `Invalid tax year. Expected ${startYear}-${String(expectedEndYear).padStart(2, '0')} for consecutive years`,
            tr: `Geçersiz vergi yılı. Ardışık yıllar için ${startYear}-${String(expectedEndYear).padStart(2, '0')} bekleniyor`
          }
        }
      });
    }
    
    const report = balanceSheetService.generateBalanceSheetForTaxYear(userId, taxYear);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'balance-sheet-tax-year',
        taxYear
      }
    });
    
  } catch (error) {
    console.error('Get Balance Sheet by Tax Year error:', error);
    
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
 * Generates a Balance Sheet report for a specific quarter.
 * GET /api/reports/balance-sheet/quarterly/:year/:quarter
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getBalanceSheetByQuarter(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const year = parseInt(req.params.year, 10);
    const quarter = parseInt(req.params.quarter, 10);
    
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
    
    // Validate quarter
    if (isNaN(quarter) || quarter < 1 || quarter > 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid quarter. Must be between 1 and 4',
            tr: 'Geçersiz çeyrek. 1 ile 4 arasında olmalıdır'
          }
        }
      });
    }
    
    const report = balanceSheetService.generateBalanceSheetForQuarter(userId, year, quarter);
    
    const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'balance-sheet-quarterly',
        year,
        quarter,
        quarterName: quarterNames[quarter - 1]
      }
    });
    
  } catch (error) {
    console.error('Get Balance Sheet by Quarter error:', error);
    
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
 * Generates a Balance Sheet report for a specific month.
 * GET /api/reports/balance-sheet/monthly/:year/:month
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getBalanceSheetByMonth(req, res) {
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
    
    const report = balanceSheetService.generateBalanceSheetForMonth(userId, year, month);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'balance-sheet-monthly',
        year,
        month,
        monthName: monthNames[month - 1]
      }
    });
    
  } catch (error) {
    console.error('Get Balance Sheet by Month error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

// =====================================
// Report Export Functions (PDF & CSV)
// =====================================

/**
 * Gets business details for the authenticated user.
 * @param {number} userId - User ID
 * @returns {Object} Business details
 */
function getBusinessDetails(userId) {
  const user = findById(userId);
  if (!user) return {};
  
  return {
    name: user.name,
    businessName: user.businessName,
    businessAddress: user.businessAddress,
    email: user.email,
    vatNumber: user.vatNumber,
    companyNumber: user.companyNumber
  };
}

/**
 * Exports a Profit & Loss report as PDF or CSV.
 * GET /api/reports/profit-loss/export
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - format: Export format ('pdf' or 'csv', default: 'pdf')
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function exportProfitLoss(req, res) {
  try {
    const { lang = 'en', format = 'pdf' } = req.query;
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
    
    // Validate format
    if (!['pdf', 'csv'].includes(format.toLowerCase())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid format. Must be pdf or csv',
            tr: 'Geçersiz format. pdf veya csv olmalıdır'
          }
        }
      });
    }
    
    // Validate date range
    const validation = profitLossService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: { en: validation.error, tr: validation.error }
        }
      });
    }
    
    // Generate the report
    const report = profitLossService.generateProfitLossReport(userId, startDate, endDate, {
      includeComparison: false
    });
    
    const businessDetails = getBusinessDetails(userId);
    const exportFormat = format.toLowerCase();
    
    if (exportFormat === 'csv') {
      const csv = csvGenerator.generateProfitLossCSV(report, { lang, businessDetails });
      const filename = `profit-loss-${startDate}-to-${endDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } else {
      const pdfBuffer = await reportPdfGenerator.generateProfitLossPdf(report, businessDetails, { lang });
      const filename = `profit-loss-${startDate}-to-${endDate}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdfBuffer);
    }
    
  } catch (error) {
    console.error('Export Profit & Loss error:', error);
    
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
 * Exports a VAT Summary report as PDF or CSV.
 * GET /api/reports/vat-summary/export
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - format: Export format ('pdf' or 'csv', default: 'pdf')
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function exportVatSummary(req, res) {
  try {
    const { lang = 'en', format = 'pdf' } = req.query;
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
    
    // Validate format
    if (!['pdf', 'csv'].includes(format.toLowerCase())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid format. Must be pdf or csv',
            tr: 'Geçersiz format. pdf veya csv olmalıdır'
          }
        }
      });
    }
    
    // Validate date range
    const validation = vatSummaryService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: { en: validation.error, tr: validation.error }
        }
      });
    }
    
    // Generate the report
    const report = vatSummaryService.generateVatSummaryReport(userId, startDate, endDate, {
      includeCategoryBreakdown: false,
      includeMonthlyBreakdown: true
    });
    
    const businessDetails = getBusinessDetails(userId);
    const exportFormat = format.toLowerCase();
    
    if (exportFormat === 'csv') {
      const csv = csvGenerator.generateVatSummaryCSV(report, { lang, businessDetails });
      const filename = `vat-summary-${startDate}-to-${endDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } else {
      const pdfBuffer = await reportPdfGenerator.generateVatSummaryPdf(report, businessDetails, { lang });
      const filename = `vat-summary-${startDate}-to-${endDate}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdfBuffer);
    }
    
  } catch (error) {
    console.error('Export VAT Summary error:', error);
    
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
 * Exports a Cash Flow Statement as PDF or CSV.
 * GET /api/reports/cash-flow/export
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - format: Export format ('pdf' or 'csv', default: 'pdf')
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function exportCashFlow(req, res) {
  try {
    const { lang = 'en', format = 'pdf' } = req.query;
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
    
    // Validate format
    if (!['pdf', 'csv'].includes(format.toLowerCase())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid format. Must be pdf or csv',
            tr: 'Geçersiz format. pdf veya csv olmalıdır'
          }
        }
      });
    }
    
    // Validate date range
    const validation = cashFlowService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: { en: validation.error, tr: validation.error }
        }
      });
    }
    
    // Generate the report
    const report = cashFlowService.generateCashFlowReport(userId, startDate, endDate, {
      includeComparison: false,
      includeBankMovements: true,
      includeMonthlyBreakdown: true
    });
    
    const businessDetails = getBusinessDetails(userId);
    const exportFormat = format.toLowerCase();
    
    if (exportFormat === 'csv') {
      const csv = csvGenerator.generateCashFlowCSV(report, { lang, businessDetails });
      const filename = `cash-flow-${startDate}-to-${endDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } else {
      const pdfBuffer = await reportPdfGenerator.generateCashFlowPdf(report, businessDetails, { lang });
      const filename = `cash-flow-${startDate}-to-${endDate}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdfBuffer);
    }
    
  } catch (error) {
    console.error('Export Cash Flow error:', error);
    
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
 * Exports a PAYE Summary report as PDF or CSV.
 * GET /api/reports/paye-summary/export
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - format: Export format ('pdf' or 'csv', default: 'pdf')
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function exportPayeSummary(req, res) {
  try {
    const { lang = 'en', format = 'pdf' } = req.query;
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
    
    // Validate format
    if (!['pdf', 'csv'].includes(format.toLowerCase())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid format. Must be pdf or csv',
            tr: 'Geçersiz format. pdf veya csv olmalıdır'
          }
        }
      });
    }
    
    // Validate date range
    const validation = payeSummaryService.validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: { en: validation.error, tr: validation.error }
        }
      });
    }
    
    // Generate the report
    const report = payeSummaryService.generatePayeSummary(userId, startDate, endDate);
    
    const businessDetails = getBusinessDetails(userId);
    const exportFormat = format.toLowerCase();
    
    if (exportFormat === 'csv') {
      const csv = csvGenerator.generatePayeSummaryCSV(report, { lang, businessDetails });
      const filename = `paye-summary-${startDate}-to-${endDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } else {
      const pdfBuffer = await reportPdfGenerator.generatePayeSummaryPdf(report, businessDetails, { lang });
      const filename = `paye-summary-${startDate}-to-${endDate}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdfBuffer);
    }
    
  } catch (error) {
    console.error('Export PAYE Summary error:', error);
    
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
  // PAYE Summary reports
  getPayeSummary,
  getPayeSummaryByTaxYear,
  getPayeSummaryByMonth,
  getPaymentDeadline,
  
  // Profit & Loss reports
  getProfitLoss,
  getProfitLossByTaxYear,
  getProfitLossByMonth,
  getProfitLossByQuarter,
  
  // VAT Summary reports
  getVatSummary,
  getVatSummaryByTaxYear,
  getVatSummaryByMonth,
  getVatSummaryByQuarter,
  
  // Cash Flow Statement reports
  getCashFlow,
  getCashFlowByTaxYear,
  getCashFlowByMonth,
  getCashFlowByQuarter,
  
  // Balance Sheet reports
  getBalanceSheet,
  getBalanceSheetByTaxYear,
  getBalanceSheetByQuarter,
  getBalanceSheetByMonth,
  
  // Export functions (PDF & CSV)
  exportProfitLoss,
  exportVatSummary,
  exportCashFlow,
  exportPayeSummary
};
