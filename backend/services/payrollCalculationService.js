/**
 * Payroll Calculation Service
 * 
 * Implements UK PAYE income tax, National Insurance (employee and employer),
 * and pension contribution calculations.
 * 
 * All monetary values are in pence to avoid floating-point precision issues.
 * 
 * @module services/payrollCalculationService
 */

const { getCurrentTaxRates, getTaxRatesForYear } = require('../config/taxRates');

/**
 * Default tax rates configuration for 2025-26 tax year
 * Used as fallback and for reference
 */
const DEFAULT_TAX_YEAR = '2025-26';

/**
 * Pay frequency constants
 */
const PAY_FREQUENCIES = {
  weekly: { periods: 52, label: 'Weekly' },
  biweekly: { periods: 26, label: 'Bi-weekly' },
  monthly: { periods: 12, label: 'Monthly' }
};

/**
 * NI Category rates for different employee types
 * Category A is the standard rate for most employees
 */
const NI_CATEGORIES = {
  A: { name: 'Standard', description: 'Standard rate for most employees' },
  B: { name: 'Married women/widows', description: 'Reduced rate for married women and widows with certificate' },
  C: { name: 'Over state pension age', description: 'No employee NI due' },
  H: { name: 'Apprentice under 25', description: 'No employer NI up to UEL' },
  J: { name: 'Deferment', description: 'Deferred rate' },
  M: { name: 'Under 21', description: 'No employer NI up to UEL' },
  Z: { name: 'Under 21 deferment', description: 'Deferred rate for under 21' }
};

/**
 * Student loan plan thresholds and rates
 */
const STUDENT_LOAN_PLANS = {
  plan1: { threshold: 2499000, rate: 0.09, name: 'Plan 1' },      // £24,990 annual in pence
  plan2: { threshold: 2729500, rate: 0.09, name: 'Plan 2' },      // £27,295 annual in pence
  plan4: { threshold: 3139500, rate: 0.09, name: 'Plan 4' },      // £31,395 annual in pence
  plan5: { threshold: 2500000, rate: 0.09, name: 'Plan 5' },      // £25,000 annual in pence
  postgrad: { threshold: 2100000, rate: 0.06, name: 'Postgraduate' } // £21,000 annual in pence
};

/**
 * Parses a tax code and extracts the personal allowance and modifiers.
 * 
 * UK Tax Code formats:
 * - Standard: 1257L (1257 = allowance / 10, L = standard suffix)
 * - K codes: K475 (negative allowance - employee owes tax on extra income)
 * - Scottish: S1257L (S prefix for Scottish rates)
 * - Welsh: C1257L (C prefix for Welsh rates, but same rates as England)
 * - Emergency: 1257L W1, 1257L M1, 1257L X (week 1/month 1 basis)
 * - Special: BR (basic rate on all earnings), D0 (higher rate), D1 (additional rate), NT (no tax), 0T (no allowance)
 * 
 * @param {string} taxCode - The tax code to parse
 * @param {string} [taxYear='2025-26'] - The tax year for default allowance
 * @returns {{
 *   allowance: number,
 *   isKCode: boolean,
 *   isScottish: boolean,
 *   isWelsh: boolean,
 *   isEmergency: boolean,
 *   isCumulative: boolean,
 *   specialCode: string|null,
 *   rawCode: string
 * }} Parsed tax code information
 */
