/**
 * Database migration runner.
 * Handles running and rolling back migrations.
 * 
 * @module database/migrate
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query, executeMany } = require('./index');

/**
 * Path to migrations directory
 */
const migrationsDir = path.join(__dirname, 'migrations');

/**
 * SQL to create migrations tracking table
 */
const createMigrationsTableSql = `
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    appliedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
  );
`;

/**
 * Ensures the migrations tracking table exists.
 * 
 * @returns {void}
 */
function ensureMigrationsTable() {
  const db = openDatabase();
  db.exec(createMigrationsTableSql);
}

/**
 * Gets list of already applied migrations.
 * 
 * @returns {string[]} Array of applied migration names
 */
function getAppliedMigrations() {
  ensureMigrationsTable();
  const rows = query('SELECT name FROM migrations ORDER BY id ASC');
  return rows.map(row => row.name);
}

/**
 * Marks a migration as applied.
 * 
 * @param {string} name - Migration name
 * @returns {void}
 */
function markMigrationApplied(name) {
  execute('INSERT INTO migrations (name) VALUES (?)', [name]);
}

/**
 * Removes a migration from the applied list.
 * 
 * @param {string} name - Migration name
 * @returns {void}
 */
function unmarkMigrationApplied(name) {
  execute('DELETE FROM migrations WHERE name = ?', [name]);
}

/**
 * Gets all migration files from the migrations directory.
 * 
 * @returns {string[]} Array of migration file names (sorted)
 */
function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js') && file.match(/^\d+_/))
    .sort();
  
  return files;
}

/**
 * Runs all pending migrations.
 * 
 * @returns {{ applied: string[], errors: string[] }} Result object with applied migrations and errors
 */
function runMigrations() {
  const db = openDatabase();
  const appliedMigrations = getAppliedMigrations();
  const migrationFiles = getMigrationFiles();
  
  const results = {
    applied: [],
    errors: []
  };
  
  for (const file of migrationFiles) {
    const migrationName = file.replace('.js', '');
    
    // Skip if already applied
    if (appliedMigrations.includes(migrationName)) {
      console.log(`Skipping ${migrationName} (already applied)`);
      continue;
    }
    
    try {
      console.log(`Applying migration: ${migrationName}`);
      const migration = require(path.join(migrationsDir, file));
      
      // Run the up function
      migration.up(db);
      
      // Mark as applied
      markMigrationApplied(migrationName);
      results.applied.push(migrationName);
      
    } catch (error) {
      console.error(`Error applying migration ${migrationName}:`, error.message);
      results.errors.push(`${migrationName}: ${error.message}`);
      // Stop on first error
      break;
    }
  }
  
  return results;
}

/**
 * Rolls back the last applied migration.
 * 
 * @returns {{ rolledBack: string|null, error: string|null }} Result object
 */
function rollbackLastMigration() {
  const db = openDatabase();
  const appliedMigrations = getAppliedMigrations();
  
  if (appliedMigrations.length === 0) {
    console.log('No migrations to rollback.');
    return { rolledBack: null, error: null };
  }
  
  const lastMigration = appliedMigrations[appliedMigrations.length - 1];
  const migrationFile = `${lastMigration}.js`;
  
  try {
    console.log(`Rolling back migration: ${lastMigration}`);
    const migration = require(path.join(migrationsDir, migrationFile));
    
    // Run the down function
    migration.down(db);
    
    // Remove from applied list
    unmarkMigrationApplied(lastMigration);
    
    return { rolledBack: lastMigration, error: null };
    
  } catch (error) {
    console.error(`Error rolling back migration ${lastMigration}:`, error.message);
    return { rolledBack: null, error: `${lastMigration}: ${error.message}` };
  }
}

/**
 * Rolls back all applied migrations.
 * 
 * @returns {{ rolledBack: string[], errors: string[] }} Result object
 */
function rollbackAllMigrations() {
  const results = {
    rolledBack: [],
    errors: []
  };
  
  let appliedMigrations = getAppliedMigrations();
  
  while (appliedMigrations.length > 0) {
    const result = rollbackLastMigration();
    
    if (result.error) {
      results.errors.push(result.error);
      break;
    }
    
    if (result.rolledBack) {
      results.rolledBack.push(result.rolledBack);
    }
    
    appliedMigrations = getAppliedMigrations();
  }
  
  return results;
}

/**
 * Gets migration status.
 * 
 * @returns {{ applied: string[], pending: string[] }} Migration status
 */
function getMigrationStatus() {
  const appliedMigrations = getAppliedMigrations();
  const migrationFiles = getMigrationFiles();
  
  const pending = migrationFiles
    .map(file => file.replace('.js', ''))
    .filter(name => !appliedMigrations.includes(name));
  
  return {
    applied: appliedMigrations,
    pending
  };
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';
  
  try {
    switch (command) {
      case 'up':
        console.log('Running migrations...');
        const upResult = runMigrations();
        console.log(`Applied ${upResult.applied.length} migration(s).`);
        if (upResult.errors.length > 0) {
          console.error('Errors:', upResult.errors);
          process.exit(1);
        }
        break;
        
      case 'down':
      case '--rollback':
        console.log('Rolling back last migration...');
        const downResult = rollbackLastMigration();
        if (downResult.rolledBack) {
          console.log(`Rolled back: ${downResult.rolledBack}`);
        }
        if (downResult.error) {
          console.error('Error:', downResult.error);
          process.exit(1);
        }
        break;
        
      case 'reset':
        console.log('Rolling back all migrations...');
        const resetResult = rollbackAllMigrations();
        console.log(`Rolled back ${resetResult.rolledBack.length} migration(s).`);
        if (resetResult.errors.length > 0) {
          console.error('Errors:', resetResult.errors);
          process.exit(1);
        }
        break;
        
      case 'status':
        console.log('Migration status:');
        const status = getMigrationStatus();
        console.log('Applied:', status.applied.length > 0 ? status.applied.join(', ') : 'none');
        console.log('Pending:', status.pending.length > 0 ? status.pending.join(', ') : 'none');
        break;
        
      default:
        console.log('Usage: node migrate.js [up|down|reset|status]');
        process.exit(1);
    }
  } finally {
    closeDatabase();
  }
}

module.exports = {
  runMigrations,
  rollbackLastMigration,
  rollbackAllMigrations,
  getMigrationStatus,
  getAppliedMigrations
};
