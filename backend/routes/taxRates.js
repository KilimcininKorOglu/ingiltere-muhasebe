/**
 * Tax Rates Routes
 * 
 * API routes for UK tax rates information.
 * All routes are prefixed with /api/tax-rates
 */

const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/taxRatesController');

/**
 * @route   GET /api/tax-rates
 * @desc    Get all tax rates configuration
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/', getAllTaxRates);

/**
 * @route   GET /api/tax-rates/current
 * @desc    Get current tax year rates
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/current', getCurrentYearTaxRates);

/**
 * @route   GET /api/tax-rates/years
 * @desc    Get all available tax years
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/years', getYears);

/**
 * @route   GET /api/tax-rates/types
 * @desc    Get available tax types for a year
 * @query   taxYear - Tax year (optional, defaults to current)
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/types', getAvailableTypes);

/**
 * @route   GET /api/tax-rates/year/:taxYear
 * @desc    Get tax rates for a specific tax year
 * @param   taxYear - Tax year in format 'YYYY-YY' (e.g., '2025-26')
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/year/:taxYear', getTaxRatesByYear);

/**
 * @route   GET /api/tax-rates/type/:taxType
 * @desc    Get specific tax type rates
 * @param   taxType - Type of tax (e.g., 'incomeTax', 'vat', 'corporationTax')
 * @query   taxYear - Tax year (optional, defaults to current)
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/type/:taxType', getTaxRatesByType);

/**
 * @route   GET /api/tax-rates/income-tax/bands
 * @desc    Get income tax bands
 * @query   region - 'england' or 'scotland' (default: 'england')
 * @query   taxYear - Tax year (optional, defaults to current)
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/income-tax/bands', getIncomeTaxBands);

/**
 * @route   POST /api/tax-rates/calculate/income-tax
 * @desc    Calculate income tax for a given annual income
 * @body    { annualIncome: number, region?: 'england'|'scotland', taxYear?: string }
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.post('/calculate/income-tax', calculateIncomeTaxAmount);

/**
 * @route   GET /api/tax-rates/vat
 * @desc    Get VAT rates and thresholds
 * @query   taxYear - Tax year (optional, defaults to current)
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/vat', getVatRates);

/**
 * @route   GET /api/tax-rates/corporation-tax
 * @desc    Get Corporation Tax rates
 * @query   taxYear - Tax year (optional, defaults to current)
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/corporation-tax', getCorporationTaxRates);

/**
 * @route   GET /api/tax-rates/national-insurance
 * @desc    Get National Insurance rates and thresholds
 * @query   taxYear - Tax year (optional, defaults to current)
 * @query   lang - Language preference (en/tr)
 * @access  Public
 */
router.get('/national-insurance', getNationalInsuranceRates);

module.exports = router;
