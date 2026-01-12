/**
 * Settings Controller
 * Handles VAT configuration settings operations including retrieving and updating VAT settings.
 * 
 * @module controllers/settingsController
 */

const { findById, updateUser, sanitizeUser, VALID_VAT_SCHEMES } = require('../database/models/User');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Gets the current authenticated user's VAT settings.
 * GET /api/settings/vat
 * 
 * Returns:
 * - isVatRegistered: boolean - VAT registration status
 * - vatNumber: string|null - UK VAT number
 * - vatScheme: string - VAT accounting scheme
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getVatSettings(req, res) {
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

    // Fetch fresh user data from database to ensure we have the latest
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

    // Extract VAT-related settings
    const vatSettings = {
      isVatRegistered: Boolean(user.isVatRegistered),
      vatNumber: user.vatNumber || null,
      vatScheme: user.vatScheme || 'standard'
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatSettings
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        validSchemes: VALID_VAT_SCHEMES
      }
    });

  } catch (error) {
    console.error('Get VAT settings error:', error);

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
 * Updates the current authenticated user's VAT settings.
 * PUT /api/settings/vat
 * 
 * Allowed fields to update:
 * - isVatRegistered: boolean
 * - vatNumber: string
 * - vatScheme: string (one of: standard, flat_rate, cash, annual, retail)
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - VAT settings data to update
 * @param {Object} res - Express response object
 */
async function updateVatSettings(req, res) {
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

    const userId = req.user.id;

    // Extract allowed VAT fields from request body
    const {
      isVatRegistered,
      vatNumber,
      vatScheme
    } = req.body;

    // Build update data object with only provided fields
    const updateData = {};

    if (isVatRegistered !== undefined) {
      updateData.isVatRegistered = isVatRegistered;
    }
    if (vatNumber !== undefined) {
      updateData.vatNumber = vatNumber;
    }
    if (vatScheme !== undefined) {
      updateData.vatScheme = vatScheme;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'No valid VAT fields to update',
            tr: 'Güncellenecek geçerli KDV alanı yok'
          }
        }
      });
    }

    // Update user VAT settings
    const result = await updateUser(userId, updateData);

    if (!result.success) {
      // Handle validation errors from User model
      const errorDetails = Object.entries(result.errors).map(([field, message]) => ({
        field,
        message
      }));

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'VAT settings update failed due to validation errors',
            tr: 'Doğrulama hataları nedeniyle KDV ayarları güncellenemedi'
          },
          details: errorDetails
        }
      });
    }

    // Extract VAT-related settings from updated user
    const vatSettings = {
      isVatRegistered: Boolean(result.data.isVatRegistered),
      vatNumber: result.data.vatNumber || null,
      vatScheme: result.data.vatScheme || 'standard'
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        vatSettings
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        validSchemes: VALID_VAT_SCHEMES
      }
    });

  } catch (error) {
    console.error('Update VAT settings error:', error);

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
 * Gets the list of valid VAT schemes.
 * GET /api/settings/vat/schemes
 * 
 * Returns an array of valid VAT scheme options with descriptions.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getVatSchemes(req, res) {
  try {
    const { lang = 'en' } = req.query;

    const schemes = [
      {
        id: 'standard',
        name: {
          en: 'Standard VAT Accounting',
          tr: 'Standart KDV Muhasebesi'
        },
        description: {
          en: 'Standard VAT accounting - account for VAT when invoices are issued/received',
          tr: 'Standart KDV muhasebesi - faturalar kesildiğinde/alındığında KDV hesaplanır'
        }
      },
      {
        id: 'flat_rate',
        name: {
          en: 'Flat Rate Scheme',
          tr: 'Sabit Oran Planı'
        },
        description: {
          en: 'Pay a fixed percentage of turnover - simplified VAT accounting for smaller businesses',
          tr: 'Cironun sabit bir yüzdesini ödeyin - küçük işletmeler için basitleştirilmiş KDV muhasebesi'
        }
      },
      {
        id: 'cash',
        name: {
          en: 'Cash Accounting Scheme',
          tr: 'Nakit Muhasebe Planı'
        },
        description: {
          en: 'Account for VAT only when payment is received/made',
          tr: 'KDV yalnızca ödeme alındığında/yapıldığında hesaplanır'
        }
      },
      {
        id: 'annual',
        name: {
          en: 'Annual Accounting Scheme',
          tr: 'Yıllık Muhasebe Planı'
        },
        description: {
          en: 'Make advance VAT payments and submit one annual return',
          tr: 'Avans KDV ödemeleri yapın ve yıllık bir beyanname gönderin'
        }
      },
      {
        id: 'retail',
        name: {
          en: 'Retail Schemes',
          tr: 'Perakende Planları'
        },
        description: {
          en: 'Specialized schemes for retail businesses with mixed VAT rate sales',
          tr: 'Karma KDV oranlı satış yapan perakende işletmeler için özel planlar'
        }
      }
    ];

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        schemes
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get VAT schemes error:', error);

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
  getVatSettings,
  updateVatSettings,
  getVatSchemes,
  // Export constants for use by other modules
  VALID_VAT_SCHEMES
};
