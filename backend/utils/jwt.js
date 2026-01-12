/**
 * JWT Utility
 * Provides JWT token generation and verification functions.
 * Uses jsonwebtoken library for secure token handling.
 * 
 * @module utils/jwt
 */

const jwt = require('jsonwebtoken');

/**
 * JWT configuration
 * Uses environment variables for security, with sensible defaults for development.
 */
const JWT_CONFIG = {
  // Secret key for signing tokens - MUST be set in production
  secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  
  // Token expiration time
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Issuer for token validation
  issuer: process.env.JWT_ISSUER || 'uk-accounting-api',
  
  // Algorithm for signing
  algorithm: 'HS256'
};

/**
 * Token payload structure
 * @typedef {Object} TokenPayload
 * @property {number} userId - User ID
 * @property {string} email - User email
 * @property {string} [name] - User name
 * @property {number} iat - Issued at timestamp
 * @property {number} exp - Expiration timestamp
 * @property {string} iss - Token issuer
 */

/**
 * Generates a JWT token for a user.
 * 
 * @param {Object} user - User data to encode in token
 * @param {number} user.id - User ID
 * @param {string} user.email - User email
 * @param {string} [user.name] - User name
 * @param {Object} [options] - Additional options
 * @param {string} [options.expiresIn] - Custom expiration time
 * @returns {string} Signed JWT token
 * @throws {Error} If user data is invalid
 */
function generateToken(user, options = {}) {
  if (!user || !user.id || !user.email) {
    throw new Error('Valid user data (id and email) is required to generate token');
  }

  const payload = {
    userId: user.id,
    email: user.email
  };

  // Include name if provided
  if (user.name) {
    payload.name = user.name;
  }

  const tokenOptions = {
    expiresIn: options.expiresIn || JWT_CONFIG.expiresIn,
    issuer: JWT_CONFIG.issuer,
    algorithm: JWT_CONFIG.algorithm
  };

  return jwt.sign(payload, JWT_CONFIG.secret, tokenOptions);
}

/**
 * Verifies a JWT token and returns the decoded payload.
 * 
 * @param {string} token - JWT token to verify
 * @returns {{valid: boolean, payload?: TokenPayload, error?: string}} Verification result
 */
function verifyToken(token) {
  if (!token) {
    return { valid: false, error: 'Token is required' };
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  try {
    const decoded = jwt.verify(cleanToken, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      algorithms: [JWT_CONFIG.algorithm]
    });

    return { valid: true, payload: decoded };
  } catch (error) {
    let errorMessage = 'Invalid token';

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Token is malformed or invalid';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Token is not yet valid';
    }

    return { valid: false, error: errorMessage };
  }
}

/**
 * Decodes a JWT token without verification.
 * Useful for reading payload without validating signature.
 * WARNING: Do not use for authentication - payload may be tampered.
 * 
 * @param {string} token - JWT token to decode
 * @returns {TokenPayload|null} Decoded payload or null if invalid
 */
function decodeToken(token) {
  if (!token) {
    return null;
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  try {
    return jwt.decode(cleanToken);
  } catch (error) {
    return null;
  }
}

/**
 * Generates a refresh token with longer expiration.
 * 
 * @param {Object} user - User data
 * @param {number} user.id - User ID
 * @param {string} user.email - User email
 * @returns {string} Signed refresh token
 */
function generateRefreshToken(user) {
  if (!user || !user.id || !user.email) {
    throw new Error('Valid user data is required to generate refresh token');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: '30d',
    issuer: JWT_CONFIG.issuer,
    algorithm: JWT_CONFIG.algorithm
  });
}

/**
 * Verifies a refresh token.
 * 
 * @param {string} token - Refresh token to verify
 * @returns {{valid: boolean, payload?: TokenPayload, error?: string}} Verification result
 */
function verifyRefreshToken(token) {
  const result = verifyToken(token);
  
  if (!result.valid) {
    return result;
  }

  if (result.payload.type !== 'refresh') {
    return { valid: false, error: 'Invalid refresh token' };
  }

  return result;
}

/**
 * Gets token expiration time in seconds.
 * 
 * @param {string} token - JWT token
 * @returns {number|null} Seconds until expiration, or null if invalid
 */
function getTokenExpiration(token) {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  return decoded.exp - now;
}

/**
 * Checks if a token is expired.
 * 
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(token) {
  const expiration = getTokenExpiration(token);
  return expiration === null || expiration <= 0;
}

module.exports = {
  // Token generation
  generateToken,
  generateRefreshToken,
  
  // Token verification
  verifyToken,
  verifyRefreshToken,
  
  // Token utilities
  decodeToken,
  getTokenExpiration,
  isTokenExpired,
  
  // Configuration (for testing)
  JWT_CONFIG
};
