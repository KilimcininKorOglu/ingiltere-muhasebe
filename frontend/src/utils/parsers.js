/**
 * Parsing Utilities
 * Provides parsing functions for UK-formatted dates, numbers, and currency.
 * Complements the formatters.js utilities.
 */

/**
 * Parse result type
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether parsing succeeded
 * @property {*} value - Parsed value (undefined if failed)
 * @property {string|null} error - Error message if failed
 */

/**
 * Parse a UK-formatted date string (DD/MM/YYYY) into a Date object
 * @param {string} dateString - Date string in DD/MM/YYYY format
 * @returns {ParseResult} Parse result with Date value
 */
export const parseUKDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid date string' };
  }

  const trimmed = dateString.trim();
  
  // Try DD/MM/YYYY format
  const ukMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    // Validate ranges
    if (monthNum < 1 || monthNum > 12) {
      return { success: false, value: undefined, error: 'Invalid month' };
    }
    if (dayNum < 1 || dayNum > 31) {
      return { success: false, value: undefined, error: 'Invalid day' };
    }
    if (yearNum < 1900 || yearNum > 2100) {
      return { success: false, value: undefined, error: 'Invalid year' };
    }
    
    const date = new Date(yearNum, monthNum - 1, dayNum);
    
    // Verify the date is valid (e.g., not 31 Feb)
    if (
      date.getDate() !== dayNum ||
      date.getMonth() !== monthNum - 1 ||
      date.getFullYear() !== yearNum
    ) {
      return { success: false, value: undefined, error: 'Invalid date' };
    }
    
    return { success: true, value: date, error: null };
  }
  
  // Try D/M/YYYY or DD/M/YYYY or D/MM/YYYY format (more flexible)
  const flexMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (flexMatch) {
    let [, day, month, year] = flexMatch;
    let dayNum = parseInt(day, 10);
    let monthNum = parseInt(month, 10);
    let yearNum = parseInt(year, 10);
    
    // Handle 2-digit year
    if (yearNum < 100) {
      yearNum = yearNum > 50 ? 1900 + yearNum : 2000 + yearNum;
    }
    
    if (monthNum < 1 || monthNum > 12) {
      return { success: false, value: undefined, error: 'Invalid month' };
    }
    if (dayNum < 1 || dayNum > 31) {
      return { success: false, value: undefined, error: 'Invalid day' };
    }
    
    const date = new Date(yearNum, monthNum - 1, dayNum);
    
    if (
      date.getDate() !== dayNum ||
      date.getMonth() !== monthNum - 1 ||
      date.getFullYear() !== yearNum
    ) {
      return { success: false, value: undefined, error: 'Invalid date' };
    }
    
    return { success: true, value: date, error: null };
  }
  
  // Try ISO format (YYYY-MM-DD) as fallback
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    
    if (!isNaN(date.getTime())) {
      return { success: true, value: date, error: null };
    }
  }
  
  // Try native Date parsing as last resort
  const nativeDate = new Date(dateString);
  if (!isNaN(nativeDate.getTime())) {
    return { success: true, value: nativeDate, error: null };
  }
  
  return { success: false, value: undefined, error: 'Unrecognized date format' };
};

/**
 * Parse a UK-formatted number (with commas as thousands separator)
 * @param {string} numberString - Number string (e.g., "1,234.56")
 * @returns {ParseResult} Parse result with number value
 */
export const parseUKNumber = (numberString) => {
  if (numberString === null || numberString === undefined) {
    return { success: false, value: undefined, error: 'Invalid number' };
  }
  
  if (typeof numberString === 'number') {
    if (isNaN(numberString)) {
      return { success: false, value: undefined, error: 'Invalid number' };
    }
    return { success: true, value: numberString, error: null };
  }
  
  if (typeof numberString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid number' };
  }
  
  const trimmed = numberString.trim();
  if (trimmed === '') {
    return { success: false, value: undefined, error: 'Empty string' };
  }
  
  // Remove thousands separators (commas) and currency symbols
  const cleaned = trimmed
    .replace(/£/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Check for valid number format
  if (!/^-?\d*\.?\d+$/.test(cleaned)) {
    return { success: false, value: undefined, error: 'Invalid number format' };
  }
  
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    return { success: false, value: undefined, error: 'Invalid number' };
  }
  
  return { success: true, value: num, error: null };
};

/**
 * Parse a UK currency amount (e.g., "£1,234.56" or "1234.56")
 * @param {string} currencyString - Currency string
 * @returns {ParseResult} Parse result with number value (amount in base units)
 */
