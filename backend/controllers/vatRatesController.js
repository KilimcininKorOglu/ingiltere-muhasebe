/**
 * VAT Rates Controller
 * 
 * Handles HTTP requests for VAT rate reference data.
 */

const {
  getAllVatRates,
  getAllVatRatesMultilingual,
  getVatRateById,
  getVatRateByCode,
  getActiveVatRates,
  getVatThresholds,
  searchVatRatesByExample,
  supportedLanguages
} = require('../data/vatRates');

/**
 * Get the language from request query or accept-language header
 * @param {Object} req - Express request object
 * @returns {string} Language code
 */
function getLanguageFromRequest(req) {
  // First check query parameter
  if (req.query.lang && supportedLanguages.includes(req.query.lang)) {
    return req.query.lang;
  }
  
  // Then check accept-language header
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage) {
    // Parse the accept-language header (e.g., "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7")
    const languages = acceptLanguage.split(',').map(lang => {
      const [code] = lang.trim().split(';');
      return code.split('-')[0].toLowerCase();
    });
    
    for (const lang of languages) {
      if (supportedLanguages.includes(lang)) {
        return lang;
      }
    }
  }
  
  // Default to English
  return 'en';
}

/**
 * GET /api/vat-rates
 * Get all VAT rates
 */
function getAll(req, res) {
  try {
    const language = getLanguageFromRequest(req);
    const multilingual = req.query.multilingual === 'true';
    
    let rates;
    if (multilingual) {
      rates = getAllVatRatesMultilingual();
    } else {
      rates = getAllVatRates(language);
    }
    
    res.json({
      success: true,
      language: multilingual ? 'all' : language,
      count: rates.length,
      data: rates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve VAT rates',
      message: error.message
    });
  }
}

/**
 * GET /api/vat-rates/active
 * Get only active VAT rates
 */
function getActive(req, res) {
  try {
    const language = getLanguageFromRequest(req);
    const rates = getActiveVatRates(language);
    
    res.json({
      success: true,
      language,
      count: rates.length,
      data: rates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active VAT rates',
      message: error.message
    });
  }
}

/**
 * GET /api/vat-rates/thresholds
 * Get VAT registration thresholds
 */
function getThresholds(req, res) {
  try {
    const language = getLanguageFromRequest(req);
    const thresholds = getVatThresholds(language);
    
    res.json({
      success: true,
      language,
      data: thresholds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve VAT thresholds',
      message: error.message
    });
  }
}

/**
 * GET /api/vat-rates/search
 * Search VAT rates by example keyword
 */
function search(req, res) {
  try {
    const { keyword } = req.query;
    
    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search keyword is required',
        message: 'Please provide a "keyword" query parameter'
      });
    }
    
    const language = getLanguageFromRequest(req);
    const results = searchVatRatesByExample(keyword.trim(), language);
    
    res.json({
      success: true,
      language,
      keyword: keyword.trim(),
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search VAT rates',
      message: error.message
    });
  }
}

/**
 * GET /api/vat-rates/:id
 * Get a specific VAT rate by ID
 */
function getById(req, res) {
  try {
    const { id } = req.params;
    const language = getLanguageFromRequest(req);
    const rate = getVatRateById(id, language);
    
    if (!rate) {
      return res.status(404).json({
        success: false,
        error: 'VAT rate not found',
        message: `No VAT rate found with ID: ${id}`
      });
    }
    
    res.json({
      success: true,
      language,
      data: rate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve VAT rate',
      message: error.message
    });
  }
}

/**
 * GET /api/vat-rates/code/:code
 * Get a specific VAT rate by code (S, R, Z, E, O)
 */
function getByCode(req, res) {
  try {
    const { code } = req.params;
    const language = getLanguageFromRequest(req);
    const rate = getVatRateByCode(code, language);
    
    if (!rate) {
      return res.status(404).json({
        success: false,
        error: 'VAT rate not found',
        message: `No VAT rate found with code: ${code}`
      });
    }
    
    res.json({
      success: true,
      language,
      data: rate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve VAT rate',
      message: error.message
    });
  }
}

/**
 * GET /api/vat-rates/languages
 * Get supported languages
 */
function getLanguages(req, res) {
  res.json({
    success: true,
    data: {
      supported: supportedLanguages,
      default: 'en',
      names: {
        en: 'English',
        tr: 'Türkçe'
      }
    }
  });
}

module.exports = {
  getAll,
  getActive,
  getThresholds,
  search,
  getById,
  getByCode,
  getLanguages,
  getLanguageFromRequest
};
