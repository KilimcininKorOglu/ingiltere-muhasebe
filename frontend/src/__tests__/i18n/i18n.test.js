import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../../i18n';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getSupportedLanguageCodes,
  isLanguageSupported,
  getLanguageInfo,
} from '../../i18n/config';

describe('i18n Configuration', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should include English language', () => {
      expect(SUPPORTED_LANGUAGES.en).toBeDefined();
      expect(SUPPORTED_LANGUAGES.en.code).toBe('en');
      expect(SUPPORTED_LANGUAGES.en.name).toBe('English');
      expect(SUPPORTED_LANGUAGES.en.nativeName).toBe('English');
    });

    it('should include Turkish language', () => {
      expect(SUPPORTED_LANGUAGES.tr).toBeDefined();
      expect(SUPPORTED_LANGUAGES.tr.code).toBe('tr');
      expect(SUPPORTED_LANGUAGES.tr.name).toBe('Turkish');
      expect(SUPPORTED_LANGUAGES.tr.nativeName).toBe('Türkçe');
    });

    it('should have correct direction for all languages', () => {
      Object.values(SUPPORTED_LANGUAGES).forEach((lang) => {
        expect(lang.dir).toBe('ltr');
      });
    });
  });

  describe('DEFAULT_LANGUAGE', () => {
    it('should be English', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });

    it('should be a supported language', () => {
      expect(SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE]).toBeDefined();
    });
  });

  describe('LANGUAGE_STORAGE_KEY', () => {
    it('should be defined', () => {
      expect(LANGUAGE_STORAGE_KEY).toBe('i18nextLng');
    });
  });

  describe('getSupportedLanguageCodes', () => {
    it('should return an array of language codes', () => {
      const codes = getSupportedLanguageCodes();
      expect(Array.isArray(codes)).toBe(true);
      expect(codes).toContain('en');
      expect(codes).toContain('tr');
    });

    it('should return exactly 2 languages', () => {
      expect(getSupportedLanguageCodes().length).toBe(2);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('en')).toBe(true);
      expect(isLanguageSupported('tr')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('fr')).toBe(false);
      expect(isLanguageSupported('de')).toBe(false);
      expect(isLanguageSupported('xyz')).toBe(false);
    });
  });

  describe('getLanguageInfo', () => {
    it('should return language info for valid codes', () => {
      const enInfo = getLanguageInfo('en');
      expect(enInfo).toEqual({
        code: 'en',
        name: 'English',
        nativeName: 'English',
        dir: 'ltr',
      });
    });

    it('should return undefined for invalid codes', () => {
      expect(getLanguageInfo('invalid')).toBeUndefined();
    });
  });
});

describe('i18n Instance', () => {
  beforeEach(async () => {
    // Reset to default language before each test
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should be initialized', () => {
      expect(i18n.isInitialized).toBe(true);
    });

    it('should have English as fallback language', () => {
      expect(i18n.options.fallbackLng).toContain('en');
    });

    it('should have correct supported languages', () => {
      expect(i18n.options.supportedLngs).toContain('en');
      expect(i18n.options.supportedLngs).toContain('tr');
    });
  });

  describe('translations', () => {
    it('should translate to English correctly', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('common.save')).toBe('Save');
      expect(i18n.t('common.cancel')).toBe('Cancel');
      expect(i18n.t('dashboard.title')).toBe('Dashboard');
    });

    it('should translate to Turkish correctly', async () => {
      await i18n.changeLanguage('tr');
      expect(i18n.t('common.save')).toBe('Kaydet');
      expect(i18n.t('common.cancel')).toBe('İptal');
      expect(i18n.t('dashboard.title')).toBe('Panel');
    });

    it('should handle interpolation correctly', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('dashboard.welcome', { name: 'John' })).toBe('Welcome, John!');

      await i18n.changeLanguage('tr');
      expect(i18n.t('dashboard.welcome', { name: 'Ali' })).toBe('Hoş geldiniz, Ali!');
    });

    it('should handle nested translations', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('invoices.status')).toBe('Status');
      expect(i18n.t('invoices.paid')).toBe('Paid');

      await i18n.changeLanguage('tr');
      expect(i18n.t('invoices.status')).toBe('Durum');
      expect(i18n.t('invoices.paid')).toBe('Ödendi');
    });
  });

  describe('language switching', () => {
    it('should switch language without page reload', async () => {
      expect(i18n.language).toBe('en');
      expect(i18n.t('common.save')).toBe('Save');

      await i18n.changeLanguage('tr');
      expect(i18n.language).toBe('tr');
      expect(i18n.t('common.save')).toBe('Kaydet');

      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');
      expect(i18n.t('common.save')).toBe('Save');
    });
  });

  describe('localStorage persistence', () => {
    it('should persist language preference to localStorage', async () => {
      await i18n.changeLanguage('tr');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr');

      await i18n.changeLanguage('en');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });
  });
});
