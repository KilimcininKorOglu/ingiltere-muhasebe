/**
 * Authentication Middleware
 * Provides JWT-based authentication middleware for protected routes.
 * 
 * @module middleware/auth
 */

const { verifyToken } = require('../utils/jwt');
const { findById } = require('../database/models/User');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Authentication middleware.
 * Verifies JWT token from Authorization header and attaches user to request.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAuth(req, res, next) {
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

  // Get user from database
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

  // Attach user to request
  req.user = user;
  next();
}

/**
 * Optional authentication middleware.
 * Attaches user to request if valid token is provided, but doesn't fail if not.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }

  const result = verifyToken(authHeader);
  
  if (result.valid) {
    const user = findById(result.payload.userId);
    if (user) {
      req.user = user;
    }
  }
  
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
