import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { vatService } from '../../services/api';
import { Receipt, TrendingUp, TrendingDown, Scale, FileText, ClipboardList, Search, Settings, Loader2, Plus, AlertTriangle, CheckCircle } from 'lucide-react';

const VatDashboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    thresholdStatus: null,
    dashboardSummary: null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [thresholdRes, summaryRes] = await Promise.all([
        vatService.getThresholdStatus().catch(() => ({ data: { data: null } })),
        vatService.getDashboardSummary().catch(() => ({ data: { data: null } })),
      ]);

      setData({
        thresholdStatus: thresholdRes.data?.data || thresholdRes.data,
        dashboardSummary: summaryRes.data?.data || summaryRes.data,
      });
    } catch (err) {
      console.error('Failed to fetch VAT data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const threshold = data.thresholdStatus;
  const summary = data.dashboardSummary;

  const currentTurnover = threshold?.turnover?.rolling12Month || 0;
  const thresholdAmount = threshold?.threshold?.registrationAmount || 90000;
  const remainingAmount = threshold?.warning?.remainingUntilThreshold || thresholdAmount;
  const isExceeded = threshold?.warning?.level === 'exceeded';
  const progressPercent = Math.min((currentTurnover / thresholdAmount) * 100, 100);

  const vatBalance = summary?.vatBalance || 0;
  const isRefund = vatBalance < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('vat.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('vat.subtitle')}</p>
        </div>
        <Link
          to="/vat/return/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('vat.startReturn')}
        </Link>
      </div>

      {/* Threshold Status Card */}
      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isExceeded ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
            {isExceeded ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-white">{t('vat.thresholdStatus')}</h2>
        </div>

        <div className="space-y-3">
          <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isExceeded ? 'bg-red-500' : progressPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{formatCurrency(currentTurnover / 100)}</span>
            <span className="text-zinc-400">{formatCurrency(thresholdAmount / 100)}</span>
          </div>
          <p className={`text-sm ${isExceeded ? 'text-red-400' : 'text-zinc-300'}`}>
            {isExceeded
              ? t('vat.thresholdExceeded')
              : t('vat.thresholdRemaining', { amount: formatCurrency(remainingAmount / 100) })}
          </p>
        </div>
      </div>

      {/* VAT Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Output VAT */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">{t('vat.outputVat')}</h3>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(summary?.outputVat)}</p>
          <span className="text-xs text-zinc-500 mt-1">{t('vat.vatCollected')}</span>
        </div>

        {/* Input VAT */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">{t('vat.inputVat')}</h3>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(summary?.inputVat)}</p>
          <span className="text-xs text-zinc-500 mt-1">{t('vat.vatPaid')}</span>
        </div>

        {/* VAT Balance */}
        <div className={`bg-zinc-800/50 rounded-xl border p-6 ${isRefund ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRefund ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
              <Scale className={`w-5 h-5 ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">{t('vat.vatBalance')}</h3>
          </div>
          <p className={`text-2xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
            {formatCurrency(Math.abs(vatBalance))}
          </p>
          <span className="text-xs text-zinc-500 mt-1">
            {isRefund ? t('vat.refundDue') : t('vat.owedToHmrc')}
          </span>
        </div>
      </div>

      {/* Quick Actions & VAT Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('vat.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/vat/return/new"
              className="flex items-center gap-3 p-4 bg-zinc-900/50 hover:bg-zinc-700/50 rounded-lg border border-zinc-700 transition-colors"
            >
              <FileText className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-white">{t('vat.prepareReturn')}</span>
            </Link>
            <Link
              to="/vat/returns"
              className="flex items-center gap-3 p-4 bg-zinc-900/50 hover:bg-zinc-700/50 rounded-lg border border-zinc-700 transition-colors"
            >
              <ClipboardList className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-white">{t('vat.viewReturns')}</span>
            </Link>
            <Link
              to="/transactions?type=all&vatOnly=true"
              className="flex items-center gap-3 p-4 bg-zinc-900/50 hover:bg-zinc-700/50 rounded-lg border border-zinc-700 transition-colors"
            >
              <Search className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-white">{t('vat.reviewTransactions')}</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-3 p-4 bg-zinc-900/50 hover:bg-zinc-700/50 rounded-lg border border-zinc-700 transition-colors"
            >
              <Settings className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-white">{t('vat.vatSettings')}</span>
            </Link>
          </div>
        </div>

        {/* VAT Rates */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('vat.vatRates')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
              <span className="text-zinc-300">{t('vat.standardRate')}</span>
              <span className="text-emerald-400 font-semibold">20%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
              <span className="text-zinc-300">{t('vat.reducedRate')}</span>
              <span className="text-blue-400 font-semibold">5%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
              <span className="text-zinc-300">{t('vat.zeroRated')}</span>
              <span className="text-zinc-400 font-semibold">0%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VatDashboard;