function parseTaxCode(taxCode, taxYear = DEFAULT_TAX_YEAR) {
  const cleanCode = taxCode.replace(/\s/g, '').toUpperCase();
  
  const result = {
    allowance: 0,
    isKCode: false,
    isScottish: false,
    isWelsh: false,
    isEmergency: false,
    isCumulative: true,  // Default is cumulative
    specialCode: null,
    rawCode: cleanCode
  };
  
  // Check for emergency codes (non-cumulative)
  if (cleanCode.includes('W1') || cleanCode.includes('M1') || cleanCode.endsWith('X')) {
    result.isEmergency = true;
    result.isCumulative = false;
  }
  
  // Remove emergency code suffixes before processing
  let codeWithoutEmergency = cleanCode.replace(/W1|M1|X$/g, '').trim();
  
  // Check for special codes
  const specialCodes = ['BR', 'D0', 'D1', 'NT', '0T'];
  for (const special of specialCodes) {
    if (codeWithoutEmergency === special || codeWithoutEmergency === `S${special}` || codeWithoutEmergency === `C${special}`) {
      result.specialCode = special;
      if (codeWithoutEmergency.startsWith('S')) result.isScottish = true;
      if (codeWithoutEmergency.startsWith('C')) result.isWelsh = true;
      return result;
    }
  }
  
  // Check for Scottish/Welsh prefix
  let codeToProcess = codeWithoutEmergency;
  if (codeWithoutEmergency.startsWith('S')) {
    result.isScottish = true;
    codeToProcess = codeWithoutEmergency.substring(1);
  } else if (codeWithoutEmergency.startsWith('C')) {
    result.isWelsh = true;
    codeToProcess = codeWithoutEmergency.substring(1);
  }
  
  // Check for K code (negative allowance)
  if (codeToProcess.startsWith('K')) {
    result.isKCode = true;
    const numericPart = codeToProcess.replace(/[^0-9]/g, '');
    // K codes represent negative allowance - multiply by 10 to get the amount in pounds
    result.allowance = -(parseInt(numericPart, 10) * 10 * 100); // Convert to pence
    return result;
  }
  
  // Standard code: extract numeric part and multiply by 10
  const numericPart = codeToProcess.replace(/[^0-9]/g, '');
  if (numericPart) {
    // The number in the tax code is the allowance divided by 10, rounded down
    // Adding 9 and dividing gives us a number that when multiplied by 10, gives the allowance
    result.allowance = parseInt(numericPart, 10) * 10 * 100; // Convert to pence
  }
  
  return result;
}

/**
 * Calculates the personal allowance based on annual income.
 * Personal allowance is reduced by £1 for every £2 over £100,000.
 * 
 * @param {number} annualIncomeInPence - Annual gross income in pence
 * @param {number} baseAllowanceInPence - Base personal allowance in pence
 * @param {string} [taxYear='2025-26'] - The tax year
 * @returns {number} Adjusted personal allowance in pence
 */
function calculatePersonalAllowance(annualIncomeInPence, baseAllowanceInPence, taxYear = DEFAULT_TAX_YEAR) {
  const taxRates = getTaxRatesForYear(taxYear) || getCurrentTaxRates();
  const incomeLimit = taxRates.incomeTax.personalAllowance.incomeLimit * 100; // Convert to pence
  const taperRate = taxRates.incomeTax.personalAllowance.taperRate;
  
  if (annualIncomeInPence <= incomeLimit) {
    return baseAllowanceInPence;
  }
  
  // Reduce allowance by £1 for every £2 over the limit
  const excessIncome = annualIncomeInPence - incomeLimit;
  const reduction = Math.floor((excessIncome / 100) * taperRate) * 100; // Reduction in pence
  
  return Math.max(0, baseAllowanceInPence - reduction);
}

/**
 * Calculates PAYE income tax for a pay period.
 * 
 * @param {Object} options - Calculation options
 * @param {number} options.grossPayInPence - Gross pay for the period in pence
 * @param {string} options.taxCode - HMRC tax code
 * @param {string} options.payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @param {number} [options.periodNumber=1] - The period number in the tax year (1-52 for weekly, 1-12 for monthly)
 * @param {number} [options.cumulativeTaxableIncome=0] - Year-to-date taxable income from previous periods (in pence)
 * @param {number} [options.cumulativeTaxPaid=0] - Year-to-date tax paid in previous periods (in pence)
 * @param {string} [options.taxYear='2025-26'] - Tax year
 * @returns {{
 *   incomeTax: number,
 *   taxableIncome: number,
 *   personalAllowance: number,
 *   breakdown: Array<{band: string, taxableAmount: number, rate: number, tax: number}>,
 *   newCumulativeTaxableIncome: number,
 *   newCumulativeTaxPaid: number,
 *   isScottish: boolean
 * }} Tax calculation result with all values in pence
 */
