/**
 * Unit Tests for Backend Formatting Utilities
 */

const {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatInteger,
  formatDecimal,
  formatCurrency,
  formatCurrencyValue,
  formatPercentage,
  formatDateISO,
  formatPhoneNumber,
  formatSortCode,
  formatVatNumber,
  formatNINO,
  formatUTR,
  formatCompanyNumber,
  parseUKDate,
  parseUKCurrency,
  parseUKNumber,
  ukDateToISO,
  isoDateToUK,
} = require('../utils/formatters');

describe('Backend Formatters', () => {
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

    it('should return empty string for null', () => {
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
  });

  describe('formatNumber', () => {
    it('should format large numbers with UK thousand separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format decimal numbers', () => {
      const result = formatNumber(1234.56, { minimumFractionDigits: 2 });
      expect(result).toBe('1,234.56');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatNumber(null)).toBe('');
      expect(formatNumber(undefined)).toBe('');
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

    it('should return empty string for null', () => {
      expect(formatCurrency(null)).toBe('');
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

  describe('formatDateISO', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15);
      expect(formatDateISO(date)).toBe('2024-01-15');
    });

    it('should pad single-digit months and days', () => {
      const date = new Date(2024, 0, 5);
      expect(formatDateISO(date)).toBe('2024-01-05');
    });

    it('should return empty string for null', () => {
      expect(formatDateISO(null)).toBe('');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format UK mobile numbers', () => {
      expect(formatPhoneNumber('07123456789')).toBe('07123 456 789');
    });

    it('should format UK landline numbers (London)', () => {
      expect(formatPhoneNumber('02012345678')).toBe('020 1234 5678');
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
  });

  describe('formatVatNumber', () => {
    it('should format 9-digit VAT numbers', () => {
      expect(formatVatNumber('GB123456789')).toBe('GB 123 4567 89');
    });

    it('should format 12-digit VAT numbers', () => {
      expect(formatVatNumber('GB123456789012')).toBe('GB 123 4567 89 012');
    });
  });

  describe('formatNINO', () => {
    it('should format National Insurance Number with spaces', () => {
      expect(formatNINO('AB123456C')).toBe('AB 12 34 56 C');
    });

    it('should return original for invalid length', () => {
      expect(formatNINO('AB12345C')).toBe('AB12345C');
    });
  });

  describe('formatUTR', () => {
    it('should format 10-digit UTR with space', () => {
      expect(formatUTR('1234567890')).toBe('12345 67890');
    });

    it('should return original for invalid length', () => {
      expect(formatUTR('123456789')).toBe('123456789');
    });
  });

  describe('formatCompanyNumber', () => {
    it('should pad numeric company numbers to 8 digits', () => {
      expect(formatCompanyNumber('123456')).toBe('00123456');
    });

    it('should return 8-digit numbers as-is', () => {
      expect(formatCompanyNumber('12345678')).toBe('12345678');
    });
  });
});

describe('Backend Parsers', () => {
  describe('parseUKDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      const result = parseUKDate('15/01/2024');
      expect(result).not.toBeNull();
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should parse with dashes', () => {
      const result = parseUKDate('15-01-2024');
      expect(result).not.toBeNull();
      expect(result.getDate()).toBe(15);
    });

    it('should parse ISO format as fallback', () => {
      const result = parseUKDate('2024-01-15');
      expect(result).not.toBeNull();
      expect(result.getDate()).toBe(15);
    });

    it('should return null for invalid dates', () => {
      expect(parseUKDate('invalid')).toBeNull();
      expect(parseUKDate('32/01/2024')).toBeNull();
      expect(parseUKDate('15/13/2024')).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(parseUKDate(null)).toBeNull();
      expect(parseUKDate(undefined)).toBeNull();
    });
  });

  describe('parseUKCurrency', () => {
    it('should parse currency with £ symbol', () => {
      expect(parseUKCurrency('£1,234.56')).toBe(1234.56);
    });

    it('should parse currency without symbol', () => {
      expect(parseUKCurrency('1234.56')).toBe(1234.56);
    });

    it('should parse negative amounts with minus', () => {
      expect(parseUKCurrency('-£1,234.56')).toBe(-1234.56);
    });

    it('should parse negative amounts in parentheses', () => {
      expect(parseUKCurrency('(£1,234.56)')).toBe(-1234.56);
    });

    it('should round to 2 decimal places', () => {
      expect(parseUKCurrency('1234.567')).toBe(1234.57);
    });

    it('should handle numeric input', () => {
      expect(parseUKCurrency(1234.56)).toBe(1234.56);
    });

    it('should return null for invalid input', () => {
      expect(parseUKCurrency('abc')).toBeNull();
      expect(parseUKCurrency(null)).toBeNull();
    });
  });

  describe('parseUKNumber', () => {
    it('should parse plain numbers', () => {
      expect(parseUKNumber('1234567')).toBe(1234567);
    });

    it('should parse numbers with commas', () => {
      expect(parseUKNumber('1,234,567')).toBe(1234567);
    });

    it('should parse decimal numbers', () => {
      expect(parseUKNumber('1,234.56')).toBe(1234.56);
    });

    it('should parse negative numbers', () => {
      expect(parseUKNumber('-1234')).toBe(-1234);
    });

    it('should handle numeric input', () => {
      expect(parseUKNumber(1234)).toBe(1234);
    });

    it('should return null for invalid input', () => {
      expect(parseUKNumber('abc')).toBeNull();
      expect(parseUKNumber('')).toBeNull();
    });
  });

  describe('ukDateToISO', () => {
    it('should convert UK date to ISO format', () => {
      expect(ukDateToISO('15/01/2024')).toBe('2024-01-15');
    });

    it('should return null for invalid dates', () => {
      expect(ukDateToISO('invalid')).toBeNull();
    });
  });

  describe('isoDateToUK', () => {
    it('should convert ISO date to UK format', () => {
      expect(isoDateToUK('2024-01-15')).toBe('15/01/2024');
    });

    it('should return null for invalid dates', () => {
      expect(isoDateToUK('invalid')).toBeNull();
      expect(isoDateToUK(null)).toBeNull();
    });
  });
});
