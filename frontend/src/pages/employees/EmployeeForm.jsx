import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { employeeService } from '../../services/api';
import { ArrowLeft, User, MapPin, Banknote, AlertCircle, Loader2 } from 'lucide-react';

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
        employeeNumber: emp.employeeNumber || '',
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

  const inputClass = "w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-zinc-300 mb-1.5";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/employees"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? t('employees.editEmployee') : t('employees.addEmployee')}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isEdit ? t('employees.editSubtitle') : t('employees.createSubtitle')}
          </p>
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
        {/* Personal Information */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('employees.personalInfo')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('employees.employeeNumber')} *</label>
              <input
                type="text"
                name="employeeNumber"
                value={formData.employeeNumber}
                onChange={handleChange}
                placeholder="EMP001"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.status')}</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="active">{t('employees.active')}</option>
                <option value="inactive">{t('employees.inactive')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('employees.firstName')} *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.lastName')} *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.phone')}</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.niNumber')} *</label>
              <input
                type="text"
                name="niNumber"
                value={formData.niNumber}
                onChange={handleChange}
                placeholder="AB123456C"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.taxCode')} *</label>
              <input
                type="text"
                name="taxCode"
                value={formData.taxCode}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.startDate')} *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
          </div>
        </div>

        {/* Salary Information */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('employees.salaryInfo')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('employees.salary')} (GBP) *</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('employees.payFrequency')}</label>
              <select
                name="payFrequency"
                value={formData.payFrequency}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="weekly">{t('employees.weekly')}</option>
                <option value="fortnightly">{t('employees.fortnightly')}</option>
                <option value="monthly">{t('employees.monthly')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('employees.address')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('employees.addressLine1')}</label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('employees.city')}</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('employees.postcode')}</label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/employees')}
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

export default EmployeeForm;
