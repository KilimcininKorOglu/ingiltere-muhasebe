/**
 * Migration: Add onboarding status to users table
 * 
 * This migration adds onboarding-related fields to track user progress
 * through the onboarding wizard, including business type selection,
 * VAT status, and completion status.
 * 
 * @module migrations/018_add_onboarding_status
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 18,
  name: '018_add_onboarding_status',
  description: 'Adds onboarding status fields to users table for tracking wizard progress',
  createdAt: '2026-01-12'
};

/**
 * Valid business types for UK businesses.
 * - sole_trader: Self-employed individual
 * - limited_company: Private limited company (Ltd)
 * - partnership: Business partnership
 */
const VALID_BUSINESS_TYPES = ['sole_trader', 'limited_company', 'partnership'];

/**
 * Valid onboarding statuses.
 * - not_started: User hasn't begun onboarding
 * - in_progress: User is currently going through onboarding
 * - completed: User has finished onboarding
 * - skipped: User chose to skip onboarding
 */
const VALID_ONBOARDING_STATUSES = ['not_started', 'in_progress', 'completed', 'skipped'];

/**
 * SQL statement to add onboarding fields to users table.
 * 
 * New Columns:
 * - businessType: Type of business (sole_trader, limited_company, partnership)
 * - onboardingStatus: Current status of onboarding process
 * - onboardingStep: Current step number in the wizard (0-7)
 * - onboardingData: JSON blob storing in-progress onboarding data
 * - onboardingCompletedAt: Timestamp when onboarding was completed
 * - showOnboardingReminder: Whether to show reminder to complete onboarding
 */
const addColumnsSql = `
  ALTER TABLE users ADD COLUMN businessType TEXT CHECK(businessType IS NULL OR businessType IN ('sole_trader', 'limited_company', 'partnership'));
`;

const addOnboardingStatusSql = `
  ALTER TABLE users ADD COLUMN onboardingStatus TEXT DEFAULT 'not_started' NOT NULL CHECK(onboardingStatus IN ('not_started', 'in_progress', 'completed', 'skipped'));
`;

const addOnboardingStepSql = `
  ALTER TABLE users ADD COLUMN onboardingStep INTEGER DEFAULT 0 NOT NULL CHECK(onboardingStep >= 0 AND onboardingStep <= 7);
`;

const addOnboardingDataSql = `
  ALTER TABLE users ADD COLUMN onboardingData TEXT DEFAULT '{}' NOT NULL;
`;

const addOnboardingCompletedAtSql = `
  ALTER TABLE users ADD COLUMN onboardingCompletedAt TEXT;
`;

const addShowOnboardingReminderSql = `
  ALTER TABLE users ADD COLUMN showOnboardingReminder INTEGER DEFAULT 1 NOT NULL;
`;

/**
 * SQL statement to create index on onboarding status for filtering.
 */
const createOnboardingStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_users_onboarding_status ON users(onboardingStatus);
`;

/**
 * SQL statement to create index on business type for filtering.
 */
const createBusinessTypeIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_users_business_type ON users(businessType);
`;

/**
 * SQL statements to drop the columns (SQLite doesn't support DROP COLUMN in older versions,
 * so we need to recreate the table - but for rollback we'll just drop indexes).
 * Note: In SQLite 3.35.0+ (2021), DROP COLUMN is supported.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_users_onboarding_status;
  DROP INDEX IF EXISTS idx_users_business_type;
`;

/**
 * Helper function to check if a column exists in a table.
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {string} tableName - Name of the table
 * @param {string} columnName - Name of the column to check
 * @returns {boolean} True if column exists
 */
function columnExists(db, tableName, columnName) {
  const result = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return result.some(col => col.name === columnName);
}

/**
 * Applies the migration (adds onboarding fields to users table).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If migration fails
 */
function up(db) {
  try {
    db.transaction(() => {
      // Add columns only if they don't exist
      if (!columnExists(db, 'users', 'businessType')) {
        db.exec(addColumnsSql);
      }
      if (!columnExists(db, 'users', 'onboardingStatus')) {
        db.exec(addOnboardingStatusSql);
      }
      if (!columnExists(db, 'users', 'onboardingStep')) {
        db.exec(addOnboardingStepSql);
      }
      if (!columnExists(db, 'users', 'onboardingData')) {
        db.exec(addOnboardingDataSql);
      }
      if (!columnExists(db, 'users', 'onboardingCompletedAt')) {
        db.exec(addOnboardingCompletedAtSql);
      }
      if (!columnExists(db, 'users', 'showOnboardingReminder')) {
        db.exec(addShowOnboardingReminderSql);
      }
      
      // Create indexes
      db.exec(createOnboardingStatusIndexSql);
      db.exec(createBusinessTypeIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration.
 * Note: SQLite doesn't support DROP COLUMN in versions before 3.35.0.
 * This rollback only drops indexes. For a full rollback, the table would need
 * to be recreated without these columns.
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If rollback fails
 */
function down(db) {
  try {
    db.transaction(() => {
      // Drop indexes
      db.exec(dropIndexesSql);
      
      // Note: In SQLite 3.35.0+, we can drop columns
      // For older versions, we'd need to recreate the table
      // Attempting to drop columns if supported
      try {
        if (columnExists(db, 'users', 'showOnboardingReminder')) {
          db.exec('ALTER TABLE users DROP COLUMN showOnboardingReminder;');
        }
        if (columnExists(db, 'users', 'onboardingCompletedAt')) {
          db.exec('ALTER TABLE users DROP COLUMN onboardingCompletedAt;');
        }
        if (columnExists(db, 'users', 'onboardingData')) {
          db.exec('ALTER TABLE users DROP COLUMN onboardingData;');
        }
        if (columnExists(db, 'users', 'onboardingStep')) {
          db.exec('ALTER TABLE users DROP COLUMN onboardingStep;');
        }
        if (columnExists(db, 'users', 'onboardingStatus')) {
          db.exec('ALTER TABLE users DROP COLUMN onboardingStatus;');
        }
        if (columnExists(db, 'users', 'businessType')) {
          db.exec('ALTER TABLE users DROP COLUMN businessType;');
        }
      } catch (dropError) {
        console.warn('Could not drop columns (SQLite version may not support DROP COLUMN):', dropError.message);
      }
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
    addColumnsSql,
    addOnboardingStatusSql,
    addOnboardingStepSql,
    addOnboardingDataSql,
    addOnboardingCompletedAtSql,
    addShowOnboardingReminderSql,
    createOnboardingStatusIndexSql,
    createBusinessTypeIndexSql,
    dropIndexesSql
  },
  // Export valid values for use by other modules
  VALID_BUSINESS_TYPES,
  VALID_ONBOARDING_STATUSES
};
