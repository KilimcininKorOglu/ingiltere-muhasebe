/**
 * Migration: Create reconciliations table
 * 
 * This migration creates the reconciliations table for linking bank transactions
 * to application transactions. This is the core of bank reconciliation functionality.
 * 
 * Reconciliation allows:
 * - Matching a bank transaction to one or more application transactions
 * - Partial matching (when amounts don't match exactly)
 * - Split matching (one bank transaction matching multiple app transactions)
 * - Audit trail of who matched what and when
 * 
 * @module migrations/012_create_reconciliations_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 12,
  name: '012_create_reconciliations_table',
  description: 'Creates the reconciliations table for linking bank and app transactions',
  createdAt: '2026-01-12'
};

/**
 * Valid reconciliation match types.
 * - exact: Bank and app transaction amounts match exactly
 * - partial: App transaction partially covers bank transaction
 * - split: Bank transaction split across multiple app transactions
 * - adjustment: Manual adjustment entry
 */
const VALID_MATCH_TYPES = ['exact', 'partial', 'split', 'adjustment'];

/**
 * Valid reconciliation status values.
 * - pending: Suggested match awaiting confirmation
 * - confirmed: Match confirmed by user
 * - rejected: Match rejected by user
 */
const VALID_STATUSES = ['pending', 'confirmed', 'rejected'];

/**
 * SQL statement to create the reconciliations table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - bankTransactionId: Foreign key to bank_transactions table
 * - transactionId: Foreign key to transactions table (application transaction)
 * - matchType: Type of match (exact, partial, split, adjustment)
 * - matchAmount: Amount matched in pence (may differ from transaction amounts for partial matches)
 * - matchConfidence: System-calculated match confidence score (0-100)
 * - status: Current status of the reconciliation
 * - reconciledBy: User ID who performed/confirmed the reconciliation
 * - reconciledAt: When the reconciliation was confirmed
 * - notes: Notes about the reconciliation
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS reconciliations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bankTransactionId INTEGER NOT NULL,
    transactionId INTEGER NOT NULL,
    matchType TEXT DEFAULT 'exact' NOT NULL CHECK(matchType IN ('exact', 'partial', 'split', 'adjustment')),
    matchAmount INTEGER NOT NULL,
    matchConfidence INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected')),
    reconciledBy INTEGER,
    reconciledAt TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (bankTransactionId) REFERENCES bank_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (reconciledBy) REFERENCES users(id) ON DELETE SET NULL
  );
`;

/**
 * SQL statement to create index on bankTransactionId for faster lookups.
 */
const createBankTransactionIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_reconciliations_bank_transaction_id 
  ON reconciliations(bankTransactionId);
`;

/**
 * SQL statement to create index on transactionId for faster lookups.
 */
const createTransactionIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_reconciliations_transaction_id 
  ON reconciliations(transactionId);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_reconciliations_status 
  ON reconciliations(status);
`;

/**
 * SQL statement to create index on reconciledBy for user queries.
 */
const createReconciledByIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_reconciliations_reconciled_by 
  ON reconciliations(reconciledBy);
`;

/**
 * SQL statement to create index on reconciledAt for date-based queries.
 */
const createReconciledAtIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_reconciliations_reconciled_at 
  ON reconciliations(reconciledAt);
`;

/**
 * SQL statement to create composite index for common queries.
 */
const createBankTransactionStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_reconciliations_bank_txn_status 
  ON reconciliations(bankTransactionId, status);
`;

/**
 * SQL statement to create unique index to prevent duplicate confirmed matches.
 * Each bank transaction can only have one confirmed match to each app transaction.
 */
const createUniqueMatchIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliations_unique_match 
  ON reconciliations(bankTransactionId, transactionId) WHERE status = 'confirmed';
`;

/**
 * SQL trigger to update bank_transactions reconciliation status when a match is confirmed.
 */
const createReconciliationConfirmTriggerSql = `
  CREATE TRIGGER IF NOT EXISTS update_bank_transaction_on_reconcile
  AFTER UPDATE OF status ON reconciliations
  FOR EACH ROW
  WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
  BEGIN
    UPDATE bank_transactions 
    SET reconciliationStatus = 'matched',
        isReconciled = 1,
        updatedAt = datetime('now')
    WHERE id = NEW.bankTransactionId;
    
    UPDATE transactions
    SET status = 'reconciled',
        updatedAt = datetime('now')
    WHERE id = NEW.transactionId;
  END;
`;

