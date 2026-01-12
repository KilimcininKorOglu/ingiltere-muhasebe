/**
 * Unit Tests for Invoice Calculator Utility
 */

const {
  calculateVatAmount,
  calculateLineItem,
  calculateInvoiceTotals,
  calculateDueDate,
  validateLineItem,
  validateLineItems,
  isValidDate,
  formatAmount,
  toPence,
  fromPence,
  VAT_RATES,
  VALID_VAT_RATE_IDS
} = require('../utils/invoiceCalculator');

describe('Invoice Calculator Utility', () => {
  describe('calculateVatAmount', () => {
    it('should calculate VAT for standard rate (20%)', () => {
      expect(calculateVatAmount(10000, 20)).toBe(2000);
    });

    it('should calculate VAT for reduced rate (5%)', () => {
      expect(calculateVatAmount(10000, 5)).toBe(500);
    });

    it('should return 0 for zero rate', () => {
      expect(calculateVatAmount(10000, 0)).toBe(0);
    });

    it('should return 0 for null rate', () => {
      expect(calculateVatAmount(10000, null)).toBe(0);
    });

    it('should return 0 for negative rate', () => {
      expect(calculateVatAmount(10000, -5)).toBe(0);
    });

    it('should round to nearest pence', () => {
      expect(calculateVatAmount(333, 20)).toBe(67); // 333 * 0.2 = 66.6 -> 67
    });

    it('should handle invalid inputs gracefully', () => {
      expect(calculateVatAmount('100', 20)).toBe(0);
      expect(calculateVatAmount(100, 'twenty')).toBe(0);
    });
  });

  describe('calculateLineItem', () => {
    it('should calculate line item with default standard VAT', () => {
      const item = {
        description: 'Test Service',
        quantity: 2,
        unitPrice: 10000 // £100.00
      };
      
      const result = calculateLineItem(item);
      
      expect(result.description).toBe('Test Service');
      expect(result.quantity).toBe('2');
      expect(result.unitPrice).toBe(10000);
      expect(result.vatRateId).toBe('standard');
      expect(result.vatRatePercent).toBe(20);
      expect(result.netAmount).toBe(20000); // 2 * £100 = £200
      expect(result.vatAmount).toBe(4000); // £200 * 20% = £40
      expect(result.lineTotal).toBe(24000); // £200 + £40 = £240
    });

    it('should calculate line item with reduced VAT rate', () => {
      const item = {
        description: 'Reduced VAT Item',
        quantity: 1,
        unitPrice: 10000,
        vatRate: 'reduced'
      };
      
      const result = calculateLineItem(item);
      
      expect(result.vatRateId).toBe('reduced');
      expect(result.vatRatePercent).toBe(5);
      expect(result.vatAmount).toBe(500);
      expect(result.lineTotal).toBe(10500);
    });

    it('should calculate line item with zero VAT rate', () => {
      const item = {
        description: 'Zero VAT Item',
        quantity: 1,
        unitPrice: 10000,
        vatRate: 'zero'
      };
      
      const result = calculateLineItem(item);
      
      expect(result.vatRateId).toBe('zero');
      expect(result.vatRatePercent).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.lineTotal).toBe(10000);
    });

    it('should handle numeric VAT rate', () => {
      const item = {
        description: 'Custom VAT Item',
        quantity: 1,
        unitPrice: 10000,
        vatRate: 15
      };
      
      const result = calculateLineItem(item);
      
      expect(result.vatRatePercent).toBe(15);
      expect(result.vatAmount).toBe(1500);
      expect(result.lineTotal).toBe(11500);
    });

    it('should handle decimal quantity', () => {
      const item = {
        description: 'Fractional Item',
        quantity: 1.5,
        unitPrice: 10000
      };
      
      const result = calculateLineItem(item);
      
      expect(result.quantity).toBe('1.5');
      expect(result.netAmount).toBe(15000);
      expect(result.vatAmount).toBe(3000);
      expect(result.lineTotal).toBe(18000);
    });

    it('should default quantity to 1 if not provided', () => {
      const item = {
        description: 'No Quantity',
        unitPrice: 10000
      };
      
      const result = calculateLineItem(item);
      
      expect(result.quantity).toBe('1');
      expect(result.netAmount).toBe(10000);
    });
  });

  describe('calculateInvoiceTotals', () => {
    it('should calculate totals for multiple items', () => {
      const items = [
        { description: 'Service 1', quantity: 2, unitPrice: 10000, vatRate: 20 },
        { description: 'Service 2', quantity: 1, unitPrice: 5000, vatRate: 20 }
      ];
      
      const result = calculateInvoiceTotals(items);
      
      expect(result.subtotal).toBe(25000); // 2*100 + 1*50 = £250
      expect(result.vatAmount).toBe(5000); // £250 * 20% = £50
      expect(result.totalAmount).toBe(30000); // £250 + £50 = £300
      expect(result.calculatedItems).toHaveLength(2);
    });

    it('should calculate totals with mixed VAT rates', () => {
      const items = [
        { description: 'Standard', quantity: 1, unitPrice: 10000, vatRate: 'standard' },
        { description: 'Reduced', quantity: 1, unitPrice: 10000, vatRate: 'reduced' },
        { description: 'Zero', quantity: 1, unitPrice: 10000, vatRate: 'zero' }
      ];
      
      const result = calculateInvoiceTotals(items);
      
      expect(result.subtotal).toBe(30000);
      expect(result.vatAmount).toBe(2500); // 2000 + 500 + 0
      expect(result.totalAmount).toBe(32500);
      expect(result.vatBreakdown).toHaveLength(3);
    });

    it('should return zeros for empty array', () => {
      const result = calculateInvoiceTotals([]);
      
      expect(result.subtotal).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.calculatedItems).toHaveLength(0);
    });

    it('should return zeros for non-array input', () => {
      const result = calculateInvoiceTotals(null);
      
      expect(result.subtotal).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should include VAT breakdown by rate', () => {
      const items = [
        { description: 'Item 1', quantity: 1, unitPrice: 10000, vatRate: 'standard' },
        { description: 'Item 2', quantity: 1, unitPrice: 10000, vatRate: 'standard' },
        { description: 'Item 3', quantity: 1, unitPrice: 5000, vatRate: 'reduced' }
      ];
      
      const result = calculateInvoiceTotals(items);
      
      expect(result.vatBreakdown).toHaveLength(2);
      
      const standardBreakdown = result.vatBreakdown.find(b => b.vatRateId === 'standard');
      expect(standardBreakdown.netAmount).toBe(20000);
      expect(standardBreakdown.vatAmount).toBe(4000);
      
      const reducedBreakdown = result.vatBreakdown.find(b => b.vatRateId === 'reduced');
      expect(reducedBreakdown.netAmount).toBe(5000);
      expect(reducedBreakdown.vatAmount).toBe(250);
    });
  });

  describe('validateLineItem', () => {
    it('should return no errors for valid item', () => {
      const item = {
        description: 'Valid Item',
        quantity: 1,
        unitPrice: 10000,
        vatRate: 20
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing description', () => {
      const item = {
        quantity: 1,
        unitPrice: 10000
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('items[0].description');
    });

    it('should return error for empty description', () => {
      const item = {
        description: '   ',
        quantity: 1,
        unitPrice: 10000
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors.some(e => e.field === 'items[0].description')).toBe(true);
    });

    it('should return error for missing unit price', () => {
      const item = {
        description: 'Test Item',
        quantity: 1
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors.some(e => e.field === 'items[0].unitPrice')).toBe(true);
    });

    it('should return error for negative unit price', () => {
      const item = {
        description: 'Test Item',
        quantity: 1,
        unitPrice: -100
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors.some(e => e.field === 'items[0].unitPrice')).toBe(true);
    });

    it('should return error for invalid quantity', () => {
      const item = {
        description: 'Test Item',
        quantity: -1,
        unitPrice: 10000
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors.some(e => e.field === 'items[0].quantity')).toBe(true);
    });

    it('should return error for invalid VAT rate string', () => {
      const item = {
        description: 'Test Item',
        quantity: 1,
        unitPrice: 10000,
        vatRate: 'invalid-rate'
      };
      
      const errors = validateLineItem(item, 0);
      
      expect(errors.some(e => e.field === 'items[0].vatRate')).toBe(true);
    });
  });

  describe('validateLineItems', () => {
    it('should return valid for array with valid items', () => {
      const items = [
        { description: 'Item 1', quantity: 1, unitPrice: 10000 },
        { description: 'Item 2', quantity: 2, unitPrice: 5000 }
      ];
      
      const result = validateLineItems(items);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for non-array input', () => {
      const result = validateLineItems('not-an-array');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'items')).toBe(true);
    });

    it('should return error for empty array', () => {
      const result = validateLineItems([]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'items')).toBe(true);
    });

    it('should return error for too many items', () => {
      const items = Array(101).fill({ description: 'Item', quantity: 1, unitPrice: 100 });
      
      const result = validateLineItems(items);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'items')).toBe(true);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid date', () => {
      expect(isValidDate('2026-01-12')).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(isValidDate('12-01-2026')).toBe(false);
      expect(isValidDate('2026/01/12')).toBe(false);
    });

    it('should return false for invalid date', () => {
      expect(isValidDate('2026-02-30')).toBe(false);
      expect(isValidDate('2026-13-01')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });
  });

  describe('calculateDueDate', () => {
    it('should calculate due date with default 30 days', () => {
      const result = calculateDueDate('2026-01-01');
      expect(result).toBe('2026-01-31');
    });

    it('should calculate due date with custom payment terms', () => {
      const result = calculateDueDate('2026-01-01', 14);
      expect(result).toBe('2026-01-15');
    });

    it('should handle month boundaries', () => {
      const result = calculateDueDate('2026-01-15', 30);
      expect(result).toBe('2026-02-14');
    });
  });

  describe('formatAmount', () => {
    it('should format GBP amounts correctly', () => {
      expect(formatAmount(12345, 'GBP')).toBe('£123.45');
    });

    it('should format EUR amounts correctly', () => {
      expect(formatAmount(12345, 'EUR')).toBe('€123.45');
    });

    it('should format USD amounts correctly', () => {
      expect(formatAmount(12345, 'USD')).toBe('$123.45');
    });

    it('should default to GBP', () => {
      expect(formatAmount(12345)).toBe('£123.45');
    });
  });

  describe('toPence', () => {
    it('should convert decimal to pence', () => {
      expect(toPence(123.45)).toBe(12345);
    });

    it('should convert string to pence', () => {
      expect(toPence('123.45')).toBe(12345);
    });

    it('should round correctly', () => {
      expect(toPence(123.456)).toBe(12346);
    });

    it('should return 0 for invalid input', () => {
      expect(toPence('invalid')).toBe(0);
    });
  });

  describe('fromPence', () => {
    it('should convert pence to decimal', () => {
      expect(fromPence(12345)).toBe(123.45);
    });

    it('should return 0 for non-number', () => {
      expect(fromPence('12345')).toBe(0);
    });
  });

  describe('constants', () => {
    it('should have correct VAT rates', () => {
      expect(VAT_RATES['standard']).toBe(20);
      expect(VAT_RATES['reduced']).toBe(5);
      expect(VAT_RATES['zero']).toBe(0);
      expect(VAT_RATES['exempt']).toBe(0);
      expect(VAT_RATES['outside-scope']).toBe(null);
    });

    it('should have all valid VAT rate IDs', () => {
      expect(VALID_VAT_RATE_IDS).toContain('standard');
      expect(VALID_VAT_RATE_IDS).toContain('reduced');
      expect(VALID_VAT_RATE_IDS).toContain('zero');
      expect(VALID_VAT_RATE_IDS).toContain('exempt');
      expect(VALID_VAT_RATE_IDS).toContain('outside-scope');
    });
  });
});
