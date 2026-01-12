/**
 * Migration: Create categories table
 * 
 * This migration creates the categories table with all required fields
 * for UK chart of accounts category management.
 * 
 * @module migrations/002_create_categories_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 2,
  name: '002_create_categories_table',
  description: 'Creates the categories table for UK chart of accounts',
  createdAt: '2026-01-12'
};

/**
 * Valid category type values.
 * - asset: Resources owned (e.g., bank accounts, inventory)
 * - liability: Debts owed (e.g., loans, accounts payable)
 * - equity: Owner's investment and retained earnings
 * - income: Revenue from business activities
 * - expense: Costs of running the business
 */
const VALID_CATEGORY_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

/**
 * SQL statement to create the categories table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - code: Unique category code (e.g., "1000" for assets)
 * - name: Category name in English
 * - nameTr: Category name in Turkish
 * - description: Description of the category
 * - type: Category type (asset, liability, equity, income, expense)
 * - parentId: Parent category ID for hierarchical structure (null for top-level)
 * - isSystem: Whether this is a system-defined category (cannot be deleted)
 * - isActive: Whether the category is active for use
 * - displayOrder: Order for display purposes
 * - vatApplicable: Whether VAT is typically applicable to this category
 * - defaultVatRate: Default VAT rate for this category (in basis points, e.g., 2000 = 20%)
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    nameTr TEXT,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    parentId INTEGER,
    isSystem INTEGER DEFAULT 0 NOT NULL,
    isActive INTEGER DEFAULT 1 NOT NULL,
    displayOrder INTEGER DEFAULT 0,
    vatApplicable INTEGER DEFAULT 0 NOT NULL,
    defaultVatRate INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (parentId) REFERENCES categories(id) ON DELETE SET NULL
  );
`;

/**
 * SQL statement to create unique index on code.
 */
const createCodeIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
`;

/**
 * SQL statement to create index on type for filtering.
 */
const createTypeIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
`;

/**
 * SQL statement to create index on parentId for hierarchy queries.
 */
const createParentIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parentId);
`;

/**
 * SQL statement to create index on isActive for filtering.
 */
const createIsActiveIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(isActive);
`;

/**
 * SQL statement to create composite index on type and isActive for common queries.
 */
const createTypeActiveIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_categories_type_active ON categories(type, isActive);
`;

/**
 * SQL statement to drop the categories table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS categories;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_categories_code;
  DROP INDEX IF EXISTS idx_categories_type;
  DROP INDEX IF EXISTS idx_categories_parent_id;
  DROP INDEX IF EXISTS idx_categories_is_active;
  DROP INDEX IF EXISTS idx_categories_type_active;
`;

/**
 * Applies the migration (creates the categories table and indexes).
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
      db.exec(createCodeIndexSql);
      db.exec(createTypeIndexSql);
      db.exec(createParentIdIndexSql);
      db.exec(createIsActiveIndexSql);
      db.exec(createTypeActiveIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the categories table and indexes).
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
    createCodeIndexSql,
    createTypeIndexSql,
    createParentIdIndexSql,
    createIsActiveIndexSql,
    createTypeActiveIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid types for use by other modules
  VALID_CATEGORY_TYPES
};