function calculatePAYE(options) {
  const {
    grossPayInPence,
    taxCode,
    payFrequency,
    periodNumber = 1,
    cumulativeTaxableIncome = 0,
    cumulativeTaxPaid = 0,
    taxYear = DEFAULT_TAX_YEAR
  } = options;
  
  const parsedCode = parseTaxCode(taxCode, taxYear);
  const taxRates = getTaxRatesForYear(taxYear) || getCurrentTaxRates();
  const periodsPerYear = PAY_FREQUENCIES[payFrequency]?.periods || 12;
  
  const result = {
    incomeTax: 0,
    taxableIncome: 0,
    personalAllowance: 0,
    breakdown: [],
    newCumulativeTaxableIncome: cumulativeTaxableIncome,
    newCumulativeTaxPaid: cumulativeTaxPaid,
    isScottish: parsedCode.isScottish
  };
  
  // Handle special tax codes
  if (parsedCode.specialCode) {
    const specialRates = {
      'NT': 0,       // No tax
      'BR': 0.20,    // Basic rate on all earnings
      'D0': 0.40,    // Higher rate on all earnings
      'D1': 0.45,    // Additional rate on all earnings
      '0T': null     // No personal allowance, normal bands apply
    };
    
    if (parsedCode.specialCode === 'NT') {
      result.taxableIncome = grossPayInPence;
      result.incomeTax = 0;
      return result;
    }
    
    if (specialRates[parsedCode.specialCode] !== null && specialRates[parsedCode.specialCode] !== undefined) {
      result.taxableIncome = grossPayInPence;
      result.incomeTax = Math.round(grossPayInPence * specialRates[parsedCode.specialCode]);
      result.breakdown.push({
        band: parsedCode.specialCode,
        taxableAmount: grossPayInPence,
        rate: specialRates[parsedCode.specialCode],
        tax: result.incomeTax
      });
      return result;
    }
  }
  
  // Get the appropriate tax bands (Scottish or standard)
  const taxConfig = parsedCode.isScottish 
    ? taxRates.scottishIncomeTax 
    : taxRates.incomeTax;
  
  // Calculate annual allowance from tax code
  let annualAllowance = parsedCode.allowance;
  if (parsedCode.specialCode === '0T') {
    annualAllowance = 0;
  }
  
  // Calculate period allowance
  const periodAllowance = Math.round(annualAllowance / periodsPerYear);
  result.personalAllowance = periodAllowance;
  
  let taxDue = 0;
  
  if (parsedCode.isCumulative) {
    // Cumulative calculation (standard method)
    // Calculate tax on year-to-date earnings
    const ytdGross = cumulativeTaxableIncome + grossPayInPence;
    const ytdAllowance = Math.round(annualAllowance * periodNumber / periodsPerYear);
    
    // For K codes, the allowance is added to taxable income instead of subtracted
    let ytdTaxableIncome;
    if (parsedCode.isKCode) {
      ytdTaxableIncome = ytdGross + Math.abs(ytdAllowance);
    } else {
      ytdTaxableIncome = Math.max(0, ytdGross - ytdAllowance);
    }
    
    // Calculate the period's taxable income
    if (parsedCode.isKCode) {
      result.taxableIncome = grossPayInPence + Math.abs(periodAllowance);
    } else {
      result.taxableIncome = Math.max(0, grossPayInPence - periodAllowance);
    }
    
    // Calculate year-to-date tax using annual bands prorated to this period
    const ytdTax = calculateTaxOnCumulativeIncome(ytdTaxableIncome, taxConfig.bands, periodsPerYear, periodNumber);
    
    // Tax for this period is YTD tax minus already paid
    taxDue = Math.max(0, ytdTax - cumulativeTaxPaid);
    
    result.newCumulativeTaxableIncome = cumulativeTaxableIncome + grossPayInPence;
    result.newCumulativeTaxPaid = cumulativeTaxPaid + taxDue;
    
  } else {
    // Non-cumulative (Week 1/Month 1) - treat each period independently
    let periodTaxableIncome;
    if (parsedCode.isKCode) {
      periodTaxableIncome = grossPayInPence + Math.abs(periodAllowance);
    } else {
      periodTaxableIncome = Math.max(0, grossPayInPence - periodAllowance);
    }
    
    result.taxableIncome = periodTaxableIncome;
    taxDue = calculateTaxOnPeriodIncome(periodTaxableIncome, taxConfig.bands, periodsPerYear);
  }
  
  result.incomeTax = Math.round(taxDue);
  
  // Create breakdown for reporting
  if (result.taxableIncome > 0 && !parsedCode.specialCode) {
    result.breakdown = createTaxBreakdown(result.taxableIncome, taxConfig.bands, periodsPerYear);
  }
  
  return result;
}

/**
 * Calculates tax on cumulative income using prorated annual bands.
 * 
 * @param {number} cumulativeTaxableIncome - YTD taxable income in pence
 * @param {Array} bands - Tax bands from config
 * @param {number} periodsPerYear - Number of pay periods per year
 * @param {number} periodNumber - Current period number
 * @returns {number} Tax due on cumulative income in pence
 */
