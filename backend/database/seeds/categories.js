/**
 * UK Chart of Accounts Seed Data
 * 
 * This file contains the pre-defined UK accounting categories
 * based on a simplified UK chart of accounts suitable for
 * small businesses and sole traders.
 * 
 * @module seeds/categories
 */

const { openDatabase, closeDatabase } = require('../index');
const { runMigrations } = require('../migrate');

/**
 * UK Chart of Accounts Categories
 * 
 * Category codes follow a standard numbering convention:
 * - 1xxx: Assets
 * - 2xxx: Liabilities
 * - 3xxx: Equity
 * - 4xxx: Income/Revenue
 * - 5xxx: Cost of Sales
 * - 6xxx: Operating Expenses
 * - 7xxx: Other Expenses
 * - 8xxx: Other Income
 * - 9xxx: Tax
 */
const ukCategories = [
  // ============= ASSETS (1xxx) =============
  {
    code: '1000',
    name: 'Assets',
    nameTr: 'Varlıklar',
    description: 'Resources owned by the business',
    type: 'asset',
    parentId: null,
    isSystem: true,
    displayOrder: 100,
    vatApplicable: false,
    defaultVatRate: 0
  },
  // Current Assets
  {
    code: '1100',
    name: 'Current Assets',
    nameTr: 'Dönen Varlıklar',
    description: 'Assets expected to be converted to cash within one year',
    type: 'asset',
    parentCode: '1000',
    isSystem: true,
    displayOrder: 110,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '1110',
    name: 'Cash at Bank',
    nameTr: 'Banka Hesabı',
    description: 'Money held in business bank accounts',
    type: 'asset',
    parentCode: '1100',
    isSystem: true,
    displayOrder: 111,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '1120',
    name: 'Petty Cash',
    nameTr: 'Kasa',
    description: 'Small amounts of cash kept on hand',
    type: 'asset',
    parentCode: '1100',
    isSystem: true,
    displayOrder: 112,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '1130',
    name: 'Trade Debtors',
    nameTr: 'Ticari Alacaklar',
    description: 'Money owed by customers for goods/services sold on credit',
    type: 'asset',
    parentCode: '1100',
    isSystem: true,
    displayOrder: 113,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '1140',
    name: 'Stock/Inventory',
    nameTr: 'Stok/Envanter',
    description: 'Goods held for sale or materials for production',
    type: 'asset',
    parentCode: '1100',
    isSystem: true,
    displayOrder: 114,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '1150',
    name: 'Prepayments',
    nameTr: 'Peşin Ödemeler',
    description: 'Payments made in advance for goods or services',
    type: 'asset',
    parentCode: '1100',
    isSystem: true,
    displayOrder: 115,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '1160',
    name: 'VAT Receivable',
    nameTr: 'Alınacak KDV',
    description: 'VAT owed to the business by HMRC',
    type: 'asset',
    parentCode: '1100',
    isSystem: true,
    displayOrder: 116,
    vatApplicable: false,
    defaultVatRate: 0
  },
  // Fixed Assets
  {
    code: '1200',
    name: 'Fixed Assets',
    nameTr: 'Duran Varlıklar',
    description: 'Long-term assets used in the business',
    type: 'asset',
    parentCode: '1000',
    isSystem: true,
    displayOrder: 120,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '1210',
    name: 'Office Equipment',
    nameTr: 'Ofis Ekipmanları',
    description: 'Computers, printers, furniture, etc.',
    type: 'asset',
    parentCode: '1200',
    isSystem: true,
    displayOrder: 121,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '1220',
    name: 'Motor Vehicles',
    nameTr: 'Motorlu Araçlar',
    description: 'Cars, vans, and other vehicles used for business',
    type: 'asset',
    parentCode: '1200',
    isSystem: true,
    displayOrder: 122,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '1230',
    name: 'Plant and Machinery',
    nameTr: 'Tesis ve Makineler',
    description: 'Manufacturing equipment and machinery',
    type: 'asset',
    parentCode: '1200',
    isSystem: true,
    displayOrder: 123,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '1240',
    name: 'Fixtures and Fittings',
    nameTr: 'Demirbaşlar',
    description: 'Shop fittings, signage, leasehold improvements',
    type: 'asset',
    parentCode: '1200',
    isSystem: true,
    displayOrder: 124,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '1290',
    name: 'Accumulated Depreciation',
    nameTr: 'Birikmiş Amortisman',
    description: 'Total depreciation of fixed assets',
    type: 'asset',
    parentCode: '1200',
    isSystem: true,
    displayOrder: 129,
    vatApplicable: false,
    defaultVatRate: 0
  },

  // ============= LIABILITIES (2xxx) =============
  {
    code: '2000',
    name: 'Liabilities',
    nameTr: 'Borçlar',
    description: 'Debts and obligations of the business',
    type: 'liability',
    parentId: null,
    isSystem: true,
    displayOrder: 200,
    vatApplicable: false,
    defaultVatRate: 0
  },
  // Current Liabilities
  {
    code: '2100',
    name: 'Current Liabilities',
    nameTr: 'Kısa Vadeli Borçlar',
    description: 'Debts due within one year',
    type: 'liability',
    parentCode: '2000',
    isSystem: true,
    displayOrder: 210,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2110',
    name: 'Trade Creditors',
    nameTr: 'Ticari Borçlar',
    description: 'Money owed to suppliers',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 211,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2120',
    name: 'Accruals',
    nameTr: 'Tahakkuklar',
    description: 'Expenses incurred but not yet invoiced',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 212,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2130',
    name: 'VAT Payable',
    nameTr: 'Ödenecek KDV',
    description: 'VAT owed to HMRC',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 213,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2140',
    name: 'PAYE/NI Payable',
    nameTr: 'PAYE/NI Ödemeleri',
    description: 'Income tax and National Insurance owed to HMRC',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 214,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2150',
    name: 'Corporation Tax Payable',
    nameTr: 'Kurumlar Vergisi',
    description: 'Corporation tax owed to HMRC',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 215,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2160',
    name: 'Wages Payable',
    nameTr: 'Ödenecek Maaşlar',
    description: 'Unpaid wages and salaries',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 216,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2170',
    name: 'Credit Card',
    nameTr: 'Kredi Kartı',
    description: 'Business credit card balances',
    type: 'liability',
    parentCode: '2100',
    isSystem: true,
    displayOrder: 217,
    vatApplicable: false,
    defaultVatRate: 0
  },
  // Long-term Liabilities
  {
    code: '2200',
    name: 'Long-term Liabilities',
    nameTr: 'Uzun Vadeli Borçlar',
    description: 'Debts due after more than one year',
    type: 'liability',
    parentCode: '2000',
    isSystem: true,
    displayOrder: 220,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2210',
    name: 'Bank Loans',
    nameTr: 'Banka Kredileri',
    description: 'Long-term bank loans',
    type: 'liability',
    parentCode: '2200',
    isSystem: true,
    displayOrder: 221,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '2220',
    name: 'Director\'s Loan',
    nameTr: 'Yönetici Kredisi',
    description: 'Loans from company directors',
    type: 'liability',
    parentCode: '2200',
    isSystem: true,
    displayOrder: 222,
    vatApplicable: false,
    defaultVatRate: 0
  },

  // ============= EQUITY (3xxx) =============
  {
    code: '3000',
    name: 'Equity',
    nameTr: 'Öz Sermaye',
    description: 'Owner\'s stake in the business',
    type: 'equity',
    parentId: null,
    isSystem: true,
    displayOrder: 300,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '3100',
    name: 'Share Capital',
    nameTr: 'Sermaye',
    description: 'Money invested by shareholders',
    type: 'equity',
    parentCode: '3000',
    isSystem: true,
    displayOrder: 310,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '3200',
    name: 'Retained Earnings',
    nameTr: 'Dağıtılmamış Kârlar',
    description: 'Accumulated profits not distributed as dividends',
    type: 'equity',
    parentCode: '3000',
    isSystem: true,
    displayOrder: 320,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '3300',
    name: 'Dividends',
    nameTr: 'Temettüler',
    description: 'Profits distributed to shareholders',
    type: 'equity',
    parentCode: '3000',
    isSystem: true,
    displayOrder: 330,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '3400',
    name: 'Owner\'s Drawings',
    nameTr: 'Şahsi Harcamalar',
    description: 'Money withdrawn by sole traders/partners',
    type: 'equity',
    parentCode: '3000',
    isSystem: true,
    displayOrder: 340,
    vatApplicable: false,
    defaultVatRate: 0
  },

  // ============= INCOME (4xxx) =============
  {
    code: '4000',
    name: 'Income',
    nameTr: 'Gelirler',
    description: 'Revenue from business activities',
    type: 'income',
    parentId: null,
    isSystem: true,
    displayOrder: 400,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '4100',
    name: 'Sales',
    nameTr: 'Satışlar',
    description: 'Revenue from sale of goods',
    type: 'income',
    parentCode: '4000',
    isSystem: true,
    displayOrder: 410,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '4200',
    name: 'Service Revenue',
    nameTr: 'Hizmet Gelirleri',
    description: 'Revenue from services provided',
    type: 'income',
    parentCode: '4000',
    isSystem: true,
    displayOrder: 420,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '4300',
    name: 'Consulting Income',
    nameTr: 'Danışmanlık Gelirleri',
    description: 'Revenue from consulting services',
    type: 'income',
    parentCode: '4000',
    isSystem: true,
    displayOrder: 430,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '4400',
    name: 'Commission Received',
    nameTr: 'Alınan Komisyonlar',
    description: 'Commission income',
    type: 'income',
    parentCode: '4000',
    isSystem: true,
    displayOrder: 440,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '4500',
    name: 'Discount Received',
    nameTr: 'Alınan İskontolar',
    description: 'Discounts received from suppliers',
    type: 'income',
    parentCode: '4000',
    isSystem: true,
    displayOrder: 450,
    vatApplicable: false,
    defaultVatRate: 0
  },

  // ============= COST OF SALES (5xxx) =============
  {
    code: '5000',
    name: 'Cost of Sales',
    nameTr: 'Satışların Maliyeti',
    description: 'Direct costs of goods sold',
    type: 'expense',
    parentId: null,
    isSystem: true,
    displayOrder: 500,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '5100',
    name: 'Purchases',
    nameTr: 'Satın Almalar',
    description: 'Cost of goods purchased for resale',
    type: 'expense',
    parentCode: '5000',
    isSystem: true,
    displayOrder: 510,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '5200',
    name: 'Materials',
    nameTr: 'Malzemeler',
    description: 'Raw materials for production',
    type: 'expense',
    parentCode: '5000',
    isSystem: true,
    displayOrder: 520,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '5300',
    name: 'Direct Labour',
    nameTr: 'Doğrudan İşçilik',
    description: 'Wages for production staff',
    type: 'expense',
    parentCode: '5000',
    isSystem: true,
    displayOrder: 530,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '5400',
    name: 'Subcontractor Costs',
    nameTr: 'Taşeron Maliyetleri',
    description: 'Costs of subcontractors',
    type: 'expense',
    parentCode: '5000',
    isSystem: true,
    displayOrder: 540,
    vatApplicable: true,
    defaultVatRate: 2000
  },

  // ============= OPERATING EXPENSES (6xxx) =============
  {
    code: '6000',
    name: 'Operating Expenses',
    nameTr: 'Faaliyet Giderleri',
    description: 'Costs of running the business',
    type: 'expense',
    parentId: null,
    isSystem: true,
    displayOrder: 600,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Premises
  {
    code: '6100',
    name: 'Premises Costs',
    nameTr: 'İşyeri Giderleri',
    description: 'Costs related to business premises',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 610,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6110',
    name: 'Rent',
    nameTr: 'Kira',
    description: 'Rent for business premises',
    type: 'expense',
    parentCode: '6100',
    isSystem: true,
    displayOrder: 611,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6120',
    name: 'Business Rates',
    nameTr: 'İşletme Vergileri',
    description: 'Local council business rates',
    type: 'expense',
    parentCode: '6100',
    isSystem: true,
    displayOrder: 612,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6130',
    name: 'Utilities',
    nameTr: 'Faturalar',
    description: 'Electricity, gas, water',
    type: 'expense',
    parentCode: '6100',
    isSystem: true,
    displayOrder: 613,
    vatApplicable: true,
    defaultVatRate: 500
  },
  {
    code: '6140',
    name: 'Insurance - Premises',
    nameTr: 'Bina Sigortası',
    description: 'Building and contents insurance',
    type: 'expense',
    parentCode: '6100',
    isSystem: true,
    displayOrder: 614,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6150',
    name: 'Repairs and Maintenance',
    nameTr: 'Onarım ve Bakım',
    description: 'Repairs and maintenance of premises',
    type: 'expense',
    parentCode: '6100',
    isSystem: true,
    displayOrder: 615,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Staff Costs
  {
    code: '6200',
    name: 'Staff Costs',
    nameTr: 'Personel Giderleri',
    description: 'Employee-related costs',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 620,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6210',
    name: 'Wages and Salaries',
    nameTr: 'Ücret ve Maaşlar',
    description: 'Gross wages and salaries',
    type: 'expense',
    parentCode: '6200',
    isSystem: true,
    displayOrder: 621,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6220',
    name: 'Employer\'s NI',
    nameTr: 'İşveren NI Payı',
    description: 'Employer\'s National Insurance contributions',
    type: 'expense',
    parentCode: '6200',
    isSystem: true,
    displayOrder: 622,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6230',
    name: 'Pension Contributions',
    nameTr: 'Emeklilik Katkıları',
    description: 'Employer pension contributions',
    type: 'expense',
    parentCode: '6200',
    isSystem: true,
    displayOrder: 623,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6240',
    name: 'Staff Training',
    nameTr: 'Personel Eğitimi',
    description: 'Training and development costs',
    type: 'expense',
    parentCode: '6200',
    isSystem: true,
    displayOrder: 624,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6250',
    name: 'Staff Welfare',
    nameTr: 'Personel Refahı',
    description: 'Staff benefits and welfare',
    type: 'expense',
    parentCode: '6200',
    isSystem: true,
    displayOrder: 625,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Administrative
  {
    code: '6300',
    name: 'Administrative Costs',
    nameTr: 'İdari Giderler',
    description: 'General administrative expenses',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 630,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6310',
    name: 'Office Supplies',
    nameTr: 'Ofis Malzemeleri',
    description: 'Stationery and office supplies',
    type: 'expense',
    parentCode: '6300',
    isSystem: true,
    displayOrder: 631,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6320',
    name: 'Telephone and Internet',
    nameTr: 'Telefon ve İnternet',
    description: 'Phone and internet costs',
    type: 'expense',
    parentCode: '6300',
    isSystem: true,
    displayOrder: 632,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6330',
    name: 'Software and Subscriptions',
    nameTr: 'Yazılım ve Abonelikler',
    description: 'Software licenses and subscriptions',
    type: 'expense',
    parentCode: '6300',
    isSystem: true,
    displayOrder: 633,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6340',
    name: 'Postage and Courier',
    nameTr: 'Posta ve Kurye',
    description: 'Postage and courier costs',
    type: 'expense',
    parentCode: '6300',
    isSystem: true,
    displayOrder: 634,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6350',
    name: 'Printing',
    nameTr: 'Baskı',
    description: 'Printing costs',
    type: 'expense',
    parentCode: '6300',
    isSystem: true,
    displayOrder: 635,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Motor Expenses
  {
    code: '6400',
    name: 'Motor Expenses',
    nameTr: 'Araç Giderleri',
    description: 'Vehicle-related costs',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 640,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6410',
    name: 'Fuel',
    nameTr: 'Yakıt',
    description: 'Petrol, diesel, or electric charging',
    type: 'expense',
    parentCode: '6400',
    isSystem: true,
    displayOrder: 641,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6420',
    name: 'Vehicle Insurance',
    nameTr: 'Araç Sigortası',
    description: 'Motor vehicle insurance',
    type: 'expense',
    parentCode: '6400',
    isSystem: true,
    displayOrder: 642,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6430',
    name: 'Vehicle Repairs',
    nameTr: 'Araç Tamiri',
    description: 'Vehicle repairs and servicing',
    type: 'expense',
    parentCode: '6400',
    isSystem: true,
    displayOrder: 643,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6440',
    name: 'Road Tax',
    nameTr: 'Yol Vergisi',
    description: 'Vehicle road tax',
    type: 'expense',
    parentCode: '6400',
    isSystem: true,
    displayOrder: 644,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6450',
    name: 'Parking',
    nameTr: 'Park',
    description: 'Parking fees',
    type: 'expense',
    parentCode: '6400',
    isSystem: true,
    displayOrder: 645,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Travel
  {
    code: '6500',
    name: 'Travel and Subsistence',
    nameTr: 'Seyahat ve Konaklama',
    description: 'Business travel costs',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 650,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6510',
    name: 'UK Travel',
    nameTr: 'Yurt İçi Seyahat',
    description: 'Domestic travel costs',
    type: 'expense',
    parentCode: '6500',
    isSystem: true,
    displayOrder: 651,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6520',
    name: 'Overseas Travel',
    nameTr: 'Yurt Dışı Seyahat',
    description: 'International travel costs',
    type: 'expense',
    parentCode: '6500',
    isSystem: true,
    displayOrder: 652,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6530',
    name: 'Hotels and Accommodation',
    nameTr: 'Otel ve Konaklama',
    description: 'Accommodation costs',
    type: 'expense',
    parentCode: '6500',
    isSystem: true,
    displayOrder: 653,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6540',
    name: 'Subsistence',
    nameTr: 'Harcırah',
    description: 'Meals and subsistence while travelling',
    type: 'expense',
    parentCode: '6500',
    isSystem: true,
    displayOrder: 654,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Professional Fees
  {
    code: '6600',
    name: 'Professional Fees',
    nameTr: 'Profesyonel Ücretler',
    description: 'Professional services costs',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 660,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6610',
    name: 'Accountancy Fees',
    nameTr: 'Muhasebe Ücretleri',
    description: 'Accountant and bookkeeping fees',
    type: 'expense',
    parentCode: '6600',
    isSystem: true,
    displayOrder: 661,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6620',
    name: 'Legal Fees',
    nameTr: 'Hukuki Ücretler',
    description: 'Solicitor and legal fees',
    type: 'expense',
    parentCode: '6600',
    isSystem: true,
    displayOrder: 662,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6630',
    name: 'Consultancy Fees',
    nameTr: 'Danışmanlık Ücretleri',
    description: 'Business consultancy fees',
    type: 'expense',
    parentCode: '6600',
    isSystem: true,
    displayOrder: 663,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Marketing
  {
    code: '6700',
    name: 'Marketing and Advertising',
    nameTr: 'Pazarlama ve Reklam',
    description: 'Marketing and advertising costs',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 670,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6710',
    name: 'Advertising',
    nameTr: 'Reklam',
    description: 'Advertising costs',
    type: 'expense',
    parentCode: '6700',
    isSystem: true,
    displayOrder: 671,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6720',
    name: 'Website Costs',
    nameTr: 'Web Sitesi Giderleri',
    description: 'Website hosting and maintenance',
    type: 'expense',
    parentCode: '6700',
    isSystem: true,
    displayOrder: 672,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6730',
    name: 'Promotional Materials',
    nameTr: 'Tanıtım Malzemeleri',
    description: 'Brochures, business cards, etc.',
    type: 'expense',
    parentCode: '6700',
    isSystem: true,
    displayOrder: 673,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  // Other Operating
  {
    code: '6800',
    name: 'Other Operating Expenses',
    nameTr: 'Diğer Faaliyet Giderleri',
    description: 'Miscellaneous operating costs',
    type: 'expense',
    parentCode: '6000',
    isSystem: true,
    displayOrder: 680,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6810',
    name: 'Bank Charges',
    nameTr: 'Banka Masrafları',
    description: 'Bank fees and charges',
    type: 'expense',
    parentCode: '6800',
    isSystem: true,
    displayOrder: 681,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6820',
    name: 'Bad Debts',
    nameTr: 'Şüpheli Alacaklar',
    description: 'Debts written off as uncollectable',
    type: 'expense',
    parentCode: '6800',
    isSystem: true,
    displayOrder: 682,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6830',
    name: 'Depreciation',
    nameTr: 'Amortisman',
    description: 'Depreciation of fixed assets',
    type: 'expense',
    parentCode: '6800',
    isSystem: true,
    displayOrder: 683,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6840',
    name: 'Professional Indemnity Insurance',
    nameTr: 'Mesleki Sorumluluk Sigortası',
    description: 'Professional indemnity cover',
    type: 'expense',
    parentCode: '6800',
    isSystem: true,
    displayOrder: 684,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '6850',
    name: 'Sundry Expenses',
    nameTr: 'Çeşitli Giderler',
    description: 'Miscellaneous small expenses',
    type: 'expense',
    parentCode: '6800',
    isSystem: true,
    displayOrder: 685,
    vatApplicable: true,
    defaultVatRate: 2000
  },
  {
    code: '6860',
    name: 'Entertainment',
    nameTr: 'Temsil ve Ağırlama',
    description: 'Business entertainment (non-deductible)',
    type: 'expense',
    parentCode: '6800',
    isSystem: true,
    displayOrder: 686,
    vatApplicable: true,
    defaultVatRate: 2000
  },

  // ============= OTHER EXPENSES (7xxx) =============
  {
    code: '7000',
    name: 'Finance Costs',
    nameTr: 'Finansman Giderleri',
    description: 'Interest and finance-related expenses',
    type: 'expense',
    parentId: null,
    isSystem: true,
    displayOrder: 700,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '7100',
    name: 'Loan Interest',
    nameTr: 'Kredi Faizi',
    description: 'Interest on business loans',
    type: 'expense',
    parentCode: '7000',
    isSystem: true,
    displayOrder: 710,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '7200',
    name: 'HP Interest',
    nameTr: 'Taksitli Satış Faizi',
    description: 'Interest on hire purchase agreements',
    type: 'expense',
    parentCode: '7000',
    isSystem: true,
    displayOrder: 720,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '7300',
    name: 'Lease Payments',
    nameTr: 'Kira Ödemeleri',
    description: 'Equipment lease payments',
    type: 'expense',
    parentCode: '7000',
    isSystem: true,
    displayOrder: 730,
    vatApplicable: true,
    defaultVatRate: 2000
  },

  // ============= OTHER INCOME (8xxx) =============
  {
    code: '8000',
    name: 'Other Income',
    nameTr: 'Diğer Gelirler',
    description: 'Non-operating income',
    type: 'income',
    parentId: null,
    isSystem: true,
    displayOrder: 800,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '8100',
    name: 'Interest Received',
    nameTr: 'Alınan Faiz',
    description: 'Interest earned on bank accounts',
    type: 'income',
    parentCode: '8000',
    isSystem: true,
    displayOrder: 810,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '8200',
    name: 'Rent Received',
    nameTr: 'Alınan Kira',
    description: 'Rental income from property',
    type: 'income',
    parentCode: '8000',
    isSystem: true,
    displayOrder: 820,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '8300',
    name: 'Profit on Asset Disposal',
    nameTr: 'Varlık Satış Kârı',
    description: 'Profit from sale of fixed assets',
    type: 'income',
    parentCode: '8000',
    isSystem: true,
    displayOrder: 830,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '8400',
    name: 'Grants Received',
    nameTr: 'Alınan Hibeler',
    description: 'Government and other grants',
    type: 'income',
    parentCode: '8000',
    isSystem: true,
    displayOrder: 840,
    vatApplicable: false,
    defaultVatRate: 0
  },

  // ============= TAX (9xxx) =============
  {
    code: '9000',
    name: 'Taxation',
    nameTr: 'Vergilendirme',
    description: 'Tax-related accounts',
    type: 'expense',
    parentId: null,
    isSystem: true,
    displayOrder: 900,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '9100',
    name: 'Corporation Tax',
    nameTr: 'Kurumlar Vergisi',
    description: 'Corporation tax expense',
    type: 'expense',
    parentCode: '9000',
    isSystem: true,
    displayOrder: 910,
    vatApplicable: false,
    defaultVatRate: 0
  },
  {
    code: '9200',
    name: 'Income Tax',
    nameTr: 'Gelir Vergisi',
    description: 'Self-employed income tax',
    type: 'expense',
    parentCode: '9000',
    isSystem: true,
    displayOrder: 920,
    vatApplicable: false,
    defaultVatRate: 0
  }
];

/**
 * Seeds the categories table with UK chart of accounts.
 * 
 * @param {import('better-sqlite3').Database} [db] - Database instance (optional)
 * @returns {{success: boolean, created: number, errors: string[]}}
 */
function seedCategories(db) {
  const database = db || openDatabase();
  const results = {
    success: true,
    created: 0,
    errors: []
  };

  try {
    // Create a map to resolve parent codes to IDs
    const codeToIdMap = new Map();

    database.transaction(() => {
      // First pass: insert all categories and build code-to-id map
      for (const category of ukCategories) {
        const insertData = {
          code: category.code.trim().toUpperCase(),
          name: category.name.trim(),
          nameTr: category.nameTr?.trim() || null,
          description: category.description?.trim() || null,
          type: category.type,
          parentId: null, // Will be updated in second pass
          isSystem: category.isSystem ? 1 : 0,
          isActive: 1,
          displayOrder: category.displayOrder || 0,
          vatApplicable: category.vatApplicable ? 1 : 0,
          defaultVatRate: category.defaultVatRate || 0
        };

        const result = database.prepare(`
          INSERT INTO categories (
            code, name, nameTr, description, type,
            parentId, isSystem, isActive, displayOrder,
            vatApplicable, defaultVatRate
          ) VALUES (
            @code, @name, @nameTr, @description, @type,
            @parentId, @isSystem, @isActive, @displayOrder,
            @vatApplicable, @defaultVatRate
          )
        `).run(insertData);

        codeToIdMap.set(category.code, result.lastInsertRowid);
        results.created++;
      }

      // Second pass: update parent IDs
      for (const category of ukCategories) {
        if (category.parentCode) {
          const categoryId = codeToIdMap.get(category.code);
          const parentId = codeToIdMap.get(category.parentCode);
          
          if (categoryId && parentId) {
            database.prepare('UPDATE categories SET parentId = ? WHERE id = ?').run(parentId, categoryId);
          }
        }
      }
    })();

    console.log(`Seeded ${results.created} categories successfully.`);
  } catch (error) {
    console.error('Error seeding categories:', error.message);
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Clears and reseeds the categories table.
 * Warning: This will delete all existing categories!
 * 
 * @param {import('better-sqlite3').Database} [db] - Database instance (optional)
 * @returns {{success: boolean, created: number, errors: string[]}}
 */
function reseedCategories(db) {
  const database = db || openDatabase();
  
  try {
    database.prepare('DELETE FROM categories').run();
    return seedCategories(database);
  } catch (error) {
    console.error('Error reseeding categories:', error.message);
    return { success: false, created: 0, errors: [error.message] };
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';
  
  try {
    openDatabase();
    runMigrations();
    
    switch (command) {
      case 'seed':
        console.log('Seeding categories...');
        const seedResult = seedCategories();
        console.log(`Result: ${seedResult.created} categories created`);
        if (seedResult.errors.length > 0) {
          console.error('Errors:', seedResult.errors);
          process.exit(1);
        }
        break;
        
      case 'reseed':
        console.log('Reseeding categories (deleting existing)...');
        const reseedResult = reseedCategories();
        console.log(`Result: ${reseedResult.created} categories created`);
        if (reseedResult.errors.length > 0) {
          console.error('Errors:', reseedResult.errors);
          process.exit(1);
        }
        break;
        
      default:
        console.log('Usage: node categories.js [seed|reseed]');
        process.exit(1);
    }
  } finally {
    closeDatabase();
  }
}

module.exports = {
  ukCategories,
  seedCategories,
  reseedCategories
};
