/**
 * Migration: Create invoices table
 * 
 * This migration creates the invoices table with all required fields
 * for UK VAT compliance and invoice management.
 * 
 * @module migrations/005_create_invoices_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 5,
  name: '005_create_invoices_table',
  description: 'Creates the invoices table with UK VAT compliance fields',
  createdAt: '2026-01-12'
};

/**
 * Valid invoice status values.
 * - draft: Invoice is being prepared
 * - pending: Invoice is finalized and awaiting payment
 * - paid: Invoice has been paid
 * - overdue: Invoice payment is past due date
 * - cancelled: Invoice has been cancelled
 * - refunded: Invoice has been refunded
 */
const VALID_STATUSES = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'];

/**
 * SQL statement to create the invoices table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table
 * - invoiceNumber: Unique invoice number (e.g., INV-2026-0001)
 * - status: Invoice status (draft, pending, paid, overdue, cancelled, refunded)
 * - issueDate: Date the invoice was issued
 * - dueDate: Date payment is due
 * - customerName: Customer/client name
 * - customerAddress: Customer billing address
 * - customerEmail: Customer email address
 * - customerVatNumber: Customer VAT number (for B2B transactions)
 * - subtotal: Total before VAT (in pence for precision)
 * - vatAmount: Total VAT amount (in pence for precision)
 * - totalAmount: Total including VAT (in pence for precision)
 * - currency: Currency code (default: GBP)
 * - notes: Additional notes or terms
 * - paidAt: Timestamp when payment was received
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    invoiceNumber TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'draft' NOT NULL CHECK(status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')),
    issueDate TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerAddress TEXT,
    customerEmail TEXT,
    customerVatNumber TEXT,
    subtotal INTEGER DEFAULT 0 NOT NULL,
    vatAmount INTEGER DEFAULT 0 NOT NULL,
    totalAmount INTEGER DEFAULT 0 NOT NULL,
    currency TEXT DEFAULT 'GBP' NOT NULL,
    notes TEXT,
    paidAt TEXT,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create unique index on invoiceNumber.
 */
const createInvoiceNumberIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoiceNumber);
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(userId);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
`;

/**
 * SQL statement to create index on issueDate for date-based queries.
 */
const createIssueDateIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issueDate);
`;

/**
 * SQL statement to drop the invoices table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS invoices;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_invoices_invoice_number;
  DROP INDEX IF EXISTS idx_invoices_user_id;
  DROP INDEX IF EXISTS idx_invoices_status;
  DROP INDEX IF EXISTS idx_invoices_issue_date;
`;

/**
 * Applies the migration (creates the invoices table and indexes).
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
      db.exec(createInvoiceNumberIndexSql);
      db.exec(createUserIdIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createIssueDateIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the invoices table and indexes).
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
    createInvoiceNumberIndexSql,
    createUserIdIndexSql,
    createStatusIndexSql,
    createIssueDateIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid statuses for use by other modules
  VALID_STATUSES
};
