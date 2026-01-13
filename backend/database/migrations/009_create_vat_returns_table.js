/**
 * Migration: Create vat_returns table
 * 
 * This migration creates the vat_returns table with all nine HMRC boxes
 * for VAT return records and status tracking.
 * 
 * HMRC VAT Return Boxes:
 * - Box 1: VAT due on sales and other outputs
 * - Box 2: VAT due on acquisitions from EU (legacy, now 0 post-Brexit)
 * - Box 3: Total VAT due (Box 1 + Box 2)
 * - Box 4: VAT reclaimed on purchases and other inputs
 * - Box 5: Net VAT to pay or reclaim (Box 3 - Box 4)
 * - Box 6: Total value of sales and outputs (excluding VAT)
 * - Box 7: Total value of purchases and inputs (excluding VAT)
 * - Box 8: Total value of supplies to EU (excluding VAT)
 * - Box 9: Total value of acquisitions from EU (excluding VAT)
 * 
 * @module migrations/009_create_vat_returns_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 9,
  name: '009_create_vat_returns_table',
  description: 'Creates the vat_returns table with all nine HMRC boxes and status tracking',
  createdAt: '2026-01-12'
};

/**
 * Valid VAT return status values.
 * - draft: Return is being prepared
 * - pending: Return is ready for submission
 * - submitted: Return has been submitted to HMRC
 * - accepted: Return has been accepted by HMRC
 * - rejected: Return was rejected by HMRC
 * - amended: Return has been amended after submission
 */
const VALID_STATUSES = ['draft', 'pending', 'submitted', 'accepted', 'rejected', 'amended'];

/**
 * SQL statement to create the vat_returns table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table
 * - periodStart: Start date of the VAT period (YYYY-MM-DD)
 * - periodEnd: End date of the VAT period (YYYY-MM-DD)
 * - status: VAT return status
 * - box1: VAT due on sales (in pence)
 * - box2: VAT due on EU acquisitions (in pence)
 * - box3: Total VAT due (in pence)
 * - box4: VAT reclaimed on purchases (in pence)
 * - box5: Net VAT to pay/reclaim (in pence, can be negative)
 * - box6: Total value of sales (in pence)
 * - box7: Total value of purchases (in pence)
 * - box8: Total value of EU supplies (in pence)
 * - box9: Total value of EU acquisitions (in pence)
 * - submittedAt: Timestamp when submitted to HMRC
 * - hmrcReceiptId: Receipt ID from HMRC after submission
 * - notes: Additional notes
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS vat_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    periodStart TEXT NOT NULL,
    periodEnd TEXT NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL CHECK(status IN ('draft', 'pending', 'submitted', 'accepted', 'rejected', 'amended')),
    box1 INTEGER DEFAULT 0 NOT NULL,
    box2 INTEGER DEFAULT 0 NOT NULL,
    box3 INTEGER DEFAULT 0 NOT NULL,
    box4 INTEGER DEFAULT 0 NOT NULL,
    box5 INTEGER DEFAULT 0 NOT NULL,
    box6 INTEGER DEFAULT 0 NOT NULL,
    box7 INTEGER DEFAULT 0 NOT NULL,
    box8 INTEGER DEFAULT 0 NOT NULL,
    box9 INTEGER DEFAULT 0 NOT NULL,
    submittedAt TEXT,
    hmrcReceiptId TEXT,
    notes TEXT,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_vat_returns_user_id ON vat_returns(userId);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_vat_returns_status ON vat_returns(status);
`;

/**
 * SQL statement to create index on periodStart for date-based queries.
 */
const createPeriodStartIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_vat_returns_period_start ON vat_returns(periodStart);
`;

/**
 * SQL statement to create index on periodEnd for date-based queries.
 */
const createPeriodEndIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_vat_returns_period_end ON vat_returns(periodEnd);
`;

/**
 * SQL statement to create unique index to prevent overlapping periods per user.
 * This ensures no two VAT returns for the same user have the same period dates.
 */
const createUniquePeriodIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vat_returns_unique_period 
  ON vat_returns(userId, periodStart, periodEnd);
`;

/**
 * SQL trigger to check for overlapping VAT return periods on INSERT.
 * This prevents a user from having overlapping VAT return periods.
 */
const createOverlapCheckTriggerInsertSql = `
  CREATE TRIGGER IF NOT EXISTS check_vat_return_overlap_insert
  BEFORE INSERT ON vat_returns
  FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'Overlapping VAT return period exists')
    WHERE EXISTS (
      SELECT 1 FROM vat_returns
      WHERE userId = NEW.userId
        AND id != NEW.id
        AND (
          (NEW.periodStart >= periodStart AND NEW.periodStart <= periodEnd)
          OR (NEW.periodEnd >= periodStart AND NEW.periodEnd <= periodEnd)
          OR (NEW.periodStart <= periodStart AND NEW.periodEnd >= periodEnd)
        )
    );
  END;
`;

/**
 * SQL trigger to check for overlapping VAT return periods on UPDATE.
 * This prevents a user from having overlapping VAT return periods.
 */
const createOverlapCheckTriggerUpdateSql = `
  CREATE TRIGGER IF NOT EXISTS check_vat_return_overlap_update
  BEFORE UPDATE OF periodStart, periodEnd ON vat_returns
  FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'Overlapping VAT return period exists')
    WHERE EXISTS (
      SELECT 1 FROM vat_returns
      WHERE userId = NEW.userId
        AND id != NEW.id
        AND (
          (NEW.periodStart >= periodStart AND NEW.periodStart <= periodEnd)
          OR (NEW.periodEnd >= periodStart AND NEW.periodEnd <= periodEnd)
          OR (NEW.periodStart <= periodStart AND NEW.periodEnd >= periodEnd)
        )
    );
  END;
`;

/**
 * SQL statement to drop the vat_returns table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS vat_returns;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_vat_returns_user_id;
  DROP INDEX IF EXISTS idx_vat_returns_status;
  DROP INDEX IF EXISTS idx_vat_returns_period_start;
  DROP INDEX IF EXISTS idx_vat_returns_period_end;
  DROP INDEX IF EXISTS idx_vat_returns_unique_period;
`;

/**
 * SQL statement to drop the triggers.
 */
const dropTriggersSql = `
  DROP TRIGGER IF EXISTS check_vat_return_overlap_insert;
  DROP TRIGGER IF EXISTS check_vat_return_overlap_update;
`;

/**
 * Applies the migration (creates the vat_returns table, indexes, and triggers).
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
      db.exec(createStatusIndexSql);
      db.exec(createPeriodStartIndexSql);
      db.exec(createPeriodEndIndexSql);
      db.exec(createUniquePeriodIndexSql);
      db.exec(createOverlapCheckTriggerInsertSql);
      db.exec(createOverlapCheckTriggerUpdateSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the vat_returns table, indexes, and triggers).
 * 
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {void}
 * @throws {Error} If rollback fails
 */
function down(db) {
  try {
    db.transaction(() => {
      // Drop triggers first
      db.exec(dropTriggersSql);
      // Drop indexes (they are dropped automatically with the table, but explicit is better)
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
    createStatusIndexSql,
    createPeriodStartIndexSql,
    createPeriodEndIndexSql,
    createUniquePeriodIndexSql,
    createOverlapCheckTriggerInsertSql,
    createOverlapCheckTriggerUpdateSql,
    dropTableSql,
    dropIndexesSql,
    dropTriggersSql
  },
  // Export valid statuses for use by other modules
  VALID_STATUSES
};
