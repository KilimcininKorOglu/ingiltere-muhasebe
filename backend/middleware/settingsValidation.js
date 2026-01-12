/**
 * Settings Validation Middleware
 * Provides request validation middleware for VAT settings endpoints.
 * 
 * @module middleware/settingsValidation
 */

const { HTTP_STATUS } = require('../utils/errorCodes');
const { VALID_VAT_SCHEMES } = require('../database/models/User');

/**
 * Validation error response structure
 * @typedef {Object} ValidationError
 * @property {string} field - Field name with error
 * @property {string} message - Error message in English
 * @property {string} messageTr - Error message in Turkish
 */

/**
 * Sends a validation error response.
 * 
 * @param {Object} res - Express response object
 * @param {ValidationError[]} errors - Array of validation errors
 */
function sendValidationError(res, errors) {
  res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: {
        en: 'Validation failed',
        tr: 'Doğrulama başarısız'
      },
      details: errors
    }
  });
}

/**
 * UK VAT number regex pattern.
 * Matches:
 * - GB followed by 9 digits (standard)
 * - GB followed by 12 digits (branch traders)
 * - GBGD followed by 3 digits (government departments)
 * - GBHA followed by 3 digits (health authorities)
 */
const UK_VAT_REGEX = /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/;

/**
 * Validates VAT settings update request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateVatSettingsUpdate(req, res, next) {
  const errors = [];
  const { isVatRegistered, vatNumber, vatScheme } = req.body;

  // isVatRegistered validation (optional)
  if (isVatRegistered !== undefined && isVatRegistered !== null) {
    if (typeof isVatRegistered !== 'boolean') {
      errors.push({
        field: 'isVatRegistered',
        message: 'VAT registration status must be a boolean',
        messageTr: 'KDV kayıt durumu boolean olmalıdır'
      });
    }
  }

  // VAT number validation (optional)
  if (vatNumber !== undefined && vatNumber !== null && vatNumber !== '') {
    if (typeof vatNumber !== 'string') {
      errors.push({
        field: 'vatNumber',
        message: 'VAT number must be a string',
        messageTr: 'KDV numarası metin olmalıdır'
      });
    } else {
      // UK VAT number format: GB followed by 9 or 12 digits
      const cleanedVat = vatNumber.replace(/\s/g, '').toUpperCase();
      if (!UK_VAT_REGEX.test(cleanedVat)) {
        errors.push({
          field: 'vatNumber',
          message: 'Please enter a valid UK VAT number (e.g., GB123456789)',
          messageTr: 'Lütfen geçerli bir UK KDV numarası girin (örn. GB123456789)'
        });
      }
    }
  }

  // VAT scheme validation (optional)
  if (vatScheme !== undefined && vatScheme !== null && vatScheme !== '') {
    if (typeof vatScheme !== 'string') {
      errors.push({
        field: 'vatScheme',
        message: 'VAT scheme must be a string',
        messageTr: 'KDV planı metin olmalıdır'
      });
    } else if (!VALID_VAT_SCHEMES.includes(vatScheme)) {
      errors.push({
        field: 'vatScheme',
        message: `Invalid VAT scheme. Must be one of: ${VALID_VAT_SCHEMES.join(', ')}`,
        messageTr: `Geçersiz KDV planı. Şunlardan biri olmalıdır: ${VALID_VAT_SCHEMES.join(', ')}`
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Sanitizes VAT settings request body.
 * Normalizes VAT number format.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeVatSettings(req, res, next) {
  const body = req.body;

  // Normalize VAT number (remove spaces, uppercase)
  if (body.vatNumber && typeof body.vatNumber === 'string') {
    body.vatNumber = body.vatNumber.replace(/\s/g, '').toUpperCase();
  }

  // Normalize vatScheme (lowercase to match enum)
  if (body.vatScheme && typeof body.vatScheme === 'string') {
    body.vatScheme = body.vatScheme.toLowerCase();
  }

  next();
}

module.exports = {
  validateVatSettingsUpdate,
  sanitizeVatSettings,
  sendValidationError,
  UK_VAT_REGEX
};
