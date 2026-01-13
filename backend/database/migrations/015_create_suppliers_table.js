/**
 * Migration: Create suppliers table
 * 
 * This migration creates the suppliers table with all required fields
 * for expense tracking and UK compliance.
 * 
 * @module migrations/015_create_suppliers_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 15,
  name: '015_create_suppliers_table',
  description: 'Creates the suppliers table for expense tracking and UK compliance',
  createdAt: '2026-01-12'
};

/**
 * Valid supplier status values.
 * - active: Currently active supplier
 * - inactive: No longer active but records retained
 * - blocked: Supplier is blocked from transactions
 */
const VALID_STATUSES = ['active', 'inactive', 'blocked'];

/**
 * Valid payment terms values.
 * - immediate: Payment due immediately
 * - net7: Payment due within 7 days
 * - net14: Payment due within 14 days
 * - net30: Payment due within 30 days
 * - net60: Payment due within 60 days
 * - net90: Payment due within 90 days
 * - custom: Custom payment terms
 */
const VALID_PAYMENT_TERMS = ['immediate', 'net7', 'net14', 'net30', 'net60', 'net90', 'custom'];

/**
 * SQL statement to create the suppliers table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table (business owner)
 * - name: Supplier company/business name (unique per user)
 * - contactName: Primary contact person name
 * - email: Supplier email address
 * - phoneNumber: Supplier contact phone
 * - address: Supplier address
 * - city: City
 * - postcode: UK postcode
 * - country: Country (default: United Kingdom)
 * - vatNumber: Supplier VAT registration number (UK format: GB123456789)
 * - isVatRegistered: Whether supplier is VAT registered
 * - companyNumber: Companies House registration number
 * - paymentTerms: Default payment terms
 * - paymentTermsDays: Custom payment terms days (when paymentTerms is 'custom')
 * - currency: Currency code (default: GBP)
 * - bankAccountName: Bank account name
 * - bankAccountNumber: Bank account number
 * - bankSortCode: Bank sort code
 * - iban: International Bank Account Number (for international suppliers)
 * - swift: SWIFT/BIC code (for international suppliers)
 * - defaultExpenseCategory: Default category for expenses from this supplier
 * - status: Supplier status (active, inactive, blocked)
 * - notes: Additional notes
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    contactName TEXT,
    email TEXT,
    phoneNumber TEXT,
    address TEXT,
    city TEXT,
    postcode TEXT,
    country TEXT DEFAULT 'United Kingdom' NOT NULL,
    vatNumber TEXT,
    isVatRegistered INTEGER DEFAULT 0 NOT NULL,
    companyNumber TEXT,
    paymentTerms TEXT DEFAULT 'net30' NOT NULL CHECK(paymentTerms IN ('immediate', 'net7', 'net14', 'net30', 'net60', 'net90', 'custom')),
    paymentTermsDays INTEGER,
    currency TEXT DEFAULT 'GBP' NOT NULL,
    bankAccountName TEXT,
    bankAccountNumber TEXT,
    bankSortCode TEXT,
    iban TEXT,
    swift TEXT,
    defaultExpenseCategory TEXT,
    status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'inactive', 'blocked')),
    notes TEXT,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(userId, name)
  );
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(userId);
`;

/**
 * SQL statement to create unique index on supplier name per user.
 * This enforces uniqueness of supplier names within each user's account.
 */
const createNameIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_user_name ON suppliers(userId, name);
`;

/**
 * SQL statement to create index on VAT number for lookups.
 */
const createVatNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_suppliers_vat_number ON suppliers(vatNumber);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
`;

/**
 * SQL statement to create index on company number for lookups.
 */
const createCompanyNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_suppliers_company_number ON suppliers(companyNumber);
`;

/**
 * SQL statement to drop the suppliers table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS suppliers;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_suppliers_user_id;
  DROP INDEX IF EXISTS idx_suppliers_user_name;
  DROP INDEX IF EXISTS idx_suppliers_vat_number;
  DROP INDEX IF EXISTS idx_suppliers_status;
  DROP INDEX IF EXISTS idx_suppliers_company_number;
`;

/**
 * Applies the migration (creates the suppliers table and indexes).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If migration fails
 */
function up(db) {
  try {
    // Use a transaction to ensure atomicity
    db.transaction(() => {
      db.exec(createTableSql);
      db.exec(createUserIdIndexSql);
      db.exec(createNameIndexSql);
      db.exec(createVatNumberIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createCompanyNumberIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the suppliers table and indexes).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If rollback fails
 */
function down(db) {
  try {
    db.transaction(() => {
      // Drop indexes first (they are dropped automatically with the table, but explicit is better)
      db.exec(dropIndexesSql);
      db.exec(dropTableSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} rolled back successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} rollback failed:`, error.message);
    throw error;
  }
}

module.exports = {
  migrationInfo,
  up,
  down,
  // Export SQL for testing purposes
  sql: {
    createTableSql,
    createUserIdIndexSql,
    createNameIndexSql,
    createVatNumberIndexSql,
    createStatusIndexSql,
    createCompanyNumberIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid values for use by other modules
  VALID_STATUSES,
  VALID_PAYMENT_TERMS
};
