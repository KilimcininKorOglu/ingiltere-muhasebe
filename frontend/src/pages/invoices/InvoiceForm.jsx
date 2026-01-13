import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { invoiceService, customerService } from '../../services/api';
import { ArrowLeft, Plus, Trash2, Save, Calculator, Search, ChevronDown, Check } from 'lucide-react';

const InvoiceForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const selectedCustomer = customers.find((c) => c.id.toString() === formData.customerId);

  const handleCustomerSelect = (customer) => {
    setFormData((prev) => ({ ...prev, customerId: customer.id.toString() }));
    setCustomerSearch('');
    setCustomerDropdownOpen(false);
    setError('');
  };

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
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/invoices"
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? t('invoices.editInvoice') : t('invoices.createInvoice')}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isEdit ? t('invoices.editSubtitle') || 'Fatura bilgilerini duzenle' : t('invoices.createSubtitle') || 'Yeni fatura olustur'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Customer & Dates */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div ref={customerDropdownRef} className="relative">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('invoices.customer')}
              </label>
              <button
                type="button"
                onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-left text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 flex items-center justify-between"
              >
                <span className={selectedCustomer ? 'text-white' : 'text-zinc-500'}>
                  {selectedCustomer ? selectedCustomer.name : t('common.select')}
                </span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${customerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {customerDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-zinc-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder={t('customers.searchPlaceholder') || 'Musteri ara...'}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                        {t('customers.noResults') || 'Sonuc bulunamadi'}
                      </div>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => handleCustomerSelect(customer)}
                          className={`w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between ${
                            formData.customerId === customer.id.toString() ? 'bg-zinc-800' : ''
                          }`}
                        >
                          <div>
                            <div className="text-white font-medium">{customer.name}</div>
                            {customer.email && (
                              <div className="text-zinc-500 text-sm">{customer.email}</div>
                            )}
                          </div>
                          {formData.customerId === customer.id.toString() && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <input type="hidden" name="customerId" value={formData.customerId} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('invoices.issueDate')}
              </label>
              <input
                type="date"
                name="issueDate"
                value={formData.issueDate}
                onChange={handleChange}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('invoices.dueDate')}
              </label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('invoices.items')}</h3>

          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-2">
            <div className="col-span-5">{t('invoices.description')}</div>
            <div className="col-span-2">{t('invoices.quantity')}</div>
            <div className="col-span-2">{t('invoices.unitPrice')}</div>
            <div className="col-span-1">{t('invoices.vatRate')}</div>
            <div className="col-span-1 text-right">{t('invoices.lineTotal')}</div>
            <div className="col-span-1"></div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {formData.items.map((item, index) => (
              <div key={index} className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-4">
                {/* Mobile Layout */}
                <div className="md:hidden space-y-3">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder={t('invoices.itemDescription')}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{t('invoices.quantity')}</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        min="1"
                        step="1"
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{t('invoices.unitPrice')}</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{t('invoices.vatRate')}</label>
                      <select
                        value={item.vatRate}
                        onChange={(e) => handleItemChange(index, 'vatRate', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="20">20%</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50">
                    <span className="text-emerald-400 font-mono font-semibold">
                      £{calculateItemTotal(item).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder={t('invoices.itemDescription')}
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      min="1"
                      step="1"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">£</span>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    <select
                      value={item.vatRate}
                      onChange={(e) => handleItemChange(index, 'vatRate', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="20">20%</option>
                    </select>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-emerald-400 font-mono font-semibold">
                      £{calculateItemTotal(item).toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('invoices.addItem')}
          </button>
        </div>

        {/* Totals */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">{t('invoices.summary') || 'Ozet'}</h3>
          </div>
          <div className="space-y-3 max-w-xs ml-auto">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{t('invoices.subtotal')}</span>
              <span className="text-white font-mono">£{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{t('invoices.totalVat')}</span>
              <span className="text-white font-mono">£{totalVat.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-zinc-700">
              <span className="text-lg font-semibold text-white">{t('invoices.grandTotal')}</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">£{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            {t('invoices.notes')}
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder={t('invoices.notesPlaceholder')}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-6 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;
