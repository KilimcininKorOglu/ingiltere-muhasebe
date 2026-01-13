import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { payrollService, employeeService } from '../../services/api';
import { Plus, Eye, Trash2, Calculator, Banknote, Calendar } from 'lucide-react';

const PayrollList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    employeeId: '',
    status: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPayrolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchData = async () => {
    try {
      const empRes = await employeeService.getAll();
      const empData = empRes.data?.data?.employees || empRes.data?.data || empRes.data;
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    }
  };

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      );
      const response = await payrollService.getAll(params);
      const data = response.data?.data?.payrolls || response.data?.data || response.data;
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch payrolls:', err);
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await payrollService.delete(id);
      fetchPayrolls();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    return dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-zinc-500/20 text-zinc-400',
      approved: 'bg-blue-500/20 text-blue-400',
      paid: 'bg-emerald-500/20 text-emerald-400',
    };
    return styles[status] || styles.draft;
  };

  const selectClass = "px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const inputClass = "px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('payroll.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('payroll.subtitle')}</p>
        </div>
        <Link
          to="/payroll/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('payroll.runPayroll')}
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          name="employeeId"
          value={filters.employeeId}
          onChange={handleFilterChange}
          className={selectClass}
        >
          <option value="">{t('payroll.allEmployees')}</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>

        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className={selectClass}
        >
          <option value="">{t('payroll.allStatuses')}</option>
          <option value="draft">{t('payroll.draft')}</option>
          <option value="approved">{t('payroll.approved')}</option>
          <option value="paid">{t('payroll.paid')}</option>
        </select>

        <input
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={handleFilterChange}
          className={inputClass}
          placeholder={t('common.startDate')}
        />

        <input
          type="date"
          name="endDate"
          value={filters.endDate}
          onChange={handleFilterChange}
          className={inputClass}
          placeholder={t('common.endDate')}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : payrolls.length === 0 ? (
        <div className="text-center py-12 bg-zinc-800/50 rounded-xl border border-zinc-700">
          <Calculator className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">{t('payroll.noPayrolls')}</p>
          <Link
            to="/payroll/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('payroll.runFirst')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.employee')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.payPeriod')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.grossPay')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.incomeTax')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.nationalInsurance')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.netPay')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('payroll.status')}</th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {payrolls.map((pr) => (
                  <tr key={pr.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Calculator className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-white font-medium">
                          {pr.employee?.firstName} {pr.employee?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-300 text-sm">
                      {formatDate(pr.payPeriodStart)} - {formatDate(pr.payPeriodEnd)}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">{formatCurrency(pr.grossPay)}</td>
                    <td className="py-3 px-4 text-red-400">{formatCurrency(pr.incomeTax)}</td>
                    <td className="py-3 px-4 text-red-400">{formatCurrency(pr.nationalInsurance)}</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">{formatCurrency(pr.netPay)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(pr.status)}`}>
                        {t(`payroll.${pr.status}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/payroll/${pr.id}`}
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors group"
                        >
                          <Eye className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                        </Link>
                        <button
                          onClick={() => handleDelete(pr.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
                        >
                          <Trash2 className="w-4 h-4 text-zinc-400 group-hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {payrolls.map((pr) => (
              <div key={pr.id} className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">
                        {pr.employee?.firstName} {pr.employee?.lastName}
                      </h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusBadge(pr.status)}`}>
                        {t(`payroll.${pr.status}`)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/payroll/${pr.id}`}
                      className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4 text-zinc-400" />
                    </Link>
                    <button
                      onClick={() => handleDelete(pr.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(pr.payPeriodStart)} - {formatDate(pr.payPeriodEnd)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                    <div>
                      <span className="text-zinc-500 text-xs">{t('payroll.grossPay')}</span>
                      <p className="text-white font-medium">{formatCurrency(pr.grossPay)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500 text-xs">{t('payroll.netPay')}</span>
                      <p className="text-emerald-400 font-medium">{formatCurrency(pr.netPay)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Results Count */}
      <div className="text-sm text-zinc-500">
        {payrolls.length} {t('common.results')}
      </div>
    </div>
  );
};

export default PayrollList;
