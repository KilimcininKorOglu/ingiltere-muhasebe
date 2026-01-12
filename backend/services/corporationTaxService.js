/**
 * Corporation Tax Service
 * 
 * Provides Corporation Tax estimation for UK limited companies based on their
 * annual profit. Applies correct rates and marginal relief where applicable.
 * 
 * UK Corporation Tax rates (from 1 April 2023):
 * - Small Profits Rate: 19% for profits up to £50,000
 * - Main Rate: 25% for profits over £250,000
 * - Marginal Relief: Gradual increase from 19% to 25% for profits between £50,000 and £250,000
 * 
 * Marginal Relief Formula:
 * Relief = (Upper Limit - Augmented Profits) × (Taxable Profits / Augmented Profits) × Marginal Relief Fraction
 * Where Marginal Relief Fraction = 3/200
 * 
 * For companies with no associated companies or distributions, the formula simplifies to:
 * Relief = (Upper Limit - Taxable Profits) × 3/200
 * 
 * @module services/corporationTaxService
 */

const profitLossService = require('./profitLossService');

/**
 * Corporation Tax thresholds and rates for financial years from 1 April 2023.
 * Note: These apply to financial years starting on or after 1 April 2023.
 * All monetary values are in PENCE to maintain consistency with other services.
 */
const CT_RATES = {
  // Lower limit for small profits rate (£50,000 in pence)
  LOWER_LIMIT: 5000000,
  // Upper limit for marginal relief (£250,000 in pence)
  UPPER_LIMIT: 25000000,
  // Small profits rate (19%)
  SMALL_PROFITS_RATE: 0.19,
  // Main rate (25%)
  MAIN_RATE: 0.25,
  // Marginal relief fraction (3/200)
  MARGINAL_RELIEF_FRACTION: 3 / 200
};

/**
 * Gets month name from month number.
 * 
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
function getMonthName(month) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1] || '';
}

/**
 * Validates date format (YYYY-MM-DD).
 * 
 * @param {string} date - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDateFormat(date) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date);
}

/**
 * Validates date range for corporation tax calculation.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
function validateDateRange(startDate, endDate) {
  if (!startDate || !isValidDateFormat(startDate)) {
    return { isValid: false, error: 'Invalid start date format (YYYY-MM-DD required)' };
  }
  
  if (!endDate || !isValidDateFormat(endDate)) {
    return { isValid: false, error: 'Invalid end date format (YYYY-MM-DD required)' };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'Invalid start date' };
  }
  
  if (isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid end date' };
  }
  
  if (start > end) {
    return { isValid: false, error: 'Start date must be before or equal to end date' };
  }
  
  return { isValid: true };
}

/**
 * Calculates the number of days in an accounting period.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {number} Number of days (inclusive)
 */
function calculatePeriodDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
  return diffDays;
}

/**
 * Adjusts thresholds for short accounting periods.
 * Thresholds are proportionately reduced for periods shorter than 12 months.
 * 
 * @param {number} periodDays - Number of days in the accounting period
 * @param {number} associatedCompanies - Number of associated companies (default 0)
 * @returns {{lowerLimit: number, upperLimit: number}} Adjusted thresholds
 */
function adjustThresholdsForPeriod(periodDays, associatedCompanies = 0) {
  const fullYearDays = 365;
  const periodFraction = periodDays / fullYearDays;
  
  // Thresholds are divided by (1 + number of associated companies)
  const associatedFactor = 1 + associatedCompanies;
  
  const lowerLimit = Math.round((CT_RATES.LOWER_LIMIT / associatedFactor) * periodFraction);
  const upperLimit = Math.round((CT_RATES.UPPER_LIMIT / associatedFactor) * periodFraction);
  
  return { lowerLimit, upperLimit };
}

/**
 * Determines the applicable tax rate category based on taxable profit.
 * 
 * @param {number} taxableProfit - The taxable profit in pence
 * @param {number} lowerLimit - The adjusted lower limit in pence
 * @param {number} upperLimit - The adjusted upper limit in pence
 * @returns {{rateCategory: string, rate: number, description: {en: string, tr: string}}}
 */
