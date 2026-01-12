/**
 * Supplier Controller
 * Handles CRUD operations for supplier records.
 * Provides endpoints for managing suppliers with UK VAT compliance.
 * 
 * @module controllers/supplierController
 */

const { 
  createSupplier, 
  findById, 
  findByName,
  findByVATNumber,
  findByCompanyNumber,
  getSuppliersByUserId, 
  updateSupplier, 
  deleteSupplier,
  updateStatus,
  getActiveSuppliers,
  searchByName,
  getStatusCounts,
  getVatRegisteredSuppliers,
  SUPPLIER_STATUSES
} = require('../database/models/Supplier');
const { query: dbQuery } = require('../database/index');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Creates a new supplier.
 * POST /api/suppliers
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Supplier data
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function create(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const supplierData = {
      userId,
      ...req.body
    };

    const result = createSupplier(supplierData);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create supplier due to validation errors',
            tr: 'Doğrulama hataları nedeniyle tedarikçi oluşturulamadı'
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
    console.error('Create supplier error:', error);

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
 * Gets a supplier by ID.
 * GET /api/suppliers/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Supplier ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    const supplier = findById(parseInt(id, 10));

    if (!supplier) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Supplier not found',
            tr: 'Tedarikçi bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (supplier.userId !== userId) {
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
      data: supplier,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get supplier error:', error);

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
 * Lists suppliers for the authenticated user with pagination and filtering.
 * GET /api/suppliers
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
      const suppliers = searchByName(userId, search.trim());
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          suppliers,
          total: suppliers.length,
          page: 1,
          limit: suppliers.length
        },
        meta: {
          language: lang,
          timestamp: new Date().toISOString(),
          searchTerm: search.trim()
        }
      });
    }

    const result = getSuppliersByUserId(userId, {
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
    console.error('List suppliers error:', error);

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
 * Updates a supplier.
 * PUT /api/suppliers/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Supplier ID
 * @param {Object} req.body - Supplier data to update
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function update(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    // Check if supplier exists
    const supplier = findById(parseInt(id, 10));

    if (!supplier) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Supplier not found',
            tr: 'Tedarikçi bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (supplier.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    const result = updateSupplier(parseInt(id, 10), req.body);

    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to update supplier due to validation errors',
            tr: 'Doğrulama hataları nedeniyle tedarikçi güncellenemedi'
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
    console.error('Update supplier error:', error);

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
 * Checks if a supplier has unpaid invoices.
 * 
 * @param {number} userId - User ID
 * @param {string} supplierName - Supplier name
 * @returns {boolean} True if supplier has unpaid invoices
 */
function hasUnpaidInvoices(userId, supplierName) {
  try {
    // Check for invoices with status 'pending', 'draft', or 'overdue' for this supplier
    const result = dbQuery(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE userId = ? AND supplierName = ? AND status IN ('pending', 'draft', 'overdue')
    `, [userId, supplierName]);
    
    return result && result[0] && result[0].count > 0;
  } catch (error) {
    console.error('Error checking unpaid invoices:', error.message);
    return false;
  }
}

/**
 * Deletes a supplier (soft delete by setting status to 'archived').
 * DELETE /api/suppliers/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Supplier ID
 * @param {Object} req.query.hard - Whether to perform hard delete (default: false)
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function remove(req, res) {
  try {
    const { lang = 'en', hard = 'false' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    // Check if supplier exists
    const supplier = findById(parseInt(id, 10));

    if (!supplier) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Supplier not found',
            tr: 'Tedarikçi bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (supplier.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Soft delete (archive) by default, hard delete if requested
    const isHardDelete = hard === 'true';

    if (isHardDelete) {
      const result = deleteSupplier(parseInt(id, 10));

      if (!result.success) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: {
            code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
            message: {
              en: result.error || 'Failed to delete supplier',
              tr: result.error || 'Tedarikçi silinemedi'
            }
          }
        });
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: {
          en: 'Supplier permanently deleted',
          tr: 'Tedarikçi kalıcı olarak silindi'
        },
        meta: {
          language: lang,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Soft delete: set status to 'inactive'
    const result = updateStatus(parseInt(id, 10), 'inactive');

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: result.error || 'Failed to deactivate supplier',
            tr: result.error || 'Tedarikçi devre dışı bırakılamadı'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      message: {
        en: 'Supplier deactivated successfully',
        tr: 'Tedarikçi başarıyla devre dışı bırakıldı'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete supplier error:', error);

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
 * Updates supplier status.
 * PATCH /api/suppliers/:id/status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Supplier ID
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
    if (!status || !SUPPLIER_STATUSES.includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: `Invalid status. Must be one of: ${SUPPLIER_STATUSES.join(', ')}`,
            tr: `Geçersiz durum. Şunlardan biri olmalıdır: ${SUPPLIER_STATUSES.join(', ')}`
          }
        }
      });
    }

    // Check if supplier exists
    const supplier = findById(parseInt(id, 10));

    if (!supplier) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Supplier not found',
            tr: 'Tedarikçi bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (supplier.userId !== userId) {
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
            en: result.error || 'Failed to update supplier status',
            tr: result.error || 'Tedarikçi durumu güncellenemedi'
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
    console.error('Update supplier status error:', error);

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
 * Gets supplier counts by status.
 * GET /api/suppliers/stats
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
    console.error('Get supplier stats error:', error);

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
 * Gets only active suppliers.
 * GET /api/suppliers/active
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getActive(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const suppliers = getActiveSuppliers(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: suppliers,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: suppliers.length
      }
    });

  } catch (error) {
    console.error('Get active suppliers error:', error);

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
 * Gets VAT registered suppliers.
 * GET /api/suppliers/vat-registered
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getVatRegistered(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const suppliers = getVatRegisteredSuppliers(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: suppliers,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: suppliers.length
      }
    });

  } catch (error) {
    console.error('Get VAT registered suppliers error:', error);

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
 * Searches suppliers by name, contact name, or city.
 * GET /api/suppliers/search
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

    const suppliers = searchByName(userId, q.trim());

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: suppliers,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        searchTerm: q.trim(),
        count: suppliers.length
      }
    });

  } catch (error) {
    console.error('Search suppliers error:', error);

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
  getVatRegistered,
  search,
  // Export for testing
  hasUnpaidInvoices
};
