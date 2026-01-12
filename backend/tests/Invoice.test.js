/**
 * Unit tests for Invoice and InvoiceItem models.
 * Tests validation, CRUD operations, and business logic.
 * 
 * @module tests/Invoice.test
 */

const path = require('path');
const fs = require('fs');
const { openDatabase, closeDatabase, executeMany } = require('../database/index');
const { runMigrations, rollbackAllMigrations } = require('../database/migrate');
const Invoice = require('../database/models/Invoice');
const InvoiceItem = require('../database/models/InvoiceItem');

// Use test database
const TEST_DB_PATH = path.join(__dirname, '../data/test-invoice-database.sqlite');

// Test user data (created in users table for foreign key)
let testUserId;

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
  
  // Open database and run migrations
  openDatabase({ path: TEST_DB_PATH });
  runMigrations();
  
  // Create a test user for foreign key relationships
  const result = executeMany(`
    INSERT INTO users (email, passwordHash, name, businessName)
    VALUES ('testinvoice@example.com', 'hashedpassword', 'Test User', 'Test Business');
  `);
  
  // Get the test user ID
  const db = openDatabase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('testinvoice@example.com');
  testUserId = user.id;
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
 * Clean up invoices and invoice_items tables before each test.
 */
beforeEach(() => {
  executeMany('DELETE FROM invoice_items; DELETE FROM invoices;');
});