export const parseUKCurrency = (currencyString) => {
  if (currencyString === null || currencyString === undefined) {
    return { success: false, value: undefined, error: 'Invalid currency' };
  }
  
  if (typeof currencyString === 'number') {
    if (isNaN(currencyString)) {
      return { success: false, value: undefined, error: 'Invalid currency' };
    }
    return { success: true, value: currencyString, error: null };
  }
  
  if (typeof currencyString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid currency' };
  }
  
  const trimmed = currencyString.trim();
  if (trimmed === '') {
    return { success: false, value: undefined, error: 'Empty string' };
  }
  
  // Handle negative amounts in parentheses (accounting format)
  let isNegative = false;
  let cleaned = trimmed;
  
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }
  
  // Remove currency symbols and thousands separators
  cleaned = cleaned
    .replace(/£/g, '')
    .replace(/GBP/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Check for valid number format
  if (!/^\d*\.?\d+$/.test(cleaned)) {
    return { success: false, value: undefined, error: 'Invalid currency format' };
  }
  
  let num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    return { success: false, value: undefined, error: 'Invalid currency' };
  }
  
  if (isNegative) {
    num = -num;
  }
  
  // Round to 2 decimal places to avoid floating point issues
  num = Math.round(num * 100) / 100;
  
  return { success: true, value: num, error: null };
};

/**
 * Parse a percentage value (e.g., "20%", "20", "0.2")
 * @param {string} percentString - Percentage string
 * @param {boolean} [isDecimal=false] - Whether input is in decimal form (0.2 = 20%)
 * @returns {ParseResult} Parse result with number value (0-100 scale)
 */
export const parsePercentage = (percentString, isDecimal = false) => {
  if (percentString === null || percentString === undefined) {
    return { success: false, value: undefined, error: 'Invalid percentage' };
  }
  
  if (typeof percentString === 'number') {
    if (isNaN(percentString)) {
      return { success: false, value: undefined, error: 'Invalid percentage' };
    }
    const value = isDecimal ? percentString * 100 : percentString;
    return { success: true, value, error: null };
  }
  
  if (typeof percentString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid percentage' };
  }
  
  const trimmed = percentString.trim();
  if (trimmed === '') {
    return { success: false, value: undefined, error: 'Empty string' };
  }
  
  // Remove % sign if present
  const hasPercent = trimmed.endsWith('%');
  const cleaned = trimmed.replace(/%/g, '').replace(/,/g, '').trim();
  
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    return { success: false, value: undefined, error: 'Invalid percentage' };
  }
  
  // If the input had % sign or isDecimal is false, use as-is
  // If isDecimal is true and no % sign, multiply by 100
  let value = num;
  if (isDecimal && !hasPercent) {
    value = num * 100;
  }
  
  return { success: true, value, error: null };
};

/**
 * Parse a UK phone number and extract digits
 * @param {string} phoneString - Phone number string
 * @returns {ParseResult} Parse result with cleaned phone number
 */
export const parseUKPhone = (phoneString) => {
  if (!phoneString || typeof phoneString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid phone number' };
  }
  
  // Remove all non-digit characters except +
  let cleaned = phoneString.replace(/[^\d+]/g, '');
  
  // Convert +44 to 0
  if (cleaned.startsWith('+44')) {
    cleaned = '0' + cleaned.slice(3);
  }
  
  // Validate length
  if (cleaned.length < 10 || cleaned.length > 11) {
    return { success: false, value: undefined, error: 'Invalid phone number length' };
  }
  
  // Validate starts with 0
  if (!cleaned.startsWith('0')) {
    return { success: false, value: undefined, error: 'UK phone numbers should start with 0 or +44' };
  }
  
  return { success: true, value: cleaned, error: null };
};

/**
 * Parse a UK sort code
 * @param {string} sortCodeString - Sort code string (e.g., "12-34-56" or "123456")
 * @returns {ParseResult} Parse result with cleaned 6-digit sort code
 */
export const parseSortCode = (sortCodeString) => {
  if (!sortCodeString || typeof sortCodeString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid sort code' };
  }
  
  const cleaned = sortCodeString.replace(/[\s-]/g, '');
  
  if (!/^\d{6}$/.test(cleaned)) {
    return { success: false, value: undefined, error: 'Sort code must be 6 digits' };
  }
  
  return { success: true, value: cleaned, error: null };
};

/**
 * Parse a UK bank account number
 * @param {string} accountString - Account number string
 * @returns {ParseResult} Parse result with cleaned 8-digit account number
 */
export const parseUKBankAccount = (accountString) => {
  if (!accountString || typeof accountString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid account number' };
  }
  
  const cleaned = accountString.replace(/\s/g, '');
  
  if (!/^\d{8}$/.test(cleaned)) {
    return { success: false, value: undefined, error: 'Account number must be 8 digits' };
  }
  
  return { success: true, value: cleaned, error: null };
};

/**
 * Parse a UK VAT number
 * @param {string} vatString - VAT number string
 * @returns {ParseResult} Parse result with cleaned VAT number
 */
