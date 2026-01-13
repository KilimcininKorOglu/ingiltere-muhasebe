/**
 * Migration: Create payroll_entries table
 * 
 * This migration creates the payroll_entries table with all required fields
 * for UK PAYE payroll tracking and pay run management.
 * 
 * @module migrations/017_create_payroll_entries_table
 */

/**
 * Migration metadata
 */
const migrationInfo = {
  id: 17,
  name: '017_create_payroll_entries_table',
  description: 'Creates the payroll_entries table with UK PAYE compliance fields',
  createdAt: '2026-01-12'
};

/**
 * Valid payroll entry status values.
 * - draft: Entry is being prepared
 * - approved: Entry has been approved for payment
 * - paid: Payment has been processed
 * - cancelled: Entry has been cancelled
 */
const VALID_STATUSES = ['draft', 'approved', 'paid', 'cancelled'];

/**
 * SQL statement to create the payroll_entries table.
 * 
 * Columns:
 * - id: Primary key (auto-increment)
 * - employeeId: Foreign key to employees table
 * - userId: Foreign key to users table (employer, for quick lookups)
 * - payPeriodStart: Start date of pay period
 * - payPeriodEnd: End date of pay period
 * - payDate: Date payment was/will be made
 * - status: Entry status (draft, approved, paid, cancelled)
 * - grossPay: Gross pay in pence
 * - taxableIncome: Taxable income in pence
 * - incomeTax: Income tax deducted (PAYE) in pence
 * - employeeNI: Employee National Insurance contribution in pence
 * - employerNI: Employer National Insurance contribution in pence
 * - studentLoanDeduction: Student loan deduction in pence
 * - pensionEmployeeContribution: Employee pension contribution in pence
 * - pensionEmployerContribution: Employer pension contribution in pence
 * - otherDeductions: Other deductions in pence
 * - otherDeductionsNotes: Notes for other deductions
 * - netPay: Net pay (take-home) in pence
 * - hoursWorked: Number of hours worked (for hourly employees)
 * - overtimeHours: Overtime hours worked
 * - overtimeRate: Overtime rate multiplier (e.g., 1.5 for time-and-a-half)
 * - bonus: Bonus amount in pence
 * - commission: Commission amount in pence
 * - taxCode: Tax code used for this pay run
 * - niCategory: National Insurance category letter
 * - cumulativeTaxableIncome: Cumulative taxable income for tax year
 * - cumulativeTaxPaid: Cumulative tax paid for tax year
 * - notes: Additional notes
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 */
const createTableSql = `
  CREATE TABLE IF NOT EXISTS payroll_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    payPeriodStart INTEGER NOT NULL,
    payPeriodEnd INTEGER NOT NULL,
    payDate INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL CHECK(status IN ('draft', 'approved', 'paid', 'cancelled')),
    grossPay INTEGER DEFAULT 0 NOT NULL,
    taxableIncome INTEGER DEFAULT 0 NOT NULL,
    incomeTax INTEGER DEFAULT 0 NOT NULL,
    employeeNI INTEGER DEFAULT 0 NOT NULL,
    employerNI INTEGER DEFAULT 0 NOT NULL,
    studentLoanDeduction INTEGER DEFAULT 0 NOT NULL,
    pensionEmployeeContribution INTEGER DEFAULT 0 NOT NULL,
    pensionEmployerContribution INTEGER DEFAULT 0 NOT NULL,
    otherDeductions INTEGER DEFAULT 0 NOT NULL,
    otherDeductionsNotes TEXT,
    netPay INTEGER DEFAULT 0 NOT NULL,
    hoursWorked REAL DEFAULT 0,
    overtimeHours REAL DEFAULT 0,
    overtimeRate REAL DEFAULT 1.5,
    bonus INTEGER DEFAULT 0 NOT NULL,
    commission INTEGER DEFAULT 0 NOT NULL,
    taxCode TEXT NOT NULL,
    niCategory TEXT DEFAULT 'A' NOT NULL,
    cumulativeTaxableIncome INTEGER DEFAULT 0 NOT NULL,
    cumulativeTaxPaid INTEGER DEFAULT 0 NOT NULL,
    notes TEXT,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`;

/**
 * SQL statement to create index on employeeId for faster lookups.
 */
const createEmployeeIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee_id ON payroll_entries(employeeId);
`;

/**
 * SQL statement to create index on userId for faster lookups.
 */
const createUserIdIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_payroll_entries_user_id ON payroll_entries(userId);
`;

/**
 * SQL statement to create index on status for filtering.
 */
const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_payroll_entries_status ON payroll_entries(status);
`;

/**
 * SQL statement to create index on payDate for date-based queries.
 */
const createPayDateIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_payroll_entries_pay_date ON payroll_entries(payDate);
`;

/**
 * SQL statement to create composite index on employeeId and payPeriodStart for unique pay period lookups.
 */
const createPayPeriodIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee_period ON payroll_entries(employeeId, payPeriodStart);
`;

/**
 * SQL statement to drop the payroll_entries table.
 */
const dropTableSql = `
  DROP TABLE IF EXISTS payroll_entries;
`;

/**
 * SQL statement to drop the indexes.
 */
const dropIndexesSql = `
  DROP INDEX IF EXISTS idx_payroll_entries_employee_id;
  DROP INDEX IF EXISTS idx_payroll_entries_user_id;
  DROP INDEX IF EXISTS idx_payroll_entries_status;
  DROP INDEX IF EXISTS idx_payroll_entries_pay_date;
  DROP INDEX IF EXISTS idx_payroll_entries_employee_period;
`;

/**
 * Applies the migration (creates the payroll_entries table and indexes).
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
      db.exec(createEmployeeIdIndexSql);
      db.exec(createUserIdIndexSql);
      db.exec(createStatusIndexSql);
      db.exec(createPayDateIndexSql);
      db.exec(createPayPeriodIndexSql);
    })();
    
    console.log(`Migration ${migrationInfo.name} applied successfully.`);
  } catch (error) {
    console.error(`Migration ${migrationInfo.name} failed:`, error.message);
    throw error;
  }
}

/**
 * Rolls back the migration (drops the payroll_entries table and indexes).
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
    createEmployeeIdIndexSql,
    createUserIdIndexSql,
    createStatusIndexSql,
    createPayDateIndexSql,
    createPayPeriodIndexSql,
    dropTableSql,
    dropIndexesSql
  },
  // Export valid statuses for use by other modules
  VALID_STATUSES
};