function calculateTaxOnCumulativeIncome(cumulativeTaxableIncome, bands, periodsPerYear, periodNumber) {
  let totalTax = 0;
  let remainingIncome = cumulativeTaxableIncome;
  
  for (const band of bands) {
    if (band.rate === 0) continue;
    if (remainingIncome <= 0) break;
    
    // Prorate the band limits to the current period
    const proratedMin = Math.round((band.min * 100) * periodNumber / periodsPerYear);
    const proratedMax = band.max ? Math.round((band.max * 100) * periodNumber / periodsPerYear) : Infinity;
    const proratedAllowance = Math.round((bands[0].max * 100) * periodNumber / periodsPerYear);
    
    // Adjust band limits for already-used personal allowance
    const bandStart = Math.max(0, proratedMin - proratedAllowance);
    const bandEnd = band.max ? Math.max(0, proratedMax - proratedAllowance) : Infinity;
    const bandWidth = bandEnd - bandStart;
    
    const taxableInBand = Math.min(remainingIncome, bandWidth);
    if (taxableInBand > 0) {
      totalTax += taxableInBand * band.rate;
      remainingIncome -= taxableInBand;
    }
  }
  
  return Math.round(totalTax);
}

/**
 * Calculates tax on a single period's income using prorated bands.
 * 
 * @param {number} periodTaxableIncome - Taxable income for the period in pence
 * @param {Array} bands - Tax bands from config
 * @param {number} periodsPerYear - Number of pay periods per year
 * @returns {number} Tax due for the period in pence
 */
function calculateTaxOnPeriodIncome(periodTaxableIncome, bands, periodsPerYear) {
  let totalTax = 0;
  let remainingIncome = periodTaxableIncome;
  
  for (const band of bands) {
    if (band.rate === 0) continue;
    if (remainingIncome <= 0) break;
    
    // Prorate the band width to a single period
    const annualBandStart = (band.min - bands[0].max) * 100; // Subtract personal allowance
    const annualBandEnd = band.max ? (band.max - bands[0].max) * 100 : Infinity;
    
    const periodBandStart = Math.round(Math.max(0, annualBandStart) / periodsPerYear);
    const periodBandEnd = band.max ? Math.round(annualBandEnd / periodsPerYear) : Infinity;
    const periodBandWidth = periodBandEnd - periodBandStart;
    
    const taxableInBand = Math.min(remainingIncome, periodBandWidth);
    if (taxableInBand > 0) {
      totalTax += taxableInBand * band.rate;
      remainingIncome -= taxableInBand;
    }
  }
  
  return Math.round(totalTax);
}

/**
 * Creates a tax breakdown showing how much tax is due in each band.
 * 
 * @param {number} taxableIncome - Taxable income for the period in pence
 * @param {Array} bands - Tax bands from config
 * @param {number} periodsPerYear - Number of pay periods per year
 * @returns {Array<{band: string, taxableAmount: number, rate: number, tax: number}>}
 */
function createTaxBreakdown(taxableIncome, bands, periodsPerYear) {
  const breakdown = [];
  let remainingIncome = taxableIncome;
  
  for (const band of bands) {
    if (band.rate === 0) continue;
    if (remainingIncome <= 0) break;
    
    const annualBandStart = (band.min - bands[0].max) * 100;
    const annualBandEnd = band.max ? (band.max - bands[0].max) * 100 : Infinity;
    
    const periodBandStart = Math.round(Math.max(0, annualBandStart) / periodsPerYear);
    const periodBandEnd = band.max ? Math.round(annualBandEnd / periodsPerYear) : Infinity;
    const periodBandWidth = periodBandEnd - periodBandStart;
    
    const taxableInBand = Math.min(remainingIncome, periodBandWidth);
    if (taxableInBand > 0) {
      breakdown.push({
        band: band.name,
        taxableAmount: taxableInBand,
        rate: band.rate,
        tax: Math.round(taxableInBand * band.rate)
      });
      remainingIncome -= taxableInBand;
    }
  }
  
  return breakdown;
}

/**
 * Calculates employee National Insurance contributions for a pay period.
 * 
 * @param {Object} options - Calculation options
 * @param {number} options.grossPayInPence - Gross pay for the period in pence
 * @param {string} options.payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @param {string} [options.niCategory='A'] - NI category letter
 * @param {string} [options.taxYear='2025-26'] - Tax year
 * @returns {{
 *   employeeNI: number,
 *   breakdown: {belowPT: number, mainRate: number, reducedRate: number}
 * }} Employee NI calculation result in pence
 */
