/**
 * Reconciliation Report Template
 * Provides bilingual (English/Turkish) labels and formatting for reconciliation reports.
 * 
 * @module templates/reconciliationReport
 */

/**
 * Reconciliation report labels in both languages.
 * @type {Object}
 */
const labels = {
  en: {
    // Document title
    title: 'RECONCILIATION REPORT',
    subtitle: 'Bank Account Reconciliation Summary',
    
    // Report info
    generatedOn: 'Generated on',
    reportPeriod: 'Report Period',
    from: 'From',
    to: 'To',
    allDates: 'All Dates',
    page: 'Page',
    of: 'of',
    
    // Bank account section
    bankAccountDetails: 'Bank Account Details',
    accountName: 'Account Name',
    bankName: 'Bank Name',
    sortCode: 'Sort Code',
    accountNumber: 'Account Number',
    currency: 'Currency',
    
    // Summary section
    reconciliationSummary: 'Reconciliation Summary',
    totalTransactions: 'Total Transactions',
    reconciledTransactions: 'Reconciled Transactions',
    unreconciledTransactions: 'Unreconciled Transactions',
    excludedTransactions: 'Excluded Transactions',
    reconciliationProgress: 'Reconciliation Progress',
    lastReconciliation: 'Last Reconciliation',
    performedBy: 'Performed By',
    
    // Balance section
    balanceSummary: 'Balance Summary',
    bankStatementTotals: 'Bank Statement Totals',
    credits: 'Credits',
    debits: 'Debits',
    netBalance: 'Net Balance',
    reconciledTotals: 'Reconciled Totals',
    unreconciledTotals: 'Unreconciled Totals',
    excludedTotals: 'Excluded Totals',
    discrepancy: 'Discrepancy',
    balanced: 'Balanced',
    notBalanced: 'Not Balanced',
    
    // Reconciled pairs section
    reconciledPairs: 'Reconciled Transactions',
    bankTransaction: 'Bank Transaction',
    matchedTransaction: 'Matched Transaction',
    date: 'Date',
    description: 'Description',
    reference: 'Reference',
    type: 'Type',
    amount: 'Amount',
    credit: 'Credit',
    debit: 'Debit',
    matchType: 'Match Type',
    reconciledAt: 'Reconciled',
    reconciledBy: 'By',
    
    // Match types
    matchTypes: {
      exact: 'Exact Match',
      partial: 'Partial Match',
      manual: 'Manual Match',
      split: 'Split Match',
      combined: 'Combined Match'
    },
    
    // Unreconciled section
    unreconciledItems: 'Unreconciled Items',
    noUnreconciled: 'No unreconciled transactions',
    status: 'Status',
    notes: 'Notes',
    
    // Excluded section
    excludedItems: 'Excluded Items',
    noExcluded: 'No excluded transactions',
    reason: 'Reason',
    
    // Footer
    auditPurpose: 'This report is generated for audit purposes and record-keeping.',
    disclaimer: 'All amounts are shown in the account currency unless otherwise specified.',
    
    // Status labels
    statuses: {
      unmatched: 'Unmatched',
      partial: 'Partial',
      matched: 'Matched',
      excluded: 'Excluded'
    }
  },
  
  tr: {
    // Document title
    title: 'MUTABAKAT RAPORU',
    subtitle: 'Banka Hesabı Mutabakat Özeti',
    
    // Report info
    generatedOn: 'Oluşturulma Tarihi',
    reportPeriod: 'Rapor Dönemi',
    from: 'Başlangıç',
    to: 'Bitiş',
    allDates: 'Tüm Tarihler',
    page: 'Sayfa',
    of: '/',
    
    // Bank account section
    bankAccountDetails: 'Banka Hesap Bilgileri',
    accountName: 'Hesap Adı',
    bankName: 'Banka Adı',
    sortCode: 'Sort Kodu',
    accountNumber: 'Hesap Numarası',
    currency: 'Para Birimi',
    
    // Summary section
    reconciliationSummary: 'Mutabakat Özeti',
    totalTransactions: 'Toplam İşlem',
    reconciledTransactions: 'Mutabık İşlemler',
    unreconciledTransactions: 'Mutabık Olmayan İşlemler',
    excludedTransactions: 'Hariç Tutulan İşlemler',
    reconciliationProgress: 'Mutabakat İlerlemesi',
    lastReconciliation: 'Son Mutabakat',
    performedBy: 'Yapan',
    
    // Balance section
    balanceSummary: 'Bakiye Özeti',
    bankStatementTotals: 'Banka Ekstresi Toplamları',
    credits: 'Alacaklar',
    debits: 'Borçlar',
    netBalance: 'Net Bakiye',
    reconciledTotals: 'Mutabık Toplamlar',
    unreconciledTotals: 'Mutabık Olmayan Toplamlar',
    excludedTotals: 'Hariç Tutulan Toplamlar',
    discrepancy: 'Fark',
    balanced: 'Dengeli',
    notBalanced: 'Dengesiz',
    
    // Reconciled pairs section
    reconciledPairs: 'Mutabık İşlemler',
    bankTransaction: 'Banka İşlemi',
    matchedTransaction: 'Eşleşen İşlem',
    date: 'Tarih',
    description: 'Açıklama',
    reference: 'Referans',
    type: 'Tür',
    amount: 'Tutar',
    credit: 'Alacak',
    debit: 'Borç',
    matchType: 'Eşleşme Türü',
    reconciledAt: 'Mutabakat Tarihi',
    reconciledBy: 'Yapan',
    
    // Match types
    matchTypes: {
      exact: 'Tam Eşleşme',
      partial: 'Kısmi Eşleşme',
      manual: 'Manuel Eşleşme',
      split: 'Bölünmüş Eşleşme',
      combined: 'Birleşik Eşleşme'
    },
    
    // Unreconciled section
    unreconciledItems: 'Mutabık Olmayan Kalemler',
    noUnreconciled: 'Mutabık olmayan işlem yok',
    status: 'Durum',
    notes: 'Notlar',
    
    // Excluded section
    excludedItems: 'Hariç Tutulan Kalemler',
    noExcluded: 'Hariç tutulan işlem yok',
    reason: 'Sebep',
    
    // Footer
    auditPurpose: 'Bu rapor denetim amaçları ve kayıt tutma için oluşturulmuştur.',
    disclaimer: 'Aksi belirtilmedikçe tüm tutarlar hesap para biriminde gösterilmektedir.',
    
    // Status labels
    statuses: {
      unmatched: 'Eşleşmemiş',
      partial: 'Kısmi',
      matched: 'Eşleşmiş',
      excluded: 'Hariç'
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
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currencyCode) {
  const symbols = {
    GBP: '£',
    EUR: '€',
    USD: '$'
  };
  return symbols[currencyCode] || currencyCode + ' ';
}

/**
 * Gets the match type display name.
 * 
 * @param {string} matchType - Match type identifier
 * @param {string} [lang='en'] - Language code
 * @returns {string} Match type display name
 */
function getMatchTypeName(matchType, lang = 'en') {
  const l = getLabels(lang);
  return l.matchTypes[matchType] || matchType;
}

/**
 * Gets the status display label.
 * 
 * @param {string} status - Status identifier
 * @param {string} [lang='en'] - Language code
 * @returns {string} Status display label
 */
function getStatusLabel(status, lang = 'en') {
  const l = getLabels(lang);
  return l.statuses[status] || status;
}

/**
 * PDF color theme for reconciliation reports.
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
  success: '#38a169',        // Green for balanced
  warning: '#d69e2e',        // Amber for unreconciled
  error: '#e53e3e',          // Red for discrepancy
  muted: '#718096',          // Gray for excluded
  
  // Transaction type colors
  credit: '#38a169',         // Green for credits
  debit: '#e53e3e'           // Red for debits
};

/**
 * PDF font settings.
 * @type {Object}
 */
const fonts = {
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
  orientation: 'landscape',  // Better for reconciliation pairs
  margins: {
    top: 50,
    bottom: 50,
    left: 40,
    right: 40
  },
  
  // Section spacing
  sectionSpacing: 20,
  lineSpacing: 5,
  
  // Table settings
  tableHeaderHeight: 22,
  tableRowHeight: 18,
  
  // Font sizes
  fontSize: {
    title: 18,
    subtitle: 12,
    sectionHeader: 11,
    normal: 9,
    small: 8,
    tiny: 7
  }
};

module.exports = {
  labels,
  getLabels,
  getCurrencySymbol,
  getMatchTypeName,
  getStatusLabel,
  colors,
  fonts,
  layout
};
