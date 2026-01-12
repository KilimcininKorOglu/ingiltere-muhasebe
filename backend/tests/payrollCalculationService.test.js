/**
 * Unit tests for Payroll Calculation Service.
 * Tests PAYE income tax, National Insurance, and pension calculations.
 * 
 * @module tests/payrollCalculationService.test
 */

const payrollService = require('../services/payrollCalculationService');

describe('Payroll Calculation Service', () => {
  describe('parseTaxCode', () => {
    test('should parse standard tax code 1257L', () => {
      const result = payrollService.parseTaxCode('1257L');
      expect(result.allowance).toBe(1257000); // £12,570 in pence
      expect(result.isKCode).toBe(false);
      expect(result.isScottish).toBe(false);
      expect(result.isWelsh).toBe(false);
      expect(result.isCumulative).toBe(true);
      expect(result.specialCode).toBeNull();
    });

    test('should parse Scottish tax code S1257L', () => {
      const result = payrollService.parseTaxCode('S1257L');
      expect(result.allowance).toBe(1257000);
      expect(result.isScottish).toBe(true);
      expect(result.isWelsh).toBe(false);
    });

    test('should parse Welsh tax code C1257L', () => {
      const result = payrollService.parseTaxCode('C1257L');
      expect(result.allowance).toBe(1257000);
      expect(result.isScottish).toBe(false);
      expect(result.isWelsh).toBe(true);
    });

    test('should parse K code K475 (negative allowance)', () => {
      const result = payrollService.parseTaxCode('K475');
      expect(result.allowance).toBe(-475000); // Negative £4,750 in pence
      expect(result.isKCode).toBe(true);
    });

    test('should parse emergency tax code 1257L W1', () => {
      const result = payrollService.parseTaxCode('1257L W1');
      expect(result.allowance).toBe(1257000);
      expect(result.isEmergency).toBe(true);
      expect(result.isCumulative).toBe(false);
    });

    test('should parse emergency tax code 1257L M1', () => {
      const result = payrollService.parseTaxCode('1257L M1');
      expect(result.isEmergency).toBe(true);
      expect(result.isCumulative).toBe(false);
    });

    test('should parse BR code (basic rate)', () => {
      const result = payrollService.parseTaxCode('BR');
      expect(result.specialCode).toBe('BR');
      expect(result.allowance).toBe(0);
    });

    test('should parse D0 code (higher rate)', () => {
      const result = payrollService.parseTaxCode('D0');
      expect(result.specialCode).toBe('D0');
    });

    test('should parse D1 code (additional rate)', () => {
      const result = payrollService.parseTaxCode('D1');
      expect(result.specialCode).toBe('D1');
    });

    test('should parse NT code (no tax)', () => {
      const result = payrollService.parseTaxCode('NT');
      expect(result.specialCode).toBe('NT');
    });

    test('should parse 0T code (no personal allowance)', () => {
      const result = payrollService.parseTaxCode('0T');
      expect(result.specialCode).toBe('0T');
    });

    test('should normalize tax codes to uppercase', () => {
      const result = payrollService.parseTaxCode('1257l');
      expect(result.rawCode).toBe('1257L');
    });
  });

  describe('calculatePAYE', () => {
    describe('Standard tax code (1257L)', () => {
      test('should calculate zero tax for income within personal allowance', () => {
        const result = payrollService.calculatePAYE({
          grossPayInPence: 100000, // £1,000 monthly
          taxCode: '1257L',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBe(0);
        expect(result.taxableIncome).toBe(0);
      });

      test('should calculate basic rate tax correctly', () => {
        // Monthly gross pay: £3,000 (300000 pence)
        // Monthly personal allowance: £12,570 / 12 = £1,047.50
        // Taxable: £3,000 - £1,047.50 = £1,952.50
        // Tax at 20%: £390.50
        const result = payrollService.calculatePAYE({
          grossPayInPence: 300000,
          taxCode: '1257L',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBeGreaterThan(0);
        expect(result.taxableIncome).toBeGreaterThan(0);
        expect(result.personalAllowance).toBe(104750); // £1,047.50 monthly
      });

      test('should calculate higher rate tax correctly for high earners', () => {
        // Annual salary: £60,000 = £5,000 monthly
        // Taxable: £60,000 - £12,570 = £47,430 annual
        // Monthly taxable: ~£3,952.50
        const result = payrollService.calculatePAYE({
          grossPayInPence: 500000, // £5,000 monthly
          taxCode: '1257L',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBeGreaterThan(0);
        // Should have some income in higher rate band
        expect(result.breakdown.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Special tax codes', () => {
      test('should apply BR code (20% on all earnings)', () => {
        const result = payrollService.calculatePAYE({
          grossPayInPence: 200000, // £2,000
          taxCode: 'BR',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBe(40000); // £400 (20% of £2,000)
        expect(result.taxableIncome).toBe(200000);
      });

      test('should apply D0 code (40% on all earnings)', () => {
        const result = payrollService.calculatePAYE({
          grossPayInPence: 200000, // £2,000
          taxCode: 'D0',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBe(80000); // £800 (40% of £2,000)
      });

      test('should apply D1 code (45% on all earnings)', () => {
        const result = payrollService.calculatePAYE({
          grossPayInPence: 200000, // £2,000
          taxCode: 'D1',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBe(90000); // £900 (45% of £2,000)
      });

      test('should apply NT code (no tax)', () => {
        const result = payrollService.calculatePAYE({
          grossPayInPence: 500000, // £5,000
          taxCode: 'NT',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        expect(result.incomeTax).toBe(0);
      });
    });

    describe('K codes (negative allowance)', () => {
      test('should add K code amount to taxable income', () => {
        // K475 means taxable income is increased by £4,750 annually
        const result = payrollService.calculatePAYE({
          grossPayInPence: 200000, // £2,000 monthly
          taxCode: 'K475',
          payFrequency: 'monthly',
          periodNumber: 1
        });
        
        // Taxable should be higher than gross
        expect(result.taxableIncome).toBeGreaterThan(200000);
        expect(result.incomeTax).toBeGreaterThan(0);
      });
    });

    describe('Weekly pay frequency', () => {
      test('should calculate weekly tax correctly', () => {
        // Weekly gross: £700 (70000 pence)
        // Weekly allowance: £12,570 / 52 = £241.73
        // Taxable: £700 - £241.73 = £458.27
        const result = payrollService.calculatePAYE({
          grossPayInPence: 70000,
          taxCode: '1257L',
          payFrequency: 'weekly',
          periodNumber: 1
        });
        
        expect(result.personalAllowance).toBe(24173); // £241.73 weekly
        expect(result.taxableIncome).toBeGreaterThan(0);
      });
    });

    describe('Cumulative calculations', () => {
      test('should calculate cumulative tax correctly across periods', () => {
        // Period 1
        const period1 = payrollService.calculatePAYE({
          grossPayInPence: 300000,
          taxCode: '1257L',
          payFrequency: 'monthly',
          periodNumber: 1,
          cumulativeTaxableIncome: 0,
          cumulativeTaxPaid: 0
        });
        
        // Period 2
        const period2 = payrollService.calculatePAYE({
          grossPayInPence: 300000,
          taxCode: '1257L',
          payFrequency: 'monthly',
          periodNumber: 2,
          cumulativeTaxableIncome: period1.newCumulativeTaxableIncome,
          cumulativeTaxPaid: period1.newCumulativeTaxPaid
        });
        
        expect(period2.newCumulativeTaxableIncome).toBe(600000);
        expect(period2.newCumulativeTaxPaid).toBeGreaterThan(period1.newCumulativeTaxPaid);
      });
    });
  });

  describe('calculateEmployeeNI', () => {
    test('should calculate zero NI below primary threshold', () => {
      // Monthly PT is approximately £1,048
      const result = payrollService.calculateEmployeeNI({
        grossPayInPence: 100000, // £1,000 - below PT
        payFrequency: 'monthly'
      });
      
      expect(result.employeeNI).toBe(0);
      expect(result.breakdown.mainRate).toBe(0);
    });

    test('should calculate NI at main rate (8%) between PT and UEL', () => {
      // Monthly gross: £3,000
      // PT: ~£1,048, UEL: ~£4,189
      // NI-able at 8%: £3,000 - £1,048 = £1,952
      const result = payrollService.calculateEmployeeNI({
        grossPayInPence: 300000, // £3,000
        payFrequency: 'monthly'
      });
      
      expect(result.employeeNI).toBeGreaterThan(0);
      expect(result.breakdown.mainRate).toBeGreaterThan(0);
    });

    test('should calculate NI at reduced rate (2%) above UEL', () => {
      // Monthly gross: £5,000
      // PT: ~£1,048, UEL: ~£4,189
      // Main rate (8%): £4,189 - £1,048 = £3,141
      // Reduced rate (2%): £5,000 - £4,189 = £811
      const result = payrollService.calculateEmployeeNI({
        grossPayInPence: 500000, // £5,000
        payFrequency: 'monthly'
      });
      
      expect(result.employeeNI).toBeGreaterThan(0);
      expect(result.breakdown.reducedRate).toBeGreaterThan(0);
    });

    test('should return zero NI for category C (over state pension age)', () => {
      const result = payrollService.calculateEmployeeNI({
        grossPayInPence: 500000,
        payFrequency: 'monthly',
        niCategory: 'C'
      });
      
      expect(result.employeeNI).toBe(0);
    });

    test('should calculate weekly NI correctly', () => {
      const result = payrollService.calculateEmployeeNI({
        grossPayInPence: 70000, // £700 weekly
        payFrequency: 'weekly'
      });
      
      // Weekly PT is ~£242, so some NI should be due
      expect(result.employeeNI).toBeGreaterThan(0);
    });
  });

  describe('calculateEmployerNI', () => {
    test('should calculate zero employer NI below secondary threshold', () => {
      // Monthly ST is approximately £417 (based on £5,000 annual for 2025-26)
      const result = payrollService.calculateEmployerNI({
        grossPayInPence: 40000, // £400 - below ST
        payFrequency: 'monthly'
      });
      
      expect(result.employerNI).toBe(0);
    });

    test('should calculate employer NI at 15% above ST', () => {
      const result = payrollService.calculateEmployerNI({
        grossPayInPence: 300000, // £3,000
        payFrequency: 'monthly'
      });
      
      expect(result.employerNI).toBeGreaterThan(0);
    });

    test('should not charge employer NI below UEL for under 21s (category M)', () => {
      const result = payrollService.calculateEmployerNI({
        grossPayInPence: 200000, // £2,000 - below UEL
        payFrequency: 'monthly',
        niCategory: 'M'
      });
      
      expect(result.employerNI).toBe(0);
    });

    test('should charge employer NI above UEL for category M', () => {
      const result = payrollService.calculateEmployerNI({
        grossPayInPence: 500000, // £5,000 - above UEL
        payFrequency: 'monthly',
        niCategory: 'M'
      });
      
      expect(result.employerNI).toBeGreaterThan(0);
    });
  });

  describe('calculatePensionContributions', () => {
    test('should return zero when pension opt-in is false', () => {
      const result = payrollService.calculatePensionContributions({
        grossPayInPence: 300000,
        pensionOptIn: false,
        employeeContributionRate: 500 // 5%
      });
      
      expect(result.pensionEmployeeContribution).toBe(0);
      expect(result.pensionEmployerContribution).toBe(0);
    });

    test('should calculate employee contribution correctly', () => {
      // £3,000 gross, 5% contribution = £150
      const result = payrollService.calculatePensionContributions({
        grossPayInPence: 300000,
        pensionOptIn: true,
        employeeContributionRate: 500 // 5%
      });
      
      expect(result.pensionEmployeeContribution).toBe(15000); // £150
    });

    test('should calculate employer contribution at default 3%', () => {
      // £3,000 gross, 3% employer = £90
      const result = payrollService.calculatePensionContributions({
        grossPayInPence: 300000,
        pensionOptIn: true,
        employeeContributionRate: 500
      });
      
      expect(result.pensionEmployerContribution).toBe(9000); // £90
    });

    test('should calculate tax relief at 25% for relief at source', () => {
      const result = payrollService.calculatePensionContributions({
        grossPayInPence: 300000,
        pensionOptIn: true,
        employeeContributionRate: 500,
        reliefAtSource: true
      });
      
      // Tax relief is 25% of employee contribution
      expect(result.pensionTaxRelief).toBe(3750); // 25% of £150 = £37.50
    });
  });

  describe('calculateStudentLoanDeduction', () => {
    test('should return zero when no student loan plan', () => {
      const result = payrollService.calculateStudentLoanDeduction({
        grossPayInPence: 300000,
        payFrequency: 'monthly',
        studentLoanPlan: null
      });
      
      expect(result).toBe(0);
    });

    test('should return zero when below plan threshold', () => {
      // Plan 1 annual threshold: £24,990 = £2,082.50/month
      const result = payrollService.calculateStudentLoanDeduction({
        grossPayInPence: 200000, // £2,000
        payFrequency: 'monthly',
        studentLoanPlan: 'plan1'
      });
      
      expect(result).toBe(0);
    });

    test('should calculate Plan 1 deduction at 9% above threshold', () => {
      // Plan 1 threshold: ~£2,082.50/month
      // Gross: £3,000, Excess: ~£917.50
      // Deduction: 9% = ~£82.58
      const result = payrollService.calculateStudentLoanDeduction({
        grossPayInPence: 300000, // £3,000
        payFrequency: 'monthly',
        studentLoanPlan: 'plan1'
      });
      
      expect(result).toBeGreaterThan(0);
    });

    test('should calculate Plan 2 deduction correctly', () => {
      // Plan 2 has higher threshold than Plan 1
      const result = payrollService.calculateStudentLoanDeduction({
        grossPayInPence: 350000, // £3,500
        payFrequency: 'monthly',
        studentLoanPlan: 'plan2'
      });
      
      expect(result).toBeGreaterThan(0);
    });

    test('should calculate postgrad deduction at 6% above threshold', () => {
      const result = payrollService.calculateStudentLoanDeduction({
        grossPayInPence: 300000, // £3,000
        payFrequency: 'monthly',
        studentLoanPlan: 'postgrad'
      });
      
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('calculatePayroll (complete calculation)', () => {
    test('should calculate complete payroll correctly', () => {
      const result = payrollService.calculatePayroll({
        grossPayInPence: 300000, // £3,000 monthly
        taxCode: '1257L',
        payFrequency: 'monthly',
        niCategory: 'A',
        periodNumber: 1,
        pensionOptIn: true,
        pensionContributionRate: 500, // 5%
        studentLoanPlan: 'plan1'
      });
      
      expect(result.grossPay).toBe(300000);
      expect(result.incomeTax).toBeGreaterThan(0);
      expect(result.employeeNI).toBeGreaterThan(0);
      expect(result.employerNI).toBeGreaterThan(0);
      expect(result.pensionEmployeeContribution).toBe(15000);
      expect(result.pensionEmployerContribution).toBe(9000);
      expect(result.netPay).toBeGreaterThan(0);
      expect(result.netPay).toBeLessThan(result.grossPay);
    });

    test('should include bonus and commission in gross', () => {
      const result = payrollService.calculatePayroll({
        grossPayInPence: 300000,
        taxCode: '1257L',
        payFrequency: 'monthly',
        bonus: 50000, // £500 bonus
        commission: 20000 // £200 commission
      });
      
      expect(result.grossPay).toBe(370000); // £3,700 total
    });

    test('should apply other deductions to net pay', () => {
      const resultWithDeductions = payrollService.calculatePayroll({
        grossPayInPence: 300000,
        taxCode: '1257L',
        payFrequency: 'monthly',
        otherDeductions: 10000 // £100
      });
      
      const resultWithoutDeductions = payrollService.calculatePayroll({
        grossPayInPence: 300000,
        taxCode: '1257L',
        payFrequency: 'monthly',
        otherDeductions: 0
      });
      
      expect(resultWithDeductions.netPay).toBe(resultWithoutDeductions.netPay - 10000);
    });

    test('should track cumulative values correctly', () => {
      const result = payrollService.calculatePayroll({
        grossPayInPence: 300000,
        taxCode: '1257L',
        payFrequency: 'monthly',
        periodNumber: 1,
        cumulativeTaxableIncome: 0,
        cumulativeTaxPaid: 0
      });
      
      expect(result.newCumulativeTaxableIncome).toBe(300000);
      expect(result.newCumulativeTaxPaid).toBeGreaterThan(0);
    });

    test('should provide breakdown details', () => {
      const result = payrollService.calculatePayroll({
        grossPayInPence: 300000,
        taxCode: '1257L',
        payFrequency: 'monthly',
        pensionOptIn: true,
        pensionContributionRate: 500
      });
      
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.employeeNI).toBeDefined();
      expect(result.breakdown.employerNI).toBeDefined();
      expect(result.breakdown.pension).toBeDefined();
    });
  });

  describe('Utility functions', () => {
    describe('annualizeAmount', () => {
      test('should annualize monthly amount correctly', () => {
        const annual = payrollService.annualizeAmount(100000, 'monthly');
        expect(annual).toBe(1200000); // 12 months
      });

      test('should annualize weekly amount correctly', () => {
        const annual = payrollService.annualizeAmount(10000, 'weekly');
        expect(annual).toBe(520000); // 52 weeks
      });

      test('should annualize biweekly amount correctly', () => {
        const annual = payrollService.annualizeAmount(20000, 'biweekly');
        expect(annual).toBe(520000); // 26 periods
      });
    });

    describe('periodizeAmount', () => {
      test('should periodize annual amount to monthly correctly', () => {
        const monthly = payrollService.periodizeAmount(1200000, 'monthly');
        expect(monthly).toBe(100000); // £1,000 monthly
      });

      test('should periodize annual amount to weekly correctly', () => {
        const weekly = payrollService.periodizeAmount(520000, 'weekly');
        expect(weekly).toBe(10000); // £100 weekly
      });
    });

    describe('validatePayrollInputs', () => {
      test('should pass valid inputs', () => {
        const result = payrollService.validatePayrollInputs({
          grossPayInPence: 300000,
          taxCode: '1257L',
          payFrequency: 'monthly'
        });
        
        expect(result.isValid).toBe(true);
        expect(Object.keys(result.errors)).toHaveLength(0);
      });

      test('should fail for missing tax code', () => {
        const result = payrollService.validatePayrollInputs({
          grossPayInPence: 300000,
          payFrequency: 'monthly'
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors.taxCode).toBeDefined();
      });

      test('should fail for invalid pay frequency', () => {
        const result = payrollService.validatePayrollInputs({
          grossPayInPence: 300000,
          taxCode: '1257L',
          payFrequency: 'invalid'
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors.payFrequency).toBeDefined();
      });

      test('should fail for negative gross pay', () => {
        const result = payrollService.validatePayrollInputs({
          grossPayInPence: -100,
          taxCode: '1257L',
          payFrequency: 'monthly'
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors.grossPayInPence).toBeDefined();
      });
    });
  });

  describe('Constants', () => {
    test('should export pay frequencies', () => {
      expect(payrollService.PAY_FREQUENCIES.weekly.periods).toBe(52);
      expect(payrollService.PAY_FREQUENCIES.biweekly.periods).toBe(26);
      expect(payrollService.PAY_FREQUENCIES.monthly.periods).toBe(12);
    });

    test('should export NI categories', () => {
      expect(payrollService.NI_CATEGORIES.A).toBeDefined();
      expect(payrollService.NI_CATEGORIES.C).toBeDefined();
      expect(payrollService.NI_CATEGORIES.M).toBeDefined();
    });

    test('should export student loan plans', () => {
      expect(payrollService.STUDENT_LOAN_PLANS.plan1).toBeDefined();
      expect(payrollService.STUDENT_LOAN_PLANS.plan2).toBeDefined();
      expect(payrollService.STUDENT_LOAN_PLANS.postgrad).toBeDefined();
    });
  });
});
