/**
 * VAT Breakdown Service
 * 
 * Provides detailed transaction breakdown for each VAT return box,
 * enabling users to verify calculations and understand their VAT liability.
 * 
 * HMRC VAT Return Boxes:
 * - Box 1: VAT due on sales and other outputs
 * - Box 2: VAT due on acquisitions from EU (now 0 post-Brexit)
 * - Box 3: Total VAT due (Box 1 + Box 2)
 * - Box 4: VAT reclaimed on purchases and other inputs
 * - Box 5: Net VAT to pay or reclaim (Box 3 - Box 4)
 * - Box 6: Total value of sales and outputs (excluding VAT)
 * - Box 7: Total value of purchases and inputs (excluding VAT)
 * - Box 8: Total value of supplies to EU (now 0 post-Brexit)
 * - Box 9: Total value of acquisitions from EU (now 0 post-Brexit)
 * 
 * @module services/vatBreakdownService
 */

const { query, queryOne } = require('../database/index');
const { ACCOUNTING_SCHEMES } = require('../utils/vatBoxCalculator');

/**
 * VAT rate names for display.
 * @type {Object.<number, {en: string, tr: string}>}
 */
const VAT_RATE_NAMES = {
  2000: { en: 'Standard Rate (20%)', tr: 'Standart Oran (%20)' },
  500: { en: 'Reduced Rate (5%)', tr: 'İndirimli Oran (%5)' },
  0: { en: 'Zero Rate (0%)', tr: 'Sıfır Oran (%0)' }
};

/**
 * Box descriptions for UI display.
 * @type {Object.<string, {name: {en: string, tr: string}, description: {en: string, tr: string}}>}
 */
const BOX_DESCRIPTIONS = {
  box1: {
    name: { en: 'VAT due on sales', tr: 'Satışlardan doğan KDV' },
    description: { en: 'VAT due on sales and other outputs', tr: 'Satış ve diğer çıktılardan doğan KDV' }
  },
  box2: {
    name: { en: 'VAT due on EU acquisitions', tr: 'AB alımlarından doğan KDV' },
    description: { en: 'VAT due on acquisitions from EU member states (legacy, now 0)', tr: 'AB üye devletlerinden alımlardan doğan KDV (eski, şimdi 0)' }
  },
  box3: {
    name: { en: 'Total VAT due', tr: 'Toplam KDV borcu' },
    description: { en: 'Total VAT due (Box 1 + Box 2)', tr: 'Toplam KDV borcu (Kutu 1 + Kutu 2)' }
  },
  box4: {
    name: { en: 'VAT reclaimed', tr: 'Geri alınan KDV' },
    description: { en: 'VAT reclaimed on purchases and other inputs', tr: 'Satın almalar ve diğer girdilerden geri alınan KDV' }
  },
  box5: {
    name: { en: 'Net VAT', tr: 'Net KDV' },
    description: { en: 'Net VAT to pay or reclaim (Box 3 - Box 4)', tr: 'Ödenecek veya geri alınacak net KDV (Kutu 3 - Kutu 4)' }
  },
  box6: {
    name: { en: 'Total sales', tr: 'Toplam satışlar' },
    description: { en: 'Total value of sales and outputs (excluding VAT)', tr: 'Satış ve çıktıların toplam değeri (KDV hariç)' }
  },
  box7: {
    name: { en: 'Total purchases', tr: 'Toplam alımlar' },
    description: { en: 'Total value of purchases and inputs (excluding VAT)', tr: 'Satın alma ve girdilerin toplam değeri (KDV hariç)' }
  },
  box8: {
    name: { en: 'EU supplies', tr: 'AB teslimleri' },
    description: { en: 'Total value of supplies to EU (excluding VAT, now 0)', tr: 'AB\'ye teslimlerin toplam değeri (KDV hariç, şimdi 0)' }
  },
  box9: {
    name: { en: 'EU acquisitions', tr: 'AB alımları' },
    description: { en: 'Total value of acquisitions from EU (excluding VAT, now 0)', tr: 'AB\'den alımların toplam değeri (KDV hariç, şimdi 0)' }
  }
};

/**
 * Gets human-readable name for a VAT rate.
 * 
 * @param {number} vatRate - VAT rate in basis points (e.g., 2000 for 20%)
 * @param {string} [lang='en'] - Language code ('en' or 'tr')
 * @returns {string} Human-readable rate name
 */
function getVatRateName(vatRate, lang = 'en') {
  if (VAT_RATE_NAMES[vatRate]) {
    return VAT_RATE_NAMES[vatRate][lang] || VAT_RATE_NAMES[vatRate].en;
  }
  // For custom rates, show the percentage
  const percentage = vatRate / 100;
  return lang === 'tr' ? `Özel Oran (%${percentage})` : `Custom Rate (${percentage}%)`;
}

/**
 * Validates date format (YYYY-MM-DD).
 * 
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates the breakdown parameters.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @returns {Object} Validation result with isValid and errors
 */
