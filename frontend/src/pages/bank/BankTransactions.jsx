import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { bankAccountService } from '../../services/api';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Loader2, Search, Calendar, RefreshCw } from 'lucide-react';

const BankTransactions = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchData();
  }, [id, pagination.page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accountRes, transactionsRes] = await Promise.all([
        bankAccountService.getById(id),
        bankAccountService.getTransactions(id, {
          page: pagination.page,
          limit: pagination.limit,
          search: search || undefined,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
      ]);

      const accountData = accountRes.data?.data?.bankAccount || accountRes.data?.bankAccount || accountRes.data;
      setAccount(accountData);

      const txData = transactionsRes.data?.data || transactionsRes.data || {};
      setTransactions(txData.transactions || []);
      if (txData.pagination) {
        setPagination(prev => ({ ...prev, total: txData.pagination.total || 0 }));
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchData();
  };

  const formatCurrency = (amountInPence, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format((amountInPence || 0) / 100);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading && !account) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/bank"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {account?.bankName} - {account?.accountName}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {account?.sortCode} / {account?.accountNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">{t('bank.currentBalance')}</p>
          <p className={`text-xl font-bold ${(account?.currentBalance || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(account?.currentBalance, account?.currency)}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-500" />
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-zinc-500">-</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.filter')}
        </button>
      </form>

      {/* Transactions Table */}
      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400">{t('bank.noTransactions')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">{t('common.date')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">{t('bank.description')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">{t('bank.reference')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase">{t('bank.amount')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase">{t('bank.runningBalance')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase">{t('bank.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatDate(tx.transactionDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {tx.amount >= 0 ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-sm text-white">{tx.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{tx.reference || '-'}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, account?.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-300">
                      {formatCurrency(tx.runningBalance, account?.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.isReconciled ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                          {t('bank.reconciled')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-700 text-zinc-400">
                          {t('bank.pending')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700">
            <p className="text-sm text-zinc-400">
              {t('common.showing')} {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} {t('common.of')} {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-zinc-400">
                {pagination.page} / {totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankTransactions;
