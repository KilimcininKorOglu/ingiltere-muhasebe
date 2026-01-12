/**
 * Migration: Create customers table
 * 
 * This migration creates the customers table with all required fields
 * for UK VAT-compliant invoicing and customer record management.
 * 
 * @module migrations/014_create_customers_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 14,
  name: '014_create_customers_table',
  description: 'Creates the customers table with UK VAT compliance fields for invoicing',
  createdAt: '2026-01-12'
};

/**
 * Valid customer status values.
 * - active: Currently active customer
 * - inactive: Inactive customer (no longer trading)
 * - archived: Archived customer record
 */
const VALID_STATUSES = ['active', 'inactive', 'archived'];

/**
 * SQL statement to create the customers table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table (owner of the customer record)
 * - customerNumber: Unique customer identifier within the company
 * - name: Customer/company name (required for UK invoicing)
 * - tradingName: Trading name if different from legal name
 * - email: Primary contact email address
 * - phone: Primary contact phone number
 * - website: Customer website URL
 * - vatNumber: VAT registration number (for B2B transactions)
 * - companyNumber: UK Companies House registration number
 * - addressLine1: First line of billing address (required for UK invoicing)
 * - addressLine2: Second line of billing address
 * - city: City/town (required for UK invoicing)
 * - county: County/region
 * - postcode: Postal code (required for UK invoicing)
 * - country: Country code (default: GB for UK)
 * - deliveryAddressLine1: Delivery address first line
 * - deliveryAddressLine2: Delivery address second line
 * - deliveryCity: Delivery city/town
 * - deliveryCounty: Delivery county/region
 * - deliveryPostcode: Delivery postal code
 * - deliveryCountry: Delivery country code
 * - contactName: Primary contact person name
 * - contactEmail: Primary contact person email
 * - contactPhone: Primary contact person phone
 * - paymentTerms: Default payment terms in days (e.g., 30)
 * - creditLimit: Credit limit in pence
 * - currency: Preferred currency code (default: GBP)
 * - status: Customer status (active, inactive, archived)
 * - notes: Additional notes
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    customerNumber TEXT NOT NULL,
    name TEXT NOT NULL,
    tradingName TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    vatNumber TEXT,
    companyNumber TEXT,
    addressLine1 TEXT,
    addressLine2 TEXT,
    city TEXT,
    county TEXT,
    postcode TEXT,
    country TEXT DEFAULT 'GB' NOT NULL,
    deliveryAddressLine1 TEXT,
    deliveryAddressLine2 TEXT,
    deliveryCity TEXT,
    deliveryCounty TEXT,
    deliveryPostcode TEXT,
    deliveryCountry TEXT,
    contactName TEXT,
    contactEmail TEXT,
    contactPhone TEXT,
    paymentTerms INTEGER DEFAULT 30,
    creditLimit INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'GBP' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'inactive', 'archived')),
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(userId, name)
  );
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(userId);
`;

/**
 * SQL statement to create unique index on customer name per user.
 */
const createNameIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_name ON customers(userId, name);
`;

/**
 * SQL statement to create index on customerNumber for lookups.
 */
const createCustomerNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_customers_customer_number ON customers(userId, customerNumber);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
`;

/**
 * SQL statement to create index on email for lookups.
 */
const createEmailIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
`;

/**
 * SQL statement to create index on vatNumber for B2B lookups.
 */
const createVatNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_customers_vat_number ON customers(vatNumber);
`;

/**
 * SQL statement to drop the customers table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS customers;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_customers_user_id;
  DROP INDEX IF EXISTS idx_customers_user_name;
  DROP INDEX IF EXISTS idx_customers_customer_number;
  DROP INDEX IF EXISTS idx_customers_status;
  DROP INDEX IF EXISTS idx_customers_email;
  DROP INDEX IF EXISTS idx_customers_vat_number;
`;

/**
 * Applies the migration (creates the customers table and indexes).
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
      db.exec(createCustomerNumberIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createEmailIndexSql);
      db.exec(createVatNumberIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the customers table and indexes).
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
    createCustomerNumberIndexSql,
    createStatusIndexSql,
    createEmailIndexSql,
    createVatNumberIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid statuses for use by other modules
  VALID_STATUSES
};
