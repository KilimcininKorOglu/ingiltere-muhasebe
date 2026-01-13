import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeService } from '../../services/api';
import Header from '../../components/layout/Header';

const EmployeeForm = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    niNumber: '',
    taxCode: '1257L',
    startDate: '',
    salary: '',
    payFrequency: 'monthly',
    status: 'active',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
  });

  useEffect(() => {
    if (isEdit) {
      fetchEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const response = await employeeService.getById(id);
      const emp = response.data?.data || response.data;
      setFormData({
        firstName: emp.firstName || '',
        lastName: emp.lastName || '',
        email: emp.email || '',
        phone: emp.phone || '',
        niNumber: emp.niNumber || '',
        taxCode: emp.taxCode || '1257L',
        startDate: emp.startDate?.split('T')[0] || '',
        salary: emp.salary?.toString() || '',
        payFrequency: emp.payFrequency || 'monthly',
        status: emp.status || 'active',
        addressLine1: emp.address?.line1 || '',
        addressLine2: emp.address?.line2 || '',
        city: emp.address?.city || '',
        postcode: emp.address?.postcode || '',
      });
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to load employee');
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
        employeeNumber: formData.employeeNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || null,
        phone: formData.phone || null,
        niNumber: formData.niNumber || null,
        taxCode: formData.taxCode,
        startDate: formData.startDate,
        annualSalary: Math.round(parseFloat(formData.salary) * 100),
        payFrequency: formData.payFrequency,
        status: formData.status,
        address: formData.addressLine1 || null,
        city: formData.city || null,
        postcode: formData.postcode || null,
      };

      if (isEdit) {
        await employeeService.update(id, payload);
      } else {
        await employeeService.create(payload);
      }

      navigate('/employees');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Header title={isEdit ? t('employees.editEmployee') : t('employees.addEmployee')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={isEdit ? t('employees.editEmployee') : t('employees.addEmployee')} />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>{t('employees.employeeNumber')} *</label>
              <input
                type="text"
                name="employeeNumber"
                value={formData.employeeNumber}
                onChange={handleChange}
                placeholder="EMP001"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('employees.firstName')} *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('employees.lastName')} *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('employees.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('employees.phone')}</label>
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
              <label>{t('employees.niNumber')} *</label>
              <input
                type="text"
                name="niNumber"
                value={formData.niNumber}
                onChange={handleChange}
                placeholder="AB123456C"
                required
              />
            </div>

            <div className="form-group">
              <label>{t('employees.taxCode')} *</label>
              <input
                type="text"
                name="taxCode"
                value={formData.taxCode}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('employees.startDate')} *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('employees.status')}</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="active">{t('employees.active')}</option>
                <option value="inactive">{t('employees.inactive')}</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('employees.salary')} (GBP) *</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>{t('employees.payFrequency')}</label>
              <select name="payFrequency" value={formData.payFrequency} onChange={handleChange}>
                <option value="weekly">{t('employees.weekly')}</option>
                <option value="fortnightly">{t('employees.fortnightly')}</option>
                <option value="monthly">{t('employees.monthly')}</option>
              </select>
            </div>
          </div>

          <h3 className="form-section-title">{t('employees.address')}</h3>

          <div className="form-group">
            <label>{t('employees.addressLine1')}</label>
            <input
              type="text"
              name="addressLine1"
              value={formData.addressLine1}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('employees.city')}</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>{t('employees.postcode')}</label>
              <input
                type="text"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>
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

export default EmployeeForm;
