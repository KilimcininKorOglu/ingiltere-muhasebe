/**
 * Audit Logger Middleware
 * Provides middleware functions for logging transaction changes to the audit trail.
 * Extracts metadata like IP address and user agent for compliance purposes.
 * 
 * @module middleware/auditLogger
 */

const TransactionAuditLog = require('../database/models/TransactionAuditLog');

/**
 * Extracts client IP address from the request.
 * Handles various proxy configurations.
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Client IP address or null
 */
function getClientIp(req) {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Get first IP in the list (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  // Check for real IP header (nginx)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  // Fall back to socket remote address
  return req.socket?.remoteAddress || req.connection?.remoteAddress || null;
}

/**
 * Extracts user agent from the request.
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} User agent string or null
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}

/**
 * Gets metadata from request for audit logging.
 * 
 * @param {Object} req - Express request object
 * @returns {{ipAddress: string|null, userAgent: string|null}}
 */
function getAuditMetadata(req) {
  return {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req)
  };
}

/**
 * Logs a transaction creation to the audit trail.
 * 
 * @param {Object} req - Express request object (must have req.user)
 * @param {number} transactionId - ID of the created transaction
 * @param {Object} transactionData - The transaction data that was created
 * @returns {{success: boolean, data?: Object, errors?: Object}}
 */
function logTransactionCreate(req, transactionId, transactionData) {
  const userId = req.user?.id;
  if (!userId) {
    console.error('Audit log error: No user ID available');
    return { success: false, errors: { general: 'No user ID available' } };
  }

  const metadata = getAuditMetadata(req);
  return TransactionAuditLog.logCreate(transactionId, userId, transactionData, metadata);
}

/**
 * Logs a transaction update to the audit trail.
 * 
 * @param {Object} req - Express request object (must have req.user)
 * @param {number} transactionId - ID of the updated transaction
 * @param {Object} previousData - Transaction data before the update
 * @param {Object} newData - Transaction data after the update
 * @returns {{success: boolean, data?: Object, errors?: Object}}
 */
function logTransactionUpdate(req, transactionId, previousData, newData) {
  const userId = req.user?.id;
  if (!userId) {
    console.error('Audit log error: No user ID available');
    return { success: false, errors: { general: 'No user ID available' } };
  }

  const metadata = getAuditMetadata(req);
  return TransactionAuditLog.logUpdate(transactionId, userId, previousData, newData, metadata);
}

/**
 * Logs a transaction deletion to the audit trail.
 * 
 * @param {Object} req - Express request object (must have req.user)
 * @param {number} transactionId - ID of the deleted transaction
 * @param {Object} transactionData - Transaction data that was deleted
 * @returns {{success: boolean, data?: Object, errors?: Object}}
 */
function logTransactionDelete(req, transactionId, transactionData) {
  const userId = req.user?.id;
  if (!userId) {
    console.error('Audit log error: No user ID available');
    return { success: false, errors: { general: 'No user ID available' } };
  }

  const metadata = getAuditMetadata(req);
  return TransactionAuditLog.logDelete(transactionId, userId, transactionData, metadata);
}

/**
 * Middleware factory that attaches audit logger functions to the request.
 * This allows controllers to easily access audit logging functions.
 * 
 * @returns {Function} Express middleware function
 */
function attachAuditLogger() {
  return (req, res, next) => {
    // Attach audit logging functions to request
    req.auditLogger = {
      logCreate: (transactionId, transactionData) => 
        logTransactionCreate(req, transactionId, transactionData),
      logUpdate: (transactionId, previousData, newData) => 
        logTransactionUpdate(req, transactionId, previousData, newData),
      logDelete: (transactionId, transactionData) => 
        logTransactionDelete(req, transactionId, transactionData),
      getMetadata: () => getAuditMetadata(req)
    };

    next();
  };
}

module.exports = {
  // Direct logging functions
  logTransactionCreate,
  logTransactionUpdate,
  logTransactionDelete,
  
  // Middleware
  attachAuditLogger,
  
  // Utility functions
  getClientIp,
  getUserAgent,
  getAuditMetadata
};
