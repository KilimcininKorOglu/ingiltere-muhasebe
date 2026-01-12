/**
 * Auth Controller
 * Handles authentication operations including user registration and login.
 * 
 * @module controllers/authController
 */

const { createUser, findByEmail, authenticate, sanitizeUser } = require('../database/models/User');
const { generateToken } = require('../utils/jwt');
const { HTTP_STATUS, ERROR_CODES, createErrorResponse } = require('../utils/errorCodes');

/**
 * Registers a new user.
 * POST /api/auth/register
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {string} req.body.name - User name
 * @param {string} [req.body.businessName] - Business name
 * @param {string} [req.body.businessAddress] - Business address
 * @param {string} [req.body.vatNumber] - VAT registration number
 * @param {boolean} [req.body.isVatRegistered] - VAT registration status
 * @param {string} [req.body.companyNumber] - Company registration number
 * @param {string} [req.body.taxYearStart] - Tax year start date (MM-DD)
 * @param {string} [req.body.preferredLanguage] - Preferred language (en/tr)
 * @param {Object} res - Express response object
 */
async function register(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const {
      email,
      password,
      name,
      businessName,
      businessAddress,
      vatNumber,
      isVatRegistered,
      companyNumber,
      taxYearStart,
      preferredLanguage
    } = req.body;

    // Check if email already exists
    const existingUser = findByEmail(email);
    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: ERROR_CODES.RES_EMAIL_ALREADY_REGISTERED.code,
          message: ERROR_CODES.RES_EMAIL_ALREADY_REGISTERED.message
        }
      });
    }

    // Create user
    const result = await createUser({
      email,
      password,
      name,
      businessName,
      businessAddress,
      vatNumber,
      isVatRegistered: isVatRegistered || false,
      companyNumber,
      taxYearStart,
      preferredLanguage
    });

    if (!result.success) {
      // Handle validation errors from User model
      const errorDetails = Object.entries(result.errors).map(([field, message]) => ({
        field,
        message
      }));

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Registration failed due to validation errors',
            tr: 'Kayıt, doğrulama hataları nedeniyle başarısız oldu'
          },
          details: errorDetails
        }
      });
    }

    // Generate JWT token
    const token = generateToken(result.data);

    // Return success response with user data and token
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        user: result.data,
        token
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Authenticates a user and returns a JWT token.
 * POST /api/auth/login
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 */
async function login(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { email, password } = req.body;

    // Authenticate user
    const result = await authenticate(email, password);

    if (!result.success) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INVALID_CREDENTIALS.code,
          message: ERROR_CODES.AUTH_INVALID_CREDENTIALS.message
        }
      });
    }

    // Generate JWT token
    const token = generateToken(result.user);

    // Return success response
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        token
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets the current authenticated user's profile.
 * GET /api/auth/me
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getProfile(req, res) {
  try {
    const { lang = 'en' } = req.query;

    // User should be set by auth middleware
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: req.user
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

module.exports = {
  register,
  login,
  getProfile
};
