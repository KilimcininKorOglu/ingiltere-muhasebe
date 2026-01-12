import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { transactionService, categoryService, customerService, supplierService } from '../../services/api';
import Header from '../../components/layout/Header';
import './Transactions.css';

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
  });

  useEffect(() => {
    fetchFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const [catRes, custRes, suppRes] = await Promise.all([
        categoryService.getAll(),
        customerService.getAll().catch(() => ({ data: { data: [] } })),
        supplierService.getAll().catch(() => ({ data: { data: [] } })),
      ]);

      setCategories(catRes.data?.data || catRes.data || []);
      setCustomers(custRes.data?.data || custRes.data || []);
      setSuppliers(suppRes.data?.data || suppRes.data || []);

      if (isEdit) {
        const txRes = await transactionService.getById(id);
        const tx = txRes.data?.data || txRes.data;
        setFormData({
          type: tx.type,
          categoryId: tx.categoryId?.toString() || '',
          date: tx.date?.split('T')[0] || '',
          amount: tx.amount?.toString() || '',
          vatRate: tx.vatRate?.toString() || '20',
          description: tx.description || '',
          customerId: tx.customerId?.toString() || '',
          supplierId: tx.supplierId?.toString() || '',
          paymentMethod: tx.paymentMethod || 'bank_transfer',
          reference: tx.reference || '',
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
        ...formData,
        amount: parseFloat(formData.amount),
        vatRate: parseFloat(formData.vatRate),
        categoryId: parseInt(formData.categoryId),
        customerId: formData.customerId ? parseInt(formData.customerId) : null,
        supplierId: formData.supplierId ? parseInt(formData.supplierId) : null,
      };

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
      <div className="page-container">
        <Header title={isEdit ? t('transactions.editTransaction') : t('transactions.addTransaction')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={isEdit ? t('transactions.editTransaction') : t('transactions.addTransaction')} />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>{t('transactions.type')}</label>
              <select name="type" value={formData.type} onChange={handleChange} required>
                <option value="income">{t('transactions.income')}</option>
                <option value="expense">{t('transactions.expense')}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{t('common.date')}</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('transactions.category')}</label>
              <select name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                <option value="">{t('common.select')}</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code} - {cat.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t('transactions.paymentMethod')}</label>
              <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                <option value="bank_transfer">{t('transactions.bankTransfer')}</option>
                <option value="cash">{t('transactions.cash')}</option>
                <option value="card">{t('transactions.card')}</option>
                <option value="cheque">{t('transactions.cheque')}</option>
                <option value="other">{t('transactions.other')}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{t('transactions.description')}</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('transactions.descriptionPlaceholder')}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('transactions.amount')} (GBP)</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group">
              <label>{t('transactions.vatRate')}</label>
              <select name="vatRate" value={formData.vatRate} onChange={handleChange}>
                <option value="0">0% - {t('vat.zeroRated')}</option>
                <option value="5">5% - {t('vat.reducedRate')}</option>
                <option value="20">20% - {t('vat.standardRate')}</option>
              </select>
            </div>
          </div>

          <div className="calculation-summary">
            <div className="calc-row">
              <span>{t('transactions.netAmount')}:</span>
              <span>£{(parseFloat(formData.amount) || 0).toFixed(2)}</span>
            </div>
            <div className="calc-row">
              <span>{t('transactions.vat')} ({formData.vatRate}%):</span>
              <span>£{vatAmount.toFixed(2)}</span>
            </div>
            <div className="calc-row total">
              <span>{t('transactions.total')}:</span>
              <span>£{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {formData.type === 'income' && (
            <div className="form-group">
              <label>{t('transactions.customer')}</label>
              <select name="customerId" value={formData.customerId} onChange={handleChange}>
                <option value="">{t('common.none')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.type === 'expense' && (
            <div className="form-group">
              <label>{t('transactions.supplier')}</label>
              <select name="supplierId" value={formData.supplierId} onChange={handleChange}>
                <option value="">{t('common.none')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>{t('transactions.reference')}</label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder={t('transactions.referencePlaceholder')}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/transactions')}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
