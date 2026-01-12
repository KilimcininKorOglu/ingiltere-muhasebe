/**
 * Warning Service
 * Provides warning detection, pattern analysis, and compliance monitoring
 * for UK accounting application.
 */

/**
 * Warning severity levels
 */
export const WARNING_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * Warning categories
 */
export const WARNING_CATEGORY = {
  COMPLIANCE: 'compliance',
  TAX: 'tax',
  VAT: 'vat',
  PATTERN: 'pattern',
  DEADLINE: 'deadline',
  THRESHOLD: 'threshold',
  DATA_QUALITY: 'dataQuality',
};

/**
 * UK Tax thresholds and limits
 */
export const UK_TAX_THRESHOLDS = {
  vatRegistrationThreshold: 90000, // 2024/25 VAT registration threshold
  vatDeregistrationThreshold: 88000,
  selfAssessmentThreshold: 1000, // Trading income threshold for self-assessment
  higherRateTaxThreshold: 50270, // 2024/25
  additionalRateTaxThreshold: 125140, // 2024/25
  personalAllowance: 12570,
  dividendAllowance: 500, // 2024/25
  capitalGainsAllowance: 3000, // 2024/25
  employerNIThreshold: 9100, // Annual per employee
  flatRateVatThreshold: 150000, // Flat rate VAT scheme threshold
};

/**
 * Important UK tax deadlines
 */
export const UK_TAX_DEADLINES = {
  selfAssessmentOnline: { month: 1, day: 31 }, // 31 January
  selfAssessmentPaper: { month: 10, day: 31 }, // 31 October
  corporationTax: { months: 9, days: 1 }, // 9 months after accounting period end
  vatReturn: { months: 1, days: 7 }, // 1 month and 7 days after period end
  payeMonthly: { day: 22 }, // 22nd of following month (19th for post)
  payeQuarterly: { day: 22 }, // 22nd of month following quarter end
};

/**
 * Warning type definition
 * @typedef {Object} Warning
 * @property {string} id - Unique warning ID
 * @property {string} category - Warning category
 * @property {string} severity - Warning severity
 * @property {string} messageKey - Translation key for warning message
 * @property {Object} [params] - Parameters for message interpolation
 * @property {Date} [timestamp] - When the warning was generated
 * @property {boolean} [dismissible] - Whether warning can be dismissed
 * @property {string} [actionKey] - Translation key for action text
 * @property {Function} [onAction] - Action handler
 */

/**
 * Pattern detection functions
 */
const patternDetectors = {
  /**
   * Detect unusual expense patterns
   * @param {Object} expense - Current expense
   * @param {Object[]} previousExpenses - Previous expenses for comparison
   * @returns {Warning|null}
   */
  unusualExpense: (expense, previousExpenses = []) => {
    if (!expense.amount || previousExpenses.length < 5) return null;
    
    // Calculate average and standard deviation
    const amounts = previousExpenses.map(e => parseFloat(e.amount)).filter(a => !isNaN(a));
    if (amounts.length === 0) return null;
    
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length
    );
    
    const expenseAmount = parseFloat(expense.amount);
    
    // Flag if expense is more than 2 standard deviations from mean
    if (expenseAmount > avg + 2 * stdDev && stdDev > 0) {
      return {
        id: `unusual-expense-${Date.now()}`,
        category: WARNING_CATEGORY.PATTERN,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'patterns.unusualExpense',
        params: { amount: expense.amount, average: avg.toFixed(2) },
        dismissible: true,
      };
    }
    
    return null;
  },

  /**
   * Detect duplicate entries
   * @param {Object} entry - Current entry
   * @param {Object[]} existingEntries - Existing entries
   * @returns {Warning|null}
   */
  duplicateEntry: (entry, existingEntries = []) => {
    const duplicate = existingEntries.find(e => 
      e.amount === entry.amount &&
      e.date === entry.date &&
      e.description === entry.description &&
      e.id !== entry.id
    );
    
    if (duplicate) {
      return {
        id: `duplicate-${Date.now()}`,
        category: WARNING_CATEGORY.DATA_QUALITY,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'patterns.duplicateEntry',
        params: { date: entry.date },
        dismissible: true,
      };
    }
    
    return null;
  },

  /**
   * Detect round number expenses (potential estimates)
   * @param {Object} expense - Expense to check
   * @returns {Warning|null}
   */
  roundNumberExpense: (expense) => {
    const amount = parseFloat(expense.amount);
    if (isNaN(amount)) return null;
    
    // Check if amount is a round number (divisible by 100)
    if (amount >= 100 && amount % 100 === 0) {
      return {
        id: `round-number-${Date.now()}`,
        category: WARNING_CATEGORY.DATA_QUALITY,
        severity: WARNING_SEVERITY.INFO,
        messageKey: 'patterns.roundNumber',
        dismissible: true,
      };
    }
    
    return null;
  },

  /**
   * Detect weekend transactions
   * @param {Object} transaction - Transaction to check
   * @returns {Warning|null}
   */
  weekendTransaction: (transaction) => {
    if (!transaction.date) return null;
    
    const date = new Date(transaction.date);
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        id: `weekend-transaction-${Date.now()}`,
        category: WARNING_CATEGORY.DATA_QUALITY,
        severity: WARNING_SEVERITY.INFO,
        messageKey: 'patterns.weekendTransaction',
        dismissible: true,
      };
    }
    
    return null;
  },
};