function calculateEmployeeNI(options) {
  const {
    grossPayInPence,
    payFrequency,
    niCategory = 'A',
    taxYear = DEFAULT_TAX_YEAR
  } = options;
  
  const taxRates = getTaxRatesForYear(taxYear) || getCurrentTaxRates();
  const niConfig = taxRates.nationalInsurance.class1.employee;
  const periodsPerYear = PAY_FREQUENCIES[payFrequency]?.periods || 12;
  
  // Category C (over state pension age) pays no employee NI
  if (niCategory === 'C') {
    return { employeeNI: 0, breakdown: { belowPT: 0, mainRate: 0, reducedRate: 0 } };
  }
  
  // Calculate period thresholds
  const periodPT = Math.round((niConfig.thresholds.primaryThreshold.annual * 100) / periodsPerYear);
  const periodUEL = Math.round((niConfig.thresholds.upperEarningsLimit.annual * 100) / periodsPerYear);
  
  const breakdown = {
    belowPT: 0,
    mainRate: 0,
    reducedRate: 0
  };
  
  if (grossPayInPence <= periodPT) {
    // Below primary threshold - no NI due
    breakdown.belowPT = grossPayInPence;
    return { employeeNI: 0, breakdown };
  }
  
  let employeeNI = 0;
  breakdown.belowPT = periodPT;
  
  // Calculate NI between PT and UEL at main rate (8%)
  const earningsBetweenPTandUEL = Math.min(grossPayInPence, periodUEL) - periodPT;
  if (earningsBetweenPTandUEL > 0) {
    const mainRateNI = earningsBetweenPTandUEL * niConfig.rates.mainRate;
    employeeNI += mainRateNI;
    breakdown.mainRate = earningsBetweenPTandUEL;
  }
  
  // Calculate NI above UEL at reduced rate (2%)
  if (grossPayInPence > periodUEL) {
    const earningsAboveUEL = grossPayInPence - periodUEL;
    const reducedRateNI = earningsAboveUEL * niConfig.rates.reducedRate;
    employeeNI += reducedRateNI;
    breakdown.reducedRate = earningsAboveUEL;
  }
  
  return {
    employeeNI: Math.round(employeeNI),
    breakdown
  };
}

/**
 * Calculates employer National Insurance contributions for a pay period.
 * 
 * @param {Object} options - Calculation options
 * @param {number} options.grossPayInPence - Gross pay for the period in pence
 * @param {string} options.payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @param {string} [options.niCategory='A'] - NI category letter
 * @param {string} [options.taxYear='2025-26'] - Tax year
 * @returns {{
 *   employerNI: number,
 *   breakdown: {belowST: number, mainRate: number}
 * }} Employer NI calculation result in pence
 */
function calculateEmployerNI(options) {
  const {
    grossPayInPence,
    payFrequency,
    niCategory = 'A',
    taxYear = DEFAULT_TAX_YEAR
  } = options;
  
  const taxRates = getTaxRatesForYear(taxYear) || getCurrentTaxRates();
  const niConfig = taxRates.nationalInsurance.class1.employer;
  const employeeNIConfig = taxRates.nationalInsurance.class1.employee;
  const periodsPerYear = PAY_FREQUENCIES[payFrequency]?.periods || 12;
  
  // Calculate period thresholds
  const periodST = Math.round((niConfig.thresholds.secondaryThreshold.annual * 100) / periodsPerYear);
  const periodUEL = Math.round((employeeNIConfig.thresholds.upperEarningsLimit.annual * 100) / periodsPerYear);
  
  const breakdown = {
    belowST: 0,
    mainRate: 0
  };
  
  if (grossPayInPence <= periodST) {
    breakdown.belowST = grossPayInPence;
    return { employerNI: 0, breakdown };
  }
  
  // For categories H and M (under 21s and apprentices under 25),
  // employer NI is only due on earnings above the UEL
  const isReducedEmployerNI = ['H', 'M', 'Z'].includes(niCategory);
  
  let employerNI = 0;
  breakdown.belowST = periodST;
  
  if (isReducedEmployerNI) {
    // Only pay employer NI on earnings above UEL
    if (grossPayInPence > periodUEL) {
      const earningsAboveUEL = grossPayInPence - periodUEL;
      employerNI = earningsAboveUEL * niConfig.rates.mainRate;
      breakdown.mainRate = earningsAboveUEL;
    }
  } else {
    // Standard employer NI on earnings above ST
    const earningsAboveST = grossPayInPence - periodST;
    employerNI = earningsAboveST * niConfig.rates.mainRate;
    breakdown.mainRate = earningsAboveST;
  }
  
  return {
    employerNI: Math.round(employerNI),
    breakdown
  };
}

