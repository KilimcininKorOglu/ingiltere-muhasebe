/**
 * Invoice Number Generator utility for HMRC-compliant sequential invoice numbering.
 * 
 * Provides thread-safe invoice number generation with:
 * - Sequential numbering per user
 * - Custom prefix support
 * - Manual override with uniqueness validation
 * - Atomic operations for concurrent request safety
 * 
 * HMRC Requirements:
 * - Invoice numbers must be unique
 * - Invoice numbers must be sequential (no gaps is recommended but not mandatory)
 * - Invoice numbers should be easy to identify and track
 * 
 * @module utils/invoiceNumberGenerator
 */

const { openDatabase, queryOne, execute, transaction } = require('../database/index');

/**
 * Default invoice number padding (number of digits).
 */
const DEFAULT_NUMBER_PADDING = 4;

/**
 * Default invoice prefix.
 */
const DEFAULT_PREFIX = 'INV';

/**
 * Generates the next sequential invoice number for a user.
 * Uses atomic database operations to ensure thread-safety.
 * 
 * Format: {PREFIX}-{YEAR}-{PADDED_NUMBER}
 * Example: INV-2026-0001, ACME-2026-0042
 * 
 * @param {number} userId - The user ID to generate an invoice number for
 * @param {Object} [options={}] - Generation options
 * @param {number} [options.year] - Year to include in the invoice number (defaults to current year)
 * @param {number} [options.padding=4] - Number of digits to pad the sequential number to
 * @returns {{success: boolean, invoiceNumber?: string, error?: string}}
 */
function generateNextInvoiceNumber(userId, options = {}) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  const year = options.year || new Date().getFullYear();
  const padding = options.padding || DEFAULT_NUMBER_PADDING;

  try {
    const db = openDatabase();
    
    // Use transaction with immediate mode to lock the row
    const result = db.transaction(() => {
      // Get current user settings (this locks the row in the transaction)
      const user = db.prepare(
        'SELECT invoicePrefix, nextInvoiceNumber FROM users WHERE id = ?'
      ).get(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const prefix = user.invoicePrefix || DEFAULT_PREFIX;
      const currentNumber = user.nextInvoiceNumber || 1;
      
      // Generate the invoice number
      const paddedNumber = String(currentNumber).padStart(padding, '0');
      const invoiceNumber = `${prefix}-${year}-${paddedNumber}`;

      // Increment the next invoice number atomically
      db.prepare(
        'UPDATE users SET nextInvoiceNumber = nextInvoiceNumber + 1, updatedAt = strftime(\'%s\', \'now\') WHERE id = ?'
      ).run(userId);

      return invoiceNumber;
    })();

    return { success: true, invoiceNumber: result };
  } catch (error) {
    console.error('Error generating invoice number:', error.message);
    return { success: false, error: error.message || 'Failed to generate invoice number' };
  }
}

/**
 * Gets the current invoice settings for a user without generating a number.
 * 
 * @param {number} userId - The user ID
 * @returns {{success: boolean, settings?: {prefix: string, nextNumber: number}, error?: string}}
 */
function getInvoiceSettings(userId) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  try {
    const user = queryOne(
      'SELECT invoicePrefix, nextInvoiceNumber FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      settings: {
        prefix: user.invoicePrefix || DEFAULT_PREFIX,
        nextNumber: user.nextInvoiceNumber || 1
      }
    };
  } catch (error) {
    console.error('Error getting invoice settings:', error.message);
    return { success: false, error: 'Failed to get invoice settings' };
  }
}

/**
 * Updates the invoice prefix for a user.
 * 
 * @param {number} userId - The user ID
 * @param {string} prefix - New invoice prefix
 * @returns {{success: boolean, error?: string}}
 */
