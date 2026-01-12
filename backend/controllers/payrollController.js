/**
 * Payroll Controller
 * Handles payroll calculation and management operations.
 * 
 * @module controllers/payrollController
 */

const Employee = require('../database/models/Employee');
const PayrollEntry = require('../database/models/PayrollEntry');
const payrollService = require('../services/payrollCalculationService');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Calculates payroll for an employee without saving.
 * POST /api/payroll/calculate
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Calculation parameters
 * @param {number} req.body.employeeId - Employee ID
 * @param {number} [req.body.grossPay] - Gross pay in pence (optional, uses employee's salary if not provided)
 * @param {string} req.body.payFrequency - Pay frequency (weekly, biweekly, monthly)
 * @param {number} [req.body.periodNumber=1] - Period number in tax year
 * @param {number} [req.body.bonus=0] - Bonus in pence
 * @param {number} [req.body.commission=0] - Commission in pence
 * @param {number} [req.body.otherDeductions=0] - Other deductions in pence
 * @param {Object} res - Express response object
 */
function calculatePayroll(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const {
      employeeId,
      grossPay,
      payFrequency,
      periodNumber = 1,
      bonus = 0,
      commission = 0,
      otherDeductions = 0,
      cumulativeTaxableIncome = 0,
      cumulativeTaxPaid = 0,
      taxYear
    } = req.body;
    
    // Validate required fields
    if (!employeeId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Employee ID is required',
            tr: 'Çalışan kimliği gereklidir'
          }
        }
      });
    }
    
    // Find the employee
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
    
    // Verify employee belongs to the user
    if (employee.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Determine pay frequency
    const effectivePayFrequency = payFrequency || employee.payFrequency || 'monthly';
    
    // Calculate gross pay if not provided
    let effectiveGrossPay = grossPay;
    if (effectiveGrossPay === undefined || effectiveGrossPay === null) {
      // Use employee's annual salary or hourly rate
      if (employee.annualSalary && employee.annualSalary > 0) {
        effectiveGrossPay = payrollService.periodizeAmount(employee.annualSalary, effectivePayFrequency);
      } else if (employee.hourlyRate && employee.hourlyRate > 0) {
        // For hourly, require explicit gross pay
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Gross pay is required for hourly employees',
              tr: 'Saatlik çalışanlar için brüt ödeme gereklidir'
            }
          }
        });
      } else {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Gross pay is required or employee must have a salary configured',
              tr: 'Brüt ödeme gerekli veya çalışanın maaşı yapılandırılmış olmalıdır'
            }
          }
        });
      }
    }
    
    // Validate inputs
    const validation = payrollService.validatePayrollInputs({
      grossPayInPence: effectiveGrossPay,
      taxCode: employee.taxCode,
      payFrequency: effectivePayFrequency,
      studentLoanPlan: employee.studentLoanPlan
    });
    
    if (!validation.isValid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid payroll calculation inputs',
            tr: 'Geçersiz bordro hesaplama girdileri'
          },
          details: Object.entries(validation.errors).map(([field, message]) => ({
            field,
            message
          }))
        }
      });
    }
    
    // Calculate payroll
    const calculation = payrollService.calculatePayroll({
      grossPayInPence: effectiveGrossPay,
      taxCode: employee.taxCode,
      payFrequency: effectivePayFrequency,
      niCategory: 'A', // Default category, could be extended to store on employee
      periodNumber,
      cumulativeTaxableIncome,
      cumulativeTaxPaid,
      pensionOptIn: employee.pensionOptIn,
      pensionContributionRate: employee.pensionContribution || 0,
      employerPensionRate: 300, // Default 3% employer contribution
      studentLoanPlan: employee.studentLoanPlan,
      bonus,
      commission,
      otherDeductions,
      taxYear
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          taxCode: employee.taxCode,
          payFrequency: effectivePayFrequency
        },
        calculation: {
          grossPay: calculation.grossPay,
          taxableIncome: calculation.taxableIncome,
          incomeTax: calculation.incomeTax,
          employeeNI: calculation.employeeNI,
          employerNI: calculation.employerNI,
          pensionEmployeeContribution: calculation.pensionEmployeeContribution,
          pensionEmployerContribution: calculation.pensionEmployerContribution,
          studentLoanDeduction: calculation.studentLoanDeduction,
          otherDeductions: calculation.otherDeductions,
          netPay: calculation.netPay,
          cumulativeTaxableIncome: calculation.newCumulativeTaxableIncome,
          cumulativeTaxPaid: calculation.newCumulativeTaxPaid
        },
        breakdown: calculation.breakdown
      },
      meta: {
        periodNumber,
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Calculate payroll error:', error);
    
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
 * Creates a payroll entry for an employee.
 * POST /api/payroll
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Payroll entry data
 * @param {Object} res - Express response object
 */
function createPayrollEntry(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const {
      employeeId,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      grossPay,
      hoursWorked,
      overtimeHours,
      overtimeRate,
      bonus = 0,
      commission = 0,
      otherDeductions = 0,
      otherDeductionsNotes,
      notes,
      status = 'draft',
      taxYear
    } = req.body;
    
    // Validate required fields
    if (!employeeId || !payPeriodStart || !payPeriodEnd || !payDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Employee ID, pay period dates, and pay date are required',
            tr: 'Çalışan kimliği, ödeme dönemi tarihleri ve ödeme tarihi gereklidir'
          }
        }
      });
    }
    
    // Find the employee
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
    
    // Verify employee belongs to the user
    if (employee.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    const payFrequency = employee.payFrequency || 'monthly';
    
    // Calculate gross pay if not provided
    let effectiveGrossPay = grossPay;
    if (effectiveGrossPay === undefined || effectiveGrossPay === null) {
      if (employee.annualSalary && employee.annualSalary > 0) {
        effectiveGrossPay = payrollService.periodizeAmount(employee.annualSalary, payFrequency);
      } else if (employee.hourlyRate && hoursWorked !== undefined) {
        // Calculate from hourly rate
        effectiveGrossPay = employee.hourlyRate * hoursWorked;
        if (overtimeHours && overtimeRate) {
          effectiveGrossPay += employee.hourlyRate * overtimeHours * overtimeRate;
        }
      } else {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: {
              en: 'Gross pay is required or employee must have salary/hourly rate configured',
              tr: 'Brüt ödeme gerekli veya çalışanın maaş/saatlik ücreti yapılandırılmış olmalıdır'
            }
          }
        });
      }
    }
    
    // Get previous cumulative values
    const latestEntry = PayrollEntry.getLatestEntryForEmployee(employeeId);
    const cumulativeTaxableIncome = latestEntry?.cumulativeTaxableIncome || 0;
    const cumulativeTaxPaid = latestEntry?.cumulativeTaxPaid || 0;
    
    // Determine period number based on pay period start date
    const periodStart = new Date(payPeriodStart);
    const taxYearStart = new Date(periodStart.getFullYear(), 3, 6); // April 6th
    if (periodStart < taxYearStart) {
      taxYearStart.setFullYear(taxYearStart.getFullYear() - 1);
    }
    
    const daysSinceStart = Math.floor((periodStart - taxYearStart) / (1000 * 60 * 60 * 24));
    let periodNumber = 1;
    if (payFrequency === 'weekly') {
      periodNumber = Math.floor(daysSinceStart / 7) + 1;
    } else if (payFrequency === 'biweekly') {
      periodNumber = Math.floor(daysSinceStart / 14) + 1;
    } else {
      periodNumber = Math.floor(daysSinceStart / 30) + 1;
    }
    
    // Calculate payroll
    const calculation = payrollService.calculatePayroll({
      grossPayInPence: effectiveGrossPay,
      taxCode: employee.taxCode,
      payFrequency,
      niCategory: 'A',
      periodNumber,
      cumulativeTaxableIncome,
      cumulativeTaxPaid,
      pensionOptIn: employee.pensionOptIn,
      pensionContributionRate: employee.pensionContribution || 0,
      employerPensionRate: 300,
      studentLoanPlan: employee.studentLoanPlan,
      bonus,
      commission,
      otherDeductions,
      taxYear
    });
    
    // Create payroll entry
    const entryResult = PayrollEntry.createPayrollEntry({
      employeeId,
      userId,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      status,
      grossPay: calculation.grossPay,
      taxableIncome: calculation.taxableIncome,
      incomeTax: calculation.incomeTax,
      employeeNI: calculation.employeeNI,
      employerNI: calculation.employerNI,
      studentLoanDeduction: calculation.studentLoanDeduction,
      pensionEmployeeContribution: calculation.pensionEmployeeContribution,
      pensionEmployerContribution: calculation.pensionEmployerContribution,
      otherDeductions: calculation.otherDeductions,
      otherDeductionsNotes,
      netPay: calculation.netPay,
      hoursWorked: hoursWorked || 0,
      overtimeHours: overtimeHours || 0,
      overtimeRate: overtimeRate || 1.5,
      bonus,
      commission,
      taxCode: employee.taxCode,
      niCategory: 'A',
      cumulativeTaxableIncome: calculation.newCumulativeTaxableIncome,
      cumulativeTaxPaid: calculation.newCumulativeTaxPaid,
      notes
    });
    
    if (!entryResult.success) {
      const errorDetails = Object.entries(entryResult.errors).map(([field, message]) => ({
        field,
        message
      }));
      
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Failed to create payroll entry',
            tr: 'Bordro kaydı oluşturulamadı'
          },
          details: errorDetails
        }
      });
    }
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: entryResult.data,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Create payroll entry error:', error);
    
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
 * Gets all payroll entries for the authenticated user.
 * GET /api/payroll
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getPayrollEntries(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const sortBy = req.query.sortBy || 'payDate';
    const sortOrder = req.query.sortOrder || 'DESC';
    
    const result = PayrollEntry.getEntriesByUserId(userId, {
      page,
      limit,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.entries,
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
    console.error('Get payroll entries error:', error);
    
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
 * Gets a single payroll entry by ID.
 * GET /api/payroll/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {Object} res - Express response object
 */
function getPayrollEntry(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const entryId = parseInt(req.params.id, 10);
    
    if (isNaN(entryId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid payroll entry ID',
            tr: 'Geçersiz bordro kayıt kimliği'
          }
        }
      });
    }
    
    const entry = PayrollEntry.findById(entryId);
    
    if (!entry) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'PAYROLL_ENTRY_NOT_FOUND',
          message: {
            en: 'Payroll entry not found',
            tr: 'Bordro kaydı bulunamadı'
          }
        }
      });
    }
    
    if (entry.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Get employee details
    const employee = Employee.findById(entry.employeeId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...entry,
        employee: employee ? {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName
        } : null
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get payroll entry error:', error);
    
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
 * Gets payroll entries for a specific employee.
 * GET /api/payroll/employee/:employeeId
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {Object} res - Express response object
 */
function getEmployeePayrollEntries(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const employeeId = parseInt(req.params.employeeId, 10);
    
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
    
    // Verify employee belongs to user
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
    
    if (employee.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const status = req.query.status;
    const sortBy = req.query.sortBy || 'payDate';
    const sortOrder = req.query.sortOrder || 'DESC';
    
    const result = PayrollEntry.getEntriesByEmployeeId(employeeId, {
      page,
      limit,
      status,
      sortBy,
      sortOrder
    });
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName
        },
        entries: result.entries
      },
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
    console.error('Get employee payroll entries error:', error);
    
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
 * Updates a payroll entry.
 * PUT /api/payroll/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {Object} req.body - Update data
 * @param {Object} res - Express response object
 */
function updatePayrollEntry(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const entryId = parseInt(req.params.id, 10);
    
    if (isNaN(entryId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid payroll entry ID',
            tr: 'Geçersiz bordro kayıt kimliği'
          }
        }
      });
    }
    
    const existingEntry = PayrollEntry.findById(entryId);
    if (!existingEntry) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'PAYROLL_ENTRY_NOT_FOUND',
          message: {
            en: 'Payroll entry not found',
            tr: 'Bordro kaydı bulunamadı'
          }
        }
      });
    }
    
    if (existingEntry.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Check if entry can be modified (not paid or cancelled)
    if (['paid', 'cancelled'].includes(existingEntry.status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'ENTRY_LOCKED',
          message: {
            en: 'Cannot modify a paid or cancelled payroll entry',
            tr: 'Ödenmiş veya iptal edilmiş bordro kaydı değiştirilemez'
          }
        }
      });
    }
    
    // Don't allow changing userId or employeeId
    const updateData = { ...req.body };
    delete updateData.userId;
    delete updateData.employeeId;
    delete updateData.id;
    
    const result = PayrollEntry.updatePayrollEntry(entryId, updateData);
    
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
            en: 'Failed to update payroll entry',
            tr: 'Bordro kaydı güncellenemedi'
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
    console.error('Update payroll entry error:', error);
    
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
 * Updates payroll entry status.
 * PATCH /api/payroll/:id/status
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {Object} req.body - Status update
 * @param {Object} res - Express response object
 */
