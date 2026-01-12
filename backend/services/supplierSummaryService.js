/**
 * Supplier Summary Service
 * 
 * Provides transaction history retrieval for suppliers,
 * enabling expense analysis by vendor with accurate summary calculations
 * and VAT reclaimed tracking.
 * 
 * @module services/supplierSummaryService
 */

const { query, queryOne } = require('../database/index');
const { findById: findSupplierById } = require('../database/models/Supplier');

/**
 * Gets transaction history for a specific supplier.
 * Transactions are matched by payee field containing the supplier name.
 * Focuses on expense-type transactions for supplier expense analysis.
 * 
 * @param {number} userId - User ID who owns the transactions
 * @param {number} supplierId - Supplier ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {number} [options.categoryId] - Filter by category ID
 * @param {string} [options.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [options.endDate] - End date filter (YYYY-MM-DD)
 * @param {string} [options.sortBy='transactionDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getSupplierTransactionHistory(userId, supplierId, options = {}) {
  // Validate supplier exists and belongs to user
  const supplier = findSupplierById(supplierId);
  if (!supplier) {
    return { success: false, error: 'Supplier not found' };
  }
  if (supplier.userId !== userId) {
    return { success: false, error: 'Access denied' };
  }

  const {
    page = 1,
    limit = 20,
    categoryId,
    startDate,
    endDate,
    sortBy = 'transactionDate',
    sortOrder = 'DESC'
  } = options;

  const offset = (page - 1) * limit;

  // Validate sortBy to prevent SQL injection
  const validSortFields = ['transactionDate', 'amount', 'totalAmount', 'type', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'transactionDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Build WHERE clause - match transactions by payee containing supplier name
  // Focus on expense transactions for suppliers
  let whereClause = 'WHERE userId = ? AND (payee = ? OR payee LIKE ?)';
  const params = [userId, supplier.name, `%${supplier.name}%`];

  // Optional category filter
  if (categoryId && Number.isInteger(parseInt(categoryId, 10))) {
    whereClause += ' AND categoryId = ?';
    params.push(parseInt(categoryId, 10));
  }

  // Date range filters
  if (startDate) {
    whereClause += ' AND transactionDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND transactionDate <= ?';
    params.push(endDate);
  }

  // Execute query
  const transactions = query(
    `SELECT * FROM transactions ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Get total count
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  // Sanitize transactions (convert SQLite integers to booleans)
  const sanitizedTransactions = transactions.map(txn => ({
    ...txn,
    isRecurring: Boolean(txn.isRecurring)
  }));

  return {
    success: true,
    data: {
      transactions: sanitizedTransactions,
      total,
      page,
      limit,
      supplierId,
      supplierName: supplier.name
    }
  };
}

/**
 * Calculates the supplier summary including expense totals and VAT reclaimed.
 * 
 * @param {number} userId - User ID who owns the supplier
 * @param {number} supplierId - Supplier ID
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getSupplierSummary(userId, supplierId) {
  // Validate supplier exists and belongs to user
  const supplier = findSupplierById(supplierId);
  if (!supplier) {
    return { success: false, error: 'Supplier not found' };
  }
  if (supplier.userId !== userId) {
    return { success: false, error: 'Access denied' };
  }

  // Get expense transaction summary
  const expenseSummary = queryOne(`
    SELECT 
      COUNT(*) as totalTransactions,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as totalExpensesNet,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as totalExpensesGross,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as vatReclaimed,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as totalCredits,
      MIN(transactionDate) as firstTransactionDate,
      MAX(transactionDate) as lastTransactionDate,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
      COUNT(CASE WHEN status = 'cleared' THEN 1 END) as clearedCount,
      COUNT(CASE WHEN status = 'reconciled' THEN 1 END) as reconciledCount,
      COUNT(CASE WHEN status = 'void' THEN 1 END) as voidCount
    FROM transactions 
    WHERE userId = ? AND (payee = ? OR payee LIKE ?)
  `, [userId, supplier.name, `%${supplier.name}%`]);

  // Get category breakdown for expenses
  const categoryBreakdown = query(`
    SELECT 
      categoryId,
      c.name as categoryName,
      c.code as categoryCode,
      COUNT(*) as transactionCount,
      COALESCE(SUM(CASE WHEN t.status != 'void' THEN t.totalAmount ELSE 0 END), 0) as totalAmount,
      COALESCE(SUM(CASE WHEN t.status != 'void' THEN t.vatAmount ELSE 0 END), 0) as vatAmount
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ? AND t.type = 'expense' AND (t.payee = ? OR t.payee LIKE ?)
    GROUP BY t.categoryId
    ORDER BY totalAmount DESC
  `, [userId, supplier.name, `%${supplier.name}%`]);

  // Format category breakdown
  const formattedCategoryBreakdown = categoryBreakdown.map(cat => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName || 'Uncategorized',
    categoryCode: cat.categoryCode || null,
    transactionCount: cat.transactionCount,
    totalAmount: cat.totalAmount,
    vatAmount: cat.vatAmount
  }));

  return {
    success: true,
    data: {
      supplierId,
      supplierName: supplier.name,
      supplierStatus: supplier.status,
      isVatRegistered: Boolean(supplier.isVatRegistered),
      vatNumber: supplier.vatNumber,
      defaultExpenseCategory: supplier.defaultExpenseCategory,
      expenses: {
        totalCount: expenseSummary?.totalTransactions || 0,
        totalExpensesNet: expenseSummary?.totalExpensesNet || 0,
        totalExpensesGross: expenseSummary?.totalExpensesGross || 0,
        vatReclaimed: expenseSummary?.vatReclaimed || 0,
        totalCredits: expenseSummary?.totalCredits || 0,
        netExpenses: (expenseSummary?.totalExpensesGross || 0) - (expenseSummary?.totalCredits || 0),
        statusBreakdown: {
          pending: expenseSummary?.pendingCount || 0,
          cleared: expenseSummary?.clearedCount || 0,
          reconciled: expenseSummary?.reconciledCount || 0,
          void: expenseSummary?.voidCount || 0
        },
        firstTransactionDate: expenseSummary?.firstTransactionDate || null,
        lastTransactionDate: expenseSummary?.lastTransactionDate || null
      },
      categoryBreakdown: formattedCategoryBreakdown,
      paymentTerms: supplier.paymentTerms,
      paymentTermsDays: supplier.paymentTermsDays
    }
  };
}

/**
 * Validates date parameters for history queries.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{isValid: boolean, error?: string}}
 */
function validateDateRange(startDate, endDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !dateRegex.test(startDate)) {
    return { isValid: false, error: 'Invalid start date format (YYYY-MM-DD required)' };
  }

  if (endDate && !dateRegex.test(endDate)) {
    return { isValid: false, error: 'Invalid end date format (YYYY-MM-DD required)' };
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return { isValid: false, error: 'Invalid start date' };
    }

    if (isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid end date' };
    }

    if (start > end) {
      return { isValid: false, error: 'Start date must be before or equal to end date' };
    }
  }

  return { isValid: true };
}

module.exports = {
  getSupplierTransactionHistory,
  getSupplierSummary,
  validateDateRange
};
