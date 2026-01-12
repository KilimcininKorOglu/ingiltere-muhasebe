/**
 * PAYE Summary Service
 * 
 * Provides PAYE (Pay As You Earn) summary report calculations for payroll
 * including total payroll costs, tax liabilities, and HMRC payment deadlines.
 * 
 * @module services/payeSummaryService
 */

const { query, queryOne } = require('../database/index');

/**
 * UK HMRC payment deadline rules:
 * - Monthly payers: 22nd of following month (17th for cheque/post)
 * - Quarterly payers (small employers): 22nd of the month after quarter end
 * 
 * For electronic payments: 22nd of the month
 * For cheque/postal payments: 19th of the month
 */
const PAYMENT_DEADLINE_DAY_ELECTRONIC = 22;
const PAYMENT_DEADLINE_DAY_POSTAL = 19;

/**
 * Calculates the HMRC payment deadline for a given month.
 * Payment is due by the 22nd of the following month for electronic payments.
 * 
 * @param {number} year - The tax year
 * @param {number} month - The month (1-12)
 * @param {boolean} [isElectronic=true] - Whether payment is electronic
 * @returns {string} Payment deadline date in YYYY-MM-DD format
 */
function calculatePaymentDeadline(year, month, isElectronic = true) {
  // Payment is due in the following month
  let deadlineMonth = month + 1;
  let deadlineYear = year;
  
  if (deadlineMonth > 12) {
    deadlineMonth = 1;
    deadlineYear++;
  }
  
  const deadlineDay = isElectronic ? PAYMENT_DEADLINE_DAY_ELECTRONIC : PAYMENT_DEADLINE_DAY_POSTAL;
  
  // Handle months with fewer days
  const daysInMonth = new Date(deadlineYear, deadlineMonth, 0).getDate();
  const actualDay = Math.min(deadlineDay, daysInMonth);
  
  return `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}

/**
 * Calculates the UK tax year for a given date.
 * UK tax year runs from April 6th to April 5th of the following year.
 * 
 * @param {Date|string} date - The date to check
 * @returns {string} Tax year in 'YYYY-YY' format (e.g., '2025-26')
 */
function getTaxYearForDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 0-indexed
  const day = d.getDate();
  
  // Before April 6th = previous tax year
  if (month < 4 || (month === 4 && day < 6)) {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
  
  return `${year}-${String(year + 1).slice(-2)}`;
}

/**
 * Gets the start and end dates for a UK tax year.
 * 
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {{startDate: string, endDate: string}} Tax year date range
 */
function getTaxYearDates(taxYear) {
  const [startYear] = taxYear.split('-').map(Number);
  
  return {
    startDate: `${startYear}-04-06`,
    endDate: `${startYear + 1}-04-05`
  };
}

/**
 * Generates a PAYE summary report for a given user and period.
 * 
 * @param {number} userId - The user ID (employer)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{
 *   period: {startDate: string, endDate: string, taxYear: string},
 *   totals: {
 *     grossPay: number,
 *     taxableIncome: number,
 *     incomeTax: number,
 *     employeeNI: number,
 *     employerNI: number,
 *     totalNI: number,
 *     studentLoanDeductions: number,
 *     pensionEmployeeContributions: number,
 *     pensionEmployerContributions: number,
 *     netPay: number,
 *     totalPayrollCost: number
 *   },
 *   hmrcLiability: {
 *     paye: number,
 *     employeeNI: number,
 *     employerNI: number,
 *     studentLoans: number,
 *     totalLiability: number,
 *     paymentDeadline: string
 *   },
 *   employeeBreakdown: Array<{
 *     employeeId: number,
 *     employeeNumber: string,
 *     firstName: string,
 *     lastName: string,
 *     grossPay: number,
 *     incomeTax: number,
 *     employeeNI: number,
 *     employerNI: number,
 *     netPay: number,
 *     entriesCount: number
 *   }>,
 *   monthlySummary: Array<{
 *     month: string,
 *     year: number,
 *     grossPay: number,
 *     incomeTax: number,
 *     employeeNI: number,
 *     employerNI: number,
 *     totalLiability: number,
 *     paymentDeadline: string,
 *     entriesCount: number
 *   }>,
 *   entriesCount: number
 * }}
 */
function generatePayeSummary(userId, startDate, endDate) {
  // Get the tax year for the period
  const taxYear = getTaxYearForDate(startDate);
  
  // Query total payroll figures for the period
  const totalsResult = queryOne(`
    SELECT 
      COALESCE(SUM(grossPay), 0) as totalGrossPay,
      COALESCE(SUM(taxableIncome), 0) as totalTaxableIncome,
      COALESCE(SUM(incomeTax), 0) as totalIncomeTax,
      COALESCE(SUM(employeeNI), 0) as totalEmployeeNI,
      COALESCE(SUM(employerNI), 0) as totalEmployerNI,
      COALESCE(SUM(studentLoanDeduction), 0) as totalStudentLoanDeductions,
      COALESCE(SUM(pensionEmployeeContribution), 0) as totalPensionEmployee,
      COALESCE(SUM(pensionEmployerContribution), 0) as totalPensionEmployer,
      COALESCE(SUM(netPay), 0) as totalNetPay,
      COUNT(*) as entriesCount
    FROM payroll_entries 
    WHERE userId = ? 
      AND payDate >= ? 
      AND payDate <= ? 
      AND status != 'cancelled'
  `, [userId, startDate, endDate]);

  const totals = {
    grossPay: totalsResult?.totalGrossPay || 0,
    taxableIncome: totalsResult?.totalTaxableIncome || 0,
    incomeTax: totalsResult?.totalIncomeTax || 0,
    employeeNI: totalsResult?.totalEmployeeNI || 0,
    employerNI: totalsResult?.totalEmployerNI || 0,
    totalNI: (totalsResult?.totalEmployeeNI || 0) + (totalsResult?.totalEmployerNI || 0),
    studentLoanDeductions: totalsResult?.totalStudentLoanDeductions || 0,
    pensionEmployeeContributions: totalsResult?.totalPensionEmployee || 0,
    pensionEmployerContributions: totalsResult?.totalPensionEmployer || 0,
    netPay: totalsResult?.totalNetPay || 0,
    // Total payroll cost = gross pay + employer NI + employer pension
    totalPayrollCost: (totalsResult?.totalGrossPay || 0) + 
                      (totalsResult?.totalEmployerNI || 0) + 
                      (totalsResult?.totalPensionEmployer || 0)
  };

  // HMRC Liability calculation
  // HMRC receives: PAYE (income tax) + Employee NI + Employer NI + Student Loans
  const hmrcLiability = {
    paye: totals.incomeTax,
    employeeNI: totals.employeeNI,
    employerNI: totals.employerNI,
    studentLoans: totals.studentLoanDeductions,
    totalLiability: totals.incomeTax + totals.employeeNI + totals.employerNI + totals.studentLoanDeductions,
    paymentDeadline: calculatePaymentDeadlineForPeriod(endDate)
  };

  // Employee breakdown
  const employeeBreakdown = query(`
    SELECT 
      pe.employeeId,
      e.employeeNumber,
      e.firstName,
      e.lastName,
      COALESCE(SUM(pe.grossPay), 0) as grossPay,
      COALESCE(SUM(pe.incomeTax), 0) as incomeTax,
      COALESCE(SUM(pe.employeeNI), 0) as employeeNI,
      COALESCE(SUM(pe.employerNI), 0) as employerNI,
      COALESCE(SUM(pe.studentLoanDeduction), 0) as studentLoanDeduction,
      COALESCE(SUM(pe.pensionEmployeeContribution), 0) as pensionEmployeeContribution,
      COALESCE(SUM(pe.pensionEmployerContribution), 0) as pensionEmployerContribution,
      COALESCE(SUM(pe.netPay), 0) as netPay,
      COUNT(*) as entriesCount
    FROM payroll_entries pe
    LEFT JOIN employees e ON pe.employeeId = e.id
    WHERE pe.userId = ? 
      AND pe.payDate >= ? 
      AND pe.payDate <= ? 
      AND pe.status != 'cancelled'
    GROUP BY pe.employeeId
    ORDER BY e.lastName, e.firstName
  `, [userId, startDate, endDate]);

  // Monthly summary
  const monthlySummary = query(`
    SELECT 
      strftime('%Y', payDate) as year,
      strftime('%m', payDate) as month,
      COALESCE(SUM(grossPay), 0) as grossPay,
      COALESCE(SUM(incomeTax), 0) as incomeTax,
      COALESCE(SUM(employeeNI), 0) as employeeNI,
      COALESCE(SUM(employerNI), 0) as employerNI,
      COALESCE(SUM(studentLoanDeduction), 0) as studentLoanDeduction,
      COUNT(*) as entriesCount
    FROM payroll_entries 
    WHERE userId = ? 
      AND payDate >= ? 
      AND payDate <= ? 
      AND status != 'cancelled'
    GROUP BY strftime('%Y', payDate), strftime('%m', payDate)
    ORDER BY year, month
  `, [userId, startDate, endDate]);

  // Enhance monthly summary with payment deadlines and total liability
  const enhancedMonthlySummary = monthlySummary.map(row => {
    const year = parseInt(row.year, 10);
    const month = parseInt(row.month, 10);
    const totalLiability = row.incomeTax + row.employeeNI + row.employerNI + row.studentLoanDeduction;
    
    return {
      month: row.month,
      year,
      monthName: getMonthName(month),
      grossPay: row.grossPay,
      incomeTax: row.incomeTax,
      employeeNI: row.employeeNI,
      employerNI: row.employerNI,
      studentLoanDeduction: row.studentLoanDeduction,
      totalLiability,
      paymentDeadline: calculatePaymentDeadline(year, month),
      entriesCount: row.entriesCount
    };
  });

  return {
    period: {
      startDate,
      endDate,
      taxYear
    },
    totals,
    hmrcLiability,
    employeeBreakdown: employeeBreakdown.map(emp => ({
      employeeId: emp.employeeId,
      employeeNumber: emp.employeeNumber,
      firstName: emp.firstName,
      lastName: emp.lastName,
      grossPay: emp.grossPay,
      incomeTax: emp.incomeTax,
      employeeNI: emp.employeeNI,
      employerNI: emp.employerNI,
      studentLoanDeduction: emp.studentLoanDeduction,
      pensionEmployeeContribution: emp.pensionEmployeeContribution,
      pensionEmployerContribution: emp.pensionEmployerContribution,
      netPay: emp.netPay,
      entriesCount: emp.entriesCount
    })),
    monthlySummary: enhancedMonthlySummary,
    entriesCount: totalsResult?.entriesCount || 0
  };
}

/**
 * Calculates the HMRC payment deadline for the end of a period.
 * 
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string} Payment deadline in YYYY-MM-DD format
 */
function calculatePaymentDeadlineForPeriod(endDate) {
  const d = new Date(endDate);
  return calculatePaymentDeadline(d.getFullYear(), d.getMonth() + 1);
}

/**
 * Gets the English name for a month.
 * 
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
function getMonthName(month) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1] || '';
}

/**
 * Generates a PAYE summary for a specific tax year.
 * 
 * @param {number} userId - The user ID (employer)
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {Object} PAYE summary for the tax year
 */
function generatePayeSummaryForTaxYear(userId, taxYear) {
  const { startDate, endDate } = getTaxYearDates(taxYear);
  return generatePayeSummary(userId, startDate, endDate);
}

/**
 * Generates a PAYE summary for a specific month.
 * 
 * @param {number} userId - The user ID (employer)
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {Object} PAYE summary for the month
 */
function generatePayeSummaryForMonth(userId, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generatePayeSummary(userId, startDate, endDate);
}

/**
 * Validates date range for PAYE summary.
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
function validateDateRange(startDate, endDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!startDate || !dateRegex.test(startDate)) {
    return { isValid: false, error: 'Invalid start date format (YYYY-MM-DD required)' };
  }
  
  if (!endDate || !dateRegex.test(endDate)) {
    return { isValid: false, error: 'Invalid end date format (YYYY-MM-DD required)' };
  }
  
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
  
  return { isValid: true };
}

module.exports = {
  // Main report generation
  generatePayeSummary,
  generatePayeSummaryForTaxYear,
  generatePayeSummaryForMonth,
  
  // Utility functions
  calculatePaymentDeadline,
  calculatePaymentDeadlineForPeriod,
  getTaxYearForDate,
  getTaxYearDates,
  getMonthName,
  validateDateRange,
  
  // Constants
  PAYMENT_DEADLINE_DAY_ELECTRONIC,
  PAYMENT_DEADLINE_DAY_POSTAL
};