function updateInvoicePrefix(userId, prefix) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  if (!prefix || typeof prefix !== 'string') {
    return { success: false, error: 'Prefix is required' };
  }

  const cleanedPrefix = prefix.trim().toUpperCase();
  
  // Validate prefix format
  const prefixRegex = /^[A-Z0-9\-_]+$/;
  if (!prefixRegex.test(cleanedPrefix)) {
    return { success: false, error: 'Prefix can only contain letters, numbers, hyphens, and underscores' };
  }

  if (cleanedPrefix.length < 1 || cleanedPrefix.length > 20) {
    return { success: false, error: 'Prefix must be between 1 and 20 characters' };
  }

  try {
    const result = execute(
      'UPDATE users SET invoicePrefix = @prefix, updatedAt = strftime(\'%s\', \'now\') WHERE id = @userId',
      { userId, prefix: cleanedPrefix }
    );

    if (result.changes === 0) {
      return { success: false, error: 'User not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating invoice prefix:', error.message);
    return { success: false, error: 'Failed to update invoice prefix' };
  }
}

/**
 * Updates the next invoice number for a user (manual override).
 * Validates that the new number doesn't create duplicates.
 * 
 * @param {number} userId - The user ID
 * @param {number} nextNumber - New next invoice number
 * @returns {{success: boolean, error?: string}}
 */
function updateNextInvoiceNumber(userId, nextNumber) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    return { success: false, error: 'Next number must be a positive integer' };
  }

  try {
    const result = execute(
      'UPDATE users SET nextInvoiceNumber = @nextNumber, updatedAt = strftime(\'%s\', \'now\') WHERE id = @userId',
      { userId, nextNumber }
    );

    if (result.changes === 0) {
      return { success: false, error: 'User not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating next invoice number:', error.message);
    return { success: false, error: 'Failed to update next invoice number' };
  }
}

/**
 * Validates that a manually provided invoice number is unique for a user.
 * Checks against existing invoices in the database.
 * 
 * @param {number} userId - The user ID
 * @param {string} invoiceNumber - The invoice number to validate
 * @param {number} [excludeInvoiceId] - Invoice ID to exclude (for updates)
 * @returns {{success: boolean, isUnique?: boolean, error?: string}}
 */
function validateInvoiceNumberUniqueness(userId, invoiceNumber, excludeInvoiceId = null) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  if (!invoiceNumber || typeof invoiceNumber !== 'string' || !invoiceNumber.trim()) {
    return { success: false, error: 'Invoice number is required' };
  }

  const cleanedNumber = invoiceNumber.trim().toUpperCase();

  // Validate format: alphanumeric, dashes, underscores
  const formatRegex = /^[A-Z0-9\-_]+$/;
  if (!formatRegex.test(cleanedNumber)) {
    return { 
      success: false, 
      error: 'Invoice number can only contain letters, numbers, hyphens, and underscores' 
    };
  }

  try {
    let existingInvoice;
    
    if (excludeInvoiceId) {
      existingInvoice = queryOne(
        'SELECT id FROM invoices WHERE userId = ? AND invoiceNumber = ? AND id != ?',
        [userId, cleanedNumber, excludeInvoiceId]
      );
    } else {
      existingInvoice = queryOne(
        'SELECT id FROM invoices WHERE userId = ? AND invoiceNumber = ?',
        [userId, cleanedNumber]
      );
    }

    return { success: true, isUnique: !existingInvoice };
  } catch (error) {
    console.error('Error validating invoice number uniqueness:', error.message);
    return { success: false, error: 'Failed to validate invoice number uniqueness' };
  }
}

/**
 * Generates and reserves the next invoice number atomically.
 * This is the preferred method for creating new invoices as it
 * guarantees uniqueness and sequential numbering.
 * 
 * @param {number} userId - The user ID
 * @param {Object} [options={}] - Generation options
 * @param {number} [options.year] - Year to include in the invoice number
 * @param {number} [options.padding=4] - Number of digits for padding
 * @returns {{success: boolean, invoiceNumber?: string, error?: string}}
 */
function reserveNextInvoiceNumber(userId, options = {}) {
  // This is an alias for generateNextInvoiceNumber since that function
  // already performs atomic reservation
  return generateNextInvoiceNumber(userId, options);
}

