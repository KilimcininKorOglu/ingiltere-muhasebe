/**
 * Token Blacklist Utility
 * Provides in-memory storage for invalidated JWT tokens (logged out).
 * Tokens are stored with their expiration time and automatically cleaned up.
 * 
 * For production, this should be replaced with Redis or database storage.
 * 
 * @module utils/tokenBlacklist
 */

const { decodeToken } = require('./jwt');

/**
 * In-memory blacklist storage.
 * Map of token -> expiration timestamp
 * @type {Map<string, number>}
 */
const blacklist = new Map();

/**
 * Cleanup interval in milliseconds (5 minutes)
 * @type {number}
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Reference to cleanup interval timer
 * @type {NodeJS.Timer|null}
 */
let cleanupTimer = null;

/**
 * Adds a token to the blacklist.
 * The token will be stored until its expiration time,
 * after which it will be automatically removed during cleanup.
 * 
 * @param {string} token - The JWT token to blacklist
 * @returns {boolean} True if token was added, false if invalid
 */
function addToBlacklist(token) {
  if (!token) {
    return false;
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  // Decode to get expiration time
  const decoded = decodeToken(cleanToken);
  if (!decoded || !decoded.exp) {
    // If no expiration, set to 24 hours from now
    const expirationTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    blacklist.set(cleanToken, expirationTime);
  } else {
    blacklist.set(cleanToken, decoded.exp);
  }

  // Start cleanup if not already running
  startCleanup();

  return true;
}

/**
 * Checks if a token is blacklisted.
 * 
 * @param {string} token - The JWT token to check
 * @returns {boolean} True if token is blacklisted, false otherwise
 */
function isBlacklisted(token) {
  if (!token) {
    return false;
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  return blacklist.has(cleanToken);
}

/**
 * Removes a token from the blacklist.
 * Primarily used for testing.
 * 
 * @param {string} token - The JWT token to remove
 * @returns {boolean} True if token was removed, false if not found
 */
function removeFromBlacklist(token) {
  if (!token) {
    return false;
  }

  // Remove 'Bearer ' prefix if present
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

  return blacklist.delete(cleanToken);
}

/**
 * Cleans up expired tokens from the blacklist.
 * Called periodically to prevent memory leaks.
 * 
 * @returns {number} Number of tokens removed
 */
function cleanupExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  let removedCount = 0;

  for (const [token, expTime] of blacklist.entries()) {
    if (expTime < now) {
      blacklist.delete(token);
      removedCount++;
    }
  }

  // Stop cleanup if blacklist is empty
  if (blacklist.size === 0) {
    stopCleanup();
  }

  return removedCount;
}

/**
 * Starts the cleanup interval if not already running.
 */
function startCleanup() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL);
    // Allow Node.js to exit even if timer is running
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

/**
 * Stops the cleanup interval.
 */
function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Clears the entire blacklist.
 * Primarily used for testing.
 * 
 * @returns {void}
 */
function clearBlacklist() {
  blacklist.clear();
  stopCleanup();
}

/**
 * Gets the current size of the blacklist.
 * 
 * @returns {number} Number of tokens in the blacklist
 */
function getBlacklistSize() {
  return blacklist.size;
}

module.exports = {
  addToBlacklist,
  isBlacklisted,
  removeFromBlacklist,
  cleanupExpiredTokens,
  clearBlacklist,
  getBlacklistSize,
  // For testing purposes
  startCleanup,
  stopCleanup
};