/**
 * Calculates pension contributions for employee and employer.
 * 
 * @param {Object} options - Calculation options
 * @param {number} options.grossPayInPence - Gross pay for the period in pence
 * @param {boolean} options.pensionOptIn - Whether employee has opted into pension
 * @param {number} options.employeeContributionRate - Employee contribution rate (e.g., 500 for 5.00%)
 * @param {number} [options.employerContributionRate=300] - Employer contribution rate (e.g., 300 for 3.00%)
 * @param {number} [options.qualifyingEarningsLower=0] - Lower limit for qualifying earnings in pence
 * @param {number} [options.qualifyingEarningsUpper=0] - Upper limit for qualifying earnings in pence (0 = use gross)
 * @param {boolean} [options.reliefAtSource=true] - Whether pension uses relief at source (adds 25% to employee contribution)
 * @returns {{
 *   pensionEmployeeContribution: number,
 *   pensionEmployerContribution: number,
 *   pensionTaxRelief: number,
 *   qualifyingEarnings: number
 * }} Pension calculation result in pence
 */
function calculatePensionContributions(options) {
  const {
    grossPayInPence,
    pensionOptIn,
    employeeContributionRate,
    employerContributionRate = 300, // Default 3% minimum employer contribution
    qualifyingEarningsLower = 0,
    qualifyingEarningsUpper = 0,
    reliefAtSource = true
  } = options;
  
  if (!pensionOptIn || employeeContributionRate <= 0) {
    return {
      pensionEmployeeContribution: 0,
      pensionEmployerContribution: 0,
      pensionTaxRelief: 0,
      qualifyingEarnings: 0
    };
  }
  
  // Calculate qualifying earnings (earnings between lower and upper limits)
  // If no limits specified, use full gross pay
  let qualifyingEarnings = grossPayInPence;
  if (qualifyingEarningsLower > 0 || qualifyingEarningsUpper > 0) {
    qualifyingEarnings = Math.max(0, grossPayInPence - qualifyingEarningsLower);
    if (qualifyingEarningsUpper > 0) {
      qualifyingEarnings = Math.min(qualifyingEarnings, qualifyingEarningsUpper - qualifyingEarningsLower);
    }
  }
  
  // Convert percentage rates (stored as basis points, e.g., 500 = 5%)
  const employeeRate = employeeContributionRate / 10000;
  const employerRate = employerContributionRate / 10000;
  
  // Calculate contributions
  let pensionEmployeeContribution = Math.round(qualifyingEarnings * employeeRate);
  const pensionEmployerContribution = Math.round(qualifyingEarnings * employerRate);
  
  // Relief at source adds 25% to employee contribution (basic rate tax relief)
  let pensionTaxRelief = 0;
  if (reliefAtSource) {
    // The employee pays net of basic rate tax, pension provider claims 25% from HMRC
    // So if employee wants to contribute 5%, they pay 4% and HMRC adds 1%
    pensionTaxRelief = Math.round(pensionEmployeeContribution * 0.25);
    // Note: The pensionEmployeeContribution returned is the gross contribution including relief
    // The actual deduction from pay would be (pensionEmployeeContribution - pensionTaxRelief)
  }
  
  return {
    pensionEmployeeContribution,
    pensionEmployerContribution,
    pensionTaxRelief,
    qualifyingEarnings
  };
}

/**
 * Calculates student loan deduction for a pay period.
 * 
 * @param {Object} options - Calculation options
 * @param {number} options.grossPayInPence - Gross pay for the period in pence
 * @param {string} options.payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @param {string|null} options.studentLoanPlan - 'plan1', 'plan2', 'plan4', 'plan5', 'postgrad', or null
 * @returns {number} Student loan deduction in pence
 */
