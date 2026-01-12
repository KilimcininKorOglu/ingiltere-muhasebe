/**
 * Reconciliation Controller
 * Handles HTTP requests for reconciliation operations.
 * Provides endpoints for matching, unmatching, and suggesting reconciliations.
 * 
 * @module controllers/reconciliationController
 */

const Reconciliation = require('../database/models/Reconciliation');
const BankTransaction = require('../database/models/BankTransaction');
const Transaction = require('../database/models/Transaction');
const BankAccount = require('../database/models/BankAccount');
const ReconciliationMatcher = require('../services/reconciliationMatcher');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Gets suggested matches for a bank transaction.
 * GET /api/bank-transactions/:id/matches
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Bank transaction ID
 * @param {Object} req.query.limit - Max number of suggestions
 * @param {Object} req.query.minConfidence - Minimum confidence threshold
 * @param {Object} res - Express response object
 */
async function getSuggestedMatches(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    const { limit = 5, minConfidence = 50 } = req.query;

    const bankTransactionId = parseInt(id, 10);
    if (isNaN(bankTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank transaction ID',
            tr: 'Geçersiz banka işlemi ID'
          }
        }
      });
    }

    // Verify ownership
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_BANK_TRANSACTION_NOT_FOUND',
          message: {
            en: 'Bank transaction not found',
            tr: 'Banka işlemi bulunamadı'
          }
        }
      });
    }

    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = ReconciliationMatcher.findPotentialMatches(bankTransactionId, {
      limit: parseInt(limit, 10),
      minConfidence: parseInt(minConfidence, 10)
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'RECONCILIATION_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get suggested matches error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Creates a reconciliation match between a bank transaction and an app transaction.
 * POST /api/bank-transactions/:id/reconcile
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Bank transaction ID
 * @param {Object} req.body.transactionId - App transaction ID to match
 * @param {Object} req.body.matchType - Type of match (optional)
 * @param {Object} req.body.notes - Notes (optional)
 * @param {Object} res - Express response object
 */
async function reconcileTransaction(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    const { transactionId, matchType, notes } = req.body;

    const bankTransactionId = parseInt(id, 10);
    if (isNaN(bankTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank transaction ID',
            tr: 'Geçersiz banka işlemi ID'
          }
        }
      });
    }

    if (!transactionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Transaction ID is required',
            tr: 'İşlem ID gereklidir'
          }
        }
      });
    }

    const appTransactionId = parseInt(transactionId, 10);
    if (isNaN(appTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid transaction ID',
            tr: 'Geçersiz işlem ID'
          }
        }
      });
    }

    // Validate the match first
    const validation = ReconciliationMatcher.validateMatch(bankTransactionId, appTransactionId);
    
    // If there are critical errors (not just amount mismatch warning)
    if (!validation.valid) {
      const criticalErrors = validation.errors.filter(e => !e.startsWith('Amount mismatch'));
      if (criticalErrors.length > 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'RECONCILIATION_VALIDATION_ERROR',
            message: {
              en: criticalErrors.join('; '),
              tr: criticalErrors.join('; ')
            },
            details: validation.errors
          }
        });
      }
    }

    // Create the match
    const result = ReconciliationMatcher.createMatch(
      bankTransactionId,
      appTransactionId,
      userId,
      { matchType, notes }
    );

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'RECONCILIATION_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Reconcile transaction error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Removes a reconciliation match (unreconciles transactions).
 * DELETE /api/bank-transactions/:id/reconcile
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Bank transaction ID
 * @param {Object} res - Express response object
 */
async function unreconcileTransaction(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const bankTransactionId = parseInt(id, 10);
    if (isNaN(bankTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank transaction ID',
            tr: 'Geçersiz banka işlemi ID'
          }
        }
      });
    }

    // Verify ownership
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_BANK_TRANSACTION_NOT_FOUND',
          message: {
            en: 'Bank transaction not found',
            tr: 'Banka işlemi bulunamadı'
          }
        }
      });
    }

    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Unreconcile
    const result = ReconciliationMatcher.unreconcileBankTransaction(bankTransactionId, userId);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'UNRECONCILE_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Unreconcile transaction error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets reconciliation details for a bank transaction.
 * GET /api/bank-transactions/:id/reconciliations
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Bank transaction ID
 * @param {Object} res - Express response object
 */
