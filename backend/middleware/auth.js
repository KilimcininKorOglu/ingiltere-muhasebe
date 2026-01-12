/**
 * Authentication Middleware
 * Provides JWT token verification and user authentication middleware.
 * Checks token validity and blacklist status before allowing access.
 * 
 * @module middleware/auth
 */

const { verifyToken } = require('../utils/jwt');
const { isBlacklisted } = require('../utils/tokenBlacklist');
const { findById } = require('../database/models/User');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Extracts the token from the Authorization header.
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} The token or null if not found
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and "<token>" formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Authentication middleware.
 * Verifies the JWT token from the Authorization header,
 * checks if it's blacklisted, and attaches the user to the request.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    // Check if token is provided
    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    // Check if token is blacklisted (logged out)
    if (isBlacklisted(token)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID.code,
          message: {
            en: 'Token has been invalidated. Please log in again.',
            tr: 'Jeton geçersiz kılındı. Lütfen tekrar giriş yapın.'
          }
        }
      });
    }

    // Verify the token
    const result = verifyToken(token);

    if (!result.valid) {
      // Determine specific error type
      let errorCode = ERROR_CODES.AUTH_TOKEN_INVALID;
      if (result.error && result.error.includes('expired')) {
        errorCode = ERROR_CODES.AUTH_TOKEN_EXPIRED;
      }

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: errorCode.code,
          message: errorCode.message
        }
      });
    }

    // Fetch the user from database to ensure they still exist
    const user = findById(result.payload.userId);
    
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID.code,
          message: {
            en: 'User associated with this token no longer exists',
            tr: 'Bu jetonla ilişkili kullanıcı artık mevcut değil'
          }
        }
      });
    }

    // Attach user and token to request (sanitize user data)
    const { passwordHash, ...sanitizedUser } = user;
    // Convert SQLite integer to boolean for isVatRegistered
    if (sanitizedUser.isVatRegistered !== undefined) {
      sanitizedUser.isVatRegistered = Boolean(sanitizedUser.isVatRegistered);
    }

    req.user = sanitizedUser;
    req.token = token;

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
 * Same as authenticate but doesn't fail if no token is provided.
 * Useful for routes that have different behavior for authenticated vs anonymous users.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const token = extractToken(req);

    // If no token, continue without user
    if (!token) {
      req.user = null;
      req.token = null;
      return next();
    }

    // Check if token is blacklisted
    if (isBlacklisted(token)) {
      req.user = null;
      req.token = null;
      return next();
    }

    // Verify the token
    const result = verifyToken(token);

    if (!result.valid) {
      req.user = null;
      req.token = null;
      return next();
    }

    // Fetch the user from database
    const user = findById(result.payload.userId);
    
    if (!user) {
      req.user = null;
      req.token = null;
      return next();
    }

    // Attach user and token to request
    const { passwordHash, ...sanitizedUser } = user;
    if (sanitizedUser.isVatRegistered !== undefined) {
      sanitizedUser.isVatRegistered = Boolean(sanitizedUser.isVatRegistered);
    }

    req.user = sanitizedUser;
    req.token = token;

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    req.user = null;
    req.token = null;
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  extractToken
};
