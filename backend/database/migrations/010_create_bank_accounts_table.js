/**
 * Migration: Create bank_accounts table
 * 
 * This migration creates the bank_accounts table with UK-specific banking fields
 * including sort code and account number for UK bank accounts.
 * 
 * UK Banking Details:
 * - Sort Code: 6-digit code identifying the bank branch (format: XX-XX-XX)
 * - Account Number: 8-digit account number
 * - IBAN: Optional International Bank Account Number
 * - BIC/SWIFT: Optional Bank Identifier Code
 * 
 * @module migrations/010_create_bank_accounts_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 10,
  name: '010_create_bank_accounts_table',
  description: 'Creates the bank_accounts table with UK-specific banking fields',
  createdAt: '2026-01-12'
};

/**
 * Valid bank account types.
 * - current: Current account (business or personal)
 * - savings: Savings account
 * - business: Business bank account
 */
const VALID_ACCOUNT_TYPES = ['current', 'savings', 'business'];

/**
 * Valid currency codes (ISO 4217).
 * Primary focus on GBP (British Pound) with support for common trading currencies.
 */
const VALID_CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * SQL statement to create the bank_accounts table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table
 * - accountName: Friendly name for the account (e.g., "Barclays Business")
 * - bankName: Name of the bank (e.g., "Barclays Bank PLC")
 * - accountType: Type of account (current, savings, business)
 * - sortCode: UK sort code (6 digits, stored without hyphens)
 * - accountNumber: UK account number (8 digits)
 * - iban: Optional IBAN for international transactions
 * - bic: Optional BIC/SWIFT code
 * - currency: Account currency (default: GBP)
 * - openingBalance: Initial balance in pence (can be negative for overdrafts)
 * - currentBalance: Current balance in pence (maintained by transactions)
 * - isDefault: Whether this is the default account for the user
 * - isActive: Whether the account is active
 * - notes: Additional notes about the account
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    accountName TEXT NOT NULL,
    bankName TEXT NOT NULL,
    accountType TEXT DEFAULT 'current' NOT NULL CHECK(accountType IN ('current', 'savings', 'business')),
    sortCode TEXT NOT NULL,
    accountNumber TEXT NOT NULL,
    iban TEXT,
    bic TEXT,
    currency TEXT DEFAULT 'GBP' NOT NULL CHECK(currency IN ('GBP', 'EUR', 'USD')),
    openingBalance INTEGER DEFAULT 0 NOT NULL,
    currentBalance INTEGER DEFAULT 0 NOT NULL,
    isDefault INTEGER DEFAULT 0 NOT NULL,
    isActive INTEGER DEFAULT 1 NOT NULL,
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(userId);
`;

/**
 * SQL statement to create index on sortCode for faster lookups.
 */
const createSortCodeIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_accounts_sort_code ON bank_accounts(sortCode);
`;

/**
 * SQL statement to create index on accountNumber for faster lookups.
 */
const createAccountNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_number ON bank_accounts(accountNumber);
`;

/**
 * SQL statement to create index on isActive for filtering active accounts.
 */
const createIsActiveIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON bank_accounts(isActive);
`;

/**
 * SQL statement to create unique constraint on sortCode + accountNumber per user.
 * This prevents duplicate bank accounts for the same user.
 */
const createUniqueSortCodeAccountNumberIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_unique_sort_account 
  ON bank_accounts(userId, sortCode, accountNumber);
`;

/**
 * SQL trigger to ensure only one default account per user on INSERT.
 * When inserting a new default account, unset other defaults for the same user.
 */
const createDefaultAccountTriggerInsertSql = `
  CREATE TRIGGER IF NOT EXISTS ensure_single_default_insert
  AFTER INSERT ON bank_accounts
  FOR EACH ROW
  WHEN NEW.isDefault = 1
  BEGIN
    UPDATE bank_accounts 
    SET isDefault = 0 
    WHERE userId = NEW.userId AND id != NEW.id AND isDefault = 1;
  END;
`;

/**
 * SQL trigger to ensure only one default account per user on UPDATE.
 * When updating an account to be default, unset other defaults for the same user.
 */
const createDefaultAccountTriggerUpdateSql = `
  CREATE TRIGGER IF NOT EXISTS ensure_single_default_update
  AFTER UPDATE OF isDefault ON bank_accounts
  FOR EACH ROW
  WHEN NEW.isDefault = 1 AND OLD.isDefault = 0
  BEGIN
    UPDATE bank_accounts 
    SET isDefault = 0 
    WHERE userId = NEW.userId AND id != NEW.id AND isDefault = 1;
  END;
`;

/**
 * SQL statement to drop the bank_accounts table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS bank_accounts;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_bank_accounts_user_id;
  DROP INDEX IF EXISTS idx_bank_accounts_sort_code;
  DROP INDEX IF EXISTS idx_bank_accounts_account_number;
  DROP INDEX IF EXISTS idx_bank_accounts_is_active;
  DROP INDEX IF EXISTS idx_bank_accounts_unique_sort_account;
`;

/**
 * SQL statement to drop the triggers.
 */
const dropTriggersSql = `
  DROP TRIGGER IF EXISTS ensure_single_default_insert;
  DROP TRIGGER IF EXISTS ensure_single_default_update;
`;

/**
 * Applies the migration (creates the bank_accounts table, indexes, and triggers).
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
      db.exec(createSortCodeIndexSql);
      db.exec(createAccountNumberIndexSql);
      db.exec(createIsActiveIndexSql);
      db.exec(createUniqueSortCodeAccountNumberIndexSql);
      db.exec(createDefaultAccountTriggerInsertSql);
      db.exec(createDefaultAccountTriggerUpdateSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the bank_accounts table, indexes, and triggers).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If rollback fails
 */
function down(db) {
  try {
    db.transaction(() => {
      // Drop triggers first
      db.exec(dropTriggersSql);
      // Drop indexes (they are dropped automatically with the table, but explicit is better)
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
    createSortCodeIndexSql,
    createAccountNumberIndexSql,
    createIsActiveIndexSql,
    createUniqueSortCodeAccountNumberIndexSql,
    createDefaultAccountTriggerInsertSql,
    createDefaultAccountTriggerUpdateSql,
    dropTableSql,
    dropIndexesSql,
    dropTriggersSql
  },
  // Export valid values for use by other modules
  VALID_ACCOUNT_TYPES,
  VALID_CURRENCIES
};
