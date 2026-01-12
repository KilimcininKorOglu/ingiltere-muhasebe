import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatInteger,
  formatDecimal,
  formatCurrency,
  formatCurrencyValue,
  formatPercentage,
  formatDateForInput,
  formatUKDateString,
  formatPhoneNumber,
  formatSortCode,
  formatCompanyNumber,
  formatVatNumber,
  formatNINO,
  formatUTR,
  formatFileSize,
  getLocaleForLanguage,
} from '../../utils/formatters';

describe('formatters', () => {
  describe('formatDate', () => {
    it('should format date in short UK format (DD/MM/YYYY)', () => {
      const date = new Date(2024, 0, 15); // 15 Jan 2024
      expect(formatDate(date, 'short')).toBe('15/01/2024');
    });

    it('should format date in medium format', () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date, 'medium');
      expect(result).toContain('15');
      expect(result).toContain('Jan');
      expect(result).toContain('2024');
    });

    it('should format date in long format', () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date, 'long');
      expect(result).toContain('15');
      expect(result).toContain('January');
      expect(result).toContain('2024');
    });

    it('should handle date strings', () => {
      expect(formatDate('2024-01-15', 'short')).toBe('15/01/2024');
    });

    it('should handle timestamps', () => {
      const timestamp = new Date(2024, 0, 15).getTime();
      expect(formatDate(timestamp, 'short')).toBe('15/01/2024');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDate('invalid')).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const date = new Date(2024, 0, 15, 14, 30);
      const result = formatDateTime(date, 'short', 'short');
      expect(result).toContain('15/01/2024');
      expect(result).toContain('14:30');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDateTime(null)).toBe('');
    });
  });

  describe('formatTime', () => {
    it('should format time in short format', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45);
      const result = formatTime(date, 'short');
      expect(result).toBe('14:30');
    });

    it('should format time in medium format with seconds', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45);
      const result = formatTime(date, 'medium');
      expect(result).toBe('14:30:45');
    });

    it('should return empty string for null', () => {
      expect(formatTime(null)).toBe('');
    });
  });

  describe('formatNumber', () => {
    it('should format large numbers with UK thousand separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format decimal numbers', () => {
      const result = formatNumber(1234.56, { minimumFractionDigits: 2 });
      expect(result).toBe('1,234.56');
    });

    it('should handle string numbers', () => {
      expect(formatNumber('1234567')).toBe('1,234,567');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatNumber(null)).toBe('');
      expect(formatNumber(undefined)).toBe('');
      expect(formatNumber('')).toBe('');
    });

    it('should return empty string for NaN', () => {
      expect(formatNumber('not a number')).toBe('');
    });
  });

  describe('formatInteger', () => {
    it('should format integer without decimals', () => {
      expect(formatInteger(1234567)).toBe('1,234,567');
    });

    it('should truncate decimal places', () => {
      expect(formatInteger(1234.99)).toBe('1,235');
    });
  });

  describe('formatDecimal', () => {
    it('should format with specified decimal places', () => {
      expect(formatDecimal(1234.5, 2)).toBe('1,234.50');
    });

    it('should format with 3 decimal places', () => {
      expect(formatDecimal(1234.1234, 3)).toBe('1,234.123');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with £ symbol', () => {
      expect(formatCurrency(1234.56)).toBe('£1,234.56');
    });

    it('should format large amounts', () => {
      expect(formatCurrency(1234567.89)).toBe('£1,234,567.89');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('£0.00');
    });

    it('should format negative amounts', () => {
      expect(formatCurrency(-1234.56)).toBe('-£1,234.56');
    });

    it('should handle string amounts', () => {
      expect(formatCurrency('1234.56')).toBe('£1,234.56');
    });

    it('should return empty string for null', () => {
      expect(formatCurrency(null)).toBe('');
      expect(formatCurrency(undefined)).toBe('');
    });

    it('should support different currency codes', () => {
      const result = formatCurrency(100, { currency: 'EUR', display: 'code' });
      expect(result).toContain('EUR');
    });
  });

  describe('formatCurrencyValue', () => {
    it('should format amount without currency symbol', () => {
      expect(formatCurrencyValue(1234.56)).toBe('1,234.56');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage with % symbol', () => {
      expect(formatPercentage(20)).toBe('20%');
    });

    it('should format decimal percentage', () => {
      expect(formatPercentage(12.5, { minimumFractionDigits: 1 })).toBe('12.5%');
    });

    it('should format 100%', () => {
      expect(formatPercentage(100)).toBe('100%');
    });

    it('should format 0%', () => {
      expect(formatPercentage(0)).toBe('0%');
    });

    it('should return empty string for null', () => {
      expect(formatPercentage(null)).toBe('');
    });
  });

  describe('formatDateForInput', () => {
    it('should format date as YYYY-MM-DD for HTML input', () => {
      const date = new Date(2024, 0, 15);
      expect(formatDateForInput(date)).toBe('2024-01-15');
    });

    it('should pad single-digit months and days', () => {
      const date = new Date(2024, 0, 5);
      expect(formatDateForInput(date)).toBe('2024-01-05');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDateForInput(null)).toBe('');
      expect(formatDateForInput('invalid')).toBe('');
    });
  });

  describe('formatUKDateString', () => {
    it('should parse and reformat UK date string', () => {
      expect(formatUKDateString('15/01/2024')).toBe('15/01/2024');
    });

    it('should return original for invalid format', () => {
      expect(formatUKDateString('invalid')).toBe('invalid');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format UK mobile numbers', () => {
      expect(formatPhoneNumber('07123456789')).toBe('07123 456 789');
    });

    it('should format UK landline numbers (London)', () => {
      expect(formatPhoneNumber('02012345678')).toBe('020 1234 5678');
    });

    it('should format UK landline numbers (other)', () => {
      expect(formatPhoneNumber('01onal234567')).toBe('01onal234567'); // mixed input returns original
      // When extracting only digits, if result is shorter than expected, return as-is
      expect(formatPhoneNumber('01onal234567'.replace(/[^\d]/g, ''))).toBe('01234567'); // 8 digits - not formatted
    });

    it('should handle international format', () => {
      const result = formatPhoneNumber('+441234567890');
      expect(result).toContain('+44');
    });

    it('should return empty string for null', () => {
      expect(formatPhoneNumber(null)).toBe('');
    });
  });

  describe('formatSortCode', () => {
    it('should format 6-digit sort code with dashes', () => {
      expect(formatSortCode('123456')).toBe('12-34-56');
    });

    it('should return original for invalid length', () => {
      expect(formatSortCode('12345')).toBe('12345');
    });

    it('should return empty string for null', () => {
      expect(formatSortCode(null)).toBe('');
    });
  });

  describe('formatCompanyNumber', () => {
    it('should pad numeric company numbers to 8 digits', () => {
      expect(formatCompanyNumber('123456')).toBe('00123456');
    });

    it('should return 8-digit numbers as-is', () => {
      expect(formatCompanyNumber('12345678')).toBe('12345678');
    });

    it('should handle Scottish company numbers', () => {
      expect(formatCompanyNumber('SC123456')).toBe('SC123456');
    });

    it('should return empty string for null', () => {
      expect(formatCompanyNumber(null)).toBe('');
    });
  });

  describe('formatVatNumber', () => {
    it('should format 9-digit VAT numbers', () => {
      expect(formatVatNumber('GB123456789')).toBe('GB 123 4567 89');
    });

    it('should format 12-digit VAT numbers', () => {
      expect(formatVatNumber('GB123456789012')).toBe('GB 123 4567 89 012');
    });

    it('should return empty string for null', () => {
      expect(formatVatNumber(null)).toBe('');
    });
  });

  describe('formatNINO', () => {
    it('should format National Insurance Number with spaces', () => {
      expect(formatNINO('AB123456C')).toBe('AB 12 34 56 C');
    });

    it('should return original for invalid length', () => {
      expect(formatNINO('AB12345C')).toBe('AB12345C');
    });

    it('should return empty string for null', () => {
      expect(formatNINO(null)).toBe('');
    });
  });

  describe('formatUTR', () => {
    it('should format 10-digit UTR with space', () => {
      expect(formatUTR('1234567890')).toBe('12345 67890');
    });

    it('should return original for invalid length', () => {
      expect(formatUTR('123456789')).toBe('123456789');
    });

    it('should return empty string for null', () => {
      expect(formatUTR(null)).toBe('');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should return empty string for null', () => {
      expect(formatFileSize(null)).toBe('');
    });
  });

  describe('getLocaleForLanguage', () => {
    it('should return en-GB for English', () => {
      expect(getLocaleForLanguage('en')).toBe('en-GB');
    });

    it('should return tr-TR for Turkish', () => {
      expect(getLocaleForLanguage('tr')).toBe('tr-TR');
    });

    it('should default to en-GB for unknown languages', () => {
      expect(getLocaleForLanguage('de')).toBe('en-GB');
    });
  });
});
