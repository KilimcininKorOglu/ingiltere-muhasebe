/**
 * VAT Registration Threshold Monitoring Service
 * 
 * Monitors user's turnover against the UK VAT registration threshold.
 * Calculates rolling 12-month turnover and provides warnings when
 * approaching or exceeding the threshold.
 * 
 * UK VAT Registration Rules:
 * - Must register if taxable turnover exceeds £90,000 in the past 12 months
 * - Or if expected to exceed £90,000 in the next 30 days alone
 * 
 * @module services/vatThresholdService
 */

const { query, queryOne } = require('../database/index');
const { getCurrentTaxRates } = require('../config/taxRates');
const taxRatesService = require('./taxRatesService');

/**
 * Warning level identifiers for VAT threshold status
 */
const WARNING_LEVELS = {
  NONE: 'none',
  APPROACHING: 'approaching', // 75% of threshold
  IMMINENT: 'imminent',       // 90% of threshold
  EXCEEDED: 'exceeded'        // 100% or more of threshold
};

/**
 * Calculates the date range for the rolling 12-month period.
 * 
 * @param {Date|string} [asOfDate] - The reference date (defaults to today)
 * @returns {{startDate: string, endDate: string}} The 12-month date range
 */
function getRolling12MonthRange(asOfDate = new Date()) {
  const endDate = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setDate(startDate.getDate() + 1); // Start from day after one year ago
  
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

/**
 * Calculates the rolling 12-month turnover for a user.
 * Turnover is calculated from income transactions (taxable sales).
 * 
 * For VAT purposes, turnover includes:
 * - All sales of goods and services (before VAT is added)
 * - NOT including exempt supplies or non-business income
 * 
 * @param {number} userId - The user's ID
 * @param {Date|string} [asOfDate] - Reference date for calculation (defaults to today)
 * @returns {{
 *   turnover: number,
 *   startDate: string,
 *   endDate: string,
 *   transactionCount: number,
 *   breakdown: Array<{month: string, amount: number}>
 * }} Turnover calculation result
 */
function calculateRolling12MonthTurnover(userId, asOfDate = new Date()) {
  const dateRange = getRolling12MonthRange(asOfDate);
  
  // Get total turnover from income transactions
  // Note: We use the 'amount' field (net before VAT) as this is the taxable turnover
  const totalResult = queryOne(`
    SELECT 
      COALESCE(SUM(amount), 0) as totalAmount,
      COUNT(id) as transactionCount
    FROM transactions
    WHERE userId = ?
      AND type = 'income'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
  `, [userId, dateRange.startDate, dateRange.endDate]);
  
  // Get monthly breakdown for detailed analysis
  const monthlyBreakdown = query(`
    SELECT 
      strftime('%Y-%m', transactionDate) as month,
      COALESCE(SUM(amount), 0) as amount
    FROM transactions
    WHERE userId = ?
      AND type = 'income'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
    GROUP BY strftime('%Y-%m', transactionDate)
    ORDER BY month ASC
  `, [userId, dateRange.startDate, dateRange.endDate]);
  
  return {
    turnover: totalResult?.totalAmount || 0,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    transactionCount: totalResult?.transactionCount || 0,
    breakdown: monthlyBreakdown.map(row => ({
      month: row.month,
      amount: row.amount
    }))
  };
}

/**
 * Calculates the projected 30-day forward turnover.
 * Uses average daily turnover from the past 3 months to project.
 * 
 * @param {number} userId - The user's ID
 * @param {Date|string} [asOfDate] - Reference date for calculation
 * @returns {{
 *   projectedAmount: number,
 *   averageDailyTurnover: number,
 *   basedOnDays: number
 * }} Projected turnover data
 */
function calculateProjected30DayTurnover(userId, asOfDate = new Date()) {
  const endDate = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 3);
  
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(amount), 0) as totalAmount,
      MIN(transactionDate) as firstDate,
      MAX(transactionDate) as lastDate
    FROM transactions
    WHERE userId = ?
      AND type = 'income'
      AND status != 'void'
      AND transactionDate >= ?
      AND transactionDate <= ?
  `, [userId, formatDate(startDate), formatDate(endDate)]);
  
  const totalAmount = result?.totalAmount || 0;
  
  // Calculate number of days in the period
  const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const basedOnDays = daysDiff > 0 ? daysDiff : 90; // Default to 90 days
  
  const averageDailyTurnover = basedOnDays > 0 
    ? Math.round(totalAmount / basedOnDays) 
    : 0;
  
  // Project 30 days forward
  const projectedAmount = averageDailyTurnover * 30;
  
  return {
    projectedAmount,
    averageDailyTurnover,
    basedOnDays
  };
}

/**
 * Gets the VAT threshold configuration from tax rates.
 * First tries to read from database, falls back to config file.
 * 
 * @param {string} [taxYear] - Tax year to get threshold for (defaults to current)
 * @returns {{
 *   registrationThreshold: number,
 *   deregistrationThreshold: number,
 *   warningLevels: Object
 * }} VAT threshold configuration
 */
function getVatThresholdConfig(taxYear) {
  // Try to get from database first
  try {
    const dbThresholds = taxRatesService.getVatThresholds(taxYear);
    if (dbThresholds && dbThresholds.registrationThreshold) {
      return {
        registrationThreshold: dbThresholds.registrationThreshold / 100, // Convert pence to pounds
        deregistrationThreshold: dbThresholds.deregistrationThreshold / 100,
        warningLevels: {
          approaching: { percentage: 0.75 },
          imminent: { percentage: 0.90 },
          exceeded: { percentage: 1.00 }
        }
      };
    }
  } catch {
    // Fall back to config file
  }

  // Fallback to config file
  const taxRates = getCurrentTaxRates();
  const vatConfig = taxRates?.vat || {};
  
  return {
    registrationThreshold: vatConfig.thresholds?.registration?.amount || 90000,
    deregistrationThreshold: vatConfig.thresholds?.deregistration?.amount || 88000,
    warningLevels: vatConfig.warningLevels || {
      approaching: { percentage: 0.75 },
      imminent: { percentage: 0.90 },
      exceeded: { percentage: 1.00 }
    }
  };
}

/**
 * Determines the warning level based on turnover and threshold.
 * 
 * @param {number} turnover - Current rolling 12-month turnover (in pence)
 * @param {number} threshold - VAT registration threshold (in pounds)
 * @param {Object} warningLevels - Warning level percentages
 * @returns {{
 *   level: string,
 *   percentage: number,
 *   thresholdAmount: number,
 *   remainingUntilThreshold: number
 * }} Warning level details
 */
function determineWarningLevel(turnover, threshold, warningLevels) {
  // Convert threshold from pounds to pence for comparison
  const thresholdPence = threshold * 100;
  
  // Calculate percentage of threshold reached
  const percentageReached = thresholdPence > 0 
    ? turnover / thresholdPence 
    : 0;
  
  // Determine warning level
  let level = WARNING_LEVELS.NONE;
  
  if (percentageReached >= warningLevels.exceeded.percentage) {
    level = WARNING_LEVELS.EXCEEDED;
  } else if (percentageReached >= warningLevels.imminent.percentage) {
    level = WARNING_LEVELS.IMMINENT;
  } else if (percentageReached >= warningLevels.approaching.percentage) {
    level = WARNING_LEVELS.APPROACHING;
  }
  
  return {
    level,
    percentage: Math.round(percentageReached * 10000) / 100, // Percentage with 2 decimals
    thresholdAmount: thresholdPence,
    remainingUntilThreshold: Math.max(0, thresholdPence - turnover)
  };
}

/**
 * Gets the warning message for a given warning level.
 * 
 * @param {string} level - Warning level identifier
 * @param {Object} config - VAT threshold configuration with warning levels
 * @param {string} [lang='en'] - Language code (en or tr)
 * @returns {string|null} Warning message or null if no warning
 */
function getWarningMessage(level, config, lang = 'en') {
  if (level === WARNING_LEVELS.NONE) {
    return null;
  }
  
  const warningConfig = config.warningLevels[level];
  if (!warningConfig) {
    return null;
  }
  
  return warningConfig.description?.[lang] || warningConfig.description?.en || null;
}

/**
 * Generates a comprehensive VAT threshold status report for a user.
 * This is the main function to call for threshold monitoring.
 * 
 * @param {number} userId - The user's ID
 * @param {boolean} isVatRegistered - Whether the user is already VAT registered
 * @param {Date|string} [asOfDate] - Reference date for calculations
 * @returns {{
 *   isVatRegistered: boolean,
 *   requiresMonitoring: boolean,
 *   turnover: {
 *     rolling12Month: number,
 *     startDate: string,
 *     endDate: string,
 *     transactionCount: number,
 *     monthlyBreakdown: Array
 *   },
 *   projection: {
 *     next30Days: number,
 *     averageDaily: number
 *   },
 *   threshold: {
 *     registrationAmount: number,
 *     deregistrationAmount: number
 *   },
 *   warning: {
 *     level: string,
 *     percentage: number,
 *     remainingUntilThreshold: number,
 *     message: { en: string|null, tr: string|null }
 *   },
 *   calculatedAt: string
 * }} VAT threshold status report
 */
function getVatThresholdStatus(userId, isVatRegistered = false, asOfDate = new Date()) {
  const config = getVatThresholdConfig();
  
  // VAT-registered users don't need threshold monitoring
  // But we still calculate for information purposes
  const requiresMonitoring = !isVatRegistered;
  
  // Calculate rolling 12-month turnover
  const turnoverData = calculateRolling12MonthTurnover(userId, asOfDate);
  
  // Calculate projected 30-day turnover
  const projectionData = calculateProjected30DayTurnover(userId, asOfDate);
  
  // Determine warning level (only relevant for non-VAT-registered users)
  const warningDetails = requiresMonitoring
    ? determineWarningLevel(turnoverData.turnover, config.registrationThreshold, config.warningLevels)
    : {
        level: WARNING_LEVELS.NONE,
        percentage: 0,
        thresholdAmount: config.registrationThreshold * 100,
        remainingUntilThreshold: 0
      };
  
  return {
    isVatRegistered,
    requiresMonitoring,
    turnover: {
      rolling12Month: turnoverData.turnover,
      startDate: turnoverData.startDate,
      endDate: turnoverData.endDate,
      transactionCount: turnoverData.transactionCount,
      monthlyBreakdown: turnoverData.breakdown
    },
    projection: {
      next30Days: projectionData.projectedAmount,
      averageDaily: projectionData.averageDailyTurnover
    },
    threshold: {
      registrationAmount: config.registrationThreshold * 100, // Convert to pence for consistency
      deregistrationAmount: config.deregistrationThreshold * 100
    },
    warning: {
      level: warningDetails.level,
      percentage: warningDetails.percentage,
      remainingUntilThreshold: warningDetails.remainingUntilThreshold,
      message: {
        en: requiresMonitoring ? getWarningMessage(warningDetails.level, config, 'en') : null,
        tr: requiresMonitoring ? getWarningMessage(warningDetails.level, config, 'tr') : null
      }
    },
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Formats monetary amounts for display.
 * Converts pence to pounds with proper formatting.
 * 
 * @param {number} amountInPence - Amount in pence
 * @param {string} [currency='GBP'] - Currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(amountInPence, currency = 'GBP') {
  const pounds = amountInPence / 100;
  
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(pounds);
}

/**
 * Gets a summary of the threshold status suitable for dashboard display.
 * 
 * @param {Object} status - Full threshold status from getVatThresholdStatus
 * @param {string} [lang='en'] - Language code
 * @returns {{
 *   showWarning: boolean,
 *   warningLevel: string,
 *   headline: string,
 *   details: string,
 *   turnoverFormatted: string,
 *   thresholdFormatted: string,
 *   percentageFormatted: string,
 *   remainingFormatted: string
 * }} Dashboard summary
 */
function getDashboardSummary(status, lang = 'en') {
  const showWarning = status.requiresMonitoring && status.warning.level !== WARNING_LEVELS.NONE;
  
  const headlines = {
    en: {
      [WARNING_LEVELS.NONE]: 'VAT status: Below threshold',
      [WARNING_LEVELS.APPROACHING]: 'VAT Warning: Approaching threshold',
      [WARNING_LEVELS.IMMINENT]: 'VAT Alert: Registration imminent',
      [WARNING_LEVELS.EXCEEDED]: 'VAT Required: Threshold exceeded'
    },
    tr: {
      [WARNING_LEVELS.NONE]: 'KDV durumu: Eşik altında',
      [WARNING_LEVELS.APPROACHING]: 'KDV Uyarısı: Eşiğe yaklaşıyor',
      [WARNING_LEVELS.IMMINENT]: 'KDV Uyarısı: Kayıt yakın',
      [WARNING_LEVELS.EXCEEDED]: 'KDV Gerekli: Eşik aşıldı'
    }
  };
  
  const details = {
    en: {
      [WARNING_LEVELS.NONE]: `Your rolling 12-month turnover is ${status.warning.percentage.toFixed(1)}% of the VAT threshold.`,
      [WARNING_LEVELS.APPROACHING]: `You are at ${status.warning.percentage.toFixed(1)}% of the VAT threshold. Consider preparing for VAT registration.`,
      [WARNING_LEVELS.IMMINENT]: `You are at ${status.warning.percentage.toFixed(1)}% of the VAT threshold. Start preparing for VAT registration now.`,
      [WARNING_LEVELS.EXCEEDED]: `You have exceeded the VAT registration threshold. You must register for VAT within 30 days.`
    },
    tr: {
      [WARNING_LEVELS.NONE]: `Son 12 aylık cironuz KDV eşiğinin %${status.warning.percentage.toFixed(1)}'i.`,
      [WARNING_LEVELS.APPROACHING]: `KDV eşiğinin %${status.warning.percentage.toFixed(1)}'indesiniz. KDV kaydına hazırlanmayı düşünün.`,
      [WARNING_LEVELS.IMMINENT]: `KDV eşiğinin %${status.warning.percentage.toFixed(1)}'indesiniz. Şimdi KDV kaydına hazırlanmaya başlayın.`,
      [WARNING_LEVELS.EXCEEDED]: `KDV kayıt eşiğini aştınız. 30 gün içinde KDV kaydı yaptırmanız gerekmektedir.`
    }
  };
  
  const langHeadlines = headlines[lang] || headlines.en;
  const langDetails = details[lang] || details.en;
  
  return {
    showWarning,
    warningLevel: status.warning.level,
    headline: langHeadlines[status.warning.level] || langHeadlines[WARNING_LEVELS.NONE],
    details: langDetails[status.warning.level] || langDetails[WARNING_LEVELS.NONE],
    turnoverFormatted: formatCurrency(status.turnover.rolling12Month),
    thresholdFormatted: formatCurrency(status.threshold.registrationAmount),
    percentageFormatted: `${status.warning.percentage.toFixed(1)}%`,
    remainingFormatted: formatCurrency(status.warning.remainingUntilThreshold)
  };
}

module.exports = {
  // Main functions
  getVatThresholdStatus,
  getDashboardSummary,
  
  // Calculation functions
  calculateRolling12MonthTurnover,
  calculateProjected30DayTurnover,
  
  // Helper functions
  getRolling12MonthRange,
  getVatThresholdConfig,
  determineWarningLevel,
  getWarningMessage,
  formatCurrency,
  
  // Constants
  WARNING_LEVELS
};
