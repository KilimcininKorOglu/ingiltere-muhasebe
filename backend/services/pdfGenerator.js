/**
 * PDF Generator Service
 * Generates professional UK-compliant invoice PDFs.
 * 
 * Features:
 * - Bilingual support (English/Turkish)
 * - UK VAT compliance with rate breakdown
 * - Professional formatting with company branding
 * - All required UK invoice fields
 * 
 * @module services/pdfGenerator
 */

const PDFDocument = require('pdfkit');
const { 
  getLabels, 
  getCurrencySymbol, 
  getVatRateName, 
  getStatusLabel,
  getStatusColor,
  colors,
  fonts,
  layout
} = require('../templates/invoice');
const { formatDate, formatCurrency, isoDateToUK } = require('../utils/formatters');

/**
 * Formats a monetary amount from pence to display string with currency symbol.
 * 
 * @param {number} amountInPence - Amount in pence
 * @param {string} [currency='GBP'] - Currency code
 * @returns {string} Formatted amount (e.g., "£123.45")
 */
function formatMoney(amountInPence, currency = 'GBP') {
  const amount = amountInPence / 100;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
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
 * Draws a horizontal line.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {number} y - Y position
 * @param {Object} [options={}] - Line options
 * @param {number} [options.startX] - Starting X position
 * @param {number} [options.endX] - Ending X position
 * @param {string} [options.color] - Line color
 * @param {number} [options.width] - Line width
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
 * Draws invoice header with company details and invoice info.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} invoice - Invoice data
 * @param {Object} businessDetails - Business/company details
 * @param {Object} labels - Language-specific labels
 * @returns {number} Y position after header
 */
function drawHeader(doc, invoice, businessDetails, labels) {
  let y = layout.margins.top;
  const pageWidth = doc.page.width - layout.margins.left - layout.margins.right;
  const rightColumnX = doc.page.width - layout.margins.right - 200;
  
  // Title
  doc.font(fonts.bold)
     .fontSize(24)
     .fillColor(colors.primary)
     .text(invoice.vatAmount > 0 ? labels.taxInvoice : labels.title, layout.margins.left, y);
  
  y += 40;
  
  // Company name (From section)
  doc.font(fonts.bold)
     .fontSize(14)
     .fillColor(colors.primary)
     .text(businessDetails.businessName || businessDetails.name || 'Company Name', layout.margins.left, y);
  
  y += 20;
  
  // Company address
  if (businessDetails.businessAddress) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.text)
       .text(businessDetails.businessAddress, layout.margins.left, y, { width: 250 });
    y += doc.heightOfString(businessDetails.businessAddress, { width: 250 }) + 5;
  }
  
  // Company VAT number
  if (businessDetails.vatNumber) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.textLight)
       .text(`${labels.vatNumber}: ${businessDetails.vatNumber}`, layout.margins.left, y);
    y += 12;
  }
  
  // Company number
  if (businessDetails.companyNumber) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.textLight)
       .text(`${labels.companyNumber}: ${businessDetails.companyNumber}`, layout.margins.left, y);
    y += 12;
  }
  
  // Email
  if (businessDetails.email) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.textLight)
       .text(`${labels.email}: ${businessDetails.email}`, layout.margins.left, y);
    y += 12;
  }
  
  // Right side - Invoice details box
  const boxY = layout.margins.top + 35;
  const boxWidth = 210;
  const boxHeight = 100;
  
  // Draw box background
  doc.rect(rightColumnX - 10, boxY, boxWidth, boxHeight)
     .fillColor(colors.background)
     .fill();
  
  // Draw box border
  doc.rect(rightColumnX - 10, boxY, boxWidth, boxHeight)
     .strokeColor(colors.border)
     .lineWidth(1)
     .stroke();
  
  let boxContentY = boxY + 10;
  
  // Invoice number
  doc.font(fonts.bold)
     .fontSize(10)
     .fillColor(colors.primary)
     .text(labels.invoiceNumber, rightColumnX, boxContentY);
  doc.font(fonts.regular)
     .fillColor(colors.text)
     .text(invoice.invoiceNumber, rightColumnX + 100, boxContentY);
  boxContentY += 16;
  
  // Invoice date
  doc.font(fonts.bold)
     .fillColor(colors.primary)
     .text(labels.invoiceDate, rightColumnX, boxContentY);
  doc.font(fonts.regular)
     .fillColor(colors.text)
     .text(formatPdfDate(invoice.issueDate), rightColumnX + 100, boxContentY);
  boxContentY += 16;
  
  // Due date
  doc.font(fonts.bold)
     .fillColor(colors.primary)
     .text(labels.dueDate, rightColumnX, boxContentY);
  doc.font(fonts.regular)
     .fillColor(colors.text)
     .text(formatPdfDate(invoice.dueDate), rightColumnX + 100, boxContentY);
  boxContentY += 16;
  
  // Tax point (if different from invoice date)
  if (invoice.taxPoint && invoice.taxPoint !== invoice.issueDate) {
    doc.font(fonts.bold)
       .fillColor(colors.primary)
       .text(labels.taxPoint, rightColumnX, boxContentY);
    doc.font(fonts.regular)
       .fillColor(colors.text)
       .text(formatPdfDate(invoice.taxPoint), rightColumnX + 100, boxContentY);
    boxContentY += 16;
  }
  
  // Status badge
  const statusColor = getStatusColor(invoice.status);
  const statusText = labels.statuses[invoice.status] || invoice.status.toUpperCase();
  
  doc.font(fonts.bold)
     .fillColor(colors.primary)
     .text(labels.status, rightColumnX, boxContentY);
  doc.font(fonts.bold)
     .fillColor(statusColor)
     .text(statusText, rightColumnX + 100, boxContentY);
  
  return Math.max(y, boxY + boxHeight) + layout.sectionSpacing;
}

