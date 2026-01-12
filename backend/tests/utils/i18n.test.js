/**
 * Unit Tests for i18n Utility
 * Tests translation functions, language parsing, and category localization.
 */

const { 
  t, 
  tBilingual, 
  interpolate,
  normalizeLanguage, 
  parseAcceptLanguage,
  getCategoryName,
  getCategoryTypeLabel,
  isSupported,
  getSupportedLanguages,
  reloadTranslations,
  getAllTranslations,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} = require('../../utils/i18n');

describe('i18n Utility', () => {
  beforeAll(() => {
    // Ensure translations are loaded
    reloadTranslations();
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should include English and Turkish', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('tr');
    });
  });

  describe('DEFAULT_LANGUAGE', () => {
    it('should be English', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });
  });

  describe('t()', () => {
    it('should return English translation by default', () => {
      const result = t('common.success');
      expect(result).toBe('Operation successful');
    });

    it('should return Turkish translation when lang is tr', () => {
      const result = t('common.success', 'tr');
      expect(result).toBe('İşlem başarılı');
    });

    it('should return the key if translation not found', () => {
      const result = t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should interpolate parameters', () => {
      const result = t('category.codeNotFound', 'en', { code: 'ABC' });
      expect(result).toBe("Category with code 'ABC' not found");
    });

    it('should interpolate Turkish parameters', () => {
      const result = t('category.codeNotFound', 'tr', { code: 'ABC' });
      expect(result).toBe("'ABC' kodlu kategori bulunamadı");
    });

    it('should fallback to default language for unsupported language', () => {
      const result = t('common.success', 'de');
      expect(result).toBe('Operation successful');
    });

    it('should handle nested translation keys', () => {
      const result = t('category.types.asset', 'en');
      expect(result).toBe('Asset');
    });

    it('should handle nested Turkish translation keys', () => {
      const result = t('category.types.asset', 'tr');
      expect(result).toBe('Varlık');
    });
  });

  describe('tBilingual()', () => {
    it('should return bilingual object with en and tr', () => {
      const result = tBilingual('common.success');
      expect(result).toHaveProperty('en', 'Operation successful');
      expect(result).toHaveProperty('tr', 'İşlem başarılı');
    });

    it('should interpolate parameters in both languages', () => {
      const result = tBilingual('category.codeNotFound', { code: 'XYZ' });
      expect(result.en).toBe("Category with code 'XYZ' not found");
      expect(result.tr).toBe("'XYZ' kodlu kategori bulunamadı");
    });
  });

  describe('interpolate()', () => {
    it('should replace {{placeholder}} with value', () => {
      const result = interpolate('Hello {{name}}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('should replace multiple placeholders', () => {
      const result = interpolate('{{greeting}} {{name}}!', { 
        greeting: 'Hi', 
        name: 'Test' 
      });
      expect(result).toBe('Hi Test!');
    });

    it('should return original string if no params', () => {
      const result = interpolate('No placeholders here', {});
      expect(result).toBe('No placeholders here');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const result = interpolate('{{x}} + {{x}} = 2{{x}}', { x: '1' });
      expect(result).toBe('1 + 1 = 21');
    });
  });

  describe('normalizeLanguage()', () => {
    it('should return en for English variants', () => {
      expect(normalizeLanguage('en')).toBe('en');
      expect(normalizeLanguage('en-US')).toBe('en');
      expect(normalizeLanguage('en-GB')).toBe('en');
      expect(normalizeLanguage('EN')).toBe('en');
    });

    it('should return tr for Turkish variants', () => {
      expect(normalizeLanguage('tr')).toBe('tr');
      expect(normalizeLanguage('tr-TR')).toBe('tr');
      expect(normalizeLanguage('TR')).toBe('tr');
    });

    it('should return default for unsupported languages', () => {
      expect(normalizeLanguage('de')).toBe('en');
      expect(normalizeLanguage('fr')).toBe('en');
      expect(normalizeLanguage('xyz')).toBe('en');
    });

    it('should return default for null/undefined', () => {
      expect(normalizeLanguage(null)).toBe('en');
      expect(normalizeLanguage(undefined)).toBe('en');
      expect(normalizeLanguage('')).toBe('en');
    });
  });

  describe('parseAcceptLanguage()', () => {
    it('should parse simple Accept-Language header', () => {
      expect(parseAcceptLanguage('tr')).toBe('tr');
      expect(parseAcceptLanguage('en')).toBe('en');
    });

    it('should parse header with quality values', () => {
      expect(parseAcceptLanguage('tr-TR,tr;q=0.9,en;q=0.8')).toBe('tr');
    });

    it('should respect quality priority', () => {
      expect(parseAcceptLanguage('en;q=0.9,tr;q=1.0')).toBe('tr');
    });

    it('should return first supported language by quality order', () => {
      // Without quality values, first item has implicit q=1, rest get lower
      // With equal quality, first supported language found wins
      expect(parseAcceptLanguage('tr,de,fr,en')).toBe('tr');
      expect(parseAcceptLanguage('en,tr')).toBe('en');
    });

    it('should return default for unsupported languages only', () => {
      expect(parseAcceptLanguage('de,fr,zh')).toBe('en');
    });

    it('should return default for null/undefined', () => {
      expect(parseAcceptLanguage(null)).toBe('en');
      expect(parseAcceptLanguage(undefined)).toBe('en');
      expect(parseAcceptLanguage('')).toBe('en');
    });
  });

  describe('getCategoryName()', () => {
    it('should return English category name', () => {
      expect(getCategoryName('1000', 'en')).toBe('Cash');
      expect(getCategoryName('4000', 'en')).toBe('Sales');
    });

    it('should return Turkish category name', () => {
      expect(getCategoryName('1000', 'tr')).toBe('Nakit');
      expect(getCategoryName('4000', 'tr')).toBe('Satışlar');
    });

    it('should return null for unknown code', () => {
      expect(getCategoryName('9999', 'en')).toBe(null);
    });
  });

  describe('getCategoryTypeLabel()', () => {
    it('should return English type labels', () => {
      expect(getCategoryTypeLabel('asset', 'en')).toBe('Asset');
      expect(getCategoryTypeLabel('income', 'en')).toBe('Income');
      expect(getCategoryTypeLabel('expense', 'en')).toBe('Expense');
    });

    it('should return Turkish type labels', () => {
      expect(getCategoryTypeLabel('asset', 'tr')).toBe('Varlık');
      expect(getCategoryTypeLabel('income', 'tr')).toBe('Gelir');
      expect(getCategoryTypeLabel('expense', 'tr')).toBe('Gider');
    });
  });

  describe('isSupported()', () => {
    it('should return true for supported languages', () => {
      expect(isSupported('en')).toBe(true);
      expect(isSupported('tr')).toBe(true);
      expect(isSupported('EN-US')).toBe(true);
      expect(isSupported('tr-TR')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isSupported('de')).toBe(false);
      expect(isSupported('fr')).toBe(false);
    });
  });

  describe('getSupportedLanguages()', () => {
    it('should return array with language info', () => {
      const languages = getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBe(2);
      
      const en = languages.find(l => l.code === 'en');
      expect(en).toMatchObject({ code: 'en', name: 'English', nativeName: 'English' });
      
      const tr = languages.find(l => l.code === 'tr');
      expect(tr).toMatchObject({ code: 'tr', name: 'Turkish', nativeName: 'Türkçe' });
    });
  });

  describe('getAllTranslations()', () => {
    it('should return all English translations', () => {
      const translations = getAllTranslations('en');
      expect(translations).toHaveProperty('common');
      expect(translations).toHaveProperty('category');
      expect(translations).toHaveProperty('categoryNames');
    });

    it('should return all Turkish translations', () => {
      const translations = getAllTranslations('tr');
      expect(translations).toHaveProperty('common');
      expect(translations).toHaveProperty('category');
      expect(translations).toHaveProperty('categoryNames');
    });
  });

  describe('reloadTranslations()', () => {
    it('should reload translations without error', () => {
      expect(() => reloadTranslations()).not.toThrow();
    });
  });
});
