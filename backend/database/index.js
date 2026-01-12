/**
 * Database connection module for SQLite using better-sqlite3.
 * Provides a singleton database connection and utility functions.
 * 
 * @module database
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Database configuration options
 * @typedef {Object} DatabaseConfig
 * @property {string} path - Path to the SQLite database file
 * @property {boolean} verbose - Enable verbose mode for debugging
 * @property {boolean} readonly - Open database in readonly mode
 * @property {boolean} fileMustExist - Throw error if database file doesn't exist
 */

/**
 * Default database configuration
 * @type {DatabaseConfig}
 */
const defaultConfig = {
  path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/database.sqlite'),
  verbose: process.env.NODE_ENV === 'development' ? console.log : null,
  readonly: false,
  fileMustExist: false
};

/**
 * Singleton database instance
 * @type {Database.Database|null}
 */
let databaseInstance = null;

/**
 * Ensures the data directory exists for the database file.
 * @param {string} databasePath - Path to the database file
 * @returns {void}
 */
function ensureDataDirectory(databasePath) {
  const directory = path.dirname(databasePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

/**
 * Opens a connection to the SQLite database.
 * Creates a new database file if it doesn't exist.
 * Uses a singleton pattern to reuse the same connection.
 * 
 * @param {Partial<DatabaseConfig>} [config={}] - Database configuration options
 * @returns {Database.Database} The database connection instance
 * @throws {Error} If the database connection fails
 */
function openDatabase(config = {}) {
  // Return existing instance if already connected
  if (databaseInstance) {
    return databaseInstance;
  }

  const mergedConfig = { ...defaultConfig, ...config };

  // Ensure the data directory exists
  ensureDataDirectory(mergedConfig.path);

  try {
    databaseInstance = new Database(mergedConfig.path, {
      verbose: mergedConfig.verbose,
      readonly: mergedConfig.readonly,
      fileMustExist: mergedConfig.fileMustExist
    });

    // Enable foreign keys for data integrity
    databaseInstance.pragma('foreign_keys = ON');

    // Enable Write-Ahead Logging for better concurrent performance
    databaseInstance.pragma('journal_mode = WAL');

    // Return more informative error messages
    databaseInstance.pragma('case_sensitive_like = OFF');

    return databaseInstance;
  } catch (error) {
    const errorMessage = `Failed to open database at ${mergedConfig.path}: ${error.message}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Closes the database connection.
 * Safely closes the connection and clears the singleton instance.
 * 
 * @returns {void}
 * @throws {Error} If closing the database fails
 */
function closeDatabase() {
  if (databaseInstance) {
    try {
      databaseInstance.close();
      databaseInstance = null;
    } catch (error) {
      const errorMessage = `Failed to close database: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}

/**
 * Gets the current database instance without creating a new one.
 * 
 * @returns {Database.Database|null} The database instance or null if not connected
 */
function getDatabase() {
  return databaseInstance;
}

/**
 * Checks if the database connection is open.
 * 
 * @returns {boolean} True if the database is connected, false otherwise
 */
function isConnected() {
  return databaseInstance !== null && databaseInstance.open;
}

/**
 * Executes a function within a transaction.
 * Automatically commits on success or rolls back on error.
 * 
 * @template T
 * @param {function(Database.Database): T} fn - Function to execute within the transaction
 * @returns {T} The result of the function
 * @throws {Error} If the transaction fails
 */
function transaction(fn) {
  const db = openDatabase();
  return db.transaction(fn)(db);
}

/**
 * Creates a prepared statement for reuse.
 * Prepared statements are more efficient for repeated queries.
 * 
 * @param {string} sql - SQL statement to prepare
 * @returns {Database.Statement} The prepared statement
 */
function prepare(sql) {
  const db = openDatabase();
  return db.prepare(sql);
}

/**
 * Executes a SQL statement and returns all results.
 * 
 * @param {string} sql - SQL query to execute
 * @param {Object|Array} [params={}] - Parameters for the query
 * @returns {Object[]} Array of result rows
 */
function query(sql, params = {}) {
  const db = openDatabase();
  return db.prepare(sql).all(params);
}

/**
 * Executes a SQL statement and returns the first result.
 * 
 * @param {string} sql - SQL query to execute
 * @param {Object|Array} [params={}] - Parameters for the query
 * @returns {Object|undefined} The first result row or undefined
 */
function queryOne(sql, params = {}) {
  const db = openDatabase();
  return db.prepare(sql).get(params);
}

/**
 * Executes a SQL statement that modifies data (INSERT, UPDATE, DELETE).
 * 
 * @param {string} sql - SQL statement to execute
 * @param {Object|Array} [params={}] - Parameters for the statement
 * @returns {Database.RunResult} The result containing changes and lastInsertRowid
 */
function execute(sql, params = {}) {
  const db = openDatabase();
  return db.prepare(sql).run(params);
}

/**
 * Executes multiple SQL statements (useful for schema setup).
 * 
 * @param {string} sql - Multiple SQL statements separated by semicolons
 * @returns {Database.Database} The database instance
 */
function executeMany(sql) {
  const db = openDatabase();
  return db.exec(sql);
}

module.exports = {
  openDatabase,
  closeDatabase,
  getDatabase,
  isConnected,
  transaction,
  prepare,
  query,
  queryOne,
  execute,
  executeMany,
  // Export default config for testing purposes
  defaultConfig
};
