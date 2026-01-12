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

// ========================================
// VAT RETURN PDF GENERATION
// ========================================

const vatReturnTemplate = require('../templates/vatReturn');

/**
 * Gets VAT return labels for a specific language.
 * 
 * @param {string} [lang='en'] - Language code ('en' or 'tr')
 * @returns {Object} Labels for the specified language
 */
function getVatReturnLabels(lang = 'en') {
  return vatReturnTemplate.getLabels(lang);
}

/**
 * Draws horizontal line for VAT return PDF.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {number} y - Y position
 * @param {Object} [options={}] - Line options
 */
function drawVatReturnLine(doc, y, options = {}) {
  const {
    startX = vatReturnTemplate.layout.margins.left,
    endX = doc.page.width - vatReturnTemplate.layout.margins.right,
    color = vatReturnTemplate.colors.border,
    width = 0.5
  } = options;
  
  doc.strokeColor(color)
     .lineWidth(width)
     .moveTo(startX, y)
     .lineTo(endX, y)
     .stroke();
}

/**
 * Draws the VAT return header with title and period info.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} vatReturn - VAT return data
 * @param {Object} labels - Language-specific labels
 * @returns {number} Y position after header
 */
function drawVatReturnHeader(doc, vatReturn, labels) {
  let y = vatReturnTemplate.layout.margins.top;
  const pageWidth = doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right;
  
  // Title
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(22)
     .fillColor(vatReturnTemplate.colors.primary)
     .text(labels.title, vatReturnTemplate.layout.margins.left, y, { align: 'center', width: pageWidth });
  
  y += 30;
  
  // Subtitle
  doc.font(vatReturnTemplate.fonts.italic)
     .fontSize(10)
     .fillColor(vatReturnTemplate.colors.textLight)
     .text(labels.subtitle, vatReturnTemplate.layout.margins.left, y, { align: 'center', width: pageWidth });
  
  y += 25;
  
  // Draw separator
  drawVatReturnLine(doc, y, { color: vatReturnTemplate.colors.primary, width: 2 });
  
  y += 15;
  
  // Period information box
  const boxWidth = 250;
  const boxX = vatReturnTemplate.layout.margins.left + (pageWidth - boxWidth) / 2;
  const boxHeight = 50;
  
  doc.rect(boxX, y, boxWidth, boxHeight)
     .fillColor(vatReturnTemplate.colors.background)
     .fill();
  
  doc.rect(boxX, y, boxWidth, boxHeight)
     .strokeColor(vatReturnTemplate.colors.border)
     .lineWidth(1)
     .stroke();
  
  // Period label
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(10)
     .fillColor(vatReturnTemplate.colors.primary)
     .text(labels.periodLabel, boxX + 10, y + 10, { width: boxWidth - 20, align: 'center' });
  
  // Period dates
  const periodStart = formatPdfDate(vatReturn.periodStart);
  const periodEnd = formatPdfDate(vatReturn.periodEnd);
  doc.font(vatReturnTemplate.fonts.regular)
     .fontSize(11)
     .fillColor(vatReturnTemplate.colors.text)
     .text(`${periodStart}  -  ${periodEnd}`, boxX + 10, y + 28, { width: boxWidth - 20, align: 'center' });
  
  y += boxHeight + 15;
  
  // Status and reference row
  const statusColor = vatReturnTemplate.getStatusColor(vatReturn.status);
  const statusText = labels.statuses[vatReturn.status] || vatReturn.status?.toUpperCase() || 'DRAFT';
  
  // Left side: status
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(9)
     .fillColor(vatReturnTemplate.colors.textLight)
     .text(`${labels.status}: `, vatReturnTemplate.layout.margins.left, y, { continued: true });
  doc.font(vatReturnTemplate.fonts.bold)
     .fillColor(statusColor)
     .text(statusText);
  
  // Right side: reference number
  if (vatReturn.id) {
    doc.font(vatReturnTemplate.fonts.regular)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.textLight)
       .text(`${labels.referenceNumber}: VAT-${String(vatReturn.id).padStart(6, '0')}`, 
             vatReturnTemplate.layout.margins.left, y, 
             { align: 'right', width: pageWidth });
  }
  
  y += 20;
  
  return y;
}

/**
 * Draws the business details section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} businessDetails - Business details from user
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after section
 */