function validateBreakdownParams(userId, periodStart, periodEnd) {
  const errors = {};
  
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    errors.userId = 'Valid userId is required';
  }
  
  if (!isValidDate(periodStart)) {
    errors.periodStart = 'Invalid periodStart format (YYYY-MM-DD required)';
  }
  
  if (!isValidDate(periodEnd)) {
    errors.periodEnd = 'Invalid periodEnd format (YYYY-MM-DD required)';
  }
  
  if (isValidDate(periodStart) && isValidDate(periodEnd)) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (start > end) {
      errors.periodEnd = 'periodEnd must be on or after periodStart';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Gets income transactions with full details for breakdown.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Query options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Optional filter by VAT rate
 * @returns {Array} Array of income transactions with category info
 */
function getIncomeTransactionsForBreakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate } = options;
  
  let sql;
  let params = [userId, periodStart, periodEnd];
  
  if (accountingScheme === ACCOUNTING_SCHEMES.CASH) {
    // Cash accounting: Only include transactions that represent actual payments received
    sql = `
      SELECT 
        t.id,
        t.transactionDate,
        t.description,
        t.reference,
        t.amount,
        t.vatAmount,
        t.totalAmount,
        t.vatRate,
        t.status,
        t.payee,
        t.paymentMethod,
        c.id as categoryId,
        c.code as categoryCode,
        c.name as categoryName,
        c.nameTr as categoryNameTr
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ?
        AND t.type = 'income'
        AND t.status IN ('cleared', 'reconciled')
        AND t.transactionDate >= ?
        AND t.transactionDate <= ?
    `;
  } else {
    // Standard accounting: Include all non-void income transactions
    sql = `
      SELECT 
        t.id,
        t.transactionDate,
        t.description,
        t.reference,
        t.amount,
        t.vatAmount,
        t.totalAmount,
        t.vatRate,
        t.status,
        t.payee,
        t.paymentMethod,
        c.id as categoryId,
        c.code as categoryCode,
        c.name as categoryName,
        c.nameTr as categoryNameTr
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ?
        AND t.type = 'income'
        AND t.status != 'void'
        AND t.transactionDate >= ?
        AND t.transactionDate <= ?
    `;
  }
  
  // Add VAT rate filter if specified
  if (vatRate !== undefined && vatRate !== null) {
    sql += ' AND t.vatRate = ?';
    params.push(vatRate);
  }
  
  sql += ' ORDER BY t.transactionDate ASC, t.id ASC';
  
  return query(sql, params);
}

/**
 * Gets expense transactions with full details for breakdown.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Query options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Optional filter by VAT rate
 * @returns {Array} Array of expense transactions with category info
 */
function getExpenseTransactionsForBreakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate } = options;
  
  let sql;
  let params = [userId, periodStart, periodEnd];
  
  if (accountingScheme === ACCOUNTING_SCHEMES.CASH) {
    // Cash accounting: Only include transactions that represent actual payments made
    sql = `
      SELECT 
        t.id,
        t.transactionDate,
        t.description,
        t.reference,
        t.amount,
        t.vatAmount,
        t.totalAmount,
        t.vatRate,
        t.status,
        t.payee,
        t.paymentMethod,
        c.id as categoryId,
        c.code as categoryCode,
        c.name as categoryName,
        c.nameTr as categoryNameTr
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ?
        AND t.type = 'expense'
        AND t.status IN ('cleared', 'reconciled')
        AND t.transactionDate >= ?
        AND t.transactionDate <= ?
    `;
  } else {
    // Standard accounting: Include all non-void expense transactions
    sql = `
      SELECT 
        t.id,
        t.transactionDate,
        t.description,
        t.reference,
        t.amount,
        t.vatAmount,
        t.totalAmount,
        t.vatRate,
        t.status,
        t.payee,
        t.paymentMethod,
        c.id as categoryId,
        c.code as categoryCode,
        c.name as categoryName,
        c.nameTr as categoryNameTr
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ?
        AND t.type = 'expense'
        AND t.status != 'void'
        AND t.transactionDate >= ?
        AND t.transactionDate <= ?
    `;
  }
  
  // Add VAT rate filter if specified
  if (vatRate !== undefined && vatRate !== null) {
    sql += ' AND t.vatRate = ?';
    params.push(vatRate);
  }
  
  sql += ' ORDER BY t.transactionDate ASC, t.id ASC';
  
  return query(sql, params);
}

/**
 * Gets sales invoices with full details for breakdown.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @returns {Array} Array of sales invoices
 */
function getSalesInvoicesForBreakdown(userId, periodStart, periodEnd) {
  const sql = `
    SELECT 
      i.id,
      i.invoiceNumber,
      i.issueDate,
      i.dueDate,
      i.customerName,
      i.subtotal,
      i.vatAmount,
      i.totalAmount,
      i.status
    FROM invoices i
    WHERE i.userId = ?
      AND i.status NOT IN ('void', 'cancelled')
      AND i.issueDate >= ?
      AND i.issueDate <= ?
    ORDER BY i.issueDate ASC, i.id ASC
  `;
  
  return query(sql, [userId, periodStart, periodEnd]);
}

/**
 * Calculates summary by VAT rate for transactions.
 * 
 * @param {Array} transactions - Array of transactions
 * @param {string} lang - Language for display
 * @returns {Array} Summary grouped by VAT rate
 */
