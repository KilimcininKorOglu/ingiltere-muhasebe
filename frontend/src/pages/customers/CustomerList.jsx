import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { customerService } from '../../services/api';
import Header from '../../components/layout/Header';
import '../transactions/Transactions.css';

const CustomerList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerService.getAll();
      const data = response.data?.data?.customers || response.data?.data || response.data;
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await customerService.delete(id);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <Header title={t('customers.title')}>
        <Link to="/customers/new" className="btn btn-primary">
          + {t('customers.addCustomer')}
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
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <p>{t('customers.noCustomers')}</p>
          <Link to="/customers/new" className="btn btn-primary">
            {t('customers.addFirst')}
          </Link>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('customers.name')}</th>
                <th>{t('customers.email')}</th>
                <th>{t('customers.phone')}</th>
                <th>{t('customers.vatNumber')}</th>
                <th>{t('customers.address')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email || '-'}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>{customer.vatNumber || '-'}</td>
                  <td>{customer.address ? `${customer.address.city || ''}, ${customer.address.postcode || ''}` : '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <Link to={`/customers/${customer.id}/edit`} className="btn btn-sm">
                        {t('common.edit')}
                      </Link>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(customer.id)}
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

export default CustomerList;
