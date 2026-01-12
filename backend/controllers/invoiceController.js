/**
 * Invoice Controller
 * Handles CRUD operations for invoices with UK VAT compliance.
 * Provides endpoints for managing invoices with automatic calculations.
 * 
 * @module controllers/invoiceController
 */

const { 
  createInvoice, 
  findById, 
  findByInvoiceNumber,
  getInvoicesByUserId, 
  updateInvoice, 
  deleteInvoice,
  updateStatus,
  recalculateTotals,
  getByStatus,
  getOverdueInvoices,
  getStatusCounts,
  isInvoiceOverdue,
  INVOICE_STATUSES
} = require('../database/models/Invoice');

const {
  createInvoiceItem,
  getByInvoiceId,
  deleteByInvoiceId,
  calculateLineAmounts
} = require('../database/models/InvoiceItem');

const { createTransaction } = require('../database/models/Transaction');
const { findById: findCustomerById } = require('../database/models/Customer');
const { generateNextInvoiceNumber } = require('../utils/invoiceNumberGenerator');
const { calculateInvoiceTotals } = require('../utils/invoiceCalculator');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');
const { openDatabase } = require('../database/index');
const {
  prepareStatusChange,
  getValidTransitions,
  validatePaymentDetails,
  PAYMENT_METHODS
} = require('../utils/invoiceStatusMachine');

/**
 * Creates a new invoice with line items.
 * POST /api/invoices
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Invoice data
 * @param {number} req.body.customerId - Customer ID
 * @param {string} req.body.invoiceDate - Invoice date (YYYY-MM-DD)
 * @param {string} req.body.dueDate - Due date (YYYY-MM-DD)
 * @param {string} [req.body.taxPoint] - Tax point date for UK VAT (YYYY-MM-DD)
 * @param {string} [req.body.notes] - Additional notes
 * @param {string} [req.body.currency] - Currency code (default: GBP)
 * @param {Array} req.body.items - Line items
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function create(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const { customerId, invoiceDate, dueDate, taxPoint, notes, items, currency } = req.body;

    // Verify customer exists and belongs to user
    const customer = findCustomerById(customerId);
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

    if (customer.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Generate invoice number
    const invoiceNumberResult = generateNextInvoiceNumber(userId);
    if (!invoiceNumberResult.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: {
            en: invoiceNumberResult.error || 'Failed to generate invoice number',
            tr: invoiceNumberResult.error || 'Fatura numarası oluşturulamadı'
          }
        }
      });
    }

    // Calculate line item totals
    const calculatedTotals = calculateInvoiceTotals(items);

    // Create invoice with transaction
    const db = openDatabase();
    
    let createdInvoice;
    let createdItems = [];
    
    try {
      db.transaction(() => {
        // Prepare invoice data
        const invoiceData = {
          userId,
          invoiceNumber: invoiceNumberResult.invoiceNumber,
          status: 'draft', // Always start as draft
          issueDate: invoiceDate,
          dueDate: dueDate,
          customerName: customer.name,
          customerAddress: formatCustomerAddress(customer),
          customerEmail: customer.email || null,
          customerVatNumber: customer.vatNumber || null,
          subtotal: calculatedTotals.subtotal,
          vatAmount: calculatedTotals.vatAmount,
          totalAmount: calculatedTotals.totalAmount,
          currency: (currency || 'GBP').toUpperCase(),
          notes: notes || null,
          paidAt: null
        };

        // Create the invoice
        const invoiceResult = createInvoice(invoiceData);
        
        if (!invoiceResult.success) {
          throw new Error(JSON.stringify(invoiceResult.errors));
        }

        createdInvoice = invoiceResult.data;

        // Create line items
        for (let i = 0; i < calculatedTotals.calculatedItems.length; i++) {
          const item = calculatedTotals.calculatedItems[i];
          
          const itemData = {
            invoiceId: createdInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRateId: item.vatRateId,
            vatRatePercent: item.vatRatePercent,
            vatAmount: item.vatAmount,
            lineTotal: item.lineTotal,
            sortOrder: i
          };

          const itemResult = createInvoiceItem(itemData);
          
          if (!itemResult.success) {
            throw new Error(`Failed to create line item: ${JSON.stringify(itemResult.errors)}`);
          }

          createdItems.push(itemResult.data);
        }
      })();
    } catch (transactionError) {
      console.error('Invoice creation transaction error:', transactionError);
      
      // Parse error if it's validation errors JSON
      let errorDetails = { general: 'Failed to create invoice' };
      try {
        errorDetails = JSON.parse(transactionError.message);
      } catch {
        errorDetails = { general: transactionError.message };
      }

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create invoice',
            tr: 'Fatura oluşturulamadı'
          },
          details: Object.entries(errorDetails).map(([field, message]) => ({
            field,
            message
          }))
        }
      });
    }

    // Build response with invoice and items
    const response = {
      ...createdInvoice,
      items: createdItems,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        vatNumber: customer.vatNumber
      }
    };

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: response,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Create invoice error:', error);

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
 * Formats a customer's address for invoice display.
 * 
 * @param {Object} customer - Customer data
 * @returns {string} Formatted address
 */
