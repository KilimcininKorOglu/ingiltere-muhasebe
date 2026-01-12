/**
 * Backend Formatting Utilities
 * Provides UK-standard formatting for dates, numbers, and currency.
 * Node.js CommonJS module for server-side use.
 */

/**
 * UK locale code for formatting
 */
const UK_LOCALE = 'en-GB';

/**
 * Default currency for UK
 */
const DEFAULT_CURRENCY = 'GBP';

/**
 * Date format options for different display styles
 */
const DATE_FORMAT_OPTIONS = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' }, // DD/MM/YYYY
  medium: { day: 'numeric', month: 'short', year: 'numeric' }, // 5 Jan 2024
  long: { day: 'numeric', month: 'long', year: 'numeric' }, // 5 January 2024
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, // Friday, 5 January 2024
};

/**
 * Time format options
 */
const TIME_FORMAT_OPTIONS = {
  short: { hour: '2-digit', minute: '2-digit', hour12: false }, // 14:30
  medium: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }, // 14:30:45
  long: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }, // 2:30:45 PM
};

/**
 * Format a date in UK format (DD/MM/YYYY by default)
 * @param {Date|string|number} date - Date to format
 * @param {string} [format='short'] - Format style: 'short', 'medium', 'long', 'full'
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted date string
 */
const formatDate = (date, format = 'short', locale = UK_LOCALE) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const options = DATE_FORMAT_OPTIONS[format] || DATE_FORMAT_OPTIONS.short;
    return dateObj.toLocaleDateString(locale, options);
  } catch {
    return '';
  }
};

/**
 * Format a date and time together
 * @param {Date|string|number} date - Date to format
 * @param {string} [dateFormat='short'] - Date format style
 * @param {string} [timeFormat='short'] - Time format style
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted date and time string
 */
const formatDateTime = (date, dateFormat = 'short', timeFormat = 'short', locale = UK_LOCALE) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const dateOptions = DATE_FORMAT_OPTIONS[dateFormat] || DATE_FORMAT_OPTIONS.short;
    const timeOptions = TIME_FORMAT_OPTIONS[timeFormat] || TIME_FORMAT_OPTIONS.short;
    
    const formattedDate = dateObj.toLocaleDateString(locale, dateOptions);
    const formattedTime = dateObj.toLocaleTimeString(locale, timeOptions);
    
    return `${formattedDate} ${formattedTime}`;
  } catch {
    return '';
  }
};

/**
 * Format time only
 * @param {Date|string|number} date - Date/time to format
 * @param {string} [format='short'] - Format style
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted time string
 */
const formatTime = (date, format = 'short', locale = UK_LOCALE) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const options = TIME_FORMAT_OPTIONS[format] || TIME_FORMAT_OPTIONS.short;
    return dateObj.toLocaleTimeString(locale, options);
  } catch {
    return '';
  }
};

/**
 * Format a number using UK formatting (comma as thousands separator)
 * @param {number|string} value - Number to format
 * @param {Object} [options] - Formatting options
 * @param {number} [options.minimumFractionDigits=0] - Minimum decimal places
 * @param {number} [options.maximumFractionDigits=2] - Maximum decimal places
 * @param {string} [options.locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted number string
 */
const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return '';
  
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    locale = UK_LOCALE,
  } = options;
  
  try {
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    
    if (isNaN(num)) {
      return '';
    }
    
    return num.toLocaleString(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    });
  } catch {
    return '';
  }
};

/**
 * Format an integer (no decimal places)
 * @param {number|string} value - Number to format
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted integer string
 */
const formatInteger = (value, locale = UK_LOCALE) => {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    locale,
  });
};

/**
 * Format a decimal number with specified precision
 * @param {number|string} value - Number to format
 * @param {number} [decimals=2] - Number of decimal places
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted decimal string
 */
const formatDecimal = (value, decimals = 2, locale = UK_LOCALE) => {
  return formatNumber(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    locale,
  });
};