function calculateStudentLoanDeduction(options) {
  const {
    grossPayInPence,
    payFrequency,
    studentLoanPlan
  } = options;
  
  if (!studentLoanPlan || !STUDENT_LOAN_PLANS[studentLoanPlan]) {
    return 0;
  }
  
  const plan = STUDENT_LOAN_PLANS[studentLoanPlan];
  const periodsPerYear = PAY_FREQUENCIES[payFrequency]?.periods || 12;
  
  // Calculate period threshold
  const periodThreshold = Math.round(plan.threshold / periodsPerYear);
  
  if (grossPayInPence <= periodThreshold) {
    return 0;
  }
  
  // Calculate deduction on earnings above threshold
  const earningsAboveThreshold = grossPayInPence - periodThreshold;
  return Math.round(earningsAboveThreshold * plan.rate);
}

/**
 * Calculates complete payroll for an employee for a pay period.
 * 
 * @param {Object} options - Complete payroll calculation options
 * @param {number} options.grossPayInPence - Gross pay for the period in pence
 * @param {string} options.taxCode - HMRC tax code
 * @param {string} options.payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @param {string} [options.niCategory='A'] - NI category letter
 * @param {number} [options.periodNumber=1] - Period number in tax year
 * @param {number} [options.cumulativeTaxableIncome=0] - YTD taxable income in pence
 * @param {number} [options.cumulativeTaxPaid=0] - YTD tax paid in pence
 * @param {boolean} [options.pensionOptIn=false] - Whether employee opted into pension
 * @param {number} [options.pensionContributionRate=0] - Employee pension rate (basis points)
 * @param {number} [options.employerPensionRate=300] - Employer pension rate (basis points)
 * @param {string|null} [options.studentLoanPlan=null] - Student loan plan type
 * @param {number} [options.bonus=0] - Bonus amount in pence
 * @param {number} [options.commission=0] - Commission amount in pence
 * @param {number} [options.otherDeductions=0] - Other deductions in pence
 * @param {string} [options.taxYear='2025-26'] - Tax year
 * @returns {{
 *   grossPay: number,
 *   taxableIncome: number,
 *   incomeTax: number,
 *   employeeNI: number,
 *   employerNI: number,
 *   pensionEmployeeContribution: number,
 *   pensionEmployerContribution: number,
 *   studentLoanDeduction: number,
 *   otherDeductions: number,
 *   netPay: number,
 *   newCumulativeTaxableIncome: number,
 *   newCumulativeTaxPaid: number,
 *   breakdown: {
 *     tax: Array,
 *     employeeNI: Object,
 *     employerNI: Object,
 *     pension: Object
 *   }
 * }} Complete payroll calculation result in pence
 */
function calculatePayroll(options) {
  const {
    grossPayInPence,
    taxCode,
    payFrequency,
    niCategory = 'A',
    periodNumber = 1,
    cumulativeTaxableIncome = 0,
    cumulativeTaxPaid = 0,
    pensionOptIn = false,
    pensionContributionRate = 0,
    employerPensionRate = 300,
    studentLoanPlan = null,
    bonus = 0,
    commission = 0,
    otherDeductions = 0,
    taxYear = DEFAULT_TAX_YEAR
  } = options;
  
  // Total gross includes bonus and commission
  const totalGross = grossPayInPence + bonus + commission;
  
  // Calculate pension first (may affect taxable income for PAYE)
  const pensionResult = calculatePensionContributions({
    grossPayInPence: totalGross,
    pensionOptIn,
    employeeContributionRate: pensionContributionRate,
    employerContributionRate: employerPensionRate,
    reliefAtSource: true
  });
  
  // For salary sacrifice pension schemes, gross is reduced before tax
  // For relief at source (default), employee contribution is taken from net
  // We're using relief at source, so PAYE is calculated on full gross
  
  // Calculate PAYE income tax
  const payeResult = calculatePAYE({
    grossPayInPence: totalGross,
    taxCode,
    payFrequency,
    periodNumber,
    cumulativeTaxableIncome,
    cumulativeTaxPaid,
    taxYear
  });
  
  // Calculate employee NI
  const employeeNIResult = calculateEmployeeNI({
    grossPayInPence: totalGross,
    payFrequency,
    niCategory,
    taxYear
  });
  
  // Calculate employer NI
  const employerNIResult = calculateEmployerNI({
    grossPayInPence: totalGross,
    payFrequency,
    niCategory,
    taxYear
  });
  
  // Calculate student loan deduction
  const studentLoanDeduction = calculateStudentLoanDeduction({
    grossPayInPence: totalGross,
    payFrequency,
    studentLoanPlan
  });
  
  // Calculate net pay
  // For relief at source pension, the employee deduction is the net amount (after tax relief)
  const pensionEmployeeDeduction = pensionOptIn 
    ? pensionResult.pensionEmployeeContribution - pensionResult.pensionTaxRelief
    : 0;
  
  const netPay = totalGross 
    - payeResult.incomeTax 
    - employeeNIResult.employeeNI 
    - pensionEmployeeDeduction
    - studentLoanDeduction 
    - otherDeductions;
  
  return {
    grossPay: totalGross,
    taxableIncome: payeResult.taxableIncome,
    incomeTax: payeResult.incomeTax,
    employeeNI: employeeNIResult.employeeNI,
    employerNI: employerNIResult.employerNI,
    pensionEmployeeContribution: pensionResult.pensionEmployeeContribution,
    pensionEmployerContribution: pensionResult.pensionEmployerContribution,
    studentLoanDeduction,
    otherDeductions,
    netPay: Math.max(0, netPay),
    newCumulativeTaxableIncome: payeResult.newCumulativeTaxableIncome,
    newCumulativeTaxPaid: payeResult.newCumulativeTaxPaid,
    breakdown: {
      tax: payeResult.breakdown,
      employeeNI: employeeNIResult.breakdown,
      employerNI: employerNIResult.breakdown,
      pension: {
        qualifyingEarnings: pensionResult.qualifyingEarnings,
        employeeGrossContribution: pensionResult.pensionEmployeeContribution,
        taxRelief: pensionResult.pensionTaxRelief,
        employeeNetDeduction: pensionEmployeeDeduction,
        employerContribution: pensionResult.pensionEmployerContribution
      }
    }
  };
}

