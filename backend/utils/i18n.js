/**
 * Internationalization (i18n) Utility
 * Provides translation functions and locale management for the backend.
 * Supports English (en) and Turkish (tr) languages.
 * 
 * @module utils/i18n
 */

const path = require('path');
const fs = require('fs');

/**
 * Supported languages
 */
const SUPPORTED_LANGUAGES = ['en', 'tr'];

/**
 * Default language
 */
const DEFAULT_LANGUAGE = 'en';

/**
 * Cached translations
 * @type {Object.<string, Object>}
 */
const translations = {};

/**
 * Loads translation files into cache.
 * Called automatically on module load.
 */
function loadTranslations() {
  const localesDir = path.join(__dirname, '..', 'locales');
  
  for (const lang of SUPPORTED_LANGUAGES) {
    const filePath = path.join(localesDir, `${lang}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        translations[lang] = JSON.parse(content);
      } else {
        console.warn(`Translation file not found: ${filePath}`);
        translations[lang] = {};
      }
    } catch (error) {
      console.error(`Error loading translation file ${filePath}:`, error.message);
      translations[lang] = {};
    }
  }
}

// Load translations on module initialization
loadTranslations();

/**
 * Gets a translation by key path.
 * Supports nested keys using dot notation (e.g., 'category.notFound').
 * 
 * @param {string} key - Translation key (dot-notated for nested keys)
 * @param {string} [lang='en'] - Language code
 * @param {Object} [params={}] - Parameters for interpolation (e.g., { code: 'ABC' })
 * @returns {string} Translated string or the key if not found
 */
function t(key, lang = DEFAULT_LANGUAGE, params = {}) {
  // Normalize language code
  const normalizedLang = normalizeLanguage(lang);
  
  // Get translation object for the language
  const langTranslations = translations[normalizedLang] || translations[DEFAULT_LANGUAGE] || {};
  
  // Navigate to the nested key
  const keys = key.split('.');
  let value = langTranslations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, try fallback to default language
      if (normalizedLang !== DEFAULT_LANGUAGE) {
        return t(key, DEFAULT_LANGUAGE, params);
      }
      // Return the key as fallback
      return key;
    }
  }
  
  // If we got an object, return the key
  if (typeof value === 'object') {
    return key;
  }
  
  // Interpolate parameters
  return interpolate(String(value), params);
}

/**
 * Gets a bilingual message object with both English and Turkish translations.
 * 
 * @param {string} key - Translation key (dot-notated for nested keys)
 * @param {Object} [params={}] - Parameters for interpolation
 * @returns {{ en: string, tr: string }} Bilingual message object
 */
function tBilingual(key, params = {}) {
  return {
    en: t(key, 'en', params),
    tr: t(key, 'tr', params)
  };
}

/**
 * Interpolates parameters into a string.
 * Parameters are replaced using {{paramName}} syntax.
 * 
 * @param {string} str - String with placeholders
 * @param {Object} params - Parameters to interpolate
 * @returns {string} Interpolated string
 */
function interpolate(str, params) {
  if (!params || Object.keys(params).length === 0) {
    return str;
  }
  
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }, str);
}

/**
 * Normalizes a language code to a supported language.
 * Handles locale variations (e.g., 'en-US' -> 'en', 'tr-TR' -> 'tr').
 * 
 * @param {string} lang - Language code
 * @returns {string} Normalized language code
 */
function normalizeLanguage(lang) {
  if (!lang || typeof lang !== 'string') {
    return DEFAULT_LANGUAGE;
  }
  
  // Take the primary language code (before any dash or underscore)
  const primaryLang = lang.toLowerCase().split(/[-_]/)[0];
  
  // Return the language if supported, otherwise default
  return SUPPORTED_LANGUAGES.includes(primaryLang) ? primaryLang : DEFAULT_LANGUAGE;
}

/**
 * Parses the Accept-Language header to determine the preferred language.
 * 
 * @param {string} acceptLanguageHeader - Accept-Language header value
 * @returns {string} Preferred language code
 */
function parseAcceptLanguage(acceptLanguageHeader) {
  if (!acceptLanguageHeader || typeof acceptLanguageHeader !== 'string') {
    return DEFAULT_LANGUAGE;
  }
  
  // Parse Accept-Language header (e.g., "tr-TR,tr;q=0.9,en;q=0.8")
  const languages = acceptLanguageHeader
    .split(',')
    .map(part => {
      const [lang, q = 'q=1'] = part.trim().split(';');
      const quality = parseFloat(q.replace('q=', '')) || 1;
      return { lang: lang.trim(), quality };
    })
    .sort((a, b) => b.quality - a.quality);
  
  // Find the first supported language
  for (const { lang } of languages) {
    const normalized = normalizeLanguage(lang);
    if (SUPPORTED_LANGUAGES.includes(normalized)) {
      return normalized;
    }
  }
  
  return DEFAULT_LANGUAGE;
}

/**
 * Gets the localized name for a category based on its code.
 * 
 * @param {string} code - Category code
 * @param {string} [lang='en'] - Language code
 * @returns {string|null} Localized category name or null if not found
 */
function getCategoryName(code, lang = DEFAULT_LANGUAGE) {
  return t(`categoryNames.${code}`, lang) !== `categoryNames.${code}` 
    ? t(`categoryNames.${code}`, lang) 
    : null;
}

/**
 * Gets the localized type label for a category type.
 * 
 * @param {string} type - Category type (asset, liability, equity, income, expense)
 * @param {string} [lang='en'] - Language code
 * @returns {string} Localized type label
 */
function getCategoryTypeLabel(type, lang = DEFAULT_LANGUAGE) {
  return t(`category.types.${type}`, lang);
}

/**
 * Checks if a language is supported.
 * 
 * @param {string} lang - Language code to check
 * @returns {boolean} True if language is supported
 */
function isSupported(lang) {
  if (!lang || typeof lang !== 'string') {
    return false;
  }
  // Take the primary language code (before any dash or underscore)
  const primaryLang = lang.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(primaryLang);
}

/**
 * Gets the list of supported languages with their native names.
 * 
 * @returns {{ code: string, name: string, nativeName: string }[]} Supported languages
 */
function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' }
  ];
}

/**
 * Reloads translations from disk.
 * Useful for testing or dynamic updates.
 */
function reloadTranslations() {
  loadTranslations();
}

/**
 * Gets all translations for a specific language.
 * 
 * @param {string} [lang='en'] - Language code
 * @returns {Object} All translations for the language
 */
function getAllTranslations(lang = DEFAULT_LANGUAGE) {
  const normalizedLang = normalizeLanguage(lang);
  return translations[normalizedLang] || translations[DEFAULT_LANGUAGE] || {};
}

module.exports = {
  // Core translation functions
  t,
  tBilingual,
  interpolate,
  
  // Language utilities
  normalizeLanguage,
  parseAcceptLanguage,
  isSupported,
  getSupportedLanguages,
  
  // Category-specific helpers
  getCategoryName,
  getCategoryTypeLabel,
  
  // Management functions
  reloadTranslations,
  getAllTranslations,
  
  // Constants
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
