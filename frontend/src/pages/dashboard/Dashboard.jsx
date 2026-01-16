import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/api';
import {
  TrendingUp,
  TrendingDown,
  PoundSterling,
  Receipt,
  Plus,
  FileText,
  BarChart3,
  Calculator,
  AlertTriangle,
  Info,
  XCircle,
  ArrowRight,
  RefreshCw,
  Loader2
} from 'lucide-react';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    summary: null,
    recentActivity: [],
    alerts: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, activityRes, alertsRes] = await Promise.all([
        dashboardService.getSummary().catch(() => ({ data: { data: null } })),
        dashboardService.getRecentActivity().catch(() => ({ data: { data: [] } })),
        dashboardService.getAlerts().catch(() => ({ data: { data: [] } })),
      ]);

      const summaryData = summaryRes.data?.data || summaryRes.data || null;
      const activityData = activityRes.data?.data || activityRes.data;
      const alertsData = alertsRes.data?.data || alertsRes.data;

      const mappedSummary = summaryData ? {
        totalIncome: summaryData.overview?.currentMonth?.income || 0,
        totalExpenses: summaryData.overview?.currentMonth?.expenses || 0,
        netProfit: summaryData.overview?.currentMonth?.netCashFlow || 0,
        vatOwed: summaryData.vatStatus?.vatOwed || 0,
      } : null;

      const recentTransactions = summaryData?.recentActivity?.transactions || [];
      const alertsList = summaryData?.alerts || (Array.isArray(alertsData) ? alertsData : []);

      setData({
        summary: mappedSummary,
        recentActivity: recentTransactions,
        alerts: alertsList,
      });
      setError(null);
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const statCards = [
    {
      key: 'income',
      label: t('dashboard.totalRevenue'),
      value: data.summary?.totalIncome,
      icon: TrendingUp,
      color: 'emerald',
      gradient: 'from-emerald-500/20 to-emerald-600/10',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      key: 'expenses',
      label: t('dashboard.totalExpenses'),
      value: data.summary?.totalExpenses,
      icon: TrendingDown,
      color: 'red',
      gradient: 'from-red-500/20 to-red-600/10',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
    },
    {
      key: 'profit',
      label: t('dashboard.netProfit'),
      value: data.summary?.netProfit,
      icon: PoundSterling,
      color: 'blue',
      gradient: 'from-blue-500/20 to-blue-600/10',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      key: 'vat',
      label: t('dashboard.vatOwed'),
      value: data.summary?.vatOwed,
      icon: Receipt,
      color: 'amber',
      gradient: 'from-amber-500/20 to-amber-600/10',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
  ];

  const quickActions = [
    { path: '/transactions/new', icon: Plus, label: t('transactions.addTransaction'), color: 'emerald' },
    { path: '/invoices/new', icon: FileText, label: t('invoices.createInvoice'), color: 'blue' },
    { path: '/reports', icon: BarChart3, label: t('reports.viewReports'), color: 'purple' },
    { path: '/vat', icon: Calculator, label: t('vat.vatReturn'), color: 'amber' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-dark-400 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-12 lg:pt-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            {new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="btn-secondary flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw size={16} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <XCircle size={20} />
          <span className="flex-1">{error}</span>
          <button onClick={fetchDashboardData} className="text-sm underline hover:no-underline">
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className={`
                glass-card p-5
                bg-gradient-to-br ${stat.gradient}
                animate-slide-up
              `}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-dark-400 text-sm font-medium mb-2">{stat.label}</p>
                  <p className="stat-value text-2xl text-white">
                    {formatCurrency(stat.value)}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-5">
        <h2 className="text-white font-semibold mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className={`
                  group flex items-center gap-3 p-4 rounded-xl
                  bg-dark-800/50 border border-dark-700
                  hover:border-emerald-500/30 hover:bg-dark-800
                  transition-all duration-200
                `}
              >
                <div className={`
                  p-2 rounded-lg
                  ${action.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                    action.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                    action.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-amber-500/20 text-amber-400'}
                  group-hover:scale-110 transition-transform
                `}>
                  <Icon size={18} />
                </div>
                <span className="text-sm text-dark-300 group-hover:text-white transition-colors">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Alerts Section */}
        <div className="glass-card p-5 xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{t('dashboard.alerts')}</h2>
            {data.alerts.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
                {data.alerts.length}
              </span>
            )}
          </div>
          
          {(!data.alerts || data.alerts.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <Info className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-dark-400 text-sm">{t('dashboard.noAlerts')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.alerts.slice(0, 5).map((alert, index) => (
                <li
                  key={index}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg
                    ${alert.type === 'warning' ? 'bg-amber-500/10' : 
                      alert.type === 'error' ? 'bg-red-500/10' : 'bg-blue-500/10'}
                  `}
                >
                  {alert.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : alert.type === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${
                    alert.type === 'warning' ? 'text-amber-300' :
                    alert.type === 'error' ? 'text-red-300' : 'text-blue-300'
                  }`}>
                    {typeof alert.message === 'object'
                      ? (alert.message[i18n.language] || alert.message.en || '')
                      : alert.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="glass-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{t('dashboard.recentTransactions')}</h2>
            <Link
              to="/transactions"
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {t('common.viewAll')}
              <ArrowRight size={14} />
            </Link>
          </div>

          {(!data.recentActivity || data.recentActivity.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center mb-3">
                <Receipt className="w-6 h-6 text-dark-500" />
              </div>
              <p className="text-dark-400 text-sm">{t('dashboard.noTransactions')}</p>
              <Link
                to="/transactions/new"
                className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
              >
                {t('transactions.addTransaction')}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop Table */}
              <table className="w-full hidden sm:table">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left text-xs text-dark-500 font-medium py-2 px-2">
                      {t('common.description')}
                    </th>
                    <th className="text-left text-xs text-dark-500 font-medium py-2 px-2">
                      {t('common.date')}
                    </th>
                    <th className="text-right text-xs text-dark-500 font-medium py-2 px-2">
                      {t('common.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.slice(0, 5).map((item, index) => (
                    <tr key={index} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                      <td className="py-3 px-2">
                        <span className="text-sm text-dark-300">{item.description}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-dark-500">{item.date}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`stat-value text-sm ${
                          item.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-2">
                {data.recentActivity.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-300 truncate">{item.description}</p>
                      <p className="text-xs text-dark-500">{item.date}</p>
                    </div>
                    <span className={`stat-value text-sm ml-3 ${
                      item.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
