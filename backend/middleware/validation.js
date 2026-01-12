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

module.exports = {
  validateRegistration,
  validateLogin,
  sanitizeRegistration,
  sanitizeLogin,
  sendValidationError,
  // Bank account validation
  validateCreateBankAccount,
  validateUpdateBankAccount,
  sanitizeBankAccountData,
  // Authentication middleware
  authenticateToken
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
