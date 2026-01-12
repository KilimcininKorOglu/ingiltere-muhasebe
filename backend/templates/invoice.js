/**
 * Invoice Template
 * Provides bilingual (English/Turkish) labels and formatting for UK-compliant invoices.
 * 
 * All invoice labels and text strings are provided in both languages.
 * UK-specific requirements like VAT breakdown, tax point, and company details are included.
 * 
 * @module templates/invoice
 */

/**
 * Invoice labels in both languages.
 * @type {Object}
 */
const labels = {
  en: {
    // Document title
    title: 'INVOICE',
    taxInvoice: 'TAX INVOICE',
    
    // Header labels
    invoiceNumber: 'Invoice Number',
    invoiceDate: 'Invoice Date',
    dueDate: 'Due Date',
    taxPoint: 'Tax Point',
    reference: 'Reference',
    page: 'Page',
    of: 'of',
    
    // Party labels
    from: 'From',
    to: 'To',
    billTo: 'Bill To',
    
    // Company details
    vatNumber: 'VAT Number',
    companyNumber: 'Company No',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    
    // Customer details
    customerVatNumber: 'Customer VAT No',
    
    // Line item table headers
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    vatRate: 'VAT Rate',
    vatAmount: 'VAT',
    amount: 'Amount',
    lineTotal: 'Total',
    
    // Totals section
    subtotal: 'Subtotal (excl. VAT)',
    totalVat: 'Total VAT',
    grandTotal: 'Total Due',
    
    // VAT breakdown
    vatBreakdown: 'VAT Breakdown',
    vatRateLabel: 'Rate',
    netAmount: 'Net Amount',
    
    // VAT rate names
    vatRates: {
      standard: 'Standard Rate (20%)',
      reduced: 'Reduced Rate (5%)',
      zero: 'Zero Rate (0%)',
      exempt: 'Exempt',
      'outside-scope': 'Outside Scope'
    },
    
    // Payment details
    paymentDetails: 'Payment Details',
    paymentTerms: 'Payment Terms',
    bankDetails: 'Bank Details',
    bankName: 'Bank',
    accountName: 'Account Name',
    accountNumber: 'Account Number',
    sortCode: 'Sort Code',
    iban: 'IBAN',
    swiftBic: 'SWIFT/BIC',
    
    // Status labels
    status: 'Status',
    statuses: {
      draft: 'DRAFT',
      pending: 'PENDING PAYMENT',
      paid: 'PAID',
      overdue: 'OVERDUE',
      cancelled: 'CANCELLED',
      refunded: 'REFUNDED'
    },
    
    // Notes section
    notes: 'Notes',
    termsAndConditions: 'Terms & Conditions',
    
    // Footer
    thankYou: 'Thank you for your business',
    paymentDue: 'Payment is due by',
    generatedOn: 'Generated on',
    
    // Currency
    currency: {
      GBP: '£',
      EUR: '€',
      USD: '$'
    }
  },
  
  tr: {
    // Document title
    title: 'FATURA',
    taxInvoice: 'VERGİ FATURASI',
    
    // Header labels
    invoiceNumber: 'Fatura Numarası',
    invoiceDate: 'Fatura Tarihi',
    dueDate: 'Son Ödeme Tarihi',
    taxPoint: 'Vergi Noktası',
    reference: 'Referans',
    page: 'Sayfa',
    of: '/',
    
    // Party labels
    from: 'Kimden',
    to: 'Kime',
    billTo: 'Fatura Adresi',
    
    // Company details
    vatNumber: 'KDV Numarası',
    companyNumber: 'Şirket No',
    email: 'E-posta',
    phone: 'Telefon',
    address: 'Adres',
    
    // Customer details
    customerVatNumber: 'Müşteri KDV No',
    
    // Line item table headers
    description: 'Açıklama',
    quantity: 'Miktar',
    unitPrice: 'Birim Fiyat',
    vatRate: 'KDV Oranı',
    vatAmount: 'KDV',
    amount: 'Tutar',
    lineTotal: 'Toplam',
    
    // Totals section
    subtotal: 'Ara Toplam (KDV hariç)',
    totalVat: 'Toplam KDV',
    grandTotal: 'Genel Toplam',
    
    // VAT breakdown
    vatBreakdown: 'KDV Dökümü',
    vatRateLabel: 'Oran',
    netAmount: 'Net Tutar',
    
    // VAT rate names
    vatRates: {
      standard: 'Standart Oran (%20)',
      reduced: 'İndirimli Oran (%5)',
      zero: 'Sıfır Oran (%0)',
      exempt: 'Muaf',
      'outside-scope': 'Kapsam Dışı'
    },
    
    // Payment details
    paymentDetails: 'Ödeme Detayları',
    paymentTerms: 'Ödeme Koşulları',
    bankDetails: 'Banka Bilgileri',
    bankName: 'Banka',
    accountName: 'Hesap Adı',
    accountNumber: 'Hesap Numarası',
    sortCode: 'Sort Kodu',
    iban: 'IBAN',
    swiftBic: 'SWIFT/BIC',
    
    // Status labels
    status: 'Durum',
    statuses: {
      draft: 'TASLAK',
      pending: 'ÖDEME BEKLİYOR',
      paid: 'ÖDENDİ',
      overdue: 'GECİKMİŞ',
      cancelled: 'İPTAL EDİLDİ',
      refunded: 'İADE EDİLDİ'
    },
    
    // Notes section
    notes: 'Notlar',
    termsAndConditions: 'Şartlar ve Koşullar',
    
    // Footer
    thankYou: 'İşiniz için teşekkür ederiz',
    paymentDue: 'Ödeme son tarihi',
    generatedOn: 'Oluşturulma tarihi',
    
    // Currency
    currency: {
      GBP: '£',
      EUR: '€',
      USD: '$'
    }
  }
};

