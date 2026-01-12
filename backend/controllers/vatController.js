/**
 * VAT Controller
 * Handles HTTP requests for VAT-related operations including threshold monitoring
 * and VAT return CRUD operations.
 * 
 * @module controllers/vatController
 */

const { findById } = require('../database/models/User');
const VatReturn = require('../database/models/VatReturn');
const { 
  getVatThresholdStatus, 
  getDashboardSummary,
  getVatThresholdConfig,
  WARNING_LEVELS
} = require('../services/vatThresholdService');
const {
  calculateAndPrepareVatReturn,
  getVatReturnPreview
} = require('../services/vatCalculationService');
const {
  getBoxBreakdown,
  getFullVatReturnBreakdown,
  getBreakdownByVatRate,
  getAvailableVatRates
} = require('../services/vatBreakdownService');
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

// ==========================================
// VAT RETURN CRUD OPERATIONS
// ==========================================

/**
 * Creates a new VAT return with calculated values.
 * 
 * POST /api/vat/returns
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body with VAT return data
 * @param {string} req.body.periodStart - Period start date (YYYY-MM-DD)
 * @param {string} req.body.periodEnd - Period end date (YYYY-MM-DD)
 * @param {string} [req.body.accountingScheme] - 'standard' or 'cash'
 * @param {boolean} [req.body.autoCalculate=true] - Whether to auto-calculate boxes
 * @param {string} [req.body.notes] - Additional notes
 * @param {Object} res - Express response object
 */
async function createVatReturn(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const {
      periodStart,
      periodEnd,
      accountingScheme = 'standard',
      autoCalculate = true,
      notes,
      // Manual box values (only used when autoCalculate is false)
      box1,
      box2,
      box4,
      box6,
      box7,
      box8,
      box9
    } = req.body;
    
    // Validate required fields
    if (!periodStart || !periodEnd) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Period start and end dates are required',
            tr: 'Dönem başlangıç ve bitiş tarihleri gereklidir'
          }
        }
      });
    }
    
    let vatReturnData;
    
    if (autoCalculate) {
      // Use VAT calculation service to compute boxes
      const calculationResult = calculateAndPrepareVatReturn(userId, periodStart, periodEnd, {
        accountingScheme
      });
      
      if (!calculationResult.success) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'CALCULATION_ERROR',
            message: {
              en: 'Failed to calculate VAT return',
              tr: 'KDV beyannamesi hesaplanamadı'
            },
            details: calculationResult.errors
          }
        });
      }
      
      vatReturnData = {
        ...calculationResult.data,
        notes: notes || null
      };
    } else {
      // Use manually provided box values
      vatReturnData = {
        userId,
        periodStart,
        periodEnd,
        box1: box1 || 0,
        box2: box2 || 0,
        box4: box4 || 0,
        box6: box6 || 0,
        box7: box7 || 0,
        box8: box8 || 0,
        box9: box9 || 0,
        status: 'draft',
        notes: notes || null
      };
    }
    
    // Create the VAT return
    const result = VatReturn.createVatReturn(vatReturnData);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create VAT return',
            tr: 'KDV beyannamesi oluşturulamadı'
          },
          details: Object.entries(result.errors || {}).map(([field, message]) => ({
            field,
            message,
            messageTr: message
          }))
        }
      });
    }
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Create VAT return error:', error);
    
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
 * Lists all VAT returns for the authenticated user.
 * 
 * GET /api/vat/returns
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.status] - Filter by status
 * @param {string} [req.query.sortBy='periodEnd'] - Sort field
 * @param {string} [req.query.sortOrder='DESC'] - Sort order
 * @param {Object} res - Express response object
 */
async function listVatReturns(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'periodEnd',
      sortOrder = 'DESC'
    } = req.query;
    
    const result = VatReturn.getVatReturnsByUserId(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      sortBy,
      sortOrder
    });
    
    // Also get status counts for summary
    const statusCounts = VatReturn.getStatusCounts(userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatReturns: result.vatReturns,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit)
        },
        statusCounts
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('List VAT returns error:', error);
    
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
 * Gets a VAT return by ID with full details.
 * 
 * GET /api/vat/returns/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {Object} res - Express response object
 */
