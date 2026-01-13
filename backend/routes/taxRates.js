/**
 * Tax Rates Routes
 * API endpoints for tax rates management
 */

const express = require('express');
const router = express.Router();
const taxRatesController = require('../controllers/taxRatesController');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

/**
 * @route GET /api/tax-rates
 * @desc Get all tax rates for a tax year
 * @query taxYear - Optional tax year (defaults to current)
 */
router.get('/', taxRatesController.getTaxRates);

/**
 * @route GET /api/tax-rates/grouped
 * @desc Get tax rates grouped by category
 * @query taxYear - Optional tax year
 */
router.get('/grouped', taxRatesController.getTaxRatesGrouped);

/**
 * @route GET /api/tax-rates/vat-thresholds
 * @desc Get VAT thresholds for a tax year
 * @query taxYear - Optional tax year
 */
router.get('/vat-thresholds', taxRatesController.getVatThresholds);

/**
 * @route GET /api/tax-rates/years
 * @desc Get all available tax years
 */
router.get('/years', taxRatesController.getAvailableTaxYears);

/**
 * @route POST /api/tax-rates
 * @desc Create a new tax rate
 * @body taxYear, rateType, category, name, value, currency, description, effectiveFrom, effectiveTo
 */
router.post('/', taxRatesController.createTaxRate);

/**
 * @route PUT /api/tax-rates/:id
 * @desc Update a tax rate
 * @param id - Tax rate ID
 * @body value, description, isActive
 */
router.put('/:id', taxRatesController.updateTaxRate);

/**
 * @route DELETE /api/tax-rates/:id
 * @desc Delete a tax rate (soft delete)
 * @param id - Tax rate ID
 */
router.delete('/:id', taxRatesController.deleteTaxRate);

/**
 * @route POST /api/tax-rates/copy
 * @desc Copy tax rates from one year to another
 * @body fromYear, toYear, effectiveFrom, effectiveTo
 */
router.post('/copy', taxRatesController.copyTaxYear);

module.exports = router;
