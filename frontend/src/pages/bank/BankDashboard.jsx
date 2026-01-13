import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { bankAccountService, bankTransactionService } from '../../services/api';
import Header from '../../components/layout/Header';

const BankDashboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await bankAccountService.getAll();
      const data = response.data?.data || response.data || {};
      setAccounts(data.bankAccounts || []);
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await bankAccountService.delete(id);
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  return (
    <div className="page-container">
      <Header title={t('bank.title')}>
        <Link to="/bank/accounts/new" className="btn btn-primary">
          + {t('bank.addAccount')}
        </Link>
      </Header>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          <div className="bank-summary">
            <div className="bank-total-card">
              <h3>{t('bank.totalBalance')}</h3>
              <p className={`balance ${totalBalance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(totalBalance)}
              </p>
              <span>{accounts.length} {t('bank.accounts')}</span>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-state">
              <p>{t('bank.noAccounts')}</p>
              <Link to="/bank/accounts/new" className="btn btn-primary">
                {t('bank.addFirst')}
              </Link>
            </div>
          ) : (
            <div className="bank-accounts-grid">
              {accounts.map((account) => (
                <div key={account.id} className="bank-account-card">
                  <div className="account-header">
                    <h3>{account.bankName}</h3>
                    <span className={`account-type ${account.accountType}`}>
                      {t(`bank.${account.accountType}`)}
                    </span>
                  </div>
                  <p className="account-name">{account.accountName}</p>
                  <p className="account-number">
                    {account.sortCode} / {account.accountNumber}
                  </p>
                  <p className={`account-balance ${account.balance >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(account.balance)}
                  </p>
                  <div className="account-actions">
                    <Link to={`/bank/accounts/${account.id}/transactions`} className="btn btn-sm">
                      {t('bank.viewTransactions')}
                    </Link>
                    <Link to={`/bank/accounts/${account.id}/reconcile`} className="btn btn-sm">
                      {t('bank.reconcile')}
                    </Link>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(account.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BankDashboard;