/**
 * SQL trigger to update bank_transactions when all reconciliations are rejected.
 */
const createReconciliationRejectTriggerSql = `
  CREATE TRIGGER IF NOT EXISTS update_bank_transaction_on_reject
  AFTER UPDATE OF status ON reconciliations
  FOR EACH ROW
  WHEN NEW.status = 'rejected' AND OLD.status = 'confirmed'
  BEGIN
    UPDATE bank_transactions 
    SET reconciliationStatus = CASE 
      WHEN (SELECT COUNT(*) FROM reconciliations WHERE bankTransactionId = NEW.bankTransactionId AND status = 'confirmed') = 0 
      THEN 'unmatched' 
      ELSE 'matched' 
    END,
    isReconciled = CASE 
      WHEN (SELECT COUNT(*) FROM reconciliations WHERE bankTransactionId = NEW.bankTransactionId AND status = 'confirmed') = 0 
      THEN 0 
      ELSE 1 
    END,
    updatedAt = datetime('now')
    WHERE id = NEW.bankTransactionId;
  END;
`;

/**
 * SQL trigger to update related records when a new confirmed reconciliation is inserted.
 */
const createReconciliationInsertTriggerSql = `
  CREATE TRIGGER IF NOT EXISTS update_records_on_reconciliation_insert
  AFTER INSERT ON reconciliations
  FOR EACH ROW
  WHEN NEW.status = 'confirmed'
  BEGIN
    UPDATE bank_transactions 
    SET reconciliationStatus = 'matched',
        isReconciled = 1,
        updatedAt = datetime('now')
    WHERE id = NEW.bankTransactionId;
    
    UPDATE transactions
    SET status = 'reconciled',
        updatedAt = datetime('now')
    WHERE id = NEW.transactionId;
  END;
`;

/**
 * SQL statement to drop the reconciliations table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS reconciliations;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_reconciliations_bank_transaction_id;
  DROP INDEX IF EXISTS idx_reconciliations_transaction_id;
  DROP INDEX IF EXISTS idx_reconciliations_status;
  DROP INDEX IF EXISTS idx_reconciliations_reconciled_by;
  DROP INDEX IF EXISTS idx_reconciliations_reconciled_at;
  DROP INDEX IF EXISTS idx_reconciliations_bank_txn_status;
  DROP INDEX IF EXISTS idx_reconciliations_unique_match;
`;

/**
 * SQL statement to drop the triggers.
 */
const dropTriggersSql = `
  DROP TRIGGER IF EXISTS update_bank_transaction_on_reconcile;
  DROP TRIGGER IF EXISTS update_bank_transaction_on_reject;
  DROP TRIGGER IF EXISTS update_records_on_reconciliation_insert;
`;

/**
 * Applies the migration (creates the reconciliations table, indexes, and triggers).
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
      db.exec(createBankTransactionIdIndexSql);
      db.exec(createTransactionIdIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createReconciledByIndexSql);
      db.exec(createReconciledAtIndexSql);
      db.exec(createBankTransactionStatusIndexSql);
      db.exec(createUniqueMatchIndexSql);
      db.exec(createReconciliationConfirmTriggerSql);
      db.exec(createReconciliationRejectTriggerSql);
      db.exec(createReconciliationInsertTriggerSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the reconciliations table, indexes, and triggers).
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
    createBankTransactionIdIndexSql,
    createTransactionIdIndexSql,
    createStatusIndexSql,
    createReconciledByIndexSql,
    createReconciledAtIndexSql,
    createBankTransactionStatusIndexSql,
    createUniqueMatchIndexSql,
    createReconciliationConfirmTriggerSql,
    createReconciliationRejectTriggerSql,
    createReconciliationInsertTriggerSql,
    dropTableSql,
    dropIndexesSql,
    dropTriggersSql
  },
  // Export valid values for use by other modules
  VALID_MATCH_TYPES,
  VALID_STATUSES
};
