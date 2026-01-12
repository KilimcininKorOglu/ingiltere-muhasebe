import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { employeeService } from '../../services/api';
import Header from '../../components/layout/Header';
import '../transactions/Transactions.css';

const EmployeeList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeService.getAll();
      setEmployees(response.data?.data || response.data || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await employeeService.delete(id);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      e.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  return (
    <div className="page-container">
      <Header title={t('employees.title')}>
        <Link to="/employees/new" className="btn btn-primary">
          + {t('employees.addEmployee')}
        </Link>
      </Header>

      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
          />
        </div>
        <div className="filter-group">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('employees.allStatuses')}</option>
            <option value="active">{t('employees.active')}</option>
            <option value="inactive">{t('employees.inactive')}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state">
          <p>{t('employees.noEmployees')}</p>
          <Link to="/employees/new" className="btn btn-primary">
            {t('employees.addFirst')}
          </Link>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('employees.name')}</th>
                <th>{t('employees.email')}</th>
                <th>{t('employees.niNumber')}</th>
                <th>{t('employees.taxCode')}</th>
                <th>{t('employees.salary')}</th>
                <th>{t('employees.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td>{`${emp.firstName} ${emp.lastName}`}</td>
                  <td>{emp.email || '-'}</td>
                  <td>{emp.niNumber || '-'}</td>
                  <td>{emp.taxCode || '-'}</td>
                  <td>{formatCurrency(emp.salary)}</td>
                  <td>
                    <span className={`badge ${emp.status || 'active'}`}>
                      {t(`employees.${emp.status || 'active'}`)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Link to={`/payroll/new?employeeId=${emp.id}`} className="btn btn-sm">
                        {t('payroll.runPayroll')}
                      </Link>
                      <Link to={`/employees/${emp.id}/edit`} className="btn btn-sm">
                        {t('common.edit')}
                      </Link>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(emp.id)}
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

export default EmployeeList;