async function getReconciliations(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const bankTransactionId = parseInt(id, 10);
    if (isNaN(bankTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank transaction ID',
            tr: 'Geçersiz banka işlemi ID'
          }
        }
      });
    }

    // Verify ownership
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_BANK_TRANSACTION_NOT_FOUND',
          message: {
            en: 'Bank transaction not found',
            tr: 'Banka işlemi bulunamadı'
          }
        }
      });
    }

    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Get reconciliations with details
    const reconciliations = Reconciliation.getReconciliationsWithDetails(bankTransactionId);
    const totalMatchedAmount = Reconciliation.getTotalMatchedAmount(bankTransactionId);
    const remainingAmount = Reconciliation.getRemainingAmount(bankTransactionId, bankTransaction.amount);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankTransaction: BankTransaction.sanitizeBankTransaction(bankTransaction),
        reconciliations,
        summary: {
          totalMatchedAmount,
          remainingAmount,
          isFullyReconciled: remainingAmount === 0
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get reconciliations error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Auto-reconciles transactions for a bank account.
 * POST /api/bank-accounts/:bankAccountId/auto-reconcile
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.bankAccountId - Bank account ID
 * @param {Object} req.body.minConfidence - Minimum confidence for auto-match
 * @param {Object} req.body.dryRun - If true, returns suggestions without creating matches
 * @param {Object} res - Express response object
 */
async function autoReconcile(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { bankAccountId } = req.params;
    const { minConfidence = 90, dryRun = false } = req.body;

    const accountId = parseInt(bankAccountId, 10);
    if (isNaN(accountId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank account ID',
            tr: 'Geçersiz banka hesabı ID'
          }
        }
      });
    }

    // Verify ownership
    const bankAccount = BankAccount.findById(accountId);
    if (!bankAccount) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_BANK_ACCOUNT_NOT_FOUND',
          message: {
            en: 'Bank account not found',
            tr: 'Banka hesabı bulunamadı'
          }
        }
      });
    }

    if (bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = ReconciliationMatcher.autoReconcile(accountId, userId, {
      minConfidence: parseInt(minConfidence, 10),
      dryRun: Boolean(dryRun)
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'AUTO_RECONCILE_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        dryRun
      }
    });

  } catch (error) {
    console.error('Auto-reconcile error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets reconciliation summary for a bank account.
 * GET /api/bank-accounts/:bankAccountId/reconciliation-summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.bankAccountId - Bank account ID
 * @param {Object} res - Express response object
 */
async function getReconciliationSummary(req, res) {
  try {
    const { lang = 'en', startDate, endDate } = req.query;
    const userId = req.user.id;
    const { bankAccountId } = req.params;

    const accountId = parseInt(bankAccountId, 10);
    if (isNaN(accountId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank account ID',
            tr: 'Geçersiz banka hesabı ID'
          }
        }
      });
    }

    // Verify ownership
    const bankAccount = BankAccount.findById(accountId);
    if (!bankAccount) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_BANK_ACCOUNT_NOT_FOUND',
          message: {
            en: 'Bank account not found',
            tr: 'Banka hesabı bulunamadı'
          }
        }
      });
    }

    if (bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Get bank transaction summary
    const bankTxnSummary = BankTransaction.getSummary(accountId, startDate, endDate);
    const reconciliationStatusCounts = BankTransaction.getReconciliationStatusCounts(accountId);
    
    // Get reconciliation summary
    const reconciliationSummary = Reconciliation.getSummary({
      bankAccountId: accountId,
      startDate,
      endDate
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount),
        bankTransactionSummary: bankTxnSummary,
        reconciliationStatusCounts,
        reconciliationSummary
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      }
    });

  } catch (error) {
    console.error('Get reconciliation summary error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Validates a potential match before creating it.
 * POST /api/bank-transactions/:id/validate-match
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Bank transaction ID
 * @param {Object} req.body.transactionId - App transaction ID to validate
 * @param {Object} res - Express response object
 */
async function validateMatch(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    const { transactionId } = req.body;

    const bankTransactionId = parseInt(id, 10);
    if (isNaN(bankTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid bank transaction ID',
            tr: 'Geçersiz banka işlemi ID'
          }
        }
      });
    }

    if (!transactionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Transaction ID is required',
            tr: 'İşlem ID gereklidir'
          }
        }
      });
    }

    const appTransactionId = parseInt(transactionId, 10);
    if (isNaN(appTransactionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid transaction ID',
            tr: 'Geçersiz işlem ID'
          }
        }
      });
    }

    // Verify ownership of bank transaction
    const bankTransaction = BankTransaction.findById(bankTransactionId);
    if (!bankTransaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_BANK_TRANSACTION_NOT_FOUND',
          message: {
            en: 'Bank transaction not found',
            tr: 'Banka işlemi bulunamadı'
          }
        }
      });
    }

    const bankAccount = BankAccount.findById(bankTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Validate the match
    const validation = ReconciliationMatcher.validateMatch(bankTransactionId, appTransactionId);
    
    // Calculate match score
    const appTransaction = Transaction.findById(appTransactionId);
    let matchScore = null;
    if (appTransaction) {
      const { score, details } = ReconciliationMatcher.calculateMatchScore(bankTransaction, appTransaction);
      matchScore = { score, details };
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.errors.filter(e => e.startsWith('Amount mismatch')),
        bankTransaction: validation.bankTransaction,
        appTransaction: validation.appTransaction,
        matchScore
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Validate match error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

module.exports = {
  getSuggestedMatches,
  reconcileTransaction,
  unreconcileTransaction,
  getReconciliations,
  autoReconcile,
  getReconciliationSummary,
  validateMatch
};
