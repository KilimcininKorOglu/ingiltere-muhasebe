/**
 * Date Utility Functions
 * Handles conversion between date strings and Unix timestamps
 */

/**
 * Converts a date string (YYYY-MM-DD) to Unix timestamp (seconds since epoch)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {number|null} Unix timestamp or null if invalid
 */
function dateToTimestamp(dateStr) {
  if (!dateStr) return null;
  
  // If already a number, return as-is
  if (typeof dateStr === 'number') return dateStr;
  
  // Parse YYYY-MM-DD format
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
  
  if (isNaN(date.getTime())) return null;
  
  return Math.floor(date.getTime() / 1000);
}

/**
 * Converts a Unix timestamp to date string (YYYY-MM-DD)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string|null} Date string in YYYY-MM-DD format or null if invalid
 */
function timestampToDate(timestamp) {
  if (timestamp === null || timestamp === undefined) return null;
  
  // If already a string in YYYY-MM-DD format, return as-is
  if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return null;
  
  const date = new Date(ts * 1000);
  if (isNaN(date.getTime())) return null;
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Converts a Unix timestamp to ISO datetime string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string|null} ISO datetime string or null if invalid
 */
function timestampToISOString(timestamp) {
  if (timestamp === null || timestamp === undefined) return null;
  
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return null;
  
  const date = new Date(ts * 1000);
  if (isNaN(date.getTime())) return null;
  
  return date.toISOString();
}

/**
 * Gets current Unix timestamp
 * @returns {number} Current Unix timestamp in seconds
 */
function nowTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Validates a date string format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid format
 */
function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
  
  return !isNaN(date.getTime()) &&
    date.getUTCFullYear() === parseInt(year) &&
    date.getUTCMonth() + 1 === parseInt(month) &&
    date.getUTCDate() === parseInt(day);
}

/**
 * Converts date fields in an object from timestamps to date strings
 * @param {Object} obj - Object with date fields
 * @param {string[]} dateFields - Array of field names to convert
 * @returns {Object} Object with converted date fields
 */
function convertTimestampFields(obj, dateFields) {
  if (!obj) return obj;
  
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = timestampToDate(result[field]);
    }
  }
  return result;
}

/**
 * Converts date fields in an object from date strings to timestamps
 * @param {Object} obj - Object with date fields
 * @param {string[]} dateFields - Array of field names to convert
 * @returns {Object} Object with converted date fields
 */
function convertDateFields(obj, dateFields) {
  if (!obj) return obj;
  
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = dateToTimestamp(result[field]);
    }
  }
  return result;
}

module.exports = {
  dateToTimestamp,
  timestampToDate,
  timestampToISOString,
  nowTimestamp,
  isValidDateString,
  convertTimestampFields,
  convertDateFields
};
