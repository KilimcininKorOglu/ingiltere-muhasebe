/**
 * VAT Rates Routes
 * 
 * Defines API endpoints for VAT rate reference data.
 * 
 * API Endpoints:
 * - GET /api/vat-rates              - Get all VAT rates
 * - GET /api/vat-rates/active       - Get only active VAT rates
 * - GET /api/vat-rates/thresholds   - Get VAT registration thresholds
 * - GET /api/vat-rates/search       - Search VAT rates by keyword
 * - GET /api/vat-rates/languages    - Get supported languages
 * - GET /api/vat-rates/code/:code   - Get VAT rate by code (S, R, Z, E, O)
 * - GET /api/vat-rates/:id          - Get VAT rate by ID
 * 
 * Query Parameters:
 * - lang: Language code ('en' or 'tr')
 * - multilingual: Set to 'true' to get all languages (only for /api/vat-rates)
 * - keyword: Search term (only for /api/vat-rates/search)
 */

const express = require('express');
const router = express.Router();
const vatRatesController = require('../controllers/vatRatesController');

// Get supported languages
router.get('/languages', vatRatesController.getLanguages);

// Get all active VAT rates
router.get('/active', vatRatesController.getActive);

// Get VAT thresholds
router.get('/thresholds', vatRatesController.getThresholds);

// Search VAT rates by keyword
router.get('/search', vatRatesController.search);

// Get VAT rate by code (must come before /:id to prevent conflicts)
router.get('/code/:code', vatRatesController.getByCode);

// Get all VAT rates
router.get('/', vatRatesController.getAll);

// Get VAT rate by ID (must be last to avoid matching other routes)
router.get('/:id', vatRatesController.getById);

module.exports = router;
