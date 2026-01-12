/**
 * Employee Controller
 * Handles employee management operations.
 * 
 * @module controllers/employeeController
 */

const Employee = require('../database/models/Employee');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Gets all employees for the authenticated user.
 * GET /api/employees
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string} [req.query.status] - Filter by status (default: 'active')
 * @param {string} [req.query.sortBy] - Sort field
 * @param {string} [req.query.sortOrder] - Sort order (ASC/DESC)
 * @param {boolean} [req.query.includeAll] - Include all statuses if true
 * @param {Object} res - Express response object
 */
function getEmployees(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    // Parse pagination and filter parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const sortBy = req.query.sortBy || 'lastName';
    const sortOrder = req.query.sortOrder || 'ASC';
    
    // By default, show only active employees unless includeAll is set
    const includeAll = req.query.includeAll === 'true';
    const status = includeAll ? undefined : (req.query.status || 'active');
    
    const result = Employee.getEmployeesByUserId(userId, {
      page,
      limit,
      status,
      sortBy,
      sortOrder
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.employees,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get employees error:', error);
    
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
 * Gets a single employee by ID.
 * GET /api/employees/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Employee ID
 * @param {Object} res - Express response object
 */
function getEmployee(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const employeeId = parseInt(req.params.id, 10);
    
    if (isNaN(employeeId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid employee ID',
            tr: 'Geçersiz çalışan kimliği'
          }
        }
      });
    }
    
    const employee = Employee.findById(employeeId);
    
    if (!employee) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: {
            en: 'Employee not found',
            tr: 'Çalışan bulunamadı'
          }
        }
      });
    }
    
    // Ensure employee belongs to the authenticated user
    if (employee.userId !== userId) {
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
      data: Employee.sanitizeEmployee(employee),
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get employee error:', error);
    
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
 * Creates a new employee.
 * POST /api/employees
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Employee data
 * @param {Object} res - Express response object
 */
function createEmployee(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    // Add userId to employee data
    const employeeData = {
      ...req.body,
      userId
    };
    
    const result = Employee.createEmployee(employeeData);
    
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
            en: 'Employee creation failed due to validation errors',
            tr: 'Çalışan oluşturma doğrulama hataları nedeniyle başarısız oldu'
          },
          details: errorDetails
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
    console.error('Create employee error:', error);
    
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
 * Updates an existing employee.
 * PUT /api/employees/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Employee ID
 * @param {Object} req.body - Updated employee data
 * @param {Object} res - Express response object
 */
function updateEmployee(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const employeeId = parseInt(req.params.id, 10);
    
    if (isNaN(employeeId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid employee ID',
            tr: 'Geçersiz çalışan kimliği'
          }
        }
      });
    }
    
    // Check if employee exists and belongs to user
    const existingEmployee = Employee.findById(employeeId);
    
    if (!existingEmployee) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: {
            en: 'Employee not found',
            tr: 'Çalışan bulunamadı'
          }
        }
      });
    }
    
    if (existingEmployee.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Don't allow changing userId
    const updateData = { ...req.body };
    delete updateData.userId;
    delete updateData.id;
    
    const result = Employee.updateEmployee(employeeId, updateData);
    
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
            en: 'Employee update failed due to validation errors',
            tr: 'Çalışan güncelleme doğrulama hataları nedeniyle başarısız oldu'
          },
          details: errorDetails
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
    console.error('Update employee error:', error);
    
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
 * Soft deletes an employee by setting their end date and status to terminated.
 * DELETE /api/employees/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Employee ID
 * @param {Object} res - Express response object
 */
function deleteEmployee(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const employeeId = parseInt(req.params.id, 10);
    
    if (isNaN(employeeId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid employee ID',
            tr: 'Geçersiz çalışan kimliği'
          }
        }
      });
    }
    
    // Check if employee exists and belongs to user
    const existingEmployee = Employee.findById(employeeId);
    
    if (!existingEmployee) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: {
            en: 'Employee not found',
            tr: 'Çalışan bulunamadı'
          }
        }
      });
    }
    
    if (existingEmployee.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Soft delete: set end date to today and status to terminated
    const today = new Date().toISOString().split('T')[0];
    const result = Employee.updateEmployee(employeeId, {
      endDate: today,
      status: 'terminated'
    });
    
    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: ERROR_CODES.SYS_INTERNAL_ERROR.message
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: {
        en: 'Employee terminated successfully',
        tr: 'Çalışan başarıyla sonlandırıldı'
      },
      data: result.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Delete employee error:', error);
    
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
 * Hard deletes an employee (permanently removes from database).
 * DELETE /api/employees/:id/permanent
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Employee ID
 * @param {Object} res - Express response object
 */
function permanentDeleteEmployee(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const employeeId = parseInt(req.params.id, 10);
    
    if (isNaN(employeeId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid employee ID',
            tr: 'Geçersiz çalışan kimliği'
          }
        }
      });
    }
    
    // Check if employee exists and belongs to user
    const existingEmployee = Employee.findById(employeeId);
    
    if (!existingEmployee) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: {
            en: 'Employee not found',
            tr: 'Çalışan bulunamadı'
          }
        }
      });
    }
    
    if (existingEmployee.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    const result = Employee.deleteEmployee(employeeId);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: result.error || 'Failed to delete employee',
            tr: 'Çalışan silinemedi'
          }
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: {
        en: 'Employee permanently deleted',
        tr: 'Çalışan kalıcı olarak silindi'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Permanent delete employee error:', error);
    
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
 * Searches employees by name or employee number.
 * GET /api/employees/search
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.q - Search query
 * @param {Object} res - Express response object
 */
function searchEmployees(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const searchQuery = req.query.q;
    
    if (!searchQuery || !searchQuery.trim()) {
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
    
    const employees = Employee.searchByName(userId, searchQuery.trim());
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: employees,
      meta: {
        query: searchQuery.trim(),
        count: employees.length,
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Search employees error:', error);
    
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
 * Gets employee status counts.
 * GET /api/employees/counts
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
function getStatusCounts(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const counts = Employee.getStatusCounts(userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get status counts error:', error);
    
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
 * Validates a National Insurance number.
 * POST /api/employees/validate/ni-number
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.niNumber - NI number to validate
 * @param {Object} res - Express response object
 */
function validateNINumber(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { niNumber } = req.body;
    
    if (!niNumber) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'NI number is required',
            tr: 'NI numarası gereklidir'
          }
        }
      });
    }
    
    const validationError = Employee.validateNINumber(niNumber);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        isValid: validationError === null,
        niNumber: niNumber.replace(/\s/g, '').toUpperCase(),
        error: validationError
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Validate NI number error:', error);
    
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
 * Validates a tax code.
 * POST /api/employees/validate/tax-code
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.taxCode - Tax code to validate
 * @param {Object} res - Express response object
 */
function validateTaxCode(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const { taxCode } = req.body;
    
    if (!taxCode) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Tax code is required',
            tr: 'Vergi kodu gereklidir'
          }
        }
      });
    }
    
    const validationError = Employee.validateTaxCode(taxCode);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        isValid: validationError === null,
        taxCode: taxCode.replace(/\s/g, '').toUpperCase(),
        error: validationError
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Validate tax code error:', error);
    
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
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  permanentDeleteEmployee,
  searchEmployees,
  getStatusCounts,
  validateNINumber,
  validateTaxCode
};
