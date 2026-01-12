/**
 * Migration: Add isReconciled field to transactions table
 * 
 * This migration adds an isReconciled boolean field to the transactions table
 * to track whether a transaction has been reconciled with a bank transaction.
 * 
 * This complements the 'reconciled' status by providing a quick boolean check.
 * 
 * @module migrations/013_add_reconciled_to_transactions
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 13,
  name: '013_add_reconciled_to_transactions',
  description: 'Adds isReconciled field to transactions table for bank reconciliation tracking',
  createdAt: '2026-01-12'
};

/**
 * SQL statement to add the isReconciled column.
 */
const addColumnSql = `
  ALTER TABLE transactions ADD COLUMN isReconciled INTEGER DEFAULT 0 NOT NULL;
`;

/**
 * SQL statement to create an index on the isReconciled column.
 */
const createIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_is_reconciled ON transactions(isReconciled);
`;

/**
 * SQL statement to drop the isReconciled column.
 * Note: SQLite doesn't support DROP COLUMN directly before version 3.35.0.
 * We need to recreate the table without the column.
 */
const dropColumnSql = `
  -- SQLite doesn't support DROP COLUMN in older versions
  -- For rollback, we need to recreate the table
  
  -- Create temporary table without isReconciled
  CREATE TABLE transactions_temp AS SELECT 
    id, userId, categoryId, type, status, transactionDate, description, reference,
    amount, vatAmount, totalAmount, vatRate, currency, paymentMethod, payee, 
    receiptPath, notes, isRecurring, recurringFrequency, linkedTransactionId,
    createdAt, updatedAt
  FROM transactions;
  
  -- Drop original table
  DROP TABLE transactions;
  
  -- Recreate original table
  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    categoryId INTEGER,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
    status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'cleared', 'reconciled', 'void')),
    transactionDate TEXT NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    amount INTEGER DEFAULT 0 NOT NULL,
    vatAmount INTEGER DEFAULT 0 NOT NULL,
    totalAmount INTEGER DEFAULT 0 NOT NULL,
    vatRate INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'GBP' NOT NULL,
    paymentMethod TEXT CHECK(paymentMethod IS NULL OR paymentMethod IN ('cash', 'bank_transfer', 'card', 'cheque', 'direct_debit', 'standing_order', 'other')),
    payee TEXT,
    receiptPath TEXT,
    notes TEXT,
    isRecurring INTEGER DEFAULT 0 NOT NULL,
    recurringFrequency TEXT CHECK(recurringFrequency IS NULL OR recurringFrequency IN ('weekly', 'monthly', 'yearly')),
    linkedTransactionId INTEGER,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (linkedTransactionId) REFERENCES transactions(id) ON DELETE SET NULL
  );
  
  -- Copy data back
  INSERT INTO transactions SELECT 
    id, userId, categoryId, type, status, transactionDate, description, reference,
    amount, vatAmount, totalAmount, vatRate, currency, paymentMethod, payee, 
    receiptPath, notes, isRecurring, recurringFrequency, linkedTransactionId,
    createdAt, updatedAt
  FROM transactions_temp;
  
  -- Drop temp table
  DROP TABLE transactions_temp;
`;

/**
 * SQL statement to drop the index.
 */
const dropIndexSql = `
  DROP INDEX IF EXISTS idx_transactions_is_reconciled;
`;

/**
 * Check if column exists (for idempotency).
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {boolean} True if column exists
 */
function columnExists(db) {
  const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
  return tableInfo.some(col => col.name === 'isReconciled');
}

/**
 * Applies the migration (adds isReconciled column and index).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If migration fails
 */
function up(db) {
  try {
    // Check if column already exists (idempotency)
    if (columnExists(db)) {
      console.log(`Migration ${migrationInfo.name}: Column already exists, skipping.`);
      return;
    }
    
    // Use a transaction to ensure atomicity
    db.transaction(() => {
      db.exec(addColumnSql);
      db.exec(createIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (removes isReconciled column).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If rollback fails
 */
function down(db) {
  try {
    // Check if column exists
    if (!columnExists(db)) {
      console.log(`Migration ${migrationInfo.name}: Column doesn't exist, skipping rollback.`);
      return;
    }
    
    db.transaction(() => {
      db.exec(dropIndexSql);
      db.exec(dropColumnSql);
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
    addColumnSql,
    createIndexSql,
    dropColumnSql,
    dropIndexSql
  }
};
