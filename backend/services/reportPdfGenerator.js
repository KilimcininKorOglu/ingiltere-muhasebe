/**
 * Report PDF Generator Service
 * Generates professional UK-compliant PDF reports for financial statements.
 * 
 * Features:
 * - Bilingual support (English/Turkish)
 * - Professional formatting with company branding
 * - Consistent styling across all report types
 * 
 * Supported Reports:
 * - Profit & Loss (Income Statement)
 * - VAT Summary
 * - Cash Flow Statement
 * - PAYE Summary
 * 
 * @module services/reportPdfGenerator
 */

const PDFDocument = require('pdfkit');
const { getLabels, getMonthName, colors, fonts, layout, getVatRateName } = require('../templates/reports');
const { isoDateToUK } = require('../utils/formatters');

/**
 * Formats an amount from pence to display string with currency symbol.
 * 
 * @param {number} amountInPence - Amount in pence
 * @returns {string} Formatted amount (e.g., "£1,234.56")
 */
function formatMoney(amountInPence) {
  if (amountInPence === null || amountInPence === undefined) {
    return '£0.00';
  }
  const amount = amountInPence / 100;
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats a date for PDF display in UK format.
 * 
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Formatted date in DD/MM/YYYY format
 */
function formatPdfDate(isoDate) {
  if (!isoDate) return '';
  return isoDateToUK(isoDate) || isoDate;
}

/**
 * Formats a percentage value.
 * 
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage (e.g., "20.00%")
 */
function formatPercent(value) {
  if (value === null || value === undefined) return '0.00%';
  return `${value.toFixed(2)}%`;
}

/**
 * Draws a horizontal line.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {number} y - Y position
 * @param {Object} [options={}] - Line options
 */
function drawLine(doc, y, options = {}) {
  const {
    startX = layout.margins.left,
    endX = doc.page.width - layout.margins.right,
    color = colors.border,
    width = 0.5
  } = options;
  
  doc.strokeColor(color)
     .lineWidth(width)
     .moveTo(startX, y)
     .lineTo(endX, y)
     .stroke();
}

/**
 * Draws the report header with business details.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} reportLabels - Language-specific report labels
 * @param {Object} commonLabels - Common labels
 * @param {Object} businessDetails - Business details
 * @param {Object} period - Report period { startDate, endDate, taxYear }
 * @param {string} title - Report title
 * @param {string} [subtitle] - Report subtitle
 * @returns {number} Y position after header
 */
function drawReportHeader(doc, reportLabels, commonLabels, businessDetails, period, title, subtitle) {
  let y = layout.margins.top;
  const pageWidth = doc.page.width - layout.margins.left - layout.margins.right;
  
  // Business name
  if (businessDetails && businessDetails.businessName) {
    doc.font(fonts.bold)
       .fontSize(14)
       .fillColor(colors.primary)
       .text(businessDetails.businessName, layout.margins.left, y);
    y += 20;
    
    if (businessDetails.businessAddress) {
      doc.font(fonts.regular)
         .fontSize(9)
         .fillColor(colors.textLight)
         .text(businessDetails.businessAddress, layout.margins.left, y, { width: 300 });
      y += doc.heightOfString(businessDetails.businessAddress, { width: 300 }) + 5;
    }
    
    if (businessDetails.vatNumber) {
      doc.text(`VAT: ${businessDetails.vatNumber}`, layout.margins.left, y);
      y += 12;
    }
    
    y += 10;
  }
  
  // Report title
  doc.font(fonts.bold)
     .fontSize(layout.fontSize.title)
     .fillColor(colors.primary)
     .text(title, layout.margins.left, y);
  y += 25;
  
  if (subtitle) {
    doc.font(fonts.regular)
       .fontSize(layout.fontSize.subtitle)
       .fillColor(colors.textLight)
       .text(subtitle, layout.margins.left, y);
    y += 18;
  }
  
  // Period info box
  const boxY = y;
  const boxHeight = 50;
  
  doc.rect(layout.margins.left, boxY, pageWidth, boxHeight)
     .fillColor(colors.background)
     .fill();
  doc.rect(layout.margins.left, boxY, pageWidth, boxHeight)
     .strokeColor(colors.border)
     .stroke();
  
  let infoY = boxY + 10;
  doc.font(fonts.regular)
     .fontSize(9)
     .fillColor(colors.text);
  
  // Period dates
  doc.font(fonts.bold).text(`${commonLabels.period}:`, layout.margins.left + 10, infoY, { continued: true });
  doc.font(fonts.regular).text(` ${formatPdfDate(period.startDate)} - ${formatPdfDate(period.endDate)}`);
  infoY += 14;
  
  // Tax year
  doc.font(fonts.bold).text(`${commonLabels.taxYear}:`, layout.margins.left + 10, infoY, { continued: true });
  doc.font(fonts.regular).text(` ${period.taxYear}`);
  
  // Generated date (right side)
  const genDate = formatPdfDate(new Date().toISOString().split('T')[0]);
  doc.font(fonts.bold).text(`${commonLabels.generatedOn}:`, layout.margins.left + 250, boxY + 10, { continued: true });
  doc.font(fonts.regular).text(` ${genDate}`);
  
  y = boxY + boxHeight + layout.sectionSpacing;
  
  return y;
}

/**
 * Draws a section title.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {string} title - Section title
 * @param {number} y - Y position
 * @returns {number} Y position after title
 */
function drawSectionTitle(doc, title, y) {
  doc.font(fonts.bold)
     .fontSize(layout.fontSize.sectionTitle)
     .fillColor(colors.primary)
     .text(title, layout.margins.left, y);
  
  return y + 18;
}

/**
 * Draws a simple table with headers and data.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Array<string>} headers - Column headers
 * @param {Array<Array>} rows - Data rows
 * @param {Array<number>} columnWidths - Column widths
 * @param {number} startY - Starting Y position
 * @param {Object} [options={}] - Table options
 * @returns {number} Y position after table
 */
function drawTable(doc, headers, rows, columnWidths, startY, options = {}) {
  const { alignRight = [], showTotalsRow = false } = options;
  let y = startY;
  const leftMargin = layout.margins.left;
  const pageWidth = doc.page.width - layout.margins.left - layout.margins.right;
  
  // Calculate column positions
  let colPositions = [leftMargin];
  let totalWidth = 0;
  for (let i = 0; i < columnWidths.length - 1; i++) {
    totalWidth += columnWidths[i];
    colPositions.push(leftMargin + totalWidth);
  }
  
  // Draw header row
  doc.rect(leftMargin, y, pageWidth, layout.tableHeaderHeight)
     .fillColor(colors.primary)
     .fill();
  
  const headerY = y + 6;
  doc.font(fonts.bold)
     .fontSize(layout.fontSize.tableHeader)
     .fillColor(colors.white);
  
  for (let i = 0; i < headers.length; i++) {
    const align = alignRight.includes(i) ? 'right' : 'left';
    const width = columnWidths[i] - 5;
    doc.text(headers[i], colPositions[i] + 3, headerY, { width, align });
  }
  
  y += layout.tableHeaderHeight;
  
  // Draw data rows
  let alternateRow = false;
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const isLast = rowIdx === rows.length - 1 && showTotalsRow;
    
    // Check for page break
    if (y + layout.tableRowHeight > doc.page.height - layout.margins.bottom - 50) {
      doc.addPage();
      y = layout.margins.top;
      
      // Redraw header
      doc.rect(leftMargin, y, pageWidth, layout.tableHeaderHeight)
         .fillColor(colors.primary)
         .fill();
      
      doc.font(fonts.bold)
         .fontSize(layout.fontSize.tableHeader)
         .fillColor(colors.white);
      
      for (let i = 0; i < headers.length; i++) {
        const align = alignRight.includes(i) ? 'right' : 'left';
        const width = columnWidths[i] - 5;
        doc.text(headers[i], colPositions[i] + 3, y + 6, { width, align });
      }
      
      y += layout.tableHeaderHeight;
      alternateRow = false;
    }
    
    // Row background
    if (isLast) {
      doc.rect(leftMargin, y, pageWidth, layout.tableRowHeight)
         .fillColor(colors.headerBg)
         .fill();
    } else if (alternateRow) {
      doc.rect(leftMargin, y, pageWidth, layout.tableRowHeight)
         .fillColor(colors.background)
         .fill();
    }
    
    const rowY = y + 5;
    doc.font(isLast ? fonts.bold : fonts.regular)
       .fontSize(layout.fontSize.tableCell)
       .fillColor(colors.text);
    
    for (let i = 0; i < row.length; i++) {
      const align = alignRight.includes(i) ? 'right' : 'left';
      const width = columnWidths[i] - 5;
      doc.text(String(row[i] ?? ''), colPositions[i] + 3, rowY, { width, align });
    }
    
    y += layout.tableRowHeight;
    alternateRow = !alternateRow;
  }
  
  // Draw bottom border
  drawLine(doc, y, { color: colors.border });
  
  return y + 5;
}

