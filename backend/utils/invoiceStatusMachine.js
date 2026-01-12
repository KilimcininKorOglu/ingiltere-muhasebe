/**
 * Invoice Status Machine
 * Manages invoice status transitions with validation and payment recording.
 * Provides a state machine pattern for invoice status management.
 * 
 * @module utils/invoiceStatusMachine
 */

/**
 * Valid invoice statuses
 */
const INVOICE_STATUSES = ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'];

/**
 * Status transition map defining valid transitions from each status.
 * Key: current status, Value: array of valid next statuses
 */
const STATUS_TRANSITIONS = {
  'draft': ['pending', 'cancelled'],
  'pending': ['paid', 'overdue', 'cancelled'],
  'paid': ['refunded'],
  'overdue': ['paid', 'cancelled'],
  'cancelled': [],
  'refunded': []
};

/**
 * Status events that trigger specific actions
 */
const STATUS_EVENTS = {
  SEND: 'send',           // draft -> pending (mark as sent)
  MARK_PAID: 'mark_paid', // pending/overdue -> paid
  MARK_OVERDUE: 'mark_overdue', // pending -> overdue
  CANCEL: 'cancel',       // draft/pending/overdue -> cancelled
  REFUND: 'refund'        // paid -> refunded
};

/**
 * Map of events to their resulting status
 */
const EVENT_TO_STATUS = {
  [STATUS_EVENTS.SEND]: 'pending',
  [STATUS_EVENTS.MARK_PAID]: 'paid',
  [STATUS_EVENTS.MARK_OVERDUE]: 'overdue',
  [STATUS_EVENTS.CANCEL]: 'cancelled',
  [STATUS_EVENTS.REFUND]: 'refunded'
};

/**
 * Map of events to valid source statuses
 */
const EVENT_VALID_FROM = {
  [STATUS_EVENTS.SEND]: ['draft'],
  [STATUS_EVENTS.MARK_PAID]: ['pending', 'overdue'],
  [STATUS_EVENTS.MARK_OVERDUE]: ['pending'],
  [STATUS_EVENTS.CANCEL]: ['draft', 'pending', 'overdue'],
  [STATUS_EVENTS.REFUND]: ['paid']
};

/**
 * Payment method options for recording payments
 */
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'other'];

/**
 * Validates if a status transition is allowed.
 * 
 * @param {string} currentStatus - Current invoice status
 * @param {string} targetStatus - Target status to transition to
 * @returns {boolean} Whether the transition is valid
 */
function isValidTransition(currentStatus, targetStatus) {
  if (!INVOICE_STATUSES.includes(currentStatus) || !INVOICE_STATUSES.includes(targetStatus)) {
    return false;
  }
  
  const validTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(targetStatus);
}

/**
 * Gets valid target statuses for a given current status.
 * 
 * @param {string} currentStatus - Current invoice status
 * @returns {string[]} Array of valid target statuses
 */