describe('Invoice Model', () => {
  describe('validateInvoiceData', () => {
    describe('required fields', () => {
      test('should fail validation for missing userId', () => {
        const result = Invoice.validateInvoiceData({
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.userId).toBeDefined();
      });

      test('should fail validation for missing invoiceNumber', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.invoiceNumber).toBeDefined();
      });

      test('should fail validation for missing issueDate', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          dueDate: '2026-01-31',
          customerName: 'Test Customer'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.issueDate).toBeDefined();
      });

      test('should fail validation for missing customerName', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.customerName).toBeDefined();
      });
    });

    describe('date validation', () => {
      test('should fail validation for invalid issueDate format', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '01-01-2026',
          dueDate: '2026-01-31',
          customerName: 'Test Customer'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.issueDate).toContain('Invalid issueDate format');
      });

      test('should fail validation when dueDate is before issueDate', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-31',
          dueDate: '2026-01-01',
          customerName: 'Test Customer'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.dueDate).toContain('dueDate must be on or after issueDate');
      });
    });

    describe('status validation', () => {
      test('should fail validation for invalid status', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer',
          status: 'invalid-status'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.status).toContain('Invalid status');
      });

      test('should pass validation for valid status values', () => {
        const statuses = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'];
        for (const status of statuses) {
          const result = Invoice.validateInvoiceData({
            userId: 1,
            invoiceNumber: 'INV-2026-0001',
            issueDate: '2026-01-01',
            dueDate: '2026-01-31',
            customerName: 'Test Customer',
            status
          });
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('email validation', () => {
      test('should fail validation for invalid customerEmail', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer',
          customerEmail: 'invalid-email'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.customerEmail).toContain('Invalid customerEmail format');
      });

      test('should pass validation for valid customerEmail', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer',
          customerEmail: 'customer@example.com'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('amount validation', () => {
      test('should fail validation for negative subtotal', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer',
          subtotal: -100
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.subtotal).toContain('non-negative integer');
      });

      test('should fail validation for non-integer totalAmount', () => {
        const result = Invoice.validateInvoiceData({
          userId: 1,
          invoiceNumber: 'INV-2026-0001',
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Test Customer',
          totalAmount: 100.50
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.totalAmount).toBeDefined();
      });
    });

    describe('update validation', () => {
      test('should allow partial updates without required fields', () => {
        const result = Invoice.validateInvoiceData({ customerName: 'Updated Customer' }, true);
        expect(result.isValid).toBe(true);
      });

      test('should still validate provided fields on update', () => {
        const result = Invoice.validateInvoiceData({ status: 'invalid' }, true);
        expect(result.isValid).toBe(false);
        expect(result.errors.status).toBeDefined();
      });
    });
  });

  describe('CRUD operations', () => {
    const validInvoiceData = {
      invoiceNumber: 'INV-2026-0001',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      customerName: 'Test Customer Ltd',
      customerAddress: '123 Test Street, London',
      customerEmail: 'customer@example.com',
      customerVatNumber: 'GB123456789',
      subtotal: 10000,
      vatAmount: 2000,
      totalAmount: 12000,
      currency: 'GBP',
      notes: 'Payment due within 30 days'
    };

    describe('createInvoice', () => {
      test('should create an invoice successfully', () => {
        const result = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.invoiceNumber).toBe('INV-2026-0001');
        expect(result.data.status).toBe('draft');
        expect(result.data.customerName).toBe('Test Customer Ltd');
      });

      test('should fail to create invoice with invalid data', () => {
        const result = Invoice.createInvoice({
          userId: testUserId,
          invoiceNumber: '',
          issueDate: 'invalid',
          dueDate: '2026-01-31',
          customerName: ''
        });
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      test('should enforce unique invoiceNumber constraint', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const result = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        
        expect(result.success).toBe(false);
        expect(result.errors.invoiceNumber).toBe('Invoice number already exists');
      });

      test('should normalize invoiceNumber to uppercase', () => {
        const result = Invoice.createInvoice({
          ...validInvoiceData,
          userId: testUserId,
          invoiceNumber: 'inv-2026-0002'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.invoiceNumber).toBe('INV-2026-0002');
      });

      test('should normalize customerEmail to lowercase', () => {
        const result = Invoice.createInvoice({
          ...validInvoiceData,
          userId: testUserId,
          invoiceNumber: 'INV-2026-0003',
          customerEmail: 'CUSTOMER@EXAMPLE.COM'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.customerEmail).toBe('customer@example.com');
      });

      test('should generate invoice number if not provided', () => {
        const result = Invoice.createInvoice({
          userId: testUserId,
          issueDate: '2026-01-01',
          dueDate: '2026-01-31',
          customerName: 'Auto Number Test'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      });
    });

    describe('findById', () => {
      test('should find invoice by ID', () => {
        const createResult = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const invoice = Invoice.findById(createResult.data.id);
        
        expect(invoice).toBeDefined();
        expect(invoice.invoiceNumber).toBe('INV-2026-0001');
      });

      test('should return null for non-existent ID', () => {
        const invoice = Invoice.findById(99999);
        expect(invoice).toBeNull();
      });
    });

    describe('findByInvoiceNumber', () => {
      test('should find invoice by invoice number', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const invoice = Invoice.findByInvoiceNumber('INV-2026-0001');
        
        expect(invoice).toBeDefined();
        expect(invoice.customerName).toBe('Test Customer Ltd');
      });

      test('should find invoice case-insensitively', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const invoice = Invoice.findByInvoiceNumber('inv-2026-0001');
        
        expect(invoice).toBeDefined();
      });

      test('should return null for non-existent invoice number', () => {
        const invoice = Invoice.findByInvoiceNumber('INV-9999-9999');
        expect(invoice).toBeNull();
      });
    });

    describe('getInvoicesByUserId', () => {
      test('should return paginated invoices for user', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0001' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0002' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0003' });
        
        const result = Invoice.getInvoicesByUserId(testUserId, { page: 1, limit: 2 });
        
        expect(result.invoices.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(2);
      });

      test('should filter by status', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0001', status: 'draft' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0002', status: 'paid' });
        
        const result = Invoice.getInvoicesByUserId(testUserId, { status: 'paid' });
        
        expect(result.invoices.length).toBe(1);
        expect(result.invoices[0].status).toBe('paid');
      });

      test('should filter by date range', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0001', issueDate: '2026-01-01' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0002', issueDate: '2026-01-15' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0003', issueDate: '2026-02-01' });
        
        const result = Invoice.getInvoicesByUserId(testUserId, { dateFrom: '2026-01-10', dateTo: '2026-01-20' });
        
        expect(result.invoices.length).toBe(1);
        expect(result.invoices[0].issueDate).toBe('2026-01-15');
      });

      test('should search by invoice number or customer name', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0001', customerName: 'ABC Company' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0002', customerName: 'XYZ Corp' });
        
        const result = Invoice.getInvoicesByUserId(testUserId, { search: 'ABC' });
        
        expect(result.invoices.length).toBe(1);
        expect(result.invoices[0].customerName).toBe('ABC Company');
      });

      test('should include isOverdue flag for each invoice', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0001' });
        
        const result = Invoice.getInvoicesByUserId(testUserId);
        
        expect(result.invoices.length).toBe(1);
        expect(result.invoices[0]).toHaveProperty('isOverdue');
        expect(typeof result.invoices[0].isOverdue).toBe('boolean');
      });
    });

    describe('updateInvoice', () => {
      test('should update invoice successfully', () => {
        const createResult = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const result = Invoice.updateInvoice(createResult.data.id, {
          customerName: 'Updated Customer',
          notes: 'Updated notes'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.customerName).toBe('Updated Customer');
        expect(result.data.notes).toBe('Updated notes');
      });

      test('should fail to update non-existent invoice', () => {
        const result = Invoice.updateInvoice(99999, { customerName: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('Invoice not found');
      });

      test('should prevent changing to existing invoice number', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0001' });
        const createResult2 = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-2026-0002' });
        
        const result = Invoice.updateInvoice(createResult2.data.id, {
          invoiceNumber: 'INV-2026-0001'
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.invoiceNumber).toBe('Invoice number already exists');
      });
    });

    describe('deleteInvoice', () => {
      test('should delete invoice successfully', () => {
        const createResult = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const result = Invoice.deleteInvoice(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const invoice = Invoice.findById(createResult.data.id);
        expect(invoice).toBeNull();
      });

      test('should fail to delete non-existent invoice', () => {
        const result = Invoice.deleteInvoice(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invoice not found');
      });
    });
  });

  describe('Status operations', () => {
    const validInvoiceData = {
      invoiceNumber: 'INV-2026-0001',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      customerName: 'Test Customer'
    };

    describe('updateStatus', () => {
      test('should update status successfully', () => {
        const createResult = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const result = Invoice.updateStatus(createResult.data.id, 'pending');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('pending');
      });

      test('should set paidAt when marking as paid', () => {
        const createResult = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const result = Invoice.updateStatus(createResult.data.id, 'paid');
        
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('paid');
        expect(result.data.paidAt).toBeDefined();
      });

      test('should reject invalid status', () => {
        const createResult = Invoice.createInvoice({ ...validInvoiceData, userId: testUserId });
        const result = Invoice.updateStatus(createResult.data.id, 'invalid');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid status');
      });
    });

    describe('getStatusCounts', () => {
      test('should return status counts for user', () => {
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-001', status: 'draft' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-002', status: 'draft' });
        Invoice.createInvoice({ ...validInvoiceData, userId: testUserId, invoiceNumber: 'INV-003', status: 'paid' });
        
        const counts = Invoice.getStatusCounts(testUserId);
        
        expect(counts.draft).toBe(2);
        expect(counts.paid).toBe(1);
        expect(counts.pending).toBe(0);
      });
    });

    describe('isInvoiceOverdue', () => {
      test('should return true for pending invoice with past due date', () => {
        const invoice = {
          status: 'pending',
          dueDate: '2025-01-01'
        };
        
        expect(Invoice.isInvoiceOverdue(invoice, '2026-01-12')).toBe(true);
      });

      test('should return false for pending invoice with future due date', () => {
        const invoice = {
          status: 'pending',
          dueDate: '2026-12-31'
        };
        
        expect(Invoice.isInvoiceOverdue(invoice, '2026-01-12')).toBe(false);
      });

      test('should return false for draft invoice even with past due date', () => {
        const invoice = {
          status: 'draft',
          dueDate: '2025-01-01'
        };
        
        expect(Invoice.isInvoiceOverdue(invoice, '2026-01-12')).toBe(false);
      });

      test('should return false for paid invoice even with past due date', () => {
        const invoice = {
          status: 'paid',
          dueDate: '2025-01-01'
        };
        
        expect(Invoice.isInvoiceOverdue(invoice, '2026-01-12')).toBe(false);
      });

      test('should return true for overdue status invoice with past due date', () => {
        const invoice = {
          status: 'overdue',
          dueDate: '2025-01-01'
        };
        
        expect(Invoice.isInvoiceOverdue(invoice, '2026-01-12')).toBe(true);
      });
    });
  });

  describe('generateInvoiceNumber', () => {
    test('should generate sequential invoice numbers', () => {
      const num1 = Invoice.generateInvoiceNumber(testUserId);
      Invoice.createInvoice({
        userId: testUserId,
        invoiceNumber: num1,
        issueDate: '2026-01-01',
        dueDate: '2026-01-31',
        customerName: 'Test'
      });
      
      const num2 = Invoice.generateInvoiceNumber(testUserId);
      
      expect(num1).toMatch(/^INV-2026-0001$/);
      expect(num2).toMatch(/^INV-2026-0002$/);
    });
  });
});

