import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { dashboardService, transactionService, invoiceService } from '../../services/api';
import Header from '../../components/layout/Header';
import './Dashboard.css';

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

      // Map API response to expected format
      const mappedSummary = summaryData ? {
        totalIncome: summaryData.overview?.currentMonth?.income || 0,
        totalExpenses: summaryData.overview?.currentMonth?.expenses || 0,
        netProfit: summaryData.overview?.currentMonth?.netCashFlow || 0,
        vatOwed: summaryData.vatStatus?.vatOwed || 0,
      } : null;

      // Get recent transactions from recentActivity
      const recentTransactions = summaryData?.recentActivity?.transactions || [];

      // Get alerts from summaryData or alertsData
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
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="page-container">
        <Header title={t('dashboard.title')} />
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={t('dashboard.title')} />

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={fetchDashboardData}>{t('common.retry')}</button>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="stat-card income">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{t('dashboard.totalRevenue')}</h3>
            <p className="stat-value">{formatCurrency(data.summary?.totalIncome)}</p>
          </div>
        </div>

        <div className="stat-card expense">
          <div className="stat-icon">📉</div>
          <div className="stat-content">
            <h3>{t('dashboard.totalExpenses')}</h3>
            <p className="stat-value">{formatCurrency(data.summary?.totalExpenses)}</p>
          </div>
        </div>

        <div className="stat-card profit">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>{t('dashboard.netProfit')}</h3>
            <p className="stat-value">{formatCurrency(data.summary?.netProfit)}</p>
          </div>
        </div>

        <div className="stat-card vat">
          <div className="stat-icon">🧾</div>
          <div className="stat-content">
            <h3>{t('dashboard.vatOwed')}</h3>
            <p className="stat-value">{formatCurrency(data.summary?.vatOwed)}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.alerts')}</h2>
          </div>
          <div className="section-content">
            {(!data.alerts || data.alerts.length === 0) ? (
              <p className="empty-state">{t('dashboard.noAlerts')}</p>
            ) : (
              <ul className="alert-list">
                {data.alerts.map((alert, index) => (
                  <li key={index} className={`alert-item ${alert.type}`}>
                    <span className="alert-icon">
                      {alert.type === 'warning' ? '⚠️' : alert.type === 'error' ? '❌' : 'ℹ️'}
                    </span>
                    <span className="alert-message">
                      {typeof alert.message === 'object' 
                        ? (alert.message[i18n.language] || alert.message.en || '') 
                        : alert.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.recentTransactions')}</h2>
            <Link to="/transactions" className="section-link">
              {t('common.viewAll')}
            </Link>
          </div>
          <div className="section-content">
            {(!data.recentActivity || data.recentActivity.length === 0) ? (
              <p className="empty-state">{t('dashboard.noTransactions')}</p>
            ) : (
              <ul className="activity-list">
                {data.recentActivity.slice(0, 5).map((item, index) => (
                  <li key={index} className="activity-item">
                    <div className="activity-info">
                      <span className="activity-description">{item.description}</span>
                      <span className="activity-date">{item.date}</span>
                    </div>
                    <span className={`activity-amount ${item.type}`}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-header">
            <h2>{t('dashboard.quickActions')}</h2>
          </div>
          <div className="quick-actions">
            <Link to="/transactions/new" className="quick-action">
              <span className="action-icon">➕</span>
              <span>{t('transactions.addTransaction')}</span>
            </Link>
            <Link to="/invoices/new" className="quick-action">
              <span className="action-icon">📄</span>
              <span>{t('invoices.createInvoice')}</span>
            </Link>
            <Link to="/reports" className="quick-action">
              <span className="action-icon">📊</span>
              <span>{t('reports.viewReports')}</span>
            </Link>
            <Link to="/vat" className="quick-action">
              <span className="action-icon">🧾</span>
              <span>{t('vat.vatReturn')}</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