function determineRateCategory(taxableProfit, lowerLimit, upperLimit) {
  if (taxableProfit <= lowerLimit) {
    return {
      rateCategory: 'small_profits',
      rate: CT_RATES.SMALL_PROFITS_RATE,
      description: {
        en: 'Small Profits Rate (19%)',
        tr: 'Küçük Kar Oranı (%19)'
      }
    };
  }
  
  if (taxableProfit > upperLimit) {
    return {
      rateCategory: 'main_rate',
      rate: CT_RATES.MAIN_RATE,
      description: {
        en: 'Main Rate (25%)',
        tr: 'Ana Oran (%25)'
      }
    };
  }
  
  return {
    rateCategory: 'marginal_relief',
    rate: CT_RATES.MAIN_RATE, // Start with main rate, then apply relief
    description: {
      en: 'Main Rate with Marginal Relief (between 19% and 25%)',
      tr: 'Marjinal İndirimli Ana Oran (%19 ile %25 arasında)'
    }
  };
}

/**
 * Calculates marginal relief amount.
 * 
 * Formula: (Upper Limit - Taxable Profits) × 3/200
 * 
 * For companies with distributions from non-group companies:
 * Formula: (Upper Limit - Augmented Profits) × (Taxable Profits / Augmented Profits) × 3/200
 * 
 * @param {number} taxableProfit - The taxable profit in pence
 * @param {number} upperLimit - The adjusted upper limit in pence
 * @param {number} augmentedProfits - Taxable profit plus distributions (default: same as taxableProfit)
 * @returns {number} Marginal relief amount in pence
 */
function calculateMarginalRelief(taxableProfit, upperLimit, augmentedProfits = null) {
  // If no distributions, augmented profits equal taxable profits
  const augmented = augmentedProfits !== null ? augmentedProfits : taxableProfit;
  
  if (augmented <= 0 || taxableProfit <= 0) {
    return 0;
  }
  
  // Marginal Relief = (Upper Limit - Augmented Profits) × (Taxable Profits / Augmented Profits) × 3/200
  const relief = (upperLimit - augmented) * (taxableProfit / augmented) * CT_RATES.MARGINAL_RELIEF_FRACTION;
  
  return Math.round(Math.max(0, relief));
}

/**
 * Calculates Corporation Tax for a given taxable profit.
 * 
 * @param {number} taxableProfit - The taxable profit in pence
 * @param {Object} options - Calculation options
 * @param {number} [options.periodDays=365] - Number of days in accounting period
 * @param {number} [options.associatedCompanies=0] - Number of associated companies
 * @param {number} [options.distributions=0] - Distributions from non-group companies
 * @returns {{
 *   taxableProfit: number,
 *   taxBeforeMarginalRelief: number,
 *   marginalRelief: number,
 *   corporationTax: number,
 *   effectiveRate: number,
 *   rateCategory: string,
 *   rateDescription: {en: string, tr: string},
 *   thresholds: {lowerLimit: number, upperLimit: number},
 *   calculationSteps: Array<{step: string, description: {en: string, tr: string}, value: number}>
 * }}
 */
