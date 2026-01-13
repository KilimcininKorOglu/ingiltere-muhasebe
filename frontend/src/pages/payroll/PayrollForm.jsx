import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { payrollService, employeeService } from '../../services/api';
import { ArrowLeft, Calculator, User, Calendar, Banknote, AlertCircle, Loader2, Check } from 'lucide-react';

const PayrollForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [calculation, setCalculation] = useState(null);

  const [formData, setFormData] = useState({
    employeeId: searchParams.get('employeeId') || '',
    payPeriodStart: '',
    payPeriodEnd: '',
    grossPay: '',
    bonus: '0',
    deductions: '0',
  });

  useEffect(() => {
    fetchEmployees();
    setDefaultDates();
  }, []);

  const setDefaultDates = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFormData((prev) => ({
      ...prev,
      payPeriodStart: startOfMonth.toISOString().split('T')[0],
      payPeriodEnd: endOfMonth.toISOString().split('T')[0],
    }));
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getAll();
      const emps = response.data?.data || response.data || [];
      setEmployees(emps.filter((e) => e.status === 'active'));
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setCalculation(null);

    if (name === 'employeeId') {
      const emp = employees.find((e) => e.id.toString() === value);
      if (emp) {
        const annualSalary = (emp.annualSalary || emp.salary || 0) / 100;
        const monthlySalary = annualSalary / 12;
        setFormData((prev) => ({ ...prev, grossPay: monthlySalary.toFixed(2) }));
      }
    }
  };

  const handleCalculate = async () => {
    if (!formData.employeeId || !formData.grossPay) {
      setError(t('payroll.selectEmployeeAndGross'));
      return;
    }

    setCalculating(true);
    setError('');

    try {
      const response = await payrollService.calculate({
        employeeId: parseInt(formData.employeeId),
        grossPay: parseFloat(formData.grossPay) + parseFloat(formData.bonus || 0),
      });
      setCalculation(response.data?.data || response.data);
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!calculation) {
      setError(t('payroll.calculateFirst'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        employeeId: parseInt(formData.employeeId),
        payPeriodStart: formData.payPeriodStart,
        payPeriodEnd: formData.payPeriodEnd,
        payDate: formData.payPeriodEnd,
        grossPay: Math.round((parseFloat(formData.grossPay) + parseFloat(formData.bonus || 0)) * 100),
        bonus: Math.round(parseFloat(formData.bonus || 0) * 100),
        deductions: Math.round(parseFloat(formData.deductions || 0) * 100),
        incomeTax: calculation.incomeTax || 0,
        nationalInsurance: calculation.employeeNI || 0,
        employerNI: calculation.employerNI || 0,
        netPay: Math.round((calculation.netPay - parseFloat(formData.deductions || 0)) * 100),
        status: 'draft',
      };

      await payrollService.create(payload);
      navigate('/payroll');
    } catch (err) {
      setError(err.response?.data?.error?.message?.en || 'Failed to save payroll');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const selectedEmployee = employees.find((e) => e.id.toString() === formData.employeeId);

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
          to="/payroll"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('payroll.runPayroll')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('payroll.runPayrollSubtitle')}</p>
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
        {/* Employee Selection */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('payroll.employee')}</h2>
          </div>

          <div>
            <label className={labelClass}>{t('payroll.employee')} *</label>
            <select
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              className={inputClass}
              required
            >
              <option value="">{t('common.select')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} - {emp.taxCode}
                </option>
              ))}
            </select>
          </div>

          {selectedEmployee && (
            <div className="mt-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">{t('employees.taxCode')}</span>
                  <p className="text-white font-medium">{selectedEmployee.taxCode || '-'}</p>
                </div>
                <div>
                  <span className="text-zinc-500">{t('employees.niNumber')}</span>
                  <p className="text-white font-medium">{selectedEmployee.niNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-zinc-500">{t('employees.salary')}</span>
                  <p className="text-emerald-400 font-medium">
                    {formatCurrency((selectedEmployee.annualSalary || selectedEmployee.salary || 0) / 100)}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">{t('employees.payFrequency')}</span>
                  <p className="text-white font-medium">{t(`employees.${selectedEmployee.payFrequency || 'monthly'}`)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pay Period */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('payroll.payPeriod')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('payroll.periodStart')} *</label>
              <input
                type="date"
                name="payPeriodStart"
                value={formData.payPeriodStart}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('payroll.periodEnd')} *</label>
              <input
                type="date"
                name="payPeriodEnd"
                value={formData.payPeriodEnd}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
          </div>
        </div>

        {/* Pay Details */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('payroll.payDetails')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{t('payroll.grossPay')} (GBP) *</label>
              <input
                type="number"
                name="grossPay"
                value={formData.grossPay}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>{t('payroll.bonus')} (GBP)</label>
              <input
                type="number"
                name="bonus"
                value={formData.bonus}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('payroll.otherDeductions')} (GBP)</label>
              <input
                type="number"
                name="deductions"
                value={formData.deductions}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={calculating}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {calculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.calculating')}
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                {t('payroll.calculate')}
              </>
            )}
          </button>
        </div>

        {/* Calculation Result */}
        {calculation && (
          <div className="bg-zinc-800/50 rounded-xl border border-emerald-500/30 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">{t('payroll.calculationResult')}</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-300">{t('payroll.grossPay')}</span>
                <span className="text-white font-medium">{formatCurrency(calculation.grossPay)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-300">{t('payroll.incomeTax')}</span>
                <span className="text-red-400 font-medium">-{formatCurrency(calculation.incomeTax)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-300">{t('payroll.employeeNI')}</span>
                <span className="text-red-400 font-medium">-{formatCurrency(calculation.employeeNI)}</span>
              </div>
              {parseFloat(formData.deductions) > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                  <span className="text-zinc-300">{t('payroll.otherDeductions')}</span>
                  <span className="text-red-400 font-medium">-{formatCurrency(formData.deductions)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3 bg-emerald-500/10 rounded-lg px-4 -mx-4">
                <span className="text-emerald-400 font-semibold">{t('payroll.netPay')}</span>
                <span className="text-emerald-400 font-bold text-lg">
                  {formatCurrency(calculation.netPay - parseFloat(formData.deductions || 0))}
                </span>
              </div>
              <div className="pt-4 border-t border-zinc-700 mt-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-400">{t('payroll.employerNI')}</span>
                  <span className="text-zinc-300 font-medium">{formatCurrency(calculation.employerNI)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-400">{t('payroll.totalEmployerCost')}</span>
                  <span className="text-zinc-300 font-medium">{formatCurrency(calculation.grossPay + calculation.employerNI)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/payroll')}
            className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || !calculation}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? t('common.saving') : t('payroll.savePayroll')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PayrollForm;
