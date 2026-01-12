/**
 * Validation Utilities
 * Provides comprehensive validation functions for UK accounting application.
 */

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the validation passed
 * @property {string|null} errorKey - Translation key for the error message
 * @property {Object} [params] - Parameters for the translation interpolation
 */

/**
 * Validation rule type
 * @typedef {Object} ValidationRule
 * @property {string} type - Type of validation rule
 * @property {*} [value] - Value for the rule (e.g., min length)
 * @property {string} [message] - Custom error message key
 */

// Regular expression patterns
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ukPostcode: /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i,
  ukPhone: /^(?:(?:\+44)|(?:0))(?:\d\s?){9,10}$/,
  ukVatNumber: /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/i,
  ukCompanyNumber: /^[A-Z]{2}[0-9]{6}$|^[0-9]{8}$/i,
  utr: /^\d{10}$/, // Unique Taxpayer Reference
  nino: /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]$/i, // National Insurance Number
  sortCode: /^\d{2}-\d{2}-\d{2}$|^\d{6}$/,
  ukBankAccount: /^\d{8}$/,
  invoiceNumber: /^[A-Z]{0,3}[0-9]{1,10}$/i,
  currency: /^£?[\d,]+(\.\d{2})?$/,
  percentage: /^(100(\.0{1,2})?|[0-9]{1,2}(\.\d{1,2})?)$/,
};

/**
 * Validate required field
 * @param {*} value - Value to validate
 * @returns {ValidationResult}
 */
export const validateRequired = (value) => {
  const isValid = value !== null && value !== undefined && String(value).trim() !== '';
  return {
    isValid,
    errorKey: isValid ? null : 'validation.required',
  };
};

/**
 * Validate email format
 * @param {string} value - Email to validate
 * @returns {ValidationResult}
 */
export const validateEmail = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const isValid = PATTERNS.email.test(value);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidEmail',
  };
};

/**
 * Validate minimum length
 * @param {string} value - Value to validate
 * @param {number} min - Minimum length
 * @returns {ValidationResult}
 */
export const validateMinLength = (value, min) => {
  if (!value) return { isValid: true, errorKey: null };
  const isValid = String(value).length >= min;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.minLength',
    params: { min },
  };
};

/**
 * Validate maximum length
 * @param {string} value - Value to validate
 * @param {number} max - Maximum length
 * @returns {ValidationResult}
 */
export const validateMaxLength = (value, max) => {
  if (!value) return { isValid: true, errorKey: null };
  const isValid = String(value).length <= max;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.maxLength',
    params: { max },
  };
};

/**
 * Validate UK postcode
 * @param {string} value - Postcode to validate
 * @returns {ValidationResult}
 */
export const validateUKPostcode = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const isValid = PATTERNS.ukPostcode.test(value.trim());
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidPostcode',
  };
};

/**
 * Validate UK phone number
 * @param {string} value - Phone number to validate
 * @returns {ValidationResult}
 */
export const validateUKPhone = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/\s/g, '');
  const isValid = PATTERNS.ukPhone.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidPhone',
  };
};

/**
 * Validate UK VAT number
 * @param {string} value - VAT number to validate
 * @returns {ValidationResult}
 */
export const validateUKVatNumber = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/\s/g, '');
  const isValid = PATTERNS.ukVatNumber.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidVatNumber',
  };
};

/**
 * Validate UK company registration number
 * @param {string} value - Company number to validate
 * @returns {ValidationResult}
 */
export const validateUKCompanyNumber = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/\s/g, '');
  const isValid = PATTERNS.ukCompanyNumber.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidCompanyNumber',
  };
};

/**
 * Validate Unique Taxpayer Reference (UTR)
 * @param {string} value - UTR to validate
 * @returns {ValidationResult}
 */
export const validateUTR = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/\s/g, '');
  const isValid = PATTERNS.utr.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidUTR',
  };
};

/**
 * Validate National Insurance Number (NINO)
 * @param {string} value - NINO to validate
 * @returns {ValidationResult}
 */
export const validateNINO = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/\s/g, '').toUpperCase();
  const isValid = PATTERNS.nino.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidNINO',
  };
};

/**
 * Validate UK sort code
 * @param {string} value - Sort code to validate
 * @returns {ValidationResult}
 */
export const validateSortCode = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/[\s-]/g, '');
  const isValid = PATTERNS.sortCode.test(value) || /^\d{6}$/.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidSortCode',
  };
};

/**
 * Validate UK bank account number
 * @param {string} value - Bank account number to validate
 * @returns {ValidationResult}
 */
export const validateUKBankAccount = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const cleaned = value.replace(/\s/g, '');
  const isValid = PATTERNS.ukBankAccount.test(cleaned);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidBankAccount',
  };
};

/**
 * Validate invoice number format
 * @param {string} value - Invoice number to validate
 * @returns {ValidationResult}
 */
export const validateInvoiceNumber = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const isValid = PATTERNS.invoiceNumber.test(value.trim());
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidInvoiceNumber',
  };
};

/**
 * Validate currency amount
 * @param {string|number} value - Amount to validate
 * @returns {ValidationResult}
 */
export const validateCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errorKey: null };
  }
  const stringValue = String(value);
  const isValid = PATTERNS.currency.test(stringValue);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidCurrency',
  };
};

/**
 * Validate percentage value (0-100)
 * @param {string|number} value - Percentage to validate
 * @returns {ValidationResult}
 */
