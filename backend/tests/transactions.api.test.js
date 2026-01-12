/**
 * Unit Tests for Transactions API
 */

const request = require('supertest');
const app = require('../app');
const { query, execute } = require('../database/index');
const { seedCategories } = require('../database/seeds/categories');

// Seed categories before tests
seedCategories();

// Test user credentials
const testUser = {
  email: 'txntest@example.com',
  password: 'Test1234!',
  name: 'Transaction Test User'
};

let authToken;
let userId;
let categoryId;
let transactionId;

// Helper to register and login
async function setupAuth() {
  // Try to register (might fail if user exists)
  await request(app)
    .post('/api/auth/register')
    .send(testUser);
  
  // Login to get token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: testUser.password
    });
  
  if (loginRes.body.success && loginRes.body.data.token) {
    authToken = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;
  }
}

// Helper to get an expense category
async function getExpenseCategory() {
  const res = await request(app)
    .get('/api/categories/type/expense')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (res.body.success && res.body.data.length > 0) {
    return res.body.data[0].id;
  }
  return null;
}

// Helper to get an income category
async function getIncomeCategory() {
  const res = await request(app)
    .get('/api/categories/type/income')
    .set('Authorization', `Bearer ${authToken}`);
  
  if (res.body.success && res.body.data.length > 0) {
    return res.body.data[0].id;
  }
  return null;
}

