/**
 * Password Utility
 * Provides password hashing and verification functions.
 * Wraps bcrypt functionality for consistent password handling.
 * 
 * @module utils/password
 */

const bcrypt = require('bcrypt');

/**
 * Number of salt rounds for bcrypt password hashing.
 * Higher values increase security but also computation time.
 * 12 rounds provides a good balance of security and performance.
 */
const SALT_ROUNDS = 12;

/**
 * Password validation rules
 */
const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true
};

/**
 * Validates a password against security requirements.
 * 
 * @param {string} password - The password to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_RULES.maxLength} characters`);
  }

  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Hashes a plain text password using bcrypt.
 * 
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If password is empty or hashing fails
 */
async function hashPassword(password) {
  if (!password) {
    throw new Error('Password is required for hashing');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password.
 * 
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match
 */
async function comparePassword(password, hashedPassword) {
  if (!password || !hashedPassword) {
    return false;
  }
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Hashes a plain text password synchronously.
 * Use sparingly as this blocks the event loop.
 * 
 * @param {string} password - Plain text password to hash
 * @returns {string} Hashed password
 * @throws {Error} If password is empty or hashing fails
 */
function hashPasswordSync(password) {
  if (!password) {
    throw new Error('Password is required for hashing');
  }
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password synchronously.
 * Use sparingly as this blocks the event loop.
 * 
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password to compare against
 * @returns {boolean} True if passwords match
 */
function comparePasswordSync(password, hashedPassword) {
  if (!password || !hashedPassword) {
    return false;
  }
  return bcrypt.compareSync(password, hashedPassword);
}

module.exports = {
  // Async functions (preferred)
  hashPassword,
  comparePassword,
  
  // Sync functions (use sparingly)
  hashPasswordSync,
  comparePasswordSync,
  
  // Validation
  validatePassword,
  
  // Constants
  SALT_ROUNDS,
  PASSWORD_RULES
};
