/**
 * i18n Configuration
 * Defines the configuration for internationalization including supported languages,
 * fallback behavior, and detection options.
 */

/**
 * Supported languages configuration
 */
export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
  },
  tr: {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    dir: 'ltr',
  },
};

/**
 * Default/fallback language
 */
export const DEFAULT_LANGUAGE = 'en';

/**
 * LocalStorage key for persisting language preference
 */
export const LANGUAGE_STORAGE_KEY = 'i18nextLng';

/**
 * Language detection order
 * Defines the priority order for detecting user's preferred language
 */
export const DETECTION_ORDER = [
  'localStorage',
  'navigator',
  'htmlTag',
];

/**
 * Caches to use for storing detected language
 */
export const DETECTION_CACHES = ['localStorage'];

/**
 * Namespaces configuration
 */
export const NAMESPACES = {
  translation: 'translation',
  common: 'common',
  navigation: 'navigation',
  forms: 'forms',
  warnings: 'warnings',
  errors: 'errors',
  financial: 'financial',
  tax: 'tax',
  help: 'help',
  guides: 'guides',
  tooltips: 'tooltips',
};

/**
 * Default namespace to use
 */
export const DEFAULT_NAMESPACE = 'translation';

/**
 * Get array of supported language codes
 * @returns {string[]} Array of language codes
 */
export const getSupportedLanguageCodes = () => Object.keys(SUPPORTED_LANGUAGES);

/**
 * Check if a language is supported
 * @param {string} langCode - Language code to check
 * @returns {boolean} True if language is supported
 */
export const isLanguageSupported = (langCode) => langCode in SUPPORTED_LANGUAGES;

/**
 * Get language info by code
 * @param {string} langCode - Language code
 * @returns {Object|undefined} Language info object or undefined
 */
export const getLanguageInfo = (langCode) => SUPPORTED_LANGUAGES[langCode];
