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
const { verifyToken } = require('../utils/jwt');
const { findById: findUserById, sanitizeUser } = require('../database/models/User');
const BankAccount = require('../database/models/BankAccount');

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

/**
 * UK VAT number regex pattern.
 * Matches:
 * - GB followed by 9 or 12 digits
 * - GBGD followed by 3 digits (government departments)
 * - GBHA followed by 3 digits (health authorities)
 * - Generic EU format: 2 letters + 2-12 alphanumeric
 */
const UK_VAT_REGEX = /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$|^[A-Z]{2}[A-Z0-9]{2,12}$/i;

/**
 * UK Company number regex pattern.
 * Matches 8 alphanumeric characters.
 */
const UK_COMPANY_REGEX = /^[A-Z0-9]{8}$/i;

/**
 * UK Postcode regex pattern.
 */
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;

/**
 * Valid customer statuses.
 */
const CUSTOMER_STATUSES = ['active', 'inactive', 'archived'];

/**
 * Valid currencies.
 */
const VALID_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * Validates customer creation request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateCustomerCreate(req, res, next) {
  const errors = [];
  const { name, email, phone, website, vatNumber, companyNumber, postcode, country, paymentTerms, creditLimit, currency, status } = req.body;

  // Name validation (required)
  if (!name) {
    errors.push({
      field: 'name',
      message: 'Customer name is required',
      messageTr: 'Müşteri adı zorunludur'
    });
  } else if (typeof name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Customer name must be a string',
      messageTr: 'Müşteri adı metin olmalıdır'
    });
  } else if (name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Customer name must be at least 2 characters long',
      messageTr: 'Müşteri adı en az 2 karakter olmalıdır'
    });
  } else if (name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Customer name must not exceed 255 characters',
      messageTr: 'Müşteri adı 255 karakteri geçmemelidir'
    });
  }

  // Email validation (optional)
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      errors.push({
        field: 'email',
        message: 'Email must be a string',
        messageTr: 'E-posta metin olmalıdır'
      });
    } else if (!validator.isEmail(email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address',
        messageTr: 'Lütfen geçerli bir e-posta adresi girin'
      });
    }
  }

  // Phone validation (optional, basic check)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string') {
      errors.push({
        field: 'phone',
        message: 'Phone must be a string',
        messageTr: 'Telefon metin olmalıdır'
      });
    } else {
      const cleanedPhone = phone.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{7,15}$/.test(cleanedPhone)) {
        errors.push({
          field: 'phone',
          message: 'Please enter a valid phone number',
          messageTr: 'Lütfen geçerli bir telefon numarası girin'
        });
      }
    }
  }

  // Website validation (optional)
  if (website !== undefined && website !== null && website !== '') {
    if (typeof website !== 'string') {
      errors.push({
        field: 'website',
        message: 'Website must be a string',
        messageTr: 'Web sitesi metin olmalıdır'
      });
    } else if (!validator.isURL(website, { require_protocol: false })) {
      errors.push({
        field: 'website',
        message: 'Please enter a valid website URL',
        messageTr: 'Lütfen geçerli bir web sitesi URL\'si girin'
      });
    }
  }

  // UK VAT number validation (optional)
  if (vatNumber !== undefined && vatNumber !== null && vatNumber !== '') {
    if (typeof vatNumber !== 'string') {
      errors.push({
        field: 'vatNumber',
        message: 'VAT number must be a string',
        messageTr: 'KDV numarası metin olmalıdır'
      });
    } else {
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

  // Company number validation (optional)
  if (companyNumber !== undefined && companyNumber !== null && companyNumber !== '') {
    if (typeof companyNumber !== 'string') {
      errors.push({
        field: 'companyNumber',
        message: 'Company number must be a string',
        messageTr: 'Şirket numarası metin olmalıdır'
      });
    } else {
      const cleanedCompany = companyNumber.replace(/\s/g, '').toUpperCase();
      if (!UK_COMPANY_REGEX.test(cleanedCompany)) {
        errors.push({
          field: 'companyNumber',
          message: 'Please enter a valid UK company number (8 alphanumeric characters)',
          messageTr: 'Lütfen geçerli bir UK şirket numarası girin (8 alfanümerik karakter)'
        });
      }
    }
  }

  // UK Postcode validation (optional, only for UK)
  if (postcode !== undefined && postcode !== null && postcode !== '') {
    if (typeof postcode !== 'string') {
      errors.push({
        field: 'postcode',
        message: 'Postcode must be a string',
        messageTr: 'Posta kodu metin olmalıdır'
      });
    } else if (!country || country.toUpperCase() === 'GB') {
      const cleanedPostcode = postcode.replace(/\s/g, '').toUpperCase();
      if (!UK_POSTCODE_REGEX.test(cleanedPostcode)) {
        errors.push({
          field: 'postcode',
          message: 'Please enter a valid UK postcode (e.g., SW1A 1AA)',
          messageTr: 'Lütfen geçerli bir UK posta kodu girin (örn. SW1A 1AA)'
        });
      }
    }
  }

  // Payment terms validation (optional)
  if (paymentTerms !== undefined && paymentTerms !== null) {
    if (typeof paymentTerms !== 'number' || !Number.isInteger(paymentTerms)) {
      errors.push({
        field: 'paymentTerms',
        message: 'Payment terms must be an integer',
        messageTr: 'Ödeme koşulları bir tam sayı olmalıdır'
      });
    } else if (paymentTerms < 0 || paymentTerms > 365) {
      errors.push({
        field: 'paymentTerms',
        message: 'Payment terms must be between 0 and 365 days',
        messageTr: 'Ödeme koşulları 0 ile 365 gün arasında olmalıdır'
      });
    }
  }

  // Credit limit validation (optional)
  if (creditLimit !== undefined && creditLimit !== null) {
    if (typeof creditLimit !== 'number' || !Number.isInteger(creditLimit)) {
      errors.push({
        field: 'creditLimit',
        message: 'Credit limit must be an integer (in pence)',
        messageTr: 'Kredi limiti tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (creditLimit < 0) {
      errors.push({
        field: 'creditLimit',
        message: 'Credit limit cannot be negative',
        messageTr: 'Kredi limiti negatif olamaz'
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (typeof currency !== 'string') {
      errors.push({
        field: 'currency',
        message: 'Currency must be a string',
        messageTr: 'Para birimi metin olmalıdır'
      });
    } else if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${VALID_CURRENCIES.join(', ')}`
      });
    }
  }

  // Status validation (optional)
  if (status !== undefined && status !== null && status !== '') {
    if (typeof status !== 'string') {
      errors.push({
        field: 'status',
        message: 'Status must be a string',
        messageTr: 'Durum metin olmalıdır'
      });
    } else if (!CUSTOMER_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${CUSTOMER_STATUSES.join(', ')}`,
        messageTr: `Durum şunlardan biri olmalıdır: ${CUSTOMER_STATUSES.join(', ')}`
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates customer update request body.
 * Less strict than create - doesn't require name.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateCustomerUpdate(req, res, next) {
  const errors = [];
  const { name, email, phone, website, vatNumber, companyNumber, postcode, country, paymentTerms, creditLimit, currency, status } = req.body;

  // Name validation (optional on update, but if provided must be valid)
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Customer name must be a string',
        messageTr: 'Müşteri adı metin olmalıdır'
      });
    } else if (name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'Customer name must be at least 2 characters long',
        messageTr: 'Müşteri adı en az 2 karakter olmalıdır'
      });
    } else if (name.length > 255) {
      errors.push({
        field: 'name',
        message: 'Customer name must not exceed 255 characters',
        messageTr: 'Müşteri adı 255 karakteri geçmemelidir'
      });
    }
  }

  // Email validation (optional)
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      errors.push({
        field: 'email',
        message: 'Email must be a string',
        messageTr: 'E-posta metin olmalıdır'
      });
    } else if (!validator.isEmail(email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address',
        messageTr: 'Lütfen geçerli bir e-posta adresi girin'
      });
    }
  }

  // Phone validation (optional)
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string') {
      errors.push({
        field: 'phone',
        message: 'Phone must be a string',
        messageTr: 'Telefon metin olmalıdır'
      });
    } else {
      const cleanedPhone = phone.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{7,15}$/.test(cleanedPhone)) {
        errors.push({
          field: 'phone',
          message: 'Please enter a valid phone number',
          messageTr: 'Lütfen geçerli bir telefon numarası girin'
        });
      }
    }
  }

  // Website validation (optional)
  if (website !== undefined && website !== null && website !== '') {
    if (typeof website !== 'string') {
      errors.push({
        field: 'website',
        message: 'Website must be a string',
        messageTr: 'Web sitesi metin olmalıdır'
      });
    } else if (!validator.isURL(website, { require_protocol: false })) {
      errors.push({
        field: 'website',
        message: 'Please enter a valid website URL',
        messageTr: 'Lütfen geçerli bir web sitesi URL\'si girin'
      });
    }
  }

  // UK VAT number validation (optional)
  if (vatNumber !== undefined && vatNumber !== null && vatNumber !== '') {
    if (typeof vatNumber !== 'string') {
      errors.push({
        field: 'vatNumber',
        message: 'VAT number must be a string',
        messageTr: 'KDV numarası metin olmalıdır'
      });
    } else {
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

  // Company number validation (optional)
  if (companyNumber !== undefined && companyNumber !== null && companyNumber !== '') {
    if (typeof companyNumber !== 'string') {
      errors.push({
        field: 'companyNumber',
        message: 'Company number must be a string',
        messageTr: 'Şirket numarası metin olmalıdır'
      });
    } else {
      const cleanedCompany = companyNumber.replace(/\s/g, '').toUpperCase();
      if (!UK_COMPANY_REGEX.test(cleanedCompany)) {
        errors.push({
          field: 'companyNumber',
          message: 'Please enter a valid UK company number (8 alphanumeric characters)',
          messageTr: 'Lütfen geçerli bir UK şirket numarası girin (8 alfanümerik karakter)'
        });
      }
    }
  }

  // UK Postcode validation (optional)
  if (postcode !== undefined && postcode !== null && postcode !== '') {
    if (typeof postcode !== 'string') {
      errors.push({
        field: 'postcode',
        message: 'Postcode must be a string',
        messageTr: 'Posta kodu metin olmalıdır'
      });
    } else if (!country || country.toUpperCase() === 'GB') {
      const cleanedPostcode = postcode.replace(/\s/g, '').toUpperCase();
      if (!UK_POSTCODE_REGEX.test(cleanedPostcode)) {
        errors.push({
          field: 'postcode',
          message: 'Please enter a valid UK postcode (e.g., SW1A 1AA)',
          messageTr: 'Lütfen geçerli bir UK posta kodu girin (örn. SW1A 1AA)'
        });
      }
    }
  }

  // Payment terms validation (optional)
  if (paymentTerms !== undefined && paymentTerms !== null) {
    if (typeof paymentTerms !== 'number' || !Number.isInteger(paymentTerms)) {
      errors.push({
        field: 'paymentTerms',
        message: 'Payment terms must be an integer',
        messageTr: 'Ödeme koşulları bir tam sayı olmalıdır'
      });
    } else if (paymentTerms < 0 || paymentTerms > 365) {
      errors.push({
        field: 'paymentTerms',
        message: 'Payment terms must be between 0 and 365 days',
        messageTr: 'Ödeme koşulları 0 ile 365 gün arasında olmalıdır'
      });
    }
  }

  // Credit limit validation (optional)
  if (creditLimit !== undefined && creditLimit !== null) {
    if (typeof creditLimit !== 'number' || !Number.isInteger(creditLimit)) {
      errors.push({
        field: 'creditLimit',
        message: 'Credit limit must be an integer (in pence)',
        messageTr: 'Kredi limiti tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (creditLimit < 0) {
      errors.push({
        field: 'creditLimit',
        message: 'Credit limit cannot be negative',
        messageTr: 'Kredi limiti negatif olamaz'
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (typeof currency !== 'string') {
      errors.push({
        field: 'currency',
        message: 'Currency must be a string',
        messageTr: 'Para birimi metin olmalıdır'
      });
    } else if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${VALID_CURRENCIES.join(', ')}`
      });
    }
  }

  // Status validation (optional)
  if (status !== undefined && status !== null && status !== '') {
    if (typeof status !== 'string') {
      errors.push({
        field: 'status',
        message: 'Status must be a string',
        messageTr: 'Durum metin olmalıdır'
      });
    } else if (!CUSTOMER_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${CUSTOMER_STATUSES.join(', ')}`,
        messageTr: `Durum şunlardan biri olmalıdır: ${CUSTOMER_STATUSES.join(', ')}`
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Sanitizes customer request body.
 * Trims strings and normalizes values.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeCustomer(req, res, next) {
  const body = req.body;

  // Trim string fields
  const stringFields = [
    'name', 'tradingName', 'addressLine1', 'addressLine2', 'city', 'county',
    'deliveryAddressLine1', 'deliveryAddressLine2', 'deliveryCity', 'deliveryCounty',
    'contactName', 'notes', 'customerNumber'
  ];

  for (const field of stringFields) {
    if (body[field] && typeof body[field] === 'string') {
      body[field] = body[field].trim();
    }
  }

  // Normalize email to lowercase
  if (body.email && typeof body.email === 'string') {
    body.email = body.email.toLowerCase().trim();
  }

  if (body.contactEmail && typeof body.contactEmail === 'string') {
    body.contactEmail = body.contactEmail.toLowerCase().trim();
  }

  // Trim phone numbers
  if (body.phone && typeof body.phone === 'string') {
    body.phone = body.phone.trim();
  }

  if (body.contactPhone && typeof body.contactPhone === 'string') {
    body.contactPhone = body.contactPhone.trim();
  }

  // Trim website
  if (body.website && typeof body.website === 'string') {
    body.website = body.website.trim();
  }

  // Normalize VAT number (remove spaces, uppercase)
  if (body.vatNumber && typeof body.vatNumber === 'string') {
    body.vatNumber = body.vatNumber.replace(/\s/g, '').toUpperCase();
  }

  // Normalize company number (remove spaces, uppercase)
  if (body.companyNumber && typeof body.companyNumber === 'string') {
    body.companyNumber = body.companyNumber.replace(/\s/g, '').toUpperCase();
  }

  // Normalize postcodes (remove spaces, uppercase)
  if (body.postcode && typeof body.postcode === 'string') {
    body.postcode = body.postcode.replace(/\s/g, '').toUpperCase();
  }

  if (body.deliveryPostcode && typeof body.deliveryPostcode === 'string') {
    body.deliveryPostcode = body.deliveryPostcode.replace(/\s/g, '').toUpperCase();
  }

  // Normalize country codes (uppercase)
  if (body.country && typeof body.country === 'string') {
    body.country = body.country.toUpperCase();
  }

  if (body.deliveryCountry && typeof body.deliveryCountry === 'string') {
    body.deliveryCountry = body.deliveryCountry.toUpperCase();
  }

  // Normalize currency (uppercase)
  if (body.currency && typeof body.currency === 'string') {
    body.currency = body.currency.toUpperCase();
  }

  next();
}

/**
 * Valid invoice currencies.
 */
const INVOICE_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * Valid invoice statuses.
 */
const INVOICE_STATUSES = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'];

/**
 * Valid VAT rate identifiers.
 */
const VALID_VAT_RATE_IDS = ['standard', 'reduced', 'zero', 'exempt', 'outside-scope'];

/**
 * Validates invoice creation request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateInvoiceCreate(req, res, next) {
  const errors = [];
  const { customerId, invoiceDate, dueDate, taxPoint, notes, items, currency } = req.body;

  // Customer ID validation (required)
  if (customerId === undefined || customerId === null) {
    errors.push({
      field: 'customerId',
      message: 'Customer ID is required',
      messageTr: 'Müşteri ID zorunludur'
    });
  } else if (!Number.isInteger(customerId) || customerId <= 0) {
    errors.push({
      field: 'customerId',
      message: 'Customer ID must be a positive integer',
      messageTr: 'Müşteri ID pozitif bir tam sayı olmalıdır'
    });
  }

  // Invoice date validation (required)
  if (!invoiceDate) {
    errors.push({
      field: 'invoiceDate',
      message: 'Invoice date is required',
      messageTr: 'Fatura tarihi zorunludur'
    });
  } else if (typeof invoiceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    errors.push({
      field: 'invoiceDate',
      message: 'Invoice date must be in YYYY-MM-DD format',
      messageTr: 'Fatura tarihi YYYY-MM-DD formatında olmalıdır'
    });
  } else {
    const date = new Date(invoiceDate);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'invoiceDate',
        message: 'Invoice date is not a valid date',
        messageTr: 'Fatura tarihi geçerli bir tarih değil'
      });
    }
  }

  // Due date validation (required)
  if (!dueDate) {
    errors.push({
      field: 'dueDate',
      message: 'Due date is required',
      messageTr: 'Vade tarihi zorunludur'
    });
  } else if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    errors.push({
      field: 'dueDate',
      message: 'Due date must be in YYYY-MM-DD format',
      messageTr: 'Vade tarihi YYYY-MM-DD formatında olmalıdır'
    });
  } else {
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'dueDate',
        message: 'Due date is not a valid date',
        messageTr: 'Vade tarihi geçerli bir tarih değil'
      });
    }
  }

  // Cross-field validation: due date must be >= invoice date
  if (invoiceDate && dueDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const invDate = new Date(invoiceDate);
    const dueDateObj = new Date(dueDate);
    if (!isNaN(invDate.getTime()) && !isNaN(dueDateObj.getTime()) && dueDateObj < invDate) {
      errors.push({
        field: 'dueDate',
        message: 'Due date must be on or after the invoice date',
        messageTr: 'Vade tarihi fatura tarihinden sonra veya aynı olmalıdır'
      });
    }
  }

  // Tax point validation (optional, for UK VAT compliance)
  if (taxPoint !== undefined && taxPoint !== null && taxPoint !== '') {
    if (typeof taxPoint !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(taxPoint)) {
      errors.push({
        field: 'taxPoint',
        message: 'Tax point must be in YYYY-MM-DD format',
        messageTr: 'Vergi noktası YYYY-MM-DD formatında olmalıdır'
      });
    } else {
      const date = new Date(taxPoint);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'taxPoint',
          message: 'Tax point is not a valid date',
          messageTr: 'Vergi noktası geçerli bir tarih değil'
        });
      }
    }
  }

  // Notes validation (optional)
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        messageTr: 'Notlar metin olmalıdır'
      });
    } else if (notes.length > 5000) {
      errors.push({
        field: 'notes',
        message: 'Notes must not exceed 5000 characters',
        messageTr: 'Notlar 5000 karakteri geçmemelidir'
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (typeof currency !== 'string') {
      errors.push({
        field: 'currency',
        message: 'Currency must be a string',
        messageTr: 'Para birimi metin olmalıdır'
      });
    } else if (!INVOICE_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${INVOICE_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${INVOICE_CURRENCIES.join(', ')}`
      });
    }
  }

  // Items validation (required)
  if (!items) {
    errors.push({
      field: 'items',
      message: 'Invoice items are required',
      messageTr: 'Fatura kalemleri zorunludur'
    });
  } else if (!Array.isArray(items)) {
    errors.push({
      field: 'items',
      message: 'Items must be an array',
      messageTr: 'Kalemler bir dizi olmalıdır'
    });
  } else if (items.length === 0) {
    errors.push({
      field: 'items',
      message: 'At least one item is required',
      messageTr: 'En az bir kalem gereklidir'
    });
  } else if (items.length > 100) {
    errors.push({
      field: 'items',
      message: 'Maximum 100 items allowed per invoice',
      messageTr: 'Fatura başına en fazla 100 kalem izin verilir'
    });
  } else {
    // Validate each line item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const prefix = `items[${i}]`;

      // Description validation
      if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
        errors.push({
          field: `${prefix}.description`,
          message: 'Item description is required',
          messageTr: 'Kalem açıklaması zorunludur'
        });
      } else if (item.description.length > 1000) {
        errors.push({
          field: `${prefix}.description`,
          message: 'Item description must not exceed 1000 characters',
          messageTr: 'Kalem açıklaması 1000 karakteri geçmemelidir'
        });
      }

      // Quantity validation
      if (item.quantity !== undefined && item.quantity !== null && item.quantity !== '') {
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          errors.push({
            field: `${prefix}.quantity`,
            message: 'Quantity must be a positive number',
            messageTr: 'Miktar pozitif bir sayı olmalıdır'
          });
        }
      }

      // Unit price validation
      if (item.unitPrice === undefined || item.unitPrice === null) {
        errors.push({
          field: `${prefix}.unitPrice`,
          message: 'Unit price is required',
          messageTr: 'Birim fiyatı zorunludur'
        });
      } else if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
        errors.push({
          field: `${prefix}.unitPrice`,
          message: 'Unit price must be a non-negative integer (in pence)',
          messageTr: 'Birim fiyatı negatif olmayan bir tam sayı olmalıdır (peni cinsinden)'
        });
      }

      // VAT rate validation
      if (item.vatRate !== undefined && item.vatRate !== null) {
        if (typeof item.vatRate === 'string' && !VALID_VAT_RATE_IDS.includes(item.vatRate)) {
          errors.push({
            field: `${prefix}.vatRate`,
            message: `Invalid VAT rate. Must be one of: ${VALID_VAT_RATE_IDS.join(', ')} or a number`,
            messageTr: `Geçersiz KDV oranı. Şunlardan biri olmalıdır: ${VALID_VAT_RATE_IDS.join(', ')} veya bir sayı`
          });
        } else if (typeof item.vatRate === 'number' && (item.vatRate < 0 || item.vatRate > 100)) {
          errors.push({
            field: `${prefix}.vatRate`,
            message: 'VAT rate must be between 0 and 100',
            messageTr: 'KDV oranı 0 ile 100 arasında olmalıdır'
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Sanitizes invoice request body.
 * Trims strings and normalizes values.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeInvoice(req, res, next) {
  const body = req.body;

  // Trim and normalize notes
  if (body.notes && typeof body.notes === 'string') {
    body.notes = body.notes.trim();
  }

  // Normalize currency (uppercase)
  if (body.currency && typeof body.currency === 'string') {
    body.currency = body.currency.toUpperCase();
  }

  // Sanitize items
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (item.description && typeof item.description === 'string') {
        item.description = item.description.trim();
      }
    }
  }

  next();
}

/**
 * Validates invoice update request body.
 * Less strict than create - no required fields.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateInvoiceUpdate(req, res, next) {
  const errors = [];
  const { invoiceDate, dueDate, taxPoint, notes, items, currency } = req.body;

  // Invoice date validation (optional on update)
  if (invoiceDate !== undefined && invoiceDate !== null && invoiceDate !== '') {
    if (typeof invoiceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
      errors.push({
        field: 'invoiceDate',
        message: 'Invoice date must be in YYYY-MM-DD format',
        messageTr: 'Fatura tarihi YYYY-MM-DD formatında olmalıdır'
      });
    } else {
      const date = new Date(invoiceDate);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'invoiceDate',
          message: 'Invoice date is not a valid date',
          messageTr: 'Fatura tarihi geçerli bir tarih değil'
        });
      }
    }
  }

  // Due date validation (optional on update)
  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      errors.push({
        field: 'dueDate',
        message: 'Due date must be in YYYY-MM-DD format',
        messageTr: 'Vade tarihi YYYY-MM-DD formatında olmalıdır'
      });
    } else {
      const date = new Date(dueDate);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'dueDate',
          message: 'Due date is not a valid date',
          messageTr: 'Vade tarihi geçerli bir tarih değil'
        });
      }
    }
  }

  // Cross-field validation: due date must be >= invoice date (only if both provided)
  if (invoiceDate && dueDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const invDate = new Date(invoiceDate);
    const dueDateObj = new Date(dueDate);
    if (!isNaN(invDate.getTime()) && !isNaN(dueDateObj.getTime()) && dueDateObj < invDate) {
      errors.push({
        field: 'dueDate',
        message: 'Due date must be on or after the invoice date',
        messageTr: 'Vade tarihi fatura tarihinden sonra veya aynı olmalıdır'
      });
    }
  }

  // Tax point validation (optional)
  if (taxPoint !== undefined && taxPoint !== null && taxPoint !== '') {
    if (typeof taxPoint !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(taxPoint)) {
      errors.push({
        field: 'taxPoint',
        message: 'Tax point must be in YYYY-MM-DD format',
        messageTr: 'Vergi noktası YYYY-MM-DD formatında olmalıdır'
      });
    } else {
      const date = new Date(taxPoint);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'taxPoint',
          message: 'Tax point is not a valid date',
          messageTr: 'Vergi noktası geçerli bir tarih değil'
        });
      }
    }
  }

  // Notes validation (optional)
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        messageTr: 'Notlar metin olmalıdır'
      });
    } else if (notes.length > 5000) {
      errors.push({
        field: 'notes',
        message: 'Notes must not exceed 5000 characters',
        messageTr: 'Notlar 5000 karakteri geçmemelidir'
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (typeof currency !== 'string') {
      errors.push({
        field: 'currency',
        message: 'Currency must be a string',
        messageTr: 'Para birimi metin olmalıdır'
      });
    } else if (!INVOICE_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${INVOICE_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${INVOICE_CURRENCIES.join(', ')}`
      });
    }
  }

  // Items validation (optional on update, but if provided must be valid)
  if (items !== undefined && items !== null) {
    if (!Array.isArray(items)) {
      errors.push({
        field: 'items',
        message: 'Items must be an array',
        messageTr: 'Kalemler bir dizi olmalıdır'
      });
    } else if (items.length === 0) {
      errors.push({
        field: 'items',
        message: 'At least one item is required',
        messageTr: 'En az bir kalem gereklidir'
      });
    } else if (items.length > 100) {
      errors.push({
        field: 'items',
        message: 'Maximum 100 items allowed per invoice',
        messageTr: 'Fatura başına en fazla 100 kalem izin verilir'
      });
    } else {
      // Validate each line item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const prefix = `items[${i}]`;

        // Description validation
        if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
          errors.push({
            field: `${prefix}.description`,
            message: 'Item description is required',
            messageTr: 'Kalem açıklaması zorunludur'
          });
        } else if (item.description.length > 1000) {
          errors.push({
            field: `${prefix}.description`,
            message: 'Item description must not exceed 1000 characters',
            messageTr: 'Kalem açıklaması 1000 karakteri geçmemelidir'
          });
        }

        // Quantity validation
        if (item.quantity !== undefined && item.quantity !== null && item.quantity !== '') {
          const qty = parseFloat(item.quantity);
          if (isNaN(qty) || qty <= 0) {
            errors.push({
              field: `${prefix}.quantity`,
              message: 'Quantity must be a positive number',
              messageTr: 'Miktar pozitif bir sayı olmalıdır'
            });
          }
        }

        // Unit price validation
        if (item.unitPrice === undefined || item.unitPrice === null) {
          errors.push({
            field: `${prefix}.unitPrice`,
            message: 'Unit price is required',
            messageTr: 'Birim fiyatı zorunludur'
          });
        } else if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
          errors.push({
            field: `${prefix}.unitPrice`,
            message: 'Unit price must be a non-negative integer (in pence)',
            messageTr: 'Birim fiyatı negatif olmayan bir tam sayı olmalıdır (peni cinsinden)'
          });
        }

        // VAT rate validation
        if (item.vatRate !== undefined && item.vatRate !== null) {
          if (typeof item.vatRate === 'string' && !VALID_VAT_RATE_IDS.includes(item.vatRate)) {
            errors.push({
              field: `${prefix}.vatRate`,
              message: `Invalid VAT rate. Must be one of: ${VALID_VAT_RATE_IDS.join(', ')} or a number`,
              messageTr: `Geçersiz KDV oranı. Şunlardan biri olmalıdır: ${VALID_VAT_RATE_IDS.join(', ')} veya bir sayı`
            });
          } else if (typeof item.vatRate === 'number' && (item.vatRate < 0 || item.vatRate > 100)) {
            errors.push({
              field: `${prefix}.vatRate`,
              message: 'VAT rate must be between 0 and 100',
              messageTr: 'KDV oranı 0 ile 100 arasında olmalıdır'
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Valid languages for user profile.
 */
const VALID_LANGUAGES = ['en', 'tr'];

/**
 * Valid VAT accounting schemes recognized by HMRC.
 */
const VALID_VAT_SCHEMES = ['standard', 'flat_rate', 'cash', 'annual', 'retail'];

/**
 * Validates profile update request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateProfileUpdate(req, res, next) {
  const errors = [];
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

  // Name validation (optional on update, but if provided must be valid)
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string') {
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
  }

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

  // Business address validation (optional)
  if (businessAddress !== undefined && businessAddress !== null && businessAddress !== '') {
    if (typeof businessAddress !== 'string') {
      errors.push({
        field: 'businessAddress',
        message: 'Business address must be a string',
        messageTr: 'İşletme adresi metin olmalıdır'
      });
    } else if (businessAddress.length > 1000) {
      errors.push({
        field: 'businessAddress',
        message: 'Business address must not exceed 1000 characters',
        messageTr: 'İşletme adresi 1000 karakteri geçmemelidir'
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

  // Tax year start validation (optional)
  if (taxYearStart !== undefined && taxYearStart !== null && taxYearStart !== '') {
    if (typeof taxYearStart !== 'string') {
      errors.push({
        field: 'taxYearStart',
        message: 'Tax year start must be a string',
        messageTr: 'Vergi yılı başlangıcı metin olmalıdır'
      });
    } else {
      // Format: MM-DD
      const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      if (!dateRegex.test(taxYearStart)) {
        errors.push({
          field: 'taxYearStart',
          message: 'Tax year start must be in MM-DD format',
          messageTr: 'Vergi yılı başlangıcı MM-DD formatında olmalıdır'
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
    } else if (!VALID_LANGUAGES.includes(preferredLanguage)) {
      errors.push({
        field: 'preferredLanguage',
        message: 'Preferred language must be "en" or "tr"',
        messageTr: 'Tercih edilen dil "en" veya "tr" olmalıdır'
      });
    }
  }

  // Invoice prefix validation (optional)
  if (invoicePrefix !== undefined && invoicePrefix !== null && invoicePrefix !== '') {
    if (typeof invoicePrefix !== 'string') {
      errors.push({
        field: 'invoicePrefix',
        message: 'Invoice prefix must be a string',
        messageTr: 'Fatura öneki metin olmalıdır'
      });
    } else {
      const trimmedPrefix = invoicePrefix.trim();
      if (trimmedPrefix.length < 1) {
        errors.push({
          field: 'invoicePrefix',
          message: 'Invoice prefix must be at least 1 character long',
          messageTr: 'Fatura öneki en az 1 karakter olmalıdır'
        });
      } else if (trimmedPrefix.length > 20) {
        errors.push({
          field: 'invoicePrefix',
          message: 'Invoice prefix must not exceed 20 characters',
          messageTr: 'Fatura öneki 20 karakteri geçmemelidir'
        });
      } else {
        const prefixRegex = /^[A-Za-z0-9\-_]+$/;
        if (!prefixRegex.test(trimmedPrefix)) {
          errors.push({
            field: 'invoicePrefix',
            message: 'Invoice prefix can only contain letters, numbers, hyphens, and underscores',
            messageTr: 'Fatura öneki yalnızca harf, rakam, tire ve alt çizgi içerebilir'
          });
        }
      }
    }
  }

  // Next invoice number validation (optional)
  if (nextInvoiceNumber !== undefined && nextInvoiceNumber !== null) {
    if (typeof nextInvoiceNumber !== 'number' || !Number.isInteger(nextInvoiceNumber)) {
      errors.push({
        field: 'nextInvoiceNumber',
        message: 'Next invoice number must be an integer',
        messageTr: 'Sonraki fatura numarası bir tam sayı olmalıdır'
      });
    } else if (nextInvoiceNumber < 1) {
      errors.push({
        field: 'nextInvoiceNumber',
        message: 'Next invoice number must be at least 1',
        messageTr: 'Sonraki fatura numarası en az 1 olmalıdır'
      });
    }
  }

  // Currency validation (optional)
  const VALID_CURRENCIES_PROFILE = ['GBP', 'EUR', 'USD'];
  if (currency !== undefined && currency !== null && currency !== '') {
    if (typeof currency !== 'string') {
      errors.push({
        field: 'currency',
        message: 'Currency must be a string',
        messageTr: 'Para birimi metin olmalıdır'
      });
    } else if (!VALID_CURRENCIES_PROFILE.includes(currency)) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${VALID_CURRENCIES_PROFILE.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${VALID_CURRENCIES_PROFILE.join(', ')}`
      });
    }
  }

  // Date format validation (optional)
  const VALID_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
  if (dateFormat !== undefined && dateFormat !== null && dateFormat !== '') {
    if (typeof dateFormat !== 'string') {
      errors.push({
        field: 'dateFormat',
        message: 'Date format must be a string',
        messageTr: 'Tarih formatı metin olmalıdır'
      });
    } else if (!VALID_DATE_FORMATS.includes(dateFormat)) {
      errors.push({
        field: 'dateFormat',
        message: `Date format must be one of: ${VALID_DATE_FORMATS.join(', ')}`,
        messageTr: `Tarih formatı şunlardan biri olmalıdır: ${VALID_DATE_FORMATS.join(', ')}`
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Sanitizes profile update request body.
 * Trims strings and normalizes values.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeProfileUpdate(req, res, next) {
  const body = req.body;

  // Trim name
  if (body.name && typeof body.name === 'string') {
    body.name = body.name.trim();
  }

  // Trim business name
  if (body.businessName && typeof body.businessName === 'string') {
    body.businessName = body.businessName.trim();
  }

  // Trim business address
  if (body.businessAddress && typeof body.businessAddress === 'string') {
    body.businessAddress = body.businessAddress.trim();
  }

  // Normalize VAT number (remove spaces, uppercase)
  if (body.vatNumber && typeof body.vatNumber === 'string') {
    body.vatNumber = body.vatNumber.replace(/\s/g, '').toUpperCase();
  }

  // Normalize vatScheme (lowercase to match enum)
  if (body.vatScheme && typeof body.vatScheme === 'string') {
    body.vatScheme = body.vatScheme.toLowerCase();
  }

  // Normalize company number (remove spaces, uppercase)
  if (body.companyNumber && typeof body.companyNumber === 'string') {
    body.companyNumber = body.companyNumber.replace(/\s/g, '').toUpperCase();
  }

  // Normalize invoice prefix (trim and uppercase)
  if (body.invoicePrefix && typeof body.invoicePrefix === 'string') {
    body.invoicePrefix = body.invoicePrefix.trim().toUpperCase();
  }

  next();
}

/**
 * Valid transaction types.
 */
const TRANSACTION_TYPES = ['income', 'expense', 'transfer'];

/**
 * Valid transaction statuses.
 */
const TRANSACTION_STATUSES = ['pending', 'cleared', 'reconciled', 'void'];

/**
 * Valid payment methods.
 */
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'direct_debit', 'standing_order', 'other'];

/**
 * Valid recurring frequencies.
 */
const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'yearly'];

/**
 * Validates transaction creation request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateTransactionCreate(req, res, next) {
  const errors = [];
  const {
    categoryId,
    type,
    status,
    transactionDate,
    description,
    reference,
    amount,
    vatRate,
    vatAmount,
    totalAmount,
    currency,
    paymentMethod,
    payee,
    receiptPath,
    notes,
    isRecurring,
    recurringFrequency,
    linkedTransactionId
  } = req.body;

  // Type validation (required)
  if (!type) {
    errors.push({
      field: 'type',
      message: 'Transaction type is required',
      messageTr: 'İşlem tipi zorunludur'
    });
  } else if (typeof type !== 'string') {
    errors.push({
      field: 'type',
      message: 'Transaction type must be a string',
      messageTr: 'İşlem tipi metin olmalıdır'
    });
  } else if (!TRANSACTION_TYPES.includes(type)) {
    errors.push({
      field: 'type',
      message: `Transaction type must be one of: ${TRANSACTION_TYPES.join(', ')}`,
      messageTr: `İşlem tipi şunlardan biri olmalıdır: ${TRANSACTION_TYPES.join(', ')}`
    });
  }

  // Transaction date validation (required)
  if (!transactionDate) {
    errors.push({
      field: 'transactionDate',
      message: 'Transaction date is required',
      messageTr: 'İşlem tarihi zorunludur'
    });
  } else if (typeof transactionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    errors.push({
      field: 'transactionDate',
      message: 'Transaction date must be in YYYY-MM-DD format',
      messageTr: 'İşlem tarihi YYYY-MM-DD formatında olmalıdır'
    });
  } else {
    const date = new Date(transactionDate);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'transactionDate',
        message: 'Transaction date is not a valid date',
        messageTr: 'İşlem tarihi geçerli bir tarih değil'
      });
    }
  }

  // Description validation (required)
  if (!description) {
    errors.push({
      field: 'description',
      message: 'Description is required',
      messageTr: 'Açıklama zorunludur'
    });
  } else if (typeof description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Description must be a string',
      messageTr: 'Açıklama metin olmalıdır'
    });
  } else if (description.trim().length < 2) {
    errors.push({
      field: 'description',
      message: 'Description must be at least 2 characters long',
      messageTr: 'Açıklama en az 2 karakter olmalıdır'
    });
  } else if (description.length > 500) {
    errors.push({
      field: 'description',
      message: 'Description must not exceed 500 characters',
      messageTr: 'Açıklama 500 karakteri geçmemelidir'
    });
  }

  // Category ID validation (optional)
  if (categoryId !== undefined && categoryId !== null) {
    if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId <= 0) {
      errors.push({
        field: 'categoryId',
        message: 'Category ID must be a positive integer',
        messageTr: 'Kategori ID pozitif bir tam sayı olmalıdır'
      });
    }
  }

  // Status validation (optional)
  if (status !== undefined && status !== null && status !== '') {
    if (!TRANSACTION_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${TRANSACTION_STATUSES.join(', ')}`,
        messageTr: `Durum şunlardan biri olmalıdır: ${TRANSACTION_STATUSES.join(', ')}`
      });
    }
  }

  // Amount validation (optional, but should be non-negative integer in pence)
  if (amount !== undefined && amount !== null) {
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      errors.push({
        field: 'amount',
        message: 'Amount must be an integer (in pence)',
        messageTr: 'Tutar tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (amount < 0) {
      errors.push({
        field: 'amount',
        message: 'Amount cannot be negative',
        messageTr: 'Tutar negatif olamaz'
      });
    }
  }

  // VAT rate validation (optional, in basis points 0-10000)
  if (vatRate !== undefined && vatRate !== null) {
    if (typeof vatRate !== 'number' || !Number.isInteger(vatRate)) {
      errors.push({
        field: 'vatRate',
        message: 'VAT rate must be an integer (in basis points)',
        messageTr: 'KDV oranı tam sayı olmalıdır (baz puan cinsinden)'
      });
    } else if (vatRate < 0 || vatRate > 10000) {
      errors.push({
        field: 'vatRate',
        message: 'VAT rate must be between 0 and 10000 (0% to 100%)',
        messageTr: 'KDV oranı 0 ile 10000 arasında olmalıdır (%0 ile %100)'
      });
    }
  }

  // VAT amount validation (optional)
  if (vatAmount !== undefined && vatAmount !== null) {
    if (typeof vatAmount !== 'number' || !Number.isInteger(vatAmount)) {
      errors.push({
        field: 'vatAmount',
        message: 'VAT amount must be an integer (in pence)',
        messageTr: 'KDV tutarı tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (vatAmount < 0) {
      errors.push({
        field: 'vatAmount',
        message: 'VAT amount cannot be negative',
        messageTr: 'KDV tutarı negatif olamaz'
      });
    }
  }

  // Total amount validation (optional)
  if (totalAmount !== undefined && totalAmount !== null) {
    if (typeof totalAmount !== 'number' || !Number.isInteger(totalAmount)) {
      errors.push({
        field: 'totalAmount',
        message: 'Total amount must be an integer (in pence)',
        messageTr: 'Toplam tutar tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (totalAmount < 0) {
      errors.push({
        field: 'totalAmount',
        message: 'Total amount cannot be negative',
        messageTr: 'Toplam tutar negatif olamaz'
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${VALID_CURRENCIES.join(', ')}`
      });
    }
  }

  // Payment method validation (optional)
  if (paymentMethod !== undefined && paymentMethod !== null && paymentMethod !== '') {
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      errors.push({
        field: 'paymentMethod',
        message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`,
        messageTr: `Ödeme yöntemi şunlardan biri olmalıdır: ${PAYMENT_METHODS.join(', ')}`
      });
    }
  }

  // Reference validation (optional)
  if (reference !== undefined && reference !== null && reference !== '') {
    if (typeof reference !== 'string') {
      errors.push({
        field: 'reference',
        message: 'Reference must be a string',
        messageTr: 'Referans metin olmalıdır'
      });
    } else if (reference.length > 100) {
      errors.push({
        field: 'reference',
        message: 'Reference must not exceed 100 characters',
        messageTr: 'Referans 100 karakteri geçmemelidir'
      });
    }
  }

  // Payee validation (optional)
  if (payee !== undefined && payee !== null && payee !== '') {
    if (typeof payee !== 'string') {
      errors.push({
        field: 'payee',
        message: 'Payee must be a string',
        messageTr: 'Alıcı metin olmalıdır'
      });
    } else if (payee.length > 255) {
      errors.push({
        field: 'payee',
        message: 'Payee must not exceed 255 characters',
        messageTr: 'Alıcı 255 karakteri geçmemelidir'
      });
    }
  }

  // Receipt path validation (optional)
  if (receiptPath !== undefined && receiptPath !== null && receiptPath !== '') {
    if (typeof receiptPath !== 'string') {
      errors.push({
        field: 'receiptPath',
        message: 'Receipt path must be a string',
        messageTr: 'Makbuz yolu metin olmalıdır'
      });
    } else if (receiptPath.length > 500) {
      errors.push({
        field: 'receiptPath',
        message: 'Receipt path must not exceed 500 characters',
        messageTr: 'Makbuz yolu 500 karakteri geçmemelidir'
      });
    }
  }

  // Notes validation (optional)
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        messageTr: 'Notlar metin olmalıdır'
      });
    } else if (notes.length > 2000) {
      errors.push({
        field: 'notes',
        message: 'Notes must not exceed 2000 characters',
        messageTr: 'Notlar 2000 karakteri geçmemelidir'
      });
    }
  }

  // isRecurring validation (optional)
  if (isRecurring !== undefined && isRecurring !== null) {
    if (typeof isRecurring !== 'boolean') {
      errors.push({
        field: 'isRecurring',
        message: 'isRecurring must be a boolean',
        messageTr: 'isRecurring boolean olmalıdır'
      });
    }
  }

  // Recurring frequency validation (required if isRecurring is true)
  if (isRecurring === true && (!recurringFrequency || recurringFrequency === '')) {
    errors.push({
      field: 'recurringFrequency',
      message: 'Recurring frequency is required when isRecurring is true',
      messageTr: 'isRecurring true olduğunda tekrar sıklığı zorunludur'
    });
  } else if (recurringFrequency !== undefined && recurringFrequency !== null && recurringFrequency !== '') {
    if (!RECURRING_FREQUENCIES.includes(recurringFrequency)) {
      errors.push({
        field: 'recurringFrequency',
        message: `Recurring frequency must be one of: ${RECURRING_FREQUENCIES.join(', ')}`,
        messageTr: `Tekrar sıklığı şunlardan biri olmalıdır: ${RECURRING_FREQUENCIES.join(', ')}`
      });
    }
  }

  // Linked transaction ID validation (optional)
  if (linkedTransactionId !== undefined && linkedTransactionId !== null) {
    if (typeof linkedTransactionId !== 'number' || !Number.isInteger(linkedTransactionId) || linkedTransactionId <= 0) {
      errors.push({
        field: 'linkedTransactionId',
        message: 'Linked transaction ID must be a positive integer',
        messageTr: 'Bağlı işlem ID pozitif bir tam sayı olmalıdır'
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates transaction update request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateTransactionUpdate(req, res, next) {
  const errors = [];
  const {
    categoryId,
    type,
    status,
    transactionDate,
    description,
    reference,
    amount,
    vatRate,
    vatAmount,
    totalAmount,
    currency,
    paymentMethod,
    payee,
    receiptPath,
    notes,
    isRecurring,
    recurringFrequency,
    linkedTransactionId
  } = req.body;

  // Type validation (optional on update)
  if (type !== undefined && type !== null) {
    if (typeof type !== 'string') {
      errors.push({
        field: 'type',
        message: 'Transaction type must be a string',
        messageTr: 'İşlem tipi metin olmalıdır'
      });
    } else if (!TRANSACTION_TYPES.includes(type)) {
      errors.push({
        field: 'type',
        message: `Transaction type must be one of: ${TRANSACTION_TYPES.join(', ')}`,
        messageTr: `İşlem tipi şunlardan biri olmalıdır: ${TRANSACTION_TYPES.join(', ')}`
      });
    }
  }

  // Transaction date validation (optional on update)
  if (transactionDate !== undefined && transactionDate !== null) {
    if (typeof transactionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      errors.push({
        field: 'transactionDate',
        message: 'Transaction date must be in YYYY-MM-DD format',
        messageTr: 'İşlem tarihi YYYY-MM-DD formatında olmalıdır'
      });
    } else {
      const date = new Date(transactionDate);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'transactionDate',
          message: 'Transaction date is not a valid date',
          messageTr: 'İşlem tarihi geçerli bir tarih değil'
        });
      }
    }
  }

  // Description validation (optional on update)
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description must be a string',
        messageTr: 'Açıklama metin olmalıdır'
      });
    } else if (description.trim().length < 2) {
      errors.push({
        field: 'description',
        message: 'Description must be at least 2 characters long',
        messageTr: 'Açıklama en az 2 karakter olmalıdır'
      });
    } else if (description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Description must not exceed 500 characters',
        messageTr: 'Açıklama 500 karakteri geçmemelidir'
      });
    }
  }

  // Category ID validation (optional)
  if (categoryId !== undefined && categoryId !== null && categoryId !== 0) {
    if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId < 0) {
      errors.push({
        field: 'categoryId',
        message: 'Category ID must be a non-negative integer',
        messageTr: 'Kategori ID negatif olmayan bir tam sayı olmalıdır'
      });
    }
  }

  // Status validation (optional)
  if (status !== undefined && status !== null && status !== '') {
    if (!TRANSACTION_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${TRANSACTION_STATUSES.join(', ')}`,
        messageTr: `Durum şunlardan biri olmalıdır: ${TRANSACTION_STATUSES.join(', ')}`
      });
    }
  }

  // Amount validation (optional)
  if (amount !== undefined && amount !== null) {
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      errors.push({
        field: 'amount',
        message: 'Amount must be an integer (in pence)',
        messageTr: 'Tutar tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (amount < 0) {
      errors.push({
        field: 'amount',
        message: 'Amount cannot be negative',
        messageTr: 'Tutar negatif olamaz'
      });
    }
  }

  // VAT rate validation (optional)
  if (vatRate !== undefined && vatRate !== null) {
    if (typeof vatRate !== 'number' || !Number.isInteger(vatRate)) {
      errors.push({
        field: 'vatRate',
        message: 'VAT rate must be an integer (in basis points)',
        messageTr: 'KDV oranı tam sayı olmalıdır (baz puan cinsinden)'
      });
    } else if (vatRate < 0 || vatRate > 10000) {
      errors.push({
        field: 'vatRate',
        message: 'VAT rate must be between 0 and 10000 (0% to 100%)',
        messageTr: 'KDV oranı 0 ile 10000 arasında olmalıdır (%0 ile %100)'
      });
    }
  }

  // VAT amount validation (optional)
  if (vatAmount !== undefined && vatAmount !== null) {
    if (typeof vatAmount !== 'number' || !Number.isInteger(vatAmount)) {
      errors.push({
        field: 'vatAmount',
        message: 'VAT amount must be an integer (in pence)',
        messageTr: 'KDV tutarı tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (vatAmount < 0) {
      errors.push({
        field: 'vatAmount',
        message: 'VAT amount cannot be negative',
        messageTr: 'KDV tutarı negatif olamaz'
      });
    }
  }

  // Total amount validation (optional)
  if (totalAmount !== undefined && totalAmount !== null) {
    if (typeof totalAmount !== 'number' || !Number.isInteger(totalAmount)) {
      errors.push({
        field: 'totalAmount',
        message: 'Total amount must be an integer (in pence)',
        messageTr: 'Toplam tutar tam sayı olmalıdır (peni cinsinden)'
      });
    } else if (totalAmount < 0) {
      errors.push({
        field: 'totalAmount',
        message: 'Total amount cannot be negative',
        messageTr: 'Toplam tutar negatif olamaz'
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${VALID_CURRENCIES.join(', ')}`
      });
    }
  }

  // Payment method validation (optional)
  if (paymentMethod !== undefined && paymentMethod !== null && paymentMethod !== '') {
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      errors.push({
        field: 'paymentMethod',
        message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`,
        messageTr: `Ödeme yöntemi şunlardan biri olmalıdır: ${PAYMENT_METHODS.join(', ')}`
      });
    }
  }

  // Reference validation (optional)
  if (reference !== undefined && reference !== null && reference !== '') {
    if (typeof reference !== 'string') {
      errors.push({
        field: 'reference',
        message: 'Reference must be a string',
        messageTr: 'Referans metin olmalıdır'
      });
    } else if (reference.length > 100) {
      errors.push({
        field: 'reference',
        message: 'Reference must not exceed 100 characters',
        messageTr: 'Referans 100 karakteri geçmemelidir'
      });
    }
  }

  // Payee validation (optional)
  if (payee !== undefined && payee !== null && payee !== '') {
    if (typeof payee !== 'string') {
      errors.push({
        field: 'payee',
        message: 'Payee must be a string',
        messageTr: 'Alıcı metin olmalıdır'
      });
    } else if (payee.length > 255) {
      errors.push({
        field: 'payee',
        message: 'Payee must not exceed 255 characters',
        messageTr: 'Alıcı 255 karakteri geçmemelidir'
      });
    }
  }

  // Receipt path validation (optional)
  if (receiptPath !== undefined && receiptPath !== null && receiptPath !== '') {
    if (typeof receiptPath !== 'string') {
      errors.push({
        field: 'receiptPath',
        message: 'Receipt path must be a string',
        messageTr: 'Makbuz yolu metin olmalıdır'
      });
    } else if (receiptPath.length > 500) {
      errors.push({
        field: 'receiptPath',
        message: 'Receipt path must not exceed 500 characters',
        messageTr: 'Makbuz yolu 500 karakteri geçmemelidir'
      });
    }
  }

  // Notes validation (optional)
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        messageTr: 'Notlar metin olmalıdır'
      });
    } else if (notes.length > 2000) {
      errors.push({
        field: 'notes',
        message: 'Notes must not exceed 2000 characters',
        messageTr: 'Notlar 2000 karakteri geçmemelidir'
      });
    }
  }

  // isRecurring validation (optional)
  if (isRecurring !== undefined && isRecurring !== null) {
    if (typeof isRecurring !== 'boolean') {
      errors.push({
        field: 'isRecurring',
        message: 'isRecurring must be a boolean',
        messageTr: 'isRecurring boolean olmalıdır'
      });
    }
  }

  // Recurring frequency validation (optional)
  if (recurringFrequency !== undefined && recurringFrequency !== null && recurringFrequency !== '') {
    if (!RECURRING_FREQUENCIES.includes(recurringFrequency)) {
      errors.push({
        field: 'recurringFrequency',
        message: `Recurring frequency must be one of: ${RECURRING_FREQUENCIES.join(', ')}`,
        messageTr: `Tekrar sıklığı şunlardan biri olmalıdır: ${RECURRING_FREQUENCIES.join(', ')}`
      });
    }
  }

  // Linked transaction ID validation (optional)
  if (linkedTransactionId !== undefined && linkedTransactionId !== null && linkedTransactionId !== 0) {
    if (typeof linkedTransactionId !== 'number' || !Number.isInteger(linkedTransactionId) || linkedTransactionId < 0) {
      errors.push({
        field: 'linkedTransactionId',
        message: 'Linked transaction ID must be a non-negative integer',
        messageTr: 'Bağlı işlem ID negatif olmayan bir tam sayı olmalıdır'
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Sanitizes transaction request body.
 * Trims strings and normalizes values.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeTransaction(req, res, next) {
  const body = req.body;

  // Trim string fields
  const stringFields = ['description', 'reference', 'payee', 'receiptPath', 'notes'];

  for (const field of stringFields) {
    if (body[field] && typeof body[field] === 'string') {
      body[field] = body[field].trim();
    }
  }

  // Normalize currency (uppercase)
  if (body.currency && typeof body.currency === 'string') {
    body.currency = body.currency.toUpperCase();
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  sanitizeRegistration,
  sanitizeLogin,
  sendValidationError,
  // Customer validation
  validateCustomerCreate,
  validateCustomerUpdate,
  sanitizeCustomer,
  // Bank account validation
  validateCreateBankAccount,
  validateUpdateBankAccount,
  sanitizeBankAccountData,
  // Invoice validation
  validateInvoiceCreate,
  validateInvoiceUpdate,
  sanitizeInvoice,
  // Profile validation
  validateProfileUpdate,
  sanitizeProfileUpdate,
  // Transaction validation
  validateTransactionCreate,
  validateTransactionUpdate,
  sanitizeTransaction,
  // Authentication
  authenticateToken,
  // Constants
  UK_VAT_REGEX,
  UK_COMPANY_REGEX,
  UK_POSTCODE_REGEX,
  CUSTOMER_STATUSES,
  VALID_CURRENCIES,
  VALID_LANGUAGES,
  VALID_VAT_SCHEMES,
  INVOICE_CURRENCIES,
  INVOICE_STATUSES,
  VALID_VAT_RATE_IDS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES
};

/**
 * UK Sort Code regex pattern.
 * Format: 6 digits, optionally with hyphens (XX-XX-XX or XXXXXX)
 */
const SORT_CODE_REGEX = /^(\d{2})-?(\d{2})-?(\d{2})$/;

/**
 * UK Account Number regex pattern.
 * Format: 8 digits
 */
const ACCOUNT_NUMBER_REGEX = /^\d{8}$/;

/**
 * Validates UK sort code format.
 * 
 * @param {string} sortCode - Sort code to validate
 * @returns {boolean} True if valid
 */
function isValidSortCode(sortCode) {
  if (!sortCode) return false;
  const cleanedValue = sortCode.replace(/-/g, '');
  return /^\d{6}$/.test(cleanedValue);
}

/**
 * Validates UK account number format.
 * 
 * @param {string} accountNumber - Account number to validate
 * @returns {boolean} True if valid
 */
function isValidAccountNumber(accountNumber) {
  if (!accountNumber) return false;
  return ACCOUNT_NUMBER_REGEX.test(accountNumber);
}

/**
 * Authentication middleware to verify JWT token.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
        message: ERROR_CODES.AUTH_TOKEN_MISSING.message
      }
    });
  }

  const result = verifyToken(authHeader);
  
  if (!result.valid) {
    const errorCode = result.expired ? ERROR_CODES.AUTH_TOKEN_EXPIRED : ERROR_CODES.AUTH_TOKEN_INVALID;
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: errorCode.code,
        message: errorCode.message
      }
    });
  }

  // Get the full user from database
  const user = findUserById(result.payload.userId);
  if (!user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ERROR_CODES.RES_USER_NOT_FOUND.code,
        message: ERROR_CODES.RES_USER_NOT_FOUND.message
      }
    });
  }

  // Attach sanitized user to request
  req.user = sanitizeUser(user);
  next();
}

/**
 * Sanitizes bank account request body.
 * Trims strings and normalizes values.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function sanitizeBankAccountData(req, res, next) {
  if (req.body.accountName) {
    req.body.accountName = req.body.accountName.trim();
  }
  
  if (req.body.bankName) {
    req.body.bankName = req.body.bankName.trim();
  }
  
  if (req.body.sortCode) {
    // Keep hyphens for now, they'll be normalized in the model
    req.body.sortCode = req.body.sortCode.trim();
  }
  
  if (req.body.accountNumber) {
    req.body.accountNumber = req.body.accountNumber.trim();
  }
  
  if (req.body.iban) {
    req.body.iban = req.body.iban.replace(/\s/g, '').toUpperCase();
  }
  
  if (req.body.bic) {
    req.body.bic = req.body.bic.replace(/\s/g, '').toUpperCase();
  }
  
  if (req.body.currency) {
    req.body.currency = req.body.currency.toUpperCase();
  }
  
  if (req.body.notes) {
    req.body.notes = req.body.notes.trim();
  }

  next();
}

/**
 * Validates create bank account request body.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateCreateBankAccount(req, res, next) {
  const errors = [];
  const { accountName, bankName, sortCode, accountNumber, accountType, currency, openingBalance, iban, bic } = req.body;

  // Account name validation (required)
  if (!accountName) {
    errors.push({
      field: 'accountName',
      message: 'Account name is required',
      messageTr: 'Hesap adı zorunludur'
    });
  } else if (typeof accountName !== 'string') {
    errors.push({
      field: 'accountName',
      message: 'Account name must be a string',
      messageTr: 'Hesap adı metin olmalıdır'
    });
  } else if (accountName.trim().length < 2) {
    errors.push({
      field: 'accountName',
      message: 'Account name must be at least 2 characters long',
      messageTr: 'Hesap adı en az 2 karakter olmalıdır'
    });
  } else if (accountName.length > 255) {
    errors.push({
      field: 'accountName',
      message: 'Account name must not exceed 255 characters',
      messageTr: 'Hesap adı 255 karakteri geçmemelidir'
    });
  }

  // Bank name validation (required)
  if (!bankName) {
    errors.push({
      field: 'bankName',
      message: 'Bank name is required',
      messageTr: 'Banka adı zorunludur'
    });
  } else if (typeof bankName !== 'string') {
    errors.push({
      field: 'bankName',
      message: 'Bank name must be a string',
      messageTr: 'Banka adı metin olmalıdır'
    });
  } else if (bankName.trim().length < 2) {
    errors.push({
      field: 'bankName',
      message: 'Bank name must be at least 2 characters long',
      messageTr: 'Banka adı en az 2 karakter olmalıdır'
    });
  } else if (bankName.length > 255) {
    errors.push({
      field: 'bankName',
      message: 'Bank name must not exceed 255 characters',
      messageTr: 'Banka adı 255 karakteri geçmemelidir'
    });
  }

  // Sort code validation (required)
  if (!sortCode) {
    errors.push({
      field: 'sortCode',
      message: 'Sort code is required',
      messageTr: 'Sıralama kodu zorunludur'
    });
  } else if (typeof sortCode !== 'string') {
    errors.push({
      field: 'sortCode',
      message: 'Sort code must be a string',
      messageTr: 'Sıralama kodu metin olmalıdır'
    });
  } else if (!isValidSortCode(sortCode)) {
    errors.push({
      field: 'sortCode',
      message: 'Please enter a valid UK sort code (e.g., 12-34-56 or 123456)',
      messageTr: 'Lütfen geçerli bir UK sıralama kodu girin (örn. 12-34-56 veya 123456)'
    });
  }

  // Account number validation (required)
  if (!accountNumber) {
    errors.push({
      field: 'accountNumber',
      message: 'Account number is required',
      messageTr: 'Hesap numarası zorunludur'
    });
  } else if (typeof accountNumber !== 'string') {
    errors.push({
      field: 'accountNumber',
      message: 'Account number must be a string',
      messageTr: 'Hesap numarası metin olmalıdır'
    });
  } else if (!isValidAccountNumber(accountNumber)) {
    errors.push({
      field: 'accountNumber',
      message: 'Please enter a valid 8-digit UK account number',
      messageTr: 'Lütfen geçerli 8 haneli bir UK hesap numarası girin'
    });
  }

  // Account type validation (optional)
  if (accountType !== undefined && accountType !== null && accountType !== '') {
    if (!BankAccount.BANK_ACCOUNT_TYPES.includes(accountType)) {
      errors.push({
        field: 'accountType',
        message: `Account type must be one of: ${BankAccount.BANK_ACCOUNT_TYPES.join(', ')}`,
        messageTr: `Hesap türü şunlardan biri olmalıdır: ${BankAccount.BANK_ACCOUNT_TYPES.join(', ')}`
      });
    }
  }

  // Currency validation (optional)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (!BankAccount.BANK_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${BankAccount.BANK_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${BankAccount.BANK_CURRENCIES.join(', ')}`
      });
    }
  }

  // Opening balance validation (optional)
  if (openingBalance !== undefined && openingBalance !== null) {
    if (typeof openingBalance !== 'number' || !Number.isInteger(openingBalance)) {
      errors.push({
        field: 'openingBalance',
        message: 'Opening balance must be an integer (in pence)',
        messageTr: 'Açılış bakiyesi bir tam sayı olmalıdır (peni cinsinden)'
      });
    }
  }

  // IBAN validation (optional)
  if (iban !== undefined && iban !== null && iban !== '') {
    const ibanError = BankAccount.validateIban(iban);
    if (ibanError) {
      errors.push({
        field: 'iban',
        message: ibanError,
        messageTr: 'Geçersiz IBAN formatı'
      });
    }
  }

  // BIC validation (optional)
  if (bic !== undefined && bic !== null && bic !== '') {
    const bicError = BankAccount.validateBic(bic);
    if (bicError) {
      errors.push({
        field: 'bic',
        message: bicError,
        messageTr: 'Geçersiz BIC/SWIFT kodu formatı'
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates update bank account request body.
 * Only validates provided fields.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateUpdateBankAccount(req, res, next) {
  const errors = [];
  const { accountName, bankName, sortCode, accountNumber, accountType, currency, openingBalance, currentBalance, iban, bic } = req.body;

  // Account name validation (if provided)
  if (accountName !== undefined) {
    if (typeof accountName !== 'string') {
      errors.push({
        field: 'accountName',
        message: 'Account name must be a string',
        messageTr: 'Hesap adı metin olmalıdır'
      });
    } else if (accountName.trim().length < 2) {
      errors.push({
        field: 'accountName',
        message: 'Account name must be at least 2 characters long',
        messageTr: 'Hesap adı en az 2 karakter olmalıdır'
      });
    } else if (accountName.length > 255) {
      errors.push({
        field: 'accountName',
        message: 'Account name must not exceed 255 characters',
        messageTr: 'Hesap adı 255 karakteri geçmemelidir'
      });
    }
  }

  // Bank name validation (if provided)
  if (bankName !== undefined) {
    if (typeof bankName !== 'string') {
      errors.push({
        field: 'bankName',
        message: 'Bank name must be a string',
        messageTr: 'Banka adı metin olmalıdır'
      });
    } else if (bankName.trim().length < 2) {
      errors.push({
        field: 'bankName',
        message: 'Bank name must be at least 2 characters long',
        messageTr: 'Banka adı en az 2 karakter olmalıdır'
      });
    } else if (bankName.length > 255) {
      errors.push({
        field: 'bankName',
        message: 'Bank name must not exceed 255 characters',
        messageTr: 'Banka adı 255 karakteri geçmemelidir'
      });
    }
  }

  // Sort code validation (if provided)
  if (sortCode !== undefined) {
    if (typeof sortCode !== 'string') {
      errors.push({
        field: 'sortCode',
        message: 'Sort code must be a string',
        messageTr: 'Sıralama kodu metin olmalıdır'
      });
    } else if (!isValidSortCode(sortCode)) {
      errors.push({
        field: 'sortCode',
        message: 'Please enter a valid UK sort code (e.g., 12-34-56 or 123456)',
        messageTr: 'Lütfen geçerli bir UK sıralama kodu girin (örn. 12-34-56 veya 123456)'
      });
    }
  }

  // Account number validation (if provided)
  if (accountNumber !== undefined) {
    if (typeof accountNumber !== 'string') {
      errors.push({
        field: 'accountNumber',
        message: 'Account number must be a string',
        messageTr: 'Hesap numarası metin olmalıdır'
      });
    } else if (!isValidAccountNumber(accountNumber)) {
      errors.push({
        field: 'accountNumber',
        message: 'Please enter a valid 8-digit UK account number',
        messageTr: 'Lütfen geçerli 8 haneli bir UK hesap numarası girin'
      });
    }
  }

  // Account type validation (if provided)
  if (accountType !== undefined && accountType !== null && accountType !== '') {
    if (!BankAccount.BANK_ACCOUNT_TYPES.includes(accountType)) {
      errors.push({
        field: 'accountType',
        message: `Account type must be one of: ${BankAccount.BANK_ACCOUNT_TYPES.join(', ')}`,
        messageTr: `Hesap türü şunlardan biri olmalıdır: ${BankAccount.BANK_ACCOUNT_TYPES.join(', ')}`
      });
    }
  }

  // Currency validation (if provided)
  if (currency !== undefined && currency !== null && currency !== '') {
    if (!BankAccount.BANK_CURRENCIES.includes(currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Currency must be one of: ${BankAccount.BANK_CURRENCIES.join(', ')}`,
        messageTr: `Para birimi şunlardan biri olmalıdır: ${BankAccount.BANK_CURRENCIES.join(', ')}`
      });
    }
  }

  // Balance validations (if provided)
  if (openingBalance !== undefined && openingBalance !== null) {
    if (typeof openingBalance !== 'number' || !Number.isInteger(openingBalance)) {
      errors.push({
        field: 'openingBalance',
        message: 'Opening balance must be an integer (in pence)',
        messageTr: 'Açılış bakiyesi bir tam sayı olmalıdır (peni cinsinden)'
      });
    }
  }

  if (currentBalance !== undefined && currentBalance !== null) {
    if (typeof currentBalance !== 'number' || !Number.isInteger(currentBalance)) {
      errors.push({
        field: 'currentBalance',
        message: 'Current balance must be an integer (in pence)',
        messageTr: 'Mevcut bakiye bir tam sayı olmalıdır (peni cinsinden)'
      });
    }
  }

  // IBAN validation (if provided)
  if (iban !== undefined && iban !== null && iban !== '') {
    const ibanError = BankAccount.validateIban(iban);
    if (ibanError) {
      errors.push({
        field: 'iban',
        message: ibanError,
        messageTr: 'Geçersiz IBAN formatı'
      });
    }
  }

  // BIC validation (if provided)
  if (bic !== undefined && bic !== null && bic !== '') {
    const bicError = BankAccount.validateBic(bic);
    if (bicError) {
      errors.push({
        field: 'bic',
        message: bicError,
        messageTr: 'Geçersiz BIC/SWIFT kodu formatı'
      });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}