function getValidTransitions(currentStatus) {
  if (!INVOICE_STATUSES.includes(currentStatus)) {
    return [];
  }
  return STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Validates if an event can be triggered from the current status.
 * 
 * @param {string} currentStatus - Current invoice status
 * @param {string} event - Event to trigger
 * @returns {boolean} Whether the event is valid
 */
function isValidEvent(currentStatus, event) {
  const validFromStatuses = EVENT_VALID_FROM[event];
  if (!validFromStatuses) {
    return false;
  }
  return validFromStatuses.includes(currentStatus);
}

/**
 * Gets the target status for an event.
 * 
 * @param {string} event - Event name
 * @returns {string|null} Target status or null if invalid event
 */
function getTargetStatusForEvent(event) {
  return EVENT_TO_STATUS[event] || null;
}

/**
 * Gets valid events that can be triggered from the current status.
 * 
 * @param {string} currentStatus - Current invoice status
 * @returns {string[]} Array of valid events
 */
function getValidEvents(currentStatus) {
  const validEvents = [];
  for (const [event, validFromStatuses] of Object.entries(EVENT_VALID_FROM)) {
    if (validFromStatuses.includes(currentStatus)) {
      validEvents.push(event);
    }
  }
  return validEvents;
}

/**
 * Payment details object
 * @typedef {Object} PaymentDetails
 * @property {string} [paymentDate] - Date of payment (ISO 8601 format, defaults to now)
 * @property {string} [paymentMethod] - Payment method (cash, bank_transfer, card, cheque, other)
 * @property {string} [paymentReference] - External payment reference
 * @property {number} [paymentAmount] - Amount paid in pence (defaults to invoice total)
 * @property {string} [notes] - Additional payment notes
 */

/**
 * Validates payment details.
 * 
 * @param {PaymentDetails} paymentDetails - Payment details to validate
 * @returns {{isValid: boolean, errors: Object.<string, string>}}
 */
function validatePaymentDetails(paymentDetails) {
  const errors = {};
  
  if (paymentDetails.paymentDate) {
    // Validate ISO 8601 format
    const date = new Date(paymentDetails.paymentDate);
    if (isNaN(date.getTime())) {
      errors.paymentDate = 'Invalid payment date format (ISO 8601)';
    }
  }
  
  if (paymentDetails.paymentMethod) {
    if (!PAYMENT_METHODS.includes(paymentDetails.paymentMethod)) {
      errors.paymentMethod = `Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}`;
    }
  }
  
  if (paymentDetails.paymentReference && typeof paymentDetails.paymentReference !== 'string') {
    errors.paymentReference = 'Payment reference must be a string';
  }
  
  if (paymentDetails.paymentReference && paymentDetails.paymentReference.length > 100) {
    errors.paymentReference = 'Payment reference must not exceed 100 characters';
  }
  
  if (paymentDetails.paymentAmount !== undefined) {
    if (!Number.isInteger(paymentDetails.paymentAmount) || paymentDetails.paymentAmount < 0) {
      errors.paymentAmount = 'Payment amount must be a non-negative integer (in pence)';
    }
  }
  
  if (paymentDetails.notes && typeof paymentDetails.notes !== 'string') {
    errors.notes = 'Notes must be a string';
  }
  
  if (paymentDetails.notes && paymentDetails.notes.length > 1000) {
    errors.notes = 'Notes must not exceed 1000 characters';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Status change result
 * @typedef {Object} StatusChangeResult
 * @property {boolean} success - Whether the change was successful
 * @property {string} [newStatus] - The new status after change
 * @property {string} [error] - Error message if failed
 * @property {Object.<string, string>} [validationErrors] - Validation errors
 * @property {Object} [data] - Additional data (e.g., timestamps)
 */

/**
 * Prepares a status change with validation.
 * Does not perform the actual update - that's left to the controller.
 * 
 * @param {string} currentStatus - Current invoice status
 * @param {string} targetStatus - Target status to transition to
 * @param {PaymentDetails} [paymentDetails] - Payment details (required when marking as paid)
 * @returns {StatusChangeResult}
 */
function prepareStatusChange(currentStatus, targetStatus, paymentDetails = null) {
  // Validate current status
  if (!INVOICE_STATUSES.includes(currentStatus)) {
    return {
      success: false,
      error: `Invalid current status: ${currentStatus}`
    };
  }
  
  // Validate target status
  if (!INVOICE_STATUSES.includes(targetStatus)) {
    return {
      success: false,
      error: `Invalid target status: ${targetStatus}. Must be one of: ${INVOICE_STATUSES.join(', ')}`
    };
  }
  
  // Check if transition is valid
  if (!isValidTransition(currentStatus, targetStatus)) {
    const validTargets = getValidTransitions(currentStatus);
    const validMsg = validTargets.length > 0 
      ? `Valid transitions: ${validTargets.join(', ')}`
      : 'No transitions available from this status';
    
    return {
      success: false,
      error: `Cannot change status from '${currentStatus}' to '${targetStatus}'. ${validMsg}`
    };
  }
  
  // Build response data
  const data = {
    previousStatus: currentStatus,
    newStatus: targetStatus,
    updatedAt: new Date().toISOString()
  };
  
  // Special handling for 'paid' status - record payment details
  if (targetStatus === 'paid') {
    if (paymentDetails) {
      const validation = validatePaymentDetails(paymentDetails);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Invalid payment details',
          validationErrors: validation.errors
        };
      }
      
      data.paidAt = paymentDetails.paymentDate || new Date().toISOString();
      data.paymentMethod = paymentDetails.paymentMethod || null;
      data.paymentReference = paymentDetails.paymentReference || null;
      data.paymentAmount = paymentDetails.paymentAmount;
      data.paymentNotes = paymentDetails.notes || null;
    } else {
      // Default payment timestamp
      data.paidAt = new Date().toISOString();
    }
  }
  
  // Special handling for 'pending' status - record sentAt timestamp
  if (targetStatus === 'pending' && currentStatus === 'draft') {
    data.sentAt = new Date().toISOString();
  }
  
  // Special handling for 'cancelled' status
  if (targetStatus === 'cancelled') {
    data.cancelledAt = new Date().toISOString();
  }
  
  // Special handling for 'refunded' status
  if (targetStatus === 'refunded') {
    data.refundedAt = new Date().toISOString();
  }
  
  return {
    success: true,
    newStatus: targetStatus,
    data
  };
}

/**
 * Prepares an event-based status change.
 * 
 * @param {string} currentStatus - Current invoice status
 * @param {string} event - Event to trigger
 * @param {PaymentDetails} [paymentDetails] - Payment details (for MARK_PAID event)
 * @returns {StatusChangeResult}
 */
function prepareEventChange(currentStatus, event, paymentDetails = null) {
  // Validate event
  const targetStatus = getTargetStatusForEvent(event);
  if (!targetStatus) {
    return {
      success: false,
      error: `Invalid event: ${event}. Valid events: ${Object.values(STATUS_EVENTS).join(', ')}`
    };
  }
  
  // Check if event is valid from current status
  if (!isValidEvent(currentStatus, event)) {
    const validEvents = getValidEvents(currentStatus);
    const validMsg = validEvents.length > 0
      ? `Valid events: ${validEvents.join(', ')}`
      : 'No events available from this status';
    
    return {
      success: false,
      error: `Cannot trigger '${event}' from status '${currentStatus}'. ${validMsg}`
    };
  }
  
  return prepareStatusChange(currentStatus, targetStatus, paymentDetails);
}

/**
 * Checks if an invoice is in a terminal status (cannot be changed).
 * 
 * @param {string} status - Invoice status
 * @returns {boolean} Whether the status is terminal
 */
function isTerminalStatus(status) {
  const validTransitions = STATUS_TRANSITIONS[status];
  return !validTransitions || validTransitions.length === 0;
}

/**
 * Checks if an invoice is editable (only draft invoices can be edited).
 * 
 * @param {string} status - Invoice status
 * @returns {boolean} Whether the invoice can be edited
 */
function isEditable(status) {
  return status === 'draft';
}

/**
 * Checks if an invoice can be deleted.
 * 
 * @param {string} status - Invoice status
 * @returns {boolean} Whether the invoice can be deleted
 */
function isDeletable(status) {
  return status === 'draft';
}

/**
 * Gets a human-readable description of a status.
 * 
 * @param {string} status - Invoice status
 * @param {string} [lang='en'] - Language code (en, tr)
 * @returns {string} Human-readable status description
 */
function getStatusDescription(status, lang = 'en') {
  const descriptions = {
    draft: {
      en: 'Draft - Invoice is being prepared',
      tr: 'Taslak - Fatura hazırlanıyor'
    },
    pending: {
      en: 'Pending - Awaiting payment',
      tr: 'Beklemede - Ödeme bekleniyor'
    },
    paid: {
      en: 'Paid - Payment received',
      tr: 'Ödendi - Ödeme alındı'
    },
    overdue: {
      en: 'Overdue - Payment is past due date',
      tr: 'Gecikmiş - Ödeme vadesi geçmiş'
    },
    cancelled: {
      en: 'Cancelled - Invoice has been cancelled',
      tr: 'İptal Edildi - Fatura iptal edildi'
    },
    refunded: {
      en: 'Refunded - Payment has been refunded',
      tr: 'İade Edildi - Ödeme iade edildi'
    }
  };
  
  const statusDesc = descriptions[status];
  if (!statusDesc) {
    return status;
  }
  
  return statusDesc[lang] || statusDesc.en;
}

module.exports = {
  // Constants
  INVOICE_STATUSES,
  STATUS_TRANSITIONS,
  STATUS_EVENTS,
  PAYMENT_METHODS,
  
  // Transition validation
  isValidTransition,
  getValidTransitions,
  
  // Event-based operations
  isValidEvent,
  getTargetStatusForEvent,
  getValidEvents,
  
  // Status change preparation
  prepareStatusChange,
  prepareEventChange,
  validatePaymentDetails,
  
  // Status utilities
  isTerminalStatus,
  isEditable,
  isDeletable,
  getStatusDescription
};