function calculateSummaryByVatRate(transactions, lang = 'en') {
  const rateMap = new Map();
  
  for (const txn of transactions) {
    const rate = txn.vatRate || 0;
    
    if (!rateMap.has(rate)) {
      rateMap.set(rate, {
        vatRate: rate,
        vatRatePercent: rate / 100,
        vatRateName: getVatRateName(rate, lang),
        transactionCount: 0,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0
      });
    }
    
    const summary = rateMap.get(rate);
    summary.transactionCount++;
    summary.netAmount += txn.amount || 0;
    summary.vatAmount += txn.vatAmount || 0;
    summary.grossAmount += txn.totalAmount || 0;
  }
  
  // Convert to array and sort by rate descending
  return Array.from(rateMap.values()).sort((a, b) => b.vatRate - a.vatRate);
}

/**
 * Formats currency value for display.
 * 
 * @param {number} amountInPence - Amount in pence
 * @returns {string} Formatted currency string
 */
function formatCurrency(amountInPence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amountInPence / 100);
}

/**
 * Gets breakdown for Box 1: VAT due on sales.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Filter by VAT rate
 * @param {string} options.lang - Language for display
 * @returns {Object} Box 1 breakdown
 */
function getBox1Breakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate, lang = 'en' } = options;
  
  // For standard accounting, prefer invoices
  let transactions, invoices = [];
  
  if (accountingScheme === ACCOUNTING_SCHEMES.STANDARD) {
    invoices = getSalesInvoicesForBreakdown(userId, periodStart, periodEnd);
    // Fall back to transactions if no invoices
    if (invoices.length === 0) {
      transactions = getIncomeTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
    }
  } else {
    transactions = getIncomeTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
  }
  
  // Calculate totals
  let totalVatAmount = 0;
  let totalNetAmount = 0;
  let totalGrossAmount = 0;
  let items = [];
  
  if (invoices.length > 0) {
    // Use invoices
    for (const inv of invoices) {
      totalVatAmount += inv.vatAmount || 0;
      totalNetAmount += inv.subtotal || 0;
      totalGrossAmount += inv.totalAmount || 0;
      
      items.push({
        id: inv.id,
        type: 'invoice',
        date: inv.issueDate,
        reference: inv.invoiceNumber,
        description: `Invoice to ${inv.customerName}`,
        netAmount: inv.subtotal || 0,
        vatAmount: inv.vatAmount || 0,
        grossAmount: inv.totalAmount || 0,
        status: inv.status,
        formatted: {
          netAmount: formatCurrency(inv.subtotal || 0),
          vatAmount: formatCurrency(inv.vatAmount || 0),
          grossAmount: formatCurrency(inv.totalAmount || 0)
        }
      });
    }
  } else if (transactions && transactions.length > 0) {
    // Use transactions
    const summaryByRate = calculateSummaryByVatRate(transactions, lang);
    
    for (const txn of transactions) {
      totalVatAmount += txn.vatAmount || 0;
      totalNetAmount += txn.amount || 0;
      totalGrossAmount += txn.totalAmount || 0;
      
      items.push({
        id: txn.id,
        type: 'transaction',
        date: txn.transactionDate,
        reference: txn.reference,
        description: txn.description,
        netAmount: txn.amount || 0,
        vatAmount: txn.vatAmount || 0,
        grossAmount: txn.totalAmount || 0,
        vatRate: txn.vatRate || 0,
        vatRateName: getVatRateName(txn.vatRate || 0, lang),
        payee: txn.payee,
        status: txn.status,
        category: txn.categoryName ? {
          id: txn.categoryId,
          code: txn.categoryCode,
          name: lang === 'tr' ? (txn.categoryNameTr || txn.categoryName) : txn.categoryName
        } : null,
        formatted: {
          netAmount: formatCurrency(txn.amount || 0),
          vatAmount: formatCurrency(txn.vatAmount || 0),
          grossAmount: formatCurrency(txn.totalAmount || 0)
        }
      });
    }
  }
  
  return {
    box: 1,
    boxKey: 'box1',
    boxDescription: BOX_DESCRIPTIONS.box1,
    totalVatAmount,
    totalNetAmount,
    totalGrossAmount,
    transactionCount: items.length,
    items,
    summaryByRate: transactions ? calculateSummaryByVatRate(transactions, lang) : [],
    formatted: {
      totalVatAmount: formatCurrency(totalVatAmount),
      totalNetAmount: formatCurrency(totalNetAmount),
      totalGrossAmount: formatCurrency(totalGrossAmount)
    }
  };
}

/**
 * Gets breakdown for Box 4: VAT reclaimed on purchases.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Filter by VAT rate
 * @param {string} options.lang - Language for display
 * @returns {Object} Box 4 breakdown
 */
