import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateEmail,
  validateMinLength,
  validateMaxLength,
  validateUKPostcode,
  validateUKPhone,
  validateUKVatNumber,
  validateUKCompanyNumber,
  validateUTR,
  validateNINO,
  validateSortCode,
  validateUKBankAccount,
  validateInvoiceNumber,
  validateCurrency,
  validatePercentage,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateNotFutureDate,
  validateCurrentTaxYear,
  validatePasswordStrength,
  validatePasswordsMatch,
  validateValue,
  validateForm,
  hasErrors,
} from '../../utils/validators';

describe('validators', () => {
  describe('validateRequired', () => {
    it('should return valid for non-empty strings', () => {
      expect(validateRequired('hello').isValid).toBe(true);
    });

    it('should return invalid for empty strings', () => {
      expect(validateRequired('').isValid).toBe(false);
      expect(validateRequired('').errorKey).toBe('validation.required');
    });

    it('should return invalid for whitespace-only strings', () => {
      expect(validateRequired('   ').isValid).toBe(false);
    });

    it('should return invalid for null and undefined', () => {
      expect(validateRequired(null).isValid).toBe(false);
      expect(validateRequired(undefined).isValid).toBe(false);
    });

    it('should return valid for non-string values', () => {
      expect(validateRequired(0).isValid).toBe(true);
      expect(validateRequired(123).isValid).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should return valid for correct email formats', () => {
      expect(validateEmail('test@example.com').isValid).toBe(true);
      expect(validateEmail('user.name@domain.co.uk').isValid).toBe(true);
    });

    it('should return invalid for incorrect email formats', () => {
      expect(validateEmail('notanemail').isValid).toBe(false);
      expect(validateEmail('missing@domain').isValid).toBe(false);
      expect(validateEmail('@nodomain.com').isValid).toBe(false);
    });

    it('should return valid for empty values (optional field)', () => {
      expect(validateEmail('').isValid).toBe(true);
      expect(validateEmail(null).isValid).toBe(true);
    });
  });

  describe('validateMinLength', () => {
    it('should return valid when string meets minimum length', () => {
      expect(validateMinLength('hello', 3).isValid).toBe(true);
      expect(validateMinLength('abc', 3).isValid).toBe(true);
    });

    it('should return invalid when string is too short', () => {
      const result = validateMinLength('ab', 3);
      expect(result.isValid).toBe(false);
      expect(result.params.min).toBe(3);
    });

    it('should return valid for empty values', () => {
      expect(validateMinLength('', 3).isValid).toBe(true);
    });
  });

  describe('validateMaxLength', () => {
    it('should return valid when string is within max length', () => {
      expect(validateMaxLength('abc', 5).isValid).toBe(true);
    });

    it('should return invalid when string exceeds max length', () => {
      const result = validateMaxLength('toolong', 5);
      expect(result.isValid).toBe(false);
      expect(result.params.max).toBe(5);
    });
  });

  describe('validateUKPostcode', () => {
    it('should validate correct UK postcodes', () => {
      expect(validateUKPostcode('SW1A 1AA').isValid).toBe(true);
      expect(validateUKPostcode('EC1A 1BB').isValid).toBe(true);
      expect(validateUKPostcode('M1 1AE').isValid).toBe(true);
      expect(validateUKPostcode('B33 8TH').isValid).toBe(true);
    });

    it('should reject invalid postcodes', () => {
      expect(validateUKPostcode('12345').isValid).toBe(false);
      expect(validateUKPostcode('ABC DEF').isValid).toBe(false);
    });

    it('should return valid for empty values', () => {
      expect(validateUKPostcode('').isValid).toBe(true);
    });
  });

  describe('validateUKPhone', () => {
    it('should validate correct UK phone numbers', () => {
      expect(validateUKPhone('07123456789').isValid).toBe(true);
      expect(validateUKPhone('+44 7123 456789').isValid).toBe(true);
      expect(validateUKPhone('020 7123 4567').isValid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validateUKPhone('123').isValid).toBe(false);
      expect(validateUKPhone('not-a-phone').isValid).toBe(false);
    });
  });

  describe('validateUKVatNumber', () => {
    it('should validate correct UK VAT numbers', () => {
      expect(validateUKVatNumber('GB123456789').isValid).toBe(true);
      expect(validateUKVatNumber('GB 123456789').isValid).toBe(true);
      expect(validateUKVatNumber('GB123456789012').isValid).toBe(true);
    });

    it('should reject invalid VAT numbers', () => {
      expect(validateUKVatNumber('123456789').isValid).toBe(false);
      expect(validateUKVatNumber('FR123456789').isValid).toBe(false);
    });
  });

  describe('validateUKCompanyNumber', () => {
    it('should validate correct UK company numbers', () => {
      expect(validateUKCompanyNumber('12345678').isValid).toBe(true);
      expect(validateUKCompanyNumber('SC123456').isValid).toBe(true);
    });

    it('should reject invalid company numbers', () => {
      expect(validateUKCompanyNumber('1234567').isValid).toBe(false);
      expect(validateUKCompanyNumber('ABC12345').isValid).toBe(false);
    });
  });

  describe('validateUTR', () => {
    it('should validate correct UTR numbers', () => {
      expect(validateUTR('1234567890').isValid).toBe(true);
    });

    it('should reject invalid UTR numbers', () => {
      expect(validateUTR('123456789').isValid).toBe(false);
      expect(validateUTR('12345678901').isValid).toBe(false);
      expect(validateUTR('abcdefghij').isValid).toBe(false);
    });
  });

  describe('validateNINO', () => {
    it('should validate correct National Insurance numbers', () => {
      expect(validateNINO('AB123456C').isValid).toBe(true);
      expect(validateNINO('ab123456c').isValid).toBe(true);
    });

    it('should reject invalid NINOs', () => {
      expect(validateNINO('AB123456').isValid).toBe(false);
      expect(validateNINO('12345678A').isValid).toBe(false);
    });
  });

  describe('validateSortCode', () => {
    it('should validate correct sort codes', () => {
      expect(validateSortCode('12-34-56').isValid).toBe(true);
      expect(validateSortCode('123456').isValid).toBe(true);
    });

    it('should reject invalid sort codes', () => {
      expect(validateSortCode('12345').isValid).toBe(false);
      expect(validateSortCode('12-34-5').isValid).toBe(false);
    });
  });

  describe('validateUKBankAccount', () => {
    it('should validate correct bank account numbers', () => {
      expect(validateUKBankAccount('12345678').isValid).toBe(true);
    });

    it('should reject invalid bank account numbers', () => {
      expect(validateUKBankAccount('1234567').isValid).toBe(false);
      expect(validateUKBankAccount('123456789').isValid).toBe(false);
    });
  });

  describe('validateInvoiceNumber', () => {
    it('should validate correct invoice numbers', () => {
      expect(validateInvoiceNumber('INV001').isValid).toBe(true);
      expect(validateInvoiceNumber('12345').isValid).toBe(true);
    });

    it('should reject invalid invoice numbers', () => {
      expect(validateInvoiceNumber('ABCD-1234-XYZ').isValid).toBe(false);
    });
  });

  describe('validateCurrency', () => {
    it('should validate correct currency amounts', () => {
      expect(validateCurrency('100.00').isValid).toBe(true);
      expect(validateCurrency('£1,234.56').isValid).toBe(true);
      expect(validateCurrency(123.45).isValid).toBe(true);
    });

    it('should reject invalid currency amounts', () => {
      expect(validateCurrency('abc').isValid).toBe(false);
      expect(validateCurrency('$100').isValid).toBe(false);
    });
  });

  describe('validatePercentage', () => {
    it('should validate correct percentages', () => {
      expect(validatePercentage('50').isValid).toBe(true);
      expect(validatePercentage('100').isValid).toBe(true);
      expect(validatePercentage('0.5').isValid).toBe(true);
    });

    it('should reject invalid percentages', () => {
      expect(validatePercentage('101').isValid).toBe(false);
      expect(validatePercentage('-5').isValid).toBe(false);
    });
  });

  describe('validatePositiveNumber', () => {
    it('should validate positive numbers', () => {
      expect(validatePositiveNumber(1).isValid).toBe(true);
      expect(validatePositiveNumber('100').isValid).toBe(true);
    });

    it('should reject zero and negative numbers', () => {
      expect(validatePositiveNumber(0).isValid).toBe(false);
      expect(validatePositiveNumber(-1).isValid).toBe(false);
    });
  });

  describe('validateNonNegativeNumber', () => {
    it('should validate zero and positive numbers', () => {
      expect(validateNonNegativeNumber(0).isValid).toBe(true);
      expect(validateNonNegativeNumber(1).isValid).toBe(true);
    });

    it('should reject negative numbers', () => {
      expect(validateNonNegativeNumber(-1).isValid).toBe(false);
    });
  });

  describe('validateNotFutureDate', () => {
    it('should validate past and today dates', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      expect(validateNotFutureDate(yesterday.toISOString()).isValid).toBe(true);
      expect(validateNotFutureDate(today.toISOString()).isValid).toBe(true);
    });

    it('should reject future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(validateNotFutureDate(tomorrow.toISOString()).isValid).toBe(false);
    });
  });

  describe('validateCurrentTaxYear', () => {
    it('should validate dates within current UK tax year', () => {
      // This test uses dynamic dates to ensure it works year-round
      const now = new Date();
      expect(validateCurrentTaxYear(now.toISOString()).isValid).toBe(true);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong passwords', () => {
      expect(validatePasswordStrength('Password1').isValid).toBe(true);
      expect(validatePasswordStrength('MyPass123').isValid).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePasswordStrength('short1A').isValid).toBe(false); // Too short
      expect(validatePasswordStrength('nouppercase1').isValid).toBe(false);
      expect(validatePasswordStrength('NOLOWERCASE1').isValid).toBe(false);
      expect(validatePasswordStrength('NoNumbers').isValid).toBe(false);
    });
  });

  describe('validatePasswordsMatch', () => {
    it('should return valid when passwords match', () => {
      expect(validatePasswordsMatch('password123', 'password123').isValid).toBe(true);
    });

    it('should return invalid when passwords do not match', () => {
      expect(validatePasswordsMatch('password123', 'different').isValid).toBe(false);
    });
  });

  describe('validateValue', () => {
    it('should run multiple validation rules', () => {
      const rules = [
        { type: 'required' },
        { type: 'email' },
      ];

      expect(validateValue('test@example.com', rules)).toHaveLength(0);
      expect(validateValue('', rules).length).toBeGreaterThan(0);
      expect(validateValue('notanemail', rules).length).toBeGreaterThan(0);
    });
  });

  describe('validateForm', () => {
    it('should validate entire form', () => {
      const values = {
        email: 'test@example.com',
        name: '',
      };

      const schema = {
        email: [{ type: 'required' }, { type: 'email' }],
        name: [{ type: 'required' }],
      };

      const errors = validateForm(values, schema);
      expect(errors.email).toBeUndefined();
      expect(errors.name).toBeDefined();
    });
  });

  describe('hasErrors', () => {
    it('should return true when errors object has keys', () => {
      expect(hasErrors({ name: [] })).toBe(true);
    });

    it('should return false when errors object is empty', () => {
      expect(hasErrors({})).toBe(false);
    });
  });
});
