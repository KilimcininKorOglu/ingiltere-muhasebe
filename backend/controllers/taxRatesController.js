/**
 * Tax Rates Controller
 * 
 * Handles HTTP requests for UK tax rates information.
 * Provides endpoints for retrieving tax rates by year, type, and calculations.
 */

const {
  taxRates,
  getTaxRatesForYear,
  getCurrentTaxRates,
  getTaxTypeRates,
  getAvailableTaxYears,
  getAvailableTaxTypes,
  calculateIncomeTax
} = require('../config/taxRates');

/**
 * Get all tax rates configuration
 * GET /api/tax-rates
 */
const getAllTaxRates = (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    
    res.status(200).json({
      success: true,
      data: {
        currentTaxYear: taxRates.currentTaxYear,
        availableYears: getAvailableTaxYears(),
        taxRates: taxRates.taxYears
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve tax rates',
          tr: 'Vergi oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get tax rates for a specific tax year
 * GET /api/tax-rates/year/:taxYear
 */
const getTaxRatesByYear = (req, res) => {
  try {
    const { taxYear } = req.params;
    const { lang = 'en' } = req.query;
    
    const rates = getTaxRatesForYear(taxYear);
    
    if (!rates) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `Tax rates for year ${taxYear} not found`,
            tr: `${taxYear} yılı için vergi oranları bulunamadı`
          },
          availableYears: getAvailableTaxYears()
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        taxYear,
        rates
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve tax rates for specified year',
          tr: 'Belirtilen yıl için vergi oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get current tax year rates
 * GET /api/tax-rates/current
 */
const getCurrentYearTaxRates = (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    
    const rates = getCurrentTaxRates();
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: taxRates.currentTaxYear,
        rates
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve current tax rates',
          tr: 'Güncel vergi oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get specific tax type rates
 * GET /api/tax-rates/type/:taxType
 */
const getTaxRatesByType = (req, res) => {
  try {
    const { taxType } = req.params;
    const { taxYear, lang = 'en' } = req.query;
    
    const year = taxYear || taxRates.currentTaxYear;
    const rates = getTaxTypeRates(taxType, year);
    
    if (!rates) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `Tax type '${taxType}' not found for year ${year}`,
            tr: `${year} yılı için '${taxType}' vergi türü bulunamadı`
          },
          availableTypes: getAvailableTaxTypes(year)
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        taxType,
        rates
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve tax type rates',
          tr: 'Vergi türü oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get available tax types for a year
 * GET /api/tax-rates/types
 */
const getAvailableTypes = (req, res) => {
  try {
    const { taxYear, lang = 'en' } = req.query;
    
    const year = taxYear || taxRates.currentTaxYear;
    const types = getAvailableTaxTypes(year);
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        availableTypes: types.map(type => ({
          key: type,
          description: getTaxTypeRates(type, year)?.description || {}
        }))
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve available tax types',
          tr: 'Mevcut vergi türleri alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get available tax years
 * GET /api/tax-rates/years
 */
const getYears = (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    
    const years = getAvailableTaxYears();
    
    res.status(200).json({
      success: true,
      data: {
        currentTaxYear: taxRates.currentTaxYear,
        availableYears: years.map(year => ({
          year,
          startDate: taxRates.taxYears[year].startDate,
          endDate: taxRates.taxYears[year].endDate
        }))
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve available tax years',
          tr: 'Mevcut vergi yılları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Calculate income tax
 * POST /api/tax-rates/calculate/income-tax
 * Body: { annualIncome: number, region?: 'england'|'scotland', taxYear?: string }
 */
const calculateIncomeTaxAmount = (req, res) => {
  try {
    const { lang = 'en' } = req.query;
    const { annualIncome, region = 'england', taxYear } = req.body;
    
    // Validate input
    if (annualIncome === undefined || annualIncome === null) {
      return res.status(400).json({
        success: false,
        error: {
          message: {
            en: 'Annual income is required',
            tr: 'Yıllık gelir gereklidir'
          }
        }
      });
    }
    
    if (typeof annualIncome !== 'number' || annualIncome < 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: {
            en: 'Annual income must be a positive number',
            tr: 'Yıllık gelir pozitif bir sayı olmalıdır'
          }
        }
      });
    }
    
    if (region && !['england', 'scotland'].includes(region)) {
      return res.status(400).json({
        success: false,
        error: {
          message: {
            en: 'Region must be "england" or "scotland"',
            tr: 'Bölge "england" veya "scotland" olmalıdır'
          }
        }
      });
    }
    
    const year = taxYear || taxRates.currentTaxYear;
    const calculation = calculateIncomeTax(annualIncome, region, year);
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        region,
        calculation,
        summary: {
          en: `Income tax on £${annualIncome.toLocaleString()} is £${calculation.totalTax.toLocaleString()} (effective rate: ${calculation.effectiveRate}%)`,
          tr: `${annualIncome.toLocaleString()} £ gelir üzerinden vergi ${calculation.totalTax.toLocaleString()} £ (etkin oran: %${calculation.effectiveRate})`
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to calculate income tax',
          tr: 'Gelir vergisi hesaplanamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get income tax bands
 * GET /api/tax-rates/income-tax/bands
 */
const getIncomeTaxBands = (req, res) => {
  try {
    const { region = 'england', taxYear, lang = 'en' } = req.query;
    
    const year = taxYear || taxRates.currentTaxYear;
    const yearRates = getTaxRatesForYear(year);
    
    if (!yearRates) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `Tax year ${year} not found`,
            tr: `${year} vergi yılı bulunamadı`
          }
        }
      });
    }
    
    const taxConfig = region === 'scotland' 
      ? yearRates.scottishIncomeTax 
      : yearRates.incomeTax;
    
    if (!taxConfig) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `Income tax configuration for region ${region} not found`,
            tr: `${region} bölgesi için gelir vergisi yapılandırması bulunamadı`
          }
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        region,
        personalAllowance: taxConfig.personalAllowance,
        bands: taxConfig.bands
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve income tax bands',
          tr: 'Gelir vergisi dilimleri alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get VAT rates
 * GET /api/tax-rates/vat
 */
const getVatRates = (req, res) => {
  try {
    const { taxYear, lang = 'en' } = req.query;
    
    const year = taxYear || taxRates.currentTaxYear;
    const vatRates = getTaxTypeRates('vat', year);
    
    if (!vatRates) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `VAT rates for year ${year} not found`,
            tr: `${year} yılı için KDV oranları bulunamadı`
          }
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        vat: vatRates
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve VAT rates',
          tr: 'KDV oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get Corporation Tax rates
 * GET /api/tax-rates/corporation-tax
 */
const getCorporationTaxRates = (req, res) => {
  try {
    const { taxYear, lang = 'en' } = req.query;
    
    const year = taxYear || taxRates.currentTaxYear;
    const corpTaxRates = getTaxTypeRates('corporationTax', year);
    
    if (!corpTaxRates) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `Corporation tax rates for year ${year} not found`,
            tr: `${year} yılı için kurumlar vergisi oranları bulunamadı`
          }
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        corporationTax: corpTaxRates
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve corporation tax rates',
          tr: 'Kurumlar vergisi oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

/**
 * Get National Insurance rates
 * GET /api/tax-rates/national-insurance
 */
const getNationalInsuranceRates = (req, res) => {
  try {
    const { taxYear, lang = 'en' } = req.query;
    
    const year = taxYear || taxRates.currentTaxYear;
    const niRates = getTaxTypeRates('nationalInsurance', year);
    
    if (!niRates) {
      return res.status(404).json({
        success: false,
        error: {
          message: {
            en: `National Insurance rates for year ${year} not found`,
            tr: `${year} yılı için ulusal sigorta oranları bulunamadı`
          }
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        taxYear: year,
        nationalInsurance: niRates
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: {
          en: 'Failed to retrieve National Insurance rates',
          tr: 'Ulusal sigorta oranları alınamadı'
        },
        details: error.message
      }
    });
  }
};

module.exports = {
  getAllTaxRates,
  getTaxRatesByYear,
  getCurrentYearTaxRates,
  getTaxRatesByType,
  getAvailableTypes,
  getYears,
  calculateIncomeTaxAmount,
  getIncomeTaxBands,
  getVatRates,
  getCorporationTaxRates,
  getNationalInsuranceRates
};