function getBox4Breakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate, lang = 'en' } = options;
  
  const transactions = getExpenseTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
  
  // Calculate totals
  let totalVatAmount = 0;
  let totalNetAmount = 0;
  let totalGrossAmount = 0;
  const items = [];
  
  for (const txn of transactions) {
    totalVatAmount += txn.vatAmount || 0;
    totalNetAmount += txn.amount || 0;
    totalGrossAmount += txn.totalAmount || 0;
    
    items.push({
      id: txn.id,
      type: 'transaction',
      date: txn.transactionDate,
      reference: txn.reference,
      description: txn.description,
      netAmount: txn.amount || 0,
      vatAmount: txn.vatAmount || 0,
      grossAmount: txn.totalAmount || 0,
      vatRate: txn.vatRate || 0,
      vatRateName: getVatRateName(txn.vatRate || 0, lang),
      payee: txn.payee,
      status: txn.status,
      category: txn.categoryName ? {
        id: txn.categoryId,
        code: txn.categoryCode,
        name: lang === 'tr' ? (txn.categoryNameTr || txn.categoryName) : txn.categoryName
      } : null,
      formatted: {
        netAmount: formatCurrency(txn.amount || 0),
        vatAmount: formatCurrency(txn.vatAmount || 0),
        grossAmount: formatCurrency(txn.totalAmount || 0)
      }
    });
  }
  
  const summaryByRate = calculateSummaryByVatRate(transactions, lang);
  
  return {
    box: 4,
    boxKey: 'box4',
    boxDescription: BOX_DESCRIPTIONS.box4,
    totalVatAmount,
    totalNetAmount,
    totalGrossAmount,
    transactionCount: items.length,
    items,
    summaryByRate,
    formatted: {
      totalVatAmount: formatCurrency(totalVatAmount),
      totalNetAmount: formatCurrency(totalNetAmount),
      totalGrossAmount: formatCurrency(totalGrossAmount)
    }
  };
}

/**
 * Gets breakdown for Box 6: Total value of sales (excluding VAT).
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Filter by VAT rate
 * @param {string} options.lang - Language for display
 * @returns {Object} Box 6 breakdown
 */
function getBox6Breakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate, lang = 'en' } = options;
  
  // For standard accounting, prefer invoices
  let transactions, invoices = [];
  
  if (accountingScheme === ACCOUNTING_SCHEMES.STANDARD) {
    invoices = getSalesInvoicesForBreakdown(userId, periodStart, periodEnd);
    if (invoices.length === 0) {
      transactions = getIncomeTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
    }
  } else {
    transactions = getIncomeTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
  }
  
  let totalNetAmount = 0;
  let totalVatAmount = 0;
  let totalGrossAmount = 0;
  const items = [];
  
  if (invoices.length > 0) {
    for (const inv of invoices) {
      totalNetAmount += inv.subtotal || 0;
      totalVatAmount += inv.vatAmount || 0;
      totalGrossAmount += inv.totalAmount || 0;
      
      items.push({
        id: inv.id,
        type: 'invoice',
        date: inv.issueDate,
        reference: inv.invoiceNumber,
        description: `Invoice to ${inv.customerName}`,
        netAmount: inv.subtotal || 0,
        vatAmount: inv.vatAmount || 0,
        grossAmount: inv.totalAmount || 0,
        status: inv.status,
        formatted: {
          netAmount: formatCurrency(inv.subtotal || 0),
          vatAmount: formatCurrency(inv.vatAmount || 0),
          grossAmount: formatCurrency(inv.totalAmount || 0)
        }
      });
    }
  } else if (transactions && transactions.length > 0) {
    for (const txn of transactions) {
      totalNetAmount += txn.amount || 0;
      totalVatAmount += txn.vatAmount || 0;
      totalGrossAmount += txn.totalAmount || 0;
      
      items.push({
        id: txn.id,
        type: 'transaction',
        date: txn.transactionDate,
        reference: txn.reference,
        description: txn.description,
        netAmount: txn.amount || 0,
        vatAmount: txn.vatAmount || 0,
        grossAmount: txn.totalAmount || 0,
        vatRate: txn.vatRate || 0,
        vatRateName: getVatRateName(txn.vatRate || 0, lang),
        payee: txn.payee,
        status: txn.status,
        category: txn.categoryName ? {
          id: txn.categoryId,
          code: txn.categoryCode,
          name: lang === 'tr' ? (txn.categoryNameTr || txn.categoryName) : txn.categoryName
        } : null,
        formatted: {
          netAmount: formatCurrency(txn.amount || 0),
          vatAmount: formatCurrency(txn.vatAmount || 0),
          grossAmount: formatCurrency(txn.totalAmount || 0)
        }
      });
    }
  }
  
  return {
    box: 6,
    boxKey: 'box6',
    boxDescription: BOX_DESCRIPTIONS.box6,
    totalNetAmount,
    totalVatAmount,
    totalGrossAmount,
    transactionCount: items.length,
    items,
    summaryByRate: transactions ? calculateSummaryByVatRate(transactions, lang) : [],
    formatted: {
      totalNetAmount: formatCurrency(totalNetAmount),
      totalVatAmount: formatCurrency(totalVatAmount),
      totalGrossAmount: formatCurrency(totalGrossAmount)
    }
  };
}

/**
 * Gets breakdown for Box 7: Total value of purchases (excluding VAT).
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date
 * @param {string} periodEnd - Period end date
 * @param {Object} options - Options
 * @param {string} options.accountingScheme - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Filter by VAT rate
 * @param {string} options.lang - Language for display
 * @returns {Object} Box 7 breakdown
 */
