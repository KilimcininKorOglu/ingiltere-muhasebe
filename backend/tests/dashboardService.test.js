/**
 * Dashboard Service Unit Tests
 * Tests for dashboard summary metrics and alert generation.
 * 
 * @module tests/dashboardService.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, execute, query } = require('../database/index');
const { runMigrations } = require('../database/migrate');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-dashboard-service-database.sqlite');

// Import service after database setup
let dashboardService;

// Test user ID
let testUserId = 1;

/**
 * Setup test database before all tests.
 */
beforeAll(() => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Set environment variable for test database
  process.env.DATABASE_PATH = TEST_DB_PATH;
  process.env.NODE_ENV = 'test';
  
  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Import service after database is initialized
  dashboardService = require('../services/dashboardService');
  
  // Create test user
  execute(`
    INSERT OR IGNORE INTO users (id, email, passwordHash, name, isVatRegistered, createdAt, updatedAt)
    VALUES (?, 'dashboard-test@example.com', 'hashedpassword', 'Dashboard Test User', 0, datetime('now'), datetime('now'))
  `, [testUserId]);
  
  // Create test categories
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (300, 'DS-SALES', 'Sales', 'Satışlar', 'income', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (301, 'DS-SERVICES', 'Services', 'Hizmetler', 'income', 0, 1, 2)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (302, 'DS-RENT', 'Rent', 'Kira', 'expense', 0, 1, 1)
  `);
  execute(`
    INSERT OR IGNORE INTO categories (id, code, name, nameTr, type, isSystem, isActive, displayOrder)
    VALUES (303, 'DS-UTILITIES', 'Utilities', 'Yardımcı Hizmetler', 'expense', 0, 1, 2)
  `);
});

/**
 * Clean up test database after all tests.
 */
afterAll(() => {
  try {
    closeDatabase();
    // Remove test database file
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Also remove WAL files if they exist
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch (error) {
    console.error('Error cleaning up test database:', error.message);
  }
});

/**
 * Clean up transactions before each test.
 */
beforeEach(() => {
  execute('DELETE FROM transactions WHERE userId = ?', [testUserId]);
  execute('DELETE FROM invoices WHERE userId = ?', [testUserId]);
  execute('DELETE FROM payroll_entries WHERE userId = ?', [testUserId]);
  execute('DELETE FROM employees WHERE userId = ?', [testUserId]);
  execute('DELETE FROM bank_accounts WHERE userId = ?', [testUserId]);
});

describe('Dashboard Service', () => {
  describe('Utility Functions', () => {
    test('getMonthName returns correct month names', () => {
      expect(dashboardService.getMonthName(1)).toBe('January');
      expect(dashboardService.getMonthName(6)).toBe('June');
      expect(dashboardService.getMonthName(12)).toBe('December');
      expect(dashboardService.getMonthName(0)).toBe('');
      expect(dashboardService.getMonthName(13)).toBe('');
    });

    test('formatDate formats date correctly', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(dashboardService.formatDate(date)).toBe('2025-01-15');
    });

    test('getToday returns today in YYYY-MM-DD format', () => {
      const today = dashboardService.getToday();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('getMonthStart returns first day of current month', () => {
      const monthStart = dashboardService.getMonthStart();
      expect(monthStart).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });

  describe('getCurrentMonthSummary', () => {
    test('should return zero values when no transactions exist', () => {
      const summary = dashboardService.getCurrentMonthSummary(testUserId);
      
      expect(summary.income.amount).toBe(0);
      expect(summary.income.transactionCount).toBe(0);
      expect(summary.expenses.amount).toBe(0);
      expect(summary.expenses.transactionCount).toBe(0);
      expect(summary.netCashFlow).toBe(0);
      expect(summary.period).toBeDefined();
    });

    test('should calculate income correctly', () => {
      const today = dashboardService.getToday();
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Sale 1', 100000, 20000, 120000)
      `, [testUserId, today]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Sale 2', 50000, 10000, 60000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getCurrentMonthSummary(testUserId);
      
      expect(summary.income.amount).toBe(150000);
      expect(summary.income.transactionCount).toBe(2);
    });

    test('should calculate expenses correctly', () => {
      const today = dashboardService.getToday();
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 302, 'expense', 'cleared', ?, 'Rent', 80000, 0, 80000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getCurrentMonthSummary(testUserId);
      
      expect(summary.expenses.amount).toBe(80000);
      expect(summary.expenses.transactionCount).toBe(1);
    });

    test('should calculate net cash flow correctly', () => {
      const today = dashboardService.getToday();
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Sale', 100000, 20000, 120000)
      `, [testUserId, today]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 302, 'expense', 'cleared', ?, 'Rent', 40000, 0, 40000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getCurrentMonthSummary(testUserId);
      
      expect(summary.netCashFlow).toBe(60000); // 100000 - 40000
    });

    test('should exclude void transactions', () => {
      const today = dashboardService.getToday();
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Valid Sale', 100000, 20000, 120000)
      `, [testUserId, today]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'void', ?, 'Void Sale', 50000, 10000, 60000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getCurrentMonthSummary(testUserId);
      
      expect(summary.income.amount).toBe(100000);
      expect(summary.income.transactionCount).toBe(1);
    });
  });

  describe('getInvoiceSummary', () => {
    test('should return zero values when no invoices exist', () => {
      const summary = dashboardService.getInvoiceSummary(testUserId);
      
      expect(summary.outstanding.amount).toBe(0);
      expect(summary.outstanding.count).toBe(0);
      expect(summary.overdue.amount).toBe(0);
      expect(summary.overdue.count).toBe(0);
    });

    test('should count outstanding invoices correctly', () => {
      // Create outstanding invoices (using the correct schema - no customerId)
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, customerEmail, totalAmount, createdAt, updatedAt)
        VALUES (?, 'INV-001', 'pending', '2025-01-01', '2025-02-01', 'Customer 1', 'cust1@test.com', 100000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, customerEmail, totalAmount, createdAt, updatedAt)
        VALUES (?, 'INV-002', 'draft', '2025-01-01', '2025-02-01', 'Customer 2', 'cust2@test.com', 50000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      const summary = dashboardService.getInvoiceSummary(testUserId);
      
      expect(summary.outstanding.count).toBe(2);
      expect(summary.outstanding.amount).toBe(150000);
    });

    test('should count draft invoices correctly', () => {
      execute(`
        INSERT INTO invoices (userId, invoiceNumber, status, issueDate, dueDate, customerName, customerEmail, totalAmount, createdAt, updatedAt)
        VALUES (?, 'INV-001', 'draft', '2025-01-01', '2025-02-01', 'Customer 1', 'cust1@test.com', 100000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      const summary = dashboardService.getInvoiceSummary(testUserId);
      
      expect(summary.drafts.count).toBe(1);
    });
  });

  describe('getVatThresholdSummary', () => {
    test('should return correct values for non-VAT registered user', () => {
      const summary = dashboardService.getVatThresholdSummary(testUserId, false);
      
      expect(summary.isVatRegistered).toBe(false);
      expect(summary.turnover.amount).toBe(0);
      expect(summary.threshold.amount).toBe(9000000); // £90,000
      expect(summary.threshold.percentage).toBe(0);
      expect(summary.warningLevel).toBe('none');
    });

    test('should calculate turnover percentage correctly', () => {
      // Add income transactions for the last 12 months
      const today = dashboardService.getToday();
      
      // Add £45,000 turnover (50% of threshold)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Large Sale', 4500000, 900000, 5400000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getVatThresholdSummary(testUserId, false);
      
      expect(summary.turnover.amount).toBe(4500000);
      expect(summary.threshold.percentage).toBe(50);
      expect(summary.warningLevel).toBe('none');
    });

    test('should set approaching warning level at 75%', () => {
      const today = dashboardService.getToday();
      
      // Add £68,000 turnover (75.5% of threshold)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Large Sale', 6800000, 1360000, 8160000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getVatThresholdSummary(testUserId, false);
      
      expect(summary.warningLevel).toBe('approaching');
    });

    test('should set imminent warning level at 90%', () => {
      const today = dashboardService.getToday();
      
      // Add £82,000 turnover (91% of threshold)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Large Sale', 8200000, 1640000, 9840000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getVatThresholdSummary(testUserId, false);
      
      expect(summary.warningLevel).toBe('imminent');
    });

    test('should set exceeded warning level at 100%', () => {
      const today = dashboardService.getToday();
      
      // Add £95,000 turnover (105% of threshold)
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', ?, 'Large Sale', 9500000, 1900000, 11400000)
      `, [testUserId, today]);
      
      const summary = dashboardService.getVatThresholdSummary(testUserId, false);
      
      expect(summary.warningLevel).toBe('exceeded');
    });
  });

  describe('getAccountBalanceSummary', () => {
    test('should return zero values when no bank accounts exist', () => {
      const summary = dashboardService.getAccountBalanceSummary(testUserId);
      
      expect(summary.totalBalance).toBe(0);
      expect(summary.activeAccounts).toBe(0);
    });

    test('should calculate total balance across active accounts', () => {
      execute(`
        INSERT INTO bank_accounts (userId, accountName, bankName, accountType, accountNumber, sortCode, isActive, currentBalance, createdAt, updatedAt)
        VALUES (?, 'Account 1', 'Barclays', 'current', '12345678', '123456', 1, 500000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      execute(`
        INSERT INTO bank_accounts (userId, accountName, bankName, accountType, accountNumber, sortCode, isActive, currentBalance, createdAt, updatedAt)
        VALUES (?, 'Account 2', 'HSBC', 'current', '87654321', '654321', 1, 300000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      const summary = dashboardService.getAccountBalanceSummary(testUserId);
      
      expect(summary.totalBalance).toBe(800000);
      expect(summary.activeAccounts).toBe(2);
    });

    test('should exclude inactive accounts', () => {
      execute(`
        INSERT INTO bank_accounts (userId, accountName, bankName, accountType, accountNumber, sortCode, isActive, currentBalance, createdAt, updatedAt)
        VALUES (?, 'Active Account', 'Barclays', 'current', '12345678', '123456', 1, 500000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      execute(`
        INSERT INTO bank_accounts (userId, accountName, bankName, accountType, accountNumber, sortCode, isActive, currentBalance, createdAt, updatedAt)
        VALUES (?, 'Inactive Account', 'HSBC', 'current', '87654321', '654321', 0, 300000, datetime('now'), datetime('now'))
      `, [testUserId]);
      
      const summary = dashboardService.getAccountBalanceSummary(testUserId);
      
      expect(summary.totalBalance).toBe(500000);
      expect(summary.activeAccounts).toBe(1);
    });
  });

  describe('getRecentTransactions', () => {
    test('should return empty array when no transactions exist', () => {
      const transactions = dashboardService.getRecentTransactions(testUserId);
      
      expect(transactions).toHaveLength(0);
    });

    test('should return transactions ordered by date descending', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', '2025-01-01', 'Older Sale', 50000, 10000, 60000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', '2025-01-15', 'Newer Sale', 100000, 20000, 120000)
      `, [testUserId]);
      
      const transactions = dashboardService.getRecentTransactions(testUserId, 10);
      
      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Newer Sale');
      expect(transactions[1].description).toBe('Older Sale');
    });

    test('should respect limit parameter', () => {
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', '2025-01-01', 'Sale 1', 50000, 10000, 60000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', '2025-01-02', 'Sale 2', 60000, 12000, 72000)
      `, [testUserId]);
      
      execute(`
        INSERT INTO transactions (userId, categoryId, type, status, transactionDate, description, amount, vatAmount, totalAmount)
        VALUES (?, 300, 'income', 'cleared', '2025-01-03', 'Sale 3', 70000, 14000, 84000)
      `, [testUserId]);
      
      const transactions = dashboardService.getRecentTransactions(testUserId, 2);
      
      expect(transactions).toHaveLength(2);
    });
  });

  describe('generateAlerts', () => {
    test('should generate overdue invoice alert when count exceeds threshold', () => {
      const metrics = {
        invoices: {
          overdue: { count: 4, amount: 200000 }
        }
      };
      
      const alerts = dashboardService.generateAlerts(metrics);
      
      const overdueAlert = alerts.find(a => a.category === 'invoices' && a.type === 'urgent');
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert.priority).toBe('high');
    });

    test('should generate warning for single overdue invoice', () => {
      const metrics = {
        invoices: {
          overdue: { count: 1, amount: 50000 }
        }
      };
      
      const alerts = dashboardService.generateAlerts(metrics);
      
      const overdueAlert = alerts.find(a => a.category === 'invoices' && a.type === 'warning');
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert.priority).toBe('medium');
    });

    test('should generate negative cash flow alert', () => {
      const metrics = {
        cashFlow: {
          netCashFlow: -20000 // Below threshold
        }
      };
      
      const alerts = dashboardService.generateAlerts(metrics);
      
      const cashFlowAlert = alerts.find(a => a.category === 'cash_flow');
      expect(cashFlowAlert).toBeDefined();
      expect(cashFlowAlert.type).toBe('warning');
    });

    test('should generate VAT threshold exceeded alert', () => {
      const metrics = {
        vatThreshold: {
          requiresAttention: true,
          warningLevel: 'exceeded'
        }
      };
      
      const alerts = dashboardService.generateAlerts(metrics);
      
      const vatAlert = alerts.find(a => a.category === 'vat' && a.type === 'urgent');
      expect(vatAlert).toBeDefined();
      expect(vatAlert.priority).toBe('high');
    });

    test('should generate draft invoices info alert', () => {
      const metrics = {
        invoices: {
          drafts: { count: 3 },
          overdue: { count: 0 }
        }
      };
      
      const alerts = dashboardService.generateAlerts(metrics);
      
      const draftAlert = alerts.find(a => a.category === 'invoices' && a.type === 'info');
      expect(draftAlert).toBeDefined();
      expect(draftAlert.priority).toBe('low');
    });

    test('should sort alerts by priority', () => {
      const metrics = {
        cashFlow: { netCashFlow: -20000 },
        invoices: {
          overdue: { count: 5, amount: 200000 },
          drafts: { count: 2 }
        },
        vatThreshold: {
          requiresAttention: true,
          warningLevel: 'exceeded'
        }
      };
      
      const alerts = dashboardService.generateAlerts(metrics);
      
      // High priority alerts should come first
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].priority).toBe('high');
    });
  });

  describe('generateDashboardSummary', () => {
    test('should return complete summary structure', () => {
      const summary = dashboardService.generateDashboardSummary(testUserId, {
        isVatRegistered: false
      });
      
      expect(summary.overview).toBeDefined();
      expect(summary.overview.currentMonth).toBeDefined();
      expect(summary.overview.accountBalance).toBeDefined();
      expect(summary.invoices).toBeDefined();
      expect(summary.payroll).toBeDefined();
      expect(summary.vatStatus).toBeDefined();
      expect(summary.alerts).toBeDefined();
      expect(summary.generatedAt).toBeDefined();
    });

    test('should include recent activity when requested', () => {
      const summary = dashboardService.generateDashboardSummary(testUserId, {
        isVatRegistered: false,
        includeRecentActivity: true
      });
      
      expect(summary.recentActivity).toBeDefined();
      expect(summary.recentActivity.transactions).toBeDefined();
      expect(summary.recentActivity.invoices).toBeDefined();
      expect(summary.recentActivity.payroll).toBeDefined();
    });

    test('should exclude recent activity when not requested', () => {
      const summary = dashboardService.generateDashboardSummary(testUserId, {
        isVatRegistered: false,
        includeRecentActivity: false
      });
      
      expect(summary.recentActivity).toBeUndefined();
    });
  });

  describe('getQuickSummary', () => {
    test('should return compact summary structure', () => {
      const summary = dashboardService.getQuickSummary(testUserId, false);
      
      expect(summary.monthlyIncome).toBeDefined();
      expect(summary.monthlyExpenses).toBeDefined();
      expect(summary.netCashFlow).toBeDefined();
      expect(summary.totalBalance).toBeDefined();
      expect(summary.outstandingInvoices).toBeDefined();
      expect(summary.overdueInvoices).toBeDefined();
      expect(summary.vatThresholdPercentage).toBeDefined();
      expect(summary.vatWarningLevel).toBeDefined();
      expect(summary.alertCount).toBeDefined();
      expect(summary.hasUrgentAlerts).toBeDefined();
      expect(summary.generatedAt).toBeDefined();
    });
  });
});
