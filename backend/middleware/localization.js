/**
 * Localization Middleware
 * Handles language detection and sets the request locale.
 * Supports Accept-Language header, user preference, and query parameter.
 * 
 * @module middleware/localization
 */

const { 
  parseAcceptLanguage, 
  normalizeLanguage,
  t,
  tBilingual,
  getCategoryName,
  getCategoryTypeLabel,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} = require('../utils/i18n');

/**
 * Language detection order:
 * 1. Query parameter (?lang=tr)
 * 2. User preference (from authenticated user's preferredLanguage)
 * 3. Accept-Language header
 * 4. Default language (en)
 */

/**
 * Localization middleware factory.
 * Detects the user's preferred language and attaches localization helpers to the request.
 * 
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.queryParam='lang'] - Query parameter name for language override
 * @param {boolean} [options.setHeader=true] - Whether to set Content-Language response header
 * @returns {Function} Express middleware function
 */
function localization(options = {}) {
  const {
    queryParam = 'lang',
    setHeader = true
  } = options;

  return (req, res, next) => {
    let detectedLang = DEFAULT_LANGUAGE;
    let langSource = 'default';

    // Priority 1: Query parameter
    if (req.query && req.query[queryParam]) {
      const queryLang = normalizeLanguage(req.query[queryParam]);
      if (SUPPORTED_LANGUAGES.includes(queryLang)) {
        detectedLang = queryLang;
        langSource = 'query';
      }
    }
    
    // Priority 2: User preference (if authenticated and no query param)
    if (langSource === 'default' && req.user && req.user.preferredLanguage) {
      const userLang = normalizeLanguage(req.user.preferredLanguage);
      if (SUPPORTED_LANGUAGES.includes(userLang)) {
        detectedLang = userLang;
        langSource = 'user';
      }
    }
    
    // Priority 3: Accept-Language header (if no query param and no user preference)
    if (langSource === 'default' && req.headers['accept-language']) {
      const headerLang = parseAcceptLanguage(req.headers['accept-language']);
      if (SUPPORTED_LANGUAGES.includes(headerLang)) {
        detectedLang = headerLang;
        langSource = 'header';
      }
    }

    // Attach locale information to request
    req.locale = detectedLang;
    req.localeSource = langSource;
    
    /**
     * Translation helper attached to request.
     * 
     * @param {string} key - Translation key
     * @param {Object} [params={}] - Interpolation parameters
     * @returns {string} Translated string
     */
    req.t = (key, params = {}) => t(key, detectedLang, params);
    
    /**
     * Bilingual translation helper attached to request.
     * 
     * @param {string} key - Translation key
     * @param {Object} [params={}] - Interpolation parameters
     * @returns {{ en: string, tr: string }} Bilingual message object
     */
    req.tBilingual = (key, params = {}) => tBilingual(key, params);

    /**
     * Get localized category name.
     * 
     * @param {string} code - Category code
     * @returns {string|null} Localized name or null
     */
    req.getCategoryName = (code) => getCategoryName(code, detectedLang);

    /**
     * Get localized category type label.
     * 
     * @param {string} type - Category type
     * @returns {string} Localized type label
     */
    req.getCategoryTypeLabel = (type) => getCategoryTypeLabel(type, detectedLang);

    // Set Content-Language header
    if (setHeader) {
      res.setHeader('Content-Language', detectedLang);
    }

    next();
  };
}

/**
 * Gets the effective language for a request.
 * Can be used without the middleware being applied.
 * 
 * @param {Object} req - Express request object
 * @returns {string} Detected language code
 */
function getRequestLanguage(req) {
  // Check if locale is already set by middleware
  if (req.locale) {
    return req.locale;
  }

  // Priority 1: Query parameter
  if (req.query && req.query.lang) {
    const queryLang = normalizeLanguage(req.query.lang);
    if (SUPPORTED_LANGUAGES.includes(queryLang)) {
      return queryLang;
    }
  }

  // Priority 2: User preference
  if (req.user && req.user.preferredLanguage) {
    const userLang = normalizeLanguage(req.user.preferredLanguage);
    if (SUPPORTED_LANGUAGES.includes(userLang)) {
      return userLang;
    }
  }

  // Priority 3: Accept-Language header
  if (req.headers && req.headers['accept-language']) {
    return parseAcceptLanguage(req.headers['accept-language']);
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Creates a localized error response.
 * 
 * @param {string} key - Translation key for the error message
 * @param {Object} [params={}] - Interpolation parameters
 * @param {string} [errorCode] - Error code to include in response
 * @returns {{ success: false, error: { code?: string, message: { en: string, tr: string } } }}
 */
function createLocalizedError(key, params = {}, errorCode = null) {
  const response = {
    success: false,
    error: {
      message: tBilingual(key, params)
    }
  };

  if (errorCode) {
    response.error.code = errorCode;
  }

  return response;
}

/**
 * Creates a localized success response.
 * 
 * @param {string} key - Translation key for the success message
 * @param {*} data - Response data
 * @param {Object} [params={}] - Interpolation parameters
 * @returns {{ success: true, message: { en: string, tr: string }, data: * }}
 */
function createLocalizedSuccess(key, data = null, params = {}) {
  const response = {
    success: true,
    message: tBilingual(key, params)
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
}

/**
 * Localizes category data by setting the name field based on locale.
 * Uses database fields (name for English, nameTr for Turkish).
 * Preserves both nameEn and nameTr for multilingual support when requested.
 * 
 * @param {Object} category - Category data object
 * @param {string} [lang='en'] - Language code
 * @param {boolean} [includeAllNames=false] - Include nameEn and nameTr fields
 * @returns {Object} Category with localized name
 */
function localizeCategory(category, lang = DEFAULT_LANGUAGE, includeAllNames = false) {
  if (!category) return category;

  const normalized = normalizeLanguage(lang);
  const localized = { ...category };

  // Use database fields for localization
  // For Turkish: use nameTr if available, fallback to name
  // For English: use name
  if (normalized === 'tr' && category.nameTr) {
    localized.name = category.nameTr;
  }
  // If English or no Turkish translation, keep the default name field

  // Include both language names if requested
  if (includeAllNames) {
    localized.nameEn = category.name;
    localized.nameTr = category.nameTr || category.name;
  }

  return localized;
}

/**
 * Localizes an array of categories.
 * 
 * @param {Object[]} categories - Array of category objects
 * @param {string} [lang='en'] - Language code
 * @param {boolean} [includeAllNames=false] - Include nameEn and nameTr fields
 * @returns {Object[]} Array of localized categories
 */
function localizeCategories(categories, lang = DEFAULT_LANGUAGE, includeAllNames = false) {
  if (!Array.isArray(categories)) return categories;
  return categories.map(cat => localizeCategory(cat, lang, includeAllNames));
}

module.exports = {
  // Middleware
  localization,
  
  // Request helpers
  getRequestLanguage,
  
  // Response helpers
  createLocalizedError,
  createLocalizedSuccess,
  
  // Category localization
  localizeCategory,
  localizeCategories,
  
  // Constants
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