/**
 * Draws customer/billing details section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} invoice - Invoice data
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after customer section
 */
function drawCustomerSection(doc, invoice, labels, startY) {
  let y = startY;
  
  // Section title
  doc.font(fonts.bold)
     .fontSize(11)
     .fillColor(colors.primary)
     .text(labels.billTo, layout.margins.left, y);
  
  y += 18;
  
  // Customer name
  doc.font(fonts.bold)
     .fontSize(10)
     .fillColor(colors.text)
     .text(invoice.customerName || 'Customer', layout.margins.left, y);
  
  y += 14;
  
  // Customer address
  if (invoice.customerAddress) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.text)
       .text(invoice.customerAddress, layout.margins.left, y, { width: 250 });
    y += doc.heightOfString(invoice.customerAddress, { width: 250 }) + 5;
  }
  
  // Customer email
  if (invoice.customerEmail) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.textLight)
       .text(`${labels.email}: ${invoice.customerEmail}`, layout.margins.left, y);
    y += 12;
  }
  
  // Customer VAT number (important for B2B transactions)
  if (invoice.customerVatNumber) {
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.textLight)
       .text(`${labels.customerVatNumber}: ${invoice.customerVatNumber}`, layout.margins.left, y);
    y += 12;
  }
  
  return y + layout.sectionSpacing;
}

/**
 * Draws the line items table.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Array} items - Invoice line items
 * @param {string} currency - Currency code
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after table
 */
function drawItemsTable(doc, items, currency, labels, startY) {
  let y = startY;
  const leftMargin = layout.margins.left;
  const pageWidth = doc.page.width - layout.margins.left - layout.margins.right;
  
  // Calculate column positions
  const cols = {
    description: leftMargin,
    quantity: leftMargin + 210,
    unitPrice: leftMargin + 270,
    vatRate: leftMargin + 350,
    vatAmount: leftMargin + 410,
    lineTotal: leftMargin + 470
  };
  
  const colWidths = {
    description: 205,
    quantity: 55,
    unitPrice: 75,
    vatRate: 55,
    vatAmount: 55,
    lineTotal: 70
  };
  
  // Draw table header
  const headerHeight = 25;
  
  doc.rect(leftMargin, y, pageWidth, headerHeight)
     .fillColor(colors.primary)
     .fill();
  
  const headerY = y + 8;
  doc.font(fonts.bold)
     .fontSize(9)
     .fillColor(colors.white)
     .text(labels.description, cols.description + 5, headerY, { width: colWidths.description })
     .text(labels.quantity, cols.quantity, headerY, { width: colWidths.quantity, align: 'center' })
     .text(labels.unitPrice, cols.unitPrice, headerY, { width: colWidths.unitPrice, align: 'right' })
     .text(labels.vatRate, cols.vatRate, headerY, { width: colWidths.vatRate, align: 'center' })
     .text(labels.vatAmount, cols.vatAmount, headerY, { width: colWidths.vatAmount, align: 'right' })
     .text(labels.lineTotal, cols.lineTotal, headerY, { width: colWidths.lineTotal, align: 'right' });
  
  y += headerHeight;
  
  // Draw line items
  const rowHeight = layout.tableRowHeight;
  let alternateRow = false;
  
  for (const item of items) {
    // Check for page break
    if (y + rowHeight > doc.page.height - layout.margins.bottom - 150) {
      doc.addPage();
      y = layout.margins.top;
      
      // Redraw header on new page
      doc.rect(leftMargin, y, pageWidth, headerHeight)
         .fillColor(colors.primary)
         .fill();
      
      doc.font(fonts.bold)
         .fontSize(9)
         .fillColor(colors.white)
         .text(labels.description, cols.description + 5, y + 8, { width: colWidths.description })
         .text(labels.quantity, cols.quantity, y + 8, { width: colWidths.quantity, align: 'center' })
         .text(labels.unitPrice, cols.unitPrice, y + 8, { width: colWidths.unitPrice, align: 'right' })
         .text(labels.vatRate, cols.vatRate, y + 8, { width: colWidths.vatRate, align: 'center' })
         .text(labels.vatAmount, cols.vatAmount, y + 8, { width: colWidths.vatAmount, align: 'right' })
         .text(labels.lineTotal, cols.lineTotal, y + 8, { width: colWidths.lineTotal, align: 'right' });
      
      y += headerHeight;
      alternateRow = false;
    }
    
    // Alternate row background
    if (alternateRow) {
      doc.rect(leftMargin, y, pageWidth, rowHeight)
         .fillColor(colors.background)
         .fill();
    }
    
    const rowY = y + 6;
    const vatRateDisplay = item.vatRatePercent !== null 
      ? `${item.vatRatePercent}%`
      : '-';
    
    doc.font(fonts.regular)
       .fontSize(9)
       .fillColor(colors.text)
       .text(item.description, cols.description + 5, rowY, { width: colWidths.description - 10 })
       .text(item.quantity, cols.quantity, rowY, { width: colWidths.quantity, align: 'center' })
       .text(formatMoney(item.unitPrice, currency), cols.unitPrice, rowY, { width: colWidths.unitPrice, align: 'right' })
       .text(vatRateDisplay, cols.vatRate, rowY, { width: colWidths.vatRate, align: 'center' })
       .text(formatMoney(item.vatAmount, currency), cols.vatAmount, rowY, { width: colWidths.vatAmount, align: 'right' })
       .text(formatMoney(item.lineTotal, currency), cols.lineTotal, rowY, { width: colWidths.lineTotal, align: 'right' });
    
    y += rowHeight;
    alternateRow = !alternateRow;
  }
  
  // Draw bottom border
  drawLine(doc, y, { color: colors.border, width: 1 });
  
  return y + 5;
}