/**
 * Format currency in UK format with £ symbol
 * @param {number|string} value - Amount to format
 * @param {Object} [options] - Formatting options
 * @param {string} [options.currency='GBP'] - Currency code
 * @param {string} [options.display='symbol'] - Currency display: 'symbol', 'code', 'name'
 * @param {number} [options.minimumFractionDigits=2] - Minimum decimal places
 * @param {number} [options.maximumFractionDigits=2] - Maximum decimal places
 * @param {string} [options.locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted currency string (e.g., "£1,234.56")
 */
const formatCurrency = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return '';
  
  const {
    currency = DEFAULT_CURRENCY,
    display = 'symbol',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    locale = UK_LOCALE,
  } = options;
  
  try {
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    
    if (isNaN(num)) {
      return '';
    }
    
    return num.toLocaleString(locale, {
      style: 'currency',
      currency,
      currencyDisplay: display,
      minimumFractionDigits,
      maximumFractionDigits,
    });
  } catch {
    return '';
  }
};

/**
 * Format currency without the symbol
 * @param {number|string} value - Amount to format
 * @param {number} [decimals=2] - Number of decimal places
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted amount without currency symbol
 */
const formatCurrencyValue = (value, decimals = 2, locale = UK_LOCALE) => {
  return formatDecimal(value, decimals, locale);
};

/**
 * Format a percentage value
 * @param {number|string} value - Percentage value (e.g., 20 for 20%)
 * @param {Object} [options] - Formatting options
 * @param {number} [options.minimumFractionDigits=0] - Minimum decimal places
 * @param {number} [options.maximumFractionDigits=2] - Maximum decimal places
 * @param {string} [options.locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted percentage string (e.g., "20%")
 */
const formatPercentage = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return '';
  
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    locale = UK_LOCALE,
  } = options;
  
  try {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      return '';
    }
    
    // Convert to decimal for percentage formatting (20% = 0.2)
    const decimalValue = num / 100;
    
    return decimalValue.toLocaleString(locale, {
      style: 'percent',
      minimumFractionDigits,
      maximumFractionDigits,
    });
  } catch {
    return '';
  }
};

/**
 * Format a date for ISO format (YYYY-MM-DD)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
const formatDateISO = (date) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

/**
 * Parse a UK date string (DD/MM/YYYY) to a Date object
 * @param {string} dateString - Date in DD/MM/YYYY format
 * @returns {Date|null} Parsed Date or null if invalid
 */
const parseUKDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const trimmed = dateString.trim();
  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  
  if (!match) {
    // Try ISO format
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }
    return null;
  }
  
  const [, day, month, year] = match;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return null;
  }
  
  const date = new Date(yearNum, monthNum - 1, dayNum);
  
  // Verify the date is valid
  if (
    date.getDate() !== dayNum ||
    date.getMonth() !== monthNum - 1 ||
    date.getFullYear() !== yearNum
  ) {
    return null;
  }
  
  return date;
};

/**
 * Parse a UK currency string to a number
 * @param {string} currencyString - Currency string (e.g., "£1,234.56")
 * @returns {number|null} Parsed number or null if invalid
 */
const parseUKCurrency = (currencyString) => {
  if (currencyString === null || currencyString === undefined) {
    return null;
  }
  
  if (typeof currencyString === 'number') {
    return isNaN(currencyString) ? null : currencyString;
  }
  
  if (typeof currencyString !== 'string') {
    return null;
  }
  
  const trimmed = currencyString.trim();
  if (trimmed === '') {
    return null;
  }
  
  // Handle negative amounts in parentheses
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
  
  if (!/^\d*\.?\d+$/.test(cleaned)) {
    return null;
  }
  
  let num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    return null;
  }
  
  if (isNegative) {
    num = -num;
  }
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
};

/**
 * Parse a UK number string
 * @param {string} numberString - Number string with possible UK formatting
 * @returns {number|null} Parsed number or null if invalid
 */
