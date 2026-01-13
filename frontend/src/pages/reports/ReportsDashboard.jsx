import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reportService } from '../../services/api';
import { BarChart3, TrendingUp, TrendingDown, Calendar, FileText, Users, Loader2, RefreshCw } from 'lucide-react';

const ReportsDashboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('profit-loss');
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, dateRange]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      let response;

      switch (activeReport) {
        case 'profit-loss':
          response = await reportService.getProfitLoss(dateRange);
          break;
        case 'paye-summary':
          response = await reportService.getPayeSummary(dateRange);
          break;
        default:
          response = await reportService.getProfitLoss(dateRange);
      }

      setReportData(response.data?.data || response.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setReportData(null);
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

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const reportTypes = [
    { id: 'profit-loss', label: t('reports.profitLoss'), icon: BarChart3 },
    { id: 'paye-summary', label: t('reports.payeSummary'), icon: Users },
  ];

  const inputClass = "w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('reports.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('reports.subtitle')}</p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Report Types */}
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-4">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
              {t('reports.reportTypes')}
            </h3>
            <div className="space-y-2">
              {reportTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setActiveReport(type.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeReport === type.id
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-900/50 text-zinc-300 hover:bg-zinc-700/50 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Filters */}
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                {t('reports.dateRange')}
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">{t('common.startDate')}</label>
                <input
                  type="date"
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={handleDateChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">{t('common.endDate')}</label>
                <input
                  type="date"
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={handleDateChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : !reportData ? (
            <div className="flex flex-col items-center justify-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <div className="w-16 h-16 rounded-full bg-zinc-700/50 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-zinc-400">{t('reports.noData')}</p>
            </div>
          ) : activeReport === 'profit-loss' ? (
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
              {/* Report Header */}
              <div className="p-6 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{t('reports.profitLoss')}</h2>
                    <p className="text-sm text-zinc-400">
                      {dateRange.startDate} - {dateRange.endDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div className="p-6 space-y-6">
                {/* Income Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                      {t('reports.income')}
                    </h3>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white">{t('reports.totalIncome')}</span>
                      <span className="text-emerald-400 font-semibold text-lg">
                        {formatCurrency(reportData.totalIncome)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expenses Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                      {t('reports.expenses')}
                    </h3>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white">{t('reports.totalExpenses')}</span>
                      <span className="text-red-400 font-semibold text-lg">
                        {formatCurrency(reportData.totalExpenses)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-zinc-700 pt-6 space-y-3">
                  <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                    <span className="text-zinc-300 font-medium">{t('reports.grossProfit')}</span>
                    <span className={`font-semibold text-lg ${reportData.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(reportData.grossProfit)}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between p-4 rounded-lg ${reportData.netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                    <span className={`font-semibold ${reportData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t('reports.netProfit')}
                    </span>
                    <span className={`font-bold text-xl ${reportData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(reportData.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
              {/* Report Header */}
              <div className="p-6 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{t('reports.payeSummary')}</h2>
                    <p className="text-sm text-zinc-400">
                      {dateRange.startDate} - {dateRange.endDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Report Body */}
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <span className="text-zinc-300">{t('reports.totalGrossPay')}</span>
                  <span className="text-white font-semibold">{formatCurrency(reportData.totalGrossPay)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <span className="text-zinc-300">{t('reports.totalIncomeTax')}</span>
                  <span className="text-red-400 font-semibold">{formatCurrency(reportData.totalIncomeTax)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <span className="text-zinc-300">{t('reports.totalEmployeeNI')}</span>
                  <span className="text-red-400 font-semibold">{formatCurrency(reportData.totalEmployeeNI)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
                  <span className="text-zinc-300">{t('reports.totalEmployerNI')}</span>
                  <span className="text-red-400 font-semibold">{formatCurrency(reportData.totalEmployerNI)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg mt-4">
                  <span className="text-red-400 font-semibold">{t('reports.totalPayeOwed')}</span>
                  <span className="text-red-400 font-bold text-xl">{formatCurrency(reportData.totalPayeOwed)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;
