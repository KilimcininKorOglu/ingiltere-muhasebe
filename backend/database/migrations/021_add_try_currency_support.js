/**
 * Migration: Add TRY (Turkish Lira) currency support to bank_accounts table
 */

/**
 * Run the migration
 * @param {import('better-sqlite3').Database} db
 */
function up(db) {
  // SQLite doesn't support ALTER TABLE to modify CHECK constraints
  // We need to recreate the table with the new constraint
  
  db.exec(`
    -- Create temporary table with new constraint
    CREATE TABLE bank_accounts_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      accountName TEXT NOT NULL,
      bankName TEXT NOT NULL,
      accountType TEXT DEFAULT 'current' NOT NULL CHECK(accountType IN ('current', 'savings', 'business')),
      sortCode TEXT NOT NULL,
      accountNumber TEXT NOT NULL,
      iban TEXT,
      bic TEXT,
      currency TEXT DEFAULT 'GBP' NOT NULL CHECK(currency IN ('GBP', 'EUR', 'USD', 'TRY')),
      openingBalance INTEGER DEFAULT 0 NOT NULL,
      currentBalance INTEGER DEFAULT 0 NOT NULL,
      isDefault INTEGER DEFAULT 0 NOT NULL,
      isActive INTEGER DEFAULT 1 NOT NULL,
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
      updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Copy data from old table
    INSERT INTO bank_accounts_new 
    SELECT * FROM bank_accounts;

    -- Drop old table
    DROP TABLE bank_accounts;

    -- Rename new table
    ALTER TABLE bank_accounts_new RENAME TO bank_accounts;

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(userId);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_sort_code ON bank_accounts(sortCode);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_number ON bank_accounts(accountNumber);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON bank_accounts(isActive);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_unique_sort_account 
      ON bank_accounts(userId, sortCode, accountNumber);

    -- Recreate triggers
    CREATE TRIGGER IF NOT EXISTS ensure_single_default_insert
    AFTER INSERT ON bank_accounts
    FOR EACH ROW
    WHEN NEW.isDefault = 1
    BEGIN
      UPDATE bank_accounts 
      SET isDefault = 0 
      WHERE userId = NEW.userId AND id != NEW.id AND isDefault = 1;
    END;

    CREATE TRIGGER IF NOT EXISTS ensure_single_default_update
    AFTER UPDATE OF isDefault ON bank_accounts
    FOR EACH ROW
    WHEN NEW.isDefault = 1 AND OLD.isDefault = 0
    BEGIN
      UPDATE bank_accounts 
      SET isDefault = 0 
      WHERE userId = NEW.userId AND id != NEW.id AND isDefault = 1;
    END;
  `);

  console.log('Migration 021_add_try_currency_support applied successfully.');
}

/**
 * Rollback the migration
 * @param {import('better-sqlite3').Database} db
 */
function down(db) {
  // Recreate table without TRY support
  db.exec(`
    CREATE TABLE bank_accounts_old (
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

    -- Copy data (TRY accounts will fail due to constraint)
    INSERT INTO bank_accounts_old 
    SELECT * FROM bank_accounts WHERE currency != 'TRY';

    DROP TABLE bank_accounts;
    ALTER TABLE bank_accounts_old RENAME TO bank_accounts;

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(userId);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_sort_code ON bank_accounts(sortCode);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_number ON bank_accounts(accountNumber);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON bank_accounts(isActive);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_unique_sort_account 
      ON bank_accounts(userId, sortCode, accountNumber);
  `);

  console.log('Migration 021_add_try_currency_support rolled back.');
}

module.exports = { up, down };