describe('InvoiceItem Model', () => {
  let testInvoiceId;

  beforeEach(() => {
    executeMany('DELETE FROM invoice_items; DELETE FROM invoices;');
    
    // Create a test invoice for each test
    const invoiceResult = Invoice.createInvoice({
      userId: testUserId,
      invoiceNumber: 'INV-TEST-0001',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      customerName: 'Test Customer'
    });
    testInvoiceId = invoiceResult.data.id;
  });

  describe('validateInvoiceItemData', () => {
    describe('required fields', () => {
      test('should fail validation for missing invoiceId', () => {
        const result = InvoiceItem.validateInvoiceItemData({
          description: 'Test item',
          unitPrice: 1000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.invoiceId).toBeDefined();
      });

      test('should fail validation for missing description', () => {
        const result = InvoiceItem.validateInvoiceItemData({
          invoiceId: 1,
          unitPrice: 1000
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.description).toBeDefined();
      });

      test('should fail validation for missing unitPrice', () => {
        const result = InvoiceItem.validateInvoiceItemData({
          invoiceId: 1,
          description: 'Test item'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.unitPrice).toBeDefined();
      });
    });

    describe('quantity validation', () => {
      test('should fail validation for non-positive quantity', () => {
        const result = InvoiceItem.validateInvoiceItemData({
          invoiceId: 1,
          description: 'Test item',
          unitPrice: 1000,
          quantity: '0'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.quantity).toContain('positive number');
      });

      test('should pass validation for decimal quantity', () => {
        const result = InvoiceItem.validateInvoiceItemData({
          invoiceId: 1,
          description: 'Test item',
          unitPrice: 1000,
          quantity: '1.5'
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('vatRateId validation', () => {
      test('should fail validation for invalid vatRateId', () => {
        const result = InvoiceItem.validateInvoiceItemData({
          invoiceId: 1,
          description: 'Test item',
          unitPrice: 1000,
          vatRateId: 'invalid'
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.vatRateId).toContain('Invalid vatRateId');
      });

      test('should pass validation for valid vatRateId values', () => {
        const vatRateIds = ['standard', 'reduced', 'zero', 'exempt', 'outside-scope'];
        for (const vatRateId of vatRateIds) {
          const result = InvoiceItem.validateInvoiceItemData({
            invoiceId: 1,
            description: 'Test item',
            unitPrice: 1000,
            vatRateId
          });
          expect(result.isValid).toBe(true);
        }
      });
    });
  });

  describe('calculateLineAmounts', () => {
    test('should calculate standard rate (20%) correctly', () => {
      const result = InvoiceItem.calculateLineAmounts(10000, '1', 'standard');
      
      expect(result.vatRatePercent).toBe(20);
      expect(result.vatAmount).toBe(2000);
      expect(result.lineTotal).toBe(12000);
    });

    test('should calculate reduced rate (5%) correctly', () => {
      const result = InvoiceItem.calculateLineAmounts(10000, '1', 'reduced');
      
      expect(result.vatRatePercent).toBe(5);
      expect(result.vatAmount).toBe(500);
      expect(result.lineTotal).toBe(10500);
    });

    test('should calculate zero rate correctly', () => {
      const result = InvoiceItem.calculateLineAmounts(10000, '1', 'zero');
      
      expect(result.vatRatePercent).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.lineTotal).toBe(10000);
    });

    test('should handle decimal quantities', () => {
      const result = InvoiceItem.calculateLineAmounts(10000, '1.5', 'standard');
      
      expect(result.vatAmount).toBe(3000);
      expect(result.lineTotal).toBe(18000);
    });
  });

  describe('CRUD operations', () => {
    const validItemData = {
      description: 'Web Development Services',
      quantity: '10',
      unitPrice: 5000,
      vatRateId: 'standard'
    };

    describe('createInvoiceItem', () => {
      test('should create an invoice item successfully', () => {
        const result = InvoiceItem.createInvoiceItem({
          ...validItemData,
          invoiceId: testInvoiceId
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBeDefined();
        expect(result.data.description).toBe('Web Development Services');
        expect(result.data.vatRatePercent).toBe(20);
      });

      test('should auto-calculate VAT and line total', () => {
        const result = InvoiceItem.createInvoiceItem({
          invoiceId: testInvoiceId,
          description: 'Test Item',
          quantity: '2',
          unitPrice: 10000,
          vatRateId: 'standard'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.vatAmount).toBe(4000); // 20000 * 0.2
        expect(result.data.lineTotal).toBe(24000); // 20000 + 4000
      });

      test('should fail for non-existent invoice', () => {
        const result = InvoiceItem.createInvoiceItem({
          ...validItemData,
          invoiceId: 99999
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.invoiceId).toBe('Invoice not found');
      });

      test('should auto-assign sortOrder', () => {
        const result1 = InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        const result2 = InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        
        expect(result1.data.sortOrder).toBe(0);
        expect(result2.data.sortOrder).toBe(1);
      });
    });

    describe('findById', () => {
      test('should find item by ID', () => {
        const createResult = InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        const item = InvoiceItem.findById(createResult.data.id);
        
        expect(item).toBeDefined();
        expect(item.description).toBe('Web Development Services');
      });

      test('should return null for non-existent ID', () => {
        const item = InvoiceItem.findById(99999);
        expect(item).toBeNull();
      });
    });

    describe('getByInvoiceId', () => {
      test('should return all items for invoice in order', () => {
        InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId, description: 'Item 1' });
        InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId, description: 'Item 2' });
        InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId, description: 'Item 3' });
        
        const items = InvoiceItem.getByInvoiceId(testInvoiceId);
        
        expect(items.length).toBe(3);
        expect(items[0].description).toBe('Item 1');
        expect(items[1].description).toBe('Item 2');
        expect(items[2].description).toBe('Item 3');
      });
    });

    describe('updateInvoiceItem', () => {
      test('should update item successfully', () => {
        const createResult = InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        const result = InvoiceItem.updateInvoiceItem(createResult.data.id, {
          description: 'Updated Description',
          quantity: '5'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.description).toBe('Updated Description');
        expect(result.data.quantity).toBe('5');
      });

      test('should recalculate amounts when price fields change', () => {
        const createResult = InvoiceItem.createInvoiceItem({
          invoiceId: testInvoiceId,
          description: 'Test',
          quantity: '1',
          unitPrice: 10000,
          vatRateId: 'standard'
        });
        
        const result = InvoiceItem.updateInvoiceItem(createResult.data.id, {
          quantity: '2'
        });
        
        expect(result.success).toBe(true);
        expect(result.data.vatAmount).toBe(4000);
        expect(result.data.lineTotal).toBe(24000);
      });

      test('should fail to update non-existent item', () => {
        const result = InvoiceItem.updateInvoiceItem(99999, { description: 'Test' });
        
        expect(result.success).toBe(false);
        expect(result.errors.general).toBe('Invoice item not found');
      });
    });

    describe('deleteInvoiceItem', () => {
      test('should delete item successfully', () => {
        const createResult = InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        const result = InvoiceItem.deleteInvoiceItem(createResult.data.id);
        
        expect(result.success).toBe(true);
        
        const item = InvoiceItem.findById(createResult.data.id);
        expect(item).toBeNull();
      });

      test('should fail to delete non-existent item', () => {
        const result = InvoiceItem.deleteInvoiceItem(99999);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invoice item not found');
      });
    });

    describe('deleteByInvoiceId', () => {
      test('should delete all items for invoice', () => {
        InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        InvoiceItem.createInvoiceItem({ ...validItemData, invoiceId: testInvoiceId });
        
        const result = InvoiceItem.deleteByInvoiceId(testInvoiceId);
        
        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(3);
        
        const items = InvoiceItem.getByInvoiceId(testInvoiceId);
        expect(items.length).toBe(0);
      });
    });
  });

  describe('Utility operations', () => {
    describe('getVatSummary', () => {
      test('should return VAT summary grouped by rate', () => {
        InvoiceItem.createInvoiceItem({
          invoiceId: testInvoiceId,
          description: 'Standard rate item',
          quantity: '1',
          unitPrice: 10000,
          vatRateId: 'standard'
        });
        InvoiceItem.createInvoiceItem({
          invoiceId: testInvoiceId,
          description: 'Zero rate item',
          quantity: '1',
          unitPrice: 5000,
          vatRateId: 'zero'
        });
        
        const summary = InvoiceItem.getVatSummary(testInvoiceId);
        
        expect(summary.length).toBe(2);
        const standardEntry = summary.find(s => s.vatRateId === 'standard');
        expect(standardEntry.vatAmount).toBe(2000);
      });
    });

    describe('countByInvoiceId', () => {
      test('should return correct count', () => {
        InvoiceItem.createInvoiceItem({ invoiceId: testInvoiceId, description: 'Item 1', unitPrice: 1000 });
        InvoiceItem.createInvoiceItem({ invoiceId: testInvoiceId, description: 'Item 2', unitPrice: 2000 });
        
        const count = InvoiceItem.countByInvoiceId(testInvoiceId);
        
        expect(count).toBe(2);
      });
    });

    describe('reorderItems', () => {
      test('should reorder items correctly', () => {
        const item1 = InvoiceItem.createInvoiceItem({ invoiceId: testInvoiceId, description: 'Item 1', unitPrice: 1000 });
        const item2 = InvoiceItem.createInvoiceItem({ invoiceId: testInvoiceId, description: 'Item 2', unitPrice: 2000 });
        const item3 = InvoiceItem.createInvoiceItem({ invoiceId: testInvoiceId, description: 'Item 3', unitPrice: 3000 });
        
        // Reorder: Item 3, Item 1, Item 2
        const result = InvoiceItem.reorderItems(testInvoiceId, [item3.data.id, item1.data.id, item2.data.id]);
        
        expect(result.success).toBe(true);
        
        const items = InvoiceItem.getByInvoiceId(testInvoiceId);
        expect(items[0].description).toBe('Item 3');
        expect(items[1].description).toBe('Item 1');
        expect(items[2].description).toBe('Item 2');
      });
    });
  });
});

describe('Invoice-InvoiceItem Integration', () => {
  let testInvoiceId;

  beforeEach(() => {
    executeMany('DELETE FROM invoice_items; DELETE FROM invoices;');
    
    const invoiceResult = Invoice.createInvoice({
      userId: testUserId,
      invoiceNumber: 'INV-INT-0001',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      customerName: 'Integration Test Customer'
    });
    testInvoiceId = invoiceResult.data.id;
  });

  test('should recalculate invoice totals from items', () => {
    InvoiceItem.createInvoiceItem({
      invoiceId: testInvoiceId,
      description: 'Item 1',
      quantity: '2',
      unitPrice: 10000,
      vatRateId: 'standard'
    });
    InvoiceItem.createInvoiceItem({
      invoiceId: testInvoiceId,
      description: 'Item 2',
      quantity: '1',
      unitPrice: 5000,
      vatRateId: 'zero'
    });
    
    const result = Invoice.recalculateTotals(testInvoiceId);
    
    expect(result.success).toBe(true);
    expect(result.data.subtotal).toBe(25000); // (10000*2) + 5000
    expect(result.data.vatAmount).toBe(4000); // 20000 * 0.2
    expect(result.data.totalAmount).toBe(29000); // 25000 + 4000
  });

  test('should cascade delete items when invoice is deleted', () => {
    InvoiceItem.createInvoiceItem({
      invoiceId: testInvoiceId,
      description: 'Item 1',
      unitPrice: 10000
    });
    InvoiceItem.createInvoiceItem({
      invoiceId: testInvoiceId,
      description: 'Item 2',
      unitPrice: 5000
    });
    
    // Delete the invoice
    Invoice.deleteInvoice(testInvoiceId);
    
    // Items should be deleted via CASCADE
    const items = InvoiceItem.getByInvoiceId(testInvoiceId);
    expect(items.length).toBe(0);
  });
});