/**
 * Draws key-value summary rows.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Array<{label: string, value: string, bold?: boolean, color?: string}>} items - Summary items
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after summary
 */
function drawSummary(doc, items, startY) {
  let y = startY;
  const leftMargin = layout.margins.left;
  const valueX = layout.margins.left + 200;
  
  for (const item of items) {
    doc.font(item.bold ? fonts.bold : fonts.regular)
       .fontSize(10)
       .fillColor(item.color || colors.text);
    
    doc.text(item.label, leftMargin, y);
    doc.text(item.value, valueX, y, { width: 150, align: 'right' });
    
    y += 16;
  }
  
  return y;
}

/**
 * Draws the report footer.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} footerLabels - Footer labels
 */
function drawReportFooter(doc, footerLabels) {
  const bottomY = doc.page.height - layout.margins.bottom - 20;
  
  drawLine(doc, bottomY, { color: colors.border });
  
  doc.font(fonts.italic)
     .fontSize(layout.fontSize.footer)
     .fillColor(colors.textLight)
     .text(footerLabels.disclaimer, layout.margins.left, bottomY + 8, {
       width: doc.page.width - layout.margins.left - layout.margins.right,
       align: 'center'
     });
}

/**
 * Generates a PDF for a Profit & Loss report.
 * 
 * @param {Object} report - Profit & Loss report data
 * @param {Object} businessDetails - Business details
 * @param {Object} [options={}] - Generation options
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generateProfitLossPdf(report, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const labels = getLabels(lang);
  const reportLabels = labels.profitLoss;
  const commonLabels = labels.common;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: layout.pageSize,
        margins: layout.margins,
        info: {
          Title: reportLabels.title,
          Author: businessDetails?.businessName || 'Company',
          Subject: reportLabels.title,
          Keywords: 'profit, loss, income, statement, uk, tax',
          Creator: 'UK Accounting System'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Draw header
      let y = drawReportHeader(
        doc, reportLabels, commonLabels, businessDetails,
        report.period, reportLabels.title, reportLabels.subtitle
      );
      
      // Summary section
      y = drawSectionTitle(doc, reportLabels.summarySectionTitle, y);
      y = drawSummary(doc, [
        { label: labels.income, value: formatMoney(report.summary.totalRevenue) },
        { label: labels.expenses, value: formatMoney(report.summary.totalExpenses) },
        { label: labels.netProfit, value: formatMoney(report.summary.netProfit), bold: true, 
          color: report.summary.netProfit >= 0 ? colors.positive : colors.negative },
        { label: labels.profitMargin, value: formatPercent(report.summary.profitMargin) },
        { label: commonLabels.transactionCount, value: String(report.summary.transactionCount) }
      ], y);
      
      y += layout.sectionSpacing;
      
      // Income by category
      y = drawSectionTitle(doc, reportLabels.incomeSectionTitle, y);
      
      const incomeHeaders = [commonLabels.categoryCode, commonLabels.category, commonLabels.amount, 
                            commonLabels.vatAmount, labels.common.grandTotal, commonLabels.transactionCount];
      const incomeWidths = [60, 180, 80, 70, 80, 50];
      
      const incomeRows = report.income.categories.map(cat => [
        cat.categoryCode,
        lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
        formatMoney(cat.amount),
        formatMoney(cat.vatAmount),
        formatMoney(cat.totalAmount),
        cat.transactionCount
      ]);
      incomeRows.push([
        '', commonLabels.total, formatMoney(report.income.total.amount),
        formatMoney(report.income.total.vatAmount), formatMoney(report.income.total.totalAmount),
        report.income.total.transactionCount
      ]);
      
      y = drawTable(doc, incomeHeaders, incomeRows, incomeWidths, y, 
        { alignRight: [2, 3, 4, 5], showTotalsRow: true });
      
      y += layout.sectionSpacing;
      
      // Expenses by category
      y = drawSectionTitle(doc, reportLabels.expenseSectionTitle, y);
      
      const expenseRows = report.expenses.categories.map(cat => [
        cat.categoryCode,
        lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
        formatMoney(cat.amount),
        formatMoney(cat.vatAmount),
        formatMoney(cat.totalAmount),
        cat.transactionCount
      ]);
      expenseRows.push([
        '', commonLabels.total, formatMoney(report.expenses.total.amount),
        formatMoney(report.expenses.total.vatAmount), formatMoney(report.expenses.total.totalAmount),
        report.expenses.total.transactionCount
      ]);
      
      y = drawTable(doc, incomeHeaders, expenseRows, incomeWidths, y,
        { alignRight: [2, 3, 4, 5], showTotalsRow: true });
      
      // Monthly summary on new page if needed
      if (report.monthlySummary && report.monthlySummary.length > 0) {
        if (y + 150 > doc.page.height - layout.margins.bottom) {
          doc.addPage();
          y = layout.margins.top;
        } else {
          y += layout.sectionSpacing;
        }
        
        y = drawSectionTitle(doc, reportLabels.monthlySectionTitle, y);
        
        const monthHeaders = [labels.common.date, labels.income, labels.expenses, labels.netProfit];
        const monthWidths = [150, 110, 110, 110];
        
        const monthRows = report.monthlySummary.map(m => [
          `${m.monthName} ${m.year}`,
          formatMoney(m.income.amount),
          formatMoney(m.expense.amount),
          formatMoney(m.netProfit)
        ]);
        
        y = drawTable(doc, monthHeaders, monthRows, monthWidths, y, { alignRight: [1, 2, 3] });
      }
      
      // Footer
      drawReportFooter(doc, labels.footer);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a PDF for a VAT Summary report.
 * 
 * @param {Object} report - VAT Summary report data
 * @param {Object} businessDetails - Business details
 * @param {Object} [options={}] - Generation options
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generateVatSummaryPdf(report, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const labels = getLabels(lang);
  const reportLabels = labels.vatSummary;
  const commonLabels = labels.common;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: layout.pageSize,
        margins: layout.margins,
        info: {
          Title: reportLabels.title,
          Author: businessDetails?.businessName || 'Company',
          Subject: reportLabels.title,
          Keywords: 'vat, tax, summary, uk, hmrc',
          Creator: 'UK Accounting System'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Draw header
      let y = drawReportHeader(
        doc, reportLabels, commonLabels, businessDetails,
        report.period, reportLabels.title, reportLabels.subtitle
      );
      
      // Net VAT Position Summary
      y = drawSectionTitle(doc, reportLabels.netPositionTitle, y);
      
      const netVatColor = report.netPosition.netVat >= 0 ? colors.expense : colors.income;
      const netVatLabel = report.netPosition.isRefundDue ? labels.vatRefund : labels.vatPayable;
      
      y = drawSummary(doc, [
        { label: labels.outputVat, value: formatMoney(report.netPosition.outputVat) },
        { label: labels.inputVat, value: formatMoney(report.netPosition.inputVat) },
        { label: netVatLabel, value: formatMoney(Math.abs(report.netPosition.netVat)), bold: true, color: netVatColor }
      ], y);
      
      y += layout.sectionSpacing;
      
      // Output VAT by rate
      y = drawSectionTitle(doc, reportLabels.outputVatTitle, y);
      
      const vatHeaders = [labels.vatRate, commonLabels.netAmount, commonLabels.vatAmount, 
                         commonLabels.grossAmount, commonLabels.transactionCount];
      const vatWidths = [120, 100, 100, 100, 80];
      
      const outputRows = report.outputVat.byRate.map(rate => [
        getVatRateName(rate.vatRate, lang),
        formatMoney(rate.netAmount),
        formatMoney(rate.vatAmount),
        formatMoney(rate.grossAmount),
        rate.transactionCount
      ]);
      outputRows.push([
        commonLabels.total,
        formatMoney(report.outputVat.totals.netAmount),
        formatMoney(report.outputVat.totals.vatAmount),
        formatMoney(report.outputVat.totals.grossAmount),
        report.outputVat.totals.transactionCount
      ]);
      
      y = drawTable(doc, vatHeaders, outputRows, vatWidths, y,
        { alignRight: [1, 2, 3, 4], showTotalsRow: true });
      
      y += layout.sectionSpacing;
      
      // Input VAT by rate
      y = drawSectionTitle(doc, reportLabels.inputVatTitle, y);
      
      const inputRows = report.inputVat.byRate.map(rate => [
        getVatRateName(rate.vatRate, lang),
        formatMoney(rate.netAmount),
        formatMoney(rate.vatAmount),
        formatMoney(rate.grossAmount),
        rate.transactionCount
      ]);
      inputRows.push([
        commonLabels.total,
        formatMoney(report.inputVat.totals.netAmount),
        formatMoney(report.inputVat.totals.vatAmount),
        formatMoney(report.inputVat.totals.grossAmount),
        report.inputVat.totals.transactionCount
      ]);
      
      y = drawTable(doc, vatHeaders, inputRows, vatWidths, y,
        { alignRight: [1, 2, 3, 4], showTotalsRow: true });
      
      // Monthly breakdown
      if (report.monthlyBreakdown && report.monthlyBreakdown.length > 0) {
        if (y + 150 > doc.page.height - layout.margins.bottom) {
          doc.addPage();
          y = layout.margins.top;
        } else {
          y += layout.sectionSpacing;
        }
        
        y = drawSectionTitle(doc, reportLabels.monthlyTitle, y);
        
        const monthHeaders = [commonLabels.date, labels.outputVat, labels.inputVat, labels.netVat];
        const monthWidths = [150, 110, 110, 110];
        
        const monthRows = report.monthlyBreakdown.map(m => [
          `${m.monthName} ${m.year}`,
          formatMoney(m.outputVat),
          formatMoney(m.inputVat),
          formatMoney(m.netVat)
        ]);
        
        y = drawTable(doc, monthHeaders, monthRows, monthWidths, y, { alignRight: [1, 2, 3] });
      }
      
      // Footer
      drawReportFooter(doc, labels.footer);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a PDF for a Cash Flow Statement.
 * 
 * @param {Object} report - Cash Flow report data
 * @param {Object} businessDetails - Business details
 * @param {Object} [options={}] - Generation options
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generateCashFlowPdf(report, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const labels = getLabels(lang);
  const reportLabels = labels.cashFlow;
  const commonLabels = labels.common;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: layout.pageSize,
        margins: layout.margins,
        info: {
          Title: reportLabels.title,
          Author: businessDetails?.businessName || 'Company',
          Subject: reportLabels.title,
          Keywords: 'cash flow, statement, uk, accounting',
          Creator: 'UK Accounting System'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Draw header
      let y = drawReportHeader(
        doc, reportLabels, commonLabels, businessDetails,
        report.period, reportLabels.title, reportLabels.subtitle
      );
      
      // Cash Summary
      y = drawSectionTitle(doc, reportLabels.summaryTitle, y);
      
      const netCashColor = report.summary.netCashChange >= 0 ? colors.positive : colors.negative;
      
      y = drawSummary(doc, [
        { label: labels.openingBalance, value: formatMoney(report.summary.openingBalance) },
        { label: labels.inflows, value: formatMoney(report.summary.totalInflows), color: colors.income },
        { label: labels.outflows, value: formatMoney(report.summary.totalOutflows), color: colors.expense },
        { label: labels.netCashChange, value: formatMoney(report.summary.netCashChange), bold: true, color: netCashColor },
        { label: labels.closingBalance, value: formatMoney(report.summary.closingBalance), bold: true }
      ], y);
      
      y += layout.sectionSpacing;
      
      // Cash Inflows by category
      y = drawSectionTitle(doc, reportLabels.inflowsTitle, y);
      
      const flowHeaders = [commonLabels.categoryCode, commonLabels.category, commonLabels.amount, commonLabels.transactionCount];
      const flowWidths = [80, 250, 100, 80];
      
      const inflowRows = report.inflows.categories.map(cat => [
        cat.categoryCode,
        lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
        formatMoney(cat.amount),
        cat.transactionCount
      ]);
      inflowRows.push([
        '', commonLabels.total, formatMoney(report.inflows.total), report.inflows.transactionCount
      ]);
      
      y = drawTable(doc, flowHeaders, inflowRows, flowWidths, y,
        { alignRight: [2, 3], showTotalsRow: true });
      
      y += layout.sectionSpacing;
      
      // Cash Outflows by category
      y = drawSectionTitle(doc, reportLabels.outflowsTitle, y);
      
      const outflowRows = report.outflows.categories.map(cat => [
        cat.categoryCode,
        lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
        formatMoney(cat.amount),
        cat.transactionCount
      ]);
      outflowRows.push([
        '', commonLabels.total, formatMoney(report.outflows.total), report.outflows.transactionCount
      ]);
      
      y = drawTable(doc, flowHeaders, outflowRows, flowWidths, y,
        { alignRight: [2, 3], showTotalsRow: true });
      
      // Monthly cash flow
      if (report.monthlyCashFlow && report.monthlyCashFlow.length > 0) {
        if (y + 150 > doc.page.height - layout.margins.bottom) {
          doc.addPage();
          y = layout.margins.top;
        } else {
          y += layout.sectionSpacing;
        }
        
        y = drawSectionTitle(doc, reportLabels.monthlyTitle, y);
        
        const monthHeaders = [commonLabels.date, labels.openingBalance, labels.inflows, labels.outflows, labels.closingBalance];
        const monthWidths = [100, 100, 100, 100, 100];
        
        const monthRows = report.monthlyCashFlow.map(m => [
          `${m.monthName} ${m.year}`,
          formatMoney(m.openingBalance),
          formatMoney(m.inflows),
          formatMoney(m.outflows),
          formatMoney(m.closingBalance)
        ]);
        
        y = drawTable(doc, monthHeaders, monthRows, monthWidths, y, { alignRight: [1, 2, 3, 4] });
      }
      
      // Footer
      drawReportFooter(doc, labels.footer);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a PDF for a PAYE Summary report.
 * 
 * @param {Object} report - PAYE Summary report data
 * @param {Object} businessDetails - Business details
 * @param {Object} [options={}] - Generation options
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generatePayeSummaryPdf(report, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const labels = getLabels(lang);
  const reportLabels = labels.payeSummary;
  const commonLabels = labels.common;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: layout.pageSize,
        margins: layout.margins,
        info: {
          Title: reportLabels.title,
          Author: businessDetails?.businessName || 'Company',
          Subject: reportLabels.title,
          Keywords: 'paye, payroll, tax, ni, uk, hmrc',
          Creator: 'UK Accounting System'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Draw header
      let y = drawReportHeader(
        doc, reportLabels, commonLabels, businessDetails,
        report.period, reportLabels.title, reportLabels.subtitle
      );
      
      // Payroll Totals
      y = drawSectionTitle(doc, reportLabels.payrollTotalsTitle, y);
      y = drawSummary(doc, [
        { label: labels.grossPay, value: formatMoney(report.totals.grossPay) },
        { label: labels.taxableIncome, value: formatMoney(report.totals.taxableIncome) },
        { label: labels.incomeTax, value: formatMoney(report.totals.incomeTax) },
        { label: labels.employeeNI, value: formatMoney(report.totals.employeeNI) },
        { label: labels.employerNI, value: formatMoney(report.totals.employerNI) },
        { label: labels.netPay, value: formatMoney(report.totals.netPay), bold: true },
        { label: labels.totalPayrollCost, value: formatMoney(report.totals.totalPayrollCost), bold: true }
      ], y);
      
      y += layout.sectionSpacing;
      
      // HMRC Liability
      y = drawSectionTitle(doc, reportLabels.hmrcLiabilityTitle, y);
      y = drawSummary(doc, [
        { label: labels.paye, value: formatMoney(report.hmrcLiability.paye) },
        { label: labels.employeeNI, value: formatMoney(report.hmrcLiability.employeeNI) },
        { label: labels.employerNI, value: formatMoney(report.hmrcLiability.employerNI) },
        { label: labels.studentLoan, value: formatMoney(report.hmrcLiability.studentLoans) },
        { label: labels.hmrcLiability, value: formatMoney(report.hmrcLiability.totalLiability), bold: true, color: colors.expense },
        { label: labels.paymentDeadline, value: formatPdfDate(report.hmrcLiability.paymentDeadline), bold: true }
      ], y);
      
      // Employee breakdown
      if (report.employeeBreakdown && report.employeeBreakdown.length > 0) {
        if (y + 150 > doc.page.height - layout.margins.bottom) {
          doc.addPage();
          y = layout.margins.top;
        } else {
          y += layout.sectionSpacing;
        }
        
        y = drawSectionTitle(doc, reportLabels.employeeBreakdownTitle, y);
        
        const empHeaders = [labels.employeeNumber, labels.firstName, labels.lastName, 
                          labels.grossPay, labels.incomeTax, labels.employeeNI, labels.netPay];
        const empWidths = [60, 80, 80, 80, 70, 70, 80];
        
        const empRows = report.employeeBreakdown.map(emp => [
          emp.employeeNumber,
          emp.firstName,
          emp.lastName,
          formatMoney(emp.grossPay),
          formatMoney(emp.incomeTax),
          formatMoney(emp.employeeNI),
          formatMoney(emp.netPay)
        ]);
        
        y = drawTable(doc, empHeaders, empRows, empWidths, y, { alignRight: [3, 4, 5, 6] });
      }
      
      // Monthly summary
      if (report.monthlySummary && report.monthlySummary.length > 0) {
        if (y + 150 > doc.page.height - layout.margins.bottom) {
          doc.addPage();
          y = layout.margins.top;
        } else {
          y += layout.sectionSpacing;
        }
        
        y = drawSectionTitle(doc, reportLabels.monthlyTitle, y);
        
        const monthHeaders = [commonLabels.date, labels.grossPay, labels.incomeTax, 
                             labels.employeeNI, labels.employerNI, labels.hmrcLiability];
        const monthWidths = [100, 85, 80, 80, 80, 85];
        
        const monthRows = report.monthlySummary.map(m => [
          `${m.monthName} ${m.year}`,
          formatMoney(m.grossPay),
          formatMoney(m.incomeTax),
          formatMoney(m.employeeNI),
          formatMoney(m.employerNI),
          formatMoney(m.totalLiability)
        ]);
        
        y = drawTable(doc, monthHeaders, monthRows, monthWidths, y, { alignRight: [1, 2, 3, 4, 5] });
      }
      
      // Footer
      drawReportFooter(doc, labels.footer);
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

// Import balance sheet template
const balanceSheetTemplate = require('../templates/reports/balanceSheet');

/**
 * Generates a PDF for a Balance Sheet report.
 * 
 * @param {Object} report - Balance Sheet report data
 * @param {Object} businessDetails - Business details
 * @param {Object} [options={}] - Generation options
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generateBalanceSheetPdf(report, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const bsLabels = balanceSheetTemplate.getLabels(lang);
  const mainLabels = getLabels(lang);
  const commonLabels = mainLabels.common;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: balanceSheetTemplate.layout.pageSize,
        margins: balanceSheetTemplate.layout.margins,
        info: {
          Title: bsLabels.title,
          Author: businessDetails?.businessName || 'Company',
          Subject: bsLabels.title,
          Keywords: 'balance sheet, assets, liabilities, equity, uk, accounting',
          Creator: 'UK Accounting System'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      let y = balanceSheetTemplate.layout.margins.top;
      const pageWidth = doc.page.width - balanceSheetTemplate.layout.margins.left - balanceSheetTemplate.layout.margins.right;
      
      // Draw business name
      if (businessDetails && businessDetails.businessName) {
        doc.font(balanceSheetTemplate.fonts.bold)
           .fontSize(14)
           .fillColor(balanceSheetTemplate.colors.primary)
           .text(businessDetails.businessName, balanceSheetTemplate.layout.margins.left, y);
        y += 20;
        
        if (businessDetails.businessAddress) {
          doc.font(balanceSheetTemplate.fonts.regular)
             .fontSize(9)
             .fillColor(balanceSheetTemplate.colors.textLight)
             .text(businessDetails.businessAddress, balanceSheetTemplate.layout.margins.left, y, { width: 300 });
          y += 15;
        }
        y += 10;
      }
      
      // Report title
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(balanceSheetTemplate.layout.fontSize.title)
         .fillColor(balanceSheetTemplate.colors.primary)
         .text(bsLabels.title, balanceSheetTemplate.layout.margins.left, y);
      y += 25;
      
      // Subtitle
      doc.font(balanceSheetTemplate.fonts.regular)
         .fontSize(balanceSheetTemplate.layout.fontSize.subtitle)
         .fillColor(balanceSheetTemplate.colors.textLight)
         .text(bsLabels.subtitle, balanceSheetTemplate.layout.margins.left, y);
      y += 18;
      
      // As of date box
      const boxY = y;
      const boxHeight = 40;
      
      doc.rect(balanceSheetTemplate.layout.margins.left, boxY, pageWidth, boxHeight)
         .fillColor(balanceSheetTemplate.colors.background)
         .fill();
      doc.rect(balanceSheetTemplate.layout.margins.left, boxY, pageWidth, boxHeight)
         .strokeColor(balanceSheetTemplate.colors.border)
         .stroke();
      
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(10)
         .fillColor(balanceSheetTemplate.colors.primary)
         .text(`${bsLabels.asOfDate}:`, balanceSheetTemplate.layout.margins.left + 10, boxY + 8);
      doc.font(balanceSheetTemplate.fonts.regular)
         .fillColor(balanceSheetTemplate.colors.text)
         .text(formatPdfDate(report.asOfDate), balanceSheetTemplate.layout.margins.left + 100, boxY + 8);
      
      doc.font(balanceSheetTemplate.fonts.bold)
         .text(`${bsLabels.generatedOn}:`, balanceSheetTemplate.layout.margins.left + 10, boxY + 24);
      doc.font(balanceSheetTemplate.fonts.regular)
         .text(formatPdfDate(new Date().toISOString().split('T')[0]), balanceSheetTemplate.layout.margins.left + 100, boxY + 24);
      
      y = boxY + boxHeight + balanceSheetTemplate.layout.sectionSpacing;
      
      // ==================== ASSETS SECTION ====================
      y = drawSectionTitle(doc, bsLabels.assetsSectionTitle, y);
      
      const headers = [bsLabels.categoryCode, bsLabels.category, bsLabels.amount];
      const widths = [80, 320, 100];
      
      // Current Assets subsection
      if (report.assets.currentAssets && report.assets.currentAssets.categories.length > 0) {
        doc.font(balanceSheetTemplate.fonts.bold)
           .fontSize(10)
           .fillColor(balanceSheetTemplate.colors.assets)
           .text(bsLabels.currentAssets, balanceSheetTemplate.layout.margins.left, y);
        y += 16;
        
        const currentAssetRows = report.assets.currentAssets.categories.map(cat => [
          cat.categoryCode,
          lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
          formatMoney(cat.amount)
        ]);
        currentAssetRows.push(['', commonLabels.subtotal, formatMoney(report.assets.currentAssets.total)]);
        
        y = drawTable(doc, headers, currentAssetRows, widths, y, { alignRight: [2], showTotalsRow: true });
        y += 10;
      }
      
      // Fixed Assets subsection
      if (report.assets.fixedAssets && report.assets.fixedAssets.categories.length > 0) {
        doc.font(balanceSheetTemplate.fonts.bold)
           .fontSize(10)
           .fillColor(balanceSheetTemplate.colors.assets)
           .text(bsLabels.fixedAssets, balanceSheetTemplate.layout.margins.left, y);
        y += 16;
        
        const fixedAssetRows = report.assets.fixedAssets.categories.map(cat => [
          cat.categoryCode,
          lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
          formatMoney(cat.amount)
        ]);
        fixedAssetRows.push(['', commonLabels.subtotal, formatMoney(report.assets.fixedAssets.total)]);
        
        y = drawTable(doc, headers, fixedAssetRows, widths, y, { alignRight: [2], showTotalsRow: true });
        y += 10;
      }
      
      // Total Assets
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(11)
         .fillColor(balanceSheetTemplate.colors.primary)
         .text(bsLabels.totalAssets, balanceSheetTemplate.layout.margins.left, y);
      doc.text(formatMoney(report.assets.total), balanceSheetTemplate.layout.margins.left + 400, y, { width: 100, align: 'right' });
      y += 20;
      
      drawLine(doc, y - 5, { color: balanceSheetTemplate.colors.primary, width: 1 });
      y += balanceSheetTemplate.layout.sectionSpacing;
      
      // ==================== LIABILITIES SECTION ====================
      y = drawSectionTitle(doc, bsLabels.liabilitiesSectionTitle, y);
      
      // Current Liabilities
      if (report.liabilities.currentLiabilities && report.liabilities.currentLiabilities.categories.length > 0) {
        doc.font(balanceSheetTemplate.fonts.bold)
           .fontSize(10)
           .fillColor(balanceSheetTemplate.colors.liabilities)
           .text(bsLabels.currentLiabilities, balanceSheetTemplate.layout.margins.left, y);
        y += 16;
        
        const currentLiabRows = report.liabilities.currentLiabilities.categories.map(cat => [
          cat.categoryCode,
          lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
          formatMoney(cat.amount)
        ]);
        currentLiabRows.push(['', commonLabels.subtotal, formatMoney(report.liabilities.currentLiabilities.total)]);
        
        y = drawTable(doc, headers, currentLiabRows, widths, y, { alignRight: [2], showTotalsRow: true });
        y += 10;
      }
      
      // Long-term Liabilities
      if (report.liabilities.longTermLiabilities && report.liabilities.longTermLiabilities.categories.length > 0) {
        doc.font(balanceSheetTemplate.fonts.bold)
           .fontSize(10)
           .fillColor(balanceSheetTemplate.colors.liabilities)
           .text(bsLabels.longTermLiabilities, balanceSheetTemplate.layout.margins.left, y);
        y += 16;
        
        const longTermLiabRows = report.liabilities.longTermLiabilities.categories.map(cat => [
          cat.categoryCode,
          lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
          formatMoney(cat.amount)
        ]);
        longTermLiabRows.push(['', commonLabels.subtotal, formatMoney(report.liabilities.longTermLiabilities.total)]);
        
        y = drawTable(doc, headers, longTermLiabRows, widths, y, { alignRight: [2], showTotalsRow: true });
        y += 10;
      }
      
      // Total Liabilities
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(11)
         .fillColor(balanceSheetTemplate.colors.primary)
         .text(bsLabels.totalLiabilities, balanceSheetTemplate.layout.margins.left, y);
      doc.text(formatMoney(report.liabilities.total), balanceSheetTemplate.layout.margins.left + 400, y, { width: 100, align: 'right' });
      y += 20;
      
      drawLine(doc, y - 5, { color: balanceSheetTemplate.colors.primary, width: 1 });
      y += balanceSheetTemplate.layout.sectionSpacing;
      
      // ==================== EQUITY SECTION ====================
      // Check for page break
      if (y + 150 > doc.page.height - balanceSheetTemplate.layout.margins.bottom) {
        doc.addPage();
        y = balanceSheetTemplate.layout.margins.top;
      }
      
      y = drawSectionTitle(doc, bsLabels.equitySectionTitle, y);
      
      // Equity categories
      if (report.equity.categories && report.equity.categories.length > 0) {
        const equityRows = report.equity.categories.map(cat => [
          cat.categoryCode,
          lang === 'tr' ? (cat.categoryNameTr || cat.categoryName) : cat.categoryName,
          formatMoney(cat.amount)
        ]);
        
        // Add retained earnings / current period earnings if present
        if (report.equity.retainedEarnings !== undefined) {
          equityRows.push(['', bsLabels.retainedEarnings, formatMoney(report.equity.retainedEarnings)]);
        }
        if (report.equity.currentPeriodEarnings !== undefined) {
          equityRows.push(['', bsLabels.currentPeriodEarnings, formatMoney(report.equity.currentPeriodEarnings)]);
        }
        
        y = drawTable(doc, headers, equityRows, widths, y, { alignRight: [2] });
        y += 10;
      }
      
      // Total Equity
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(11)
         .fillColor(balanceSheetTemplate.colors.primary)
         .text(bsLabels.totalEquity, balanceSheetTemplate.layout.margins.left, y);
      doc.text(formatMoney(report.equity.total), balanceSheetTemplate.layout.margins.left + 400, y, { width: 100, align: 'right' });
      y += 20;
      
      drawLine(doc, y - 5, { color: balanceSheetTemplate.colors.primary, width: 1 });
      y += balanceSheetTemplate.layout.sectionSpacing;
      
      // ==================== BALANCE CHECK ====================
      const totalLiabilitiesEquity = (report.liabilities.total || 0) + (report.equity.total || 0);
      const isBalanced = report.assets.total === totalLiabilitiesEquity;
      const balanceColor = isBalanced ? balanceSheetTemplate.colors.balanced : balanceSheetTemplate.colors.notBalanced;
      
      // Summary box
      const summaryBoxY = y;
      const summaryBoxHeight = 70;
      
      doc.rect(balanceSheetTemplate.layout.margins.left, summaryBoxY, pageWidth, summaryBoxHeight)
         .fillColor(isBalanced ? '#e6f7ed' : '#fef2f2')
         .fill();
      
      doc.rect(balanceSheetTemplate.layout.margins.left, summaryBoxY, pageWidth, summaryBoxHeight)
         .strokeColor(balanceColor)
         .lineWidth(2)
         .stroke();
      
      let summaryY = summaryBoxY + 10;
      
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(11)
         .fillColor(balanceSheetTemplate.colors.primary)
         .text(bsLabels.totalAssets, balanceSheetTemplate.layout.margins.left + 15, summaryY);
      doc.text(formatMoney(report.assets.total), balanceSheetTemplate.layout.margins.left + 200, summaryY, { width: 100, align: 'right' });
      
      summaryY += 18;
      doc.text(bsLabels.totalLiabilitiesAndEquity, balanceSheetTemplate.layout.margins.left + 15, summaryY);
      doc.text(formatMoney(totalLiabilitiesEquity), balanceSheetTemplate.layout.margins.left + 200, summaryY, { width: 100, align: 'right' });
      
      summaryY += 22;
      doc.font(balanceSheetTemplate.fonts.bold)
         .fontSize(12)
         .fillColor(balanceColor)
         .text(bsLabels.balanceCheck + ': ' + (isBalanced ? bsLabels.balanced : bsLabels.notBalanced), 
           balanceSheetTemplate.layout.margins.left + 15, summaryY);
      
      if (!isBalanced) {
        const discrepancy = report.assets.total - totalLiabilitiesEquity;
        doc.text(`${bsLabels.discrepancy}: ${formatMoney(discrepancy)}`, 
          balanceSheetTemplate.layout.margins.left + 300, summaryY);
      }
      
      // Footer
      const bottomY = doc.page.height - balanceSheetTemplate.layout.margins.bottom - 20;
      
      drawLine(doc, bottomY, { color: balanceSheetTemplate.colors.border });
      
      doc.font(balanceSheetTemplate.fonts.italic)
         .fontSize(balanceSheetTemplate.layout.fontSize.footer)
         .fillColor(balanceSheetTemplate.colors.textLight)
         .text(bsLabels.footer.disclaimer, balanceSheetTemplate.layout.margins.left, bottomY + 8, {
           width: pageWidth,
           align: 'center'
         });
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates that report data is suitable for PDF generation.
 * 
 * @param {Object} report - Report data to validate
 * @param {string} reportType - Type of report
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
function validateReportForPdf(report, reportType) {
  const errors = [];
  
  if (!report) {
    errors.push('Report data is required');
    return { isValid: false, errors };
  }
  
  if (!report.period && reportType !== 'balance-sheet') {
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
    
    case 'balance-sheet':
      if (!report.asOfDate) errors.push('As of date is required');
      if (!report.assets) errors.push('Assets data is required');
      if (!report.liabilities) errors.push('Liabilities data is required');
      if (!report.equity) errors.push('Equity data is required');
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
  // PDF generation functions
  generateProfitLossPdf,
  generateVatSummaryPdf,
  generateCashFlowPdf,
  generatePayeSummaryPdf,
  generateBalanceSheetPdf,
  
  // Validation
  validateReportForPdf,
  
  // Helper functions (exported for testing)
  formatMoney,
  formatPdfDate,
  formatPercent
};
