/**
 * Validation Middleware
 * Provides request validation middleware for authentication endpoints.
 * Uses the validator library for email validation and custom rules.
 * 
 * @module middleware/validation
 */

const validator = require('validator');
const { HTTP_STATUS, ERROR_CODES, createErrorResponse } = require('../utils/errorCodes');
const { PASSWORD_RULES } = require('../utils/password');

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
 * Validates registration request body.
 * Checks required fields and their formats.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateRegistration(req, res, next) {
  const errors = [];
  const { email, password, name, businessName, vatNumber, companyNumber, preferredLanguage } = req.body;

  // Email validation
  if (!email) {
    errors.push({
      field: 'email',
      message: 'Email is required',
      messageTr: 'E-posta adresi zorunludur'
    });
  } else if (typeof email !== 'string') {
    errors.push({
      field: 'email',
      message: 'Email must be a string',
      messageTr: 'E-posta adresi metin olmalıdır'
    });
  } else if (!validator.isEmail(email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address',
      messageTr: 'Lütfen geçerli bir e-posta adresi girin'
    });
  } else if (email.length > 255) {
    errors.push({
      field: 'email',
      message: 'Email must not exceed 255 characters',
      messageTr: 'E-posta adresi 255 karakteri geçmemelidir'
    });
  }

  // Password validation
  if (!password) {
    errors.push({
      field: 'password',
      message: 'Password is required',
      messageTr: 'Şifre zorunludur'
    });
  } else if (typeof password !== 'string') {
    errors.push({
      field: 'password',
      message: 'Password must be a string',
      messageTr: 'Şifre metin olmalıdır'
    });
  } else {
    if (password.length < PASSWORD_RULES.minLength) {
      errors.push({
        field: 'password',
        message: `Password must be at least ${PASSWORD_RULES.minLength} characters`,
        messageTr: `Şifre en az ${PASSWORD_RULES.minLength} karakter olmalıdır`
      });
    }

    if (password.length > PASSWORD_RULES.maxLength) {
      errors.push({
        field: 'password',
        message: `Password must not exceed ${PASSWORD_RULES.maxLength} characters`,
        messageTr: `Şifre ${PASSWORD_RULES.maxLength} karakteri geçmemelidir`
      });
    }

    if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter',
        messageTr: 'Şifre en az bir büyük harf içermelidir'
      });
    }

    if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one lowercase letter',
        messageTr: 'Şifre en az bir küçük harf içermelidir'
      });
    }

    if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one number',
        messageTr: 'Şifre en az bir rakam içermelidir'
      });
    }
  }

  // Name validation
  if (!name) {
    errors.push({
      field: 'name',
      message: 'Name is required',
      messageTr: 'İsim zorunludur'
    });
  } else if (typeof name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Name must be a string',
      messageTr: 'İsim metin olmalıdır'
    });
  } else if (name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Name must be at least 2 characters long',
      messageTr: 'İsim en az 2 karakter olmalıdır'
    });
  } else if (name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Name must not exceed 255 characters',
      messageTr: 'İsim 255 karakteri geçmemelidir'
    });
  }

  // Optional field validations
  
  // Business name validation (optional)
  if (businessName !== undefined && businessName !== null && businessName !== '') {
    if (typeof businessName !== 'string') {
      errors.push({
        field: 'businessName',
        message: 'Business name must be a string',
        messageTr: 'İşletme adı metin olmalıdır'
      });
    } else if (businessName.length > 255) {
      errors.push({
        field: 'businessName',
        message: 'Business name must not exceed 255 characters',
        messageTr: 'İşletme adı 255 karakteri geçmemelidir'
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
      const vatRegex = /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/;
      if (!vatRegex.test(cleanedVat)) {
        errors.push({
          field: 'vatNumber',
          message: 'Please enter a valid UK VAT number (e.g., GB123456789)',
          messageTr: 'Lütfen geçerli bir UK KDV numarası girin (örn. GB123456789)'
        });
      }
    }
  }

  // Company number validation (optional)
  if (companyNumber !== undefined && companyNumber !== null && companyNumber !== '') {
    if (typeof companyNumber !== 'string') {
      errors.push({
        field: 'companyNumber',
        message: 'Company number must be a string',
        messageTr: 'Şirket numarası metin olmalıdır'
      });
    } else {
      // UK company number format: 8 alphanumeric characters
      const cleanedCompany = companyNumber.replace(/\s/g, '').toUpperCase();
      const companyRegex = /^[A-Z0-9]{8}$/;
      if (!companyRegex.test(cleanedCompany)) {
        errors.push({
          field: 'companyNumber',
          message: 'Please enter a valid UK company number (8 alphanumeric characters)',
          messageTr: 'Lütfen geçerli bir UK şirket numarası girin (8 alfanümerik karakter)'
        });
      }
    }
  }

  // Preferred language validation (optional)
  if (preferredLanguage !== undefined && preferredLanguage !== null && preferredLanguage !== '') {
    if (typeof preferredLanguage !== 'string') {
      errors.push({
        field: 'preferredLanguage',
        message: 'Preferred language must be a string',
        messageTr: 'Tercih edilen dil metin olmalıdır'
      });
    } else if (!['en', 'tr'].includes(preferredLanguage)) {
      errors.push({
        field: 'preferredLanguage',
        message: 'Preferred language must be "en" or "tr"',
        messageTr: 'Tercih edilen dil "en" veya "tr" olmalıdır'
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates login request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateLogin(req, res, next) {
  const errors = [];
  const { email, password } = req.body;

  // Email validation
  if (!email) {
    errors.push({
      field: 'email',
      message: 'Email is required',
      messageTr: 'E-posta adresi zorunludur'
    });
  } else if (typeof email !== 'string') {
    errors.push({
      field: 'email',
      message: 'Email must be a string',
      messageTr: 'E-posta adresi metin olmalıdır'
    });
  } else if (!validator.isEmail(email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address',
      messageTr: 'Lütfen geçerli bir e-posta adresi girin'
    });
  }

  // Password validation
  if (!password) {
    errors.push({
      field: 'password',
      message: 'Password is required',
      messageTr: 'Şifre zorunludur'
    });
  } else if (typeof password !== 'string') {
    errors.push({
      field: 'password',
      message: 'Password must be a string',
      messageTr: 'Şifre metin olmalıdır'
    });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Sanitizes registration request body.
 * Trims strings and normalizes values.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeRegistration(req, res, next) {
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }
  
  if (req.body.name) {
    req.body.name = req.body.name.trim();
  }
  
  if (req.body.businessName) {
    req.body.businessName = req.body.businessName.trim();
  }
  
  if (req.body.businessAddress) {
    req.body.businessAddress = req.body.businessAddress.trim();
  }
  
  if (req.body.vatNumber) {
    req.body.vatNumber = req.body.vatNumber.replace(/\s/g, '').toUpperCase();
  }
  
  if (req.body.companyNumber) {
    req.body.companyNumber = req.body.companyNumber.replace(/\s/g, '').toUpperCase();
  }

  next();
}

/**
 * Sanitizes login request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeLogin(req, res, next) {
  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  sanitizeRegistration,
  sanitizeLogin,
  sendValidationError
};
