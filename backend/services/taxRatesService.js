/**
 * Tax Rates Service
 * Handles CRUD operations for tax rates and thresholds
 */

const { query, queryOne, execute } = require('../database');

/**
 * Get all tax rates for a specific tax year
 * @param {string} taxYear - Tax year (e.g., '2024/25')
 * @returns {Array} Tax rates
 */
function getTaxRatesByYear(taxYear) {
  return query(
    `SELECT * FROM tax_rates WHERE taxYear = ? AND isActive = 1 ORDER BY category, name`,
    [taxYear]
  );
}

/**
 * Get current tax year based on date
 * UK tax year runs from 6 April to 5 April
 * @param {Date} date - Date to check (defaults to now)
 * @returns {string} Tax year in format 'YYYY/YY'
 */
function getCurrentTaxYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Before 6 April, we're in the previous tax year
  if (month < 4 || (month === 4 && day < 6)) {
    return `${year - 1}/${String(year).slice(2)}`;
  }
  return `${year}/${String(year + 1).slice(2)}`;
}

/**
 * Get a specific tax rate/threshold
 * @param {string} taxYear - Tax year
 * @param {string} rateType - 'rate' or 'threshold'
 * @param {string} category - Category (e.g., 'vat', 'income_tax')
 * @param {string} name - Rate name (e.g., 'registration', 'standard')
 * @returns {Object|null} Tax rate or null
 */
function getTaxRate(taxYear, rateType, category, name) {
  return queryOne(
    `SELECT * FROM tax_rates 
     WHERE taxYear = ? AND rateType = ? AND category = ? AND name = ? AND isActive = 1`,
    [taxYear, rateType, category, name]
  );
}

/**
 * Get VAT thresholds for a tax year
 * @param {string} taxYear - Tax year (defaults to current)
 * @returns {Object} VAT thresholds
 */
function getVatThresholds(taxYear = null) {
  const year = taxYear || getCurrentTaxYear();
  
  const registration = queryOne(
    `SELECT value FROM tax_rates 
     WHERE taxYear = ? AND rateType = 'threshold' AND category = 'vat' AND name = 'registration' AND isActive = 1`,
    [year]
  );
  
  const deregistration = queryOne(
    `SELECT value FROM tax_rates 
     WHERE taxYear = ? AND rateType = 'threshold' AND category = 'vat' AND name = 'deregistration' AND isActive = 1`,
    [year]
  );

  return {
    taxYear: year,
    registrationThreshold: registration?.value || 9000000,
    deregistrationThreshold: deregistration?.value || 8800000
  };
}

/**
 * Get all tax rates grouped by category
 * @param {string} taxYear - Tax year
 * @returns {Object} Grouped tax rates
 */
function getTaxRatesGrouped(taxYear = null) {
  const year = taxYear || getCurrentTaxYear();
  const rates = getTaxRatesByYear(year);

  const grouped = {};
  for (const rate of rates) {
    if (!grouped[rate.category]) {
      grouped[rate.category] = {
        thresholds: {},
        rates: {}
      };
    }
    if (rate.rateType === 'threshold') {
      grouped[rate.category].thresholds[rate.name] = {
        value: rate.value,
        description: rate.description
      };
    } else {
      grouped[rate.category].rates[rate.name] = {
        value: rate.value,
        description: rate.description
      };
    }
  }

  return {
    taxYear: year,
    categories: grouped
  };
}

/**
 * Update a tax rate
 * @param {number} id - Tax rate ID
 * @param {Object} data - Update data
 * @returns {Object} Updated tax rate
 */
function updateTaxRate(id, data) {
  const { value, description, isActive } = data;
  
  const updates = [];
  const params = [];

  if (value !== undefined) {
    updates.push('value = ?');
    params.push(value);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (isActive !== undefined) {
    updates.push('isActive = ?');
    params.push(isActive ? 1 : 0);
  }

  updates.push("updatedAt = datetime('now')");
  params.push(id);

  execute(
    `UPDATE tax_rates SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return queryOne('SELECT * FROM tax_rates WHERE id = ?', [id]);
}

/**
 * Create a new tax rate
 * @param {Object} data - Tax rate data
 * @returns {Object} Created tax rate
 */
function createTaxRate(data) {
  const { taxYear, rateType, category, name, value, currency, description, effectiveFrom, effectiveTo } = data;

  const result = execute(
    `INSERT INTO tax_rates (taxYear, rateType, category, name, value, currency, description, effectiveFrom, effectiveTo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [taxYear, rateType, category, name, value, currency || 'GBP', description, effectiveFrom, effectiveTo]
  );

  return queryOne('SELECT * FROM tax_rates WHERE id = ?', [result.lastInsertRowid]);
}

/**
 * Delete a tax rate (soft delete)
 * @param {number} id - Tax rate ID
 * @returns {boolean} Success
 */
function deleteTaxRate(id) {
  execute(
    `UPDATE tax_rates SET isActive = 0, updatedAt = datetime('now') WHERE id = ?`,
    [id]
  );
  return true;
}

/**
 * Get all available tax years
 * @returns {Array} Tax years
 */
function getAvailableTaxYears() {
  const rows = query(
    `SELECT DISTINCT taxYear FROM tax_rates WHERE isActive = 1 ORDER BY taxYear DESC`
  );
  return rows.map(r => r.taxYear);
}

/**
 * Copy rates from one tax year to another
 * @param {string} fromYear - Source tax year
 * @param {string} toYear - Target tax year
 * @param {string} effectiveFrom - New effective from date
 * @param {string} effectiveTo - New effective to date
 * @returns {number} Number of rates copied
 */
function copyTaxYear(fromYear, toYear, effectiveFrom, effectiveTo) {
  const sourceRates = getTaxRatesByYear(fromYear);
  let copied = 0;

  for (const rate of sourceRates) {
    try {
      createTaxRate({
        taxYear: toYear,
        rateType: rate.rateType,
        category: rate.category,
        name: rate.name,
        value: rate.value,
        currency: rate.currency,
        description: rate.description,
        effectiveFrom,
        effectiveTo
      });
      copied++;
    } catch {
      // Skip duplicates
    }
  }

  return copied;
}

module.exports = {
  getTaxRatesByYear,
  getCurrentTaxYear,
  getTaxRate,
  getVatThresholds,
  getTaxRatesGrouped,
  updateTaxRate,
  createTaxRate,
  deleteTaxRate,
  getAvailableTaxYears,
  copyTaxYear
};
