/**
 * Customer Controller
 * Handles CRUD operations for customer records.
 * Provides endpoints for managing customers with UK VAT compliance.
 * 
 * @module controllers/customerController
 */

const { 
  createCustomer, 
  findById, 
  findByName,
  findByCustomerNumber,
  findByEmail,
  getCustomersByUserId, 
  updateCustomer, 
  deleteCustomer,
  updateStatus,
  getActiveCustomers,
  searchByName,
  getStatusCounts,
  getB2BCustomers,
  CUSTOMER_STATUSES
} = require('../database/models/Customer');
const { query: dbQuery } = require('../database/index');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');
const {
  getCustomerTransactionHistory,
  getCustomerInvoiceHistory,
  getCustomerSummary,
  validateDateRange
} = require('../services/customerSummaryService');

/**
 * Creates a new customer.
 * POST /api/customers
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Customer data
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function create(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const customerData = {
      userId,
      ...req.body
    };

    const result = createCustomer(customerData);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create customer due to validation errors',
            tr: 'Doğrulama hataları nedeniyle müşteri oluşturulamadı'
          },
          details: Object.entries(result.errors).map(([field, message]) => ({
            field,
            message
          }))
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
    console.error('Create customer error:', error);

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
 * Gets a customer by ID.
 * GET /api/customers/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    const customer = findById(parseInt(id, 10));

    if (!customer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Customer not found',
            tr: 'Müşteri bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (customer.userId !== userId) {
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
      data: customer,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get customer error:', error);

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
 * Lists customers for the authenticated user with pagination and filtering.
 * GET /api/customers
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters (page, limit, status, sortBy, sortOrder, search)
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function list(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'name',
      sortOrder = 'ASC',
      search
    } = req.query;

    // If search term is provided, use search function
    if (search && search.trim()) {
      const customers = searchByName(userId, search.trim());
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          customers,
          total: customers.length,
          page: 1,
          limit: customers.length
        },
        meta: {
          language: lang,
          timestamp: new Date().toISOString(),
          searchTerm: search.trim()
        }
      });
    }

    const result = getCustomersByUserId(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
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
    console.error('List customers error:', error);

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
 * Updates a customer.
 * PUT /api/customers/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.body - Customer data to update
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function update(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    // Check if customer exists
    const customer = findById(parseInt(id, 10));

    if (!customer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Customer not found',
            tr: 'Müşteri bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (customer.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = updateCustomer(parseInt(id, 10), req.body);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to update customer due to validation errors',
            tr: 'Doğrulama hataları nedeniyle müşteri güncellenemedi'
          },
          details: Object.entries(result.errors).map(([field, message]) => ({
            field,
            message
          }))
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
    console.error('Update customer error:', error);

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
 * Checks if a customer has unpaid invoices.
 * 
 * @param {number} userId - User ID
 * @param {string} customerName - Customer name
 * @returns {boolean} True if customer has unpaid invoices
 */