function drawBusinessDetailsSection(doc, businessDetails, labels, startY) {
  let y = startY;
  const pageWidth = doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right;
  
  // Section header
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(12)
     .fillColor(vatReturnTemplate.colors.primary)
     .text(labels.businessDetails, vatReturnTemplate.layout.margins.left, y);
  
  y += 18;
  
  // Draw separator
  drawVatReturnLine(doc, y, { color: vatReturnTemplate.colors.border });
  
  y += 10;
  
  // Business details in two columns
  const colWidth = pageWidth / 2 - 10;
  const leftColX = vatReturnTemplate.layout.margins.left;
  const rightColX = vatReturnTemplate.layout.margins.left + colWidth + 20;
  
  // Left column
  if (businessDetails.businessName || businessDetails.name) {
    doc.font(vatReturnTemplate.fonts.bold)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.textLight)
       .text(labels.businessName, leftColX, y);
    y += 12;
    doc.font(vatReturnTemplate.fonts.regular)
       .fontSize(10)
       .fillColor(vatReturnTemplate.colors.text)
       .text(businessDetails.businessName || businessDetails.name, leftColX, y, { width: colWidth });
    y += 15;
  }
  
  if (businessDetails.businessAddress) {
    doc.font(vatReturnTemplate.fonts.bold)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.textLight)
       .text(labels.businessAddress, leftColX, y);
    y += 12;
    doc.font(vatReturnTemplate.fonts.regular)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.text)
       .text(businessDetails.businessAddress, leftColX, y, { width: colWidth });
    y += doc.heightOfString(businessDetails.businessAddress, { width: colWidth }) + 5;
  }
  
  // Right column - reset Y for right column
  let rightY = startY + 28;
  
  if (businessDetails.vatNumber) {
    doc.font(vatReturnTemplate.fonts.bold)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.textLight)
       .text(labels.vatNumber, rightColX, rightY);
    rightY += 12;
    doc.font(vatReturnTemplate.fonts.regular)
       .fontSize(10)
       .fillColor(vatReturnTemplate.colors.text)
       .text(businessDetails.vatNumber, rightColX, rightY);
    rightY += 15;
  }
  
  if (businessDetails.companyNumber) {
    doc.font(vatReturnTemplate.fonts.bold)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.textLight)
       .text(labels.companyNumber, rightColX, rightY);
    rightY += 12;
    doc.font(vatReturnTemplate.fonts.regular)
       .fontSize(10)
       .fillColor(vatReturnTemplate.colors.text)
       .text(businessDetails.companyNumber, rightColX, rightY);
    rightY += 15;
  }
  
  if (businessDetails.email) {
    doc.font(vatReturnTemplate.fonts.bold)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.textLight)
       .text(labels.email, rightColX, rightY);
    rightY += 12;
    doc.font(vatReturnTemplate.fonts.regular)
       .fontSize(9)
       .fillColor(vatReturnTemplate.colors.text)
       .text(businessDetails.email, rightColX, rightY);
    rightY += 15;
  }
  
  // Use the maximum of left and right column positions
  y = Math.max(y, rightY) + vatReturnTemplate.layout.sectionSpacing;
  
  return y;
}

/**
 * Draws a single VAT box row.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {string} boxLabel - Box label (e.g., "Box 1")
 * @param {string} description - Box description
 * @param {number} amount - Amount in pence
 * @param {number} y - Y position
 * @param {Object} [options={}] - Drawing options
 * @returns {number} Y position after row
 */
function drawVatBoxRow(doc, boxLabel, description, amount, y, options = {}) {
  const {
    isHighlighted = false,
    isPositive = true,
    currency = 'GBP'
  } = options;
  
  const pageWidth = doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right;
  const rowHeight = vatReturnTemplate.layout.boxRowHeight;
  const leftMargin = vatReturnTemplate.layout.margins.left;
  
  // Background for highlighted rows (Box 3 and Box 5)
  if (isHighlighted) {
    doc.rect(leftMargin, y, pageWidth, rowHeight)
       .fillColor(vatReturnTemplate.colors.headerBg)
       .fill();
  }
  
  // Box label column
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(10)
     .fillColor(vatReturnTemplate.colors.primary)
     .text(boxLabel, leftMargin + 10, y + 12, { width: 60 });
  
  // Description column
  doc.font(vatReturnTemplate.fonts.regular)
     .fontSize(9)
     .fillColor(vatReturnTemplate.colors.text)
     .text(description, leftMargin + 75, y + 12, { width: pageWidth - 200 });
  
  // Amount column
  const formattedAmount = formatMoney(Math.abs(amount), currency);
  const displayAmount = amount < 0 ? `(${formattedAmount})` : formattedAmount;
  const amountColor = amount < 0 ? vatReturnTemplate.colors.danger : 
                       (isPositive ? vatReturnTemplate.colors.text : vatReturnTemplate.colors.success);
  
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(10)
     .fillColor(amountColor)
     .text(displayAmount, leftMargin + pageWidth - 120, y + 12, { width: 110, align: 'right' });
  
  // Draw bottom border
  drawVatReturnLine(doc, y + rowHeight, { color: vatReturnTemplate.colors.border });
  
  return y + rowHeight;
}

