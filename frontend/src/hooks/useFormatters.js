/**
 * useFormatters Hook
 * Custom React hook that provides locale-aware formatting functions.
 * Integrates with i18n to automatically adjust formatting based on user's language preference.
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
} from '../utils/formatters';
import {
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
} from '../utils/parsers';

/**
 * UK locale for consistent number formatting
 */
const UK_LOCALE = 'en-GB';

/**
 * Custom hook for locale-aware formatting
 * @returns {Object} Object containing formatting and parsing functions
 */
const useFormatters = () => {
  const { i18n } = useTranslation();
  
  /**
   * Get the current locale based on i18n language
   * Always uses UK locale for numbers/currency for consistency
   */
  const locale = useMemo(() => {
    return getLocaleForLanguage(i18n.language);
  }, [i18n.language]);
  
  /**
   * Format a date with the current locale
   */
  const fmtDate = useCallback((date, format = 'short') => {
    // Use UK locale for dates to ensure DD/MM/YYYY format
    return formatDate(date, format, UK_LOCALE);
  }, []);
  
  /**
   * Format a date and time
   */
  const fmtDateTime = useCallback((date, dateFormat = 'short', timeFormat = 'short') => {
    return formatDateTime(date, dateFormat, timeFormat, UK_LOCALE);
  }, []);
  
  /**
   * Format time only
   */
  const fmtTime = useCallback((date, format = 'short') => {
    return formatTime(date, format, UK_LOCALE);
  }, []);
  
  /**
   * Format a number with locale-aware grouping
   */
  const fmtNumber = useCallback((value, options = {}) => {
    return formatNumber(value, { ...options, locale: UK_LOCALE });
  }, []);
  
  /**
   * Format an integer (no decimal places)
   */
  const fmtInteger = useCallback((value) => {
    return formatInteger(value, UK_LOCALE);
  }, []);
  
  /**
   * Format a decimal number
   */
  const fmtDecimal = useCallback((value, decimals = 2) => {
    return formatDecimal(value, decimals, UK_LOCALE);
  }, []);
  
  /**
   * Format currency with £ symbol
   */
  const fmtCurrency = useCallback((value, options = {}) => {
    return formatCurrency(value, { ...options, locale: UK_LOCALE });
  }, []);
  
  /**
   * Format currency value without symbol
   */
  const fmtCurrencyValue = useCallback((value, decimals = 2) => {
    return formatCurrencyValue(value, decimals, UK_LOCALE);
  }, []);
  
  /**
   * Format a percentage
   */
  const fmtPercentage = useCallback((value, options = {}) => {
    return formatPercentage(value, { ...options, locale: UK_LOCALE });
  }, []);
  
  /**
   * Format date for HTML input (YYYY-MM-DD)
   */
  const fmtDateForInput = useCallback((date) => {
    return formatDateForInput(date);
  }, []);
  
  /**
   * Format a UK date string
   */
  const fmtUKDateString = useCallback((ukDateString, format = 'short') => {
    return formatUKDateString(ukDateString, format, UK_LOCALE);
  }, []);
  
  /**
   * Format phone number
   */
  const fmtPhone = useCallback((phone) => {
    return formatPhoneNumber(phone);
  }, []);
  
  /**
   * Format sort code
   */
  const fmtSortCode = useCallback((sortCode) => {
    return formatSortCode(sortCode);
  }, []);
  
  /**
   * Format company number
   */
  const fmtCompanyNumber = useCallback((companyNumber) => {
    return formatCompanyNumber(companyNumber);
  }, []);
  
  /**
   * Format VAT number
   */
  const fmtVatNumber = useCallback((vatNumber) => {
    return formatVatNumber(vatNumber);
  }, []);
  
  /**
   * Format National Insurance Number
   */
  const fmtNINO = useCallback((nino) => {
    return formatNINO(nino);
  }, []);
  
  /**
   * Format Unique Taxpayer Reference
   */
  const fmtUTR = useCallback((utr) => {
    return formatUTR(utr);
  }, []);
  
  /**
   * Format relative date (e.g., "2 days ago")
   */
  const fmtRelativeDate = useCallback((date) => {
    // Use current locale for relative dates as this is language-dependent
    return formatRelativeDate(date, locale);
  }, [locale]);
  
  /**
   * Format file size
   */
  const fmtFileSize = useCallback((bytes, decimals = 2) => {
    return formatFileSize(bytes, decimals);
  }, []);
  
  // Parsing functions
  
  /**
   * Parse a UK date
   */
  const prsDate = useCallback((dateString) => {
    return parseUKDate(dateString);
  }, []);
  
  /**
   * Parse a UK number
   */
  const prsNumber = useCallback((numberString) => {
    return parseUKNumber(numberString);
  }, []);
  
  /**
   * Parse UK currency
   */
  const prsCurrency = useCallback((currencyString) => {
    return parseUKCurrency(currencyString);
  }, []);
  
  /**
   * Parse percentage
   */
  const prsPercentage = useCallback((percentString, isDecimal = false) => {
    return parsePercentage(percentString, isDecimal);
  }, []);
  
  /**
   * Parse UK phone number
   */
  const prsPhone = useCallback((phoneString) => {
    return parseUKPhone(phoneString);
  }, []);
  
  /**
   * Parse sort code
   */
  const prsSortCode = useCallback((sortCodeString) => {
    return parseSortCode(sortCodeString);
  }, []);
  
  /**
   * Parse UK bank account
   */
  const prsBankAccount = useCallback((accountString) => {
    return parseUKBankAccount(accountString);
  }, []);
  
  /**
   * Parse UK VAT number
   */
  const prsVatNumber = useCallback((vatString) => {
    return parseUKVatNumber(vatString);
  }, []);
  
  /**
   * Parse UK company number
   */
  const prsCompanyNumber = useCallback((companyString) => {
    return parseUKCompanyNumber(companyString);
  }, []);
  
  /**
   * Parse National Insurance Number
   */
  const prsNINO = useCallback((ninoString) => {
    return parseNINO(ninoString);
  }, []);
  
  /**
   * Parse Unique Taxpayer Reference
   */
  const prsUTR = useCallback((utrString) => {
    return parseUTR(utrString);
  }, []);
  
  /**
   * Convert UK date to ISO format
   */
  const toISODate = useCallback((ukDateString) => {
    return ukDateToISO(ukDateString);
  }, []);
  
  /**
   * Convert ISO date to UK format
   */
  const toUKDate = useCallback((isoDateString) => {
    return isoDateToUK(isoDateString);
  }, []);
  
  /**
   * Parse any date format
   */
  const prsDateAny = useCallback((dateString) => {
    return parseDateAny(dateString);
  }, []);
  
  return {
    // Current locale
    locale,
    
    // Formatting functions
    formatDate: fmtDate,
    formatDateTime: fmtDateTime,
    formatTime: fmtTime,
    formatNumber: fmtNumber,
    formatInteger: fmtInteger,
    formatDecimal: fmtDecimal,
    formatCurrency: fmtCurrency,
    formatCurrencyValue: fmtCurrencyValue,
    formatPercentage: fmtPercentage,
    formatDateForInput: fmtDateForInput,
    formatUKDateString: fmtUKDateString,
    formatPhoneNumber: fmtPhone,
    formatSortCode: fmtSortCode,
    formatCompanyNumber: fmtCompanyNumber,
    formatVatNumber: fmtVatNumber,
    formatNINO: fmtNINO,
    formatUTR: fmtUTR,
    formatRelativeDate: fmtRelativeDate,
    formatFileSize: fmtFileSize,
    
    // Parsing functions
    parseDate: prsDate,
    parseNumber: prsNumber,
    parseCurrency: prsCurrency,
    parsePercentage: prsPercentage,
    parsePhone: prsPhone,
    parseSortCode: prsSortCode,
    parseBankAccount: prsBankAccount,
    parseVatNumber: prsVatNumber,
    parseCompanyNumber: prsCompanyNumber,
    parseNINO: prsNINO,
    parseUTR: prsUTR,
    parseDateAny: prsDateAny,
    
    // Date conversion utilities
    ukDateToISO: toISODate,
    isoDateToUK: toUKDate,
  };
};

export default useFormatters;
