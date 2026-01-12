/**
 * Unit Tests for VAT Box Calculator Utility
 * 
 * Tests all nine HMRC VAT return box calculations.
 * Verifies HMRC rounding rules and both accounting schemes.
 */

const {
  calculateBox1,
  calculateBox2,
  calculateBox3,
  calculateBox4,
  calculateBox5,
  calculateBox6,
  calculateBox7,
  calculateBox8,
  calculateBox9,
  calculateAllBoxes,
  validateBoxCalculations,
  createCalculationSummary,
  formatForSubmission,
  hmrcRound,
  roundToPounds,
  ACCOUNTING_SCHEMES,
  VAT_BOX_DESCRIPTIONS
} = require('../utils/vatBoxCalculator');

describe('VAT Box Calculator Utility', () => {
  describe('hmrcRound', () => {
    it('should round down values less than 0.5', () => {
      expect(hmrcRound(100.4)).toBe(100);
      expect(hmrcRound(100.49)).toBe(100);
    });

    it('should round up values 0.5 and above', () => {
      expect(hmrcRound(100.5)).toBe(101);
      expect(hmrcRound(100.51)).toBe(101);
    });

    it('should return 0 for non-numbers', () => {
      expect(hmrcRound('100')).toBe(0);
      expect(hmrcRound(undefined)).toBe(0);
      expect(hmrcRound(null)).toBe(0);
      expect(hmrcRound(NaN)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(hmrcRound(-100.4)).toBe(-100);
      expect(hmrcRound(-100.6)).toBe(-101);
    });
  });

  describe('roundToPounds', () => {
    it('should round to nearest pound (100 pence)', () => {
      expect(roundToPounds(1050)).toBe(1100); // £10.50 -> £11.00
      expect(roundToPounds(1049)).toBe(1000); // £10.49 -> £10.00
    });

    it('should handle exact pound values', () => {
      expect(roundToPounds(1000)).toBe(1000);
      expect(roundToPounds(0)).toBe(0);
    });

    it('should return 0 for non-numbers', () => {
      expect(roundToPounds('1000')).toBe(0);
      expect(roundToPounds(null)).toBe(0);
    });
  });

  describe('calculateBox1 - VAT due on sales', () => {
    const sampleIncomeTransactions = [
      { type: 'income', status: 'confirmed', vatAmount: 2000, amount: 10000 },
      { type: 'income', status: 'pending', vatAmount: 500, amount: 2500 },
      { type: 'income', status: 'void', vatAmount: 1000, amount: 5000 }
    ];

    const sampleInvoices = [
      { status: 'pending', vatAmount: 4000, subtotal: 20000 },
      { status: 'paid', vatAmount: 1000, subtotal: 5000 },
      { status: 'void', vatAmount: 2000, subtotal: 10000 }
    ];

    describe('Standard accounting', () => {
      it('should sum VAT from non-void invoices', () => {
        const result = calculateBox1([], sampleInvoices, { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
        expect(result).toBe(5000); // 4000 + 1000, excludes void
      });

      it('should fall back to transactions if no invoices', () => {
        const result = calculateBox1(sampleIncomeTransactions, [], { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
        expect(result).toBe(2500); // 2000 + 500, excludes void
      });

      it('should return 0 for empty inputs', () => {
        expect(calculateBox1([], [], {})).toBe(0);
      });
    });

    describe('Cash accounting', () => {
      it('should sum VAT from income transactions', () => {
        const result = calculateBox1(sampleIncomeTransactions, sampleInvoices, { accountingScheme: ACCOUNTING_SCHEMES.CASH });
        expect(result).toBe(2500); // 2000 + 500, excludes void
      });

      it('should handle empty transactions', () => {
        const result = calculateBox1([], [], { accountingScheme: ACCOUNTING_SCHEMES.CASH });
        expect(result).toBe(0);
      });
    });
  });

  describe('calculateBox2 - VAT on EU acquisitions', () => {
    it('should always return 0 (post-Brexit)', () => {
      expect(calculateBox2([], {})).toBe(0);
      expect(calculateBox2([{ vatAmount: 1000 }], {})).toBe(0);
    });
  });

  describe('calculateBox3 - Total VAT due', () => {
    it('should sum Box 1 and Box 2', () => {
      expect(calculateBox3(5000, 500)).toBe(5500);
      expect(calculateBox3(10000, 0)).toBe(10000);
    });

    it('should handle undefined inputs', () => {
      expect(calculateBox3(5000, undefined)).toBe(5000);
      expect(calculateBox3(undefined, 500)).toBe(500);
      expect(calculateBox3(undefined, undefined)).toBe(0);
    });
  });

  describe('calculateBox4 - VAT reclaimed on purchases', () => {
    const sampleExpenseTransactions = [
      { type: 'expense', status: 'confirmed', vatAmount: 1000, amount: 5000 },
      { type: 'expense', status: 'pending', vatAmount: 500, amount: 2500 },
      { type: 'expense', status: 'void', vatAmount: 2000, amount: 10000 },
      { type: 'income', status: 'confirmed', vatAmount: 300, amount: 1500 } // Should be ignored
    ];

    it('should sum VAT from non-void expense transactions', () => {
      const result = calculateBox4(sampleExpenseTransactions, {});
      expect(result).toBe(1500); // 1000 + 500, excludes void and income
    });

    it('should return 0 for empty transactions', () => {
      expect(calculateBox4([], {})).toBe(0);
    });

    it('should return 0 for non-array input', () => {
      expect(calculateBox4(null, {})).toBe(0);
      expect(calculateBox4(undefined, {})).toBe(0);
    });
  });

  describe('calculateBox5 - Net VAT', () => {
    it('should calculate Box 3 minus Box 4', () => {
      expect(calculateBox5(10000, 3000)).toBe(7000);
    });

    it('should return negative value for refund due', () => {
      expect(calculateBox5(3000, 10000)).toBe(-7000);
    });

    it('should handle undefined inputs', () => {
      expect(calculateBox5(undefined, 3000)).toBe(-3000);
      expect(calculateBox5(10000, undefined)).toBe(10000);
    });
  });

  describe('calculateBox6 - Total sales value', () => {
    const sampleIncomeTransactions = [
      { type: 'income', status: 'confirmed', amount: 10000 },
      { type: 'income', status: 'pending', amount: 5000 },
      { type: 'income', status: 'void', amount: 8000 }
    ];

    const sampleInvoices = [
      { status: 'pending', subtotal: 20000 },
      { status: 'paid', subtotal: 15000 },
      { status: 'cancelled', subtotal: 10000 }
    ];

    it('should sum net values from invoices (standard accounting)', () => {
      const result = calculateBox6([], sampleInvoices, { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
      expect(result).toBe(35000); // 20000 + 15000, excludes cancelled
    });

    it('should sum net values from transactions (cash accounting)', () => {
      const result = calculateBox6(sampleIncomeTransactions, [], { accountingScheme: ACCOUNTING_SCHEMES.CASH });
      expect(result).toBe(15000); // 10000 + 5000, excludes void
    });
  });

  describe('calculateBox7 - Total purchases value', () => {
    const sampleExpenseTransactions = [
      { type: 'expense', status: 'confirmed', amount: 5000 },
      { type: 'expense', status: 'pending', amount: 3000 },
      { type: 'expense', status: 'void', amount: 7000 }
    ];

    it('should sum net values from expense transactions', () => {
      const result = calculateBox7(sampleExpenseTransactions, {});
      expect(result).toBe(8000); // 5000 + 3000, excludes void
    });

    it('should return 0 for empty transactions', () => {
      expect(calculateBox7([], {})).toBe(0);
    });
  });

  describe('calculateBox8 - EU supplies', () => {
    it('should always return 0 (post-Brexit)', () => {
      expect(calculateBox8([], {})).toBe(0);
    });
  });

  describe('calculateBox9 - EU acquisitions', () => {
    it('should always return 0 (post-Brexit)', () => {
      expect(calculateBox9([], {})).toBe(0);
    });
  });

  describe('calculateAllBoxes', () => {
    const sampleData = {
      incomeTransactions: [
        { type: 'income', status: 'confirmed', vatAmount: 2000, amount: 10000 },
        { type: 'income', status: 'confirmed', vatAmount: 1000, amount: 5000 }
      ],
      expenseTransactions: [
        { type: 'expense', status: 'confirmed', vatAmount: 500, amount: 2500 }
      ],
      salesInvoices: [
        { status: 'pending', vatAmount: 4000, subtotal: 20000 }
      ]
    };

    it('should calculate all nine boxes correctly (standard accounting)', () => {
      const result = calculateAllBoxes(sampleData, { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
      
      expect(result.box1).toBe(4000); // From invoice
      expect(result.box2).toBe(0);    // Post-Brexit
      expect(result.box3).toBe(4000); // Box1 + Box2
      expect(result.box4).toBe(500);  // From expense
      expect(result.box5).toBe(3500); // Box3 - Box4
      expect(result.box6).toBe(20000); // Invoice subtotal
      expect(result.box7).toBe(2500);  // Expense amount
      expect(result.box8).toBe(0);     // Post-Brexit
      expect(result.box9).toBe(0);     // Post-Brexit
    });

    it('should calculate all boxes correctly (cash accounting)', () => {
      const result = calculateAllBoxes(sampleData, { accountingScheme: ACCOUNTING_SCHEMES.CASH });
      
      expect(result.box1).toBe(3000); // From transactions (2000 + 1000)
      expect(result.box6).toBe(15000); // From transactions (10000 + 5000)
    });

    it('should include metadata', () => {
      const result = calculateAllBoxes(sampleData, { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.accountingScheme).toBe(ACCOUNTING_SCHEMES.STANDARD);
      expect(result.metadata.incomeTransactionCount).toBe(2);
      expect(result.metadata.expenseTransactionCount).toBe(1);
      expect(result.metadata.salesInvoiceCount).toBe(1);
    });

    it('should apply round to pounds when requested', () => {
      const dataWithOddAmounts = {
        incomeTransactions: [
          { type: 'income', status: 'confirmed', vatAmount: 1050, amount: 5250 }
        ],
        expenseTransactions: [],
        salesInvoices: []
      };
      
      const result = calculateAllBoxes(dataWithOddAmounts, { 
        accountingScheme: ACCOUNTING_SCHEMES.CASH,
        roundToPounds: true 
      });
      
      expect(result.box1).toBe(1100); // Rounded from 1050
      expect(result.box6).toBe(5300); // Rounded from 5250
    });

    it('should handle empty data', () => {
      const result = calculateAllBoxes({}, {});
      
      expect(result.box1).toBe(0);
      expect(result.box2).toBe(0);
      expect(result.box3).toBe(0);
      expect(result.box4).toBe(0);
      expect(result.box5).toBe(0);
      expect(result.box6).toBe(0);
      expect(result.box7).toBe(0);
      expect(result.box8).toBe(0);
      expect(result.box9).toBe(0);
    });
  });

  describe('validateBoxCalculations', () => {
    it('should pass for valid calculations', () => {
      const validBoxes = {
        box1: 5000,
        box2: 0,
        box3: 5000,
        box4: 2000,
        box5: 3000,
        box6: 25000,
        box7: 10000,
        box8: 0,
        box9: 0
      };
      
      const result = validateBoxCalculations(validBoxes);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if Box 3 != Box 1 + Box 2', () => {
      const invalidBoxes = {
        box1: 5000,
        box2: 0,
        box3: 6000, // Wrong!
        box4: 2000,
        box5: 4000,
        box6: 25000,
        box7: 10000,
        box8: 0,
        box9: 0
      };
      
      const result = validateBoxCalculations(invalidBoxes);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.box === 'box3')).toBe(true);
    });

    it('should fail if Box 5 != Box 3 - Box 4', () => {
      const invalidBoxes = {
        box1: 5000,
        box2: 0,
        box3: 5000,
        box4: 2000,
        box5: 1000, // Wrong, should be 3000
        box6: 25000,
        box7: 10000,
        box8: 0,
        box9: 0
      };
      
      const result = validateBoxCalculations(invalidBoxes);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.box === 'box5')).toBe(true);
    });

    it('should fail for negative non-refund boxes', () => {
      const invalidBoxes = {
        box1: -1000, // Should not be negative
        box2: 0,
        box3: -1000,
        box4: 0,
        box5: -1000,
        box6: 25000,
        box7: 10000,
        box8: 0,
        box9: 0
      };
      
      const result = validateBoxCalculations(invalidBoxes);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.box === 'box1')).toBe(true);
    });

    it('should allow negative Box 5 (refund)', () => {
      const validRefundBoxes = {
        box1: 2000,
        box2: 0,
        box3: 2000,
        box4: 5000,
        box5: -3000, // Refund due
        box6: 10000,
        box7: 25000,
        box8: 0,
        box9: 0
      };
      
      const result = validateBoxCalculations(validRefundBoxes);
      // Box5 negative is allowed
      expect(result.errors.every(e => e.box !== 'box5' || !e.message.includes('negative'))).toBe(true);
    });

    it('should warn if EC boxes are non-zero', () => {
      const invalidBoxes = {
        box1: 5000,
        box2: 100, // Should be 0 post-Brexit
        box3: 5100,
        box4: 2000,
        box5: 3100,
        box6: 25000,
        box7: 10000,
        box8: 0,
        box9: 0
      };
      
      const result = validateBoxCalculations(invalidBoxes);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.box === 'box2')).toBe(true);
    });
  });

  describe('createCalculationSummary', () => {
    const sampleBoxes = {
      box1: 500000,
      box2: 0,
      box3: 500000,
      box4: 200000,
      box5: 300000,
      box6: 2500000,
      box7: 1000000,
      box8: 0,
      box9: 0,
      metadata: {
        accountingScheme: 'standard',
        calculatedAt: '2026-01-15T10:00:00Z'
      }
    };

    it('should create summary with all boxes', () => {
      const summary = createCalculationSummary(sampleBoxes, 'en');
      
      expect(summary.boxes).toHaveLength(9);
      expect(summary.vatDue).toBe(500000);
      expect(summary.vatReclaimed).toBe(200000);
      expect(summary.netVat).toBe(300000);
      expect(summary.isRefundDue).toBe(false);
    });

    it('should indicate refund due for negative net VAT', () => {
      const refundBoxes = { ...sampleBoxes, box5: -100000 };
      const summary = createCalculationSummary(refundBoxes, 'en');
      
      expect(summary.isRefundDue).toBe(true);
    });

    it('should include valueInPounds for each box', () => {
      const summary = createCalculationSummary(sampleBoxes, 'en');
      
      expect(summary.boxes[0].valueInPounds).toBe(5000); // 500000 / 100
    });

    it('should use Turkish language when specified', () => {
      const summary = createCalculationSummary(sampleBoxes, 'tr');
      
      expect(summary.boxes[0].name).toBe(VAT_BOX_DESCRIPTIONS.box1.name.tr);
    });
  });

  describe('formatForSubmission', () => {
    it('should convert all values to pounds', () => {
      const boxes = {
        box1: 50000,
        box2: 0,
        box3: 50000,
        box4: 20000,
        box5: 30000,
        box6: 250000,
        box7: 100000,
        box8: 0,
        box9: 0
      };
      
      const formatted = formatForSubmission(boxes);
      
      expect(formatted.box1).toBe(500);  // £500
      expect(formatted.box3).toBe(500);
      expect(formatted.box4).toBe(200);
      expect(formatted.box5).toBe(300);
      expect(formatted.box6).toBe(2500);
      expect(formatted.box7).toBe(1000);
    });

    it('should handle zero values', () => {
      const boxes = {
        box1: 0,
        box2: 0,
        box3: 0,
        box4: 0,
        box5: 0,
        box6: 0,
        box7: 0,
        box8: 0,
        box9: 0
      };
      
      const formatted = formatForSubmission(boxes);
      
      for (let i = 1; i <= 9; i++) {
        expect(formatted[`box${i}`]).toBe(0);
      }
    });
  });

  describe('ACCOUNTING_SCHEMES constant', () => {
    it('should have STANDARD and CASH schemes', () => {
      expect(ACCOUNTING_SCHEMES.STANDARD).toBe('standard');
      expect(ACCOUNTING_SCHEMES.CASH).toBe('cash');
    });
  });

  describe('VAT_BOX_DESCRIPTIONS constant', () => {
    it('should have descriptions for all nine boxes', () => {
      for (let i = 1; i <= 9; i++) {
        const boxKey = `box${i}`;
        expect(VAT_BOX_DESCRIPTIONS[boxKey]).toBeDefined();
        expect(VAT_BOX_DESCRIPTIONS[boxKey].name.en).toBeDefined();
        expect(VAT_BOX_DESCRIPTIONS[boxKey].name.tr).toBeDefined();
        expect(VAT_BOX_DESCRIPTIONS[boxKey].description.en).toBeDefined();
        expect(VAT_BOX_DESCRIPTIONS[boxKey].description.tr).toBeDefined();
      }
    });
  });

  describe('Manual verification scenarios', () => {
    it('should calculate correctly for typical small business quarter', () => {
      // Scenario: Small consultant with £20,000 sales, £5,000 expenses
      const data = {
        incomeTransactions: [],
        expenseTransactions: [
          { type: 'expense', status: 'confirmed', vatAmount: 100000, amount: 500000 } // £5,000 net, £1,000 VAT
        ],
        salesInvoices: [
          { status: 'paid', vatAmount: 400000, subtotal: 2000000 } // £20,000 net, £4,000 VAT
        ]
      };
      
      const result = calculateAllBoxes(data, { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
      
      expect(result.box1).toBe(400000);  // VAT on sales: £4,000
      expect(result.box2).toBe(0);       // No EU acquisitions
      expect(result.box3).toBe(400000);  // Total VAT due: £4,000
      expect(result.box4).toBe(100000);  // VAT reclaimed: £1,000
      expect(result.box5).toBe(300000);  // Net to pay: £3,000
      expect(result.box6).toBe(2000000); // Total sales: £20,000
      expect(result.box7).toBe(500000);  // Total purchases: £5,000
      expect(result.box8).toBe(0);       // No EU supplies
      expect(result.box9).toBe(0);       // No EU acquisitions
    });

    it('should calculate correctly for refund scenario', () => {
      // Scenario: Business with low sales but high capital purchases
      const data = {
        incomeTransactions: [],
        expenseTransactions: [
          { type: 'expense', status: 'confirmed', vatAmount: 1000000, amount: 5000000 } // £50,000 net, £10,000 VAT
        ],
        salesInvoices: [
          { status: 'paid', vatAmount: 200000, subtotal: 1000000 } // £10,000 net, £2,000 VAT
        ]
      };
      
      const result = calculateAllBoxes(data, { accountingScheme: ACCOUNTING_SCHEMES.STANDARD });
      
      expect(result.box1).toBe(200000);   // VAT on sales: £2,000
      expect(result.box3).toBe(200000);   // Total VAT due: £2,000
      expect(result.box4).toBe(1000000);  // VAT reclaimed: £10,000
      expect(result.box5).toBe(-800000);  // Refund due: £8,000
      expect(result.box6).toBe(1000000);  // Total sales: £10,000
      expect(result.box7).toBe(5000000);  // Total purchases: £50,000
    });

    it('should calculate correctly for zero VAT period', () => {
      // Scenario: No transactions
      const data = {
        incomeTransactions: [],
        expenseTransactions: [],
        salesInvoices: []
      };
      
      const result = calculateAllBoxes(data, {});
      
      for (let i = 1; i <= 9; i++) {
        expect(result[`box${i}`]).toBe(0);
      }
    });

    it('should handle mixed VAT rates correctly', () => {
      // Scenario: Standard and reduced rate items
      const data = {
        incomeTransactions: [],
        expenseTransactions: [
          { type: 'expense', status: 'confirmed', vatAmount: 2000, amount: 10000 },  // Standard rate item
          { type: 'expense', status: 'confirmed', vatAmount: 500, amount: 10000 },   // Reduced rate item
          { type: 'expense', status: 'confirmed', vatAmount: 0, amount: 5000 }       // Zero rate item
        ],
        salesInvoices: []
      };
      
      const result = calculateAllBoxes(data, { accountingScheme: ACCOUNTING_SCHEMES.CASH });
      
      expect(result.box4).toBe(2500);  // 2000 + 500 + 0
      expect(result.box7).toBe(25000); // 10000 + 10000 + 5000
    });
  });
});
