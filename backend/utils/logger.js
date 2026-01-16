/**
 * Logger Utility
 * Provides centralized logging with consistent formatting.
 * 
 * Note: For production deployments with log aggregation needs,
 * replace this with a proper logging framework like winston or pino.
 * This wrapper provides a migration path for that transition.
 * 
 * @module utils/logger
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = process.env.LOG_LEVEL || 'info';
const currentLevelValue = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;
const isTest = process.env.NODE_ENV === 'test';

/**
 * Formats a log message with timestamp and level.
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [meta] - Additional metadata
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

/**
 * Logs an error message.
 * @param {string} message - Error message
 * @param {Error|Object} [errorOrMeta] - Error object or metadata
 */
function error(message, errorOrMeta) {
  if (isTest) return;
  if (currentLevelValue < LOG_LEVELS.error) return;
  
  const meta = errorOrMeta instanceof Error 
    ? { error: errorOrMeta.message, stack: errorOrMeta.stack }
    : errorOrMeta;
  
  console.error(formatMessage('error', message, meta));
}

/**
 * Logs a warning message.
 * @param {string} message - Warning message
 * @param {Object} [meta] - Additional metadata
 */
function warn(message, meta) {
  if (isTest) return;
  if (currentLevelValue < LOG_LEVELS.warn) return;
  
  console.warn(formatMessage('warn', message, meta));
}

/**
 * Logs an info message.
 * @param {string} message - Info message
 * @param {Object} [meta] - Additional metadata
 */
function info(message, meta) {
  if (isTest) return;
  if (currentLevelValue < LOG_LEVELS.info) return;
  
  console.log(formatMessage('info', message, meta));
}

/**
 * Logs a debug message.
 * @param {string} message - Debug message
 * @param {Object} [meta] - Additional metadata
 */
function debug(message, meta) {
  if (isTest) return;
  if (currentLevelValue < LOG_LEVELS.debug) return;
  
  console.log(formatMessage('debug', message, meta));
}

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS
};