/**
 * Annualizes a period amount.
 * 
 * @param {number} periodAmount - Amount for one period in pence
 * @param {string} payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @returns {number} Annual amount in pence
 */
function annualizeAmount(periodAmount, payFrequency) {
  const periodsPerYear = PAY_FREQUENCIES[payFrequency]?.periods || 12;
  return periodAmount * periodsPerYear;
}

/**
 * Converts an annual amount to a period amount.
 * 
 * @param {number} annualAmount - Annual amount in pence
 * @param {string} payFrequency - 'weekly', 'biweekly', or 'monthly'
 * @returns {number} Period amount in pence
 */
function periodizeAmount(annualAmount, payFrequency) {
  const periodsPerYear = PAY_FREQUENCIES[payFrequency]?.periods || 12;
  return Math.round(annualAmount / periodsPerYear);
}

/**
 * Validates payroll calculation inputs.
 * 
 * @param {Object} options - Options to validate
 * @returns {{isValid: boolean, errors: Object<string, string>}}
 */
function validatePayrollInputs(options) {
  const errors = {};
  
  if (typeof options.grossPayInPence !== 'number' || options.grossPayInPence < 0) {
    errors.grossPayInPence = 'Gross pay must be a non-negative number';
  }
  
  if (!options.taxCode || typeof options.taxCode !== 'string') {
    errors.taxCode = 'Tax code is required';
  }
  
  if (!PAY_FREQUENCIES[options.payFrequency]) {
    errors.payFrequency = 'Invalid pay frequency. Must be weekly, biweekly, or monthly';
  }
  
  if (options.niCategory && !NI_CATEGORIES[options.niCategory]) {
    errors.niCategory = `Invalid NI category. Must be one of: ${Object.keys(NI_CATEGORIES).join(', ')}`;
  }
  
  if (options.studentLoanPlan && !STUDENT_LOAN_PLANS[options.studentLoanPlan]) {
    errors.studentLoanPlan = `Invalid student loan plan. Must be one of: ${Object.keys(STUDENT_LOAN_PLANS).join(', ')}`;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

module.exports = {
  // Main calculation functions
  calculatePayroll,
  calculatePAYE,
  calculateEmployeeNI,
  calculateEmployerNI,
  calculatePensionContributions,
  calculateStudentLoanDeduction,
  
  // Utility functions
  parseTaxCode,
  calculatePersonalAllowance,
  annualizeAmount,
  periodizeAmount,
  validatePayrollInputs,
  
  // Constants
  PAY_FREQUENCIES,
  NI_CATEGORIES,
  STUDENT_LOAN_PLANS,
  DEFAULT_TAX_YEAR
};
