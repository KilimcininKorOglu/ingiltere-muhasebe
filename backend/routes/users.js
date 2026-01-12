/**
 * User Routes
 * API routes for user profile operations.
 * All routes are prefixed with /api/users
 * 
 * @module routes/users
 */

const express = require('express');
const router = express.Router();

const { getProfile, updateProfile } = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { validateProfileUpdate, sanitizeProfileUpdate } = require('../middleware/validation');

/**
 * @route   GET /api/users/me
 * @desc    Get current user's profile
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { user: UserData } }
 */
router.get('/me', requireAuth, getProfile);

/**
 * @route   PUT /api/users/me
 * @desc    Update current user's profile
 * @header  Authorization: Bearer <token>
 * @body    {
 *            name?: string,
 *            businessName?: string,
 *            businessAddress?: string,
 *            vatNumber?: string,
 *            isVatRegistered?: boolean,
 *            companyNumber?: string,
 *            taxYearStart?: string,
 *            preferredLanguage?: 'en' | 'tr',
 *            invoicePrefix?: string,
 *            nextInvoiceNumber?: number
 *          }
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { user: UserData } }
 */
router.put('/me', requireAuth, sanitizeProfileUpdate, validateProfileUpdate, updateProfile);

module.exports = router;