function getBox7Breakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate, lang = 'en' } = options;
  
  const transactions = getExpenseTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
  
  let totalNetAmount = 0;
  let totalVatAmount = 0;
  let totalGrossAmount = 0;
  const items = [];
  
  for (const txn of transactions) {
    totalNetAmount += txn.amount || 0;
    totalVatAmount += txn.vatAmount || 0;
    totalGrossAmount += txn.totalAmount || 0;
    
    items.push({
      id: txn.id,
      type: 'transaction',
      date: txn.transactionDate,
      reference: txn.reference,
      description: txn.description,
      netAmount: txn.amount || 0,
      vatAmount: txn.vatAmount || 0,
      grossAmount: txn.totalAmount || 0,
      vatRate: txn.vatRate || 0,
      vatRateName: getVatRateName(txn.vatRate || 0, lang),
      payee: txn.payee,
      status: txn.status,
      category: txn.categoryName ? {
        id: txn.categoryId,
        code: txn.categoryCode,
        name: lang === 'tr' ? (txn.categoryNameTr || txn.categoryName) : txn.categoryName
      } : null,
      formatted: {
        netAmount: formatCurrency(txn.amount || 0),
        vatAmount: formatCurrency(txn.vatAmount || 0),
        grossAmount: formatCurrency(txn.totalAmount || 0)
      }
    });
  }
  
  const summaryByRate = calculateSummaryByVatRate(transactions, lang);
  
  return {
    box: 7,
    boxKey: 'box7',
    boxDescription: BOX_DESCRIPTIONS.box7,
    totalNetAmount,
    totalVatAmount,
    totalGrossAmount,
    transactionCount: items.length,
    items,
    summaryByRate,
    formatted: {
      totalNetAmount: formatCurrency(totalNetAmount),
      totalVatAmount: formatCurrency(totalVatAmount),
      totalGrossAmount: formatCurrency(totalGrossAmount)
    }
  };
}

/**
 * Gets a breakdown for a specific VAT return box.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {number} boxNumber - Box number (1-9)
 * @param {Object} options - Options
 * @param {string} [options.accountingScheme='standard'] - 'standard' or 'cash'
 * @param {number} [options.vatRate] - Filter by VAT rate
 * @param {string} [options.lang='en'] - Language for display
 * @returns {Object} Breakdown result
 */
function getBoxBreakdown(userId, periodStart, periodEnd, boxNumber, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, vatRate, lang = 'en' } = options;
  
  // Validate parameters
  const validation = validateBreakdownParams(userId, periodStart, periodEnd);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }
  
  // Validate box number
  if (!Number.isInteger(boxNumber) || boxNumber < 1 || boxNumber > 9) {
    return {
      success: false,
      errors: { boxNumber: 'Box number must be between 1 and 9' }
    };
  }
  
  // Validate accounting scheme
  if (!Object.values(ACCOUNTING_SCHEMES).includes(accountingScheme)) {
    return {
      success: false,
      errors: { accountingScheme: `Invalid accounting scheme. Must be one of: ${Object.values(ACCOUNTING_SCHEMES).join(', ')}` }
    };
  }
  
  try {
    let breakdown;
    
    switch (boxNumber) {
      case 1:
        breakdown = getBox1Breakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate, lang });
        break;
      case 2:
        // Box 2 is always 0 post-Brexit
        breakdown = {
          box: 2,
          boxKey: 'box2',
          boxDescription: BOX_DESCRIPTIONS.box2,
          totalVatAmount: 0,
          transactionCount: 0,
          items: [],
          summaryByRate: [],
          formatted: { totalVatAmount: formatCurrency(0) },
          note: {
            en: 'Post-Brexit: EU acquisitions VAT is now handled through postponed VAT accounting.',
            tr: 'Brexit sonrası: AB alımları KDV\'si artık ertelenmiş KDV muhasebesi ile işlenmektedir.'
          }
        };
        break;
      case 3:
        // Box 3 = Box 1 + Box 2, reference to component boxes
        const box1 = getBox1Breakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate, lang });
        breakdown = {
          box: 3,
          boxKey: 'box3',
          boxDescription: BOX_DESCRIPTIONS.box3,
          totalVatAmount: box1.totalVatAmount, // Box 2 is always 0
          components: {
            box1: box1.totalVatAmount,
            box2: 0
          },
          transactionCount: box1.transactionCount,
          formatted: { totalVatAmount: formatCurrency(box1.totalVatAmount) },
          note: {
            en: 'This is the sum of Box 1 and Box 2. See Box 1 for transaction details.',
            tr: 'Bu Kutu 1 ve Kutu 2\'nin toplamıdır. İşlem detayları için Kutu 1\'e bakın.'
          }
        };
        break;
      case 4:
        breakdown = getBox4Breakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate, lang });
        break;
      case 5:
        // Box 5 = Box 3 - Box 4, reference to component boxes
        const box1ForBox5 = getBox1Breakdown(userId, periodStart, periodEnd, { accountingScheme, lang });
        const box4ForBox5 = getBox4Breakdown(userId, periodStart, periodEnd, { accountingScheme, lang });
        const netVat = box1ForBox5.totalVatAmount - box4ForBox5.totalVatAmount;
        breakdown = {
          box: 5,
          boxKey: 'box5',
          boxDescription: BOX_DESCRIPTIONS.box5,
          netVatAmount: netVat,
          isRefundDue: netVat < 0,
          components: {
            box3: box1ForBox5.totalVatAmount, // Box 3 = Box 1 + Box 2 (Box 2 = 0)
            box4: box4ForBox5.totalVatAmount
          },
          transactionCount: box1ForBox5.transactionCount + box4ForBox5.transactionCount,
          formatted: { 
            netVatAmount: formatCurrency(Math.abs(netVat)),
            netVatLabel: netVat < 0 
              ? { en: 'VAT refund due', tr: 'KDV iadesi alınacak' }
              : { en: 'VAT payable', tr: 'Ödenecek KDV' }
          },
          note: {
            en: 'This is the difference between Box 3 (total VAT due) and Box 4 (VAT reclaimed). See Box 1 and Box 4 for transaction details.',
            tr: 'Bu Kutu 3 (toplam KDV borcu) ile Kutu 4 (geri alınan KDV) arasındaki farktır. İşlem detayları için Kutu 1 ve Kutu 4\'e bakın.'
          }
        };
        break;
      case 6:
        breakdown = getBox6Breakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate, lang });
        break;
      case 7:
        breakdown = getBox7Breakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate, lang });
        break;
      case 8:
        // Box 8 is always 0 post-Brexit
        breakdown = {
          box: 8,
          boxKey: 'box8',
          boxDescription: BOX_DESCRIPTIONS.box8,
          totalNetAmount: 0,
          transactionCount: 0,
          items: [],
          summaryByRate: [],
          formatted: { totalNetAmount: formatCurrency(0) },
          note: {
            en: 'Post-Brexit: EU supplies are now treated as exports and reported separately.',
            tr: 'Brexit sonrası: AB teslimleri artık ihracat olarak işlenmekte ve ayrı raporlanmaktadır.'
          }
        };
        break;
      case 9:
        // Box 9 is always 0 post-Brexit
        breakdown = {
          box: 9,
          boxKey: 'box9',
          boxDescription: BOX_DESCRIPTIONS.box9,
          totalNetAmount: 0,
          transactionCount: 0,
          items: [],
          summaryByRate: [],
          formatted: { totalNetAmount: formatCurrency(0) },
          note: {
            en: 'Post-Brexit: EU acquisitions are now treated as imports and reported separately.',
            tr: 'Brexit sonrası: AB alımları artık ithalat olarak işlenmekte ve ayrı raporlanmaktadır.'
          }
        };
        break;
      default:
        return {
          success: false,
          errors: { boxNumber: 'Invalid box number' }
        };
    }
    
    return {
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd
        },
        accountingScheme,
        breakdown
      }
    };
    
  } catch (error) {
    console.error('Error getting box breakdown:', error.message);
    return {
      success: false,
      errors: { general: 'Failed to get box breakdown' }
    };
  }
}