export const parseUKVatNumber = (vatString) => {
  if (!vatString || typeof vatString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid VAT number' };
  }
  
  const cleaned = vatString.replace(/\s/g, '').toUpperCase();
  
  // Standard 9-digit format
  if (/^GB\d{9}$/.test(cleaned)) {
    return { success: true, value: cleaned, error: null };
  }
  
  // Branch 12-digit format
  if (/^GB\d{12}$/.test(cleaned)) {
    return { success: true, value: cleaned, error: null };
  }
  
  // Government department format
  if (/^GBGD\d{3}$/.test(cleaned)) {
    return { success: true, value: cleaned, error: null };
  }
  
  // Health authority format
  if (/^GBHA\d{3}$/.test(cleaned)) {
    return { success: true, value: cleaned, error: null };
  }
  
  // If no GB prefix, try adding it
  if (/^\d{9}$/.test(cleaned)) {
    return { success: true, value: 'GB' + cleaned, error: null };
  }
  
  return { success: false, value: undefined, error: 'Invalid UK VAT number format' };
};

/**
 * Parse a UK company number
 * @param {string} companyString - Company number string
 * @returns {ParseResult} Parse result with cleaned company number
 */
export const parseUKCompanyNumber = (companyString) => {
  if (!companyString || typeof companyString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid company number' };
  }
  
  const cleaned = companyString.replace(/\s/g, '').toUpperCase();
  
  // 8-digit numeric format
  if (/^\d{1,8}$/.test(cleaned)) {
    return { success: true, value: cleaned.padStart(8, '0'), error: null };
  }
  
  // 2 letters + 6 digits format (Scottish, etc.)
  if (/^[A-Z]{2}\d{6}$/.test(cleaned)) {
    return { success: true, value: cleaned, error: null };
  }
  
  return { success: false, value: undefined, error: 'Invalid UK company number format' };
};

/**
 * Parse a UK National Insurance Number
 * @param {string} ninoString - NINO string
 * @returns {ParseResult} Parse result with cleaned NINO
 */
export const parseNINO = (ninoString) => {
  if (!ninoString || typeof ninoString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid National Insurance Number' };
  }
  
  const cleaned = ninoString.replace(/\s/g, '').toUpperCase();
  
  // NINO format: 2 letters + 6 digits + 1 letter
  if (!/^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}\d{6}[A-D]$/i.test(cleaned)) {
    return { success: false, value: undefined, error: 'Invalid NINO format' };
  }
  
  return { success: true, value: cleaned, error: null };
};

/**
 * Parse a Unique Taxpayer Reference
 * @param {string} utrString - UTR string
 * @returns {ParseResult} Parse result with cleaned 10-digit UTR
 */
export const parseUTR = (utrString) => {
  if (!utrString || typeof utrString !== 'string') {
    return { success: false, value: undefined, error: 'Invalid UTR' };
  }
  
  const cleaned = utrString.replace(/\D/g, '');
  
  if (cleaned.length !== 10) {
    return { success: false, value: undefined, error: 'UTR must be 10 digits' };
  }
  
  return { success: true, value: cleaned, error: null };
};

/**
 * Convert a UK date string to ISO format (YYYY-MM-DD)
 * @param {string} ukDateString - Date in DD/MM/YYYY format
 * @returns {string|null} ISO date string or null if invalid
 */
export const ukDateToISO = (ukDateString) => {
  const result = parseUKDate(ukDateString);
  if (!result.success) return null;
  
  const date = result.value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Convert an ISO date string to UK format (DD/MM/YYYY)
 * @param {string} isoDateString - Date in YYYY-MM-DD format
 * @returns {string|null} UK date string or null if invalid
 */
export const isoDateToUK = (isoDateString) => {
  if (!isoDateString) return null;
  
  const match = isoDateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

/**
 * Try to parse a date in any common format
 * @param {string} dateString - Date string in any format
 * @returns {ParseResult} Parse result with Date value
 */
export const parseDateAny = (dateString) => {
  if (!dateString) {
    return { success: false, value: undefined, error: 'Empty date string' };
  }
  
  // Try UK format first
  const ukResult = parseUKDate(dateString);
  if (ukResult.success) {
    return ukResult;
  }
  
  // Try native Date parsing
  const nativeDate = new Date(dateString);
  if (!isNaN(nativeDate.getTime())) {
    return { success: true, value: nativeDate, error: null };
  }
  
  return { success: false, value: undefined, error: 'Unrecognized date format' };
};

export default {
  parseUKDate,
  parseUKNumber,
  parseUKCurrency,
  parsePercentage,
  parseUKPhone,
  parseSortCode,
  parseUKBankAccount,
  parseUKVatNumber,
  parseUKCompanyNumber,
  parseNINO,
  parseUTR,
  ukDateToISO,
  isoDateToUK,
  parseDateAny,
};
