/**
 * Self Assessment Service
 * 
 * Provides Self Assessment calculations for sole traders and partners.
 * Calculates estimated Income Tax and National Insurance (Class 2 and Class 4)
 * based on business profits.
 * 
 * All monetary values are in pence to avoid floating-point precision issues.
 * 
 * @module services/selfAssessmentService
 */

const { query, queryOne } = require('../database/index');
const { getTaxRatesForYear, getCurrentTaxRates } = require('../config/taxRates');

/**
 * UK tax year runs from April 6th to April 5th of the following year.
 * Default tax year for calculations.
 */
const DEFAULT_TAX_YEAR = '2025-26';

/**
 * Calculates the UK tax year for a given date.
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
 * Validates date range for Self Assessment report.
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

/**
 * Gets net profit from transactions for a given period.
 * Net profit = Total Income - Total Expenses
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {{income: number, expenses: number, netProfit: number}} All values in pence
 */
function getNetProfit(userId, startDate, endDate) {
  const result = queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' AND status != 'void' THEN amount ELSE 0 END), 0) as incomeAmount,
      COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'void' THEN amount ELSE 0 END), 0) as expenseAmount
    FROM transactions
    WHERE userId = ? AND transactionDate >= ? AND transactionDate <= ?
  `, [userId, startDate, endDate]);
  
  const income = result?.incomeAmount || 0;
  const expenses = result?.expenseAmount || 0;
  const netProfit = income - expenses;
  
  return {
    income,
    expenses,
    netProfit
  };
}

/**
 * Calculates adjusted personal allowance based on net profit.
 * Personal allowance is reduced by £1 for every £2 over £100,000.
 * 
 * @param {number} netProfitInPence - Net profit in pence
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {{
 *   baseAllowance: number,
 *   adjustedAllowance: number,
 *   reduction: number
 * }} All values in pence
 */
function calculatePersonalAllowance(netProfitInPence, taxYear = DEFAULT_TAX_YEAR) {
  const taxRates = getTaxRatesForYear(taxYear) || getCurrentTaxRates();
  const incomeConfig = taxRates.incomeTax.personalAllowance;
  
  // Convert from pounds to pence
  const baseAllowanceInPence = incomeConfig.amount * 100;
  const incomeLimitInPence = incomeConfig.incomeLimit * 100;
  const taperRate = incomeConfig.taperRate;
  
  if (netProfitInPence <= incomeLimitInPence) {
    return {
      baseAllowance: baseAllowanceInPence,
      adjustedAllowance: baseAllowanceInPence,
      reduction: 0
    };
  }
  
  // Reduce allowance by £1 for every £2 over the limit
  // excessIncome in pence, reduction = excessIncome * taperRate
  const excessIncome = netProfitInPence - incomeLimitInPence;
  // Calculate reduction: for every 200 pence (£2) over limit, reduce by 100 pence (£1)
  // taperRate is 0.5, so reduction = excessIncome * 0.5
  const reductionInPence = Math.floor(excessIncome * taperRate);
  
  const adjustedAllowance = Math.max(0, baseAllowanceInPence - reductionInPence);
  
  return {
    baseAllowance: baseAllowanceInPence,
    adjustedAllowance,
    reduction: reductionInPence
  };
}

/**
 * Calculates Income Tax for self-employed profits.
 * Uses UK income tax bands for England, Wales, and Northern Ireland.
 * 
 * @param {number} netProfitInPence - Net profit (taxable income from self-employment) in pence
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @param {boolean} isScottish - Whether to use Scottish tax rates
 * @returns {{
 *   taxableIncome: number,
 *   personalAllowance: {base: number, adjusted: number, reduction: number},
 *   totalTax: number,
 *   effectiveRate: number,
 *   bands: Array<{name: string, rate: number, taxableAmount: number, tax: number}>
 * }} All monetary values in pence
 */
function calculateIncomeTax(netProfitInPence, taxYear = DEFAULT_TAX_YEAR, isScottish = false) {
  const taxRates = getTaxRatesForYear(taxYear) || getCurrentTaxRates();
  
  // Get personal allowance
  const allowanceResult = calculatePersonalAllowance(netProfitInPence, taxYear);
  
  // Calculate taxable income after personal allowance
  const taxableIncome = Math.max(0, netProfitInPence - allowanceResult.adjustedAllowance);
  
  // Get appropriate tax bands
  const taxConfig = isScottish ? taxRates.scottishIncomeTax : taxRates.incomeTax;
  const bands = taxConfig.bands;
  
  // Calculate tax in each band
  let totalTax = 0;
  let remainingIncome = taxableIncome;
  const bandBreakdown = [];
  
  for (const band of bands) {
    if (band.rate === 0) continue;
    if (remainingIncome <= 0) break;
    
    // Calculate band width (adjusted for personal allowance already subtracted)
    // Band min and max are in pounds, convert to pence
    const bandMinInPence = band.min * 100;
    const bandMaxInPence = band.max !== null ? band.max * 100 : Infinity;
    
    // Adjust band boundaries relative to personal allowance
    // Since we've already subtracted personal allowance, adjust the bands
    const adjustedBandMin = Math.max(0, bandMinInPence - allowanceResult.adjustedAllowance);
    const adjustedBandMax = band.max !== null 
      ? Math.max(0, bandMaxInPence - allowanceResult.adjustedAllowance)
      : Infinity;
    
    const bandWidth = adjustedBandMax - adjustedBandMin;
    
    // Calculate how much of remaining income falls in this band
    const incomeInBand = Math.min(remainingIncome, bandWidth);
    
    if (incomeInBand > 0) {
      const taxInBand = Math.round(incomeInBand * band.rate);
      totalTax += taxInBand;
      
      bandBreakdown.push({
        name: band.name,
        rate: band.rate,
        ratePercent: Math.round(band.rate * 100 * 100) / 100, // e.g., 20.00
        taxableAmount: incomeInBand,
        tax: taxInBand,
        description: band.description
      });
      
      remainingIncome -= incomeInBand;
    }
  }
  
  // Calculate effective rate
  const effectiveRate = netProfitInPence > 0 
    ? Math.round((totalTax / netProfitInPence) * 10000) / 100 
    : 0;
  
  return {
    taxableIncome,
    personalAllowance: {
      base: allowanceResult.baseAllowance,
      adjusted: allowanceResult.adjustedAllowance,
      reduction: allowanceResult.reduction
    },
    totalTax,
    effectiveRate,
    bands: bandBreakdown
  };
}

/**
 * Calculates Class 2 National Insurance for self-employed.
 * Class 2 NI is a flat weekly rate, due if profits are above the Small Profits Threshold.
 * It is now voluntary below the threshold but required above.
 * 
 * @param {number} netProfitInPence - Annual net profit in pence
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {{
 *   isLiable: boolean,
 *   weeklyRate: number,
 *   annualAmount: number,
 *   smallProfitsThreshold: number,
 *   weeks: number,
 *   isVoluntary: boolean,
 *   description: {en: string, tr: string}
 * }} All monetary values in pence
 */
function calculateClass2NI(netProfitInPence, taxYear = DEFAULT_TAX_YEAR) {
  let taxRates = getTaxRatesForYear(taxYear);
  
  // Fall back to current tax year if requested year doesn't have Class 2 NI config
  if (!taxRates || !taxRates.nationalInsurance || !taxRates.nationalInsurance.class2) {
    taxRates = getCurrentTaxRates();
  }
  
  const class2Config = taxRates.nationalInsurance.class2;
  
  // Convert values to pence
  const weeklyRateInPence = Math.round(class2Config.weeklyRate * 100);
  const smallProfitsThresholdInPence = class2Config.smallProfitsThreshold * 100;
  
  // 52 weeks in a year (standard)
  const weeksInYear = 52;
  
  // Check if liable (profits above small profits threshold)
  const isLiable = netProfitInPence >= smallProfitsThresholdInPence;
  
  // Calculate annual amount
  const annualAmount = isLiable ? weeklyRateInPence * weeksInYear : 0;
  
  return {
    isLiable,
    weeklyRate: weeklyRateInPence,
    annualAmount,
    smallProfitsThreshold: smallProfitsThresholdInPence,
    weeks: weeksInYear,
    isVoluntary: class2Config.voluntary,
    description: class2Config.description
  };
}

/**
 * Calculates Class 4 National Insurance for self-employed profits.
 * - 6% on profits between Lower Profits Limit and Upper Profits Limit
 * - 2% on profits above Upper Profits Limit
 * 
 * @param {number} netProfitInPence - Annual net profit in pence
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {{
 *   lowerProfitsLimit: number,
 *   upperProfitsLimit: number,
 *   mainRateAmount: number,
 *   additionalRateAmount: number,
 *   totalAmount: number,
 *   mainRate: number,
 *   additionalRate: number,
 *   breakdown: Array<{band: string, from: number, to: number, rate: number, amount: number, tax: number}>
 * }} All monetary values in pence
 */
function calculateClass4NI(netProfitInPence, taxYear = DEFAULT_TAX_YEAR) {
  let taxRates = getTaxRatesForYear(taxYear);
  
  // Fall back to current tax year if requested year doesn't have Class 4 NI config
  if (!taxRates || !taxRates.nationalInsurance || !taxRates.nationalInsurance.class4) {
    taxRates = getCurrentTaxRates();
  }
  
  const class4Config = taxRates.nationalInsurance.class4;
  
  // Convert limits to pence
  const lowerProfitsLimitInPence = class4Config.lowerProfitsLimit * 100;
  const upperProfitsLimitInPence = class4Config.upperProfitsLimit * 100;
  
  const mainRate = class4Config.mainRate;
  const additionalRate = class4Config.additionalRate;
  
  const breakdown = [];
  let mainRateAmount = 0;
  let additionalRateAmount = 0;
  
  // Calculate main rate (6% between LPL and UPL)
  if (netProfitInPence > lowerProfitsLimitInPence) {
    const profitsForMainRate = Math.min(
      netProfitInPence - lowerProfitsLimitInPence,
      upperProfitsLimitInPence - lowerProfitsLimitInPence
    );
    
    if (profitsForMainRate > 0) {
      mainRateAmount = Math.round(profitsForMainRate * mainRate);
      breakdown.push({
        band: 'main',
        from: lowerProfitsLimitInPence,
        to: Math.min(netProfitInPence, upperProfitsLimitInPence),
        rate: mainRate,
        ratePercent: Math.round(mainRate * 100 * 100) / 100,
        amount: profitsForMainRate,
        tax: mainRateAmount,
        description: {
          en: `${Math.round(mainRate * 100)}% on profits between £${class4Config.lowerProfitsLimit.toLocaleString()} and £${class4Config.upperProfitsLimit.toLocaleString()}`,
          tr: `£${class4Config.lowerProfitsLimit.toLocaleString()} ve £${class4Config.upperProfitsLimit.toLocaleString()} arasındaki kârlar üzerinde %${Math.round(mainRate * 100)}`
        }
      });
    }
  }
  
  // Calculate additional rate (2% above UPL)
  if (netProfitInPence > upperProfitsLimitInPence) {
    const profitsForAdditionalRate = netProfitInPence - upperProfitsLimitInPence;
    
    additionalRateAmount = Math.round(profitsForAdditionalRate * additionalRate);
    breakdown.push({
      band: 'additional',
      from: upperProfitsLimitInPence,
      to: netProfitInPence,
      rate: additionalRate,
      ratePercent: Math.round(additionalRate * 100 * 100) / 100,
      amount: profitsForAdditionalRate,
      tax: additionalRateAmount,
      description: {
        en: `${Math.round(additionalRate * 100)}% on profits above £${class4Config.upperProfitsLimit.toLocaleString()}`,
        tr: `£${class4Config.upperProfitsLimit.toLocaleString()} üzerindeki kârlar üzerinde %${Math.round(additionalRate * 100)}`
      }
    });
  }
  
  const totalAmount = mainRateAmount + additionalRateAmount;
  
  return {
    lowerProfitsLimit: lowerProfitsLimitInPence,
    upperProfitsLimit: upperProfitsLimitInPence,
    mainRateAmount,
    additionalRateAmount,
    totalAmount,
    mainRate,
    additionalRate,
    breakdown,
    description: class4Config.description
  };
}

/**
 * Calculates Self Assessment payment deadlines.
 * 
 * Key dates:
 * - 5 October after tax year ends: Register for Self Assessment (if new)
 * - 31 October after tax year ends: Paper return deadline
 * - 31 January following tax year end: Online return deadline & Payment deadline
 * - 31 July following: Second payment on account deadline
 * 
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @returns {{
 *   taxYear: string,
 *   registrationDeadline: string,
 *   paperReturnDeadline: string,
 *   onlineReturnDeadline: string,
 *   paymentDeadline: string,
 *   secondPaymentOnAccount: string,
 *   deadlines: Array<{date: string, description: {en: string, tr: string}}>
 * }}
 */
function calculateDeadlines(taxYear) {
  const [startYear] = taxYear.split('-').map(Number);
  const endYear = startYear + 1;
  
  // Tax year runs from April 6 startYear to April 5 endYear
  // Deadlines are relative to when the tax year ends
  
  const registrationDeadline = `${endYear}-10-05`; // 5 October after tax year ends
  const paperReturnDeadline = `${endYear}-10-31`;  // 31 October after tax year ends
  const onlineReturnDeadline = `${endYear + 1}-01-31`; // 31 January following tax year end
  const paymentDeadline = `${endYear + 1}-01-31`; // Same as online return deadline
  const secondPaymentOnAccount = `${endYear + 1}-07-31`; // 31 July following
  
  const deadlines = [
    {
      date: registrationDeadline,
      type: 'registration',
      description: {
        en: 'Register for Self Assessment (if new self-employed)',
        tr: 'Serbest Meslek Beyannamesi için kayıt (yeni serbest çalışanlar için)'
      }
    },
    {
      date: paperReturnDeadline,
      type: 'paper_return',
      description: {
        en: 'Paper tax return deadline',
        tr: 'Kağıt vergi beyannamesi son tarihi'
      }
    },
    {
      date: onlineReturnDeadline,
      type: 'online_return',
      description: {
        en: 'Online tax return deadline',
        tr: 'Online vergi beyannamesi son tarihi'
      }
    },
    {
      date: paymentDeadline,
      type: 'payment',
      description: {
        en: 'Payment deadline for tax owed (balancing payment)',
        tr: 'Borçlu olunan vergi için ödeme son tarihi (denkleştirme ödemesi)'
      }
    },
    {
      date: secondPaymentOnAccount,
      type: 'second_payment',
      description: {
        en: 'Second payment on account deadline',
        tr: 'Hesap üzerinden ikinci ödeme son tarihi'
      }
    }
  ];
  
  return {
    taxYear,
    registrationDeadline,
    paperReturnDeadline,
    onlineReturnDeadline,
    paymentDeadline,
    secondPaymentOnAccount,
    deadlines
  };
}

/**
 * Calculates payments on account.
 * If your tax bill is more than £1,000 and less than 80% was deducted at source,
 * you need to make payments on account (advance payments toward next year's bill).
 * Each payment is half of the previous year's tax bill.
 * 
 * @param {number} totalTaxDueInPence - Total tax due for the year in pence
 * @returns {{
 *   required: boolean,
 *   threshold: number,
 *   firstPayment: number,
 *   secondPayment: number,
 *   totalPaymentsOnAccount: number,
 *   firstPaymentDate: string,
 *   secondPaymentDate: string,
 *   description: {en: string, tr: string}
 * }}
 */
function calculatePaymentsOnAccount(totalTaxDueInPence, taxYear = DEFAULT_TAX_YEAR) {
  // Payments on account threshold is £1,000 (100000 pence)
  const thresholdInPence = 100000;
  
  const required = totalTaxDueInPence > thresholdInPence;
  
  // Each payment is half of the previous year's bill
  const halfPayment = Math.round(totalTaxDueInPence / 2);
  
  // Calculate payment dates based on tax year
  const deadlines = calculateDeadlines(taxYear);
  const [startYear] = taxYear.split('-').map(Number);
  const endYear = startYear + 1;
  
  return {
    required,
    threshold: thresholdInPence,
    firstPayment: required ? halfPayment : 0,
    secondPayment: required ? halfPayment : 0,
    totalPaymentsOnAccount: required ? halfPayment * 2 : 0,
    firstPaymentDate: `${endYear + 1}-01-31`, // 31 January
    secondPaymentDate: `${endYear + 1}-07-31`, // 31 July
    description: {
      en: required 
        ? 'Payments on account are required as your tax bill exceeds £1,000'
        : 'No payments on account required as your tax bill is £1,000 or less',
      tr: required
        ? 'Vergi faturanız £1,000\'ı aştığı için hesap üzerinden ödemeler gereklidir'
        : 'Vergi faturanız £1,000 veya daha az olduğu için hesap üzerinden ödeme gerekli değildir'
    }
  };
}

/**
 * Generates a complete Self Assessment summary for a user.
 * 
 * @param {number} userId - The user ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.isScottish=false] - Whether to use Scottish income tax rates
 * @returns {Object} Complete Self Assessment summary
 */
function generateSelfAssessmentSummary(userId, startDate, endDate, options = {}) {
  const { isScottish = false } = options;
  
  // Get the tax year for the period
  const taxYear = getTaxYearForDate(startDate);
  
  // Get net profit from P&L
  const profitData = getNetProfit(userId, startDate, endDate);
  
  // Calculate Income Tax
  const incomeTax = calculateIncomeTax(profitData.netProfit, taxYear, isScottish);
  
  // Calculate Class 2 NI
  const class2NI = calculateClass2NI(profitData.netProfit, taxYear);
  
  // Calculate Class 4 NI
  const class4NI = calculateClass4NI(profitData.netProfit, taxYear);
  
  // Calculate total NI
  const totalNI = class2NI.annualAmount + class4NI.totalAmount;
  
  // Calculate total tax liability
  const totalTaxLiability = incomeTax.totalTax + totalNI;
  
  // Calculate payments on account
  const paymentsOnAccount = calculatePaymentsOnAccount(totalTaxLiability, taxYear);
  
  // Get deadlines
  const deadlines = calculateDeadlines(taxYear);
  
  // Calculate take-home (net profit after all taxes)
  const takeHome = profitData.netProfit - totalTaxLiability;
  
  // Calculate effective total tax rate (income tax + NI combined)
  const effectiveTotalRate = profitData.netProfit > 0
    ? Math.round((totalTaxLiability / profitData.netProfit) * 10000) / 100
    : 0;
  
  return {
    period: {
      startDate,
      endDate,
      taxYear
    },
    profit: {
      income: profitData.income,
      expenses: profitData.expenses,
      netProfit: profitData.netProfit
    },
    incomeTax: {
      personalAllowance: incomeTax.personalAllowance,
      taxableIncome: incomeTax.taxableIncome,
      totalTax: incomeTax.totalTax,
      effectiveRate: incomeTax.effectiveRate,
      isScottish,
      bands: incomeTax.bands
    },
    nationalInsurance: {
      class2: {
        isLiable: class2NI.isLiable,
        weeklyRate: class2NI.weeklyRate,
        weeks: class2NI.weeks,
        annualAmount: class2NI.annualAmount,
        smallProfitsThreshold: class2NI.smallProfitsThreshold,
        isVoluntary: class2NI.isVoluntary,
        description: class2NI.description
      },
      class4: {
        lowerProfitsLimit: class4NI.lowerProfitsLimit,
        upperProfitsLimit: class4NI.upperProfitsLimit,
        mainRate: class4NI.mainRate,
        additionalRate: class4NI.additionalRate,
        mainRateAmount: class4NI.mainRateAmount,
        additionalRateAmount: class4NI.additionalRateAmount,
        totalAmount: class4NI.totalAmount,
        breakdown: class4NI.breakdown,
        description: class4NI.description
      },
      totalNI
    },
    summary: {
      netProfit: profitData.netProfit,
      incomeTax: incomeTax.totalTax,
      class2NI: class2NI.annualAmount,
      class4NI: class4NI.totalAmount,
      totalNI,
      totalTaxLiability,
      effectiveTotalRate,
      takeHome
    },
    paymentsOnAccount,
    deadlines
  };
}

/**
 * Generates a Self Assessment summary for a specific tax year.
 * 
 * @param {number} userId - The user ID
 * @param {string} taxYear - Tax year in 'YYYY-YY' format
 * @param {Object} options - Optional parameters
 * @returns {Object} Self Assessment summary for the tax year
 */
function generateSelfAssessmentForTaxYear(userId, taxYear, options = {}) {
  const { startDate, endDate } = getTaxYearDates(taxYear);
  return generateSelfAssessmentSummary(userId, startDate, endDate, options);
}

/**
 * Generates a Self Assessment summary for a specific month (for estimation purposes).
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {Object} options - Optional parameters
 * @returns {Object} Self Assessment summary for the month
 */
function generateSelfAssessmentForMonth(userId, year, month, options = {}) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateSelfAssessmentSummary(userId, startDate, endDate, options);
}

/**
 * Generates a Self Assessment summary for a specific quarter.
 * 
 * @param {number} userId - The user ID
 * @param {number} year - The year
 * @param {number} quarter - The quarter (1-4)
 * @param {Object} options - Optional parameters
 * @returns {Object} Self Assessment summary for the quarter
 */
function generateSelfAssessmentForQuarter(userId, year, quarter, options = {}) {
  const quarterStartMonths = { 1: 1, 2: 4, 3: 7, 4: 10 };
  const startMonth = quarterStartMonths[quarter];
  
  if (!startMonth) {
    throw new Error('Invalid quarter. Must be 1, 2, 3, or 4.');
  }
  
  const endMonth = startMonth + 2;
  
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return generateSelfAssessmentSummary(userId, startDate, endDate, options);
}

module.exports = {
  // Main report generation
  generateSelfAssessmentSummary,
  generateSelfAssessmentForTaxYear,
  generateSelfAssessmentForMonth,
  generateSelfAssessmentForQuarter,
  
  // Component calculation functions (for testing)
  calculateIncomeTax,
  calculateClass2NI,
  calculateClass4NI,
  calculatePersonalAllowance,
  calculateDeadlines,
  calculatePaymentsOnAccount,
  getNetProfit,
  
  // Utility functions
  validateDateRange,
  getTaxYearForDate,
  getTaxYearDates,
  getMonthName,
  
  // Constants
  DEFAULT_TAX_YEAR
};
