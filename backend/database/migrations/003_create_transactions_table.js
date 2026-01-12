/**
 * Migration: Create transactions table
 * 
 * This migration creates the transactions table with all required fields
 * for UK pre-accounting transaction management with VAT support.
 * 
 * @module migrations/003_create_transactions_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 3,
  name: '003_create_transactions_table',
  description: 'Creates the transactions table with UK VAT compliance fields',
  createdAt: '2026-01-12'
};

/**
 * Valid transaction type values.
 * - income: Money received
 * - expense: Money spent
 * - transfer: Money moved between accounts
 */
const VALID_TRANSACTION_TYPES = ['income', 'expense', 'transfer'];

/**
 * Valid transaction status values.
 * - pending: Transaction is awaiting processing
 * - cleared: Transaction has been processed/cleared
 * - reconciled: Transaction has been reconciled with bank statement
 * - void: Transaction has been voided/cancelled
 */
const VALID_TRANSACTION_STATUSES = ['pending', 'cleared', 'reconciled', 'void'];

/**
 * Valid payment method values.
 */
const VALID_PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'direct_debit', 'standing_order', 'other'];

/**
 * SQL statement to create the transactions table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table
 * - categoryId: Foreign key to categories table
 * - type: Transaction type (income, expense, transfer)
 * - status: Transaction status (pending, cleared, reconciled, void)
 * - transactionDate: Date of the transaction
 * - description: Description of the transaction
 * - reference: External reference number (e.g., invoice number, receipt number)
 * - amount: Transaction amount in pence (before VAT)
 * - vatAmount: VAT amount in pence
 * - totalAmount: Total amount including VAT in pence
 * - vatRate: VAT rate applied (in basis points, e.g., 2000 = 20%)
 * - currency: Currency code (default: GBP)
 * - paymentMethod: Method of payment
 * - payee: Person/company paid or received from
 * - receiptPath: Path to uploaded receipt/document
 * - notes: Additional notes
 * - isRecurring: Whether this is a recurring transaction
 * - recurringFrequency: Frequency of recurrence (weekly, monthly, yearly)
 * - linkedTransactionId: For transfers, links to the corresponding transaction
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS transactions (
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
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(userId);
`;

/**
 * SQL statement to create index on categoryId for filtering.
 */
const createCategoryIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(categoryId);
`;

/**
 * SQL statement to create index on type for filtering.
 */
const createTypeIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
`;

/**
 * SQL statement to create index on transactionDate for date-based queries.
 */
const createTransactionDateIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transactionDate);
`;

/**
 * SQL statement to create index on reference for lookups.
 */
const createReferenceIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
`;

/**
 * SQL statement to create composite index for common date range queries by user.
 */
const createUserDateIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(userId, transactionDate);
`;

/**
 * SQL statement to create composite index for VAT report queries.
 */
const createVatReportIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_transactions_vat_report ON transactions(userId, transactionDate, type, vatAmount);
`;

/**
 * SQL statement to drop the transactions table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS transactions;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_transactions_user_id;
  DROP INDEX IF EXISTS idx_transactions_category_id;
  DROP INDEX IF EXISTS idx_transactions_type;
  DROP INDEX IF EXISTS idx_transactions_status;
  DROP INDEX IF EXISTS idx_transactions_date;
  DROP INDEX IF EXISTS idx_transactions_reference;
  DROP INDEX IF EXISTS idx_transactions_user_date;
  DROP INDEX IF EXISTS idx_transactions_vat_report;
`;

/**
 * Applies the migration (creates the transactions table and indexes).
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
      db.exec(createCategoryIdIndexSql);
      db.exec(createTypeIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createTransactionDateIndexSql);
      db.exec(createReferenceIndexSql);
      db.exec(createUserDateIndexSql);
      db.exec(createVatReportIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the transactions table and indexes).
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
    createCategoryIdIndexSql,
    createTypeIndexSql,
    createStatusIndexSql,
    createTransactionDateIndexSql,
    createReferenceIndexSql,
    createUserDateIndexSql,
    createVatReportIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid types and statuses for use by other modules
  VALID_TRANSACTION_TYPES,
  VALID_TRANSACTION_STATUSES,
  VALID_PAYMENT_METHODS
};
