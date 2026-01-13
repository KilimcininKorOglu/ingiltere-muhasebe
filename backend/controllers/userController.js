/**
 * User Controller
 * Handles user profile operations including retrieving and updating user profiles.
 * 
 * @module controllers/userController
 */

const { findById, updateUser, sanitizeUser } = require('../database/models/User');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Gets the current authenticated user's profile.
 * GET /api/users/me
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getProfile(req, res) {
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

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: sanitizeUser(user)
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);

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
 * Updates the current authenticated user's profile.
 * PUT /api/users/me
 * 
 * Allowed fields to update:
 * - name
 * - businessName
 * - businessAddress
 * - vatNumber
 * - isVatRegistered
 * - companyNumber
 * - taxYearStart
 * - preferredLanguage
 * - invoicePrefix
 * - nextInvoiceNumber
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Profile data to update
 * @param {Object} res - Express response object
 */
async function updateProfile(req, res) {
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

    // Extract allowed fields from request body
    const {
      name,
      businessName,
      businessAddress,
      vatNumber,
      isVatRegistered,
      vatScheme,
      companyNumber,
      taxYearStart,
      preferredLanguage,
      invoicePrefix,
      nextInvoiceNumber,
      currency,
      dateFormat
    } = req.body;

    // Build update data object with only provided fields
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }
    if (businessName !== undefined) {
      updateData.businessName = businessName;
    }
    if (businessAddress !== undefined) {
      updateData.businessAddress = businessAddress;
    }
    if (vatNumber !== undefined) {
      updateData.vatNumber = vatNumber;
    }
    if (isVatRegistered !== undefined) {
      updateData.isVatRegistered = isVatRegistered;
    }
    if (vatScheme !== undefined) {
      updateData.vatScheme = vatScheme;
    }
    if (companyNumber !== undefined) {
      updateData.companyNumber = companyNumber;
    }
    if (taxYearStart !== undefined) {
      updateData.taxYearStart = taxYearStart;
    }
    if (preferredLanguage !== undefined) {
      updateData.preferredLanguage = preferredLanguage;
    }
    if (invoicePrefix !== undefined) {
      updateData.invoicePrefix = invoicePrefix;
    }
    if (nextInvoiceNumber !== undefined) {
      updateData.nextInvoiceNumber = nextInvoiceNumber;
    }
    if (currency !== undefined) {
      updateData.currency = currency;
    }
    if (dateFormat !== undefined) {
      updateData.dateFormat = dateFormat;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'No valid fields to update',
            tr: 'Güncellenecek geçerli alan yok'
          }
        }
      });
    }

    // Update user profile
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
            en: 'Profile update failed due to validation errors',
            tr: 'Doğrulama hataları nedeniyle profil güncellenemedi'
          },
          details: errorDetails
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);

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
  getProfile,
  updateProfile
};
