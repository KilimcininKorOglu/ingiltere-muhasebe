/**
 * Bank Transaction Controller
 * Handles CRUD operations for bank transactions.
 * Provides endpoints for recording and managing bank transactions with running balance calculations.
 * 
 * @module controllers/bankTransactionController
 */

const BankTransaction = require('../database/models/BankTransaction');
const BankAccount = require('../database/models/BankAccount');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Creates a new bank transaction.
 * Also updates the bank account balance.
 * POST /api/bank-transactions
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Transaction data
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function createBankTransaction(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const {
      bankAccountId,
      transactionDate,
      postingDate,
      description,
      reference,
      transactionType,
      amount,
      runningBalance,
      importSource,
      importBatchId,
      rawData,
      fitId,
      reconciliationStatus,
      reconciliationNotes
    } = req.body;

    // Verify bank account exists and belongs to user
    const bankAccount = BankAccount.findById(bankAccountId);
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

    // Create the transaction
    const result = BankTransaction.createBankTransaction({
      bankAccountId,
      transactionDate,
      postingDate,
      description,
      reference,
      transactionType,
      amount,
      runningBalance,
      importSource: importSource || 'manual',
      importBatchId,
      rawData,
      fitId,
      reconciliationStatus,
      reconciliationNotes
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create bank transaction due to validation errors',
            tr: 'Doğrulama hataları nedeniyle banka işlemi oluşturulamadı'
          },
          details: Object.entries(result.errors).map(([field, message]) => ({
            field,
            message
          }))
        }
      });
    }

    // Update the bank account balance
    // For credit transactions, add to balance; for debit, subtract
    const balanceAdjustment = transactionType === 'credit' ? amount : -amount;
    BankAccount.adjustBalance(bankAccountId, balanceAdjustment);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        transaction: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Create bank transaction error:', error);

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
 * Gets all bank transactions for a bank account with pagination and filtering.
 * GET /api/bank-accounts/:bankAccountId/transactions
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.bankAccountId - Bank account ID
 * @param {Object} req.query - Query parameters (page, limit, startDate, endDate, transactionType, reconciliationStatus)
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getBankTransactions(req, res) {
  try {
    const { lang = 'en' } = req.query;
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

    // Verify bank account exists and belongs to user
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

    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      transactionType,
      reconciliationStatus,
      sortBy = 'transactionDate',
      sortOrder = 'DESC'
    } = req.query;

    const result = BankTransaction.getBankTransactionsByAccountId(accountId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
      startDate,
      endDate,
      transactionType,
      reconciliationStatus,
      sortBy,
      sortOrder
    });

    // Get summary statistics
    const summary = BankTransaction.getSummary(accountId, startDate, endDate);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        },
        summary
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get bank transactions error:', error);

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
 * Gets a single bank transaction by ID.
 * GET /api/bank-transactions/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Transaction ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getBankTransactionById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const transactionId = parseInt(id, 10);
    if (isNaN(transactionId)) {
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

    const transaction = BankTransaction.findById(transactionId);

    if (!transaction) {
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

    // Verify ownership through bank account
    const bankAccount = BankAccount.findById(transaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transaction: BankTransaction.sanitizeBankTransaction(transaction)
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get bank transaction by ID error:', error);

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
 * Updates a bank transaction.
 * Cannot update reconciled transactions.
 * PUT /api/bank-transactions/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Transaction ID
 * @param {Object} req.body - Transaction data to update
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function updateBankTransaction(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const transactionId = parseInt(id, 10);
    if (isNaN(transactionId)) {
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

    // Check if transaction exists
    const existingTransaction = BankTransaction.findById(transactionId);
    if (!existingTransaction) {
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

    // Verify ownership through bank account
    const bankAccount = BankAccount.findById(existingTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Check if transaction is reconciled - cannot modify reconciled transactions
    if (existingTransaction.isReconciled) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_TRANSACTION_RECONCILED',
          message: {
            en: 'Cannot modify a reconciled transaction',
            tr: 'Mutabık edilmiş işlem değiştirilemez'
          }
        }
      });
    }

    const {
      transactionDate,
      postingDate,
      description,
      reference,
      transactionType,
      amount,
      runningBalance,
      reconciliationStatus,
      reconciliationNotes
    } = req.body;

    // Calculate balance adjustment if amount or type changed
    const oldAmount = existingTransaction.amount;
    const oldType = existingTransaction.transactionType;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const newType = transactionType !== undefined ? transactionType : oldType;

    // Build update data
    const updateData = {};
    if (transactionDate !== undefined) updateData.transactionDate = transactionDate;
    if (postingDate !== undefined) updateData.postingDate = postingDate;
    if (description !== undefined) updateData.description = description;
    if (reference !== undefined) updateData.reference = reference;
    if (transactionType !== undefined) updateData.transactionType = transactionType;
    if (amount !== undefined) updateData.amount = amount;
    if (runningBalance !== undefined) updateData.runningBalance = runningBalance;
    if (reconciliationStatus !== undefined) updateData.reconciliationStatus = reconciliationStatus;
    if (reconciliationNotes !== undefined) updateData.reconciliationNotes = reconciliationNotes;

    const result = BankTransaction.updateBankTransaction(transactionId, updateData);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to update bank transaction due to validation errors',
            tr: 'Doğrulama hataları nedeniyle banka işlemi güncellenemedi'
          },
          details: Object.entries(result.errors).map(([field, message]) => ({
            field,
            message
          }))
        }
      });
    }

    // Update bank account balance if amount or type changed
    if (amount !== undefined || transactionType !== undefined) {
      // Reverse old adjustment
      const oldAdjustment = oldType === 'credit' ? -oldAmount : oldAmount;
      // Apply new adjustment
      const newAdjustment = newType === 'credit' ? newAmount : -newAmount;
      const netAdjustment = oldAdjustment + newAdjustment;
      
      if (netAdjustment !== 0) {
        BankAccount.adjustBalance(existingTransaction.bankAccountId, netAdjustment);
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transaction: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update bank transaction error:', error);

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
 * Deletes a bank transaction.
 * Cannot delete reconciled transactions.
 * DELETE /api/bank-transactions/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Transaction ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function deleteBankTransaction(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const transactionId = parseInt(id, 10);
    if (isNaN(transactionId)) {
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

    // Check if transaction exists
    const existingTransaction = BankTransaction.findById(transactionId);
    if (!existingTransaction) {
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

    // Verify ownership through bank account
    const bankAccount = BankAccount.findById(existingTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Check if transaction is reconciled - cannot delete reconciled transactions
    if (existingTransaction.isReconciled) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_TRANSACTION_RECONCILED',
          message: {
            en: 'Cannot delete a reconciled transaction',
            tr: 'Mutabık edilmiş işlem silinemez'
          }
        }
      });
    }

    const result = BankTransaction.deleteBankTransaction(transactionId);

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: {
            en: result.error || 'Failed to delete bank transaction',
            tr: 'Banka işlemi silinemedi'
          }
        }
      });
    }

    // Reverse the balance adjustment
    const balanceAdjustment = existingTransaction.transactionType === 'credit' 
      ? -existingTransaction.amount 
      : existingTransaction.amount;
    BankAccount.adjustBalance(existingTransaction.bankAccountId, balanceAdjustment);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        message: {
          en: 'Bank transaction deleted successfully',
          tr: 'Banka işlemi başarıyla silindi'
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete bank transaction error:', error);

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
 * Updates reconciliation status of a transaction.
 * PATCH /api/bank-transactions/:id/reconciliation
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Transaction ID
 * @param {Object} req.body.status - New reconciliation status
 * @param {Object} req.body.notes - Optional reconciliation notes
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function updateReconciliationStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const transactionId = parseInt(id, 10);
    if (isNaN(transactionId)) {
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

    // Validate status
    if (!status || !BankTransaction.RECONCILIATION_STATUSES.includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: `Invalid status. Must be one of: ${BankTransaction.RECONCILIATION_STATUSES.join(', ')}`,
            tr: `Geçersiz durum. Şunlardan biri olmalıdır: ${BankTransaction.RECONCILIATION_STATUSES.join(', ')}`
          }
        }
      });
    }

    // Check if transaction exists
    const existingTransaction = BankTransaction.findById(transactionId);
    if (!existingTransaction) {
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

    // Verify ownership through bank account
    const bankAccount = BankAccount.findById(existingTransaction.bankAccountId);
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = BankTransaction.updateReconciliationStatus(transactionId, status, notes);

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: {
            en: result.error || 'Failed to update reconciliation status',
            tr: 'Mutabakat durumu güncellenemedi'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transaction: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update reconciliation status error:', error);

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
 * Gets transaction summary for a bank account.
 * GET /api/bank-accounts/:bankAccountId/transactions/summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.bankAccountId - Bank account ID
 * @param {Object} req.query.startDate - Start date for summary
 * @param {Object} req.query.endDate - End date for summary
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getTransactionSummary(req, res) {
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

    // Verify bank account exists and belongs to user
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

    const summary = BankTransaction.getSummary(accountId, startDate, endDate);
    const reconciliationCounts = BankTransaction.getReconciliationStatusCounts(accountId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        summary,
        reconciliationCounts,
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount)
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get transaction summary error:', error);

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
 * Searches bank transactions by description or reference.
 * GET /api/bank-accounts/:bankAccountId/transactions/search
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.bankAccountId - Bank account ID
 * @param {Object} req.query.q - Search term
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function searchBankTransactions(req, res) {
  try {
    const { lang = 'en', q } = req.query;
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

    // Verify bank account exists and belongs to user
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

    if (!q || !q.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Search term is required',
            tr: 'Arama terimi gereklidir'
          }
        }
      });
    }

    const transactions = BankTransaction.searchBankTransactions(accountId, q.trim());

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        transactions,
        count: transactions.length
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        searchTerm: q.trim()
      }
    });

  } catch (error) {
    console.error('Search bank transactions error:', error);

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
  createBankTransaction,
  getBankTransactions,
  getBankTransactionById,
  updateBankTransaction,
  deleteBankTransaction,
  updateReconciliationStatus,
  getTransactionSummary,
  searchBankTransactions
};
