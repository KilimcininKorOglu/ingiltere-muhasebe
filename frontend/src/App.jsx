import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import TransactionList from './pages/transactions/TransactionList';
import TransactionForm from './pages/transactions/TransactionForm';
import InvoiceList from './pages/invoices/InvoiceList';
import InvoiceForm from './pages/invoices/InvoiceForm';
import CustomerList from './pages/customers/CustomerList';
import CustomerForm from './pages/customers/CustomerForm';
import SupplierList from './pages/suppliers/SupplierList';
import SupplierForm from './pages/suppliers/SupplierForm';
import EmployeeList from './pages/employees/EmployeeList';
import EmployeeForm from './pages/employees/EmployeeForm';
import PayrollList from './pages/payroll/PayrollList';
import PayrollForm from './pages/payroll/PayrollForm';
import VatDashboard from './pages/vat/VatDashboard';
import VatReturnNew from './pages/vat/VatReturnNew';
import VatReturns from './pages/vat/VatReturns';
import VatReturnDetail from './pages/vat/VatReturnDetail';
import ReportsDashboard from './pages/reports/ReportsDashboard';
import BankDashboard from './pages/bank/BankDashboard';
import BankAccountForm from './pages/bank/BankAccountForm';
import Settings from './pages/settings/Settings';

import './i18n';

const LoadingFallback = () => (
  <div className="loading-fallback">
    <div className="loading-spinner" aria-label="Loading...">
      Loading...
    </div>
  </div>
);

const App = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              
              <Route path="transactions" element={<TransactionList />} />
              <Route path="transactions/new" element={<TransactionForm />} />
              <Route path="transactions/:id/edit" element={<TransactionForm />} />
              
              <Route path="invoices" element={<InvoiceList />} />
              <Route path="invoices/new" element={<InvoiceForm />} />
              <Route path="invoices/:id" element={<InvoiceForm />} />
              <Route path="invoices/:id/edit" element={<InvoiceForm />} />
              
              <Route path="customers" element={<CustomerList />} />
              <Route path="customers/new" element={<CustomerForm />} />
              <Route path="customers/:id/edit" element={<CustomerForm />} />
              
              <Route path="suppliers" element={<SupplierList />} />
              <Route path="suppliers/new" element={<SupplierForm />} />
              <Route path="suppliers/:id/edit" element={<SupplierForm />} />
              
              <Route path="employees" element={<EmployeeList />} />
              <Route path="employees/new" element={<EmployeeForm />} />
              <Route path="employees/:id/edit" element={<EmployeeForm />} />
              
              <Route path="payroll" element={<PayrollList />} />
              <Route path="payroll/new" element={<PayrollForm />} />
              <Route path="payroll/:id" element={<PayrollForm />} />
              
              <Route path="vat" element={<VatDashboard />} />
              <Route path="vat/return/new" element={<VatReturnNew />} />
              <Route path="vat/returns" element={<VatReturns />} />
              <Route path="vat/returns/:id" element={<VatReturnDetail />} />
              
              <Route path="reports" element={<ReportsDashboard />} />
              
              <Route path="bank" element={<BankDashboard />} />
              <Route path="bank/accounts/new" element={<BankAccountForm />} />
              <Route path="bank/accounts/:id/transactions" element={<BankDashboard />} />
              <Route path="bank/accounts/:id/reconcile" element={<BankDashboard />} />
              
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </Suspense>
  );
};

export default App;
