import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { payrollService, employeeService } from '../../services/api';
import Header from '../../components/layout/Header';
import '../transactions/Transactions.css';
import './Payroll.css';

const PayrollList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    employeeId: '',
    status: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPayrolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchData = async () => {
    try {
      const empRes = await employeeService.getAll();
      const empData = empRes.data?.data?.employees || empRes.data?.data || empRes.data;
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
    }
  };

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      );
      const response = await payrollService.getAll(params);
      const data = response.data?.data?.payrolls || response.data?.data || response.data;
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch payrolls:', err);
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await payrollService.delete(id);
      fetchPayrolls();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    return dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  };

  return (
    <div className="page-container">
      <Header title={t('payroll.title')}>
        <Link to="/payroll/new" className="btn btn-primary">
          + {t('payroll.runPayroll')}
        </Link>
      </Header>

      <div className="filters-bar">
        <div className="filter-group">
          <select name="employeeId" value={filters.employeeId} onChange={handleFilterChange}>
            <option value="">{t('payroll.allEmployees')}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">{t('payroll.allStatuses')}</option>
            <option value="draft">{t('payroll.draft')}</option>
            <option value="approved">{t('payroll.approved')}</option>
            <option value="paid">{t('payroll.paid')}</option>
          </select>
        </div>

        <div className="filter-group">
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state">
          <p>{t('payroll.noPayrolls')}</p>
          <Link to="/payroll/new" className="btn btn-primary">
            {t('payroll.runFirst')}
          </Link>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payroll.employee')}</th>
                <th>{t('payroll.payPeriod')}</th>
                <th>{t('payroll.grossPay')}</th>
                <th>{t('payroll.incomeTax')}</th>
                <th>{t('payroll.nationalInsurance')}</th>
                <th>{t('payroll.netPay')}</th>
                <th>{t('payroll.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((pr) => (
                <tr key={pr.id}>
                  <td>{pr.employee?.firstName} {pr.employee?.lastName}</td>
                  <td>{formatDate(pr.payPeriodStart)} - {formatDate(pr.payPeriodEnd)}</td>
                  <td>{formatCurrency(pr.grossPay)}</td>
                  <td className="text-danger">{formatCurrency(pr.incomeTax)}</td>
                  <td className="text-danger">{formatCurrency(pr.nationalInsurance)}</td>
                  <td className="text-success">{formatCurrency(pr.netPay)}</td>
                  <td>
                    <span className={`badge ${pr.status}`}>
                      {t(`payroll.${pr.status}`)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Link to={`/payroll/${pr.id}`} className="btn btn-sm">
                        {t('common.view')}
                      </Link>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(pr.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PayrollList;