async function getVatReturnById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Format currency values for display
    const formatCurrency = (amount) => new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount / 100);
    
    const formattedData = {
      ...vatReturn,
      formatted: {
        box1: formatCurrency(vatReturn.box1),
        box2: formatCurrency(vatReturn.box2),
        box3: formatCurrency(vatReturn.box3),
        box4: formatCurrency(vatReturn.box4),
        box5: formatCurrency(vatReturn.box5),
        box6: formatCurrency(vatReturn.box6),
        box7: formatCurrency(vatReturn.box7),
        box8: formatCurrency(vatReturn.box8),
        box9: formatCurrency(vatReturn.box9),
        netVatPayable: vatReturn.box5 >= 0,
        netVatRefund: vatReturn.box5 < 0
      }
    };
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: formattedData,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT return by ID error:', error);
    
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
 * Updates a VAT return.
 * 
 * PUT /api/vat/returns/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 */
async function updateVatReturnById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Prevent updates to submitted/accepted returns
    if (['submitted', 'accepted'].includes(vatReturn.status)) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_VAT_RETURN_ALREADY_SUBMITTED',
          message: {
            en: 'Cannot modify a submitted or accepted VAT return',
            tr: 'Gönderilmiş veya kabul edilmiş KDV beyannamesi değiştirilemez'
          }
        }
      });
    }
    
    const {
      periodStart,
      periodEnd,
      box1,
      box2,
      box4,
      box6,
      box7,
      box8,
      box9,
      notes,
      hmrcReceiptId
    } = req.body;
    
    // Build update data
    const updateData = {};
    
    if (periodStart !== undefined) updateData.periodStart = periodStart;
    if (periodEnd !== undefined) updateData.periodEnd = periodEnd;
    if (box1 !== undefined) updateData.box1 = box1;
    if (box2 !== undefined) updateData.box2 = box2;
    if (box4 !== undefined) updateData.box4 = box4;
    if (box6 !== undefined) updateData.box6 = box6;
    if (box7 !== undefined) updateData.box7 = box7;
    if (box8 !== undefined) updateData.box8 = box8;
    if (box9 !== undefined) updateData.box9 = box9;
    if (notes !== undefined) updateData.notes = notes;
    if (hmrcReceiptId !== undefined) updateData.hmrcReceiptId = hmrcReceiptId;
    
    const result = VatReturn.updateVatReturn(parseInt(id, 10), updateData);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to update VAT return',
            tr: 'KDV beyannamesi güncellenemedi'
          },
          details: Object.entries(result.errors || {}).map(([field, message]) => ({
            field,
            message,
            messageTr: message
          }))
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Update VAT return error:', error);
    
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
 * Deletes a VAT return.
 * Only draft returns can be deleted.
 * 
 * DELETE /api/vat/returns/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {Object} res - Express response object
 */