function calculateCorporationTax(taxableProfit, options = {}) {
  const {
    periodDays = 365,
    associatedCompanies = 0,
    distributions = 0
  } = options;
  
  // Handle zero or negative profit
  if (taxableProfit <= 0) {
    return {
      taxableProfit: 0,
      taxBeforeMarginalRelief: 0,
      marginalRelief: 0,
      corporationTax: 0,
      effectiveRate: 0,
      rateCategory: 'no_tax',
      rateDescription: {
        en: 'No profit - no Corporation Tax due',
        tr: 'Kar yok - Kurumlar Vergisi yok'
      },
      thresholds: adjustThresholdsForPeriod(periodDays, associatedCompanies),
      calculationSteps: [{
        step: 'no_profit',
        description: {
          en: 'No taxable profit, no Corporation Tax payable',
          tr: 'Vergilendirilebilir kar yok, Kurumlar Vergisi ödenecek değil'
        },
        value: 0
      }]
    };
  }
  
  // Adjust thresholds for period length and associated companies
  const { lowerLimit, upperLimit } = adjustThresholdsForPeriod(periodDays, associatedCompanies);
  
  // Calculate augmented profits (taxable profit + distributions from non-group companies)
  const augmentedProfits = taxableProfit + distributions;
  
  // Determine rate category based on augmented profits
  const { rateCategory, rate, description } = determineRateCategory(augmentedProfits, lowerLimit, upperLimit);
  
  const calculationSteps = [];
  let taxBeforeMarginalRelief = 0;
  let marginalRelief = 0;
  let corporationTax = 0;
  
  if (rateCategory === 'small_profits') {
    // Apply small profits rate (19%)
    corporationTax = Math.round(taxableProfit * CT_RATES.SMALL_PROFITS_RATE);
    taxBeforeMarginalRelief = corporationTax;
    
    calculationSteps.push({
      step: 'apply_small_profits_rate',
      description: {
        en: `Taxable profit £${(taxableProfit / 100).toFixed(2)} × 19% = £${(corporationTax / 100).toFixed(2)}`,
        tr: `Vergilendirilebilir kar £${(taxableProfit / 100).toFixed(2)} × %19 = £${(corporationTax / 100).toFixed(2)}`
      },
      value: corporationTax
    });
  } else if (rateCategory === 'main_rate') {
    // Apply main rate (25%)
    corporationTax = Math.round(taxableProfit * CT_RATES.MAIN_RATE);
    taxBeforeMarginalRelief = corporationTax;
    
    calculationSteps.push({
      step: 'apply_main_rate',
      description: {
        en: `Taxable profit £${(taxableProfit / 100).toFixed(2)} × 25% = £${(corporationTax / 100).toFixed(2)}`,
        tr: `Vergilendirilebilir kar £${(taxableProfit / 100).toFixed(2)} × %25 = £${(corporationTax / 100).toFixed(2)}`
      },
      value: corporationTax
    });
  } else {
    // Apply main rate then subtract marginal relief
    taxBeforeMarginalRelief = Math.round(taxableProfit * CT_RATES.MAIN_RATE);
    
    calculationSteps.push({
      step: 'apply_main_rate',
      description: {
        en: `Taxable profit £${(taxableProfit / 100).toFixed(2)} × 25% = £${(taxBeforeMarginalRelief / 100).toFixed(2)}`,
        tr: `Vergilendirilebilir kar £${(taxableProfit / 100).toFixed(2)} × %25 = £${(taxBeforeMarginalRelief / 100).toFixed(2)}`
      },
      value: taxBeforeMarginalRelief
    });
    
    // Calculate marginal relief
    marginalRelief = calculateMarginalRelief(taxableProfit, upperLimit, augmentedProfits);
    
    calculationSteps.push({
      step: 'calculate_marginal_relief',
      description: {
        en: `Marginal Relief: (£${(upperLimit / 100).toFixed(2)} - £${(augmentedProfits / 100).toFixed(2)}) × 3/200 = £${(marginalRelief / 100).toFixed(2)}`,
        tr: `Marjinal İndirim: (£${(upperLimit / 100).toFixed(2)} - £${(augmentedProfits / 100).toFixed(2)}) × 3/200 = £${(marginalRelief / 100).toFixed(2)}`
      },
      value: marginalRelief
    });
    
    corporationTax = taxBeforeMarginalRelief - marginalRelief;
    
    calculationSteps.push({
      step: 'apply_marginal_relief',
      description: {
        en: `Tax after relief: £${(taxBeforeMarginalRelief / 100).toFixed(2)} - £${(marginalRelief / 100).toFixed(2)} = £${(corporationTax / 100).toFixed(2)}`,
        tr: `İndirim sonrası vergi: £${(taxBeforeMarginalRelief / 100).toFixed(2)} - £${(marginalRelief / 100).toFixed(2)} = £${(corporationTax / 100).toFixed(2)}`
      },
      value: corporationTax
    });
  }
  
  // Calculate effective tax rate
  const effectiveRate = taxableProfit > 0 
    ? Math.round((corporationTax / taxableProfit) * 10000) / 100 
    : 0;
  
  calculationSteps.push({
    step: 'effective_rate',
    description: {
      en: `Effective tax rate: ${effectiveRate.toFixed(2)}%`,
      tr: `Efektif vergi oranı: %${effectiveRate.toFixed(2)}`
    },
    value: effectiveRate
  });
  
  return {
    taxableProfit,
    taxBeforeMarginalRelief,
    marginalRelief,
    corporationTax,
    effectiveRate,
    rateCategory,
    rateDescription: description,
    thresholds: { lowerLimit, upperLimit },
    calculationSteps
  };
}

