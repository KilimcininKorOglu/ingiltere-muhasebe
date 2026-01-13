import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { payrollService, employeeService } from '../../services/api';
import Header from '../../components/layout/Header';

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

  if (loading) {
    return (
      <div className="page-container">
        <Header title={t('payroll.runPayroll')} />
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Header title={t('payroll.runPayroll')} />

      <div className="form-container payroll-form-container">
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label>{t('payroll.employee')} *</label>
            <select name="employeeId" value={formData.employeeId} onChange={handleChange} required>
              <option value="">{t('common.select')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} - {emp.taxCode}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('payroll.periodStart')} *</label>
              <input
                type="date"
                name="payPeriodStart"
                value={formData.payPeriodStart}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('payroll.periodEnd')} *</label>
              <input
                type="date"
                name="payPeriodEnd"
                value={formData.payPeriodEnd}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('payroll.grossPay')} (GBP) *</label>
              <input
                type="number"
                name="grossPay"
                value={formData.grossPay}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>{t('payroll.bonus')} (GBP)</label>
              <input
                type="number"
                name="bonus"
                value={formData.bonus}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t('payroll.otherDeductions')} (GBP)</label>
            <input
              type="number"
              name="deductions"
              value={formData.deductions}
              onChange={handleChange}
              step="0.01"
              min="0"
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary calculate-btn"
            onClick={handleCalculate}
            disabled={calculating}
          >
            {calculating ? t('common.calculating') : t('payroll.calculate')}
          </button>

          {calculation && (
            <div className="payroll-calculation">
              <h3>{t('payroll.calculationResult')}</h3>
              <div className="calc-grid">
                <div className="calc-item">
                  <span>{t('payroll.grossPay')}</span>
                  <span>{formatCurrency(calculation.grossPay)}</span>
                </div>
                <div className="calc-item deduction">
                  <span>{t('payroll.incomeTax')}</span>
                  <span>-{formatCurrency(calculation.incomeTax)}</span>
                </div>
                <div className="calc-item deduction">
                  <span>{t('payroll.employeeNI')}</span>
                  <span>-{formatCurrency(calculation.employeeNI)}</span>
                </div>
                {parseFloat(formData.deductions) > 0 && (
                  <div className="calc-item deduction">
                    <span>{t('payroll.otherDeductions')}</span>
                    <span>-{formatCurrency(formData.deductions)}</span>
                  </div>
                )}
                <div className="calc-item net-pay">
                  <span>{t('payroll.netPay')}</span>
                  <span>{formatCurrency(calculation.netPay - parseFloat(formData.deductions || 0))}</span>
                </div>
                <div className="calc-item employer-cost">
                  <span>{t('payroll.employerNI')}</span>
                  <span>{formatCurrency(calculation.employerNI)}</span>
                </div>
                <div className="calc-item employer-cost">
                  <span>{t('payroll.totalEmployerCost')}</span>
                  <span>{formatCurrency(calculation.grossPay + calculation.employerNI)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/payroll')}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !calculation}>
              {saving ? t('common.saving') : t('payroll.savePayroll')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayrollForm;
