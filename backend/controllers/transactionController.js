/**
 * Transaction Controller
 * Handles HTTP requests for transaction operations.
 * Supports income, expense, and transfer transactions with VAT calculation.
 * Includes audit trail logging for all transaction changes.
 * 
 * @module controllers/transactionController
 */

const Transaction = require('../database/models/Transaction');
const TransactionAuditLog = require('../database/models/TransactionAuditLog');
const Category = require('../database/models/Category');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');
const { 
  calculateTransactionAmounts, 
  getVatRateBasisPoints,
  VAT_RATES_BASIS_POINTS
} = require('../utils/vatCalculator');
const { 
  logTransactionCreate, 
  logTransactionUpdate, 
  logTransactionDelete 
} = require('../middleware/auditLogger');

/**
 * Maps transaction type to compatible category types.
 * Income transactions can only use income categories.
 * Expense transactions can only use expense categories.
 * Transfer transactions don't require specific category types.
 */
const TRANSACTION_CATEGORY_TYPE_MAP = {
  'income': ['income'],
  'expense': ['expense'],
  'transfer': ['asset', 'liability', 'equity', 'income', 'expense'] // Transfer can use any category
};

/**
 * Creates a new transaction.
 * POST /api/transactions
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body with transaction data
 * @param {Object} res - Express response object
 */
