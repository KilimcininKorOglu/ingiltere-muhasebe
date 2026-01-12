/**
 * UK Accounting Application - Main Application Entry
 * 
 * Express application for UK tax and accounting services.
 * Provides bilingual API (English/Turkish) for UK tax rates and calculations.
 * Includes security middleware, rate limiting, and CORS configuration.
 */

const express = require('express');

// Import security middleware
const { securityHeaders, corsMiddleware, sanitizeInput } = require('./middleware/security');
const { standardLimiter, strictLimiter } = require('./middleware/rateLimiter');
const { localization } = require('./middleware/localization');

// Import routes
const taxRatesRoutes = require('./routes/taxRates');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const employeesRoutes = require('./routes/employees');
const suppliersRoutes = require('./routes/suppliers');
const customersRoutes = require('./routes/customers');
const invoicesRoutes = require('./routes/invoices');
const categoriesRoutes = require('./routes/categories');
const transactionsRoutes = require('./routes/transactions');
const payrollRoutes = require('./routes/payroll');
const reportsRoutes = require('./routes/reports');
const vatRoutes = require('./routes/vat');
const dashboardRoutes = require('./routes/dashboard');

// Initialize Express app
const app = express();

// Trust proxy for accurate IP detection (important for rate limiting)
app.set('trust proxy', 1);

// Security headers middleware - set security headers on all responses
app.use(securityHeaders());

// CORS middleware - configure allowed origins
app.use(corsMiddleware());

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization middleware - sanitize all inputs against XSS
app.use(sanitizeInput({
  skipFields: ['password', 'confirmPassword', 'currentPassword', 'newPassword']
}));

// Localization middleware - detect and set request locale
app.use(localization());