/**
 * Calculates Corporation Tax payment and filing deadlines.
 * 
 * Payment deadline: 9 months and 1 day after end of accounting period
 * Filing deadline: 12 months after end of accounting period
 * 
 * @param {string} accountingPeriodEndDate - End date of accounting period (YYYY-MM-DD)
 * @returns {{
 *   paymentDeadline: string,
 *   filingDeadline: string,
 *   paymentDeadlineDescription: {en: string, tr: string},
 *   filingDeadlineDescription: {en: string, tr: string}
 * }}
 */
function calculateDeadlines(accountingPeriodEndDate) {
  const endDate = new Date(accountingPeriodEndDate);
  
  // Payment deadline: 9 months and 1 day after accounting period end
  const paymentDeadline = new Date(endDate);
  paymentDeadline.setMonth(paymentDeadline.getMonth() + 9);
  paymentDeadline.setDate(paymentDeadline.getDate() + 1);
  
  // Filing deadline: 12 months after accounting period end
  const filingDeadline = new Date(endDate);
  filingDeadline.setFullYear(filingDeadline.getFullYear() + 1);
  
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const formatDateReadable = (d) => {
    const day = d.getDate();
    const monthName = getMonthName(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${day} ${monthName} ${year}`;
  };
  
  return {
    paymentDeadline: formatDate(paymentDeadline),
    filingDeadline: formatDate(filingDeadline),
    paymentDeadlineDescription: {
      en: `Corporation Tax must be paid by ${formatDateReadable(paymentDeadline)} (9 months and 1 day after accounting period end)`,
      tr: `Kurumlar Vergisi ${formatDateReadable(paymentDeadline)} tarihine kadar ödenmelidir (hesap dönemi bitiminden 9 ay 1 gün sonra)`
    },
    filingDeadlineDescription: {
      en: `Company Tax Return (CT600) must be filed by ${formatDateReadable(filingDeadline)} (12 months after accounting period end)`,
      tr: `Şirket Vergi Beyannamesi (CT600) ${formatDateReadable(filingDeadline)} tarihine kadar sunulmalıdır (hesap dönemi bitiminden 12 ay sonra)`
    }
  };
}

/**
 * Generates a Corporation Tax estimate report for a given user and period.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date of accounting period (YYYY-MM-DD)
 * @param {string} endDate - End date of accounting period (YYYY-MM-DD)
 * @param {Object} options - Optional parameters
 * @param {number} [options.associatedCompanies=0] - Number of associated companies
 * @param {number} [options.distributions=0] - Distributions from non-group companies (in pence)
 * @returns {{
 *   period: {startDate: string, endDate: string, days: number},
 *   profitAndLoss: {totalRevenue: number, totalExpenses: number, netProfit: number},
 *   taxCalculation: Object,
 *   deadlines: Object,
 *   rates: {smallProfitsRate: number, mainRate: number, marginalReliefFraction: string},
 *   explanation: {en: string, tr: string}
 * }}
 */
function generateCorporationTaxEstimate(userId, startDate, endDate, options = {}) {
  const { associatedCompanies = 0, distributions = 0 } = options;
  
  // Get P&L data to calculate taxable profit
  const profitLoss = profitLossService.generateProfitLossReport(userId, startDate, endDate);
  
  // Calculate period days
  const periodDays = calculatePeriodDays(startDate, endDate);
  
  // The taxable profit is the net profit from the P&L
  // Note: In pence for consistency with other services
  const taxableProfit = profitLoss.summary.netProfit;
  
  // Calculate Corporation Tax
  const taxCalculation = calculateCorporationTax(taxableProfit, {
    periodDays,
    associatedCompanies,
    distributions
  });
  
  // Calculate deadlines
  const deadlines = calculateDeadlines(endDate);
  
  // Generate explanation based on rate category
  let explanation = { en: '', tr: '' };
  
  if (taxCalculation.rateCategory === 'no_tax') {
    explanation = {
      en: 'Your company has no taxable profit for this period, so no Corporation Tax is due.',
      tr: 'Şirketinizin bu dönem için vergilendirilebilir karı bulunmadığından Kurumlar Vergisi ödenecek değildir.'
    };
  } else if (taxCalculation.rateCategory === 'small_profits') {
    explanation = {
      en: `Your company's profit of £${(taxableProfit / 100).toFixed(2)} is below the lower threshold of £${(taxCalculation.thresholds.lowerLimit / 100).toFixed(2)}, so the Small Profits Rate of 19% applies.`,
      tr: `Şirketinizin £${(taxableProfit / 100).toFixed(2)} karı, £${(taxCalculation.thresholds.lowerLimit / 100).toFixed(2)} alt eşiğinin altındadır, bu nedenle %19 Küçük Kar Oranı uygulanır.`
    };
  } else if (taxCalculation.rateCategory === 'main_rate') {
    explanation = {
      en: `Your company's profit of £${(taxableProfit / 100).toFixed(2)} exceeds the upper threshold of £${(taxCalculation.thresholds.upperLimit / 100).toFixed(2)}, so the Main Rate of 25% applies.`,
      tr: `Şirketinizin £${(taxableProfit / 100).toFixed(2)} karı, £${(taxCalculation.thresholds.upperLimit / 100).toFixed(2)} üst eşiğini aştığından %25 Ana Oran uygulanır.`
    };
  } else {
    explanation = {
      en: `Your company's profit of £${(taxableProfit / 100).toFixed(2)} is between the thresholds of £${(taxCalculation.thresholds.lowerLimit / 100).toFixed(2)} and £${(taxCalculation.thresholds.upperLimit / 100).toFixed(2)}. Marginal Relief of £${(taxCalculation.marginalRelief / 100).toFixed(2)} has been applied, reducing your effective tax rate to ${taxCalculation.effectiveRate.toFixed(2)}%.`,
      tr: `Şirketinizin £${(taxableProfit / 100).toFixed(2)} karı, £${(taxCalculation.thresholds.lowerLimit / 100).toFixed(2)} ve £${(taxCalculation.thresholds.upperLimit / 100).toFixed(2)} eşikleri arasındadır. £${(taxCalculation.marginalRelief / 100).toFixed(2)} Marjinal İndirim uygulanarak efektif vergi oranınız %${taxCalculation.effectiveRate.toFixed(2)}'e düşürülmüştür.`
    };
  }
  
  return {
    period: {
      startDate,
      endDate,
      days: periodDays
    },
    profitAndLoss: {
      totalRevenue: profitLoss.summary.totalRevenue,
      totalExpenses: profitLoss.summary.totalExpenses,
      netProfit: profitLoss.summary.netProfit
    },
    taxCalculation: {
      taxableProfit: taxCalculation.taxableProfit,
      taxBeforeMarginalRelief: taxCalculation.taxBeforeMarginalRelief,
      marginalRelief: taxCalculation.marginalRelief,
      corporationTax: taxCalculation.corporationTax,
      effectiveRate: taxCalculation.effectiveRate,
      rateCategory: taxCalculation.rateCategory,
      rateDescription: taxCalculation.rateDescription,
      thresholds: taxCalculation.thresholds,
      calculationSteps: taxCalculation.calculationSteps
    },
    deadlines,
    rates: {
      smallProfitsRate: CT_RATES.SMALL_PROFITS_RATE * 100,
      mainRate: CT_RATES.MAIN_RATE * 100,
      marginalReliefFraction: '3/200'
    },
    explanation
  };
}

