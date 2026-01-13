/**
 * Migration: Create bank_transactions table
 * 
 * This migration creates the bank_transactions table for storing imported
 * bank statement transactions from bank feeds or CSV imports.
 * 
 * Bank transactions are distinct from application transactions:
 * - Bank transactions come from external sources (bank feeds, statement imports)
 * - Application transactions are created within the system
 * - Reconciliation links the two together
 * 
 * @module migrations/011_create_bank_transactions_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 11,
  name: '011_create_bank_transactions_table',
  description: 'Creates the bank_transactions table for imported bank statement data',
  createdAt: '2026-01-12'
};

/**
 * Valid bank transaction types.
 * - credit: Money received (positive transaction)
 * - debit: Money paid out (negative transaction)
 */
const VALID_TRANSACTION_TYPES = ['credit', 'debit'];

/**
 * Valid import source types.
 * - manual: Manually entered
 * - csv_import: Imported from CSV file
 * - open_banking: Imported via Open Banking API
 * - statement_upload: Imported from uploaded bank statement
 */
const VALID_IMPORT_SOURCES = ['manual', 'csv_import', 'open_banking', 'statement_upload'];

/**
 * Valid reconciliation status values.
 * - unmatched: Not yet matched to an application transaction
 * - matched: Matched to one or more application transactions
 * - excluded: Excluded from reconciliation (e.g., internal transfers)
 * - reviewed: Manually reviewed but not matched
 */
const VALID_RECONCILIATION_STATUSES = ['unmatched', 'matched', 'excluded', 'reviewed'];

/**
 * SQL statement to create the bank_transactions table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - bankAccountId: Foreign key to bank_accounts table
 * - transactionDate: Date of the transaction
 * - postingDate: Date transaction was posted to account (may differ from transaction date)
 * - description: Transaction description from bank statement
 * - reference: Bank's transaction reference number
 * - transactionType: Type of transaction (credit/debit)
 * - amount: Absolute transaction amount in pence
 * - runningBalance: Balance after transaction in pence (if available from bank)
 * - importSource: How the transaction was imported
 * - importBatchId: Batch ID for grouping imported transactions
 * - importedAt: When the transaction was imported
 * - rawData: Original raw data from import (JSON string)
 * - fitId: Financial Institution Transaction ID (for deduplication)
 * - reconciliationStatus: Current reconciliation status
 * - reconciliationNotes: Notes about reconciliation
 * - isReconciled: Whether transaction has been fully reconciled
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bankAccountId INTEGER NOT NULL,
    transactionDate INTEGER NOT NULL,
    postingDate INTEGER,
    description TEXT NOT NULL,
    reference TEXT,
    transactionType TEXT NOT NULL CHECK(transactionType IN ('credit', 'debit')),
    amount INTEGER NOT NULL,
    runningBalance INTEGER,
    importSource TEXT DEFAULT 'manual' NOT NULL CHECK(importSource IN ('manual', 'csv_import', 'open_banking', 'statement_upload')),
    importBatchId TEXT,
    importedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    rawData TEXT,
    fitId TEXT,
    reconciliationStatus TEXT DEFAULT 'unmatched' NOT NULL CHECK(reconciliationStatus IN ('unmatched', 'matched', 'excluded', 'reviewed')),
    reconciliationNotes TEXT,
    isReconciled INTEGER DEFAULT 0 NOT NULL,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    FOREIGN KEY (bankAccountId) REFERENCES bank_accounts(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create index on bankAccountId for faster lookups.
 */
const createBankAccountIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id 
  ON bank_transactions(bankAccountId);
`;

/**
 * SQL statement to create index on transactionDate for date-based queries.
 */
const createTransactionDateIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_date 
  ON bank_transactions(transactionDate);
`;

/**
 * SQL statement to create index on reconciliationStatus for filtering.
 */
const createReconciliationStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciliation_status 
  ON bank_transactions(reconciliationStatus);
`;

/**
 * SQL statement to create index on importBatchId for grouping.
 */
const createImportBatchIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_import_batch_id 
  ON bank_transactions(importBatchId);
`;

/**
 * SQL statement to create composite index for common date range queries by account.
 */
const createAccountDateIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_date 
  ON bank_transactions(bankAccountId, transactionDate);
`;

/**
 * SQL statement to create unique index on fitId per bank account for deduplication.
 * fitId is optional, so we only enforce uniqueness when it's not null.
 */
const createUniqueFitIdIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_unique_fit_id 
  ON bank_transactions(bankAccountId, fitId) WHERE fitId IS NOT NULL;
`;

/**
 * SQL statement to create index on isReconciled for filtering unreconciled.
 */
const createIsReconciledIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_bank_transactions_is_reconciled 
  ON bank_transactions(isReconciled);
`;

/**
 * SQL statement to drop the bank_transactions table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS bank_transactions;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_bank_transactions_bank_account_id;
  DROP INDEX IF EXISTS idx_bank_transactions_transaction_date;
  DROP INDEX IF EXISTS idx_bank_transactions_reconciliation_status;
  DROP INDEX IF EXISTS idx_bank_transactions_import_batch_id;
  DROP INDEX IF EXISTS idx_bank_transactions_account_date;
  DROP INDEX IF EXISTS idx_bank_transactions_unique_fit_id;
  DROP INDEX IF EXISTS idx_bank_transactions_is_reconciled;
`;

/**
 * Applies the migration (creates the bank_transactions table and indexes).
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
      db.exec(createBankAccountIdIndexSql);
      db.exec(createTransactionDateIndexSql);
      db.exec(createReconciliationStatusIndexSql);
      db.exec(createImportBatchIdIndexSql);
      db.exec(createAccountDateIndexSql);
      db.exec(createUniqueFitIdIndexSql);
      db.exec(createIsReconciledIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the bank_transactions table and indexes).
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
    createBankAccountIdIndexSql,
    createTransactionDateIndexSql,
    createReconciliationStatusIndexSql,
    createImportBatchIdIndexSql,
    createAccountDateIndexSql,
    createUniqueFitIdIndexSql,
    createIsReconciledIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid values for use by other modules
  VALID_TRANSACTION_TYPES,
  VALID_IMPORT_SOURCES,
  VALID_RECONCILIATION_STATUSES
};