/**
 * Compliance check functions
 */
const complianceCheckers = {
  /**
   * Check VAT registration requirement
   * @param {number} turnover - Annual turnover
   * @param {boolean} isVatRegistered - Current VAT status
   * @returns {Warning|null}
   */
  vatRegistration: (turnover, isVatRegistered) => {
    if (isVatRegistered) return null;
    
    if (turnover >= UK_TAX_THRESHOLDS.vatRegistrationThreshold) {
      return {
        id: 'vat-registration-required',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'compliance.vatRegistrationRequired',
        params: { threshold: UK_TAX_THRESHOLDS.vatRegistrationThreshold },
        dismissible: false,
        actionKey: 'actions.registerForVat',
      };
    }
    
    // Warning when approaching threshold
    const warningThreshold = UK_TAX_THRESHOLDS.vatRegistrationThreshold * 0.9;
    if (turnover >= warningThreshold) {
      return {
        id: 'vat-registration-approaching',
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'compliance.vatRegistrationApproaching',
        params: { 
          current: turnover,
          threshold: UK_TAX_THRESHOLDS.vatRegistrationThreshold,
          remaining: UK_TAX_THRESHOLDS.vatRegistrationThreshold - turnover,
        },
        dismissible: true,
      };
    }
    
    return null;
  },

  /**
   * Check VAT return due date
   * @param {Date} periodEndDate - VAT period end date
   * @param {boolean} isSubmitted - Whether VAT return is submitted
   * @returns {Warning|null}
   */
  vatReturnDue: (periodEndDate, isSubmitted) => {
    if (isSubmitted) return null;
    
    const dueDate = new Date(periodEndDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(dueDate.getDate() + 7);
    
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) {
      return {
        id: 'vat-return-overdue',
        category: WARNING_CATEGORY.DEADLINE,
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'deadlines.vatReturnOverdue',
        params: { daysOverdue: Math.abs(daysUntilDue) },
        dismissible: false,
      };
    }
    
    if (daysUntilDue <= 7) {
      return {
        id: 'vat-return-urgent',
        category: WARNING_CATEGORY.DEADLINE,
        severity: WARNING_SEVERITY.ERROR,
        messageKey: 'deadlines.vatReturnUrgent',
        params: { daysUntilDue },
        dismissible: false,
      };
    }
    
    if (daysUntilDue <= 14) {
      return {
        id: 'vat-return-due-soon',
        category: WARNING_CATEGORY.DEADLINE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'deadlines.vatReturnDueSoon',
        params: { daysUntilDue },
        dismissible: true,
      };
    }
    
    return null;
  },

  /**
   * Check self-assessment deadline
   * @param {number} taxYear - Tax year (start year, e.g., 2024 for 2024/25)
   * @param {boolean} isSubmitted - Whether return is submitted
   * @returns {Warning|null}
   */
  selfAssessmentDeadline: (taxYear, isSubmitted) => {
    if (isSubmitted) return null;
    
    const deadline = new Date(taxYear + 1, 0, 31); // 31 January following year
    const today = new Date();
    const daysUntilDue = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) {
      return {
        id: 'sa-overdue',
        category: WARNING_CATEGORY.DEADLINE,
        severity: WARNING_SEVERITY.CRITICAL,
        messageKey: 'deadlines.selfAssessmentOverdue',
        params: { taxYear, daysOverdue: Math.abs(daysUntilDue) },
        dismissible: false,
      };
    }
    
    if (daysUntilDue <= 30) {
      return {
        id: 'sa-due-soon',
        category: WARNING_CATEGORY.DEADLINE,
        severity: daysUntilDue <= 7 ? WARNING_SEVERITY.ERROR : WARNING_SEVERITY.WARNING,
        messageKey: 'deadlines.selfAssessmentDueSoon',
        params: { taxYear, daysUntilDue, deadline: deadline.toLocaleDateString() },
        dismissible: daysUntilDue > 7,
      };
    }
    
    return null;
  },

  /**
   * Check for missing receipts
   * @param {Object} expense - Expense to check
   * @returns {Warning|null}
   */
  missingReceipt: (expense) => {
    if (!expense.hasReceipt && expense.amount >= 25) {
      return {
        id: `missing-receipt-${expense.id}`,
        category: WARNING_CATEGORY.COMPLIANCE,
        severity: WARNING_SEVERITY.WARNING,
        messageKey: 'compliance.missingReceipt',
        params: { amount: expense.amount },
        dismissible: true,
        actionKey: 'actions.uploadReceipt',
      };
    }
    
    return null;
  },

  /**
   * Check personal allowance threshold
   * @param {number} income - Total income
   * @returns {Warning|null}
   */
  personalAllowanceReduction: (income) => {
    // Personal allowance reduces by £1 for every £2 over £100,000
    if (income > 100000) {
      const reduction = Math.min(
        UK_TAX_THRESHOLDS.personalAllowance,
        Math.floor((income - 100000) / 2)
      );
      
      if (reduction > 0) {
        return {
          id: 'personal-allowance-reduction',
          category: WARNING_CATEGORY.TAX,
          severity: WARNING_SEVERITY.INFO,
          messageKey: 'tax.personalAllowanceReduction',
          params: { 
            reduction,
            effectiveAllowance: UK_TAX_THRESHOLDS.personalAllowance - reduction,
          },
          dismissible: true,
        };
      }
    }
    
    return null;
  },
};