/**
 * Calculates VAT breakdown from invoice items.
 * 
 * @param {Array} items - Invoice line items
 * @returns {Array} VAT breakdown by rate
 */
function calculateVatBreakdown(items) {
  const vatByRate = {};
  
  for (const item of items) {
    const rateKey = `${item.vatRateId || 'standard'}-${item.vatRatePercent}`;
    
    if (!vatByRate[rateKey]) {
      vatByRate[rateKey] = {
        vatRateId: item.vatRateId || 'standard',
        vatRatePercent: item.vatRatePercent,
        netAmount: 0,
        vatAmount: 0
      };
    }
    
    // Calculate net amount (line total minus VAT)
    const netAmount = item.lineTotal - item.vatAmount;
    vatByRate[rateKey].netAmount += netAmount;
    vatByRate[rateKey].vatAmount += item.vatAmount;
  }
  
  return Object.values(vatByRate).sort((a, b) => b.vatRatePercent - a.vatRatePercent);
}

/**
 * Draws the totals and VAT breakdown section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} invoice - Invoice data
 * @param {Array} items - Invoice line items
 * @param {Object} labels - Language-specific labels
 * @param {string} lang - Language code
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after totals
 */
function drawTotals(doc, invoice, items, labels, lang, startY) {
  let y = startY + 10;
  const leftMargin = layout.margins.left;
  const rightAlign = doc.page.width - layout.margins.right;
  const totalsLabelX = rightAlign - 200;
  const totalsValueX = rightAlign - 100;
  
  // Calculate VAT breakdown
  const vatBreakdown = calculateVatBreakdown(items);
  
  // Draw VAT breakdown if there are multiple rates or any VAT
  if (invoice.vatAmount > 0 && vatBreakdown.length > 0) {
    // VAT breakdown section
    doc.font(fonts.bold)
       .fontSize(10)
       .fillColor(colors.primary)
       .text(labels.vatBreakdown, leftMargin, y);
    
    y += 18;
    
    // VAT breakdown table header
    const vatTableX = leftMargin;
    const vatTableWidth = 300;
    
    doc.rect(vatTableX, y, vatTableWidth, 20)
       .fillColor(colors.headerBg)
       .fill();
    
    doc.font(fonts.bold)
       .fontSize(8)
       .fillColor(colors.text)
       .text(labels.vatRateLabel, vatTableX + 5, y + 6, { width: 100 })
       .text(labels.netAmount, vatTableX + 110, y + 6, { width: 80, align: 'right' })
       .text(labels.vatAmount, vatTableX + 200, y + 6, { width: 90, align: 'right' });
    
    y += 20;
    
    for (const breakdown of vatBreakdown) {
      const rateName = getVatRateName(breakdown.vatRateId, lang);
      
      doc.font(fonts.regular)
         .fontSize(8)
         .fillColor(colors.text)
         .text(rateName, vatTableX + 5, y + 4, { width: 100 })
         .text(formatMoney(breakdown.netAmount, invoice.currency), vatTableX + 110, y + 4, { width: 80, align: 'right' })
         .text(formatMoney(breakdown.vatAmount, invoice.currency), vatTableX + 200, y + 4, { width: 90, align: 'right' });
      
      y += 16;
    }
    
    y += 10;
  }
  
  // Totals section - right aligned
  const totalsWidth = 200;
  const totalsX = rightAlign - totalsWidth;
  
  // Subtotal
  doc.font(fonts.regular)
     .fontSize(10)
     .fillColor(colors.text)
     .text(labels.subtotal, totalsLabelX, y, { width: 100, align: 'right' });
  doc.text(formatMoney(invoice.subtotal, invoice.currency), totalsValueX, y, { width: 100, align: 'right' });
  y += 16;
  
  // Total VAT
  doc.text(labels.totalVat, totalsLabelX, y, { width: 100, align: 'right' });
  doc.text(formatMoney(invoice.vatAmount, invoice.currency), totalsValueX, y, { width: 100, align: 'right' });
  y += 18;
  
  // Draw line before grand total
  drawLine(doc, y, { startX: totalsLabelX, color: colors.primary, width: 1 });
  y += 8;
  
  // Grand total
  doc.font(fonts.bold)
     .fontSize(12)
     .fillColor(colors.primary)
     .text(labels.grandTotal, totalsLabelX, y, { width: 100, align: 'right' });
  doc.text(formatMoney(invoice.totalAmount, invoice.currency), totalsValueX, y, { width: 100, align: 'right' });
  
  return y + 30;
}

/**
 * Draws the notes section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {string} notes - Invoice notes
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after notes
 */
function drawNotes(doc, notes, labels, startY) {
  if (!notes) return startY;
  
  let y = startY;
  
  // Check for page break
  const notesHeight = doc.heightOfString(notes, { width: 400 }) + 30;
  if (y + notesHeight > doc.page.height - layout.margins.bottom - 50) {
    doc.addPage();
    y = layout.margins.top;
  }
  
  doc.font(fonts.bold)
     .fontSize(10)
     .fillColor(colors.primary)
     .text(labels.notes, layout.margins.left, y);
  
  y += 16;
  
  doc.font(fonts.regular)
     .fontSize(9)
     .fillColor(colors.text)
     .text(notes, layout.margins.left, y, { width: 400 });
  
  y += doc.heightOfString(notes, { width: 400 }) + layout.sectionSpacing;
  
  return y;
}

/**
 * Draws the footer with thank you message and generation timestamp.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} labels - Language-specific labels
 */
