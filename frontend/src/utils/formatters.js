/**
 * Formatting Utilities
 * Provides UK-standard formatting for dates, numbers, and currency.
 * Supports both English and Turkish locales.
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
 * @param {string} [locale='en-GB'] - Locale for formatting (defaults to UK)
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'short', locale = UK_LOCALE) => {
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
export const formatDateTime = (date, dateFormat = 'short', timeFormat = 'short', locale = UK_LOCALE) => {
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
 * @param {string} [format='short'] - Format style: 'short', 'medium', 'long'
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted time string
 */
export const formatTime = (date, format = 'short', locale = UK_LOCALE) => {
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
export const formatNumber = (value, options = {}) => {
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
export const formatInteger = (value, locale = UK_LOCALE) => {
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
export const formatDecimal = (value, decimals = 2, locale = UK_LOCALE) => {
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
export const formatCurrency = (value, options = {}) => {
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
 * Format currency without the symbol (useful for inputs)
 * @param {number|string} value - Amount to format
 * @param {number} [decimals=2] - Number of decimal places
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted amount without currency symbol
 */
export const formatCurrencyValue = (value, decimals = 2, locale = UK_LOCALE) => {
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
export const formatPercentage = (value, options = {}) => {
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
 * Format a date for HTML date input (YYYY-MM-DD)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
export const formatDateForInput = (date) => {
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
 * Format a UK date string (DD/MM/YYYY) for display
 * @param {string} ukDateString - Date in DD/MM/YYYY format
 * @param {string} [format='short'] - Output format style
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Formatted date string
 */
export const formatUKDateString = (ukDateString, format = 'short', locale = UK_LOCALE) => {
  if (!ukDateString) return '';
  
  // Parse DD/MM/YYYY format
  const parts = ukDateString.split('/');
  if (parts.length !== 3) return ukDateString;
  
  const [day, month, year] = parts;
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  
  return formatDate(dateObj, format, locale);
};

/**
 * Format a phone number for display
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // UK mobile format: 07XXX XXX XXX
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  
  // UK landline format: 0XX XXXX XXXX or 0XXX XXX XXXX
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
 * Format a sort code for display
 * @param {string} sortCode - Sort code (6 digits)
 * @returns {string} Formatted sort code (XX-XX-XX)
 */
export const formatSortCode = (sortCode) => {
  if (!sortCode) return '';
  
  const cleaned = sortCode.replace(/\D/g, '');
  
  if (cleaned.length !== 6) return sortCode;
  
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
};

/**
 * Format a UK company number for display
 * @param {string} companyNumber - Company number
 * @returns {string} Formatted company number
 */
export const formatCompanyNumber = (companyNumber) => {
  if (!companyNumber) return '';
  
  const cleaned = companyNumber.replace(/\s/g, '').toUpperCase();
  
  // Add leading zeros if numeric and less than 8 digits
  if (/^\d+$/.test(cleaned) && cleaned.length < 8) {
    return cleaned.padStart(8, '0');
  }
  
  return cleaned;
};

/**
 * Format a UK VAT number for display
 * @param {string} vatNumber - VAT number
 * @returns {string} Formatted VAT number
 */
export const formatVatNumber = (vatNumber) => {
  if (!vatNumber) return '';
  
  const cleaned = vatNumber.replace(/\s/g, '').toUpperCase();
  
  // Standard format: GB XXX XXXX XX
  if (/^GB\d{9}$/.test(cleaned)) {
    return `GB ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9)}`;
  }
  
  // Branch format: GB XXX XXXX XX XXX
  if (/^GB\d{12}$/.test(cleaned)) {
    return `GB ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9, 11)} ${cleaned.slice(11)}`;
  }
  
  return cleaned;
};

/**
 * Format a UK National Insurance Number for display
 * @param {string} nino - National Insurance Number
 * @returns {string} Formatted NINO (XX XX XX XX X)
 */
export const formatNINO = (nino) => {
  if (!nino) return '';
  
  const cleaned = nino.replace(/\s/g, '').toUpperCase();
  
  if (cleaned.length !== 9) return nino;
  
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
};

/**
 * Format a Unique Taxpayer Reference for display
 * @param {string} utr - UTR (10 digits)
 * @returns {string} Formatted UTR (XXXXX XXXXX)
 */
export const formatUTR = (utr) => {
  if (!utr) return '';
  
  const cleaned = utr.replace(/\D/g, '');
  
  if (cleaned.length !== 10) return utr;
  
  return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
};

/**
 * Format a relative date (e.g., "2 days ago", "in 3 hours")
 * @param {Date|string|number} date - Date to format
 * @param {string} [locale='en-GB'] - Locale for formatting
 * @returns {string} Relative date string
 */
export const formatRelativeDate = (date, locale = UK_LOCALE) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diffMs = dateObj.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    if (Math.abs(diffDays) < 1) {
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      if (Math.abs(diffHours) < 1) {
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return rtf.format(diffMinutes, 'minute');
      }
      return rtf.format(diffHours, 'hour');
    }
    
    if (Math.abs(diffDays) < 30) {
      return rtf.format(diffDays, 'day');
    }
    
    if (Math.abs(diffDays) < 365) {
      const diffMonths = Math.round(diffDays / 30);
      return rtf.format(diffMonths, 'month');
    }
    
    const diffYears = Math.round(diffDays / 365);
    return rtf.format(diffYears, 'year');
  } catch {
    return '';
  }
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return '';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Get the UK locale for the given language
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {string} Locale code
 */
export const getLocaleForLanguage = (language) => {
  // Always use UK locale for number and currency formatting
  // but can adjust date display language
  if (language === 'tr') {
    return 'tr-TR';
  }
  return UK_LOCALE;
};

export default {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatInteger,
  formatDecimal,
  formatCurrency,
  formatCurrencyValue,
  formatPercentage,
  formatDateForInput,
  formatUKDateString,
  formatPhoneNumber,
  formatSortCode,
  formatCompanyNumber,
  formatVatNumber,
  formatNINO,
  formatUTR,
  formatRelativeDate,
  formatFileSize,
  getLocaleForLanguage,
};