/**
 * Draws a section header for VAT boxes.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {string} title - Section title
 * @param {number} y - Y position
 * @returns {number} Y position after header
 */
function drawVatSectionHeader(doc, title, y) {
  const pageWidth = doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right;
  const headerHeight = vatReturnTemplate.layout.sectionHeaderHeight;
  const leftMargin = vatReturnTemplate.layout.margins.left;
  
  doc.rect(leftMargin, y, pageWidth, headerHeight)
     .fillColor(vatReturnTemplate.colors.primary)
     .fill();
  
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(10)
     .fillColor(vatReturnTemplate.colors.white)
     .text(title, leftMargin + 10, y + 8);
  
  return y + headerHeight;
}

/**
 * Draws all nine VAT boxes.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} vatReturn - VAT return data
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after boxes
 */
function drawVatBoxes(doc, vatReturn, labels, startY) {
  let y = startY;
  
  // Main title
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(12)
     .fillColor(vatReturnTemplate.colors.primary)
     .text(labels.vatBoxesTitle, vatReturnTemplate.layout.margins.left, y);
  
  y += 20;
  
  // VAT Output Section (Boxes 1-3)
  y = drawVatSectionHeader(doc, labels.vatOutputSection, y);
  y = drawVatBoxRow(doc, labels.box1Label, labels.box1Description, vatReturn.box1 || 0, y);
  y = drawVatBoxRow(doc, labels.box2Label, labels.box2Description, vatReturn.box2 || 0, y);
  y = drawVatBoxRow(doc, labels.box3Label, labels.box3Description, vatReturn.box3 || 0, y, { isHighlighted: true });
  
  y += 10;
  
  // VAT Input Section (Box 4)
  y = drawVatSectionHeader(doc, labels.vatInputSection, y);
  y = drawVatBoxRow(doc, labels.box4Label, labels.box4Description, vatReturn.box4 || 0, y);
  
  y += 10;
  
  // VAT Summary Section (Box 5)
  y = drawVatSectionHeader(doc, labels.vatSummarySection, y);
  const box5Value = vatReturn.box5 || 0;
  const box5Label = box5Value >= 0 ? labels.netVatPayable : labels.netVatRefund;
  y = drawVatBoxRow(doc, labels.box5Label, labels.box5Description, box5Value, y, { 
    isHighlighted: true,
    isPositive: box5Value >= 0
  });
  
  y += 10;
  
  // Sales and Purchases Section (Boxes 6-7)
  y = drawVatSectionHeader(doc, labels.salesPurchasesSection, y);
  y = drawVatBoxRow(doc, labels.box6Label, labels.box6Description, vatReturn.box6 || 0, y);
  y = drawVatBoxRow(doc, labels.box7Label, labels.box7Description, vatReturn.box7 || 0, y);
  
  y += 10;
  
  // EU Trade Section (Boxes 8-9)
  y = drawVatSectionHeader(doc, labels.euTradeSection, y);
  y = drawVatBoxRow(doc, labels.box8Label, labels.box8Description, vatReturn.box8 || 0, y);
  y = drawVatBoxRow(doc, labels.box9Label, labels.box9Description, vatReturn.box9 || 0, y);
  
  return y + vatReturnTemplate.layout.sectionSpacing;
}

/**
 * Draws the notes section.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {string} notes - Notes text
 * @param {Object} labels - Language-specific labels
 * @param {number} startY - Starting Y position
 * @returns {number} Y position after notes
 */
function drawVatReturnNotes(doc, notes, labels, startY) {
  if (!notes) return startY;
  
  let y = startY;
  
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(10)
     .fillColor(vatReturnTemplate.colors.primary)
     .text(labels.notes, vatReturnTemplate.layout.margins.left, y);
  
  y += 15;
  
  doc.font(vatReturnTemplate.fonts.regular)
     .fontSize(9)
     .fillColor(vatReturnTemplate.colors.text)
     .text(notes, vatReturnTemplate.layout.margins.left, y, { 
       width: doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right 
     });
  
  y += doc.heightOfString(notes, { 
    width: doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right 
  }) + vatReturnTemplate.layout.sectionSpacing;
  
  return y;
}