/**
 * Warning Service class
 */
class WarningService {
  constructor() {
    this.warnings = new Map();
    this.dismissedWarnings = new Set();
    this.listeners = new Set();
  }

  /**
   * Add a listener for warning changes
   * @param {Function} listener - Listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    const warnings = this.getActiveWarnings();
    this.listeners.forEach(listener => listener(warnings));
  }

  /**
   * Add a warning
   * @param {Warning} warning - Warning to add
   */
  addWarning(warning) {
    if (!warning || !warning.id) return;
    
    // Don't add if dismissed
    if (this.dismissedWarnings.has(warning.id)) return;
    
    warning.timestamp = warning.timestamp || new Date();
    this.warnings.set(warning.id, warning);
    this.notifyListeners();
  }

  /**
   * Remove a warning
   * @param {string} warningId - Warning ID to remove
   */
  removeWarning(warningId) {
    if (this.warnings.delete(warningId)) {
      this.notifyListeners();
    }
  }

  /**
   * Dismiss a warning
   * @param {string} warningId - Warning ID to dismiss
   */
  dismissWarning(warningId) {
    const warning = this.warnings.get(warningId);
    if (warning && warning.dismissible) {
      this.dismissedWarnings.add(warningId);
      this.warnings.delete(warningId);
      this.notifyListeners();
    }
  }

  /**
   * Clear dismissed warnings
   */
  clearDismissed() {
    this.dismissedWarnings.clear();
  }

