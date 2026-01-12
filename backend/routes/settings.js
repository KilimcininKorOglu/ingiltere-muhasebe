/**
 * Settings Routes
 * API routes for VAT configuration settings operations.
 * All routes are prefixed with /api/settings
 * 
 * @module routes/settings
 */

const express = require('express');
const router = express.Router();

const { getVatSettings, updateVatSettings, getVatSchemes } = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');
const { validateVatSettingsUpdate, sanitizeVatSettings } = require('../middleware/settingsValidation');

/**
 * @route   GET /api/settings/vat
 * @desc    Get current user's VAT settings
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { vatSettings: { isVatRegistered, vatNumber, vatScheme } } }
 */
router.get('/vat', requireAuth, getVatSettings);

/**
 * @route   PUT /api/settings/vat
 * @desc    Update current user's VAT settings
 * @header  Authorization: Bearer <token>
 * @body    {
 *            isVatRegistered?: boolean,
 *            vatNumber?: string,
 *            vatScheme?: 'standard' | 'flat_rate' | 'cash' | 'annual' | 'retail'
 *          }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { vatSettings: { isVatRegistered, vatNumber, vatScheme } } }
 */
router.put('/vat', requireAuth, sanitizeVatSettings, validateVatSettingsUpdate, updateVatSettings);

/**
 * @route   GET /api/settings/vat/schemes
 * @desc    Get list of valid VAT accounting schemes with descriptions
 * @query   lang - Language preference (en/tr)
 * @access  Public (no authentication required - reference data)
 * @returns { success: true, data: { schemes: [...] } }
 */
router.get('/vat/schemes', getVatSchemes);

module.exports = router;