const parseUKNumber = (numberString) => {
  if (numberString === null || numberString === undefined) {
    return null;
  }
  
  if (typeof numberString === 'number') {
    return isNaN(numberString) ? null : numberString;
  }
  
  if (typeof numberString !== 'string') {
    return null;
  }
  
  const trimmed = numberString.trim();
  if (trimmed === '') {
    return null;
  }
  
  const cleaned = trimmed
    .replace(/£/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  if (!/^-?\d*\.?\d+$/.test(cleaned)) {
    return null;
  }
  
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? null : num;
};

/**
 * Convert UK date string to ISO format
 * @param {string} ukDateString - Date in DD/MM/YYYY format
 * @returns {string|null} ISO date string or null if invalid
 */
const ukDateToISO = (ukDateString) => {
  const date = parseUKDate(ukDateString);
  if (!date) return null;
  
  return formatDateISO(date);
};

/**
 * Convert ISO date string to UK format
 * @param {string} isoDateString - Date in YYYY-MM-DD format
 * @returns {string|null} UK date string or null if invalid
 */
const isoDateToUK = (isoDateString) => {
  if (!isoDateString) return null;
  
  const match = isoDateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // UK mobile format: 07XXX XXX XXX
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  
  // UK landline format
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    if (cleaned.startsWith('020') || cleaned.startsWith('011')) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  // International format with +44
  if (cleaned.startsWith('+44') && cleaned.length === 13) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  }
  
  return phone;
};

/**
 * Format sort code for display
 * @param {string} sortCode - Sort code (6 digits)
 * @returns {string} Formatted sort code (XX-XX-XX)
 */
const formatSortCode = (sortCode) => {
  if (!sortCode) return '';
  
  const cleaned = sortCode.replace(/\D/g, '');
  
  if (cleaned.length !== 6) return sortCode;
  
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
};

/**
 * Format VAT number for display
 * @param {string} vatNumber - VAT number
 * @returns {string} Formatted VAT number
 */
const formatVatNumber = (vatNumber) => {
  if (!vatNumber) return '';
  
  const cleaned = vatNumber.replace(/\s/g, '').toUpperCase();
  
  if (/^GB\d{9}$/.test(cleaned)) {
    return `GB ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9)}`;
  }
  
  if (/^GB\d{12}$/.test(cleaned)) {
    return `GB ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9, 11)} ${cleaned.slice(11)}`;
  }
  
  return cleaned;
};

/**
 * Format National Insurance Number for display
 * @param {string} nino - National Insurance Number
 * @returns {string} Formatted NINO
 */
const formatNINO = (nino) => {
  if (!nino) return '';
  
  const cleaned = nino.replace(/\s/g, '').toUpperCase();
  
  if (cleaned.length !== 9) return nino;
  
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
};

/**
 * Format UTR for display
 * @param {string} utr - Unique Taxpayer Reference
 * @returns {string} Formatted UTR
 */
const formatUTR = (utr) => {
  if (!utr) return '';
  
  const cleaned = utr.replace(/\D/g, '');
  
  if (cleaned.length !== 10) return utr;
  
  return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
};

/**
 * Format company number for display
 * @param {string} companyNumber - Company number
 * @returns {string} Formatted company number
 */
const formatCompanyNumber = (companyNumber) => {
  if (!companyNumber) return '';
  
  const cleaned = companyNumber.replace(/\s/g, '').toUpperCase();
  
  if (/^\d+$/.test(cleaned) && cleaned.length < 8) {
    return cleaned.padStart(8, '0');
  }
  
  return cleaned;
};

// Export all functions
module.exports = {
  // Constants
  UK_LOCALE,
  DEFAULT_CURRENCY,
  
  // Formatting functions
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatInteger,
  formatDecimal,
  formatCurrency,
  formatCurrencyValue,
  formatPercentage,
  formatDateISO,
  formatPhoneNumber,
  formatSortCode,
  formatVatNumber,
  formatNINO,
  formatUTR,
  formatCompanyNumber,
  
  // Parsing functions
  parseUKDate,
  parseUKCurrency,
  parseUKNumber,
  ukDateToISO,
  isoDateToUK,
};