async function deleteVatReturnById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Only allow deletion of draft returns
    if (vatReturn.status !== 'draft') {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_CANNOT_DELETE_NON_DRAFT',
          message: {
            en: 'Only draft VAT returns can be deleted',
            tr: 'Yalnızca taslak KDV beyannameleri silinebilir'
          }
        }
      });
    }
    
    const result = VatReturn.deleteVatReturn(parseInt(id, 10));
    
    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: {
            en: result.error || 'Failed to delete VAT return',
            tr: result.error || 'KDV beyannamesi silinemedi'
          }
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: {
        en: 'VAT return deleted successfully',
        tr: 'KDV beyannamesi başarıyla silindi'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Delete VAT return error:', error);
    
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
 * Updates VAT return status.
 * Handles status transitions (draft -> pending -> submitted -> accepted/rejected).
 * 
 * PATCH /api/vat/returns/:id/status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - New status
 * @param {Object} res - Express response object
 */
async function updateVatReturnStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Status is required',
            tr: 'Durum gereklidir'
          }
        }
      });
    }
    
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Define valid status transitions
    const validTransitions = {
      'draft': ['pending', 'submitted'],
      'pending': ['draft', 'submitted'],
      'submitted': ['accepted', 'rejected'],
      'rejected': ['amended', 'draft'],
      'amended': ['pending', 'submitted'],
      'accepted': [] // Cannot transition from accepted
    };
    
    const allowedNextStatuses = validTransitions[vatReturn.status] || [];
    
    if (!allowedNextStatuses.includes(status)) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: {
            en: `Cannot transition from '${vatReturn.status}' to '${status}'. Allowed: ${allowedNextStatuses.join(', ') || 'none'}`,
            tr: `'${vatReturn.status}' durumundan '${status}' durumuna geçiş yapılamaz. İzin verilenler: ${allowedNextStatuses.join(', ') || 'yok'}`
          }
        }
      });
    }
    
    const result = VatReturn.updateStatus(parseInt(id, 10), status);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'STATUS_UPDATE_FAILED',
          message: {
            en: result.error || 'Failed to update status',
            tr: result.error || 'Durum güncellenemedi'
          }
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        previousStatus: vatReturn.status,
        newStatus: status
      }
    });
    
  } catch (error) {
    console.error('Update VAT return status error:', error);
    
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
 * Previews a VAT return calculation without saving.
 * Useful for showing users what their VAT return would look like before creating.
 * 
 * GET /api/vat/returns/preview
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.periodStart - Period start date (YYYY-MM-DD)
 * @param {string} req.query.periodEnd - Period end date (YYYY-MM-DD)
 * @param {string} [req.query.accountingScheme='standard'] - 'standard' or 'cash'
 * @param {Object} res - Express response object
 */
async function previewVatReturn(req, res) {
  try {
    const { lang = 'en', periodStart, periodEnd, accountingScheme = 'standard' } = req.query;
    const userId = req.user.id;
    
    // Validate required fields
    if (!periodStart || !periodEnd) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Period start and end dates are required',
            tr: 'Dönem başlangıç ve bitiş tarihleri gereklidir'
          }
        }
      });
    }
    
    const previewResult = getVatReturnPreview(userId, periodStart, periodEnd, {
      language: lang,
      accountingScheme
    });
    
    if (!previewResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: {
            en: 'Failed to calculate VAT return preview',
            tr: 'KDV beyannamesi önizlemesi hesaplanamadı'
          },
          details: previewResult.errors
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: previewResult.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        isPreview: true
      }
    });
    
  } catch (error) {
    console.error('Preview VAT return error:', error);
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

// ==========================================
// VAT RETURN BREAKDOWN OPERATIONS
// ==========================================

/**
 * Gets full VAT return breakdown with all boxes.
 * 
 * GET /api/vat/returns/:id/breakdown
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getVatReturnBreakdown(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    
    // Find the VAT return
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Get breakdown for the VAT return period
    const breakdownResult = getFullVatReturnBreakdown(
      userId,
      vatReturn.periodStart,
      vatReturn.periodEnd,
      { lang }
    );
    
    if (!breakdownResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'BREAKDOWN_ERROR',
          message: {
            en: 'Failed to get VAT return breakdown',
            tr: 'KDV beyannamesi dökümü alınamadı'
          },
          details: breakdownResult.errors
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatReturn: {
          id: vatReturn.id,
          periodStart: vatReturn.periodStart,
          periodEnd: vatReturn.periodEnd,
          status: vatReturn.status
        },
        breakdown: breakdownResult.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT return breakdown error:', error);
    
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
 * Gets breakdown for a specific VAT return box.
 * 
 * GET /api/vat/returns/:id/breakdown/box/:boxNumber
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {string} req.params.boxNumber - Box number (1-9)
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.vatRate] - Filter by VAT rate (basis points, e.g., 2000 for 20%)
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getVatReturnBoxBreakdown(req, res) {
  try {
    const { lang = 'en', vatRate } = req.query;
    const userId = req.user.id;
    const { id, boxNumber } = req.params;
    
    // Validate box number
    const boxNum = parseInt(boxNumber, 10);
    if (isNaN(boxNum) || boxNum < 1 || boxNum > 9) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Box number must be between 1 and 9',
            tr: 'Kutu numarası 1 ile 9 arasında olmalıdır'
          }
        }
      });
    }
    
    // Find the VAT return
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Parse optional vatRate filter
    const vatRateFilter = vatRate !== undefined ? parseInt(vatRate, 10) : undefined;
    if (vatRate !== undefined && (isNaN(vatRateFilter) || vatRateFilter < 0 || vatRateFilter > 10000)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'VAT rate must be between 0 and 10000 (representing 0% to 100%)',
            tr: 'KDV oranı 0 ile 10000 arasında olmalıdır (%0 ile %100 arasını temsil eder)'
          }
        }
      });
    }
    
    // Get breakdown for the specific box
    const breakdownResult = getBoxBreakdown(
      userId,
      vatReturn.periodStart,
      vatReturn.periodEnd,
      boxNum,
      { vatRate: vatRateFilter, lang }
    );
    
    if (!breakdownResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'BREAKDOWN_ERROR',
          message: {
            en: 'Failed to get box breakdown',
            tr: 'Kutu dökümü alınamadı'
          },
          details: breakdownResult.errors
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatReturn: {
          id: vatReturn.id,
          periodStart: vatReturn.periodStart,
          periodEnd: vatReturn.periodEnd,
          status: vatReturn.status
        },
        boxBreakdown: breakdownResult.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT return box breakdown error:', error);
    
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
 * Gets breakdown filtered by VAT rate for a VAT return.
 * 
 * GET /api/vat/returns/:id/breakdown/by-rate/:vatRate
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {string} req.params.vatRate - VAT rate in basis points (e.g., 2000 for 20%)
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getVatReturnBreakdownByRate(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id, vatRate } = req.params;
    
    // Validate VAT rate
    const vatRateNum = parseInt(vatRate, 10);
    if (isNaN(vatRateNum) || vatRateNum < 0 || vatRateNum > 10000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'VAT rate must be between 0 and 10000 (representing 0% to 100%)',
            tr: 'KDV oranı 0 ile 10000 arasında olmalıdır (%0 ile %100 arasını temsil eder)'
          }
        }
      });
    }
    
    // Find the VAT return
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Get breakdown by rate
    const breakdownResult = getBreakdownByVatRate(
      userId,
      vatReturn.periodStart,
      vatReturn.periodEnd,
      vatRateNum,
      { lang }
    );
    
    if (!breakdownResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'BREAKDOWN_ERROR',
          message: {
            en: 'Failed to get VAT rate breakdown',
            tr: 'KDV oranı dökümü alınamadı'
          },
          details: breakdownResult.errors
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatReturn: {
          id: vatReturn.id,
          periodStart: vatReturn.periodStart,
          periodEnd: vatReturn.periodEnd,
          status: vatReturn.status
        },
        rateBreakdown: breakdownResult.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT return breakdown by rate error:', error);
    
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
 * Gets available VAT rates for a VAT return period.
 * 
 * GET /api/vat/returns/:id/breakdown/rates
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - VAT return ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getVatReturnAvailableRates(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    
    // Find the VAT return
    const vatReturn = VatReturn.findById(parseInt(id, 10));
    
    if (!vatReturn) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'VAT return not found',
            tr: 'KDV beyannamesi bulunamadı'
          }
        }
      });
    }
    
    // Check ownership
    if (vatReturn.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Get available rates
    const ratesResult = getAvailableVatRates(
      userId,
      vatReturn.periodStart,
      vatReturn.periodEnd,
      lang
    );
    
    if (!ratesResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'BREAKDOWN_ERROR',
          message: {
            en: 'Failed to get available VAT rates',
            tr: 'Mevcut KDV oranları alınamadı'
          },
          details: ratesResult.errors
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatReturn: {
          id: vatReturn.id,
          periodStart: vatReturn.periodStart,
          periodEnd: vatReturn.periodEnd,
          status: vatReturn.status
        },
        availableRates: ratesResult.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get VAT return available rates error:', error);
    
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
  // VAT Return CRUD operations
  createVatReturn,
  listVatReturns,
  getVatReturnById,
  updateVatReturnById,
  deleteVatReturnById,
  updateVatReturnStatus,
  previewVatReturn,
  // VAT Return Breakdown operations
  getVatReturnBreakdown,
  getVatReturnBoxBreakdown,
  getVatReturnBreakdownByRate,
  getVatReturnAvailableRates,
  // Export for testing
  WARNING_LEVELS
};
