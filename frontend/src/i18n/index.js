/**
 * i18n Initialization
 * Initializes and configures i18next with React integration and browser language detection.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
  DEFAULT_LANGUAGE,
  DETECTION_ORDER,
  DETECTION_CACHES,
  DEFAULT_NAMESPACE,
  LANGUAGE_STORAGE_KEY,
  getSupportedLanguageCodes,
} from './config';

// Import translation resources
import enTranslation from '../locales/en/translation.json';
import trTranslation from '../locales/tr/translation.json';

/**
 * Translation resources organized by language and namespace
 */
const resources = {
  en: {
    translation: enTranslation,
  },
  tr: {
    translation: trTranslation,
  },
};

/**
 * Initialize i18next instance
 */
i18n
  // Use language detector to automatically detect user's preferred language
  .use(LanguageDetector)
  // Pass i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // Translation resources
    resources,

    // Fallback language when translation is not available
    fallbackLng: DEFAULT_LANGUAGE,

    // Supported languages
    supportedLngs: getSupportedLanguageCodes(),

    // Default namespace
    defaultNS: DEFAULT_NAMESPACE,

    // Namespace to use when not specified
    ns: [DEFAULT_NAMESPACE],

    // Language detection configuration
    detection: {
      // Order of language detection methods
      order: DETECTION_ORDER,

      // Caches to store detected language
      caches: DETECTION_CACHES,

      // LocalStorage key
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,

      // Check only for language portion of locale (e.g., 'en' from 'en-US')
      checkWhitelist: true,
    },

    // Interpolation configuration
    interpolation: {
      // React already escapes values, so disable escaping
      escapeValue: false,
    },

    // React specific options
    react: {
      // Use Suspense for loading translations
      useSuspense: true,
    },

    // Debug mode (disable in production)
    debug: false,
  });

/**
 * Change the current language
 * @param {string} langCode - Language code to switch to
 * @returns {Promise} Promise that resolves when language is changed
 */
export const changeLanguage = (langCode) => {
  return i18n.changeLanguage(langCode);
};

/**
 * Get the current language
 * @returns {string} Current language code
 */
export const getCurrentLanguage = () => {
  return i18n.language;
};

export default i18n;
