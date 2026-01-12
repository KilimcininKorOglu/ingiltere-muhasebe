/**
 * CSV Generator Service
 * Generates CSV exports for financial reports with proper character encoding
 * and support for special characters commonly found in UK/Turkish data.
 * 
 * Features:
 * - Bilingual column headers (English/Turkish)
 * - Proper handling of special characters (Turkish İ, ğ, ş, etc.)
 * - BOM prefix for Excel compatibility
 * - Consistent currency formatting
 * 
 * @module services/csvGenerator
 */

/**
 * UTF-8 BOM (Byte Order Mark) for Excel compatibility
 * This ensures Excel properly recognizes UTF-8 encoding
 */
const UTF8_BOM = '\uFEFF';

/**
 * Escapes a value for CSV format.
 * - Wraps in quotes if value contains comma, quote, or newline
 * - Doubles any existing quotes
 * - Handles null/undefined
 * 
 * @param {*} value - Value to escape
 * @returns {string} CSV-safe escaped value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if escaping is needed
  if (stringValue.includes(',') || stringValue.includes('"') || 
      stringValue.includes('\n') || stringValue.includes('\r')) {
    // Double up any quotes and wrap in quotes
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  
  return stringValue;
}

/**
 * Formats an amount from pence to pounds with 2 decimal places.
 * 
 * @param {number} amountInPence - Amount in pence
 * @returns {string} Formatted amount (e.g., "1234.56")
 */
function formatAmount(amountInPence) {
  if (amountInPence === null || amountInPence === undefined) {
    return '0.00';
  }
  return (amountInPence / 100).toFixed(2);
}

/**
 * Formats a percentage value.
 * 
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage (e.g., "20.00")
 */
function formatPercentage(value) {
  if (value === null || value === undefined) {
    return '0.00';
  }
  return value.toFixed(2);
}

/**
 * Formats a date for CSV display.
 * 
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (DD/MM/YYYY)
 */
