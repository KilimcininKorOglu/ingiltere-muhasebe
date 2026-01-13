import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reportService } from '../../services/api';
import Header from '../../components/layout/Header';

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
    { id: 'profit-loss', label: t('reports.profitLoss') },
    { id: 'paye-summary', label: t('reports.payeSummary') },
  ];

  return (
    <div className="page-container">
      <Header title={t('reports.title')} />

      <div className="reports-container">
        <div className="reports-sidebar">
          <h3>{t('reports.reportTypes')}</h3>
          <ul className="report-type-list">
            {reportTypes.map((type) => (
              <li key={type.id}>
                <button
                  className={`report-type-btn ${activeReport === type.id ? 'active' : ''}`}
                  onClick={() => setActiveReport(type.id)}
                >
                  {type.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="date-filters">
            <h4>{t('reports.dateRange')}</h4>
            <div className="filter-group">
              <label>{t('common.startDate')}</label>
              <input
                type="date"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateChange}
              />
            </div>
            <div className="filter-group">
              <label>{t('common.endDate')}</label>
              <input
                type="date"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateChange}
              />
            </div>
          </div>
        </div>

        <div className="report-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
            </div>
          ) : !reportData ? (
            <div className="empty-state">
              <p>{t('reports.noData')}</p>
            </div>
          ) : activeReport === 'profit-loss' ? (
            <div className="report-view">
              <h2>{t('reports.profitLoss')}</h2>
              <p className="report-period">
                {dateRange.startDate} - {dateRange.endDate}
              </p>

              <div className="report-section">
                <h3>{t('reports.income')}</h3>
                <div className="report-row total">
                  <span>{t('reports.totalIncome')}</span>
                  <span className="text-success">{formatCurrency(reportData.totalIncome)}</span>
                </div>
              </div>

              <div className="report-section">
                <h3>{t('reports.expenses')}</h3>
                <div className="report-row total">
                  <span>{t('reports.totalExpenses')}</span>
                  <span className="text-danger">{formatCurrency(reportData.totalExpenses)}</span>
                </div>
              </div>

              <div className="report-section summary">
                <div className="report-row grand-total">
                  <span>{t('reports.grossProfit')}</span>
                  <span className={reportData.grossProfit >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(reportData.grossProfit)}
                  </span>
                </div>
                <div className="report-row grand-total">
                  <span>{t('reports.netProfit')}</span>
                  <span className={reportData.netProfit >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(reportData.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="report-view">
              <h2>{t('reports.payeSummary')}</h2>
              <p className="report-period">
                {dateRange.startDate} - {dateRange.endDate}
              </p>

              <div className="report-section">
                <div className="report-row">
                  <span>{t('reports.totalGrossPay')}</span>
                  <span>{formatCurrency(reportData.totalGrossPay)}</span>
                </div>
                <div className="report-row">
                  <span>{t('reports.totalIncomeTax')}</span>
                  <span className="text-danger">{formatCurrency(reportData.totalIncomeTax)}</span>
                </div>
                <div className="report-row">
                  <span>{t('reports.totalEmployeeNI')}</span>
                  <span className="text-danger">{formatCurrency(reportData.totalEmployeeNI)}</span>
                </div>
                <div className="report-row">
                  <span>{t('reports.totalEmployerNI')}</span>
                  <span className="text-danger">{formatCurrency(reportData.totalEmployerNI)}</span>
                </div>
                <div className="report-row grand-total">
                  <span>{t('reports.totalPayeOwed')}</span>
                  <span className="text-danger">{formatCurrency(reportData.totalPayeOwed)}</span>
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
