/**
 * Authentication Middleware
 * Provides JWT-based authentication middleware for protected routes.
 * 
 * @module middleware/auth
 */

const { verifyToken } = require('../utils/jwt');
const { findById, sanitizeUser } = require('../database/models/User');
const { isBlacklisted } = require('../utils/tokenBlacklist');
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

  // Extract clean token (remove Bearer prefix if present)
  const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Check if token is blacklisted (logged out)
  if (isBlacklisted(cleanToken)) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_TOKEN_INVALID.code,
        message: ERROR_CODES.AUTH_TOKEN_INVALID.message
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

  // Attach user and token to request
  req.user = sanitizeUser(user);
  req.token = cleanToken;
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
  optionalAuth,
  // Alias for backwards compatibility
  authenticate: requireAuth
};