export const validatePercentage = (value) => {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errorKey: null };
  }
  const stringValue = String(value);
  const isValid = PATTERNS.percentage.test(stringValue);
  return {
    isValid,
    errorKey: isValid ? null : 'validation.invalidPercentage',
  };
};

/**
 * Validate positive number
 * @param {string|number} value - Number to validate
 * @returns {ValidationResult}
 */
export const validatePositiveNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errorKey: null };
  }
  const num = parseFloat(value);
  const isValid = !isNaN(num) && num > 0;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.mustBePositive',
  };
};

/**
 * Validate non-negative number
 * @param {string|number} value - Number to validate
 * @returns {ValidationResult}
 */
export const validateNonNegativeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errorKey: null };
  }
  const num = parseFloat(value);
  const isValid = !isNaN(num) && num >= 0;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.mustBeNonNegative',
  };
};

/**
 * Validate date is not in the future
 * @param {string|Date} value - Date to validate
 * @returns {ValidationResult}
 */
export const validateNotFutureDate = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const date = new Date(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const isValid = date <= today;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.futureDate',
  };
};

/**
 * Validate date is in the current tax year
 * UK tax year runs from 6 April to 5 April
 * @param {string|Date} value - Date to validate
 * @returns {ValidationResult}
 */
export const validateCurrentTaxYear = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  const date = new Date(value);
  const now = new Date();
  
  // Calculate current tax year start
  const year = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)
    ? now.getFullYear() - 1
    : now.getFullYear();
  
  const taxYearStart = new Date(year, 3, 6); // April 6
  const taxYearEnd = new Date(year + 1, 3, 5, 23, 59, 59); // April 5 next year
  
  const isValid = date >= taxYearStart && date <= taxYearEnd;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.outsideTaxYear',
    params: { startYear: year, endYear: year + 1 },
  };
};

/**
 * Validate password strength
 * @param {string} value - Password to validate
 * @returns {ValidationResult}
 */
export const validatePasswordStrength = (value) => {
  if (!value) return { isValid: true, errorKey: null };
  
  const hasMinLength = value.length >= 8;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  
  if (!hasMinLength) {
    return {
      isValid: false,
      errorKey: 'validation.passwordMinLength',
    };
  }
  
  if (!hasUppercase || !hasLowercase) {
    return {
      isValid: false,
      errorKey: 'validation.passwordCase',
    };
  }
  
  if (!hasNumber) {
    return {
      isValid: false,
      errorKey: 'validation.passwordNumber',
    };
  }
  
  return { isValid: true, errorKey: null };
};

/**
 * Validate passwords match
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {ValidationResult}
 */
export const validatePasswordsMatch = (password, confirmPassword) => {
  const isValid = password === confirmPassword;
  return {
    isValid,
    errorKey: isValid ? null : 'validation.passwordMismatch',
  };
};

/**
 * Map of validator names to functions
 */
export const VALIDATORS = {
  required: validateRequired,
  email: validateEmail,
  minLength: validateMinLength,
  maxLength: validateMaxLength,
  ukPostcode: validateUKPostcode,
  ukPhone: validateUKPhone,
  ukVatNumber: validateUKVatNumber,
  ukCompanyNumber: validateUKCompanyNumber,
  utr: validateUTR,
  nino: validateNINO,
  sortCode: validateSortCode,
  ukBankAccount: validateUKBankAccount,
  invoiceNumber: validateInvoiceNumber,
  currency: validateCurrency,
  percentage: validatePercentage,
  positiveNumber: validatePositiveNumber,
  nonNegativeNumber: validateNonNegativeNumber,
  notFutureDate: validateNotFutureDate,
  currentTaxYear: validateCurrentTaxYear,
  passwordStrength: validatePasswordStrength,
  passwordsMatch: validatePasswordsMatch,
};

/**
 * Run a single validation rule
 * @param {*} value - Value to validate
 * @param {ValidationRule} rule - Validation rule to apply
 * @returns {ValidationResult}
 */
export const runValidationRule = (value, rule) => {
  const validator = VALIDATORS[rule.type];
  if (!validator) {
    console.warn(`Unknown validator type: ${rule.type}`);
    return { isValid: true, errorKey: null };
  }
  
  // Handle validators that need additional parameters
  if (rule.type === 'minLength') {
    return validator(value, rule.value);
  }
  if (rule.type === 'maxLength') {
    return validator(value, rule.value);
  }
  if (rule.type === 'passwordsMatch') {
    return validator(value, rule.value);
  }
  
  return validator(value);
};

/**
 * Validate a value against multiple rules
 * @param {*} value - Value to validate
 * @param {ValidationRule[]} rules - Array of validation rules
 * @returns {ValidationResult[]} Array of validation results (only failed validations)
 */
export const validateValue = (value, rules) => {
  const results = [];
  
  for (const rule of rules) {
    const result = runValidationRule(value, rule);
    if (!result.isValid) {
      results.push(result);
    }
  }
  
  return results;
};

/**
 * Validate an entire form
 * @param {Object} values - Object containing field values
 * @param {Object} schema - Object mapping field names to validation rules
 * @returns {Object} Object mapping field names to validation errors
 */
export const validateForm = (values, schema) => {
  const errors = {};
  
  for (const [fieldName, rules] of Object.entries(schema)) {
    const fieldErrors = validateValue(values[fieldName], rules);
    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors;
    }
  }
  
  return errors;
};

/**
 * Check if form has any errors
 * @param {Object} errors - Errors object from validateForm
 * @returns {boolean} True if form has errors
 */
export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0;
};

export default VALIDATORS;