/**
 * Gets full VAT return breakdown with all boxes.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {Object} options - Options
 * @param {string} [options.accountingScheme='standard'] - 'standard' or 'cash'
 * @param {string} [options.lang='en'] - Language for display
 * @returns {Object} Full breakdown result
 */
function getFullVatReturnBreakdown(userId, periodStart, periodEnd, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, lang = 'en' } = options;
  
  // Validate parameters
  const validation = validateBreakdownParams(userId, periodStart, periodEnd);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }
  
  // Validate accounting scheme
  if (!Object.values(ACCOUNTING_SCHEMES).includes(accountingScheme)) {
    return {
      success: false,
      errors: { accountingScheme: `Invalid accounting scheme. Must be one of: ${Object.values(ACCOUNTING_SCHEMES).join(', ')}` }
    };
  }
  
  try {
    // Get breakdowns for all boxes
    const box1 = getBox1Breakdown(userId, periodStart, periodEnd, { accountingScheme, lang });
    const box4 = getBox4Breakdown(userId, periodStart, periodEnd, { accountingScheme, lang });
    const box6 = getBox6Breakdown(userId, periodStart, periodEnd, { accountingScheme, lang });
    const box7 = getBox7Breakdown(userId, periodStart, periodEnd, { accountingScheme, lang });
    
    // Calculate derived values
    const box2Value = 0; // Post-Brexit
    const box3Value = box1.totalVatAmount + box2Value;
    const box5Value = box3Value - box4.totalVatAmount;
    const box8Value = 0; // Post-Brexit
    const box9Value = 0; // Post-Brexit
    
    const boxes = {
      box1: {
        value: box1.totalVatAmount,
        formatted: box1.formatted.totalVatAmount,
        description: BOX_DESCRIPTIONS.box1,
        transactionCount: box1.transactionCount,
        summaryByRate: box1.summaryByRate
      },
      box2: {
        value: box2Value,
        formatted: formatCurrency(box2Value),
        description: BOX_DESCRIPTIONS.box2,
        transactionCount: 0,
        note: { en: 'Post-Brexit: Always 0', tr: 'Brexit sonrası: Daima 0' }
      },
      box3: {
        value: box3Value,
        formatted: formatCurrency(box3Value),
        description: BOX_DESCRIPTIONS.box3,
        components: { box1: box1.totalVatAmount, box2: box2Value }
      },
      box4: {
        value: box4.totalVatAmount,
        formatted: box4.formatted.totalVatAmount,
        description: BOX_DESCRIPTIONS.box4,
        transactionCount: box4.transactionCount,
        summaryByRate: box4.summaryByRate
      },
      box5: {
        value: box5Value,
        formatted: formatCurrency(Math.abs(box5Value)),
        description: BOX_DESCRIPTIONS.box5,
        isRefundDue: box5Value < 0,
        label: box5Value < 0 
          ? { en: 'VAT refund due', tr: 'KDV iadesi alınacak' }
          : { en: 'VAT payable', tr: 'Ödenecek KDV' },
        components: { box3: box3Value, box4: box4.totalVatAmount }
      },
      box6: {
        value: box6.totalNetAmount,
        formatted: box6.formatted.totalNetAmount,
        description: BOX_DESCRIPTIONS.box6,
        transactionCount: box6.transactionCount,
        summaryByRate: box6.summaryByRate
      },
      box7: {
        value: box7.totalNetAmount,
        formatted: box7.formatted.totalNetAmount,
        description: BOX_DESCRIPTIONS.box7,
        transactionCount: box7.transactionCount,
        summaryByRate: box7.summaryByRate
      },
      box8: {
        value: box8Value,
        formatted: formatCurrency(box8Value),
        description: BOX_DESCRIPTIONS.box8,
        transactionCount: 0,
        note: { en: 'Post-Brexit: Always 0', tr: 'Brexit sonrası: Daima 0' }
      },
      box9: {
        value: box9Value,
        formatted: formatCurrency(box9Value),
        description: BOX_DESCRIPTIONS.box9,
        transactionCount: 0,
        note: { en: 'Post-Brexit: Always 0', tr: 'Brexit sonrası: Daima 0' }
      }
    };
    
    // Calculate overall summary
    const totalOutputTransactions = box1.transactionCount;
    const totalInputTransactions = box4.transactionCount;
    
    return {
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd
        },
        accountingScheme,
        boxes,
        summary: {
          vatDue: box3Value,
          vatReclaimed: box4.totalVatAmount,
          netVat: box5Value,
          isRefundDue: box5Value < 0,
          totalSales: box6.totalNetAmount,
          totalPurchases: box7.totalNetAmount,
          totalTransactions: totalOutputTransactions + totalInputTransactions,
          formatted: {
            vatDue: formatCurrency(box3Value),
            vatReclaimed: formatCurrency(box4.totalVatAmount),
            netVat: formatCurrency(Math.abs(box5Value)),
            netVatLabel: box5Value < 0 
              ? { en: 'VAT refund due', tr: 'KDV iadesi alınacak' }
              : { en: 'VAT payable', tr: 'Ödenecek KDV' },
            totalSales: formatCurrency(box6.totalNetAmount),
            totalPurchases: formatCurrency(box7.totalNetAmount)
          }
        },
        metadata: {
          calculatedAt: new Date().toISOString(),
          language: lang
        }
      }
    };
    
  } catch (error) {
    console.error('Error getting full VAT return breakdown:', error.message);
    return {
      success: false,
      errors: { general: 'Failed to get VAT return breakdown' }
    };
  }
}

