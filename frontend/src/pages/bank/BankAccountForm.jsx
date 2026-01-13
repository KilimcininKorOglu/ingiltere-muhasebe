import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { bankAccountService } from '../../services/api';
import { ArrowLeft, Building2, CreditCard, Wallet, Loader2, AlertCircle } from 'lucide-react';

const BankAccountForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    sortCode: '',
    accountType: 'current',
    balance: '0',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.bankName || !formData.accountName || !formData.accountNumber || !formData.sortCode) {
      setError(t('bank.fillRequired'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      await bankAccountService.create({
        ...formData,
        balance: Math.round(parseFloat(formData.balance || 0) * 100),
      });
      navigate('/bank');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || err.response?.data?.error?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-zinc-300 mb-1.5";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/bank"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('bank.addAccount')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('bank.addAccountSubtitle')}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bank Details */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('bank.bankDetails')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('bank.bankName')} *</label>
              <input
                type="text"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                placeholder="e.g. Barclays, HSBC, Lloyds"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('bank.accountName')} *</label>
              <input
                type="text"
                name="accountName"
                value={formData.accountName}
                onChange={handleChange}
                placeholder="e.g. Business Current Account"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('bank.sortCode')} *</label>
              <input
                type="text"
                name="sortCode"
                value={formData.sortCode}
                onChange={handleChange}
                placeholder="XX-XX-XX"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('bank.accountNumber')} *</label>
              <input
                type="text"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleChange}
                placeholder="8 digit account number"
                className={inputClass}
                required
              />
            </div>
          </div>
        </div>

        {/* Account Type */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('bank.accountType')}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, accountType: 'current' }))}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                formData.accountType === 'current'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">{t('bank.current')}</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, accountType: 'savings' }))}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                formData.accountType === 'savings'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="font-medium">{t('bank.savings')}</span>
            </button>
          </div>
        </div>

        {/* Opening Balance */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 font-bold">£</span>
            </div>
            <h2 className="text-lg font-semibold text-white">{t('bank.openingBalance')}</h2>
          </div>

          <div>
            <label className={labelClass}>{t('bank.balance')} (GBP)</label>
            <input
              type="number"
              name="balance"
              value={formData.balance}
              onChange={handleChange}
              step="0.01"
              className={inputClass}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/bank')}
            className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BankAccountForm;
