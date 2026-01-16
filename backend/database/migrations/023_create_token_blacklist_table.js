/**
 * Migration: Create token_blacklist table
 * Stores invalidated JWT tokens for logout persistence across server restarts.
 */

/**
 * Run the migration
 * @param {import('better-sqlite3').Database} db
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      expirationTime INTEGER NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expiration ON token_blacklist(expirationTime);
  `);
}

/**
 * Rollback the migration
 * @param {import('better-sqlite3').Database} db
 */
function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_token_blacklist_expiration;
    DROP INDEX IF EXISTS idx_token_blacklist_token;
    DROP TABLE IF EXISTS token_blacklist;
  `);
}

module.exports = { up, down };