/**
 * Gets VAT breakdown filtered by a specific VAT rate.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {number} vatRate - VAT rate in basis points (e.g., 2000 for 20%)
 * @param {Object} options - Options
 * @param {string} [options.accountingScheme='standard'] - 'standard' or 'cash'
 * @param {string} [options.lang='en'] - Language for display
 * @returns {Object} Breakdown filtered by VAT rate
 */
function getBreakdownByVatRate(userId, periodStart, periodEnd, vatRate, options = {}) {
  const { accountingScheme = ACCOUNTING_SCHEMES.STANDARD, lang = 'en' } = options;
  
  // Validate parameters
  const validation = validateBreakdownParams(userId, periodStart, periodEnd);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }
  
  // Validate VAT rate
  if (typeof vatRate !== 'number' || vatRate < 0 || vatRate > 10000) {
    return {
      success: false,
      errors: { vatRate: 'VAT rate must be between 0 and 10000 (representing 0% to 100%)' }
    };
  }
  
  try {
    // Get transactions filtered by rate
    const incomeTransactions = getIncomeTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
    const expenseTransactions = getExpenseTransactionsForBreakdown(userId, periodStart, periodEnd, { accountingScheme, vatRate });
    
    // Calculate totals
    let outputVat = 0;
    let outputNet = 0;
    let inputVat = 0;
    let inputNet = 0;
    
    const outputItems = incomeTransactions.map(txn => {
      outputVat += txn.vatAmount || 0;
      outputNet += txn.amount || 0;
      return {
        id: txn.id,
        type: 'income',
        date: txn.transactionDate,
        reference: txn.reference,
        description: txn.description,
        netAmount: txn.amount || 0,
        vatAmount: txn.vatAmount || 0,
        grossAmount: txn.totalAmount || 0,
        payee: txn.payee,
        status: txn.status,
        category: txn.categoryName ? {
          id: txn.categoryId,
          code: txn.categoryCode,
          name: lang === 'tr' ? (txn.categoryNameTr || txn.categoryName) : txn.categoryName
        } : null,
        formatted: {
          netAmount: formatCurrency(txn.amount || 0),
          vatAmount: formatCurrency(txn.vatAmount || 0),
          grossAmount: formatCurrency(txn.totalAmount || 0)
        }
      };
    });
    
    const inputItems = expenseTransactions.map(txn => {
      inputVat += txn.vatAmount || 0;
      inputNet += txn.amount || 0;
      return {
        id: txn.id,
        type: 'expense',
        date: txn.transactionDate,
        reference: txn.reference,
        description: txn.description,
        netAmount: txn.amount || 0,
        vatAmount: txn.vatAmount || 0,
        grossAmount: txn.totalAmount || 0,
        payee: txn.payee,
        status: txn.status,
        category: txn.categoryName ? {
          id: txn.categoryId,
          code: txn.categoryCode,
          name: lang === 'tr' ? (txn.categoryNameTr || txn.categoryName) : txn.categoryName
        } : null,
        formatted: {
          netAmount: formatCurrency(txn.amount || 0),
          vatAmount: formatCurrency(txn.vatAmount || 0),
          grossAmount: formatCurrency(txn.totalAmount || 0)
        }
      };
    });
    
    const netVat = outputVat - inputVat;
    
    return {
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd
        },
        accountingScheme,
        vatRate,
        vatRatePercent: vatRate / 100,
        vatRateName: getVatRateName(vatRate, lang),
        output: {
          transactions: outputItems,
          transactionCount: outputItems.length,
          totalVat: outputVat,
          totalNet: outputNet,
          formatted: {
            totalVat: formatCurrency(outputVat),
            totalNet: formatCurrency(outputNet)
          }
        },
        input: {
          transactions: inputItems,
          transactionCount: inputItems.length,
          totalVat: inputVat,
          totalNet: inputNet,
          formatted: {
            totalVat: formatCurrency(inputVat),
            totalNet: formatCurrency(inputNet)
          }
        },
        summary: {
          netVat,
          isRefundDue: netVat < 0,
          formatted: {
            netVat: formatCurrency(Math.abs(netVat)),
            label: netVat < 0 
              ? { en: 'VAT refund due', tr: 'KDV iadesi alınacak' }
              : { en: 'VAT payable', tr: 'Ödenecek KDV' }
          }
        },
        metadata: {
          calculatedAt: new Date().toISOString(),
          language: lang
        }
      }
    };
    
  } catch (error) {
    console.error('Error getting breakdown by VAT rate:', error.message);
    return {
      success: false,
      errors: { general: 'Failed to get VAT rate breakdown' }
    };
  }
}

