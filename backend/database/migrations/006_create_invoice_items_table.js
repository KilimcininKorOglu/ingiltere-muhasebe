/**
 * Migration: Create invoice_items table
 * 
 * This migration creates the invoice_items table with all required fields
 * for storing line items on invoices with UK VAT compliance.
 * 
 * @module migrations/006_create_invoice_items_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 6,
  name: '006_create_invoice_items_table',
  description: 'Creates the invoice_items table with UK VAT compliance fields',
  createdAt: '2026-01-12'
};

/**
 * SQL statement to create the invoice_items table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - invoiceId: Foreign key to invoices table
 * - description: Item/service description
 * - quantity: Quantity of items (stored as TEXT for decimal precision, e.g., "1.5")
 * - unitPrice: Price per unit (in pence for precision)
 * - vatRateId: VAT rate identifier (standard, reduced, zero, exempt, outside-scope)
 * - vatRatePercent: VAT rate percentage at time of invoice (for historical accuracy)
 * - vatAmount: VAT amount for this line item (in pence)
 * - lineTotal: Total for this line item including VAT (in pence)
 * - sortOrder: Order of items on the invoice
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceId INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity TEXT DEFAULT '1' NOT NULL,
    unitPrice INTEGER DEFAULT 0 NOT NULL,
    vatRateId TEXT DEFAULT 'standard' NOT NULL,
    vatRatePercent REAL DEFAULT 20 NOT NULL,
    vatAmount INTEGER DEFAULT 0 NOT NULL,
    lineTotal INTEGER DEFAULT 0 NOT NULL,
    sortOrder INTEGER DEFAULT 0 NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create index on invoiceId for faster lookups.
 */
const createInvoiceIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoiceId);
`;

/**
 * SQL statement to create index on vatRateId for VAT reporting.
 */
const createVatRateIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_invoice_items_vat_rate_id ON invoice_items(vatRateId);
`;

/**
 * SQL statement to drop the invoice_items table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS invoice_items;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_invoice_items_invoice_id;
  DROP INDEX IF EXISTS idx_invoice_items_vat_rate_id;
`;

/**
 * Applies the migration (creates the invoice_items table and indexes).
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
      db.exec(createInvoiceIdIndexSql);
      db.exec(createVatRateIdIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the invoice_items table and indexes).
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
    createInvoiceIdIndexSql,
    createVatRateIdIndexSql,
    dropTableSql,
    dropIndexesSql
  }
};