  /**
   * Get all active warnings
   * @returns {Warning[]} Array of active warnings
   */
  getActiveWarnings() {
    return Array.from(this.warnings.values())
      .sort((a, b) => {
        // Sort by severity (critical first)
        const severityOrder = {
          [WARNING_SEVERITY.CRITICAL]: 0,
          [WARNING_SEVERITY.ERROR]: 1,
          [WARNING_SEVERITY.WARNING]: 2,
          [WARNING_SEVERITY.INFO]: 3,
        };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  /**
   * Get warnings by category
   * @param {string} category - Category to filter by
   * @returns {Warning[]} Filtered warnings
   */
  getWarningsByCategory(category) {
    return this.getActiveWarnings().filter(w => w.category === category);
  }

  /**
   * Get warnings by severity
   * @param {string} severity - Severity to filter by
   * @returns {Warning[]} Filtered warnings
   */
  getWarningsBySeverity(severity) {
    return this.getActiveWarnings().filter(w => w.severity === severity);
  }

  /**
   * Check for pattern warnings
   * @param {string} type - Pattern type to check
   * @param {Object} data - Data to analyze
   * @param {Object} context - Additional context
   * @returns {Warning|null} Pattern warning if detected
   */
  checkPattern(type, data, context = {}) {
    const detector = patternDetectors[type];
    if (!detector) {
      console.warn(`Unknown pattern type: ${type}`);
      return null;
    }
    
    const warning = detector(data, context.previousData || []);
    if (warning) {
      this.addWarning(warning);
    }
    return warning;
  }

  /**
   * Run all pattern checks
   * @param {Object} data - Data to analyze
   * @param {Object} context - Context with previous data
   * @returns {Warning[]} Array of detected warnings
   */
  checkAllPatterns(data, context = {}) {
    const warnings = [];
    
    for (const [type, detector] of Object.entries(patternDetectors)) {
      const warning = detector(data, context.previousData || []);
      if (warning) {
        warnings.push(warning);
        this.addWarning(warning);
      }
    }
    
    return warnings;
  }

  /**
   * Check compliance
   * @param {string} type - Compliance check type
   * @param {Object} params - Parameters for the check
   * @returns {Warning|null} Compliance warning if detected
   */
  checkCompliance(type, params) {
    const checker = complianceCheckers[type];
    if (!checker) {
      console.warn(`Unknown compliance check type: ${type}`);
      return null;
    }
    
    const warning = checker(...Object.values(params));
    if (warning) {
      this.addWarning(warning);
    }
    return warning;
  }

  /**
   * Run all compliance checks
   * @param {Object} businessData - Business data for checks
   * @returns {Warning[]} Array of compliance warnings
   */
  runComplianceChecks(businessData) {
    const warnings = [];
    
    // VAT registration check
    if (businessData.turnover !== undefined) {
      const vatWarning = complianceCheckers.vatRegistration(
        businessData.turnover,
        businessData.isVatRegistered || false
      );
      if (vatWarning) {
        warnings.push(vatWarning);
        this.addWarning(vatWarning);
      }
    }
    
    // Self-assessment deadline check
    if (businessData.taxYear !== undefined) {
      const saWarning = complianceCheckers.selfAssessmentDeadline(
        businessData.taxYear,
        businessData.selfAssessmentSubmitted || false
      );
      if (saWarning) {
        warnings.push(saWarning);
        this.addWarning(saWarning);
      }
    }
    
    // Personal allowance reduction check
    if (businessData.totalIncome !== undefined) {
      const paWarning = complianceCheckers.personalAllowanceReduction(
        businessData.totalIncome
      );
      if (paWarning) {
        warnings.push(paWarning);
        this.addWarning(paWarning);
      }
    }
    
    return warnings;
  }

  /**
   * Clear all warnings
   */
  clearAll() {
    this.warnings.clear();
    this.notifyListeners();
  }

  /**
   * Get warning count by severity
   * @returns {Object} Count by severity
   */
  getWarningCounts() {
    const counts = {
      [WARNING_SEVERITY.CRITICAL]: 0,
      [WARNING_SEVERITY.ERROR]: 0,
      [WARNING_SEVERITY.WARNING]: 0,
      [WARNING_SEVERITY.INFO]: 0,
      total: 0,
    };
    
    for (const warning of this.warnings.values()) {
      counts[warning.severity]++;
      counts.total++;
    }
    
    return counts;
  }

  /**
   * Check if there are any critical warnings
   * @returns {boolean}
   */
  hasCriticalWarnings() {
    return this.getWarningsBySeverity(WARNING_SEVERITY.CRITICAL).length > 0;
  }
}

// Export singleton instance
export const warningService = new WarningService();

// Export class for testing
export { WarningService };

// Export helpers
export { patternDetectors, complianceCheckers };

export default warningService;