/**
 * Gets available VAT rates used in the period.
 * 
 * @param {number} userId - User ID
 * @param {string} periodStart - Period start date (YYYY-MM-DD)
 * @param {string} periodEnd - Period end date (YYYY-MM-DD)
 * @param {string} [lang='en'] - Language for display
 * @returns {Object} List of VAT rates with transaction counts
 */
function getAvailableVatRates(userId, periodStart, periodEnd, lang = 'en') {
  const validation = validateBreakdownParams(userId, periodStart, periodEnd);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }
  
  try {
    const results = query(`
      SELECT 
        vatRate,
        type,
        COUNT(*) as transactionCount,
        COALESCE(SUM(amount), 0) as netAmount,
        COALESCE(SUM(vatAmount), 0) as vatAmount
      FROM transactions
      WHERE userId = ?
        AND status != 'void'
        AND transactionDate >= ?
        AND transactionDate <= ?
      GROUP BY vatRate, type
      ORDER BY vatRate DESC, type ASC
    `, [userId, periodStart, periodEnd]);
    
    // Group by rate
    const rateMap = new Map();
    
    for (const row of results) {
      const rate = row.vatRate || 0;
      
      if (!rateMap.has(rate)) {
        rateMap.set(rate, {
          vatRate: rate,
          vatRatePercent: rate / 100,
          vatRateName: getVatRateName(rate, lang),
          income: { transactionCount: 0, netAmount: 0, vatAmount: 0 },
          expense: { transactionCount: 0, netAmount: 0, vatAmount: 0 },
          total: { transactionCount: 0, netAmount: 0, vatAmount: 0 }
        });
      }
      
      const rateData = rateMap.get(rate);
      
      if (row.type === 'income') {
        rateData.income.transactionCount = row.transactionCount || 0;
        rateData.income.netAmount = row.netAmount || 0;
        rateData.income.vatAmount = row.vatAmount || 0;
      } else if (row.type === 'expense') {
        rateData.expense.transactionCount = row.transactionCount || 0;
        rateData.expense.netAmount = row.netAmount || 0;
        rateData.expense.vatAmount = row.vatAmount || 0;
      }
      
      rateData.total.transactionCount = rateData.income.transactionCount + rateData.expense.transactionCount;
      rateData.total.netAmount = rateData.income.netAmount + rateData.expense.netAmount;
      rateData.total.vatAmount = rateData.income.vatAmount + rateData.expense.vatAmount;
    }
    
    return {
      success: true,
      data: {
        period: {
          start: periodStart,
          end: periodEnd
        },
        rates: Array.from(rateMap.values())
      }
    };
    
  } catch (error) {
    console.error('Error getting available VAT rates:', error.message);
    return {
      success: false,
      errors: { general: 'Failed to get available VAT rates' }
    };
  }
}

module.exports = {
  // Main breakdown functions
  getBoxBreakdown,
  getFullVatReturnBreakdown,
  getBreakdownByVatRate,
  getAvailableVatRates,
  
  // Individual box breakdowns (for testing)
  getBox1Breakdown,
  getBox4Breakdown,
  getBox6Breakdown,
  getBox7Breakdown,
  
  // Transaction fetching (for testing)
  getIncomeTransactionsForBreakdown,
  getExpenseTransactionsForBreakdown,
  getSalesInvoicesForBreakdown,
  
  // Utility functions
  calculateSummaryByVatRate,
  validateBreakdownParams,
  getVatRateName,
  formatCurrency,
  
  // Constants
  VAT_RATE_NAMES,
  BOX_DESCRIPTIONS
};
