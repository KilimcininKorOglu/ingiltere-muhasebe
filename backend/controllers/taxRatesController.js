/**
 * Tax Rates Controller
 * Handles HTTP requests for tax rates management
 */

const taxRatesService = require('../services/taxRatesService');

/**
 * Get all tax rates for a tax year
 */
async function getTaxRates(req, res) {
  try {
    const { taxYear } = req.query;
    const year = taxYear || taxRatesService.getCurrentTaxYear();
    const rates = taxRatesService.getTaxRatesByYear(year);

    res.json({
      success: true,
      data: {
        taxYear: year,
        rates
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Get tax rates grouped by category
 */
async function getTaxRatesGrouped(req, res) {
  try {
    const { taxYear } = req.query;
    const grouped = taxRatesService.getTaxRatesGrouped(taxYear);

    res.json({
      success: true,
      data: grouped
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Get VAT thresholds
 */
async function getVatThresholds(req, res) {
  try {
    const { taxYear } = req.query;
    const thresholds = taxRatesService.getVatThresholds(taxYear);

    res.json({
      success: true,
      data: thresholds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Get available tax years
 */
async function getAvailableTaxYears(req, res) {
  try {
    const years = taxRatesService.getAvailableTaxYears();

    res.json({
      success: true,
      data: { taxYears: years }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Update a tax rate
 */
async function updateTaxRate(req, res) {
  try {
    const { id } = req.params;
    const { value, description, isActive } = req.body;

    if (value !== undefined && (typeof value !== 'number' || value < 0)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Value must be a non-negative number' }
      });
    }

    const updated = taxRatesService.updateTaxRate(parseInt(id), {
      value,
      description,
      isActive
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { message: 'Tax rate not found' }
      });
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Create a new tax rate
 */
async function createTaxRate(req, res) {
  try {
    const { taxYear, rateType, category, name, value, currency, description, effectiveFrom, effectiveTo } = req.body;

    // Validation
    if (!taxYear || !rateType || !category || !name || value === undefined || !effectiveFrom) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: taxYear, rateType, category, name, value, effectiveFrom' }
      });
    }

    if (!['rate', 'threshold'].includes(rateType)) {
      return res.status(400).json({
        success: false,
        error: { message: 'rateType must be "rate" or "threshold"' }
      });
    }

    const created = taxRatesService.createTaxRate({
      taxYear,
      rateType,
      category,
      name,
      value,
      currency,
      description,
      effectiveFrom,
      effectiveTo
    });

    res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({
        success: false,
        error: { message: 'A tax rate with this combination already exists' }
      });
    }
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Delete a tax rate (soft delete)
 */
async function deleteTaxRate(req, res) {
  try {
    const { id } = req.params;
    taxRatesService.deleteTaxRate(parseInt(id));

    res.json({
      success: true,
      message: 'Tax rate deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * Copy tax rates from one year to another
 */
async function copyTaxYear(req, res) {
  try {
    const { fromYear, toYear, effectiveFrom, effectiveTo } = req.body;

    if (!fromYear || !toYear || !effectiveFrom) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: fromYear, toYear, effectiveFrom' }
      });
    }

    const copied = taxRatesService.copyTaxYear(fromYear, toYear, effectiveFrom, effectiveTo);

    res.json({
      success: true,
      data: { copied },
      message: `Copied ${copied} tax rates from ${fromYear} to ${toYear}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

module.exports = {
  getTaxRates,
  getTaxRatesGrouped,
  getVatThresholds,
  getAvailableTaxYears,
  updateTaxRate,
  createTaxRate,
  deleteTaxRate,
  copyTaxYear
};