function updatePayrollStatus(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const entryId = parseInt(req.params.id, 10);
    
    if (isNaN(entryId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid payroll entry ID',
            tr: 'Geçersiz bordro kayıt kimliği'
          }
        }
      });
    }
    
    const { status } = req.body;
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
    
    const existingEntry = PayrollEntry.findById(entryId);
    if (!existingEntry) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'PAYROLL_ENTRY_NOT_FOUND',
          message: {
            en: 'Payroll entry not found',
            tr: 'Bordro kaydı bulunamadı'
          }
        }
      });
    }
    
    if (existingEntry.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    const result = PayrollEntry.updateStatus(entryId, status);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
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
    console.error('Update payroll status error:', error);
    
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
 * Deletes a payroll entry.
 * DELETE /api/payroll/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.params - Route parameters
 * @param {Object} res - Express response object
 */
function deletePayrollEntry(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    const entryId = parseInt(req.params.id, 10);
    
    if (isNaN(entryId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Invalid payroll entry ID',
            tr: 'Geçersiz bordro kayıt kimliği'
          }
        }
      });
    }
    
    const existingEntry = PayrollEntry.findById(entryId);
    if (!existingEntry) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'PAYROLL_ENTRY_NOT_FOUND',
          message: {
            en: 'Payroll entry not found',
            tr: 'Bordro kaydı bulunamadı'
          }
        }
      });
    }
    
    if (existingEntry.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.code,
          message: ERROR_CODES.AUTHZ_RESOURCE_OWNER_ONLY.message
        }
      });
    }
    
    // Only allow deletion of draft entries
    if (existingEntry.status !== 'draft') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'ENTRY_LOCKED',
          message: {
            en: 'Only draft payroll entries can be deleted',
            tr: 'Sadece taslak bordro kayıtları silinebilir'
          }
        }
      });
    }
    
    const result = PayrollEntry.deletePayrollEntry(entryId);
    
    if (!result.success) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
          message: {
            en: result.error,
            tr: result.error
          }
        }
      });
    }
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: {
        en: 'Payroll entry deleted successfully',
        tr: 'Bordro kaydı başarıyla silindi'
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Delete payroll entry error:', error);
    
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
 * Gets payroll summary for a date range.
 * GET /api/payroll/summary
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.query - Query parameters
 * @param {Object} res - Express response object
 */
function getPayrollSummary(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            en: 'Start date and end date are required',
            tr: 'Başlangıç ve bitiş tarihleri gereklidir'
          }
        }
      });
    }
    
    const summary = PayrollEntry.getPayrollSummary(userId, startDate, endDate);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        period: {
          startDate,
          endDate
        },
        summary: {
          totalGross: summary.totalGross,
          totalNet: summary.totalNet,
          totalIncomeTax: summary.totalTax,
          totalEmployeeNI: summary.totalEmployeeNI,
          totalEmployerNI: summary.totalEmployerNI,
          entryCount: summary.entryCount
        }
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get payroll summary error:', error);
    
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
 * Gets status counts for payroll entries.
 * GET /api/payroll/counts
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 */
function getPayrollStatusCounts(req, res) {
  try {
    const { lang = 'en' } = req.query;
    const userId = req.user.id;
    
    const counts = PayrollEntry.getStatusCounts(userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Get payroll status counts error:', error);
    
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
  calculatePayroll,
  createPayrollEntry,
  getPayrollEntries,
  getPayrollEntry,
  getEmployeePayrollEntries,
  updatePayrollEntry,
  updatePayrollStatus,
  deletePayrollEntry,
  getPayrollSummary,
  getPayrollStatusCounts
};
