import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { employeeService } from '../../services/api';
import { Search, Plus, Pencil, Trash2, User, Mail, Phone, Banknote, Play } from 'lucide-react';

const EmployeeList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeService.getAll();
      const data = response.data?.data?.employees || response.data?.data || response.data;
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await employeeService.delete(id);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      e.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('employees.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('employees.subtitle')}</p>
        </div>
        <Link
          to="/employees/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('employees.addEmployee')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="">{t('employees.allStatuses')}</option>
          <option value="active">{t('employees.active')}</option>
          <option value="inactive">{t('employees.inactive')}</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-zinc-800/50 rounded-xl border border-zinc-700">
          <User className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">{t('employees.noEmployees')}</p>
          <Link
            to="/employees/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('employees.addFirst')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('employees.name')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('employees.email')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('employees.niNumber')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('employees.taxCode')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('employees.salary')}</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">{t('employees.status')}</th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-white font-medium">{`${emp.firstName} ${emp.lastName}`}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{emp.email || '-'}</td>
                    <td className="py-3 px-4 text-zinc-300 font-mono text-sm">{emp.niNumber || '-'}</td>
                    <td className="py-3 px-4 text-zinc-300 font-mono text-sm">{emp.taxCode || '-'}</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">{formatCurrency(emp.salary)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        emp.status === 'active' || !emp.status
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {t(`employees.${emp.status || 'active'}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/payroll/new?employeeId=${emp.id}`}
                          className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors group"
                          title={t('payroll.runPayroll')}
                        >
                          <Play className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400" />
                        </Link>
                        <Link
                          to={`/employees/${emp.id}/edit`}
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors group"
                        >
                          <Pencil className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                        </Link>
                        <button
                          onClick={() => handleDelete(emp.id)}
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
            {filteredEmployees.map((emp) => (
              <div key={emp.id} className="bg-zinc-800 rounded-xl border border-zinc-700 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{`${emp.firstName} ${emp.lastName}`}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        emp.status === 'active' || !emp.status
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {t(`employees.${emp.status || 'active'}`)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/payroll/new?employeeId=${emp.id}`}
                      className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4 text-emerald-400" />
                    </Link>
                    <Link
                      to={`/employees/${emp.id}/edit`}
                      className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-zinc-400" />
                    </Link>
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {emp.email && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Mail className="w-4 h-4" />
                      <span>{emp.email}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone className="w-4 h-4" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <Banknote className="w-4 h-4" />
                    <span>{formatCurrency(emp.salary)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Results Count */}
      <div className="text-sm text-zinc-500">
        {filteredEmployees.length} {t('common.results')}
      </div>
    </div>
  );
};

export default EmployeeList;
