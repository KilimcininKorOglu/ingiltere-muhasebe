/**
 * Bank Account Controller
 * Handles bank account CRUD operations with UK-specific validation.
 * 
 * @module controllers/bankAccountController
 */

const BankAccount = require('../database/models/BankAccount');
const { query, queryOne } = require('../database/index');
const { HTTP_STATUS, ERROR_CODES, createErrorResponse } = require('../utils/errorCodes');
const ReconciliationStatusService = require('../services/reconciliationStatusService');
const ReconciliationReportService = require('../services/reconciliationReportService');
const { generateReconciliationReportPdf, validateReportDataForPdf } = require('../services/pdfGenerator');

/**
 * Creates a new bank account.
 * POST /api/bank-accounts
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.accountName - Friendly name for the account
 * @param {string} req.body.bankName - Name of the bank
 * @param {string} [req.body.accountType] - Type of account (current, savings, business)
 * @param {string} req.body.sortCode - UK sort code (6 digits)
 * @param {string} req.body.accountNumber - UK account number (8 digits)
 * @param {string} [req.body.iban] - Optional IBAN
 * @param {string} [req.body.bic] - Optional BIC/SWIFT code
 * @param {string} [req.body.currency] - Account currency (GBP, EUR, USD)
 * @param {number} [req.body.openingBalance] - Initial balance in pence
 * @param {boolean} [req.body.isDefault] - Whether this is the default account
 * @param {string} [req.body.notes] - Additional notes
 * @param {Object} res - Express response object
 */
async function createBankAccount(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const {
      accountName,
      bankName,
      accountType,
      sortCode,
      accountNumber,
      iban,
      bic,
      currency,
      openingBalance,
      isDefault,
      notes
    } = req.body;

    // Create bank account
    const result = BankAccount.createBankAccount({
      userId,
      accountName,
      bankName,
      accountType,
      sortCode,
      accountNumber,
      iban,
      bic,
      currency,
      openingBalance,
      isDefault,
      notes
    });

    if (!result.success) {
      // Handle validation errors from BankAccount model
      const errorDetails = Object.entries(result.errors).map(([field, message]) => ({
        field,
        message
      }));

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create bank account due to validation errors',
            tr: 'Banka hesabı doğrulama hataları nedeniyle oluşturulamadı'
          },
          details: errorDetails
        }
      });
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        bankAccount: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Create bank account error:', error);

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
 * Gets all bank accounts for the authenticated user.
 * GET /api/bank-accounts
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {boolean} [req.query.activeOnly=false] - Filter for active accounts only
 * @param {string} [req.query.accountType] - Filter by account type
 * @param {string} [req.query.sortBy='accountName'] - Sort field
 * @param {string} [req.query.sortOrder='ASC'] - Sort order
 * @param {Object} res - Express response object
 */
async function getBankAccounts(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const {
      page = 1,
      limit = 10,
      activeOnly,
      accountType,
      sortBy = 'accountName',
      sortOrder = 'ASC'
    } = req.query;

    const result = BankAccount.getBankAccountsByUserId(userId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      activeOnly: activeOnly === 'true' || activeOnly === true,
      accountType,
      sortBy,
      sortOrder
    });

    // Get total balance for GBP accounts
    const totalBalance = BankAccount.getTotalBalance(userId, 'GBP');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccounts: result.bankAccounts,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        },
        summary: {
          totalBalance: totalBalance.totalBalance,
          accountCount: totalBalance.accountCount,
          currency: 'GBP'
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get bank accounts error:', error);

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
 * Gets a single bank account by ID.
 * GET /api/bank-accounts/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} res - Express response object
 */
async function getBankAccountById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Verify ownership
    if (bankAccount.userId !== userId) {
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
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount)
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get bank account by ID error:', error);

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
 * Updates a bank account.
 * PUT /api/bank-accounts/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.body - Request body with fields to update
 * @param {Object} res - Express response object
 */
