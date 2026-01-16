import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { transactionService, categoryService } from '../../services/api';
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const TransactionList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    type: '',
    categoryId: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters]);

  const fetchCategories = async () => {
    try {
      const response = await categoryService.getAll();
      const data = response.data?.data?.categories || response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategories([]);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
      };
      const response = await transactionService.getAll(params);
      const data = response.data?.data || response.data;
      const txList = data?.transactions || data;
      setTransactions(Array.isArray(txList) ? txList : []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await transactionService.delete(id);
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-12 lg:pt-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t('transactions.title')}
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            {t('transactions.subtitle', { count: pagination.total })}
          </p>
        </div>
        <Link
          to="/transactions/new"
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={18} />
          {t('transactions.addTransaction')}
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-dark-400" />
          <span className="text-sm text-dark-400 font-medium">{t('common.filters')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            className="input-field"
          >
            <option value="">{t('transactions.allTypes')}</option>
            <option value="income">{t('transactions.income')}</option>
            <option value="expense">{t('transactions.expense')}</option>
          </select>

          <select
            name="categoryId"
            value={filters.categoryId}
            onChange={handleFilterChange}
            className="input-field"
          >
            <option value="">{t('transactions.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name || cat.nameEn}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="input-field"
          />

          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="input-field"
          />

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder={t('common.search')}
              className="input-field pl-9"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-dark-400 text-sm">{t('common.loading')}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-dark-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">{t('transactions.noTransactions')}</h3>
          <p className="text-dark-400 text-sm mb-4">{t('transactions.noTransactionsDesc')}</p>
          <Link to="/transactions/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={18} />
            {t('transactions.addFirst')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="glass-card overflow-hidden hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left text-xs text-dark-500 font-medium py-3 px-4">{t('common.date')}</th>
                  <th className="text-left text-xs text-dark-500 font-medium py-3 px-4">{t('transactions.description')}</th>
                  <th className="text-left text-xs text-dark-500 font-medium py-3 px-4">{t('transactions.category')}</th>
                  <th className="text-left text-xs text-dark-500 font-medium py-3 px-4">{t('transactions.type')}</th>
                  <th className="text-right text-xs text-dark-500 font-medium py-3 px-4">{t('transactions.amount')}</th>
                  <th className="text-right text-xs text-dark-500 font-medium py-3 px-4">{t('transactions.vat')}</th>
                  <th className="text-right text-xs text-dark-500 font-medium py-3 px-4">{t('transactions.total')}</th>
                  <th className="text-right text-xs text-dark-500 font-medium py-3 px-4">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-sm text-dark-300">{formatDate(tx.transactionDate || tx.date)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-white">{tx.description}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-dark-400">{tx.category?.name || tx.category?.nameEn || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`
                        inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                        ${tx.type === 'income' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'}
                      `}>
                        {tx.type === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {t(`transactions.${tx.type}`)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-dark-300 font-mono">{formatCurrency(tx.amount)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-dark-500 font-mono">{tx.vatRate}%</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-sm font-mono font-medium ${
                        tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(tx.totalAmount)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/transactions/${tx.id}/edit`}
                          className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
                        >
                          <Edit2 size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
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
            {transactions.map((tx) => (
              <div key={tx.id} className="glass-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{tx.description}</p>
                    <p className="text-dark-500 text-xs mt-1">{formatDate(tx.transactionDate || tx.date)}</p>
                  </div>
                  <span className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ml-3
                    ${tx.type === 'income' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'}
                  `}>
                    {tx.type === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {t(`transactions.${tx.type}`)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-dark-500 text-xs">{tx.category?.name || tx.category?.nameEn || '-'}</p>
                    <p className={`text-lg font-mono font-medium ${
                      tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(tx.totalAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/transactions/${tx.id}/edit`}
                      className="p-2 rounded-lg bg-dark-700 text-dark-300 hover:text-white transition-colors"
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-2 rounded-lg bg-dark-700 text-dark-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-dark-500">
              {t('common.showing')} {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} {t('common.of')} {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-3 py-2 text-sm text-dark-300">
                {pagination.page} / {pagination.totalPages || 1}
              </span>
              <button
                disabled={pagination.page >= (pagination.totalPages || 1)}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionList;
