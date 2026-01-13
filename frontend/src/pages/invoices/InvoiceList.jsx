import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { invoiceService } from '../../services/api';
import { Plus, FileText, Search, Calendar, ChevronLeft, ChevronRight, Send, CheckCircle, Pencil, Trash2 } from 'lucide-react';

const InvoiceList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
      };
      const response = await invoiceService.getAll(params);
      const data = response.data?.data || response.data;
      const invList = data?.invoices || data;
      setInvoices(Array.isArray(invList) ? invList : []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await invoiceService.updateStatus(id, status);
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Status update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await invoiceService.delete(id);
      fetchInvoices();
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
    return dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  };

  const getStatusStyle = (status) => {
    const styles = {
      draft: 'bg-zinc-700 text-zinc-300',
      sent: 'bg-blue-500/20 text-blue-400',
      paid: 'bg-emerald-500/20 text-emerald-400',
      overdue: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-zinc-600 text-zinc-400',
    };
    return styles[status] || 'bg-zinc-700 text-zinc-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('invoices.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('invoices.subtitle')}</p>
        </div>
        <Link
          to="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('invoices.createInvoice')}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              <option value="">{t('invoices.allStatuses')}</option>
              <option value="draft">{t('invoices.draft')}</option>
              <option value="sent">{t('invoices.sent')}</option>
              <option value="paid">{t('invoices.paid')}</option>
              <option value="overdue">{t('invoices.overdue')}</option>
              <option value="cancelled">{t('invoices.cancelled')}</option>
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder={t('common.search')}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-12 text-center">
          <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">{t('invoices.noInvoices')}</p>
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('invoices.createFirst')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/50">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('invoices.invoiceNumber')}</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('invoices.customer')}</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('invoices.issueDate')}</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('invoices.dueDate')}</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('invoices.status')}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('invoices.amount')}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/invoices/${inv.id}`} className="text-emerald-400 hover:text-emerald-300 font-medium">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-white">{inv.customer?.name || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300 font-mono text-sm">{formatDate(inv.issueDate)}</td>
                    <td className="px-6 py-4 text-zinc-300 font-mono text-sm">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(inv.status)}`}>
                        {t(`invoices.${inv.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-white font-mono font-medium">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'sent')}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title={t('invoices.send')}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status === 'sent' && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'paid')}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                            title={t('invoices.markPaid')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          to={`/invoices/${inv.id}/edit`}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link to={`/invoices/${inv.id}`} className="text-emerald-400 hover:text-emerald-300 font-medium">
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-white mt-1">{inv.customer?.name || '-'}</p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(inv.status)}`}>
                    {t(`invoices.${inv.status}`)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-zinc-500">{t('invoices.issueDate')}</p>
                    <p className="text-zinc-300 font-mono">{formatDate(inv.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">{t('invoices.dueDate')}</p>
                    <p className="text-zinc-300 font-mono">{formatDate(inv.dueDate)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-700/50">
                  <p className="text-lg font-semibold text-white font-mono">{formatCurrency(inv.totalAmount)}</p>
                  <div className="flex items-center gap-2">
                    {inv.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange(inv.id, 'sent')}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {inv.status === 'sent' && (
                      <button
                        onClick={() => handleStatusChange(inv.id, 'paid')}
                        className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <Link
                      to={`/invoices/${inv.id}/edit`}
                      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('common.previous')}
            </button>
            <span className="text-sm text-zinc-400">
              {t('common.page')} <span className="text-white font-medium">{pagination.page}</span> / {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InvoiceList;