function drawFooter(doc, labels) {
  const bottomY = doc.page.height - layout.margins.bottom - 30;
  
  // Draw separator line
  drawLine(doc, bottomY, { color: colors.border });
  
  // Thank you message
  doc.font(fonts.italic)
     .fontSize(9)
     .fillColor(colors.textLight)
     .text(labels.thankYou, layout.margins.left, bottomY + 10, {
       width: doc.page.width - layout.margins.left - layout.margins.right,
       align: 'center'
     });
  
  // Generation timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  doc.font(fonts.regular)
     .fontSize(7)
     .fillColor(colors.textLight)
     .text(`${labels.generatedOn}: ${formatPdfDate(timestamp)}`, layout.margins.left, bottomY + 22, {
       width: doc.page.width - layout.margins.left - layout.margins.right,
       align: 'center'
     });
}

/**
 * Generates a PDF document for an invoice.
 * 
 * @param {Object} invoice - Invoice data with items
 * @param {Object} businessDetails - Business/company details from user profile
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code ('en' or 'tr')
 * @returns {Promise<Buffer>} PDF document as a buffer
 */
async function generateInvoicePdf(invoice, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const labels = getLabels(lang);
  
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: layout.pageSize,
        margins: layout.margins,
        info: {
          Title: `${labels.title} ${invoice.invoiceNumber}`,
          Author: businessDetails.businessName || businessDetails.name || 'Company',
          Subject: `${labels.title} for ${invoice.customerName}`,
          Keywords: 'invoice, vat, uk, tax',
          Creator: 'UK Accounting System'
        }
      });
      
      // Collect PDF data into buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Draw invoice sections
      let y = drawHeader(doc, invoice, businessDetails, labels);
      y = drawCustomerSection(doc, invoice, labels, y);
      
      // Ensure items is an array
      const items = invoice.items || [];
      
      y = drawItemsTable(doc, items, invoice.currency || 'GBP', labels, y);
      y = drawTotals(doc, invoice, items, labels, lang, y);
      y = drawNotes(doc, invoice.notes, labels, y);
      
      // Draw footer on last page
      drawFooter(doc, labels);
      
      // Finalize the document
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates that an invoice has all required data for PDF generation.
 * 
 * @param {Object} invoice - Invoice data to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
function validateInvoiceForPdf(invoice) {
  const errors = [];
  
  if (!invoice) {
    errors.push('Invoice data is required');
    return { isValid: false, errors };
  }
  
  if (!invoice.invoiceNumber) {
    errors.push('Invoice number is required');
  }
  
  if (!invoice.issueDate) {
    errors.push('Invoice date is required');
  }
  
  if (!invoice.customerName) {
    errors.push('Customer name is required');
  }
  
  if (!invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
    errors.push('At least one line item is required');
  }
  
  if (invoice.totalAmount === undefined || invoice.totalAmount === null) {
    errors.push('Invoice total amount is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ==========================================
// Reconciliation Report PDF Generation
// ==========================================

const reconciliationTemplate = require('../templates/reconciliationReport');

/**
 * Draws the reconciliation report header.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} reportData - Report data
 * @param {Object} labels - Language-specific labels
 * @returns {number} Y position after header
 */
function drawReconciliationHeader(doc, reportData, labels) {
  const { bankAccount, reportInfo } = reportData;
  let y = reconciliationTemplate.layout.margins.top;
  const pageWidth = doc.page.width - reconciliationTemplate.layout.margins.left - reconciliationTemplate.layout.margins.right;
  
  // Title
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.title)
     .fillColor(reconciliationTemplate.colors.primary)
     .text(labels.title, reconciliationTemplate.layout.margins.left, y);
  
  y += 25;
  
  // Subtitle
  doc.font(reconciliationTemplate.fonts.regular)
     .fontSize(reconciliationTemplate.layout.fontSize.subtitle)
     .fillColor(reconciliationTemplate.colors.textLight)
     .text(labels.subtitle, reconciliationTemplate.layout.margins.left, y);
  
  y += 30;
  
  // Bank account info box
  const boxWidth = 280;
  const boxHeight = 80;
  
  doc.rect(reconciliationTemplate.layout.margins.left, y, boxWidth, boxHeight)
     .fillColor(reconciliationTemplate.colors.background)
     .fill();
  
  doc.rect(reconciliationTemplate.layout.margins.left, y, boxWidth, boxHeight)
     .strokeColor(reconciliationTemplate.colors.border)
     .lineWidth(1)
     .stroke();
  
  let boxY = y + 8;
  const boxX = reconciliationTemplate.layout.margins.left + 10;
  
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.sectionHeader)
     .fillColor(reconciliationTemplate.colors.primary)
     .text(labels.bankAccountDetails, boxX, boxY);
  
  boxY += 16;
  
  doc.font(reconciliationTemplate.fonts.regular)
     .fontSize(reconciliationTemplate.layout.fontSize.normal)
     .fillColor(reconciliationTemplate.colors.text);
  
  doc.text(`${labels.accountName}: ${bankAccount.accountName}`, boxX, boxY);
  boxY += 12;
  doc.text(`${labels.bankName}: ${bankAccount.bankName}`, boxX, boxY);
  boxY += 12;
  doc.text(`${labels.sortCode}: ${bankAccount.sortCodeFormatted || '-'} | ${labels.accountNumber}: ${bankAccount.accountNumber}`, boxX, boxY);
  boxY += 12;
  doc.text(`${labels.currency}: ${bankAccount.currency || 'GBP'}`, boxX, boxY);
  
  // Report info box (right side)
  const rightBoxX = reconciliationTemplate.layout.margins.left + boxWidth + 20;
  const rightBoxWidth = pageWidth - boxWidth - 20;
  
  doc.rect(rightBoxX, y, rightBoxWidth, boxHeight)
     .fillColor(reconciliationTemplate.colors.background)
     .fill();
  
  doc.rect(rightBoxX, y, rightBoxWidth, boxHeight)
     .strokeColor(reconciliationTemplate.colors.border)
     .lineWidth(1)
     .stroke();
  
  boxY = y + 8;
  
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.sectionHeader)
     .fillColor(reconciliationTemplate.colors.primary)
     .text(labels.reportPeriod, rightBoxX + 10, boxY);
  
  boxY += 16;
  
  doc.font(reconciliationTemplate.fonts.regular)
     .fontSize(reconciliationTemplate.layout.fontSize.normal)
     .fillColor(reconciliationTemplate.colors.text);
  
  const periodStart = reportInfo.dateRange.startDate || labels.allDates;
  const periodEnd = reportInfo.dateRange.endDate || labels.allDates;
  
  if (reportInfo.filterApplied) {
    doc.text(`${labels.from}: ${formatPdfDate(periodStart)}`, rightBoxX + 10, boxY);
    boxY += 12;
    doc.text(`${labels.to}: ${formatPdfDate(periodEnd)}`, rightBoxX + 10, boxY);
  } else {
    doc.text(labels.allDates, rightBoxX + 10, boxY);
  }
  
  boxY += 12;
  doc.font(reconciliationTemplate.fonts.italic)
     .fontSize(reconciliationTemplate.layout.fontSize.small)
     .fillColor(reconciliationTemplate.colors.textLight)
     .text(`${labels.generatedOn}: ${formatPdfDate(reportInfo.generatedAt.split('T')[0])}`, rightBoxX + 10, boxY + 12);
  
  return y + boxHeight + reconciliationTemplate.layout.sectionSpacing;
}