async function updateBankAccount(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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
    const existingAccount = BankAccount.findById(bankAccountId);
    if (!existingAccount) {
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

    if (existingAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const {
      accountName,
      bankName,
      accountType,
      sortCode,
      accountNumber,
      iban,
      bic,
      currency,
      openingBalance,
      currentBalance,
      isDefault,
      isActive,
      notes
    } = req.body;

    // Build update data (only include provided fields)
    const updateData = {};
    if (accountName !== undefined) updateData.accountName = accountName;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (accountType !== undefined) updateData.accountType = accountType;
    if (sortCode !== undefined) updateData.sortCode = sortCode;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
    if (iban !== undefined) updateData.iban = iban;
    if (bic !== undefined) updateData.bic = bic;
    if (currency !== undefined) updateData.currency = currency;
    if (openingBalance !== undefined) updateData.openingBalance = openingBalance;
    if (currentBalance !== undefined) updateData.currentBalance = currentBalance;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (notes !== undefined) updateData.notes = notes;

    const result = BankAccount.updateBankAccount(bankAccountId, updateData);

    if (!result.success) {
      const errorDetails = Object.entries(result.errors).map(([field, message]) => ({
        field,
        message
      }));

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to update bank account due to validation errors',
            tr: 'Banka hesabı doğrulama hataları nedeniyle güncellenemedi'
          },
          details: errorDetails
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update bank account error:', error);

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
 * Checks if a bank account has unreconciled transactions.
 * 
 * @param {number} bankAccountId - Bank account ID
 * @returns {Object} Result with hasUnreconciled flag and count
 */
function checkUnreconciledTransactions(bankAccountId) {
  // Check if the transactions table has a bankAccountId column
  // For now, we'll check if there are any transactions with status != 'reconciled' and status != 'void'
  // that are linked to this bank account
  try {
    // First, check if bankAccountId column exists in transactions table
    const tableInfo = query('PRAGMA table_info(transactions)', []);
    const hasBankAccountIdColumn = tableInfo.some(col => col.name === 'bankAccountId');
    
    if (!hasBankAccountIdColumn) {
      // No bankAccountId column yet, so no transactions are linked to bank accounts
      return { hasUnreconciled: false, count: 0 };
    }
    
    const result = queryOne(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE bankAccountId = ? AND status NOT IN ('reconciled', 'void')
    `, [bankAccountId]);
    
    return {
      hasUnreconciled: (result?.count || 0) > 0,
      count: result?.count || 0
    };
  } catch (error) {
    console.error('Error checking unreconciled transactions:', error.message);
    // If there's an error (e.g., column doesn't exist), assume no unreconciled transactions
    return { hasUnreconciled: false, count: 0 };
  }
}

/**
 * Soft deletes (deactivates) a bank account.
 * DELETE /api/bank-accounts/:id
 * 
 * Cannot delete if account has unreconciled transactions.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.query - Query parameters
 * @param {boolean} [req.query.force=false] - Force hard delete (admin only)
 * @param {Object} res - Express response object
 */
async function deleteBankAccount(req, res) {
  try {
    const { lang = 'en', force } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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
    const existingAccount = BankAccount.findById(bankAccountId);
    if (!existingAccount) {
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

    if (existingAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Check for unreconciled transactions
    const unreconciledCheck = checkUnreconciledTransactions(bankAccountId);
    if (unreconciledCheck.hasUnreconciled) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_BANK_ACCOUNT_HAS_UNRECONCILED',
          message: {
            en: `Cannot delete bank account with ${unreconciledCheck.count} unreconciled transaction(s). Please reconcile or void all transactions first.`,
            tr: `${unreconciledCheck.count} mutabık olmayan işlem(ler) olan banka hesabı silinemez. Lütfen önce tüm işlemleri mutabık edin veya iptal edin.`
          }
        }
      });
    }

    // Perform soft delete (deactivate) by default
    // Hard delete only if force=true (for administrative cleanup)
    if (force === 'true') {
      const deleteResult = BankAccount.deleteBankAccount(bankAccountId);
      if (!deleteResult.success) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: {
            code: 'SYS_INTERNAL_ERROR',
            message: {
              en: deleteResult.error || 'Failed to delete bank account',
              tr: 'Banka hesabı silinemedi'
            }
          }
        });
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          message: {
            en: 'Bank account permanently deleted',
            tr: 'Banka hesabı kalıcı olarak silindi'
          }
        },
        meta: {
          language: lang,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Soft delete - deactivate the account
    const deactivateResult = BankAccount.deactivateBankAccount(bankAccountId);
    if (!deactivateResult.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: {
            en: deactivateResult.error || 'Failed to deactivate bank account',
            tr: 'Banka hesabı devre dışı bırakılamadı'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: deactivateResult.data,
        message: {
          en: 'Bank account deactivated successfully',
          tr: 'Banka hesabı başarıyla devre dışı bırakıldı'
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete bank account error:', error);

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
 * Sets a bank account as the default.
 * POST /api/bank-accounts/:id/default
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} res - Express response object
 */
async function setDefaultBankAccount(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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
    const existingAccount = BankAccount.findById(bankAccountId);
    if (!existingAccount) {
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

    if (existingAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = BankAccount.setAsDefault(bankAccountId);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: result.error || 'Failed to set bank account as default',
            tr: 'Banka hesabı varsayılan olarak ayarlanamadı'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Set default bank account error:', error);

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
 * Reactivates a deactivated bank account.
 * POST /api/bank-accounts/:id/reactivate
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} res - Express response object
 */
async function reactivateBankAccount(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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
    const existingAccount = BankAccount.findById(bankAccountId);
    if (!existingAccount) {
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

    if (existingAccount.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = BankAccount.reactivateBankAccount(bankAccountId);

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: {
            en: result.error || 'Failed to reactivate bank account',
            tr: 'Banka hesabı yeniden etkinleştirilemedi'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Reactivate bank account error:', error);

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
 * Searches bank accounts by name.
 * GET /api/bank-accounts/search
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.q - Search term
 * @param {Object} res - Express response object
 */
async function searchBankAccounts(req, res) {
  try {
    const { lang = 'en', q } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
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

    const bankAccounts = BankAccount.searchBankAccounts(userId, q);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccounts,
        count: bankAccounts.length
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Search bank accounts error:', error);

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
 * Gets the full reconciliation status for a bank account.
 * GET /api/bank-accounts/:id/reconciliation-status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
 * @param {Object} res - Express response object
 */
async function getReconciliationStatus(req, res) {
  try {
    const { lang = 'en', startDate, endDate } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Get full reconciliation status
    const result = ReconciliationStatusService.getFullReconciliationStatus(bankAccountId, {
      startDate,
      endDate
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'RECONCILIATION_STATUS_ERROR',
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
    console.error('Get reconciliation status error:', error);

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
 * Gets the reconciliation balance calculations for a bank account.
 * GET /api/bank-accounts/:id/reconciliation-balance
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
 * @param {Object} res - Express response object
 */
async function getReconciliationBalance(req, res) {
  try {
    const { lang = 'en', startDate, endDate } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Get balance calculations
    const result = ReconciliationStatusService.calculateBalances(bankAccountId, {
      startDate,
      endDate
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'BALANCE_CALCULATION_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount),
        balances: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      }
    });

  } catch (error) {
    console.error('Get reconciliation balance error:', error);

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
 * Gets unreconciled totals for a bank account to identify discrepancies.
 * GET /api/bank-accounts/:id/unreconciled-totals
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
 * @param {Object} res - Express response object
 */
async function getUnreconciledTotals(req, res) {
  try {
    const { lang = 'en', startDate, endDate } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Get unreconciled totals
    const result = ReconciliationStatusService.getUnreconciledTotals(bankAccountId, {
      startDate,
      endDate
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'UNRECONCILED_TOTALS_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount),
        unreconciledTotals: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      }
    });

  } catch (error) {
    console.error('Get unreconciled totals error:', error);

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
 * Gets the last reconciliation date and related information.
 * GET /api/bank-accounts/:id/last-reconciliation
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} res - Express response object
 */
async function getLastReconciliationDate(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Get last reconciliation date
    const result = ReconciliationStatusService.getLastReconciliationDate(bankAccountId);

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'LAST_RECONCILIATION_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        bankAccount: BankAccount.sanitizeBankAccount(bankAccount),
        lastReconciliation: result.data
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get last reconciliation date error:', error);

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
 * Gets reconciliation status overview for all bank accounts of the user.
 * GET /api/bank-accounts/reconciliation-overview
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getReconciliationOverview(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    // Get reconciliation status for all accounts
    const result = ReconciliationStatusService.getReconciliationStatusByUser(userId);

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'RECONCILIATION_OVERVIEW_ERROR',
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
    console.error('Get reconciliation overview error:', error);

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
 * Gets a reconciliation report for a bank account.
 * GET /api/bank-accounts/:id/reconciliation-report
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
 * @param {Object} res - Express response object
 */
async function getReconciliationReport(req, res) {
  try {
    const { lang = 'en', startDate, endDate } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Validate request parameters
    const validation = ReconciliationReportService.validateReportRequest(bankAccountId, {
      startDate,
      endDate
    });

    if (!validation.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.errors.join('; '),
            tr: validation.errors.join('; ')
          }
        }
      });
    }

    // Generate the report
    const result = ReconciliationReportService.generateReconciliationReport(bankAccountId, {
      startDate,
      endDate,
      userId
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'RECONCILIATION_REPORT_ERROR',
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
        dateRange: startDate && endDate ? { startDate, endDate } : null
      }
    });

  } catch (error) {
    console.error('Get reconciliation report error:', error);

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
 * Generates and downloads a reconciliation report PDF for a bank account.
 * GET /api/bank-accounts/:id/reconciliation-report/pdf
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Bank account ID
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
 * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
 * @param {string} [req.query.lang='en'] - Language preference (en/tr)
 * @param {Object} res - Express response object
 */
async function getReconciliationReportPdf(req, res) {
  try {
    const { lang = 'en', startDate, endDate } = req.query;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING.code,
          message: ERROR_CODES.AUTH_TOKEN_MISSING.message
        }
      });
    }

    const bankAccountId = parseInt(id, 10);
    if (isNaN(bankAccountId)) {
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

    // Validate request parameters
    const validation = ReconciliationReportService.validateReportRequest(bankAccountId, {
      startDate,
      endDate
    });

    if (!validation.valid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: validation.errors.join('; '),
            tr: validation.errors.join('; ')
          }
        }
      });
    }

    // Generate the report data for PDF
    const result = ReconciliationReportService.getReportDataForPdf(bankAccountId, {
      startDate,
      endDate,
      userId,
      lang
    });

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'RECONCILIATION_REPORT_ERROR',
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }

    // Validate report data for PDF generation
    const pdfValidation = validateReportDataForPdf(result.data);
    if (!pdfValidation.isValid) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'PDF_GENERATION_ERROR',
          message: {
            en: 'Failed to validate report data for PDF: ' + pdfValidation.errors.join('; '),
            tr: 'PDF için rapor verileri doğrulanamadı: ' + pdfValidation.errors.join('; ')
          }
        }
      });
    }

    // Generate PDF
    const pdfBuffer = await generateReconciliationReportPdf(result.data, { lang });

    // Generate filename
    const accountName = bankAccount.accountName.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `reconciliation_report_${accountName}_${dateStr}.pdf`;

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send the PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Get reconciliation report PDF error:', error);

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
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount,
  setDefaultBankAccount,
  reactivateBankAccount,
  searchBankAccounts,
  checkUnreconciledTransactions,
  getReconciliationStatus,
  getReconciliationBalance,
  getUnreconciledTotals,
  getLastReconciliationDate,
  getReconciliationOverview,
  getReconciliationReport,
  getReconciliationReportPdf
};
