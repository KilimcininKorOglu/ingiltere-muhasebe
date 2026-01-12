/**
 * Report Controller
 * Handles report generation operations including PAYE summary reports,
 * Profit & Loss (Income Statement) reports, VAT Summary reports,
 * and Self Assessment reports.
 * 
 * @module controllers/reportController
 */

const payeSummaryService = require('../services/payeSummaryService');
const profitLossService = require('../services/profitLossService');
const vatSummaryService = require('../services/vatSummaryService');
const selfAssessmentService = require('../services/selfAssessmentService');
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
// Self Assessment Report Functions
// =====================================

/**
 * Generates a Self Assessment summary report for a date range.
 * GET /api/reports/self-assessment
 * 
 * Query Parameters:
 * - startDate: Start date in YYYY-MM-DD format (required)
 * - endDate: End date in YYYY-MM-DD format (required)
 * - isScottish: Whether to use Scottish tax rates (optional, default: false)
 * - lang: Language preference (en/tr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getSelfAssessment(req, res) {
  try {
    const { lang = 'en', isScottish = 'false' } = req.query;
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
    const validation = selfAssessmentService.validateDateRange(startDate, endDate);
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
    
    // Generate the Self Assessment summary
    const report = selfAssessmentService.generateSelfAssessmentSummary(userId, startDate, endDate, {
      isScottish: isScottish === 'true' || isScottish === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'self-assessment'
      }
    });
    
  } catch (error) {
    console.error('Get Self Assessment error:', error);
    
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
 * Generates a Self Assessment summary report for a specific tax year.
 * GET /api/reports/self-assessment/tax-year/:taxYear
 * 
 * URL Parameters:
 * - taxYear: Tax year in YYYY-YY format (e.g., '2025-26')
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response object
 */
function getSelfAssessmentByTaxYear(req, res) {
  try {
    const { lang = 'en', isScottish = 'false' } = req.query;
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
    
    // Generate the Self Assessment summary for tax year
    const report = selfAssessmentService.generateSelfAssessmentForTaxYear(userId, taxYear, {
      isScottish: isScottish === 'true' || isScottish === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'self-assessment-tax-year'
      }
    });
    
  } catch (error) {
    console.error('Get Self Assessment by tax year error:', error);
    
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
 * Generates a Self Assessment summary report for a specific month.
 * GET /api/reports/self-assessment/monthly/:year/:month
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
function getSelfAssessmentByMonth(req, res) {
  try {
    const { lang = 'en', isScottish = 'false' } = req.query;
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
    
    // Generate the Self Assessment summary for the month
    const report = selfAssessmentService.generateSelfAssessmentForMonth(userId, year, month, {
      isScottish: isScottish === 'true' || isScottish === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'self-assessment-monthly',
        monthName: selfAssessmentService.getMonthName(month)
      }
    });
    
  } catch (error) {
    console.error('Get Self Assessment by month error:', error);
    
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
 * Generates a Self Assessment summary report for a specific quarter.
 * GET /api/reports/self-assessment/quarterly/:year/:quarter
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
function getSelfAssessmentByQuarter(req, res) {
  try {
    const { lang = 'en', isScottish = 'false' } = req.query;
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
    
    // Generate the Self Assessment summary for the quarter
    const report = selfAssessmentService.generateSelfAssessmentForQuarter(userId, year, quarter, {
      isScottish: isScottish === 'true' || isScottish === true
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: report,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        reportType: 'self-assessment-quarterly',
        quarter: quarter,
        quarterName: `Q${quarter}`
      }
    });
    
  } catch (error) {
    console.error('Get Self Assessment by quarter error:', error);
    
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
  
  // Self Assessment reports
  getSelfAssessment,
  getSelfAssessmentByTaxYear,
  getSelfAssessmentByMonth,
  getSelfAssessmentByQuarter
};
