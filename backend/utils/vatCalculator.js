/**
 * VAT Calculator Utility
 * Provides VAT calculation functions for transaction management.
 * 
 * All monetary values are handled in pence (smallest currency unit) for precision.
 * VAT rates are stored in basis points (e.g., 2000 = 20%) to maintain precision.
 * 
 * HMRC Requirements:
 * - VAT must be calculated correctly based on the applicable rate
 * - Rounding should be done at the transaction level
 * - Standard rate: 20%, Reduced rate: 5%, Zero rate: 0%
 * 
 * @module utils/vatCalculator
 */

const { vatRates, getVatRateById } = require('../data/vatRates');

/**
 * Standard UK VAT rates in basis points (1 basis point = 0.01%)
 * 2000 basis points = 20%
 * @type {Object.<string, number>}
 */
const VAT_RATES_BASIS_POINTS = {
  'standard': 2000,    // 20%
  'reduced': 500,      // 5%
  'zero': 0,           // 0%
  'exempt': 0,         // 0% (no VAT charged, but different from zero-rated)
  'outside-scope': 0   // Not applicable (null rate)
};

/**
 * VAT rate percentages for display
 * @type {Object.<string, number>}
 */
const VAT_RATE_PERCENTAGES = {
  'standard': 20,
  'reduced': 5,
  'zero': 0,
  'exempt': 0,
  'outside-scope': null
};

/**
 * Valid VAT rate identifiers
 * @type {string[]}
 */
const VALID_VAT_RATE_IDS = ['standard', 'reduced', 'zero', 'exempt', 'outside-scope'];

/**
 * Calculates VAT amount from a net amount (amount before VAT).
 * 
 * @param {number} netAmount - Net amount in pence (before VAT)
 * @param {number} vatRateBasisPoints - VAT rate in basis points (e.g., 2000 = 20%)
 * @returns {number} VAT amount in pence (rounded to nearest integer)
 */
function calculateVatFromNet(netAmount, vatRateBasisPoints) {
  if (typeof netAmount !== 'number' || typeof vatRateBasisPoints !== 'number') {
    return 0;
  }
  
  if (vatRateBasisPoints <= 0 || netAmount < 0) {
    return 0;
  }
  
  // Calculate VAT: (netAmount * vatRate) / 10000
  // 10000 is used because basis points are 100 * 100
  return Math.round((netAmount * vatRateBasisPoints) / 10000);
}

/**
 * Calculates VAT amount from a gross amount (amount including VAT).
 * This is useful when the user inputs the total price including VAT.
 * 
 * @param {number} grossAmount - Gross amount in pence (including VAT)
 * @param {number} vatRateBasisPoints - VAT rate in basis points (e.g., 2000 = 20%)
 * @returns {number} VAT amount in pence (rounded to nearest integer)
 */
function calculateVatFromGross(grossAmount, vatRateBasisPoints) {
  if (typeof grossAmount !== 'number' || typeof vatRateBasisPoints !== 'number') {
    return 0;
  }
  
  if (vatRateBasisPoints <= 0 || grossAmount < 0) {
    return 0;
  }
  
  // VAT = gross - net, where net = gross / (1 + rate)
  // VAT = gross * rate / (10000 + rate)
  return Math.round((grossAmount * vatRateBasisPoints) / (10000 + vatRateBasisPoints));
}

/**
 * Calculates net amount from gross amount (reverse VAT calculation).
 * 
 * @param {number} grossAmount - Gross amount in pence (including VAT)
 * @param {number} vatRateBasisPoints - VAT rate in basis points (e.g., 2000 = 20%)
 * @returns {number} Net amount in pence (rounded to nearest integer)
 */
function calculateNetFromGross(grossAmount, vatRateBasisPoints) {
  if (typeof grossAmount !== 'number' || typeof vatRateBasisPoints !== 'number') {
    return typeof grossAmount === 'number' ? grossAmount : 0;
  }
  
  if (vatRateBasisPoints <= 0) {
    return grossAmount;
  }
  
  // net = gross / (1 + rate) = gross * 10000 / (10000 + rate)
  return Math.round((grossAmount * 10000) / (10000 + vatRateBasisPoints));
}

