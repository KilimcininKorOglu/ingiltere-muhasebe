import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const language = localStorage.getItem('i18nextLng') || 'en';
    config.headers['Accept-Language'] = language;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const dashboardService = {
  getSummary: () => api.get('/dashboard/summary'),
  getQuickSummary: () => api.get('/dashboard/quick-summary'),
  getMonthlySummary: () => api.get('/dashboard/monthly-summary'),
  getAlerts: () => api.get('/dashboard/alerts'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
};

export const transactionService = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  getStats: () => api.get('/transactions/stats'),
  getSummary: (params) => api.get('/transactions/summary', { params }),
  getVatSummary: (params) => api.get('/transactions/vat-summary', { params }),
};

export const categoryService = {
  getAll: (params) => api.get('/categories', { params }),
  getByType: (type) => api.get(`/categories/type/${type}`),
  getById: (id) => api.get(`/categories/${id}`),
};

export const invoiceService = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  updateStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
  delete: (id) => api.delete(`/invoices/${id}`),
  getStats: () => api.get('/invoices/stats'),
  getOverdue: () => api.get('/invoices/overdue'),
  getPdf: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
};

export const customerService = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getStats: () => api.get('/customers/stats'),
};

export const supplierService = {
  getAll: (params) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  getStats: () => api.get('/suppliers/stats'),
};

export const employeeService = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  getCounts: () => api.get('/employees/counts'),
};

export const payrollService = {
  getAll: (params) => api.get('/payroll', { params }),
  getById: (id) => api.get(`/payroll/${id}`),
  create: (data) => api.post('/payroll', data),
  update: (id, data) => api.put(`/payroll/${id}`, data),
  delete: (id) => api.delete(`/payroll/${id}`),
  calculate: (data) => api.post('/payroll/calculate', data),
  getSummary: (params) => api.get('/payroll/summary', { params }),
};

export const reportService = {
  getProfitLoss: (params) => api.get('/reports/profit-loss', { params }),
  getProfitLossByTaxYear: (taxYear) => api.get(`/reports/profit-loss/tax-year/${taxYear}`),
  getPayeSummary: (params) => api.get('/reports/paye-summary', { params }),
  getBalanceSheet: (params) => api.get('/reports/balance-sheet', { params }),
  getCashFlow: (params) => api.get('/reports/cash-flow', { params }),
};

export const vatService = {
  getThresholdStatus: () => api.get('/vat/threshold-status'),
  getDashboardSummary: () => api.get('/vat/dashboard-summary'),
  getTurnoverBreakdown: () => api.get('/vat/turnover-breakdown'),
  getReturns: (params) => api.get('/vat/returns', { params }),
  createReturn: (data) => api.post('/vat/returns', data),
  exportReturnPdf: (id) => api.get(`/vat/returns/${id}/pdf`, { responseType: 'blob' }),
};

export const settingsService = {
  getVatSettings: () => api.get('/settings/vat'),
  updateVatSettings: (data) => api.put('/settings/vat', data),
  getVatSchemes: () => api.get('/settings/vat/schemes'),
};

export const bankAccountService = {
  getAll: () => api.get('/bank-accounts'),
  getById: (id) => api.get(`/bank-accounts/${id}`),
  create: (data) => api.post('/bank-accounts', data),
  update: (id, data) => api.put(`/bank-accounts/${id}`, data),
  delete: (id) => api.delete(`/bank-accounts/${id}`),
};

export const bankTransactionService = {
  getAll: (params) => api.get('/bank-transactions', { params }),
  import: (accountId, data) => api.post(`/bank-accounts/${accountId}/import`, data),
  reconcile: (id, transactionId) => api.post(`/bank-transactions/${id}/reconcile`, { transactionId }),
};

export default api;
