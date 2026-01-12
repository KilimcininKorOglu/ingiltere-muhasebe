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

// Import routes
const taxRatesRoutes = require('./routes/taxRates');
const authRoutes = require('./routes/auth');
const employeesRoutes = require('./routes/employees');
const suppliersRoutes = require('./routes/suppliers');
const invoicesRoutes = require('./routes/invoices');
const categoriesRoutes = require('./routes/categories');

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
      taxRates: '/api/tax-rates',
      categories: '/api/categories',
      employees: '/api/employees',
      suppliers: '/api/suppliers',
      invoices: '/api/invoices',
      health: '/health'
    },
    documentation: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
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
      }
    }
  });
});

// Apply standard rate limiter to all API routes
app.use('/api', standardLimiter);

// Mount routes
// Auth routes have additional strict rate limiting applied in the route file
app.use('/api/auth', authRoutes);
app.use('/api/tax-rates', taxRatesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/invoices', invoicesRoutes);

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
