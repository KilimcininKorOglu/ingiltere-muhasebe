import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { vatService } from '../../services/api';
import { Receipt, Plus, Eye, Loader2, FileText, AlertCircle, Calendar } from 'lucide-react';

const VatReturns = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const response = await vatService.getReturns();
      const vatReturns = response.data?.data?.vatReturns || response.data?.vatReturns || [];
      setReturns(vatReturns);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format((amount || 0) / 100);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'draft':
        return 'bg-amber-500/20 text-amber-400';
      case 'overdue':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'submitted': return t('vat.statusSubmitted');
      case 'draft': return t('vat.statusDraft');
      case 'overdue': return t('vat.statusOverdue');
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('vat.returns')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('vat.returnsSubtitle')}</p>
        </div>
        <Link
          to="/vat/return/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('vat.newReturn')}
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={fetchReturns}
            className="ml-auto text-sm text-red-400 hover:text-red-300 underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Empty State */}
      {returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-700">
          <div className="w-16 h-16 rounded-full bg-zinc-700/50 flex items-center justify-center mb-4">
            <Receipt className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-zinc-400 mb-4">{t('vat.noReturns')}</p>
          <Link
            to="/vat/return/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('vat.createFirstReturn')}
          </Link>
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="text-sm text-zinc-400">
            {returns.length} {t('common.results')}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left px-6 py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {t('vat.period')}
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {t('vat.outputVat')}
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {t('vat.inputVat')}
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {t('vat.netVat')}
                  </th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {t('common.status')}
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {returns.map((vatReturn) => (
                  <tr key={vatReturn.id} className="hover:bg-zinc-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-white font-medium">
                          {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-white">{formatCurrency(vatReturn.box1)}</td>
                    <td className="px-6 py-4 text-right text-white">{formatCurrency(vatReturn.box4)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={vatReturn.box5 >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {formatCurrency(vatReturn.box5)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(vatReturn.status)}`}>
                        {getStatusLabel(vatReturn.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/vat/returns/${vatReturn.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        {t('common.view')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {returns.map((vatReturn) => (
              <div key={vatReturn.id} className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusBadge(vatReturn.status)}`}>
                        {getStatusLabel(vatReturn.status)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/vat/returns/${vatReturn.id}`}
                    className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-zinc-900/50 rounded-lg p-2">
                    <div className="text-zinc-500 text-xs">{t('vat.outputVat')}</div>
                    <div className="text-white font-medium">{formatCurrency(vatReturn.box1)}</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-2">
                    <div className="text-zinc-500 text-xs">{t('vat.inputVat')}</div>
                    <div className="text-white font-medium">{formatCurrency(vatReturn.box4)}</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-2">
                    <div className="text-zinc-500 text-xs">{t('vat.netVat')}</div>
                    <div className={vatReturn.box5 >= 0 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                      {formatCurrency(vatReturn.box5)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default VatReturns;
