/**
 * Migration: Create users table
 * 
 * This migration creates the users table with all required fields
 * for authentication and business profile management.
 * 
 * @module migrations/001_create_users_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 1,
  name: '001_create_users_table',
  description: 'Creates the users table with authentication and business profile fields',
  createdAt: '2026-01-12'
};

/**
 * SQL statement to create the users table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - email: Unique email for authentication
 * - passwordHash: Hashed password (bcrypt)
 * - name: User's full name
 * - businessName: Business/company name
 * - businessAddress: Business address
 * - vatNumber: VAT registration number (optional)
 * - isVatRegistered: Whether business is VAT registered
 * - companyNumber: Companies House registration number
 * - taxYearStart: Tax year start date (default: 6 April)
 * - preferredLanguage: User's preferred language ('en' or 'tr')
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS users (
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
`;

/**
 * SQL statement to create index on email for faster lookups.
 */
const createEmailIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

/**
 * SQL statement to create index on companyNumber for lookups.
 */
const createCompanyNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_users_company_number ON users(companyNumber);
`;

/**
 * SQL statement to drop the users table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS users;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_users_email;
  DROP INDEX IF EXISTS idx_users_company_number;
`;

/**
 * Applies the migration (creates the users table and indexes).
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
      db.exec(createEmailIndexSql);
      db.exec(createCompanyNumberIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the users table and indexes).
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
    createEmailIndexSql,
    createCompanyNumberIndexSql,
    dropTableSql,
    dropIndexesSql
  }
};
