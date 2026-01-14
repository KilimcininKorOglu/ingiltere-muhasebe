import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { transactionService, categoryService, customerService, supplierService, bankAccountService } from '../../services/api';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Calculator
} from 'lucide-react';

const TransactionForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  const [formData, setFormData] = useState({
    type: 'expense',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    vatRate: '20',
    description: '',
    customerId: '',
    supplierId: '',
    paymentMethod: 'bank_transfer',
    reference: '',
    bankAccountId: '',
  });

  useEffect(() => {
    fetchFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const [catRes, custRes, suppRes, bankRes] = await Promise.all([
        categoryService.getAll(),
        customerService.getAll().catch(() => ({ data: { data: [] } })),
        supplierService.getAll().catch(() => ({ data: { data: [] } })),
        bankAccountService.getAll().catch(() => ({ data: { data: [] } })),
      ]);

      const catData = catRes.data?.data?.categories || catRes.data?.data || catRes.data;
      const custData = custRes.data?.data?.customers || custRes.data?.data || custRes.data;
      const suppData = suppRes.data?.data?.suppliers || suppRes.data?.data || suppRes.data;
      const bankData = bankRes.data?.data?.bankAccounts || bankRes.data?.data || bankRes.data;

      setCategories(Array.isArray(catData) ? catData : []);
      setCustomers(Array.isArray(custData) ? custData : []);
      setSuppliers(Array.isArray(suppData) ? suppData : []);
      setBankAccounts(Array.isArray(bankData) ? bankData : []);

      if (isEdit) {
        const txRes = await transactionService.getById(id);
        const tx = txRes.data?.data || txRes.data;
        setFormData({
          type: tx.type,
          categoryId: tx.categoryId?.toString() || '',
          date: (tx.transactionDate || tx.date)?.split('T')[0] || '',
          amount: tx.amount?.toString() || '',
          vatRate: tx.vatRate?.toString() || '20',
          description: tx.description || '',
          customerId: tx.customerId?.toString() || '',
          supplierId: tx.supplierId?.toString() || '',
          paymentMethod: tx.paymentMethod || 'bank_transfer',
          reference: tx.reference || '',
          bankAccountId: tx.bankAccountId?.toString() || '',
        });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        type: formData.type,
        categoryId: parseInt(formData.categoryId),
        transactionDate: formData.date,
        description: formData.description,
        amount: parseFloat(formData.amount),
        vatRate: parseFloat(formData.vatRate),
        paymentMethod: formData.paymentMethod,
        reference: formData.reference || null,
        payee: formData.supplierId ? null : null,
        notes: null,
      };

      if (formData.customerId) {
        payload.customerId = parseInt(formData.customerId);
      }
      if (formData.supplierId) {
        payload.supplierId = parseInt(formData.supplierId);
      }
      if (formData.bankAccountId) {
        payload.bankAccountId = parseInt(formData.bankAccountId);
      }

      if (isEdit) {
        await transactionService.update(id, payload);
      } else {
        await transactionService.create(payload);
      }

      navigate('/transactions');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  const vatAmount = (parseFloat(formData.amount) || 0) * (parseFloat(formData.vatRate) / 100);
  const totalAmount = (parseFloat(formData.amount) || 0) + vatAmount;

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
      <div className="flex items-center gap-4 pt-12 lg:pt-0">
        <Link
          to="/transactions"
          className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isEdit ? t('transactions.editTransaction') : t('transactions.addTransaction')}
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            {isEdit ? t('transactions.editDesc') : t('transactions.addDesc')}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full">
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <div className="glass-card p-6 space-y-6">
          {/* Type & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.type')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: 'income', categoryId: '' }))}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    formData.type === 'income'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-600'
                  }`}
                >
                  {t('transactions.income')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: 'expense', categoryId: '' }))}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    formData.type === 'expense'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-600'
                  }`}
                >
                  {t('transactions.expense')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('common.date')}
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.category')}
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                <option value="">{t('common.select')}</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code} - {cat.name || cat.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.paymentMethod')}
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="bank_transfer">{t('transactions.bankTransfer')}</option>
                <option value="cash">{t('transactions.cash')}</option>
                <option value="card">{t('transactions.card')}</option>
                <option value="cheque">{t('transactions.cheque')}</option>
                <option value="other">{t('transactions.other')}</option>
              </select>
            </div>
          </div>

          {/* Bank Account - show when payment method is bank_transfer */}
          {formData.paymentMethod === 'bank_transfer' && bankAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.bankAccount')}
              </label>
              <select
                name="bankAccountId"
                value={formData.bankAccountId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">{t('transactions.selectBankAccount')}</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.accountName} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              {t('transactions.description')}
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('transactions.descriptionPlaceholder')}
              required
              className="input-field w-full"
            />
          </div>

          {/* Amount & VAT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.amount')} (GBP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">£</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                  className="input-field w-full pl-8 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.vatRate')}
              </label>
              <select
                name="vatRate"
                value={formData.vatRate}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="0">0% - {t('vat.zeroRated')}</option>
                <option value="5">5% - {t('vat.reducedRate')}</option>
                <option value="20">20% - {t('vat.standardRate')}</option>
              </select>
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700">
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={16} className="text-emerald-500" />
              <span className="text-sm font-medium text-dark-300">{t('transactions.summary')}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">{t('transactions.netAmount')}</span>
                <span className="text-dark-300 font-mono">£{(parseFloat(formData.amount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">{t('transactions.vat')} ({formData.vatRate}%)</span>
                <span className="text-dark-300 font-mono">£{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-dark-700">
                <span className="text-white font-medium">{t('transactions.total')}</span>
                <span className={`font-mono font-bold ${
                  formData.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  £{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer/Supplier */}
          {formData.type === 'income' && customers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.customer')}
              </label>
              <select
                name="customerId"
                value={formData.customerId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">{t('common.none')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.type === 'expense' && suppliers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {t('transactions.supplier')}
              </label>
              <select
                name="supplierId"
                value={formData.supplierId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">{t('common.none')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              {t('transactions.reference')}
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder={t('transactions.referencePlaceholder')}
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
