/**
 * Token Blacklist Utility
 * Provides persistent storage for invalidated JWT tokens (logged out).
 * Tokens are stored in SQLite database with in-memory cache for performance.
 * Persists across server restarts.
 * 
 * @module utils/tokenBlacklist
 */

const { decodeToken } = require('./jwt');
const { openDatabase } = require('../database');

/**
 * In-memory cache for blacklisted tokens (performance optimization).
 * Map of token -> expiration timestamp
 * @type {Map<string, number>}
 */
const blacklistCache = new Map();

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
 * Persists to database for cross-restart durability.
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
  let expirationTime;
  if (!decoded || !decoded.exp) {
    // If no expiration, set to 24 hours from now
    expirationTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  } else {
    expirationTime = decoded.exp;
  }

  // Add to cache
  blacklistCache.set(cleanToken, expirationTime);

  // Persist to database
  try {
    const db = openDatabase();
    db.prepare('INSERT OR REPLACE INTO token_blacklist (token, expirationTime) VALUES (?, ?)').run(cleanToken, expirationTime);
  } catch (error) {
    // Table might not exist yet, cache-only mode
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to persist token to blacklist:', error.message);
    }
  }

  // Start cleanup if not already running
  startCleanup();

  return true;
}

/**
 * Checks if a token is blacklisted.
 * Checks cache first, then falls back to database.
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

  // Check cache first
  if (blacklistCache.has(cleanToken)) {
    return true;
  }

  // Fall back to database check
  try {
    const db = openDatabase();
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare('SELECT token, expirationTime FROM token_blacklist WHERE token = ? AND expirationTime > ?').get(cleanToken, now);
    if (row) {
      // Add to cache for future lookups
      blacklistCache.set(cleanToken, row.expirationTime);
      return true;
    }
  } catch (error) {
    // Table might not exist yet, cache-only mode
  }

  return false;
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

  // Remove from cache
  const wasInCache = blacklistCache.delete(cleanToken);

  // Remove from database
  try {
    const db = openDatabase();
    const result = db.prepare('DELETE FROM token_blacklist WHERE token = ?').run(cleanToken);
    return wasInCache || result.changes > 0;
  } catch (error) {
    return wasInCache;
  }
}

/**
 * Cleans up expired tokens from the blacklist.
 * Called periodically to prevent memory leaks.
 * Removes from both cache and database.
 * 
 * @returns {number} Number of tokens removed
 */
function cleanupExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  let removedCount = 0;

  // Clean cache
  for (const [token, expTime] of blacklistCache.entries()) {
    if (expTime < now) {
      blacklistCache.delete(token);
      removedCount++;
    }
  }

  // Clean database
  try {
    const db = openDatabase();
    const result = db.prepare('DELETE FROM token_blacklist WHERE expirationTime < ?').run(now);
    removedCount = Math.max(removedCount, result.changes);
  } catch (error) {
    // Table might not exist yet
  }

  // Stop cleanup if blacklist is empty
  if (blacklistCache.size === 0) {
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
  blacklistCache.clear();
  
  // Clear database
  try {
    const db = openDatabase();
    db.prepare('DELETE FROM token_blacklist').run();
  } catch (error) {
    // Table might not exist yet
  }
  
  stopCleanup();
}

/**
 * Gets the current size of the blacklist.
 * 
 * @returns {number} Number of tokens in the blacklist
 */
function getBlacklistSize() {
  return blacklistCache.size;
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
