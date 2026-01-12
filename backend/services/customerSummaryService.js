/**
 * Customer Summary Service
 * 
 * Provides transaction and invoice history retrieval for customers,
 * enabling relationship analysis with accurate summary calculations
 * and outstanding balance tracking.
 * 
 * @module services/customerSummaryService
 */

const { query, queryOne } = require('../database/index');
const { findById: findCustomerById } = require('../database/models/Customer');

/**
 * Gets transaction history for a specific customer.
 * Transactions are matched by payee field containing the customer name.
 * 
 * @param {number} userId - User ID who owns the transactions
 * @param {number} customerId - Customer ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.type] - Filter by transaction type (income, expense)
 * @param {string} [options.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [options.endDate] - End date filter (YYYY-MM-DD)
 * @param {string} [options.sortBy='transactionDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getCustomerTransactionHistory(userId, customerId, options = {}) {
  // Validate customer exists and belongs to user
  const customer = findCustomerById(customerId);
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  if (customer.userId !== userId) {
    return { success: false, error: 'Access denied' };
  }

  const {
    page = 1,
    limit = 20,
    type,
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

  // Build WHERE clause - match transactions by payee containing customer name
  let whereClause = 'WHERE userId = ? AND (payee = ? OR payee LIKE ?)';
  const params = [userId, customer.name, `%${customer.name}%`];

  // Optional type filter
  const validTypes = ['income', 'expense', 'transfer'];
  if (type && validTypes.includes(type)) {
    whereClause += ' AND type = ?';
    params.push(type);
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
      customerId,
      customerName: customer.name
    }
  };
}

/**
 * Gets invoice history for a specific customer with status filtering.
 * Invoices are matched by customerName field.
 * 
 * @param {number} userId - User ID who owns the invoices
 * @param {number} customerId - Customer ID
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.status] - Filter by invoice status
 * @param {string} [options.startDate] - Start date filter (YYYY-MM-DD) for issue date
 * @param {string} [options.endDate] - End date filter (YYYY-MM-DD) for issue date
 * @param {string} [options.sortBy='issueDate'] - Sort field
 * @param {string} [options.sortOrder='DESC'] - Sort order
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getCustomerInvoiceHistory(userId, customerId, options = {}) {
  // Validate customer exists and belongs to user
  const customer = findCustomerById(customerId);
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  if (customer.userId !== userId) {
    return { success: false, error: 'Access denied' };
  }

  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate,
    sortBy = 'issueDate',
    sortOrder = 'DESC'
  } = options;

  const offset = (page - 1) * limit;

  // Validate sortBy to prevent SQL injection
  const validSortFields = ['issueDate', 'dueDate', 'invoiceNumber', 'totalAmount', 'status', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'issueDate';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Build WHERE clause - match invoices by customer name
  let whereClause = 'WHERE userId = ? AND customerName = ?';
  const params = [userId, customer.name];

  // Optional status filter
  const validStatuses = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'void'];
  if (status && validStatuses.includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  // Date range filters
  if (startDate) {
    whereClause += ' AND issueDate >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND issueDate <= ?';
    params.push(endDate);
  }

  // Execute query
  const invoices = query(
    `SELECT * FROM invoices ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Get total count
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM invoices ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  // Add isOverdue flag to each invoice
  const today = new Date().toISOString().split('T')[0];
  const invoicesWithOverdue = invoices.map(invoice => ({
    ...invoice,
    isOverdue: (invoice.status === 'pending' || invoice.status === 'overdue') && invoice.dueDate < today
  }));

  return {
    success: true,
    data: {
      invoices: invoicesWithOverdue,
      total,
      page,
      limit,
      customerId,
      customerName: customer.name
    }
  };
}

/**
 * Calculates the customer summary including totals and outstanding balance.
 * 
 * @param {number} userId - User ID who owns the customer
 * @param {number} customerId - Customer ID
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
function getCustomerSummary(userId, customerId) {
  // Validate customer exists and belongs to user
  const customer = findCustomerById(customerId);
  if (!customer) {
    return { success: false, error: 'Customer not found' };
  }
  if (customer.userId !== userId) {
    return { success: false, error: 'Access denied' };
  }

  // Get invoice summary
  const invoiceSummary = queryOne(`
    SELECT 
      COUNT(*) as totalInvoices,
      COALESCE(SUM(totalAmount), 0) as totalInvoiced,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN totalAmount ELSE 0 END), 0) as totalPaid,
      COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue') THEN totalAmount ELSE 0 END), 0) as outstandingBalance,
      COALESCE(SUM(CASE WHEN status = 'overdue' OR (status = 'pending' AND dueDate < date('now')) THEN totalAmount ELSE 0 END), 0) as overdueAmount,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) as draftCount,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paidCount,
      COUNT(CASE WHEN status = 'overdue' OR (status = 'pending' AND dueDate < date('now')) THEN 1 END) as overdueCount,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelledCount,
      MIN(issueDate) as firstInvoiceDate,
      MAX(issueDate) as lastInvoiceDate,
      MAX(paidAt) as lastPaymentDate
    FROM invoices 
    WHERE userId = ? AND customerName = ?
  `, [userId, customer.name]);

  // Get transaction summary
  const transactionSummary = queryOne(`
    SELECT 
      COUNT(*) as totalTransactions,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as totalIncome,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN totalAmount ELSE 0 END), 0) as totalExpenses,
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as vatCollected,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN vatAmount ELSE 0 END), 0) as vatPaid,
      MIN(transactionDate) as firstTransactionDate,
      MAX(transactionDate) as lastTransactionDate
    FROM transactions 
    WHERE userId = ? AND (payee = ? OR payee LIKE ?)
  `, [userId, customer.name, `%${customer.name}%`]);

  return {
    success: true,
    data: {
      customerId,
      customerName: customer.name,
      customerNumber: customer.customerNumber,
      status: customer.status,
      invoices: {
        totalCount: invoiceSummary?.totalInvoices || 0,
        totalInvoiced: invoiceSummary?.totalInvoiced || 0,
        totalPaid: invoiceSummary?.totalPaid || 0,
        outstandingBalance: invoiceSummary?.outstandingBalance || 0,
        overdueAmount: invoiceSummary?.overdueAmount || 0,
        statusBreakdown: {
          draft: invoiceSummary?.draftCount || 0,
          pending: invoiceSummary?.pendingCount || 0,
          paid: invoiceSummary?.paidCount || 0,
          overdue: invoiceSummary?.overdueCount || 0,
          cancelled: invoiceSummary?.cancelledCount || 0
        },
        firstInvoiceDate: invoiceSummary?.firstInvoiceDate || null,
        lastInvoiceDate: invoiceSummary?.lastInvoiceDate || null,
        lastPaymentDate: invoiceSummary?.lastPaymentDate || null
      },
      transactions: {
        totalCount: transactionSummary?.totalTransactions || 0,
        totalIncome: transactionSummary?.totalIncome || 0,
        totalExpenses: transactionSummary?.totalExpenses || 0,
        netAmount: (transactionSummary?.totalIncome || 0) - (transactionSummary?.totalExpenses || 0),
        vatCollected: transactionSummary?.vatCollected || 0,
        vatPaid: transactionSummary?.vatPaid || 0,
        firstTransactionDate: transactionSummary?.firstTransactionDate || null,
        lastTransactionDate: transactionSummary?.lastTransactionDate || null
      },
      creditLimit: customer.creditLimit || 0,
      availableCredit: Math.max(0, (customer.creditLimit || 0) - (invoiceSummary?.outstandingBalance || 0)),
      paymentTerms: customer.paymentTerms || 30
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
  getCustomerTransactionHistory,
  getCustomerInvoiceHistory,
  getCustomerSummary,
  validateDateRange
};
