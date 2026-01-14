/**
 * Migration: Add bankAccountId to transactions table
 * 
 * This migration adds a foreign key to link transactions with bank accounts.
 * 
 * @module migrations/022_add_bank_account_to_transactions
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 22,
  name: '022_add_bank_account_to_transactions',
  description: 'Adds bankAccountId column to transactions table for bank account linking',
  createdAt: '2026-01-14'
};

/**
 * Run the migration
 * @param {import('better-sqlite3').Database} db
 */
function up(db) {
  // Add bankAccountId column to transactions table
  db.exec(`
    ALTER TABLE transactions ADD COLUMN bankAccountId INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL;
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_bank_account_id ON transactions(bankAccountId);
  `);

  console.log('Migration 022: Added bankAccountId column to transactions table');
}

/**
 * Rollback the migration
 * @param {import('better-sqlite3').Database} db
 */
function down(db) {
  // SQLite doesn't support DROP COLUMN directly, need to recreate table
  // For simplicity, we'll just drop the index (column will remain but be unused)
  db.exec(`
    DROP INDEX IF EXISTS idx_transactions_bank_account_id;
  `);

  console.log('Migration 022 rollback: Dropped bankAccountId index');
}

module.exports = {
  up,
  down,
  migrationInfo
};
