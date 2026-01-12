/**
 * Auth Middleware
 * Provides authentication middleware for protected routes.
 * Verifies JWT tokens and attaches user data to the request.
 * 
 * @module middleware/auth
 */

const { verifyToken } = require('../utils/jwt');
const { findById } = require('../database/models/User');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Authentication middleware.
 * Verifies the JWT token in the Authorization header and attaches
 * the authenticated user to the request object.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    // Verify the token
    const result = verifyToken(authHeader);

    if (!result.valid) {
      const errorCode = result.error === 'Token has expired' 
        ? ERROR_CODES.AUTH_TOKEN_EXPIRED 
        : ERROR_CODES.AUTH_TOKEN_INVALID;

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: errorCode.code,
          message: errorCode.message
        }
      });
    }

    // Find the user from the token payload
    const user = findById(result.payload.userId);

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID.code,
          message: ERROR_CODES.AUTH_TOKEN_INVALID.message
        }
      });
    }

    // Attach sanitized user data to request (exclude passwordHash)
    const { passwordHash, ...sanitizedUser } = user;
    req.user = sanitizedUser;

    next();
  } catch (error) {
    console.error('Authentication error:', error);

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
 * Optional authentication middleware.
 * Similar to authenticate but doesn't fail if no token is present.
 * Useful for routes that have different behavior for authenticated vs anonymous users.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // No token, continue without user
      req.user = null;
      return next();
    }

    // Verify the token
    const result = verifyToken(authHeader);

    if (!result.valid) {
      // Invalid token, continue without user
      req.user = null;
      return next();
    }

    // Find the user from the token payload
    const user = findById(result.payload.userId);

    if (user) {
      // Attach sanitized user data to request
      const { passwordHash, ...sanitizedUser } = user;
      req.user = sanitizedUser;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    // Continue without user on error
    req.user = null;
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth
};