/**
 * Calculates all transaction amounts from net amount and VAT rate.
 * 
 * @param {number} netAmount - Net amount in pence (before VAT)
 * @param {number} vatRateBasisPoints - VAT rate in basis points (e.g., 2000 = 20%)
 * @returns {{amount: number, vatAmount: number, totalAmount: number, vatRate: number}}
 */
function calculateTransactionAmounts(netAmount, vatRateBasisPoints) {
  const amount = netAmount || 0;
  const vatRate = vatRateBasisPoints || 0;
  const vatAmount = calculateVatFromNet(amount, vatRate);
  const totalAmount = amount + vatAmount;
  
  return {
    amount,
    vatAmount,
    totalAmount,
    vatRate
  };
}

/**
 * Calculates transaction amounts from total amount (gross) and VAT rate.
 * Useful when user enters total price including VAT.
 * 
 * @param {number} totalAmount - Total amount in pence (including VAT)
 * @param {number} vatRateBasisPoints - VAT rate in basis points (e.g., 2000 = 20%)
 * @returns {{amount: number, vatAmount: number, totalAmount: number, vatRate: number}}
 */
function calculateTransactionAmountsFromTotal(totalAmount, vatRateBasisPoints) {
  const total = totalAmount || 0;
  const vatRate = vatRateBasisPoints || 0;
  const vatAmount = calculateVatFromGross(total, vatRate);
  const amount = total - vatAmount;
  
  return {
    amount,
    vatAmount,
    totalAmount: total,
    vatRate
  };
}

/**
 * Gets the VAT rate in basis points for a given rate identifier.
 * 
 * @param {string|number} rateIdOrValue - Rate identifier ('standard', 'reduced', etc.) or numeric value
 * @returns {number} VAT rate in basis points
 */
function getVatRateBasisPoints(rateIdOrValue) {
  if (typeof rateIdOrValue === 'number') {
    // If it's already a number, assume it's in basis points
    if (rateIdOrValue >= 0 && rateIdOrValue <= 10000) {
      return rateIdOrValue;
    }
    return 0;
  }
  
  if (typeof rateIdOrValue === 'string' && VALID_VAT_RATE_IDS.includes(rateIdOrValue)) {
    return VAT_RATES_BASIS_POINTS[rateIdOrValue];
  }
  
  // Default to standard rate
  return VAT_RATES_BASIS_POINTS.standard;
}

/**
 * Gets the VAT rate percentage for a given rate identifier.
 * 
 * @param {string|number} rateIdOrBasisPoints - Rate identifier or basis points value
 * @returns {number|null} VAT rate percentage or null for outside-scope
 */
function getVatRatePercentage(rateIdOrBasisPoints) {
  if (typeof rateIdOrBasisPoints === 'number') {
    // Convert from basis points to percentage
    return rateIdOrBasisPoints / 100;
  }
  
  if (typeof rateIdOrBasisPoints === 'string' && VALID_VAT_RATE_IDS.includes(rateIdOrBasisPoints)) {
    return VAT_RATE_PERCENTAGES[rateIdOrBasisPoints];
  }
  
  return null;
}

/**
 * Validates a VAT rate value.
 * 
 * @param {number} vatRateBasisPoints - VAT rate in basis points
 * @returns {{isValid: boolean, error: string|null}}
 */
function validateVatRate(vatRateBasisPoints) {
  if (typeof vatRateBasisPoints !== 'number') {
    return {
      isValid: false,
      error: 'VAT rate must be a number'
    };
  }
  
  if (!Number.isInteger(vatRateBasisPoints)) {
    return {
      isValid: false,
      error: 'VAT rate must be an integer (in basis points)'
    };
  }
  
  if (vatRateBasisPoints < 0 || vatRateBasisPoints > 10000) {
    return {
      isValid: false,
      error: 'VAT rate must be between 0 and 10000 basis points (0% to 100%)'
    };
  }
  
  return {
    isValid: true,
    error: null
  };
}

