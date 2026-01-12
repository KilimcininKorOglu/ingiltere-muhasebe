/**
 * Authentication Middleware
 * Provides JWT-based authentication middleware for protected routes.
 * Includes token blacklist checking for logout functionality.
 * 
 * @module middleware/auth
 */

const { verifyToken } = require('../utils/jwt');
const { findById, sanitizeUser } = require('../database/models/User');
const { isBlacklisted } = require('../utils/tokenBlacklist');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Extracts the token from the Authorization header.
 * Removes 'Bearer ' prefix if present.
 * 
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
function extractToken(authHeader) {
  if (!authHeader) {
    return null;
  }
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
}

/**
 * Authentication middleware.
 * Verifies JWT token from Authorization header and attaches user to request.
 * Also checks if token has been blacklisted (logged out).
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

  // Extract the token
  const token = extractToken(authHeader);

  // Check if token has been blacklisted (logged out)
  if (isBlacklisted(token)) {
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
  req.token = token;
  next();
}

/**
 * Optional authentication middleware.
 * Attaches user to request if valid token is provided, but doesn't fail if not.
 * Also checks if token has been blacklisted.
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

  // Extract and check if token is blacklisted
  const token = extractToken(authHeader);
  if (isBlacklisted(token)) {
    return next();
  }

  const result = verifyToken(authHeader);
  
  if (result.valid) {
    const user = findById(result.payload.userId);
    if (user) {
      req.user = sanitizeUser(user);
      req.token = token;
    }
  }
  
  next();
}

/**
 * Role-based authorization middleware.
 * Requires the user to have a specific role.
 * Must be used after requireAuth middleware.
 * 
 * @param {string|string[]} roles - Required role(s)
 * @returns {Function} Express middleware function
 */
function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const userRole = req.user.role || 'user';
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_INSUFFICIENT_PERMISSIONS.code,
          message: ERROR_CODES.AUTHZ_INSUFFICIENT_PERMISSIONS.message
        }
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  extractToken,
  // Alias for backwards compatibility
  authenticate: requireAuth
};
