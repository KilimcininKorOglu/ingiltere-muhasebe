/**
 * Auth Controller
 * Handles authentication operations including user registration, login, and logout.
 * 
 * @module controllers/authController
 */

const { createUser, findByEmail, findById, authenticate, sanitizeUser } = require('../database/models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { addToBlacklist, isBlacklisted } = require('../utils/tokenBlacklist');
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

    // Generate JWT tokens
    const token = generateToken(result.data);
    const refreshToken = generateRefreshToken(result.data);

    // Return success response with user data and tokens
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        user: result.data,
        token,
        refreshToken
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

    // Generate JWT tokens
    const token = generateToken(result.user);
    const refreshToken = generateRefreshToken(result.user);

    // Return success response
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: result.user,
        token,
        refreshToken
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

/**
 * Logs out the current user by invalidating their JWT token.
 * POST /api/auth/logout
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.token - The current JWT token from auth middleware
 * @param {Object} res - Express response object
 */
async function logout(req, res) {
  try {
    const { lang = 'en' } = req.query;

    // Get the token from the request (set by auth middleware)
    const token = req.token;

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    // Add token to blacklist
    const blacklisted = addToBlacklist(token);

    if (!blacklisted) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: 'Failed to invalidate token',
            tr: 'Jeton geçersiz kılınamadı'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        message: {
          en: 'Successfully logged out',
          tr: 'Başarıyla çıkış yapıldı'
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Logout error:', error);

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
 * Refreshes access token using a valid refresh token.
 * POST /api/auth/refresh
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.refreshToken - The refresh token
 * @param {Object} res - Express response object
 */
async function refreshToken(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { refreshToken: token } = req.body;

    // Validate refresh token is provided
    if (!token) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VAL_REQUIRED_FIELD',
          message: {
            en: 'Refresh token is required',
            tr: 'Yenileme jetonu gereklidir'
          }
        }
      });
    }

    // Check if the refresh token has been blacklisted (invalidated after use)
    if (isBlacklisted(token)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID.code,
          message: {
            en: 'Refresh token has already been used or invalidated',
            tr: 'Yenileme jetonu zaten kullanılmış veya geçersiz kılınmış'
          }
        }
      });
    }

    // Verify the refresh token
    const result = verifyRefreshToken(token);

    if (!result.valid) {
      // Determine specific error
      const isExpired = result.error === 'Token has expired';
      const errorCode = isExpired ? ERROR_CODES.AUTH_TOKEN_EXPIRED : ERROR_CODES.AUTH_TOKEN_INVALID;
      
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: errorCode.code,
          message: errorCode.message
        }
      });
    }

    // Get user from database to ensure they still exist
    const user = findById(result.payload.userId);
    
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.RES_USER_NOT_FOUND.code,
          message: ERROR_CODES.RES_USER_NOT_FOUND.message
        }
      });
    }

    // Invalidate the old refresh token (one-time use)
    addToBlacklist(token);

    // Generate new tokens
    const sanitizedUser = sanitizeUser(user);
    const newAccessToken = generateToken(sanitizedUser);
    const newRefreshToken = generateRefreshToken(sanitizedUser);

    // Return success response with new tokens
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);

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
  logout,
  getProfile,
  refreshToken
};
