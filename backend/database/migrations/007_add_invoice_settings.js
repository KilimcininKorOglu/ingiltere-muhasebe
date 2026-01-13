/**
 * Migration: Add invoice settings to users table
 * 
 * This migration adds fields to the users table to support customizable
 * invoice number generation with HMRC-compliant sequential numbering.
 * 
 * Features:
 * - Custom invoice number prefix (e.g., "INV", "ACME-INV")
 * - Next invoice number counter for sequential generation
 * - Thread-safe invoice number generation using database-level atomicity
 * 
 * @module migrations/007_add_invoice_settings
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 7,
  name: '007_add_invoice_settings',
  description: 'Adds invoice number settings fields to users table',
  createdAt: '2026-01-12'
};

/**
 * Default invoice prefix for new users.
 */
const DEFAULT_INVOICE_PREFIX = 'INV';

/**
 * Default starting number for invoice numbering.
 */
const DEFAULT_NEXT_INVOICE_NUMBER = 1;

/**
 * SQL statement to add invoicePrefix column.
 * Stores the custom prefix for invoice numbers (e.g., "INV", "ACME-INV").
 * Default is "INV" for new users.
 */
const addInvoicePrefixColumnSql = `
  ALTER TABLE users ADD COLUMN invoicePrefix TEXT DEFAULT 'INV' NOT NULL;
`;

/**
 * SQL statement to add nextInvoiceNumber column.
 * Stores the next sequential number to be assigned.
 * Default is 1 for new users.
 */
const addNextInvoiceNumberColumnSql = `
  ALTER TABLE users ADD COLUMN nextInvoiceNumber INTEGER DEFAULT 1 NOT NULL;
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
 * Applies the migration (adds invoice settings columns to users table).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If migration fails
 */
function up(db) {
  try {
    db.transaction(() => {
      // Check and add invoicePrefix column if it doesn't exist
      if (!columnExists(db, 'users', 'invoicePrefix')) {
        db.exec(addInvoicePrefixColumnSql);
      }
      
      // Check and add nextInvoiceNumber column if it doesn't exist
      if (!columnExists(db, 'users', 'nextInvoiceNumber')) {
        db.exec(addNextInvoiceNumberColumnSql);
      }
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (removes invoice settings columns from users table).
 * 
 * Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table.
 * This is a destructive operation that will lose the invoice settings data.
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
      // This is a safe way to handle it for rollback
      
      // Create a temporary table with original schema
      db.exec(`
        CREATE TABLE users_backup AS 
        SELECT 
          id, email, passwordHash, name, businessName, businessAddress,
          vatNumber, isVatRegistered, companyNumber, taxYearStart, 
          preferredLanguage, createdAt, updatedAt
        FROM users;
      `);
      
      // Drop the original table
      db.exec('DROP TABLE users;');
      
      // Recreate the users table without the invoice settings columns
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
          createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
          updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
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
  DEFAULT_INVOICE_PREFIX,
  DEFAULT_NEXT_INVOICE_NUMBER
};