/**
 * Draws the disclaimer footer.
 * 
 * @param {PDFDocument} doc - PDF document instance
 * @param {Object} labels - Language-specific labels
 */
function drawVatReturnFooter(doc, labels) {
  const bottomY = doc.page.height - vatReturnTemplate.layout.margins.bottom;
  const pageWidth = doc.page.width - vatReturnTemplate.layout.margins.left - vatReturnTemplate.layout.margins.right;
  
  // Draw separator
  drawVatReturnLine(doc, bottomY - 55, { color: vatReturnTemplate.colors.warning, width: 1 });
  
  // Disclaimer box
  doc.rect(vatReturnTemplate.layout.margins.left, bottomY - 52, pageWidth, 45)
     .fillColor('#fff8f0')  // Light warning background
     .fill();
  
  doc.font(vatReturnTemplate.fonts.bold)
     .fontSize(7)
     .fillColor(vatReturnTemplate.colors.warning)
     .text(labels.disclaimer, vatReturnTemplate.layout.margins.left + 10, bottomY - 48, {
       width: pageWidth - 20,
       align: 'justify'
     });
  
  // Generation timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  doc.font(vatReturnTemplate.fonts.regular)
     .fontSize(7)
     .fillColor(vatReturnTemplate.colors.textLight)
     .text(`${labels.generatedOn}: ${formatPdfDate(timestamp)} | ${labels.thankYou}`, 
           vatReturnTemplate.layout.margins.left, bottomY - 5, {
             width: pageWidth,
             align: 'center'
           });
}

/**
 * Generates a PDF document for a VAT return.
 * 
 * @param {Object} vatReturn - VAT return data with all nine boxes
 * @param {Object} businessDetails - Business/company details from user profile
 * @param {Object} [options={}] - Generation options
 * @param {string} [options.lang='en'] - Language code ('en' or 'tr')
 * @returns {Promise<Buffer>} PDF document as a buffer
 */
async function generateVatReturnPdf(vatReturn, businessDetails, options = {}) {
  const { lang = 'en' } = options;
  const labels = getVatReturnLabels(lang);
  
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: vatReturnTemplate.layout.pageSize,
        margins: vatReturnTemplate.layout.margins,
        info: {
          Title: `${labels.title} - ${formatPdfDate(vatReturn.periodStart)} to ${formatPdfDate(vatReturn.periodEnd)}`,
          Author: businessDetails.businessName || businessDetails.name || 'Company',
          Subject: `VAT Return for period ${vatReturn.periodStart} to ${vatReturn.periodEnd}`,
          Keywords: 'vat, return, hmrc, uk, tax',
          Creator: 'UK Pre-Accounting System'
        }
      });
      
      // Collect PDF data into buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Draw VAT return sections
      let y = drawVatReturnHeader(doc, vatReturn, labels);
      y = drawBusinessDetailsSection(doc, businessDetails, labels, y);
      y = drawVatBoxes(doc, vatReturn, labels, y);
      y = drawVatReturnNotes(doc, vatReturn.notes, labels, y);
      
      // Draw footer on last page
      drawVatReturnFooter(doc, labels);
      
      // Finalize the document
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validates that a VAT return has all required data for PDF generation.
 * 
 * @param {Object} vatReturn - VAT return data to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
function validateVatReturnForPdf(vatReturn) {
  const errors = [];
  
  if (!vatReturn) {
    errors.push('VAT return data is required');
    return { isValid: false, errors };
  }
  
  if (!vatReturn.periodStart) {
    errors.push('Period start date is required');
  }
  
  if (!vatReturn.periodEnd) {
    errors.push('Period end date is required');
  }
  
  // Check that at least box values are present (can be 0)
  const boxKeys = ['box1', 'box2', 'box3', 'box4', 'box5', 'box6', 'box7', 'box8', 'box9'];
  for (const key of boxKeys) {
    if (vatReturn[key] === undefined || vatReturn[key] === null) {
      errors.push(`${key} value is required`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  generateInvoicePdf,
  validateInvoiceForPdf,
  
  // VAT Return PDF functions
  generateVatReturnPdf,
  validateVatReturnForPdf,
  
  // Export helper functions for testing
  formatMoney,
  formatPdfDate,
  calculateVatBreakdown
};
