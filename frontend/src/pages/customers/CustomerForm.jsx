import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { customerService } from '../../services/api';
import { ArrowLeft, Save, Building2, MapPin } from 'lucide-react';

const CustomerForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    vatNumber: '',
    companyNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    notes: '',
  });

  useEffect(() => {
    if (isEdit) {
      fetchCustomer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const response = await customerService.getById(id);
      const customer = response.data?.data || response.data;
      setFormData({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        vatNumber: customer.vatNumber || '',
        companyNumber: customer.companyNumber || '',
        addressLine1: customer.address?.line1 || '',
        addressLine2: customer.address?.line2 || '',
        city: customer.address?.city || '',
        county: customer.address?.county || '',
        postcode: customer.address?.postcode || '',
        country: customer.address?.country || 'United Kingdom',
        notes: customer.notes || '',
      });
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to load customer');
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
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        vatNumber: formData.vatNumber || null,
        companyNumber: formData.companyNumber || null,
        address: {
          line1: formData.addressLine1,
          line2: formData.addressLine2 || null,
          city: formData.city,
          county: formData.county || null,
          postcode: formData.postcode,
          country: formData.country,
        },
        notes: formData.notes || null,
      };

      if (isEdit) {
        await customerService.update(id, payload);
      } else {
        await customerService.create(payload);
      }

      navigate('/customers');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

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
          to="/customers"
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? t('customers.editCustomer') : t('customers.addCustomer')}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isEdit ? t('customers.editSubtitle') : t('customers.createSubtitle')}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">{t('customers.basicInfo')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.name')} *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.phone')}
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.vatNumber')}
              </label>
              <input
                type="text"
                name="vatNumber"
                value={formData.vatNumber}
                onChange={handleChange}
                placeholder="GB123456789"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.companyNumber')}
              </label>
              <input
                type="text"
                name="companyNumber"
                value={formData.companyNumber}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">{t('customers.address')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.addressLine1')}
              </label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.addressLine2')}
              </label>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.city')}
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.county')}
              </label>
              <input
                type="text"
                name="county"
                value={formData.county}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.postcode')}
              </label>
              <input
                type="text"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('customers.country')}
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            {t('common.notes')}
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="px-6 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;