// Request logging middleware (skip in test mode for cleaner output)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Information endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'UK Accounting API',
    version: '1.0.0',
    description: {
      en: 'API for UK tax rates, calculations, and accounting services',
      tr: 'İngiltere vergi oranları, hesaplamalar ve muhasebe hizmetleri için API'
    },
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      settings: '/api/settings',
      taxRates: '/api/tax-rates',
      categories: '/api/categories',
      employees: '/api/employees',
      suppliers: '/api/suppliers',
      invoices: '/api/invoices',
      transactions: '/api/transactions',
      payroll: '/api/payroll',
      reports: '/api/reports',
      vat: '/api/vat',
      dashboard: '/api/dashboard',
      health: '/health'
    },
    documentation: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      users: {
        getProfile: 'GET /api/users/me',
        updateProfile: 'PUT /api/users/me'
      },
      settings: {
        getVatSettings: 'GET /api/settings/vat',
        updateVatSettings: 'PUT /api/settings/vat',
        getVatSchemes: 'GET /api/settings/vat/schemes'
      },
      taxRates: {
        all: 'GET /api/tax-rates',
        current: 'GET /api/tax-rates/current',
        byYear: 'GET /api/tax-rates/year/:taxYear',
        byType: 'GET /api/tax-rates/type/:taxType',
        incomeTaxBands: 'GET /api/tax-rates/income-tax/bands',
        calculateIncomeTax: 'POST /api/tax-rates/calculate/income-tax',
        vat: 'GET /api/tax-rates/vat',
        corporationTax: 'GET /api/tax-rates/corporation-tax',
        nationalInsurance: 'GET /api/tax-rates/national-insurance'
      },
      employees: {
        list: 'GET /api/employees',
        search: 'GET /api/employees/search?q=:query',
        counts: 'GET /api/employees/counts',
        getById: 'GET /api/employees/:id',
        create: 'POST /api/employees',
        update: 'PUT /api/employees/:id',
        delete: 'DELETE /api/employees/:id',
        permanentDelete: 'DELETE /api/employees/:id/permanent',
        validateNI: 'POST /api/employees/validate/ni-number',
        validateTaxCode: 'POST /api/employees/validate/tax-code'
      },
      suppliers: {
        list: 'GET /api/suppliers',
        search: 'GET /api/suppliers/search?q=:query',
        stats: 'GET /api/suppliers/stats',
        active: 'GET /api/suppliers/active',
        vatRegistered: 'GET /api/suppliers/vat-registered',
        getById: 'GET /api/suppliers/:id',
        create: 'POST /api/suppliers',
        update: 'PUT /api/suppliers/:id',
        updateStatus: 'PATCH /api/suppliers/:id/status',
        delete: 'DELETE /api/suppliers/:id'
      },
      invoices: {
        list: 'GET /api/invoices',
        stats: 'GET /api/invoices/stats',
        overdue: 'GET /api/invoices/overdue',
        getById: 'GET /api/invoices/:id',
        create: 'POST /api/invoices',
        updateStatus: 'PATCH /api/invoices/:id/status',
        delete: 'DELETE /api/invoices/:id'
      },
      categories: {
        list: 'GET /api/categories',
        types: 'GET /api/categories/types',
        stats: 'GET /api/categories/stats',
        tree: 'GET /api/categories/tree',
        topLevel: 'GET /api/categories/top-level',
        search: 'GET /api/categories/search?q=:query',
        byType: 'GET /api/categories/type/:type',
        byCode: 'GET /api/categories/code/:code',
        getById: 'GET /api/categories/:id'
      },
      transactions: {
        list: 'GET /api/transactions',
        search: 'GET /api/transactions/search?q=:query',
        stats: 'GET /api/transactions/stats',
        summary: 'GET /api/transactions/summary?startDate=:date&endDate=:date',
        vatSummary: 'GET /api/transactions/vat-summary?startDate=:date&endDate=:date',
        getById: 'GET /api/transactions/:id',
        create: 'POST /api/transactions',
        update: 'PUT /api/transactions/:id',
        updateStatus: 'PATCH /api/transactions/:id/status',
        delete: 'DELETE /api/transactions/:id'
      },
      payroll: {
        calculate: 'POST /api/payroll/calculate',
        summary: 'GET /api/payroll/summary?startDate=:date&endDate=:date',
        counts: 'GET /api/payroll/counts',
        list: 'GET /api/payroll',
        getById: 'GET /api/payroll/:id',
        getByEmployee: 'GET /api/payroll/employee/:employeeId',
        create: 'POST /api/payroll',
        update: 'PUT /api/payroll/:id',
        updateStatus: 'PATCH /api/payroll/:id/status',
        delete: 'DELETE /api/payroll/:id'
      },
      reports: {
        payeSummary: 'GET /api/reports/paye-summary?startDate=:date&endDate=:date',
        payeSummaryByTaxYear: 'GET /api/reports/paye-summary/tax-year/:taxYear',
        payeSummaryByMonth: 'GET /api/reports/paye-summary/monthly/:year/:month',
        paymentDeadline: 'GET /api/reports/paye-summary/deadline/:year/:month',
        profitLoss: 'GET /api/reports/profit-loss?startDate=:date&endDate=:date',
        profitLossByTaxYear: 'GET /api/reports/profit-loss/tax-year/:taxYear',
        profitLossByMonth: 'GET /api/reports/profit-loss/monthly/:year/:month',
        profitLossByQuarter: 'GET /api/reports/profit-loss/quarterly/:year/:quarter'
      },
      vat: {
        thresholdStatus: 'GET /api/vat/threshold-status',
        thresholdConfig: 'GET /api/vat/threshold-config',
        dashboardSummary: 'GET /api/vat/dashboard-summary',
        turnoverBreakdown: 'GET /api/vat/turnover-breakdown'
      },
      dashboard: {
        summary: 'GET /api/dashboard/summary',
        quickSummary: 'GET /api/dashboard/quick-summary',
        monthlySummary: 'GET /api/dashboard/monthly-summary',
        alerts: 'GET /api/dashboard/alerts',
        recentActivity: 'GET /api/dashboard/recent-activity'
      }
    }
  });
});

// Apply standard rate limiter to all API routes
app.use('/api', standardLimiter);

// Mount routes
// Auth routes have additional strict rate limiting applied in the route file
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tax-rates', taxRatesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/vat', vatRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: {
        en: `Route ${req.method} ${req.url} not found`,
        tr: `${req.method} ${req.url} rotası bulunamadı`
      }
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: {
        en: err.message || 'An unexpected error occurred',
        tr: err.messageTr || 'Beklenmeyen bir hata oluştu'
      }
    }
  });
});

// Server configuration
const PORT = process.env.PORT || 3000;

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║         UK Accounting API Server Started              ║
╠═══════════════════════════════════════════════════════╣
║  Port: ${PORT}                                          ║
║  Environment: ${process.env.NODE_ENV || 'development'}                         ║
║  API Base: http://localhost:${PORT}/api                  ║
║  Tax Rates: http://localhost:${PORT}/api/tax-rates       ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
