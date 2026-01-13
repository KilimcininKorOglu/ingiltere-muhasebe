import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { supplierService } from '../../services/api';
import Header from '../../components/layout/Header';

const SupplierForm = () => {
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
    paymentTerms: 'net30',
    notes: '',
  });

  useEffect(() => {
    if (isEdit) {
      fetchSupplier();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const response = await supplierService.getById(id);
      const supplier = response.data?.data || response.data;
      setFormData({
        name: supplier.name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        vatNumber: supplier.vatNumber || '',
        companyNumber: supplier.companyNumber || '',
        addressLine1: supplier.address?.line1 || '',
        addressLine2: supplier.address?.line2 || '',
        city: supplier.address?.city || '',
        county: supplier.address?.county || '',
        postcode: supplier.address?.postcode || '',
        country: supplier.address?.country || 'United Kingdom',
        paymentTerms: supplier.paymentTerms?.toString() || '30',
        notes: supplier.notes || '',
      });
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to load supplier');
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
        phoneNumber: formData.phone || null,
        vatNumber: formData.vatNumber || null,
        companyNumber: formData.companyNumber || null,
        paymentTerms: formData.paymentTerms,
        address: formData.addressLine1 ? `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}` : null,
        city: formData.city || null,
        postcode: formData.postcode || null,
        country: formData.country || 'United Kingdom',
        notes: formData.notes || null,
      };

      if (isEdit) {
        await supplierService.update(id, payload);
      } else {
        await supplierService.create(payload);
      }

      navigate('/suppliers');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Header title={isEdit ? t('suppliers.editSupplier') : t('suppliers.addSupplier')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={isEdit ? t('suppliers.editSupplier') : t('suppliers.addSupplier')} />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label>{t('suppliers.name')} *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('suppliers.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('suppliers.phone')}</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('suppliers.vatNumber')}</label>
              <input
                type="text"
                name="vatNumber"
                value={formData.vatNumber}
                onChange={handleChange}
                placeholder="GB123456789"
              />
            </div>

            <div className="form-group">
              <label>{t('suppliers.paymentTerms')}</label>
              <select
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
              >
                <option value="immediate">Immediate</option>
                <option value="net7">7 {t('common.days')}</option>
                <option value="net14">14 {t('common.days')}</option>
                <option value="net30">30 {t('common.days')}</option>
                <option value="net60">60 {t('common.days')}</option>
                <option value="net90">90 {t('common.days')}</option>
              </select>
            </div>
          </div>

          <h3 className="form-section-title">{t('suppliers.address')}</h3>

          <div className="form-group">
            <label>{t('suppliers.addressLine1')}</label>
            <input
              type="text"
              name="addressLine1"
              value={formData.addressLine1}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>{t('suppliers.addressLine2')}</label>
            <input
              type="text"
              name="addressLine2"
              value={formData.addressLine2}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('suppliers.city')}</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('suppliers.postcode')}</label>
              <input
                type="text"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t('common.notes')}</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/suppliers')}>
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

export default SupplierForm;
