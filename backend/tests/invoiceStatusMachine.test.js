/**
 * Unit tests for Invoice Status Machine utility.
 * Tests status transitions, validation, and payment recording.
 * 
 * @module tests/invoiceStatusMachine.test
 */

const {
  INVOICE_STATUSES,
  STATUS_TRANSITIONS,
  STATUS_EVENTS,
  PAYMENT_METHODS,
  isValidTransition,
  getValidTransitions,
  isValidEvent,
  getTargetStatusForEvent,
  getValidEvents,
  prepareStatusChange,
  prepareEventChange,
  validatePaymentDetails,
  isTerminalStatus,
  isEditable,
  isDeletable,
  getStatusDescription
} = require('../utils/invoiceStatusMachine');

describe('Invoice Status Machine', () => {
  describe('Constants', () => {
    test('should have all expected statuses', () => {
      expect(INVOICE_STATUSES).toEqual([
        'draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'
      ]);
    });

    test('should have all expected payment methods', () => {
      expect(PAYMENT_METHODS).toEqual([
        'cash', 'bank_transfer', 'card', 'cheque', 'other'
      ]);
    });

    test('should have all expected events', () => {
      expect(STATUS_EVENTS).toEqual({
        SEND: 'send',
        MARK_PAID: 'mark_paid',
        MARK_OVERDUE: 'mark_overdue',
        CANCEL: 'cancel',
        REFUND: 'refund'
      });
    });
  });

  describe('isValidTransition', () => {
    describe('draft status transitions', () => {
      test('draft -> pending should be valid', () => {
        expect(isValidTransition('draft', 'pending')).toBe(true);
      });

      test('draft -> cancelled should be valid', () => {
        expect(isValidTransition('draft', 'cancelled')).toBe(true);
      });

      test('draft -> paid should be invalid', () => {
        expect(isValidTransition('draft', 'paid')).toBe(false);
      });

      test('draft -> overdue should be invalid', () => {
        expect(isValidTransition('draft', 'overdue')).toBe(false);
      });
    });

    describe('pending status transitions', () => {
      test('pending -> paid should be valid', () => {
        expect(isValidTransition('pending', 'paid')).toBe(true);
      });

      test('pending -> overdue should be valid', () => {
        expect(isValidTransition('pending', 'overdue')).toBe(true);
      });

      test('pending -> cancelled should be valid', () => {
        expect(isValidTransition('pending', 'cancelled')).toBe(true);
      });

      test('pending -> draft should be invalid', () => {
        expect(isValidTransition('pending', 'draft')).toBe(false);
      });
    });

    describe('paid status transitions', () => {
      test('paid -> refunded should be valid', () => {
        expect(isValidTransition('paid', 'refunded')).toBe(true);
      });

      test('paid -> pending should be invalid', () => {
        expect(isValidTransition('paid', 'pending')).toBe(false);
      });

      test('paid -> cancelled should be invalid', () => {
        expect(isValidTransition('paid', 'cancelled')).toBe(false);
      });
    });

    describe('overdue status transitions', () => {
      test('overdue -> paid should be valid', () => {
        expect(isValidTransition('overdue', 'paid')).toBe(true);
      });

      test('overdue -> cancelled should be valid', () => {
        expect(isValidTransition('overdue', 'cancelled')).toBe(true);
      });

      test('overdue -> pending should be invalid', () => {
        expect(isValidTransition('overdue', 'pending')).toBe(false);
      });
    });

    describe('terminal status transitions', () => {
      test('cancelled -> any status should be invalid', () => {
        INVOICE_STATUSES.forEach(status => {
          expect(isValidTransition('cancelled', status)).toBe(false);
        });
      });

      test('refunded -> any status should be invalid', () => {
        INVOICE_STATUSES.forEach(status => {
          expect(isValidTransition('refunded', status)).toBe(false);
        });
      });
    });

    describe('invalid inputs', () => {
      test('should return false for invalid current status', () => {
        expect(isValidTransition('invalid', 'pending')).toBe(false);
      });

      test('should return false for invalid target status', () => {
        expect(isValidTransition('draft', 'invalid')).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    test('should return valid transitions for draft', () => {
      expect(getValidTransitions('draft')).toEqual(['pending', 'cancelled']);
    });

    test('should return valid transitions for pending', () => {
      expect(getValidTransitions('pending')).toEqual(['paid', 'overdue', 'cancelled']);
    });

    test('should return valid transitions for paid', () => {
      expect(getValidTransitions('paid')).toEqual(['refunded']);
    });

    test('should return valid transitions for overdue', () => {
      expect(getValidTransitions('overdue')).toEqual(['paid', 'cancelled']);
    });

    test('should return empty array for cancelled', () => {
      expect(getValidTransitions('cancelled')).toEqual([]);
    });

    test('should return empty array for refunded', () => {
      expect(getValidTransitions('refunded')).toEqual([]);
    });

    test('should return empty array for invalid status', () => {
      expect(getValidTransitions('invalid')).toEqual([]);
    });
  });

  describe('isValidEvent', () => {
    test('SEND event should be valid from draft', () => {
      expect(isValidEvent('draft', STATUS_EVENTS.SEND)).toBe(true);
    });

    test('SEND event should not be valid from pending', () => {
      expect(isValidEvent('pending', STATUS_EVENTS.SEND)).toBe(false);
    });

    test('MARK_PAID event should be valid from pending', () => {
      expect(isValidEvent('pending', STATUS_EVENTS.MARK_PAID)).toBe(true);
    });

    test('MARK_PAID event should be valid from overdue', () => {
      expect(isValidEvent('overdue', STATUS_EVENTS.MARK_PAID)).toBe(true);
    });

    test('CANCEL event should be valid from draft, pending, overdue', () => {
      expect(isValidEvent('draft', STATUS_EVENTS.CANCEL)).toBe(true);
      expect(isValidEvent('pending', STATUS_EVENTS.CANCEL)).toBe(true);
      expect(isValidEvent('overdue', STATUS_EVENTS.CANCEL)).toBe(true);
    });

    test('REFUND event should only be valid from paid', () => {
      expect(isValidEvent('paid', STATUS_EVENTS.REFUND)).toBe(true);
      expect(isValidEvent('pending', STATUS_EVENTS.REFUND)).toBe(false);
    });

    test('should return false for invalid event', () => {
      expect(isValidEvent('draft', 'invalid_event')).toBe(false);
    });
  });

  describe('getTargetStatusForEvent', () => {
    test('should return pending for SEND event', () => {
      expect(getTargetStatusForEvent(STATUS_EVENTS.SEND)).toBe('pending');
    });

    test('should return paid for MARK_PAID event', () => {
      expect(getTargetStatusForEvent(STATUS_EVENTS.MARK_PAID)).toBe('paid');
    });

    test('should return overdue for MARK_OVERDUE event', () => {
      expect(getTargetStatusForEvent(STATUS_EVENTS.MARK_OVERDUE)).toBe('overdue');
    });

    test('should return cancelled for CANCEL event', () => {
      expect(getTargetStatusForEvent(STATUS_EVENTS.CANCEL)).toBe('cancelled');
    });

    test('should return refunded for REFUND event', () => {
      expect(getTargetStatusForEvent(STATUS_EVENTS.REFUND)).toBe('refunded');
    });

    test('should return null for invalid event', () => {
      expect(getTargetStatusForEvent('invalid')).toBeNull();
    });
  });

  describe('getValidEvents', () => {
    test('should return SEND and CANCEL for draft', () => {
      expect(getValidEvents('draft')).toEqual([STATUS_EVENTS.SEND, STATUS_EVENTS.CANCEL]);
    });

    test('should return MARK_PAID, MARK_OVERDUE, CANCEL for pending', () => {
      const events = getValidEvents('pending');
      expect(events).toContain(STATUS_EVENTS.MARK_PAID);
      expect(events).toContain(STATUS_EVENTS.MARK_OVERDUE);
      expect(events).toContain(STATUS_EVENTS.CANCEL);
    });

    test('should return REFUND for paid', () => {
      expect(getValidEvents('paid')).toEqual([STATUS_EVENTS.REFUND]);
    });

    test('should return MARK_PAID and CANCEL for overdue', () => {
      const events = getValidEvents('overdue');
      expect(events).toContain(STATUS_EVENTS.MARK_PAID);
      expect(events).toContain(STATUS_EVENTS.CANCEL);
    });

    test('should return empty array for cancelled', () => {
      expect(getValidEvents('cancelled')).toEqual([]);
    });
  });

  describe('validatePaymentDetails', () => {
    test('should pass validation for empty payment details', () => {
      const result = validatePaymentDetails({});
      expect(result.isValid).toBe(true);
    });

    test('should pass validation for valid payment details', () => {
      const result = validatePaymentDetails({
        paymentDate: '2026-01-12T10:30:00Z',
        paymentMethod: 'bank_transfer',
        paymentReference: 'REF-123',
        paymentAmount: 10000,
        notes: 'Payment received'
      });
      expect(result.isValid).toBe(true);
    });

    test('should fail validation for invalid paymentDate', () => {
      const result = validatePaymentDetails({
        paymentDate: 'invalid-date'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentDate).toBeDefined();
    });

    test('should fail validation for invalid paymentMethod', () => {
      const result = validatePaymentDetails({
        paymentMethod: 'invalid_method'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentMethod).toBeDefined();
    });

    test('should fail validation for paymentReference too long', () => {
      const result = validatePaymentDetails({
        paymentReference: 'x'.repeat(101)
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentReference).toContain('100 characters');
    });

    test('should fail validation for negative paymentAmount', () => {
      const result = validatePaymentDetails({
        paymentAmount: -100
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentAmount).toBeDefined();
    });

    test('should fail validation for non-integer paymentAmount', () => {
      const result = validatePaymentDetails({
        paymentAmount: 100.50
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.paymentAmount).toBeDefined();
    });

    test('should fail validation for notes too long', () => {
      const result = validatePaymentDetails({
        notes: 'x'.repeat(1001)
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.notes).toContain('1000 characters');
    });
  });

  describe('prepareStatusChange', () => {
    test('should succeed for valid transition draft -> pending', () => {
      const result = prepareStatusChange('draft', 'pending');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('pending');
      expect(result.data.previousStatus).toBe('draft');
      expect(result.data.sentAt).toBeDefined();
    });

    test('should succeed for valid transition pending -> paid', () => {
      const result = prepareStatusChange('pending', 'paid');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('paid');
      expect(result.data.paidAt).toBeDefined();
    });

    test('should include payment details when marking as paid', () => {
      const paymentDetails = {
        paymentDate: '2026-01-12T10:00:00Z',
        paymentMethod: 'bank_transfer',
        paymentReference: 'REF-123',
        paymentAmount: 12000,
        notes: 'Full payment received'
      };
      
      const result = prepareStatusChange('pending', 'paid', paymentDetails);
      
      expect(result.success).toBe(true);
      expect(result.data.paidAt).toBe('2026-01-12T10:00:00Z');
      expect(result.data.paymentMethod).toBe('bank_transfer');
      expect(result.data.paymentReference).toBe('REF-123');
      expect(result.data.paymentAmount).toBe(12000);
      expect(result.data.paymentNotes).toBe('Full payment received');
    });

    test('should fail for invalid transition draft -> paid', () => {
      const result = prepareStatusChange('draft', 'paid');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot change status from 'draft' to 'paid'");
    });

    test('should fail for invalid transition from cancelled', () => {
      const result = prepareStatusChange('cancelled', 'pending');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No transitions available');
    });

    test('should fail for invalid payment details', () => {
      const paymentDetails = {
        paymentMethod: 'invalid_method'
      };
      
      const result = prepareStatusChange('pending', 'paid', paymentDetails);
      
      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors.paymentMethod).toBeDefined();
    });

    test('should include cancelledAt for cancellation', () => {
      const result = prepareStatusChange('pending', 'cancelled');
      
      expect(result.success).toBe(true);
      expect(result.data.cancelledAt).toBeDefined();
    });

    test('should include refundedAt for refund', () => {
      const result = prepareStatusChange('paid', 'refunded');
      
      expect(result.success).toBe(true);
      expect(result.data.refundedAt).toBeDefined();
    });

    test('should fail for invalid current status', () => {
      const result = prepareStatusChange('invalid', 'pending');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid current status');
    });

    test('should fail for invalid target status', () => {
      const result = prepareStatusChange('draft', 'invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid target status');
    });
  });

  describe('prepareEventChange', () => {
    test('should succeed for SEND event from draft', () => {
      const result = prepareEventChange('draft', STATUS_EVENTS.SEND);
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('pending');
    });

    test('should succeed for MARK_PAID event from pending', () => {
      const result = prepareEventChange('pending', STATUS_EVENTS.MARK_PAID, {
        paymentMethod: 'card'
      });
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('paid');
      expect(result.data.paymentMethod).toBe('card');
    });

    test('should fail for invalid event', () => {
      const result = prepareEventChange('draft', 'invalid_event');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid event');
    });

    test('should fail for event not valid from current status', () => {
      const result = prepareEventChange('cancelled', STATUS_EVENTS.SEND);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot trigger 'send' from status 'cancelled'");
    });
  });

  describe('isTerminalStatus', () => {
    test('cancelled should be terminal', () => {
      expect(isTerminalStatus('cancelled')).toBe(true);
    });

    test('refunded should be terminal', () => {
      expect(isTerminalStatus('refunded')).toBe(true);
    });

    test('draft should not be terminal', () => {
      expect(isTerminalStatus('draft')).toBe(false);
    });

    test('pending should not be terminal', () => {
      expect(isTerminalStatus('pending')).toBe(false);
    });

    test('paid should not be terminal', () => {
      expect(isTerminalStatus('paid')).toBe(false);
    });
  });

  describe('isEditable', () => {
    test('draft should be editable', () => {
      expect(isEditable('draft')).toBe(true);
    });

    test('pending should not be editable', () => {
      expect(isEditable('pending')).toBe(false);
    });

    test('paid should not be editable', () => {
      expect(isEditable('paid')).toBe(false);
    });
  });

  describe('isDeletable', () => {
    test('draft should be deletable', () => {
      expect(isDeletable('draft')).toBe(true);
    });

    test('pending should not be deletable', () => {
      expect(isDeletable('pending')).toBe(false);
    });

    test('paid should not be deletable', () => {
      expect(isDeletable('paid')).toBe(false);
    });
  });

  describe('getStatusDescription', () => {
    test('should return English description by default', () => {
      expect(getStatusDescription('draft')).toBe('Draft - Invoice is being prepared');
      expect(getStatusDescription('paid')).toBe('Paid - Payment received');
    });

    test('should return Turkish description when specified', () => {
      expect(getStatusDescription('draft', 'tr')).toBe('Taslak - Fatura hazırlanıyor');
      expect(getStatusDescription('paid', 'tr')).toBe('Ödendi - Ödeme alındı');
    });

    test('should return status string for unknown status', () => {
      expect(getStatusDescription('unknown')).toBe('unknown');
    });
  });
});
