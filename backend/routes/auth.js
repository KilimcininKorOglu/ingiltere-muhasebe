/**
 * Auth Routes
 * API routes for authentication operations.
 * All routes are prefixed with /api/auth
 * 
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();

const { register, login, logout, getProfile, refreshToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  sanitizeRegistration,
  sanitizeLogin
} = require('../middleware/validation');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @body    { 
 *            email: string, 
 *            password: string, 
 *            name: string,
 *            businessName?: string,
 *            businessAddress?: string,
 *            vatNumber?: string,
 *            isVatRegistered?: boolean,
 *            companyNumber?: string,
 *            taxYearStart?: string,
 *            preferredLanguage?: 'en' | 'tr'
 *          }
 * @query   lang - Language preference (en/tr)
 * @access  Public
 * @returns { success: true, data: { user: UserData, token: string } }
 */
router.post('/register', sanitizeRegistration, validateRegistration, register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @body    { email: string, password: string }
 * @query   lang - Language preference (en/tr)
 * @access  Public
 * @returns { success: true, data: { user: UserData, token: string } }
 */
router.post('/login', sanitizeLogin, validateLogin, login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user's profile
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { user: UserData } }
 */
router.get('/me', authenticate, getProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate token
 * @header  Authorization: Bearer <token>
 * @query   lang - Language preference (en/tr)
 * @access  Private
 * @returns { success: true, data: { message: { en: string, tr: string } } }
 */
router.post('/logout', authenticate, logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @body    { refreshToken: string }
 * @query   lang - Language preference (en/tr)
 * @access  Public
 * @returns { success: true, data: { token: string, refreshToken: string } }
 */
router.post('/refresh', refreshToken);

module.exports = router;
