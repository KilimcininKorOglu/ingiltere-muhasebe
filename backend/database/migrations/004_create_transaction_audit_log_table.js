/**
 * Migration: Create transaction_audit_log table
 * 
 * This migration creates the transaction_audit_log table to track all changes
 * to transactions for compliance and debugging purposes.
 * 
 * @module migrations/004_create_transaction_audit_log_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 4,
  name: '004_create_transaction_audit_log_table',
  description: 'Creates the transaction_audit_log table for tracking transaction changes',
  createdAt: '2026-01-12'
};

/**
 * Valid action types for audit logging.
 * - create: Transaction was created
 * - update: Transaction was modified
 * - delete: Transaction was deleted
 */
const VALID_AUDIT_ACTIONS = ['create', 'update', 'delete'];

/**
 * SQL statement to create the transaction_audit_log table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - transactionId: The transaction that was changed
 * - userId: User who made the change
 * - action: Type of action (create, update, delete)
 * - previousValues: JSON string of previous values (null for create)
 * - newValues: JSON string of new values (null for delete)
 * - changedFields: JSON array of field names that changed (for update)
 * - ipAddress: IP address of the user who made the change
 * - userAgent: User agent string of the client
 * - createdAt: Timestamp of the change
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS transaction_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transactionId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
    previousValues TEXT,
    newValues TEXT,
    changedFields TEXT,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create index on transactionId for faster lookups.
 */
const createTransactionIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_audit_log_transaction_id ON transaction_audit_log(transactionId);
`;

/**
 * SQL statement to create index on userId for user activity queries.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON transaction_audit_log(userId);
`;

/**
 * SQL statement to create index on action for filtering by action type.
 */
const createActionIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_audit_log_action ON transaction_audit_log(action);
`;

/**
 * SQL statement to create index on createdAt for date-based queries.
 */
const createCreatedAtIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON transaction_audit_log(createdAt);
`;

/**
 * SQL statement to create composite index for common transaction history queries.
 */
const createTransactionCreatedAtIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_audit_log_transaction_created ON transaction_audit_log(transactionId, createdAt);
`;

/**
 * SQL statement to drop the transaction_audit_log table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS transaction_audit_log;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_audit_log_transaction_id;
  DROP INDEX IF EXISTS idx_audit_log_user_id;
  DROP INDEX IF EXISTS idx_audit_log_action;
  DROP INDEX IF EXISTS idx_audit_log_created_at;
  DROP INDEX IF EXISTS idx_audit_log_transaction_created;
`;

/**
 * Applies the migration (creates the transaction_audit_log table and indexes).
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
      db.exec(createTransactionIdIndexSql);
      db.exec(createUserIdIndexSql);
      db.exec(createActionIndexSql);
      db.exec(createCreatedAtIndexSql);
      db.exec(createTransactionCreatedAtIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the transaction_audit_log table and indexes).
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
    createTransactionIdIndexSql,
    createUserIdIndexSql,
    createActionIndexSql,
    createCreatedAtIndexSql,
    createTransactionCreatedAtIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid actions for use by other modules
  VALID_AUDIT_ACTIONS
};
