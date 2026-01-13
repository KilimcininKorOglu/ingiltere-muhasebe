/**
 * Migration: Create employees table
 * 
 * This migration creates the employees table with all required fields
 * for UK PAYE payroll tracking and employee record management.
 * 
 * @module migrations/016_create_employees_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 16,
  name: '016_create_employees_table',
  description: 'Creates the employees table with UK PAYE compliance fields',
  createdAt: '2026-01-12'
};

/**
 * Valid employment status values.
 * - active: Currently employed
 * - inactive: No longer employed but records retained
 * - terminated: Employment has been terminated
 * - on_leave: Employee is on leave
 */
const VALID_STATUSES = ['active', 'inactive', 'terminated', 'on_leave'];

/**
 * SQL statement to create the employees table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - userId: Foreign key to users table (employer)
 * - employeeNumber: Unique employee identifier within the company
 * - firstName: Employee first name
 * - lastName: Employee last name
 * - email: Employee email address
 * - niNumber: National Insurance number (format: XX123456X)
 * - taxCode: HMRC tax code (e.g., 1257L, BR, D0)
 * - dateOfBirth: Employee date of birth
 * - startDate: Employment start date
 * - endDate: Employment end date (null if still employed)
 * - status: Employment status (active, inactive, terminated, on_leave)
 * - payFrequency: Payment frequency (weekly, biweekly, monthly)
 * - annualSalary: Annual salary in pence for precision
 * - hourlyRate: Hourly rate in pence (for hourly employees)
 * - address: Employee home address
 * - phoneNumber: Employee contact phone
 * - bankAccountNumber: Bank account number (for payroll)
 * - bankSortCode: Bank sort code
 * - studentLoanPlan: Student loan plan type (null, plan1, plan2, plan4, postgrad)
 * - pensionOptIn: Whether employee has opted into workplace pension
 * - pensionContribution: Pension contribution percentage (employee's)
 * - notes: Additional notes
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    employeeNumber TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT,
    niNumber TEXT,
    taxCode TEXT DEFAULT '1257L' NOT NULL,
    dateOfBirth TEXT,
    startDate TEXT NOT NULL,
    endDate TEXT,
    status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'inactive', 'terminated', 'on_leave')),
    payFrequency TEXT DEFAULT 'monthly' NOT NULL CHECK(payFrequency IN ('weekly', 'biweekly', 'monthly')),
    annualSalary INTEGER DEFAULT 0,
    hourlyRate INTEGER DEFAULT 0,
    address TEXT,
    phoneNumber TEXT,
    bankAccountNumber TEXT,
    bankSortCode TEXT,
    studentLoanPlan TEXT CHECK(studentLoanPlan IS NULL OR studentLoanPlan IN ('plan1', 'plan2', 'plan4', 'postgrad')),
    pensionOptIn INTEGER DEFAULT 0 NOT NULL,
    pensionContribution INTEGER DEFAULT 0,
    notes TEXT,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(userId, employeeNumber)
  );
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(userId);
`;

/**
 * SQL statement to create index on niNumber for lookups.
 */
const createNiNumberIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_employees_ni_number ON employees(niNumber);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
`;

/**
 * SQL statement to create composite index on userId and employeeNumber.
 */
const createEmployeeNumberIndexSql = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_employee_number ON employees(userId, employeeNumber);
`;

/**
 * SQL statement to drop the employees table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS employees;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_employees_user_id;
  DROP INDEX IF EXISTS idx_employees_ni_number;
  DROP INDEX IF EXISTS idx_employees_status;
  DROP INDEX IF EXISTS idx_employees_user_employee_number;
`;

/**
 * Applies the migration (creates the employees table and indexes).
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
      db.exec(createNiNumberIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createEmployeeNumberIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the employees table and indexes).
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
    createNiNumberIndexSql,
    createStatusIndexSql,
    createEmployeeNumberIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid statuses for use by other modules
  VALID_STATUSES
};