async function create(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const {
      categoryId,
      type,
      status,
      transactionDate,
      description,
      reference,
      amount,
      vatRate,
      vatAmount: providedVatAmount,
      totalAmount: providedTotalAmount,
      currency,
      paymentMethod,
      payee,
      receiptPath,
      notes,
      isRecurring,
      recurringFrequency,
      linkedTransactionId,
      bankAccountId
    } = req.body;

    // Validate category if provided
    if (categoryId) {
      const category = Category.findById(categoryId);
      
      if (!category) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Category not found',
              tr: 'Kategori bulunamadı'
            },
            details: [{
              field: 'categoryId',
              message: 'Category not found',
              messageTr: 'Kategori bulunamadı'
            }]
          }
        });
      }

      // Validate category type matches transaction type
      const allowedCategoryTypes = TRANSACTION_CATEGORY_TYPE_MAP[type] || [];
      if (!allowedCategoryTypes.includes(category.type)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: `Category type '${category.type}' is not compatible with transaction type '${type}'`,
              tr: `'${category.type}' kategori tipi '${type}' işlem tipi ile uyumlu değil`
            },
            details: [{
              field: 'categoryId',
              message: `Category type '${category.type}' is not compatible with transaction type '${type}'. Allowed types: ${allowedCategoryTypes.join(', ')}`,
              messageTr: `'${category.type}' kategori tipi '${type}' işlem tipi ile uyumlu değil. İzin verilen tipler: ${allowedCategoryTypes.join(', ')}`
            }]
          }
        });
      }
    }

    // Calculate VAT amounts
    let calculatedAmount = amount || 0;
    let calculatedVatRate = vatRate !== undefined ? vatRate : 0;
    let calculatedVatAmount = providedVatAmount;
    let calculatedTotalAmount = providedTotalAmount;

    // If category has a default VAT rate and no VAT rate provided, use category's rate
    if (categoryId && vatRate === undefined) {
      const category = Category.findById(categoryId);
      if (category && category.vatApplicable && category.defaultVatRate) {
        calculatedVatRate = category.defaultVatRate;
      }
    }

    // Calculate VAT and total if not explicitly provided
    if (calculatedVatAmount === undefined || calculatedTotalAmount === undefined) {
      const amounts = calculateTransactionAmounts(calculatedAmount, calculatedVatRate);
      calculatedVatAmount = amounts.vatAmount;
      calculatedTotalAmount = amounts.totalAmount;
    }

    // Prepare transaction data
    const transactionData = {
      userId,
      categoryId: categoryId || null,
      type,
      status: status || 'pending',
      transactionDate,
      description,
      reference: reference || null,
      amount: calculatedAmount,
      vatRate: calculatedVatRate,
      vatAmount: calculatedVatAmount,
      totalAmount: calculatedTotalAmount,
      currency: currency || 'GBP',
      paymentMethod: paymentMethod || null,
      payee: payee || null,
      receiptPath: receiptPath || null,
      notes: notes || null,
      isRecurring: isRecurring || false,
      recurringFrequency: recurringFrequency || null,
      linkedTransactionId: linkedTransactionId || null,
      bankAccountId: bankAccountId || null
    };

    // Create the transaction
    const result = Transaction.createTransaction(transactionData);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create transaction',
            tr: 'İşlem oluşturulamadı'
          },
          details: Object.entries(result.errors || {}).map(([field, message]) => ({
            field,
            message,
            messageTr: message
          }))
        }
      });
    }

    // Log audit trail for transaction creation
    logTransactionCreate(req, result.data.id, result.data);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Create transaction error:', error);

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
 * Gets all transactions for the authenticated user.
 * GET /api/transactions
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function list(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const {
      page = 1,
      limit = 20,
      type,
      status,
      categoryId,
      startDate,
      endDate,
      sortBy = 'transactionDate',
      sortOrder = 'DESC'
    } = req.query;

    const result = Transaction.getTransactionsByUserId(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      type,
      status,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      startDate,
      endDate,
      sortBy,
      sortOrder
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('List transactions error:', error);

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
 * Gets a transaction by ID.
 * GET /api/transactions/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const transaction = Transaction.findById(parseInt(id, 10));

    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Transaction not found',
            tr: 'İşlem bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (transaction.userId !== userId) {
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
      data: Transaction.sanitizeTransaction(transaction),
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get transaction by ID error:', error);

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
 * Updates a transaction.
 * PUT /api/transactions/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function update(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const transaction = Transaction.findById(parseInt(id, 10));

    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Transaction not found',
            tr: 'İşlem bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (transaction.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const {
      categoryId,
      type,
      status,
      transactionDate,
      description,
      reference,
      amount,
      vatRate,
      vatAmount,
      totalAmount,
      currency,
      paymentMethod,
      payee,
      receiptPath,
      notes,
      isRecurring,
      recurringFrequency,
      linkedTransactionId,
      bankAccountId
    } = req.body;

    // Validate category type if both categoryId and type are being updated
    const effectiveType = type || transaction.type;
    const effectiveCategoryId = categoryId !== undefined ? categoryId : transaction.categoryId;
    
    if (effectiveCategoryId) {
      const category = Category.findById(effectiveCategoryId);
      
      if (!category) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Category not found',
              tr: 'Kategori bulunamadı'
            },
            details: [{
              field: 'categoryId',
              message: 'Category not found',
              messageTr: 'Kategori bulunamadı'
            }]
          }
        });
      }

      const allowedCategoryTypes = TRANSACTION_CATEGORY_TYPE_MAP[effectiveType] || [];
      if (!allowedCategoryTypes.includes(category.type)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: `Category type '${category.type}' is not compatible with transaction type '${effectiveType}'`,
              tr: `'${category.type}' kategori tipi '${effectiveType}' işlem tipi ile uyumlu değil`
            },
            details: [{
              field: 'categoryId',
              message: `Category type '${category.type}' is not compatible with transaction type '${effectiveType}'`,
              messageTr: `'${category.type}' kategori tipi '${effectiveType}' işlem tipi ile uyumlu değil`
            }]
          }
        });
      }
    }

    // Build update data
    const updateData = {};
    
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (transactionDate !== undefined) updateData.transactionDate = transactionDate;
    if (description !== undefined) updateData.description = description;
    if (reference !== undefined) updateData.reference = reference;
    if (amount !== undefined) updateData.amount = amount;
    if (vatRate !== undefined) updateData.vatRate = vatRate;
    if (vatAmount !== undefined) updateData.vatAmount = vatAmount;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (currency !== undefined) updateData.currency = currency;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (payee !== undefined) updateData.payee = payee;
    if (receiptPath !== undefined) updateData.receiptPath = receiptPath;
    if (notes !== undefined) updateData.notes = notes;
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency;
    if (linkedTransactionId !== undefined) updateData.linkedTransactionId = linkedTransactionId;
    if (bankAccountId !== undefined) updateData.bankAccountId = bankAccountId;

    // Recalculate VAT if amount or vatRate changed but vatAmount/totalAmount weren't provided
    if ((amount !== undefined || vatRate !== undefined) && 
        vatAmount === undefined && totalAmount === undefined) {
      const effectiveAmount = amount !== undefined ? amount : transaction.amount;
      const effectiveVatRate = vatRate !== undefined ? vatRate : transaction.vatRate;
      const amounts = calculateTransactionAmounts(effectiveAmount, effectiveVatRate);
      updateData.vatAmount = amounts.vatAmount;
      updateData.totalAmount = amounts.totalAmount;
    }

    const result = Transaction.updateTransaction(parseInt(id, 10), updateData);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to update transaction',
            tr: 'İşlem güncellenemedi'
          },
          details: Object.entries(result.errors || {}).map(([field, message]) => ({
            field,
            message,
            messageTr: message
          }))
        }
      });
    }

    // Log audit trail for transaction update with previous values
    logTransactionUpdate(req, parseInt(id, 10), Transaction.sanitizeTransaction(transaction), result.data);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update transaction error:', error);

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
 * Deletes a transaction.
 * DELETE /api/transactions/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function remove(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const transaction = Transaction.findById(parseInt(id, 10));

    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Transaction not found',
            tr: 'İşlem bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (transaction.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Store transaction data before deletion for audit log
    const transactionDataBeforeDelete = Transaction.sanitizeTransaction(transaction);

    const result = Transaction.deleteTransaction(parseInt(id, 10));

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: {
            en: result.error || 'Failed to delete transaction',
            tr: result.error || 'İşlem silinemedi'
          }
        }
      });
    }

    // Log audit trail for transaction deletion
    logTransactionDelete(req, parseInt(id, 10), transactionDataBeforeDelete);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: {
        en: 'Transaction deleted successfully',
        tr: 'İşlem başarıyla silindi'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete transaction error:', error);

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
 * Gets transaction summary for date range.
 * GET /api/transactions/summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Start date and end date are required',
            tr: 'Başlangıç ve bitiş tarihi gereklidir'
          }
        }
      });
    }

    const summary = Transaction.getSummary(userId, startDate, endDate);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        dateRange: { startDate, endDate }
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
 * Gets VAT summary for date range.
 * GET /api/transactions/vat-summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getVatSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Start date and end date are required',
            tr: 'Başlangıç ve bitiş tarihi gereklidir'
          }
        }
      });
    }

    const vatSummary = Transaction.getVatSummary(userId, startDate, endDate);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: vatSummary,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        dateRange: { startDate, endDate }
      }
    });

  } catch (error) {
    console.error('Get VAT summary error:', error);

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
 * Searches transactions.
 * GET /api/transactions/search
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function search(req, res) {
  try {
    const { lang = 'en', q } = req.query;
    const userId = req.user.id;

    if (!q || !q.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Search query is required',
            tr: 'Arama sorgusu gereklidir'
          }
        }
      });
    }

    const transactions = Transaction.searchTransactions(userId, q.trim());

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: transactions,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        searchTerm: q.trim(),
        count: transactions.length
      }
    });

  } catch (error) {
    console.error('Search transactions error:', error);

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
 * Gets transaction stats (counts by type and status).
 * GET /api/transactions/stats
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getStats(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const typeCounts = Transaction.getTypeCounts(userId);
    const statusCounts = Transaction.getStatusCounts(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        byType: typeCounts,
        byStatus: statusCounts
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get transaction stats error:', error);

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
 * Updates transaction status.
 * PATCH /api/transactions/:id/status
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const transaction = Transaction.findById(parseInt(id, 10));

    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Transaction not found',
            tr: 'İşlem bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (transaction.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    if (!status) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Status is required',
            tr: 'Durum gereklidir'
          }
        }
      });
    }

    const result = Transaction.updateStatus(parseInt(id, 10), status);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: result.error || 'Failed to update status',
            tr: result.error || 'Durum güncellenemedi'
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
    console.error('Update transaction status error:', error);

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
 * Gets the audit history for a transaction.
 * GET /api/transactions/:id/history
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getHistory(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { id } = req.params;

    const {
      page = 1,
      limit = 50,
      action,
      sortOrder = 'DESC'
    } = req.query;

    // First verify the transaction exists and belongs to the user
    const transaction = Transaction.findById(parseInt(id, 10));

    if (!transaction) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Transaction not found',
            tr: 'İşlem bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (transaction.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Get the audit history
    const result = TransactionAuditLog.getTransactionHistory(parseInt(id, 10), {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      action,
      sortOrder
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        transactionId: parseInt(id, 10)
      }
    });

  } catch (error) {
    console.error('Get transaction history error:', error);

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
  create,
  list,
  getById,
  update,
  remove,
  getSummary,
  getVatSummary,
  search,
  getStats,
  updateStatus,
  getHistory
};
