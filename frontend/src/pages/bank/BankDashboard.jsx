import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { bankAccountService } from '../../services/api';
import { Building2, Plus, CreditCard, Wallet, ArrowRight, Trash2, Loader2, Landmark, Pencil } from 'lucide-react';

const BankDashboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [deleting, setDeleting] = useState(null);

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
      setDeleting(id);
      await bankAccountService.delete(id);
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const formatCurrency = (amountInPence, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format((amountInPence || 0) / 100);
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  const getAccountIcon = (type) => {
    switch (type) {
      case 'current':
        return CreditCard;
      case 'savings':
        return Wallet;
      default:
        return Landmark;
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
          <h1 className="text-2xl font-bold text-white">{t('bank.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('bank.subtitle')}</p>
        </div>
        <Link
          to="/bank/accounts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('bank.addAccount')}
        </Link>
      </div>

      {/* Total Balance Card */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-xl border border-emerald-500/30 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/30 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-zinc-400">{t('bank.totalBalance')}</p>
            <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              {accounts.length} {t('bank.accounts')}
            </p>
          </div>
        </div>
      </div>

      {/* Accounts */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-700">
          <div className="w-16 h-16 rounded-full bg-zinc-700/50 flex items-center justify-center mb-4">
            <Landmark className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-zinc-400 mb-4">{t('bank.noAccounts')}</p>
          <Link
            to="/bank/accounts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('bank.addFirst')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const AccountIcon = getAccountIcon(account.accountType);
            return (
              <div key={account.id} className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-5 hover:border-zinc-600 transition-colors">
                {/* Account Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <AccountIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{account.bankName}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        account.accountType === 'current' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {t(`bank.${account.accountType}`)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account Details */}
                <div className="space-y-2 mb-4">
                  <p className="text-zinc-300">{account.accountName}</p>
                  <p className="text-sm text-zinc-500 font-mono">
                    {account.sortCode} / {account.accountNumber}
                  </p>
                </div>

                {/* Balance */}
                <div className="mb-4 p-3 bg-zinc-900/50 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">{t('bank.balance')} ({account.currency || 'GBP'})</p>
                  <p className={`text-xl font-bold ${account.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(account.currentBalance, account.currency || 'GBP')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    to={`/bank/accounts/${account.id}/transactions`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
                  >
                    {t('bank.viewTransactions')}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    to={`/bank/accounts/${account.id}/edit`}
                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={deleting === account.id}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting === account.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BankDashboard;