function formatCustomerAddress(customer) {
  const parts = [];
  
  if (customer.addressLine1) parts.push(customer.addressLine1);
  if (customer.addressLine2) parts.push(customer.addressLine2);
  if (customer.city) parts.push(customer.city);
  if (customer.county) parts.push(customer.county);
  if (customer.postcode) parts.push(customer.postcode);
  if (customer.country) parts.push(customer.country);
  
  return parts.join(', ') || null;
}

/**
 * Gets an invoice by ID with its line items.
 * GET /api/invoices/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Invoice ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getById(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    const invoice = findById(parseInt(id, 10));

    if (!invoice) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Invoice not found',
            tr: 'Fatura bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (invoice.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Get line items
    const items = getByInvoiceId(invoice.id);
    
    // Look up customer details if we can find matching customer by name
    let customer = null;
    if (invoice.customerName) {
      const { getCustomersByUserId } = require('../database/models/Customer');
      const customerResult = getCustomersByUserId(userId, { 
        search: invoice.customerName, 
        limit: 1 
      });
      if (customerResult.customers.length > 0 && 
          customerResult.customers[0].name === invoice.customerName) {
        const c = customerResult.customers[0];
        customer = {
          id: c.id,
          customerNumber: c.customerNumber,
          name: c.name,
          email: c.email,
          phone: c.phone,
          vatNumber: c.vatNumber,
          addressLine1: c.addressLine1,
          addressLine2: c.addressLine2,
          city: c.city,
          county: c.county,
          postcode: c.postcode,
          country: c.country
        };
      }
    }
    
    // Calculate if invoice is overdue
    const overdueStatus = isInvoiceOverdue(invoice);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...invoice,
        isOverdue: overdueStatus,
        items,
        customer
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get invoice error:', error);

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
 * Lists invoices for the authenticated user with pagination and filtering.
 * GET /api/invoices
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters (page, limit, status, customerId, dateFrom, dateTo, search, sortBy, sortOrder)
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
      customerId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'issueDate',
      sortOrder = 'DESC'
    } = req.query;

    const result = getInvoicesByUserId(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      dateFrom,
      dateTo,
      search,
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
    console.error('List invoices error:', error);

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
 * Deletes an invoice.
 * DELETE /api/invoices/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Invoice ID
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function remove(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const userId = req.user.id;

    const invoice = findById(parseInt(id, 10));

    if (!invoice) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Invoice not found',
            tr: 'Fatura bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (invoice.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Only draft invoices can be deleted
    if (invoice.status !== 'draft') {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          code: 'BUS_INVOICE_NOT_DELETABLE',
          message: {
            en: 'Only draft invoices can be deleted. Consider cancelling this invoice instead.',
            tr: 'Yalnızca taslak faturalar silinebilir. Bu faturayı iptal etmeyi düşünün.'
          }
        }
      });
    }

    // Delete invoice (cascade will delete items)
    const result = deleteInvoice(parseInt(id, 10));

    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: result.error || 'Failed to delete invoice',
            tr: result.error || 'Fatura silinemedi'
          }
        }
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: {
        en: 'Invoice deleted successfully',
        tr: 'Fatura başarıyla silindi'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Delete invoice error:', error);

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
 * Updates invoice status.
 * PATCH /api/invoices/:id/status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Invoice ID
 * @param {Object} req.body.status - New status
 * @param {Object} req.body.paymentDetails - Payment details (when marking as paid)
 * @param {Object} req.body.createIncomeTransaction - Whether to create an income transaction
 * @param {Object} req.body.incomeCategoryId - Category ID for income transaction
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function changeStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { id } = req.params;
    const { status, paymentDetails, createIncomeTransaction, incomeCategoryId } = req.body;
    const userId = req.user.id;

    // Validate status
    if (!status || !INVOICE_STATUSES.includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: `Invalid status. Must be one of: ${INVOICE_STATUSES.join(', ')}`,
            tr: `Geçersiz durum. Şunlardan biri olmalıdır: ${INVOICE_STATUSES.join(', ')}`
          }
        }
      });
    }

    const invoice = findById(parseInt(id, 10));

    if (!invoice) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: {
            en: 'Invoice not found',
            tr: 'Fatura bulunamadı'
          }
        }
      });
    }

    // Check ownership
    if (invoice.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }

    // Use status machine to validate and prepare the status change
    const statusChangeResult = prepareStatusChange(invoice.status, status, paymentDetails);
    
    if (!statusChangeResult.success) {
      // Check if it's a validation error (has validationErrors)
      if (statusChangeResult.validationErrors) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: statusChangeResult.error,
              tr: 'Geçersiz ödeme detayları'
            },
            details: Object.entries(statusChangeResult.validationErrors).map(([field, message]) => ({
              field,
              message
            }))
          }
        });
      }
      
      // It's an invalid transition error
      const validTransitions = getValidTransitions(invoice.status);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'BUS_INVALID_STATUS_TRANSITION',
          message: {
            en: statusChangeResult.error,
            tr: `Durum '${invoice.status}' durumundan '${status}' durumuna değiştirilemez. Geçerli geçişler: ${validTransitions.join(', ') || 'yok'}`
          },
          validTransitions
        }
      });
    }

    // Use a transaction to ensure atomicity
    const db = openDatabase();
    let updatedInvoice;
    let createdTransaction = null;
    
    try {
      db.transaction(() => {
        // Update the invoice status with all prepared data
        const updateData = {
          status: statusChangeResult.newStatus
        };
        
        // Add payment timestamp if marking as paid
        if (statusChangeResult.data.paidAt) {
          updateData.paidAt = statusChangeResult.data.paidAt;
        }
        
        // Update notes if payment notes provided
        if (statusChangeResult.data.paymentNotes && paymentDetails?.notes) {
          const currentNotes = invoice.notes || '';
          const paymentNote = `\n[Payment received: ${statusChangeResult.data.paidAt}] ${paymentDetails.notes}`;
          updateData.notes = currentNotes + paymentNote;
        }
        
        const result = updateInvoice(parseInt(id, 10), updateData);
        
        if (!result.success) {
          throw new Error(JSON.stringify(result.errors));
        }
        
        updatedInvoice = result.data;
        
        // Create income transaction if requested and marking as paid
        if (status === 'paid' && createIncomeTransaction) {
          const transactionData = {
            userId,
            categoryId: incomeCategoryId || null,
            type: 'income',
            status: 'cleared',
            transactionDate: statusChangeResult.data.paidAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            description: `Invoice payment: ${invoice.invoiceNumber}`,
            reference: paymentDetails?.paymentReference || invoice.invoiceNumber,
            amount: invoice.subtotal,
            vatAmount: invoice.vatAmount,
            totalAmount: statusChangeResult.data.paymentAmount || invoice.totalAmount,
            vatRate: invoice.vatAmount > 0 && invoice.subtotal > 0 
              ? Math.round((invoice.vatAmount / invoice.subtotal) * 10000) 
              : 0,
            currency: invoice.currency,
            paymentMethod: paymentDetails?.paymentMethod || null,
            payee: invoice.customerName,
            notes: `Auto-generated from invoice ${invoice.invoiceNumber}`,
            linkedTransactionId: null
          };
          
          const txnResult = createTransaction(transactionData);
          
          if (!txnResult.success) {
            throw new Error(`Failed to create income transaction: ${JSON.stringify(txnResult.errors)}`);
          }
          
          createdTransaction = txnResult.data;
        }
      })();
    } catch (transactionError) {
      console.error('Invoice status update transaction error:', transactionError);
      
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: 'Failed to update invoice status',
            tr: 'Fatura durumu güncellenemedi'
          }
        }
      });
    }

    // Build response
    const response = {
      ...updatedInvoice,
      statusChange: {
        previousStatus: statusChangeResult.data.previousStatus,
        newStatus: statusChangeResult.newStatus,
        changedAt: statusChangeResult.data.updatedAt
      }
    };
    
    // Add payment info if marking as paid
    if (status === 'paid' && paymentDetails) {
      response.payment = {
        paidAt: statusChangeResult.data.paidAt,
        method: paymentDetails.paymentMethod || null,
        reference: paymentDetails.paymentReference || null,
        amount: paymentDetails.paymentAmount || invoice.totalAmount
      };
    }
    
    // Add created transaction info
    if (createdTransaction) {
      response.incomeTransaction = {
        id: createdTransaction.id,
        reference: createdTransaction.reference,
        amount: createdTransaction.totalAmount
      };
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: response,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update invoice status error:', error);

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
 * Gets valid status transitions for an invoice status.
 * Uses the status machine utility.
 * 
 * @param {string} currentStatus - Current invoice status
 * @returns {string[]} Valid next statuses
 */
function getValidStatusTransitions(currentStatus) {
  return getValidTransitions(currentStatus);
}

/**
 * Gets invoice statistics for the authenticated user.
 * GET /api/invoices/stats
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
    const overdueInvoices = getOverdueInvoices(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        statusCounts: counts,
        overdueCount: overdueInvoices.length,
        overdueTotal: overdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get invoice stats error:', error);

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
 * Gets overdue invoices for the authenticated user.
 * GET /api/invoices/overdue
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
async function getOverdue(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;

    const invoices = getOverdueInvoices(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: invoices,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: invoices.length
      }
    });

  } catch (error) {
    console.error('Get overdue invoices error:', error);

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
  remove,
  changeStatus,
  getStats,
  getOverdue,
  // Export helpers for testing
  formatCustomerAddress,
  getValidStatusTransitions
};
