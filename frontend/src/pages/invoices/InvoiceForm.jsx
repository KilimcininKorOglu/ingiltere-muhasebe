import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { invoiceService, customerService } from '../../services/api';
import Header from '../../components/layout/Header';

const InvoiceForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);

  const [formData, setFormData] = useState({
    customerId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, vatRate: 20 }],
  });

  useEffect(() => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    setFormData((prev) => ({
      ...prev,
      dueDate: dueDate.toISOString().split('T')[0],
    }));
    fetchFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const custRes = await customerService.getAll().catch(() => ({ data: { data: [] } }));
      const custData = custRes.data?.data?.customers || custRes.data?.data || custRes.data;
      setCustomers(Array.isArray(custData) ? custData : []);

      if (isEdit) {
        const invRes = await invoiceService.getById(id);
        const inv = invRes.data?.data || invRes.data;
        setFormData({
          customerId: inv.customerId?.toString() || '',
          issueDate: inv.issueDate?.split('T')[0] || '',
          dueDate: inv.dueDate?.split('T')[0] || '',
          notes: inv.notes || '',
          items: inv.items?.length > 0 ? inv.items : [{ description: '', quantity: 1, unitPrice: 0, vatRate: 20 }],
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

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, vatRate: 20 }],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        customerId: parseInt(formData.customerId),
        invoiceDate: formData.issueDate,
        dueDate: formData.dueDate,
        notes: formData.notes || null,
        items: formData.items.map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: Math.round(parseFloat(item.unitPrice) * 100),
          vatRate: parseFloat(item.vatRate),
        })),
      };

      if (isEdit) {
        await invoiceService.update(id, payload);
      } else {
        await invoiceService.create(payload);
      }

      navigate('/invoices');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const calculateItemTotal = (item) => {
    const net = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
    const vat = net * ((parseFloat(item.vatRate) || 0) / 100);
    return net + vat;
  };

  const subtotal = formData.items.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
    0
  );

  const totalVat = formData.items.reduce(
    (sum, item) =>
      sum +
      (parseFloat(item.quantity) || 0) *
        (parseFloat(item.unitPrice) || 0) *
        ((parseFloat(item.vatRate) || 0) / 100),
    0
  );

  const grandTotal = subtotal + totalVat;

  if (loading) {
    return (
      <div className="page-container">
        <Header title={isEdit ? t('invoices.editInvoice') : t('invoices.createInvoice')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={isEdit ? t('invoices.editInvoice') : t('invoices.createInvoice')} />

      <div className="form-container invoice-form-container">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>{t('invoices.customer')}</label>
              <select name="customerId" value={formData.customerId} onChange={handleChange} required>
                <option value="">{t('common.select')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('invoices.issueDate')}</label>
              <input
                type="date"
                name="issueDate"
                value={formData.issueDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('invoices.dueDate')}</label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="invoice-items-section">
            <h3>{t('invoices.items')}</h3>
            
            <div className="invoice-items-header">
              <span>{t('invoices.description')}</span>
              <span>{t('invoices.quantity')}</span>
              <span>{t('invoices.unitPrice')}</span>
              <span>{t('invoices.vatRate')}</span>
              <span>{t('invoices.lineTotal')}</span>
              <span></span>
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className="invoice-item-row">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  placeholder={t('invoices.itemDescription')}
                  required
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  min="1"
                  step="1"
                  required
                />
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
                <select
                  value={item.vatRate}
                  onChange={(e) => handleItemChange(index, 'vatRate', e.target.value)}
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="20">20%</option>
                </select>
                <span className="item-total">£{calculateItemTotal(item).toFixed(2)}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => removeItem(index)}
                  disabled={formData.items.length === 1}
                >
                  X
                </button>
              </div>
            ))}

            <button type="button" className="btn btn-secondary" onClick={addItem}>
              + {t('invoices.addItem')}
            </button>
          </div>

          <div className="invoice-totals">
            <div className="total-row">
              <span>{t('invoices.subtotal')}:</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span>{t('invoices.totalVat')}:</span>
              <span>£{totalVat.toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span>{t('invoices.grandTotal')}:</span>
              <span>£{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="form-group">
            <label>{t('invoices.notes')}</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder={t('invoices.notesPlaceholder')}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/invoices')}>
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

export default InvoiceForm;
