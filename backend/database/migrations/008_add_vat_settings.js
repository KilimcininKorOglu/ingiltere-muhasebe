/**
 * Migration: Add VAT settings to users table
 * 
 * This migration adds the vatScheme field to the users table to support
 * UK VAT accounting scheme preferences. The existing isVatRegistered and
 * vatNumber fields (from migration 001) handle basic VAT registration.
 * 
 * UK VAT Accounting Schemes:
 * - standard: Standard VAT accounting (default)
 * - flat_rate: Flat Rate Scheme - simplified fixed percentage
 * - cash: Cash Accounting Scheme - VAT on cash received/paid
 * - annual: Annual Accounting Scheme - annual VAT payments
 * - retail: Retail Schemes - for retail businesses
 * 
 * @module migrations/008_add_vat_settings
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 8,
  name: '008_add_vat_settings',
  description: 'Adds VAT accounting scheme field to users table',
  createdAt: '2026-01-12'
};

/**
 * Valid VAT accounting schemes recognized by HMRC.
 */
const VALID_VAT_SCHEMES = ['standard', 'flat_rate', 'cash', 'annual', 'retail'];

/**
 * Default VAT scheme for new/existing users.
 */
const DEFAULT_VAT_SCHEME = 'standard';

/**
 * SQL statement to add vatScheme column.
 * Stores the VAT accounting scheme preference.
 * Default is "standard" for standard VAT accounting.
 */
const addVatSchemeColumnSql = `
  ALTER TABLE users ADD COLUMN vatScheme TEXT DEFAULT 'standard' NOT NULL;
`;

/**
 * Helper function to check if a column exists in a table.
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {string} tableName - Name of the table
 * @param {string} columnName - Name of the column
 * @returns {boolean} True if column exists
 */
function columnExists(db, tableName, columnName) {
  const result = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return result.some(col => col.name === columnName);
}

/**
 * Applies the migration (adds VAT settings columns to users table).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If migration fails
 */
function up(db) {
  try {
    db.transaction(() => {
      // Check and add vatScheme column if it doesn't exist
      if (!columnExists(db, 'users', 'vatScheme')) {
        db.exec(addVatSchemeColumnSql);
      }
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (removes VAT settings columns from users table).
 * 
 * Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table.
 * This is a destructive operation that will lose the VAT settings data.
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If rollback fails
 */
function down(db) {
  try {
    db.transaction(() => {
      // SQLite doesn't support DROP COLUMN directly
      // We need to recreate the table without these columns
      
      // Create a temporary table with all columns except vatScheme
      db.exec(`
        CREATE TABLE users_backup AS 
        SELECT 
          id, email, passwordHash, name, businessName, businessAddress,
          vatNumber, isVatRegistered, companyNumber, taxYearStart, 
          preferredLanguage, invoicePrefix, nextInvoiceNumber,
          createdAt, updatedAt
        FROM users;
      `);
      
      // Drop the original table
      db.exec('DROP TABLE users;');
      
      // Recreate the users table without the vatScheme column
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          passwordHash TEXT NOT NULL,
          name TEXT NOT NULL,
          businessName TEXT,
          businessAddress TEXT,
          vatNumber TEXT,
          isVatRegistered INTEGER DEFAULT 0 NOT NULL,
          companyNumber TEXT,
          taxYearStart TEXT DEFAULT '04-06' NOT NULL,
          preferredLanguage TEXT DEFAULT 'en' NOT NULL CHECK(preferredLanguage IN ('en', 'tr')),
          invoicePrefix TEXT DEFAULT 'INV' NOT NULL,
          nextInvoiceNumber INTEGER DEFAULT 1 NOT NULL,
          createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
          updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
        );
      `);
      
      // Restore data from backup
      db.exec(`
        INSERT INTO users 
        SELECT * FROM users_backup;
      `);
      
      // Drop the backup table
      db.exec('DROP TABLE users_backup;');
      
      // Recreate indexes
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_company_number ON users(companyNumber);');
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
  // Export constants for use by other modules
  VALID_VAT_SCHEMES,
  DEFAULT_VAT_SCHEME
};