describe('Transactions API', () => {
  beforeAll(async () => {
    await setupAuth();
    categoryId = await getExpenseCategory();
  });

  afterAll(async () => {
    // Cleanup test transactions
    if (userId) {
      try {
        execute('DELETE FROM transactions WHERE userId = ?', [userId]);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('POST /api/transactions', () => {
    it('should create a transaction successfully with all required fields', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Office supplies purchase',
          amount: 10000, // £100.00 in pence
          vatRate: 2000  // 20% standard rate
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.type).toBe('expense');
      expect(res.body.data.description).toBe('Office supplies purchase');
      expect(res.body.data.amount).toBe(10000);
      expect(res.body.data.vatRate).toBe(2000);
      expect(res.body.data.vatAmount).toBe(2000); // Auto-calculated: 10000 * 2000 / 10000 = 2000
      expect(res.body.data.totalAmount).toBe(12000); // 10000 + 2000
      
      transactionId = res.body.data.id;
    });

    it('should create transaction with income type', async () => {
      const incomeCategoryId = await getIncomeCategory();
      
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'income',
          categoryId: incomeCategoryId,
          transactionDate: '2026-01-12',
          description: 'Consulting service fee',
          amount: 50000, // £500.00
          vatRate: 2000,
          payee: 'Acme Corp',
          reference: 'INV-001',
          paymentMethod: 'bank_transfer'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('income');
      expect(res.body.data.vatAmount).toBe(10000); // 50000 * 20%
      expect(res.body.data.totalAmount).toBe(60000);
      expect(res.body.data.payee).toBe('Acme Corp');
    });

    it('should create transaction with reduced VAT rate (5%)', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Energy bill - reduced VAT',
          amount: 10000,
          vatRate: 500 // 5% reduced rate
        });

      expect(res.status).toBe(201);
      expect(res.body.data.vatRate).toBe(500);
      expect(res.body.data.vatAmount).toBe(500); // 10000 * 5%
      expect(res.body.data.totalAmount).toBe(10500);
    });

    it('should create transaction with zero VAT rate', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Food supplies - zero rated',
          amount: 5000,
          vatRate: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.data.vatRate).toBe(0);
      expect(res.body.data.vatAmount).toBe(0);
      expect(res.body.data.totalAmount).toBe(5000);
    });

    it('should create transaction with all optional fields', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          categoryId: categoryId,
          transactionDate: '2026-01-12',
          description: 'Full featured transaction',
          reference: 'REF-12345',
          amount: 25000,
          vatRate: 2000,
          currency: 'GBP',
          paymentMethod: 'card',
          payee: 'Test Supplier Ltd',
          notes: 'Monthly subscription payment',
          isRecurring: true,
          recurringFrequency: 'monthly'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reference).toBe('REF-12345');
      expect(res.body.data.paymentMethod).toBe('card');
      expect(res.body.data.payee).toBe('Test Supplier Ltd');
      expect(res.body.data.notes).toBe('Monthly subscription payment');
      expect(res.body.data.isRecurring).toBe(true);
      expect(res.body.data.recurringFrequency).toBe('monthly');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense'
          // Missing transactionDate and description
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('should return 400 for invalid transaction type', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'invalid_type',
          transactionDate: '2026-01-12',
          description: 'Test transaction'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details.some(e => e.field === 'type')).toBe(true);
    });

    it('should return 400 for invalid date format', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '12-01-2026', // Wrong format
          description: 'Test transaction'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(e => e.field === 'transactionDate')).toBe(true);
    });

    it('should return 400 for category type mismatch (income type with expense category)', async () => {
      // Ensure categoryId is an expense category for this test
      expect(categoryId).toBeDefined();
      expect(categoryId).not.toBeNull();
      
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'income', // Income transaction
          categoryId: categoryId, // But expense category
          transactionDate: '2026-01-12',
          description: 'Category mismatch test'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details.some(e => e.field === 'categoryId')).toBe(true);
    });

    it('should return 400 for non-existent category', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          categoryId: 999999, // Non-existent category
          transactionDate: '2026-01-12',
          description: 'Test transaction'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(e => e.field === 'categoryId')).toBe(true);
    });

    it('should return 400 for negative amount', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Test transaction',
          amount: -1000
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(e => e.field === 'amount')).toBe(true);
    });

    it('should return 400 for VAT rate out of range', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Test transaction',
          amount: 10000,
          vatRate: 15000 // > 10000 (100%)
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(e => e.field === 'vatRate')).toBe(true);
    });

    it('should return 400 for recurring transaction without frequency', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Recurring without frequency',
          amount: 10000,
          isRecurring: true
          // Missing recurringFrequency
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(e => e.field === 'recurringFrequency')).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Unauthorized test'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/transactions', () => {
    it('should list transactions for authenticated user', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toBeDefined();
      expect(Array.isArray(res.body.data.transactions)).toBe(true);
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.page).toBeDefined();
      expect(res.body.data.limit).toBeDefined();
    });

    it('should filter transactions by type', async () => {
      const res = await request(app)
        .get('/api/transactions?type=income')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.every(t => t.type === 'income')).toBe(true);
    });

    it('should filter transactions by date range', async () => {
      const res = await request(app)
        .get('/api/transactions?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // All transactions should be within the date range
      res.body.data.transactions.forEach(t => {
        const date = t.transactionDate;
        expect(date >= '2026-01-01' && date <= '2026-01-31').toBe(true);
      });
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/transactions?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(5);
      expect(res.body.data.transactions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/transactions/:id', () => {
    it('should get transaction by ID', async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const res = await request(app)
        .get('/api/transactions/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    it('should update transaction description', async () => {
      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated office supplies'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated office supplies');
    });

    it('should update transaction amount and recalculate VAT', async () => {
      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 20000 // £200.00
        });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(20000);
      expect(res.body.data.vatAmount).toBe(4000); // Recalculated: 20000 * 20%
      expect(res.body.data.totalAmount).toBe(24000);
    });

    it('should update VAT rate and recalculate amounts', async () => {
      const res = await request(app)
        .put(`/api/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vatRate: 500 // Change to 5%
        });

      expect(res.status).toBe(200);
      expect(res.body.data.vatRate).toBe(500);
      expect(res.body.data.vatAmount).toBe(1000); // 20000 * 5%
      expect(res.body.data.totalAmount).toBe(21000);
    });

    it('should return 404 for non-existent transaction', async () => {
      const res = await request(app)
        .put('/api/transactions/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Update attempt'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/transactions/:id/status', () => {
    it('should update transaction status', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'cleared'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cleared');
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/transactions/summary', () => {
    it('should return transaction summary for date range', async () => {
      const res = await request(app)
        .get('/api/transactions/summary?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.income).toBeDefined();
      expect(res.body.data.expense).toBeDefined();
      expect(res.body.data.netAmount).toBeDefined();
      expect(res.body.data.vatCollected).toBeDefined();
      expect(res.body.data.vatPaid).toBeDefined();
    });

    it('should return 400 without date range', async () => {
      const res = await request(app)
        .get('/api/transactions/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/transactions/vat-summary', () => {
    it('should return VAT summary for date range', async () => {
      const res = await request(app)
        .get('/api/transactions/vat-summary?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outputVat).toBeDefined();
      expect(res.body.data.inputVat).toBeDefined();
      expect(res.body.data.netVat).toBeDefined();
      expect(res.body.data.totalSales).toBeDefined();
      expect(res.body.data.totalPurchases).toBeDefined();
    });
  });

  describe('GET /api/transactions/search', () => {
    it('should search transactions by description', async () => {
      const res = await request(app)
        .get('/api/transactions/search?q=office')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 400 without search query', async () => {
      const res = await request(app)
        .get('/api/transactions/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/transactions/stats', () => {
    it('should return transaction stats', async () => {
      const res = await request(app)
        .get('/api/transactions/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.byType).toBeDefined();
      expect(res.body.data.byStatus).toBeDefined();
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('should delete transaction', async () => {
      // First create a transaction to delete
      const createRes = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'expense',
          transactionDate: '2026-01-12',
          description: 'Transaction to delete'
        });

      const idToDelete = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/transactions/${idToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's deleted
      const getRes = await request(app)
        .get(`/api/transactions/${idToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent transaction', async () => {
      const res = await request(app)
        .delete('/api/transactions/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