/**
 * Gets labels for a specific language.
 * 
 * @param {string} [lang='en'] - Language code ('en' or 'tr')
 * @returns {Object} Labels for the specified language
 */
function getLabels(lang = 'en') {
  return labels[lang] || labels.en;
}

/**
 * Gets the currency symbol for a currency code.
 * 
 * @param {string} currencyCode - Currency code (GBP, EUR, USD)
 * @param {string} [lang='en'] - Language code
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currencyCode, lang = 'en') {
  const l = getLabels(lang);
  return l.currency[currencyCode] || currencyCode + ' ';
}

/**
 * Gets the VAT rate display name.
 * 
 * @param {string} vatRateId - VAT rate identifier
 * @param {string} [lang='en'] - Language code
 * @returns {string} VAT rate display name
 */
function getVatRateName(vatRateId, lang = 'en') {
  const l = getLabels(lang);
  return l.vatRates[vatRateId] || `${vatRateId}%`;
}

/**
 * Gets the status display label.
 * 
 * @param {string} status - Invoice status
 * @param {string} [lang='en'] - Language code
 * @returns {string} Status display label
 */
function getStatusLabel(status, lang = 'en') {
  const l = getLabels(lang);
  return l.statuses[status] || status.toUpperCase();
}

/**
 * PDF color theme for invoices.
 * @type {Object}
 */
const colors = {
  primary: '#1a365d',        // Dark blue for headers
  secondary: '#2b6cb0',      // Medium blue for accents
  text: '#1a202c',           // Near black for main text
  textLight: '#4a5568',      // Gray for secondary text
  border: '#e2e8f0',         // Light gray for borders
  background: '#f7fafc',     // Very light gray for backgrounds
  headerBg: '#edf2f7',       // Light blue-gray for table headers
  white: '#ffffff',
  
  // Status colors
  statusDraft: '#718096',     // Gray
  statusPending: '#d69e2e',   // Amber
  statusPaid: '#38a169',      // Green
  statusOverdue: '#e53e3e',   // Red
  statusCancelled: '#a0aec0', // Gray
  statusRefunded: '#805ad5'   // Purple
};

/**
 * Gets the color for an invoice status.
 * 
 * @param {string} status - Invoice status
 * @returns {string} Hex color code
 */
function getStatusColor(status) {
  const statusColors = {
    draft: colors.statusDraft,
    pending: colors.statusPending,
    paid: colors.statusPaid,
    overdue: colors.statusOverdue,
    cancelled: colors.statusCancelled,
    refunded: colors.statusRefunded
  };
  return statusColors[status] || colors.textLight;
}

/**
 * PDF font settings.
 * @type {Object}
 */
const fonts = {
  // Use built-in fonts for pdfkit
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique'
};

/**
 * PDF layout settings.
 * @type {Object}
 */
const layout = {
  pageSize: 'A4',
  margins: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50
  },
  
  // Header dimensions
  headerHeight: 100,
  logoMaxWidth: 120,
  logoMaxHeight: 60,
  
  // Table settings
  tableHeaderHeight: 25,
  tableRowHeight: 22,
  tableColumnWidths: {
    description: 200,
    quantity: 50,
    unitPrice: 80,
    vatRate: 60,
    vatAmount: 70,
    lineTotal: 80
  },
  
  // Spacing
  sectionSpacing: 20,
  lineSpacing: 5
};

/**
 * Default payment terms text.
 * @type {Object}
 */
const defaultPaymentTerms = {
  en: 'Payment is due within 30 days of the invoice date. Bank transfer is the preferred method of payment. Please quote the invoice number as the payment reference.',
  tr: 'Ödeme, fatura tarihinden itibaren 30 gün içinde yapılmalıdır. Banka havalesi tercih edilen ödeme yöntemidir. Lütfen ödeme referansı olarak fatura numarasını belirtiniz.'
};

/**
 * Gets default payment terms.
 * 
 * @param {string} [lang='en'] - Language code
 * @returns {string} Payment terms text
 */
function getDefaultPaymentTerms(lang = 'en') {
  return defaultPaymentTerms[lang] || defaultPaymentTerms.en;
}

module.exports = {
  labels,
  getLabels,
  getCurrencySymbol,
  getVatRateName,
  getStatusLabel,
  getStatusColor,
  colors,
  fonts,
  layout,
  defaultPaymentTerms,
  getDefaultPaymentTerms
};