/**
 * Generates Corporation Tax estimate for a specific financial year.
 * UK company financial years typically align with accounting periods.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year (e.g., 2025)
 * @param {Object} options - Optional parameters
 * @returns {Object} Corporation Tax estimate report
 */
function generateCorporationTaxForYear(userId, year, options = {}) {
  // Default financial year is January 1 to December 31
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  return generateCorporationTaxEstimate(userId, startDate, endDate, options);
}

/**
 * Generates Corporation Tax estimate for UK tax year (April 6 to April 5).
 * 
 * @param {number} userId - The user ID
 * @param {string} taxYear - Tax year in 'YYYY-YY' format (e.g., '2025-26')
 * @param {Object} options - Optional parameters
 * @returns {Object} Corporation Tax estimate report
 */
function generateCorporationTaxForTaxYear(userId, taxYear, options = {}) {
  const { startDate, endDate } = profitLossService.getTaxYearDates(taxYear);
  return generateCorporationTaxEstimate(userId, startDate, endDate, options);
}

module.exports = {
  // Main report generation
  generateCorporationTaxEstimate,
  generateCorporationTaxForYear,
  generateCorporationTaxForTaxYear,
  
  // Core calculation functions
  calculateCorporationTax,
  calculateMarginalRelief,
  calculateDeadlines,
  
  // Utility functions
  validateDateRange,
  calculatePeriodDays,
  adjustThresholdsForPeriod,
  determineRateCategory,
  getMonthName,
  
  // Constants (for testing)
  CT_RATES
};
