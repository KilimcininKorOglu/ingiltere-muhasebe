import { describe, it, expect } from 'vitest';
import {
  parseUKDate,
  parseUKNumber,
  parseUKCurrency,
  parsePercentage,
  parseUKPhone,
  parseSortCode,
  parseUKBankAccount,
  parseUKVatNumber,
  parseUKCompanyNumber,
  parseNINO,
  parseUTR,
  ukDateToISO,
  isoDateToUK,
  parseDateAny,
} from '../../utils/parsers';

describe('parsers', () => {
  describe('parseUKDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      const result = parseUKDate('15/01/2024');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(15);
      expect(result.value.getMonth()).toBe(0); // January
      expect(result.value.getFullYear()).toBe(2024);
    });

    it('should parse D/M/YYYY format', () => {
      const result = parseUKDate('5/1/2024');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(5);
      expect(result.value.getMonth()).toBe(0);
    });

    it('should parse with dashes', () => {
      const result = parseUKDate('15-01-2024');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(15);
    });

    it('should parse with dots', () => {
      const result = parseUKDate('15.01.2024');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(15);
    });

    it('should parse ISO format as fallback', () => {
      const result = parseUKDate('2024-01-15');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(15);
    });

    it('should reject invalid month', () => {
      const result = parseUKDate('15/13/2024');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid month');
    });

    it('should reject invalid day', () => {
      const result = parseUKDate('32/01/2024');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid day');
    });

    it('should reject invalid date like 31 Feb', () => {
      const result = parseUKDate('31/02/2024');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid date');
    });

    it('should reject null/undefined', () => {
      expect(parseUKDate(null).success).toBe(false);
      expect(parseUKDate(undefined).success).toBe(false);
    });
  });

  describe('parseUKNumber', () => {
    it('should parse plain numbers', () => {
      const result = parseUKNumber('1234567');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234567);
    });

    it('should parse numbers with commas', () => {
      const result = parseUKNumber('1,234,567');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234567);
    });

    it('should parse decimal numbers', () => {
      const result = parseUKNumber('1,234.56');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234.56);
    });

    it('should parse negative numbers', () => {
      const result = parseUKNumber('-1234');
      expect(result.success).toBe(true);
      expect(result.value).toBe(-1234);
    });

    it('should handle numeric input', () => {
      const result = parseUKNumber(1234);
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234);
    });

    it('should reject invalid input', () => {
      expect(parseUKNumber('abc').success).toBe(false);
    });

    it('should reject empty string', () => {
      expect(parseUKNumber('').success).toBe(false);
    });
  });

  describe('parseUKCurrency', () => {
    it('should parse currency with £ symbol', () => {
      const result = parseUKCurrency('£1,234.56');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234.56);
    });

    it('should parse currency without symbol', () => {
      const result = parseUKCurrency('1234.56');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234.56);
    });

    it('should parse negative amounts with minus', () => {
      const result = parseUKCurrency('-£1,234.56');
      expect(result.success).toBe(true);
      expect(result.value).toBe(-1234.56);
    });

    it('should parse negative amounts in parentheses', () => {
      const result = parseUKCurrency('(£1,234.56)');
      expect(result.success).toBe(true);
      expect(result.value).toBe(-1234.56);
    });

    it('should parse with GBP prefix', () => {
      const result = parseUKCurrency('GBP 1234.56');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234.56);
    });

    it('should round to 2 decimal places', () => {
      const result = parseUKCurrency('1234.567');
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234.57);
    });

    it('should handle numeric input', () => {
      const result = parseUKCurrency(1234.56);
      expect(result.success).toBe(true);
      expect(result.value).toBe(1234.56);
    });

    it('should reject invalid input', () => {
      expect(parseUKCurrency('abc').success).toBe(false);
    });
  });

  describe('parsePercentage', () => {
    it('should parse percentage with % symbol', () => {
      const result = parsePercentage('20%');
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should parse percentage without % symbol', () => {
      const result = parsePercentage('20');
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should parse decimal percentage', () => {
      const result = parsePercentage('12.5%');
      expect(result.success).toBe(true);
      expect(result.value).toBe(12.5);
    });

    it('should convert decimal form when isDecimal=true', () => {
      const result = parsePercentage('0.20', true);
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should handle numeric input', () => {
      const result = parsePercentage(20);
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should reject invalid input', () => {
      expect(parsePercentage('abc').success).toBe(false);
    });
  });

  describe('parseUKPhone', () => {
    it('should parse UK mobile numbers', () => {
      const result = parseUKPhone('07123456789');
      expect(result.success).toBe(true);
      expect(result.value).toBe('07123456789');
    });

    it('should parse formatted phone numbers', () => {
      const result = parseUKPhone('07123 456 789');
      expect(result.success).toBe(true);
      expect(result.value).toBe('07123456789');
    });

    it('should convert +44 to 0', () => {
      const result = parseUKPhone('+447123456789');
      expect(result.success).toBe(true);
      expect(result.value).toBe('07123456789');
    });

    it('should reject invalid length', () => {
      expect(parseUKPhone('0712345').success).toBe(false);
    });

    it('should reject numbers not starting with 0', () => {
      expect(parseUKPhone('7123456789').success).toBe(false);
    });
  });

  describe('parseSortCode', () => {
    it('should parse 6-digit sort code', () => {
      const result = parseSortCode('123456');
      expect(result.success).toBe(true);
      expect(result.value).toBe('123456');
    });

    it('should parse formatted sort code', () => {
      const result = parseSortCode('12-34-56');
      expect(result.success).toBe(true);
      expect(result.value).toBe('123456');
    });

    it('should reject invalid length', () => {
      expect(parseSortCode('12345').success).toBe(false);
    });
  });

  describe('parseUKBankAccount', () => {
    it('should parse 8-digit account number', () => {
      const result = parseUKBankAccount('12345678');
      expect(result.success).toBe(true);
      expect(result.value).toBe('12345678');
    });

    it('should remove spaces', () => {
      const result = parseUKBankAccount('1234 5678');
      expect(result.success).toBe(true);
      expect(result.value).toBe('12345678');
    });

    it('should reject invalid length', () => {
      expect(parseUKBankAccount('1234567').success).toBe(false);
    });
  });

  describe('parseUKVatNumber', () => {
    it('should parse standard GB VAT number', () => {
      const result = parseUKVatNumber('GB123456789');
      expect(result.success).toBe(true);
      expect(result.value).toBe('GB123456789');
    });

    it('should parse with spaces', () => {
      const result = parseUKVatNumber('GB 123 456 789');
      expect(result.success).toBe(true);
      expect(result.value).toBe('GB123456789');
    });

    it('should parse branch format (12 digits)', () => {
      const result = parseUKVatNumber('GB123456789012');
      expect(result.success).toBe(true);
      expect(result.value).toBe('GB123456789012');
    });

    it('should add GB prefix if missing', () => {
      const result = parseUKVatNumber('123456789');
      expect(result.success).toBe(true);
      expect(result.value).toBe('GB123456789');
    });

    it('should parse government department format', () => {
      const result = parseUKVatNumber('GBGD001');
      expect(result.success).toBe(true);
      expect(result.value).toBe('GBGD001');
    });

    it('should reject invalid format', () => {
      expect(parseUKVatNumber('GB12345').success).toBe(false);
    });
  });

  describe('parseUKCompanyNumber', () => {
    it('should parse 8-digit numeric company number', () => {
      const result = parseUKCompanyNumber('12345678');
      expect(result.success).toBe(true);
      expect(result.value).toBe('12345678');
    });

    it('should pad shorter numbers', () => {
      const result = parseUKCompanyNumber('123456');
      expect(result.success).toBe(true);
      expect(result.value).toBe('00123456');
    });

    it('should parse Scottish company numbers', () => {
      const result = parseUKCompanyNumber('SC123456');
      expect(result.success).toBe(true);
      expect(result.value).toBe('SC123456');
    });

    it('should reject invalid format', () => {
      expect(parseUKCompanyNumber('ABC12345').success).toBe(false);
    });
  });

  describe('parseNINO', () => {
    it('should parse valid NINO', () => {
      const result = parseNINO('AB123456C');
      expect(result.success).toBe(true);
      expect(result.value).toBe('AB123456C');
    });

    it('should parse with spaces', () => {
      const result = parseNINO('AB 12 34 56 C');
      expect(result.success).toBe(true);
      expect(result.value).toBe('AB123456C');
    });

    it('should convert to uppercase', () => {
      const result = parseNINO('ab123456c');
      expect(result.success).toBe(true);
      expect(result.value).toBe('AB123456C');
    });

    it('should reject invalid format', () => {
      expect(parseNINO('12345678A').success).toBe(false);
    });
  });

  describe('parseUTR', () => {
    it('should parse 10-digit UTR', () => {
      const result = parseUTR('1234567890');
      expect(result.success).toBe(true);
      expect(result.value).toBe('1234567890');
    });

    it('should parse with spaces', () => {
      const result = parseUTR('12345 67890');
      expect(result.success).toBe(true);
      expect(result.value).toBe('1234567890');
    });

    it('should reject invalid length', () => {
      expect(parseUTR('123456789').success).toBe(false);
    });
  });

  describe('ukDateToISO', () => {
    it('should convert UK date to ISO format', () => {
      expect(ukDateToISO('15/01/2024')).toBe('2024-01-15');
    });

    it('should return null for invalid dates', () => {
      expect(ukDateToISO('invalid')).toBe(null);
    });
  });

  describe('isoDateToUK', () => {
    it('should convert ISO date to UK format', () => {
      expect(isoDateToUK('2024-01-15')).toBe('15/01/2024');
    });

    it('should return null for invalid dates', () => {
      expect(isoDateToUK('invalid')).toBe(null);
    });

    it('should return null for null input', () => {
      expect(isoDateToUK(null)).toBe(null);
    });
  });

  describe('parseDateAny', () => {
    it('should parse UK format', () => {
      const result = parseDateAny('15/01/2024');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(15);
    });

    it('should parse ISO format', () => {
      const result = parseDateAny('2024-01-15');
      expect(result.success).toBe(true);
      expect(result.value.getDate()).toBe(15);
    });

    it('should return error for empty string', () => {
      expect(parseDateAny('').success).toBe(false);
    });
  });
});