/**
 * Draws the reconciliation summary section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} summary - Summary data
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after summary
 */
function drawReconciliationSummary(doc, summary, labels, startY) {
  let y = startY;
  
  // Section header
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.sectionHeader)
     .fillColor(reconciliationTemplate.colors.primary)
     .text(labels.reconciliationSummary, reconciliationTemplate.layout.margins.left, y);
  
  y += 18;
  
  // Summary grid
  const colWidth = 150;
  const rowHeight = 35;
  let x = reconciliationTemplate.layout.margins.left;
  
  // Total transactions
  drawStatBox(doc, x, y, colWidth, rowHeight, labels.totalTransactions, summary.totalTransactions.toString(), reconciliationTemplate.colors.primary);
  x += colWidth + 10;
  
  // Reconciled
  drawStatBox(doc, x, y, colWidth, rowHeight, labels.reconciledTransactions, summary.reconciledCount.toString(), reconciliationTemplate.colors.success);
  x += colWidth + 10;
  
  // Unreconciled
  drawStatBox(doc, x, y, colWidth, rowHeight, labels.unreconciledTransactions, summary.unreconciledCount.toString(), reconciliationTemplate.colors.warning);
  x += colWidth + 10;
  
  // Excluded
  drawStatBox(doc, x, y, colWidth, rowHeight, labels.excludedTransactions, summary.excludedCount.toString(), reconciliationTemplate.colors.muted);
  x += colWidth + 10;
  
  // Progress
  const progressColor = summary.progressPercentage === 100 ? reconciliationTemplate.colors.success : 
                        summary.progressPercentage >= 80 ? reconciliationTemplate.colors.warning : 
                        reconciliationTemplate.colors.error;
  drawStatBox(doc, x, y, colWidth, rowHeight, labels.reconciliationProgress, `${summary.progressPercentage}%`, progressColor);
  
  return y + rowHeight + reconciliationTemplate.layout.sectionSpacing;
}

/**
 * Helper function to draw a statistics box.
 */
function drawStatBox(doc, x, y, width, height, label, value, color) {
  doc.rect(x, y, width, height)
     .fillColor(reconciliationTemplate.colors.background)
     .fill();
  
  doc.rect(x, y, width, height)
     .strokeColor(color)
     .lineWidth(1)
     .stroke();
  
  doc.font(reconciliationTemplate.fonts.regular)
     .fontSize(reconciliationTemplate.layout.fontSize.small)
     .fillColor(reconciliationTemplate.colors.textLight)
     .text(label, x + 5, y + 5, { width: width - 10 });
  
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(14)
     .fillColor(color)
     .text(value, x + 5, y + 18, { width: width - 10 });
}

/**
 * Draws the balance summary section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} balances - Balance data
 * @param {Object} labels - Language-specific labels
 * @param {string} currency - Currency code
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after balances
 */
