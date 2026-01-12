/**
 * UK Accounting Application - Main Application Entry
 * 
 * Express application for UK tax and accounting services.
 * Provides bilingual API (English/Turkish) for UK tax rates and calculations.
 */

const express = require('express');
const cors = require('cors');

// Import routes
const taxRatesRoutes = require('./routes/taxRates');
const authRoutes = require('./routes/auth');
const bankAccountsRoutes = require('./routes/bankAccounts');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

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
      bankAccounts: '/api/bank-accounts',
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
      bankAccounts: {
        list: 'GET /api/bank-accounts',
        get: 'GET /api/bank-accounts/:id',
        create: 'POST /api/bank-accounts',
        update: 'PUT /api/bank-accounts/:id',
        delete: 'DELETE /api/bank-accounts/:id',
        setDefault: 'POST /api/bank-accounts/:id/default',
        reactivate: 'POST /api/bank-accounts/:id/reactivate',
        search: 'GET /api/bank-accounts/search'
      }
    }
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/tax-rates', taxRatesRoutes);
app.use('/api/bank-accounts', bankAccountsRoutes);

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
