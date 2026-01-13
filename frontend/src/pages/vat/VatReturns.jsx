import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { vatService } from '../../services/api';
import Header from '../../components/layout/Header';
import '../transactions/Transactions.css';
import './Vat.css';

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
      // API returns { data: { vatReturns: [] } }
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

  const getStatusClass = (status) => {
    switch (status) {
      case 'submitted': return 'status-success';
      case 'draft': return 'status-warning';
      case 'overdue': return 'status-danger';
      default: return 'status-default';
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
      <div className="page-container">
        <Header title={t('vat.returns')}>
          <Link to="/vat/return/new" className="btn btn-primary">
            {t('vat.newReturn')}
          </Link>
        </Header>
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={t('vat.returns')}>
        <Link to="/vat/return/new" className="btn btn-primary">
          {t('vat.newReturn')}
        </Link>
      </Header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={fetchReturns}>{t('common.retry')}</button>
        </div>
      )}

      {returns.length === 0 ? (
        <div className="empty-state">
          <p>{t('vat.noReturns')}</p>
          <Link to="/vat/return/new" className="btn btn-primary">
            {t('vat.createFirstReturn')}
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('vat.period')}</th>
                <th>{t('vat.outputVat')}</th>
                <th>{t('vat.inputVat')}</th>
                <th>{t('vat.netVat')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((vatReturn) => (
                <tr key={vatReturn.id}>
                  <td data-label={t('vat.period')}>
                    {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
                  </td>
                  <td data-label={t('vat.outputVat')}>{formatCurrency(vatReturn.box1)}</td>
                  <td data-label={t('vat.inputVat')}>{formatCurrency(vatReturn.box4)}</td>
                  <td data-label={t('vat.netVat')}>{formatCurrency(vatReturn.box5)}</td>
                  <td data-label={t('common.status')}>
                    <span className={`status-badge ${getStatusClass(vatReturn.status)}`}>
                      {getStatusLabel(vatReturn.status)}
                    </span>
                  </td>
                  <td data-label={t('common.actions')}>
                    <div className="action-buttons">
                      <Link to={`/vat/returns/${vatReturn.id}`} className="btn-link">
                        {t('common.view')}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VatReturns;