/**
 * Validates a monetary amount.
 * 
 * @param {number} amount - Amount in pence
 * @param {string} fieldName - Field name for error message
 * @returns {{isValid: boolean, error: string|null}}
 */
function validateAmount(amount, fieldName = 'amount') {
  if (amount === undefined || amount === null) {
    return {
      isValid: true,
      error: null
    };
  }
  
  if (typeof amount !== 'number') {
    return {
      isValid: false,
      error: `${fieldName} must be a number`
    };
  }
  
  if (!Number.isInteger(amount)) {
    return {
      isValid: false,
      error: `${fieldName} must be an integer (in pence)`
    };
  }
  
  if (amount < 0) {
    return {
      isValid: false,
      error: `${fieldName} cannot be negative`
    };
  }
  
  return {
    isValid: true,
    error: null
  };
}

/**
 * Converts a VAT rate percentage to basis points.
 * 
 * @param {number} percentage - VAT rate as percentage (e.g., 20 for 20%)
 * @returns {number} VAT rate in basis points
 */
function percentageToBasisPoints(percentage) {
  if (typeof percentage !== 'number') {
    return 0;
  }
  return Math.round(percentage * 100);
}

/**
 * Converts basis points to percentage.
 * 
 * @param {number} basisPoints - VAT rate in basis points
 * @returns {number} VAT rate as percentage
 */
function basisPointsToPercentage(basisPoints) {
  if (typeof basisPoints !== 'number') {
    return 0;
  }
  return basisPoints / 100;
}

/**
 * Formats a VAT rate for display.
 * 
 * @param {number} vatRateBasisPoints - VAT rate in basis points
 * @returns {string} Formatted VAT rate (e.g., "20%")
 */
function formatVatRate(vatRateBasisPoints) {
  const percentage = basisPointsToPercentage(vatRateBasisPoints);
  return `${percentage}%`;
}

/**
 * Gets VAT rate info with bilingual names.
 * 
 * @param {string|number} rateIdOrBasisPoints - Rate identifier or basis points
 * @returns {Object|null} VAT rate info or null if not found
 */
function getVatRateInfo(rateIdOrBasisPoints) {
  let rateId = null;
  
  if (typeof rateIdOrBasisPoints === 'string' && VALID_VAT_RATE_IDS.includes(rateIdOrBasisPoints)) {
    rateId = rateIdOrBasisPoints;
  } else if (typeof rateIdOrBasisPoints === 'number') {
    // Find matching rate by basis points
    for (const [id, bp] of Object.entries(VAT_RATES_BASIS_POINTS)) {
      if (bp === rateIdOrBasisPoints) {
        rateId = id;
        break;
      }
    }
  }
  
  if (!rateId) {
    return null;
  }
  
  const rateData = vatRates.find(r => r.id === rateId);
  if (!rateData) {
    return null;
  }
  
  return {
    id: rateData.id,
    code: rateData.code,
    basisPoints: VAT_RATES_BASIS_POINTS[rateId],
    percentage: VAT_RATE_PERCENTAGES[rateId],
    name: rateData.name,
    description: rateData.description
  };
}

module.exports = {
  // Calculation functions
  calculateVatFromNet,
  calculateVatFromGross,
  calculateNetFromGross,
  calculateTransactionAmounts,
  calculateTransactionAmountsFromTotal,
  
  // Rate lookup functions
  getVatRateBasisPoints,
  getVatRatePercentage,
  getVatRateInfo,
  
  // Validation functions
  validateVatRate,
  validateAmount,
  
  // Conversion functions
  percentageToBasisPoints,
  basisPointsToPercentage,
  formatVatRate,
  
  // Constants
  VAT_RATES_BASIS_POINTS,
  VAT_RATE_PERCENTAGES,
  VALID_VAT_RATE_IDS
};
