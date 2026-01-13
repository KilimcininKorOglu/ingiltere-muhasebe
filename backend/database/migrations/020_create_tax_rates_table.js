/**
 * Migration: Create tax_rates table
 * Stores tax thresholds and rates that can be updated by admin
 */

/**
 * Run the migration
 * @param {import('better-sqlite3').Database} db
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taxYear TEXT NOT NULL,
      rateType TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      value INTEGER NOT NULL,
      currency TEXT DEFAULT 'GBP',
      description TEXT,
      effectiveFrom TEXT NOT NULL,
      effectiveTo TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
      updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
      UNIQUE(taxYear, rateType, category, name)
    );

    CREATE INDEX IF NOT EXISTS idx_tax_rates_tax_year ON tax_rates(taxYear);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_type_category ON tax_rates(rateType, category);
    CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(isActive);
  `);

  // Insert default UK tax rates for 2024/25
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO tax_rates (taxYear, rateType, category, name, value, description, effectiveFrom, effectiveTo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const defaultRates = [
    // VAT Thresholds
    ['2024-25', 'threshold', 'vat', 'registration', 9000000, 'VAT registration threshold (in pence)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'threshold', 'vat', 'deregistration', 8800000, 'VAT deregistration threshold (in pence)', '2024-04-06', '2025-04-05'],
    
    // VAT Rates
    ['2024-25', 'rate', 'vat', 'standard', 2000, 'Standard VAT rate (in basis points, 2000 = 20%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'vat', 'reduced', 500, 'Reduced VAT rate (in basis points, 500 = 5%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'vat', 'zero', 0, 'Zero VAT rate', '2024-04-06', '2025-04-05'],

    // Income Tax Thresholds
    ['2024-25', 'threshold', 'income_tax', 'personal_allowance', 1257000, 'Personal allowance (in pence)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'threshold', 'income_tax', 'basic_rate_limit', 3772600, 'Basic rate limit (in pence)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'threshold', 'income_tax', 'higher_rate_limit', 12557000, 'Higher rate limit (in pence)', '2024-04-06', '2025-04-05'],

    // Income Tax Rates
    ['2024-25', 'rate', 'income_tax', 'basic', 2000, 'Basic rate (in basis points, 2000 = 20%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'income_tax', 'higher', 4000, 'Higher rate (in basis points, 4000 = 40%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'income_tax', 'additional', 4500, 'Additional rate (in basis points, 4500 = 45%)', '2024-04-06', '2025-04-05'],

    // National Insurance Thresholds
    ['2024-25', 'threshold', 'national_insurance', 'primary_threshold', 1048000, 'Primary threshold (in pence)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'threshold', 'national_insurance', 'upper_earnings_limit', 5018900, 'Upper earnings limit (in pence)', '2024-04-06', '2025-04-05'],

    // National Insurance Rates
    ['2024-25', 'rate', 'national_insurance', 'employee_main', 800, 'Employee NI main rate (in basis points, 800 = 8%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'national_insurance', 'employee_upper', 200, 'Employee NI above UEL (in basis points, 200 = 2%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'national_insurance', 'employer', 1380, 'Employer NI rate (in basis points, 1380 = 13.8%)', '2024-04-06', '2025-04-05'],

    // Corporation Tax
    ['2024-25', 'rate', 'corporation_tax', 'small_profits', 1900, 'Small profits rate (in basis points, 1900 = 19%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'rate', 'corporation_tax', 'main', 2500, 'Main rate (in basis points, 2500 = 25%)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'threshold', 'corporation_tax', 'small_profits_limit', 5000000, 'Small profits limit (in pence)', '2024-04-06', '2025-04-05'],
    ['2024-25', 'threshold', 'corporation_tax', 'marginal_relief_limit', 25000000, 'Marginal relief upper limit (in pence)', '2024-04-06', '2025-04-05'],

    // 2025-26 VAT Thresholds (future year)
    ['2025-26', 'threshold', 'vat', 'registration', 9000000, 'VAT registration threshold (in pence)', '2025-04-06', '2026-04-05'],
    ['2025-26', 'threshold', 'vat', 'deregistration', 8800000, 'VAT deregistration threshold (in pence)', '2025-04-06', '2026-04-05'],
  ];

  for (const rate of defaultRates) {
    insertStmt.run(...rate);
  }
}

/**
 * Rollback the migration
 * @param {import('better-sqlite3').Database} db
 */
function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS tax_rates;
  `);
}

module.exports = { up, down };