function hasUnpaidInvoices(userId, customerName) {
  try {
    // Check for invoices with status 'pending', 'draft', or 'overdue' for this customer
    const result = dbQuery(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE userId = ? AND customerName = ? AND status IN ('pending', 'draft', 'overdue')
    `, [userId, customerName]);
    
    return result && result[0] && result[0].count > 0;
  } catch (error) {
    console.error('Error checking unpaid invoices:', error.message);
    return false;
  }
}

/**
 * Deletes a customer (soft delete by setting status to 'archived').
 * DELETE /api/customers/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.query.hard - Whether to perform hard delete (default: false)
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function remove(req, res) {
  try {
    const { lang = 'en', hard = 'false' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    // Check if customer exists
    const customer = findById(parseInt(id, 10));

    if (!customer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Customer not found',
            tr: 'Müşteri bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (customer.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Check for unpaid invoices
    if (hasUnpaidInvoices(userId, customer.name)) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_CUSTOMER_HAS_UNPAID_INVOICES',
          message: {
            en: 'Cannot delete customer with unpaid invoices. Please resolve all outstanding invoices first.',
            tr: 'Ödenmemiş faturaları olan müşteri silinemez. Lütfen önce tüm bekleyen faturaları çözümleyin.'
          }
        }
      });
    }

    // Soft delete (archive) by default, hard delete if requested
    const isHardDelete = hard === 'true';

    if (isHardDelete) {
      const result = deleteCustomer(parseInt(id, 10));

      if (!result.success) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: {
            code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
            message: {
              en: result.error || 'Failed to delete customer',
              tr: result.error || 'Müşteri silinemedi'
            }
          }
        });
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: {
          en: 'Customer permanently deleted',
          tr: 'Müşteri kalıcı olarak silindi'
        },
        meta: {
          language: lang,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Soft delete: set status to 'archived'
    const result = updateStatus(parseInt(id, 10), 'archived');

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: result.error || 'Failed to archive customer',
            tr: result.error || 'Müşteri arşivlenemedi'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: {
        en: 'Customer archived successfully',
        tr: 'Müşteri başarıyla arşivlendi'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete customer error:', error);

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
 * Updates customer status.
 * PATCH /api/customers/:id/status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.body.status - New status
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function changeStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    if (!status || !CUSTOMER_STATUSES.includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: `Invalid status. Must be one of: ${CUSTOMER_STATUSES.join(', ')}`,
            tr: `Geçersiz durum. Şunlardan biri olmalıdır: ${CUSTOMER_STATUSES.join(', ')}`
          }
        }
      });
    }

    // Check if customer exists
    const customer = findById(parseInt(id, 10));

    if (!customer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Customer not found',
            tr: 'Müşteri bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (customer.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = updateStatus(parseInt(id, 10), status);

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: result.error || 'Failed to update customer status',
            tr: result.error || 'Müşteri durumu güncellenemedi'
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
    console.error('Update customer status error:', error);

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
 * Gets customer counts by status.
 * GET /api/customers/stats
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getStats(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const counts = getStatusCounts(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get customer stats error:', error);

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
 * Gets only active customers.
 * GET /api/customers/active
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getActive(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const customers = getActiveCustomers(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: customers,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: customers.length
      }
    });

  } catch (error) {
    console.error('Get active customers error:', error);

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
 * Gets B2B customers (those with VAT numbers).
 * GET /api/customers/b2b
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getB2B(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const customers = getB2BCustomers(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: customers,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: customers.length
      }
    });

  } catch (error) {
    console.error('Get B2B customers error:', error);

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
 * Searches customers by name, trading name, email, or customer number.
 * GET /api/customers/search
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query.q - Search query
 * @param {Object} req.user - Authenticated user from middleware
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

    const customers = searchByName(userId, q.trim());

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: customers,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        searchTerm: q.trim(),
        count: customers.length
      }
    });

  } catch (error) {
    console.error('Search customers error:', error);

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
 * Gets transaction history for a specific customer.
 * GET /api/customers/:id/transactions
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getTransactionHistory(req, res) {
  try {
    const { lang = 'en', page = 1, limit = 20, type, startDate, endDate, sortBy, sortOrder } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    // Validate date range if provided
    if (startDate || endDate) {
      const dateValidation = validateDateRange(startDate, endDate);
      if (!dateValidation.isValid) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: dateValidation.error,
              tr: dateValidation.error
            }
          }
        });
      }
    }

    const result = getCustomerTransactionHistory(userId, parseInt(id, 10), {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      type,
      startDate,
      endDate,
      sortBy,
      sortOrder
    });

    if (!result.success) {
      const statusCode = result.error === 'Customer not found' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.FORBIDDEN;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: result.error === 'Customer not found' ? 'RES_NOT_FOUND' : 'AUTHZ_RESOURCE_OWNER_ONLY',
          message: {
            en: result.error,
            tr: result.error === 'Customer not found' ? 'Müşteri bulunamadı' : 'Erişim reddedildi'
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
    console.error('Get customer transaction history error:', error);

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
 * Gets invoice history for a specific customer with status filtering.
 * GET /api/customers/:id/invoices
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getInvoiceHistory(req, res) {
  try {
    const { lang = 'en', page = 1, limit = 20, status, startDate, endDate, sortBy, sortOrder } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    // Validate date range if provided
    if (startDate || endDate) {
      const dateValidation = validateDateRange(startDate, endDate);
      if (!dateValidation.isValid) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: dateValidation.error,
              tr: dateValidation.error
            }
          }
        });
      }
    }

    const result = getCustomerInvoiceHistory(userId, parseInt(id, 10), {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder
    });

    if (!result.success) {
      const statusCode = result.error === 'Customer not found' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.FORBIDDEN;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: result.error === 'Customer not found' ? 'RES_NOT_FOUND' : 'AUTHZ_RESOURCE_OWNER_ONLY',
          message: {
            en: result.error,
            tr: result.error === 'Customer not found' ? 'Müşteri bulunamadı' : 'Erişim reddedildi'
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
    console.error('Get customer invoice history error:', error);

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
 * Gets summary information for a specific customer.
 * Includes invoice totals, transaction totals, and outstanding balance.
 * GET /api/customers/:id/summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Customer ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    const result = getCustomerSummary(userId, parseInt(id, 10));

    if (!result.success) {
      const statusCode = result.error === 'Customer not found' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.FORBIDDEN;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: result.error === 'Customer not found' ? 'RES_NOT_FOUND' : 'AUTHZ_RESOURCE_OWNER_ONLY',
          message: {
            en: result.error,
            tr: result.error === 'Customer not found' ? 'Müşteri bulunamadı' : 'Erişim reddedildi'
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
    console.error('Get customer summary error:', error);

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
  getById,
  list,
  update,
  remove,
  changeStatus,
  getStats,
  getActive,
  getB2B,
  search,
  getTransactionHistory,
  getInvoiceHistory,
  getSummary,
  // Export for testing
  hasUnpaidInvoices
};
