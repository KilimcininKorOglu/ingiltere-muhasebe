import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { vatService } from '../../services/api';
import Header from '../../components/layout/Header';

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
      <div className="page-container">
        <Header title={t('vat.title')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const threshold = data.thresholdStatus;
  const summary = data.dashboardSummary;

  // Extract values from API response
  const currentTurnover = threshold?.turnover?.rolling12Month || 0;
  const thresholdAmount = threshold?.threshold?.registrationAmount || 90000;
  const remainingAmount = threshold?.warning?.remainingUntilThreshold || thresholdAmount;
  const isExceeded = threshold?.warning?.level === 'exceeded';

  return (
    <div className="page-container">
      <Header title={t('vat.title')}>
        <Link to="/vat/return/new" className="btn btn-primary">
          {t('vat.startReturn')}
        </Link>
      </Header>

      <div className="vat-dashboard">
        <div className="vat-cards">
          <div className="vat-card threshold">
            <h3>{t('vat.thresholdStatus')}</h3>
            <div className="threshold-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min((currentTurnover / thresholdAmount) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="threshold-values">
                <span>{formatCurrency(currentTurnover / 100)}</span>
                <span>{formatCurrency(thresholdAmount / 100)}</span>
              </div>
            </div>
            <p className="threshold-status">
              {isExceeded 
                ? t('vat.thresholdExceeded')
                : t('vat.thresholdRemaining', { amount: formatCurrency(remainingAmount / 100) })}
            </p>
          </div>

          <div className="vat-card output">
            <h3>{t('vat.outputVat')}</h3>
            <p className="vat-amount">{formatCurrency(summary?.outputVat)}</p>
            <span className="vat-label">{t('vat.vatCollected')}</span>
          </div>

          <div className="vat-card input">
            <h3>{t('vat.inputVat')}</h3>
            <p className="vat-amount">{formatCurrency(summary?.inputVat)}</p>
            <span className="vat-label">{t('vat.vatPaid')}</span>
          </div>

          <div className={`vat-card balance ${(summary?.vatBalance || 0) >= 0 ? 'owed' : 'refund'}`}>
            <h3>{t('vat.vatBalance')}</h3>
            <p className="vat-amount">{formatCurrency(Math.abs(summary?.vatBalance))}</p>
            <span className="vat-label">
              {(summary?.vatBalance || 0) >= 0 ? t('vat.owedToHmrc') : t('vat.refundDue')}
            </span>
          </div>
        </div>

        <div className="vat-sections">
          <section className="vat-section">
            <h3>{t('vat.quickActions')}</h3>
            <div className="vat-actions">
              <Link to="/vat/return/new" className="vat-action-btn">
                <span className="action-icon">📝</span>
                <span>{t('vat.prepareReturn')}</span>
              </Link>
              <Link to="/vat/returns" className="vat-action-btn">
                <span className="action-icon">📋</span>
                <span>{t('vat.viewReturns')}</span>
              </Link>
              <Link to="/transactions?type=all&vatOnly=true" className="vat-action-btn">
                <span className="action-icon">🔍</span>
                <span>{t('vat.reviewTransactions')}</span>
              </Link>
              <Link to="/settings" className="vat-action-btn">
                <span className="action-icon">⚙️</span>
                <span>{t('vat.vatSettings')}</span>
              </Link>
            </div>
          </section>

          <section className="vat-section">
            <h3>{t('vat.vatRates')}</h3>
            <div className="vat-rates-info">
              <div className="rate-item">
                <span className="rate-label">{t('vat.standardRate')}</span>
                <span className="rate-value">20%</span>
              </div>
              <div className="rate-item">
                <span className="rate-label">{t('vat.reducedRate')}</span>
                <span className="rate-value">5%</span>
              </div>
              <div className="rate-item">
                <span className="rate-label">{t('vat.zeroRated')}</span>
                <span className="rate-value">0%</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default VatDashboard;