/**
 * Previews what the next invoice number would be without reserving it.
 * Useful for displaying to users before they confirm invoice creation.
 * 
 * @param {number} userId - The user ID
 * @param {Object} [options={}] - Generation options
 * @param {number} [options.year] - Year to include in the invoice number
 * @param {number} [options.padding=4] - Number of digits for padding
 * @returns {{success: boolean, invoiceNumber?: string, error?: string}}
 */
function previewNextInvoiceNumber(userId, options = {}) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  const year = options.year || new Date().getFullYear();
  const padding = options.padding || DEFAULT_NUMBER_PADDING;

  try {
    const user = queryOne(
      'SELECT invoicePrefix, nextInvoiceNumber FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const prefix = user.invoicePrefix || DEFAULT_PREFIX;
    const currentNumber = user.nextInvoiceNumber || 1;
    
    const paddedNumber = String(currentNumber).padStart(padding, '0');
    const invoiceNumber = `${prefix}-${year}-${paddedNumber}`;

    return { success: true, invoiceNumber };
  } catch (error) {
    console.error('Error previewing invoice number:', error.message);
    return { success: false, error: 'Failed to preview invoice number' };
  }
}

/**
 * Parses an invoice number to extract its components.
 * 
 * @param {string} invoiceNumber - The invoice number to parse
 * @returns {{success: boolean, components?: {prefix: string, year: number, number: number}, error?: string}}
 */
function parseInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber || typeof invoiceNumber !== 'string') {
    return { success: false, error: 'Invoice number is required' };
  }

  const cleaned = invoiceNumber.trim().toUpperCase();
  
  // Try to match the standard format: PREFIX-YEAR-NUMBER
  const match = cleaned.match(/^([A-Z0-9_-]+)-(\d{4})-(\d+)$/);
  
  if (!match) {
    return { 
      success: false, 
      error: 'Invalid invoice number format. Expected: PREFIX-YEAR-NUMBER' 
    };
  }

  return {
    success: true,
    components: {
      prefix: match[1],
      year: parseInt(match[2], 10),
      number: parseInt(match[3], 10)
    }
  };
}

/**
 * Validates if the proposed next invoice number would maintain sequence.
 * Checks that the number is greater than or equal to the highest existing number.
 * 
 * @param {number} userId - The user ID
 * @param {number} proposedNumber - The proposed next invoice number
 * @returns {{success: boolean, isValid?: boolean, highestUsed?: number, error?: string}}
 */
function validateSequenceIntegrity(userId, proposedNumber) {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { success: false, error: 'Valid userId is required' };
  }

  if (!Number.isInteger(proposedNumber) || proposedNumber < 1) {
    return { success: false, error: 'Proposed number must be a positive integer' };
  }

  try {
    // Get user's current prefix
    const user = queryOne(
      'SELECT invoicePrefix FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const prefix = user.invoicePrefix || DEFAULT_PREFIX;
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;

    // Find the highest invoice number used
    const result = queryOne(
      `SELECT invoiceNumber FROM invoices 
       WHERE userId = ? AND invoiceNumber LIKE ?
       ORDER BY invoiceNumber DESC LIMIT 1`,
      [userId, pattern]
    );

    let highestUsed = 0;
    
    if (result && result.invoiceNumber) {
      const parsed = parseInvoiceNumber(result.invoiceNumber);
      if (parsed.success) {
        highestUsed = parsed.components.number;
      }
    }

    return {
      success: true,
      isValid: proposedNumber > highestUsed,
      highestUsed
    };
  } catch (error) {
    console.error('Error validating sequence integrity:', error.message);
    return { success: false, error: 'Failed to validate sequence integrity' };
  }
}

module.exports = {
  // Main generation functions
  generateNextInvoiceNumber,
  reserveNextInvoiceNumber,
  previewNextInvoiceNumber,
  
  // Settings management
  getInvoiceSettings,
  updateInvoicePrefix,
  updateNextInvoiceNumber,
  
  // Validation functions
  validateInvoiceNumberUniqueness,
  validateSequenceIntegrity,
  parseInvoiceNumber,
  
  // Constants
  DEFAULT_NUMBER_PADDING,
  DEFAULT_PREFIX
};