function drawBalanceSummary(doc, balances, labels, currency, startY) {
  let y = startY;
  const symbol = reconciliationTemplate.getCurrencySymbol(currency);
  
  // Section header
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.sectionHeader)
     .fillColor(reconciliationTemplate.colors.primary)
     .text(labels.balanceSummary, reconciliationTemplate.layout.margins.left, y);
  
  y += 18;
  
  // Create balance table
  const tableX = reconciliationTemplate.layout.margins.left;
  const colWidths = [200, 100, 100, 100];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  
  // Header
  doc.rect(tableX, y, tableWidth, 20)
     .fillColor(reconciliationTemplate.colors.primary)
     .fill();
  
  let colX = tableX;
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.small)
     .fillColor(reconciliationTemplate.colors.white);
  
  doc.text('', colX + 5, y + 6, { width: colWidths[0] - 10 });
  colX += colWidths[0];
  doc.text(labels.credits, colX + 5, y + 6, { width: colWidths[1] - 10, align: 'right' });
  colX += colWidths[1];
  doc.text(labels.debits, colX + 5, y + 6, { width: colWidths[2] - 10, align: 'right' });
  colX += colWidths[2];
  doc.text(labels.netBalance, colX + 5, y + 6, { width: colWidths[3] - 10, align: 'right' });
  
  y += 20;
  
  // Bank statement row
  y = drawBalanceRow(doc, tableX, y, colWidths, labels.bankStatementTotals, 
    `${symbol}${balances.bank.credits}`, `${symbol}${balances.bank.debits}`, `${symbol}${balances.bank.net}`, false);
  
  // Reconciled row
  y = drawBalanceRow(doc, tableX, y, colWidths, labels.reconciledTotals, 
    `${symbol}${balances.reconciled.credits}`, `${symbol}${balances.reconciled.debits}`, `${symbol}${balances.reconciled.net}`, true);
  
  // Unreconciled row
  y = drawBalanceRow(doc, tableX, y, colWidths, labels.unreconciledTotals, 
    `${symbol}${balances.unreconciled.credits}`, `${symbol}${balances.unreconciled.debits}`, `${symbol}${balances.unreconciled.net}`, false);
  
  // Discrepancy row
  const discrepancyColor = balances.isBalanced ? reconciliationTemplate.colors.success : reconciliationTemplate.colors.error;
  
  doc.rect(tableX, y, tableWidth, 22)
     .fillColor(reconciliationTemplate.colors.headerBg)
     .fill();
  
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.normal)
     .fillColor(reconciliationTemplate.colors.text)
     .text(labels.discrepancy, tableX + 5, y + 6, { width: colWidths[0] - 10 });
  
  doc.fillColor(discrepancyColor)
     .text(`${symbol}${balances.discrepancy}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 5, y + 6, 
       { width: colWidths[3] - 10, align: 'right' });
  
  // Balanced status
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.small)
     .fillColor(discrepancyColor)
     .text(balances.isBalanced ? `✓ ${labels.balanced}` : `✗ ${labels.notBalanced}`, 
       tableX + tableWidth + 20, y + 6);
  
  return y + 22 + reconciliationTemplate.layout.sectionSpacing;
}

/**
 * Helper function to draw a balance table row.
 */
function drawBalanceRow(doc, tableX, y, colWidths, label, credits, debits, net, alternate) {
  const rowHeight = 18;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  
  if (alternate) {
    doc.rect(tableX, y, tableWidth, rowHeight)
       .fillColor(reconciliationTemplate.colors.background)
       .fill();
  }
  
  let colX = tableX;
  doc.font(reconciliationTemplate.fonts.regular)
     .fontSize(reconciliationTemplate.layout.fontSize.normal)
     .fillColor(reconciliationTemplate.colors.text);
  
  doc.text(label, colX + 5, y + 4, { width: colWidths[0] - 10 });
  colX += colWidths[0];
  doc.fillColor(reconciliationTemplate.colors.credit)
     .text(credits, colX + 5, y + 4, { width: colWidths[1] - 10, align: 'right' });
  colX += colWidths[1];
  doc.fillColor(reconciliationTemplate.colors.debit)
     .text(debits, colX + 5, y + 4, { width: colWidths[2] - 10, align: 'right' });
  colX += colWidths[2];
  doc.fillColor(reconciliationTemplate.colors.text)
     .text(net, colX + 5, y + 4, { width: colWidths[3] - 10, align: 'right' });
  
  return y + rowHeight;
}

/**
 * Draws the reconciled pairs section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Array} pairs - Reconciled pairs data
 * @param {Object} labels - Language-specific labels
 * @param {string} currency - Currency code
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after pairs
 */
function drawReconciledPairs(doc, pairs, labels, currency, startY) {
  let y = startY;
  const symbol = reconciliationTemplate.getCurrencySymbol(currency);
  
  // Section header
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.sectionHeader)
     .fillColor(reconciliationTemplate.colors.primary)
     .text(`${labels.reconciledPairs} (${pairs.length})`, reconciliationTemplate.layout.margins.left, y);
  
  y += 18;
  
  if (pairs.length === 0) {
    doc.font(reconciliationTemplate.fonts.italic)
       .fontSize(reconciliationTemplate.layout.fontSize.normal)
       .fillColor(reconciliationTemplate.colors.textLight)
       .text('No reconciled transactions', reconciliationTemplate.layout.margins.left, y);
    return y + 20;
  }
  
  // Table header
  const tableX = reconciliationTemplate.layout.margins.left;
  const colWidths = [70, 140, 50, 65, 70, 140, 50, 65, 70];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  
  doc.rect(tableX, y, tableWidth, 20)
     .fillColor(reconciliationTemplate.colors.primary)
     .fill();
  
  let colX = tableX;
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.tiny)
     .fillColor(reconciliationTemplate.colors.white);
  
  // Bank transaction headers
  doc.text(labels.date, colX + 2, y + 6, { width: colWidths[0] - 4 });
  colX += colWidths[0];
  doc.text(labels.description, colX + 2, y + 6, { width: colWidths[1] - 4 });
  colX += colWidths[1];
  doc.text(labels.type, colX + 2, y + 6, { width: colWidths[2] - 4, align: 'center' });
  colX += colWidths[2];
  doc.text(labels.amount, colX + 2, y + 6, { width: colWidths[3] - 4, align: 'right' });
  colX += colWidths[3];
  
  // Matched transaction headers
  doc.text(labels.date, colX + 2, y + 6, { width: colWidths[4] - 4 });
  colX += colWidths[4];
  doc.text(labels.description, colX + 2, y + 6, { width: colWidths[5] - 4 });
  colX += colWidths[5];
  doc.text(labels.type, colX + 2, y + 6, { width: colWidths[6] - 4, align: 'center' });
  colX += colWidths[6];
  doc.text(labels.amount, colX + 2, y + 6, { width: colWidths[7] - 4, align: 'right' });
  colX += colWidths[7];
  doc.text(labels.matchType, colX + 2, y + 6, { width: colWidths[8] - 4, align: 'center' });
  
  y += 20;
  
  // Draw rows
  let alternate = false;
  for (const pair of pairs) {
    // Check for page break
    if (y + 16 > doc.page.height - reconciliationTemplate.layout.margins.bottom - 30) {
      doc.addPage({ layout: 'landscape' });
      y = reconciliationTemplate.layout.margins.top;
    }
    
    if (alternate) {
      doc.rect(tableX, y, tableWidth, 16)
         .fillColor(reconciliationTemplate.colors.background)
         .fill();
    }
    
    colX = tableX;
    doc.font(reconciliationTemplate.fonts.regular)
       .fontSize(reconciliationTemplate.layout.fontSize.tiny)
       .fillColor(reconciliationTemplate.colors.text);
    
    // Bank transaction
    doc.text(formatPdfDate(pair.bankDate), colX + 2, y + 4, { width: colWidths[0] - 4 });
    colX += colWidths[0];
    doc.text(truncateText(pair.bankDescription, 25), colX + 2, y + 4, { width: colWidths[1] - 4 });
    colX += colWidths[1];
    const bankTypeColor = pair.bankType === 'credit' ? reconciliationTemplate.colors.credit : reconciliationTemplate.colors.debit;
    doc.fillColor(bankTypeColor)
       .text(pair.bankType.charAt(0).toUpperCase(), colX + 2, y + 4, { width: colWidths[2] - 4, align: 'center' });
    colX += colWidths[2];
    doc.text(`${symbol}${pair.bankAmount}`, colX + 2, y + 4, { width: colWidths[3] - 4, align: 'right' });
    colX += colWidths[3];
    
    // Matched transaction
    doc.fillColor(reconciliationTemplate.colors.text)
       .text(formatPdfDate(pair.appDate), colX + 2, y + 4, { width: colWidths[4] - 4 });
    colX += colWidths[4];
    doc.text(truncateText(pair.appDescription, 25), colX + 2, y + 4, { width: colWidths[5] - 4 });
    colX += colWidths[5];
    const appTypeColor = pair.appType === 'income' || pair.appType === 'credit' ? reconciliationTemplate.colors.credit : reconciliationTemplate.colors.debit;
    doc.fillColor(appTypeColor)
       .text(pair.appType.charAt(0).toUpperCase(), colX + 2, y + 4, { width: colWidths[6] - 4, align: 'center' });
    colX += colWidths[6];
    doc.fillColor(reconciliationTemplate.colors.text)
       .text(`${symbol}${pair.appAmount}`, colX + 2, y + 4, { width: colWidths[7] - 4, align: 'right' });
    colX += colWidths[7];
    doc.fillColor(reconciliationTemplate.colors.success)
       .text(reconciliationTemplate.getMatchTypeName(pair.matchType, 'en').split(' ')[0], colX + 2, y + 4, 
         { width: colWidths[8] - 4, align: 'center' });
    
    y += 16;
    alternate = !alternate;
  }
  
  return y + reconciliationTemplate.layout.sectionSpacing;
}

/**
 * Draws the unreconciled items section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Array} items - Unreconciled items data
 * @param {Object} labels - Language-specific labels
 * @param {string} currency - Currency code
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after items
 */
function drawUnreconciledItems(doc, items, labels, currency, startY) {
  let y = startY;
  const symbol = reconciliationTemplate.getCurrencySymbol(currency);
  
  // Check for page break
  if (y + 50 > doc.page.height - reconciliationTemplate.layout.margins.bottom) {
    doc.addPage({ layout: 'landscape' });
    y = reconciliationTemplate.layout.margins.top;
  }
  
  // Section header
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.sectionHeader)
     .fillColor(reconciliationTemplate.colors.warning)
     .text(`${labels.unreconciledItems} (${items.length})`, reconciliationTemplate.layout.margins.left, y);
  
  y += 18;
  
  if (items.length === 0) {
    doc.font(reconciliationTemplate.fonts.italic)
       .fontSize(reconciliationTemplate.layout.fontSize.normal)
       .fillColor(reconciliationTemplate.colors.success)
       .text(labels.noUnreconciled, reconciliationTemplate.layout.margins.left, y);
    return y + 20;
  }
  
  // Table header
  const tableX = reconciliationTemplate.layout.margins.left;
  const colWidths = [80, 200, 80, 60, 80, 200];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  
  doc.rect(tableX, y, tableWidth, 18)
     .fillColor(reconciliationTemplate.colors.warning)
     .fill();
  
  let colX = tableX;
  doc.font(reconciliationTemplate.fonts.bold)
     .fontSize(reconciliationTemplate.layout.fontSize.tiny)
     .fillColor(reconciliationTemplate.colors.white);
  
  doc.text(labels.date, colX + 2, y + 5, { width: colWidths[0] - 4 });
  colX += colWidths[0];
  doc.text(labels.description, colX + 2, y + 5, { width: colWidths[1] - 4 });
  colX += colWidths[1];
  doc.text(labels.reference, colX + 2, y + 5, { width: colWidths[2] - 4 });
  colX += colWidths[2];
  doc.text(labels.type, colX + 2, y + 5, { width: colWidths[3] - 4, align: 'center' });
  colX += colWidths[3];
  doc.text(labels.amount, colX + 2, y + 5, { width: colWidths[4] - 4, align: 'right' });
  colX += colWidths[4];
  doc.text(labels.notes, colX + 2, y + 5, { width: colWidths[5] - 4 });
  
  y += 18;
  
  // Draw rows (limit to first 50 to avoid overly long PDFs)
  const displayItems = items.slice(0, 50);
  let alternate = false;
  
  for (const item of displayItems) {
    if (y + 14 > doc.page.height - reconciliationTemplate.layout.margins.bottom - 30) {
      doc.addPage({ layout: 'landscape' });
      y = reconciliationTemplate.layout.margins.top;
    }
    
    if (alternate) {
      doc.rect(tableX, y, tableWidth, 14)
         .fillColor(reconciliationTemplate.colors.background)
         .fill();
    }
    
    colX = tableX;
    doc.font(reconciliationTemplate.fonts.regular)
       .fontSize(reconciliationTemplate.layout.fontSize.tiny)
       .fillColor(reconciliationTemplate.colors.text);
    
    doc.text(formatPdfDate(item.date), colX + 2, y + 3, { width: colWidths[0] - 4 });
    colX += colWidths[0];
    doc.text(truncateText(item.description, 35), colX + 2, y + 3, { width: colWidths[1] - 4 });
    colX += colWidths[1];
    doc.text(truncateText(item.reference, 12), colX + 2, y + 3, { width: colWidths[2] - 4 });
    colX += colWidths[2];
    const typeColor = item.type === 'credit' ? reconciliationTemplate.colors.credit : reconciliationTemplate.colors.debit;
    doc.fillColor(typeColor)
       .text(item.type.charAt(0).toUpperCase(), colX + 2, y + 3, { width: colWidths[3] - 4, align: 'center' });
    colX += colWidths[3];
    doc.fillColor(reconciliationTemplate.colors.text)
       .text(`${symbol}${item.amount}`, colX + 2, y + 3, { width: colWidths[4] - 4, align: 'right' });
    colX += colWidths[4];
    doc.text(truncateText(item.notes, 35), colX + 2, y + 3, { width: colWidths[5] - 4 });
    
    y += 14;
    alternate = !alternate;
  }
  
  if (items.length > 50) {
    y += 5;
    doc.font(reconciliationTemplate.fonts.italic)
       .fontSize(reconciliationTemplate.layout.fontSize.small)
       .fillColor(reconciliationTemplate.colors.textLight)
       .text(`... and ${items.length - 50} more unreconciled items`, reconciliationTemplate.layout.margins.left, y);
    y += 12;
  }
  
  return y + reconciliationTemplate.layout.sectionSpacing;
}

/**
 * Draws the report footer.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} labels - Language-specific labels
 */
function drawReconciliationFooter(doc, labels) {
  const bottomY = doc.page.height - reconciliationTemplate.layout.margins.bottom - 20;
  
  doc.moveTo(reconciliationTemplate.layout.margins.left, bottomY)
     .lineTo(doc.page.width - reconciliationTemplate.layout.margins.right, bottomY)
     .strokeColor(reconciliationTemplate.colors.border)
     .lineWidth(0.5)
     .stroke();
  
  doc.font(reconciliationTemplate.fonts.italic)
     .fontSize(reconciliationTemplate.layout.fontSize.tiny)
     .fillColor(reconciliationTemplate.colors.textLight)
     .text(labels.auditPurpose, reconciliationTemplate.layout.margins.left, bottomY + 5, {
       width: doc.page.width - reconciliationTemplate.layout.margins.left - reconciliationTemplate.layout.margins.right,
       align: 'center'
     });
}

/**
 * Helper function to truncate text.
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generates a PDF document for a reconciliation report.
 * 
 * @param {Object} reportData - Report data from reconciliationReportService.getReportDataForPdf()
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code ('en' or 'tr')
 * @returns {Promise<Buffer>} PDF document as a buffer
 */
async function generateReconciliationReportPdf(reportData, options = {}) {
  const { lang = 'en' } = options;
  const labels = reconciliationTemplate.getLabels(lang);
  
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document in landscape orientation for better table display
      const doc = new PDFDocument({
        size: reconciliationTemplate.layout.pageSize,
        layout: 'landscape',
        margins: reconciliationTemplate.layout.margins,
        info: {
          Title: `${labels.title} - ${reportData.bankAccount.accountName}`,
          Author: 'UK Accounting System',
          Subject: labels.subtitle,
          Keywords: 'reconciliation, bank, audit, report',
          Creator: 'UK Accounting System'
        }
      });
      
      // Collect PDF data into buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const currency = reportData.bankAccount.currency || 'GBP';
      
      // Draw report sections
      let y = drawReconciliationHeader(doc, reportData, labels);
      y = drawReconciliationSummary(doc, reportData.summary, labels, y);
      y = drawBalanceSummary(doc, reportData.balances, labels, currency, y);
      
      // New page for reconciled pairs if needed
      if (reportData.reconciledPairs.length > 0 && y > doc.page.height - 200) {
        doc.addPage({ layout: 'landscape' });
        y = reconciliationTemplate.layout.margins.top;
      }
      
      y = drawReconciledPairs(doc, reportData.reconciledPairs, labels, currency, y);
      y = drawUnreconciledItems(doc, reportData.unreconciledTransactions, labels, currency, y);
      
      // Draw footer on last page
      drawReconciliationFooter(doc, labels);
      
      // Finalize the document
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates that report data has all required fields for PDF generation.
 * 
 * @param {Object} reportData - Report data to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
function validateReportDataForPdf(reportData) {
  const errors = [];
  
  if (!reportData) {
    errors.push('Report data is required');
    return { isValid: false, errors };
  }
  
  if (!reportData.bankAccount) {
    errors.push('Bank account data is required');
  }
  
  if (!reportData.summary) {
    errors.push('Summary data is required');
  }
  
  if (!reportData.balances) {
    errors.push('Balance data is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  // Invoice PDF
  generateInvoicePdf,
  validateInvoiceForPdf,
  
  // Reconciliation Report PDF
  generateReconciliationReportPdf,
  validateReportDataForPdf,
  
  // Export helper functions for testing
  formatMoney,
  formatPdfDate,
  calculateVatBreakdown,
  truncateText
};