function formatDate(isoDate) {
  if (!isoDate) return '';
  
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Creates a CSV row from an array of values.
 * 
 * @param {Array} values - Array of values for the row
 * @returns {string} CSV-formatted row string
 */
function createCSVRow(values) {
  return values.map(escapeCSV).join(',');
}

/**
 * Column header labels for reports in both languages.
 */
const columnLabels = {
  en: {
    // Common
    date: 'Date',
    description: 'Description',
    amount: 'Amount (£)',
    vatAmount: 'VAT (£)',
    totalAmount: 'Total (£)',
    transactionCount: 'Transaction Count',
    category: 'Category',
    categoryCode: 'Category Code',
    
    // Profit & Loss
    income: 'Income',
    expenses: 'Expenses',
    grossProfit: 'Gross Profit',
    netProfit: 'Net Profit',
    profitMargin: 'Profit Margin (%)',
    month: 'Month',
    year: 'Year',
    
    // VAT Summary
    vatRate: 'VAT Rate (%)',
    netAmount: 'Net Amount (£)',
    grossAmount: 'Gross Amount (£)',
    outputVat: 'Output VAT (£)',
    inputVat: 'Input VAT (£)',
    netVat: 'Net VAT (£)',
    refundDue: 'Refund Due',
    
    // Cash Flow
    openingBalance: 'Opening Balance (£)',
    closingBalance: 'Closing Balance (£)',
    inflows: 'Cash Inflows (£)',
    outflows: 'Cash Outflows (£)',
    netChange: 'Net Cash Change (£)',
    
    // PAYE Summary
    employee: 'Employee',
    employeeNumber: 'Employee Number',
    firstName: 'First Name',
    lastName: 'Last Name',
    grossPay: 'Gross Pay (£)',
    taxableIncome: 'Taxable Income (£)',
    incomeTax: 'Income Tax (£)',
    employeeNI: 'Employee NI (£)',
    employerNI: 'Employer NI (£)',
    studentLoan: 'Student Loan (£)',
    pensionEmployee: 'Pension (Employee) (£)',
    pensionEmployer: 'Pension (Employer) (£)',
    netPay: 'Net Pay (£)',
    totalPayrollCost: 'Total Payroll Cost (£)',
    hmrcLiability: 'HMRC Liability (£)',
    paymentDeadline: 'Payment Deadline',
    
    // Period
    period: 'Period',
    startDate: 'Start Date',
    endDate: 'End Date',
    taxYear: 'Tax Year',
    
    // Report title
    reportTitle: 'Report',
    generatedOn: 'Generated On',
    
    // Status
    yes: 'Yes',
    no: 'No'
  },
  
  tr: {
    // Common
    date: 'Tarih',
    description: 'Açıklama',
    amount: 'Tutar (£)',
    vatAmount: 'KDV (£)',
    totalAmount: 'Toplam (£)',
    transactionCount: 'İşlem Sayısı',
    category: 'Kategori',
    categoryCode: 'Kategori Kodu',
    
    // Profit & Loss
    income: 'Gelir',
    expenses: 'Giderler',
    grossProfit: 'Brüt Kar',
    netProfit: 'Net Kar',
    profitMargin: 'Kar Marjı (%)',
    month: 'Ay',
    year: 'Yıl',
    
    // VAT Summary
    vatRate: 'KDV Oranı (%)',
    netAmount: 'Net Tutar (£)',
    grossAmount: 'Brüt Tutar (£)',
    outputVat: 'Hesaplanan KDV (£)',
    inputVat: 'İndirilecek KDV (£)',
    netVat: 'Net KDV (£)',
    refundDue: 'İade Durumu',
    
    // Cash Flow
    openingBalance: 'Açılış Bakiyesi (£)',
    closingBalance: 'Kapanış Bakiyesi (£)',
    inflows: 'Nakit Girişleri (£)',
    outflows: 'Nakit Çıkışları (£)',
    netChange: 'Net Nakit Değişimi (£)',
    
    // PAYE Summary
    employee: 'Çalışan',
    employeeNumber: 'Çalışan Numarası',
    firstName: 'Ad',
    lastName: 'Soyad',
    grossPay: 'Brüt Ödeme (£)',
    taxableIncome: 'Vergiye Tabi Gelir (£)',
    incomeTax: 'Gelir Vergisi (£)',
    employeeNI: 'Çalışan Ulusal Sigorta (£)',
    employerNI: 'İşveren Ulusal Sigorta (£)',
    studentLoan: 'Öğrenci Kredisi (£)',
    pensionEmployee: 'Emeklilik (Çalışan) (£)',
    pensionEmployer: 'Emeklilik (İşveren) (£)',
    netPay: 'Net Ödeme (£)',
    totalPayrollCost: 'Toplam Bordro Maliyeti (£)',
    hmrcLiability: 'HMRC Yükümlülüğü (£)',
    paymentDeadline: 'Ödeme Son Tarihi',
    
    // Period
    period: 'Dönem',
    startDate: 'Başlangıç Tarihi',
    endDate: 'Bitiş Tarihi',
    taxYear: 'Vergi Yılı',
    
    // Report title
    reportTitle: 'Rapor',
    generatedOn: 'Oluşturulma Tarihi',
    
    // Status
    yes: 'Evet',
    no: 'Hayır'
  }
};

/**
 * Gets labels for a specific language.
 * 
 * @param {string} [lang='en'] - Language code ('en' or 'tr')
 * @returns {Object} Labels for the specified language
 */
function getLabels(lang = 'en') {
  return columnLabels[lang] || columnLabels.en;
}

/**
 * Generates CSV for a Profit & Loss report.
 * 
 * @param {Object} report - Profit & Loss report data
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code
 * @param {Object} [options.businessDetails={}] - Business details for header
 * @returns {string} CSV content
 */
function generateProfitLossCSV(report, options = {}) {
  const { lang = 'en', businessDetails = {} } = options;
  const labels = getLabels(lang);
  const rows = [];
  
  // Report header with business details
  if (businessDetails.businessName) {
    rows.push(createCSVRow([businessDetails.businessName]));
  }
  rows.push(createCSVRow([lang === 'tr' ? 'Kar/Zarar Raporu' : 'Profit & Loss Report']));
  rows.push(createCSVRow([`${labels.period}: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`]));
  rows.push(createCSVRow([`${labels.taxYear}: ${report.period.taxYear}`]));
  rows.push(createCSVRow([`${labels.generatedOn}: ${formatDate(new Date().toISOString().split('T')[0])}`]));
  rows.push(''); // Empty row
  
  // Summary section
  rows.push(createCSVRow([lang === 'tr' ? 'ÖZET' : 'SUMMARY']));
  rows.push(createCSVRow([labels.income, formatAmount(report.summary.totalRevenue)]));
  rows.push(createCSVRow([labels.expenses, formatAmount(report.summary.totalExpenses)]));
  rows.push(createCSVRow([labels.netProfit, formatAmount(report.summary.netProfit)]));
  rows.push(createCSVRow([labels.profitMargin, formatPercentage(report.summary.profitMargin)]));
  rows.push(createCSVRow([labels.transactionCount, report.summary.transactionCount]));
  rows.push(''); // Empty row
  
  // Income by category
  rows.push(createCSVRow([lang === 'tr' ? 'GELİRLER (Kategoriye Göre)' : 'INCOME (By Category)']));
  rows.push(createCSVRow([labels.categoryCode, labels.category, labels.amount, labels.vatAmount, labels.totalAmount, labels.transactionCount]));
  
  for (const cat of report.income.categories) {
    const catName = lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName;
    rows.push(createCSVRow([
      cat.categoryCode,
      catName,
      formatAmount(cat.amount),
      formatAmount(cat.vatAmount),
      formatAmount(cat.totalAmount),
      cat.transactionCount
    ]));
  }
  rows.push(createCSVRow([
    '',
    lang === 'tr' ? 'TOPLAM' : 'TOTAL',
    formatAmount(report.income.total.amount),
    formatAmount(report.income.total.vatAmount),
    formatAmount(report.income.total.totalAmount),
    report.income.total.transactionCount
  ]));
  rows.push(''); // Empty row
  
  // Expenses by category
  rows.push(createCSVRow([lang === 'tr' ? 'GİDERLER (Kategoriye Göre)' : 'EXPENSES (By Category)']));
  rows.push(createCSVRow([labels.categoryCode, labels.category, labels.amount, labels.vatAmount, labels.totalAmount, labels.transactionCount]));
  
  for (const cat of report.expenses.categories) {
    const catName = lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName;
    rows.push(createCSVRow([
      cat.categoryCode,
      catName,
      formatAmount(cat.amount),
      formatAmount(cat.vatAmount),
      formatAmount(cat.totalAmount),
      cat.transactionCount
    ]));
  }
  rows.push(createCSVRow([
    '',
    lang === 'tr' ? 'TOPLAM' : 'TOTAL',
    formatAmount(report.expenses.total.amount),
    formatAmount(report.expenses.total.vatAmount),
    formatAmount(report.expenses.total.totalAmount),
    report.expenses.total.transactionCount
  ]));
  rows.push(''); // Empty row
  
  // Monthly summary
  if (report.monthlySummary && report.monthlySummary.length > 0) {
    rows.push(createCSVRow([lang === 'tr' ? 'AYLIK ÖZET' : 'MONTHLY SUMMARY']));
    rows.push(createCSVRow([labels.year, labels.month, labels.income, labels.expenses, labels.netProfit]));
    
    for (const month of report.monthlySummary) {
      rows.push(createCSVRow([
        month.year,
        month.monthName,
        formatAmount(month.income.amount),
        formatAmount(month.expense.amount),
        formatAmount(month.netProfit)
      ]));
    }
  }
  
  return UTF8_BOM + rows.join('\r\n');
}

/**
 * Generates CSV for a VAT Summary report.
 * 
 * @param {Object} report - VAT Summary report data
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code
 * @param {Object} [options.businessDetails={}] - Business details for header
 * @returns {string} CSV content
 */
function generateVatSummaryCSV(report, options = {}) {
  const { lang = 'en', businessDetails = {} } = options;
  const labels = getLabels(lang);
  const rows = [];
  
  // Report header
  if (businessDetails.businessName) {
    rows.push(createCSVRow([businessDetails.businessName]));
  }
  rows.push(createCSVRow([lang === 'tr' ? 'KDV Özet Raporu' : 'VAT Summary Report']));
  rows.push(createCSVRow([`${labels.period}: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`]));
  rows.push(createCSVRow([`${labels.taxYear}: ${report.period.taxYear}`]));
  rows.push(createCSVRow([`${labels.generatedOn}: ${formatDate(new Date().toISOString().split('T')[0])}`]));
  rows.push(''); // Empty row
  
  // Net Position Summary
  rows.push(createCSVRow([lang === 'tr' ? 'KDV POZİSYONU' : 'VAT POSITION']));
  rows.push(createCSVRow([labels.outputVat, formatAmount(report.netPosition.outputVat)]));
  rows.push(createCSVRow([labels.inputVat, formatAmount(report.netPosition.inputVat)]));
  rows.push(createCSVRow([labels.netVat, formatAmount(report.netPosition.netVat)]));
  rows.push(createCSVRow([labels.refundDue, report.netPosition.isRefundDue ? labels.yes : labels.no]));
  rows.push(''); // Empty row
  
  // Output VAT by rate
  rows.push(createCSVRow([lang === 'tr' ? 'HESAPLANAN KDV (Orana Göre)' : 'OUTPUT VAT (By Rate)']));
  rows.push(createCSVRow([labels.vatRate, labels.netAmount, labels.vatAmount, labels.grossAmount, labels.transactionCount]));
  
  for (const rate of report.outputVat.byRate) {
    rows.push(createCSVRow([
      formatPercentage(rate.vatRatePercent),
      formatAmount(rate.netAmount),
      formatAmount(rate.vatAmount),
      formatAmount(rate.grossAmount),
      rate.transactionCount
    ]));
  }
  rows.push(createCSVRow([
    lang === 'tr' ? 'TOPLAM' : 'TOTAL',
    formatAmount(report.outputVat.totals.netAmount),
    formatAmount(report.outputVat.totals.vatAmount),
    formatAmount(report.outputVat.totals.grossAmount),
    report.outputVat.totals.transactionCount
  ]));
  rows.push(''); // Empty row
  
  // Input VAT by rate
  rows.push(createCSVRow([lang === 'tr' ? 'İNDİRİLECEK KDV (Orana Göre)' : 'INPUT VAT (By Rate)']));
  rows.push(createCSVRow([labels.vatRate, labels.netAmount, labels.vatAmount, labels.grossAmount, labels.transactionCount]));
  
  for (const rate of report.inputVat.byRate) {
    rows.push(createCSVRow([
      formatPercentage(rate.vatRatePercent),
      formatAmount(rate.netAmount),
      formatAmount(rate.vatAmount),
      formatAmount(rate.grossAmount),
      rate.transactionCount
    ]));
  }
  rows.push(createCSVRow([
    lang === 'tr' ? 'TOPLAM' : 'TOTAL',
    formatAmount(report.inputVat.totals.netAmount),
    formatAmount(report.inputVat.totals.vatAmount),
    formatAmount(report.inputVat.totals.grossAmount),
    report.inputVat.totals.transactionCount
  ]));
  rows.push(''); // Empty row
  
  // Monthly breakdown
  if (report.monthlyBreakdown && report.monthlyBreakdown.length > 0) {
    rows.push(createCSVRow([lang === 'tr' ? 'AYLIK DÖKÜM' : 'MONTHLY BREAKDOWN']));
    rows.push(createCSVRow([labels.year, labels.month, labels.outputVat, labels.inputVat, labels.netVat, labels.transactionCount]));
    
    for (const month of report.monthlyBreakdown) {
      rows.push(createCSVRow([
        month.year,
        month.monthName,
        formatAmount(month.outputVat),
        formatAmount(month.inputVat),
        formatAmount(month.netVat),
        month.totalTransactionCount
      ]));
    }
  }
  
  return UTF8_BOM + rows.join('\r\n');
}

/**
 * Generates CSV for a Cash Flow Statement.
 * 
 * @param {Object} report - Cash Flow report data
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code
 * @param {Object} [options.businessDetails={}] - Business details for header
 * @returns {string} CSV content
 */
function generateCashFlowCSV(report, options = {}) {
  const { lang = 'en', businessDetails = {} } = options;
  const labels = getLabels(lang);
  const rows = [];
  
  // Report header
  if (businessDetails.businessName) {
    rows.push(createCSVRow([businessDetails.businessName]));
  }
  rows.push(createCSVRow([lang === 'tr' ? 'Nakit Akış Tablosu' : 'Cash Flow Statement']));
  rows.push(createCSVRow([`${labels.period}: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`]));
  rows.push(createCSVRow([`${labels.taxYear}: ${report.period.taxYear}`]));
  rows.push(createCSVRow([`${labels.generatedOn}: ${formatDate(new Date().toISOString().split('T')[0])}`]));
  rows.push(''); // Empty row
  
  // Summary
  rows.push(createCSVRow([lang === 'tr' ? 'ÖZET' : 'SUMMARY']));
  rows.push(createCSVRow([labels.openingBalance, formatAmount(report.summary.openingBalance)]));
  rows.push(createCSVRow([labels.inflows, formatAmount(report.summary.totalInflows)]));
  rows.push(createCSVRow([labels.outflows, formatAmount(report.summary.totalOutflows)]));
  rows.push(createCSVRow([labels.netChange, formatAmount(report.summary.netCashChange)]));
  rows.push(createCSVRow([labels.closingBalance, formatAmount(report.summary.closingBalance)]));
  rows.push(''); // Empty row
  
  // Inflows by category
  rows.push(createCSVRow([lang === 'tr' ? 'NAKİT GİRİŞLERİ (Kategoriye Göre)' : 'CASH INFLOWS (By Category)']));
  rows.push(createCSVRow([labels.categoryCode, labels.category, labels.amount, labels.transactionCount]));
  
  for (const cat of report.inflows.categories) {
    const catName = lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName;
    rows.push(createCSVRow([
      cat.categoryCode,
      catName,
      formatAmount(cat.amount),
      cat.transactionCount
    ]));
  }
  rows.push(createCSVRow([
    '',
    lang === 'tr' ? 'TOPLAM' : 'TOTAL',
    formatAmount(report.inflows.total),
    report.inflows.transactionCount
  ]));
  rows.push(''); // Empty row
  
  // Outflows by category
  rows.push(createCSVRow([lang === 'tr' ? 'NAKİT ÇIKIŞLARI (Kategoriye Göre)' : 'CASH OUTFLOWS (By Category)']));
  rows.push(createCSVRow([labels.categoryCode, labels.category, labels.amount, labels.transactionCount]));
  
  for (const cat of report.outflows.categories) {
    const catName = lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName;
    rows.push(createCSVRow([
      cat.categoryCode,
      catName,
      formatAmount(cat.amount),
      cat.transactionCount
    ]));
  }
  rows.push(createCSVRow([
    '',
    lang === 'tr' ? 'TOPLAM' : 'TOTAL',
    formatAmount(report.outflows.total),
    report.outflows.transactionCount
  ]));
  rows.push(''); // Empty row
  
  // Monthly cash flow
  if (report.monthlyCashFlow && report.monthlyCashFlow.length > 0) {
    rows.push(createCSVRow([lang === 'tr' ? 'AYLIK NAKİT AKIŞI' : 'MONTHLY CASH FLOW']));
    rows.push(createCSVRow([labels.year, labels.month, labels.openingBalance, labels.inflows, labels.outflows, labels.closingBalance]));
    
    for (const month of report.monthlyCashFlow) {
      rows.push(createCSVRow([
        month.year,
        month.monthName,
        formatAmount(month.openingBalance),
        formatAmount(month.inflows),
        formatAmount(month.outflows),
        formatAmount(month.closingBalance)
      ]));
    }
  }
  
  return UTF8_BOM + rows.join('\r\n');
}

/**
 * Generates CSV for a PAYE Summary report.
 * 
 * @param {Object} report - PAYE Summary report data
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code
 * @param {Object} [options.businessDetails={}] - Business details for header
 * @returns {string} CSV content
 */
function generatePayeSummaryCSV(report, options = {}) {
  const { lang = 'en', businessDetails = {} } = options;
  const labels = getLabels(lang);
  const rows = [];
  
  // Report header
  if (businessDetails.businessName) {
    rows.push(createCSVRow([businessDetails.businessName]));
  }
  rows.push(createCSVRow([lang === 'tr' ? 'PAYE Özet Raporu' : 'PAYE Summary Report']));
  rows.push(createCSVRow([`${labels.period}: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`]));
  rows.push(createCSVRow([`${labels.taxYear}: ${report.period.taxYear}`]));
  rows.push(createCSVRow([`${labels.generatedOn}: ${formatDate(new Date().toISOString().split('T')[0])}`]));
  rows.push(''); // Empty row
  
  // Payroll totals
  rows.push(createCSVRow([lang === 'tr' ? 'BORDRO TOPLAMLAR' : 'PAYROLL TOTALS']));
  rows.push(createCSVRow([labels.grossPay, formatAmount(report.totals.grossPay)]));
  rows.push(createCSVRow([labels.taxableIncome, formatAmount(report.totals.taxableIncome)]));
  rows.push(createCSVRow([labels.incomeTax, formatAmount(report.totals.incomeTax)]));
  rows.push(createCSVRow([labels.employeeNI, formatAmount(report.totals.employeeNI)]));
  rows.push(createCSVRow([labels.employerNI, formatAmount(report.totals.employerNI)]));
  rows.push(createCSVRow([labels.studentLoan, formatAmount(report.totals.studentLoanDeductions)]));
  rows.push(createCSVRow([labels.pensionEmployee, formatAmount(report.totals.pensionEmployeeContributions)]));
  rows.push(createCSVRow([labels.pensionEmployer, formatAmount(report.totals.pensionEmployerContributions)]));
  rows.push(createCSVRow([labels.netPay, formatAmount(report.totals.netPay)]));
  rows.push(createCSVRow([labels.totalPayrollCost, formatAmount(report.totals.totalPayrollCost)]));
  rows.push(''); // Empty row
  
  // HMRC Liability
  rows.push(createCSVRow([lang === 'tr' ? 'HMRC YÜKÜMLÜLÜĞÜ' : 'HMRC LIABILITY']));
  rows.push(createCSVRow([lang === 'tr' ? 'PAYE (Gelir Vergisi)' : 'PAYE (Income Tax)', formatAmount(report.hmrcLiability.paye)]));
  rows.push(createCSVRow([labels.employeeNI, formatAmount(report.hmrcLiability.employeeNI)]));
  rows.push(createCSVRow([labels.employerNI, formatAmount(report.hmrcLiability.employerNI)]));
  rows.push(createCSVRow([labels.studentLoan, formatAmount(report.hmrcLiability.studentLoans)]));
  rows.push(createCSVRow([labels.hmrcLiability, formatAmount(report.hmrcLiability.totalLiability)]));
  rows.push(createCSVRow([labels.paymentDeadline, formatDate(report.hmrcLiability.paymentDeadline)]));
  rows.push(''); // Empty row
  
  // Employee breakdown
  if (report.employeeBreakdown && report.employeeBreakdown.length > 0) {
    rows.push(createCSVRow([lang === 'tr' ? 'ÇALIŞAN DÖKÜM' : 'EMPLOYEE BREAKDOWN']));
    rows.push(createCSVRow([
      labels.employeeNumber,
      labels.firstName,
      labels.lastName,
      labels.grossPay,
      labels.incomeTax,
      labels.employeeNI,
      labels.employerNI,
      labels.netPay,
      labels.transactionCount
    ]));
    
    for (const emp of report.employeeBreakdown) {
      rows.push(createCSVRow([
        emp.employeeNumber,
        emp.firstName,
        emp.lastName,
        formatAmount(emp.grossPay),
        formatAmount(emp.incomeTax),
        formatAmount(emp.employeeNI),
        formatAmount(emp.employerNI),
        formatAmount(emp.netPay),
        emp.entriesCount
      ]));
    }
  }
  rows.push(''); // Empty row
  
  // Monthly summary
  if (report.monthlySummary && report.monthlySummary.length > 0) {
    rows.push(createCSVRow([lang === 'tr' ? 'AYLIK ÖZET' : 'MONTHLY SUMMARY']));
    rows.push(createCSVRow([
      labels.year,
      labels.month,
      labels.grossPay,
      labels.incomeTax,
      labels.employeeNI,
      labels.employerNI,
      labels.hmrcLiability,
      labels.paymentDeadline
    ]));
    
    for (const month of report.monthlySummary) {
      rows.push(createCSVRow([
        month.year,
        month.monthName,
        formatAmount(month.grossPay),
        formatAmount(month.incomeTax),
        formatAmount(month.employeeNI),
        formatAmount(month.employerNI),
        formatAmount(month.totalLiability),
        formatDate(month.paymentDeadline)
      ]));
    }
  }
  
  return UTF8_BOM + rows.join('\r\n');
}

/**
 * Validates that report data is suitable for CSV generation.
 * 
 * @param {Object} report - Report data to validate
 * @param {string} reportType - Type of report ('profit-loss', 'vat-summary', 'cash-flow', 'paye-summary')
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
function validateReportForCSV(report, reportType) {
  const errors = [];
  
  if (!report) {
    errors.push('Report data is required');
    return { isValid: false, errors };
  }
  
  if (!report.period) {
    errors.push('Report period is required');
  }
  
  switch (reportType) {
    case 'profit-loss':
      if (!report.income) errors.push('Income data is required');
      if (!report.expenses) errors.push('Expenses data is required');
      if (!report.summary) errors.push('Summary data is required');
      break;
      
    case 'vat-summary':
      if (!report.outputVat) errors.push('Output VAT data is required');
      if (!report.inputVat) errors.push('Input VAT data is required');
      if (!report.netPosition) errors.push('Net position data is required');
      break;
      
    case 'cash-flow':
      if (!report.inflows) errors.push('Inflows data is required');
      if (!report.outflows) errors.push('Outflows data is required');
      if (!report.summary) errors.push('Summary data is required');
      break;
      
    case 'paye-summary':
      if (!report.totals) errors.push('Totals data is required');
      if (!report.hmrcLiability) errors.push('HMRC liability data is required');
      break;
      
    default:
      errors.push(`Unknown report type: ${reportType}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  // CSV generation functions
  generateProfitLossCSV,
  generateVatSummaryCSV,
  generateCashFlowCSV,
  generatePayeSummaryCSV,
  
  // Validation
  validateReportForCSV,
  
  // Helper functions (exported for testing)
  escapeCSV,
  formatAmount,
  formatPercentage,
  formatDate,
  createCSVRow,
  getLabels,
  
  // Constants
  UTF8_BOM
};
