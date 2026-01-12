import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { customerService } from '../../services/api';
import Header from '../../components/layout/Header';
import '../transactions/Transactions.css';

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
      <div className="page-container">
        <Header title={isEdit ? t('customers.editCustomer') : t('customers.addCustomer')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={isEdit ? t('customers.editCustomer') : t('customers.addCustomer')} />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label>{t('customers.name')} *</label>
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
              <label>{t('customers.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('customers.phone')}</label>
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
              <label>{t('customers.vatNumber')}</label>
              <input
                type="text"
                name="vatNumber"
                value={formData.vatNumber}
                onChange={handleChange}
                placeholder="GB123456789"
              />
            </div>

            <div className="form-group">
              <label>{t('customers.companyNumber')}</label>
              <input
                type="text"
                name="companyNumber"
                value={formData.companyNumber}
                onChange={handleChange}
              />
            </div>
          </div>

          <h3 className="form-section-title">{t('customers.address')}</h3>

          <div className="form-group">
            <label>{t('customers.addressLine1')}</label>
            <input
              type="text"
              name="addressLine1"
              value={formData.addressLine1}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>{t('customers.addressLine2')}</label>
            <input
              type="text"
              name="addressLine2"
              value={formData.addressLine2}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('customers.city')}</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('customers.county')}</label>
              <input
                type="text"
                name="county"
                value={formData.county}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('customers.postcode')}</label>
              <input
                type="text"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('customers.country')}</label>
              <input
                type="text"
                name="country"
                value={formData.country}
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
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/customers')}>
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

export default CustomerForm;
