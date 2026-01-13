import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supplierService } from '../../services/api';
import Header from '../../components/layout/Header';

const SupplierList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await supplierService.getAll();
      const data = response.data?.data?.suppliers || response.data?.data || response.data;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await supplierService.delete(id);
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <Header title={t('suppliers.title')}>
        <Link to="/suppliers/new" className="btn btn-primary">
          + {t('suppliers.addSupplier')}
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
      ) : filteredSuppliers.length === 0 ? (
        <div className="empty-state">
          <p>{t('suppliers.noSuppliers')}</p>
          <Link to="/suppliers/new" className="btn btn-primary">
            {t('suppliers.addFirst')}
          </Link>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('suppliers.name')}</th>
                <th>{t('suppliers.email')}</th>
                <th>{t('suppliers.phone')}</th>
                <th>{t('suppliers.vatNumber')}</th>
                <th>{t('suppliers.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td data-label={t('suppliers.name')}>{supplier.name}</td>
                  <td data-label={t('suppliers.email')}>{supplier.email || '-'}</td>
                  <td data-label={t('suppliers.phone')}>{supplier.phone || '-'}</td>
                  <td data-label={t('suppliers.vatNumber')}>{supplier.vatNumber || '-'}</td>
                  <td data-label={t('suppliers.status')}>
                    <span className={`badge ${supplier.status || 'active'}`}>
                      {t(`suppliers.${supplier.status || 'active'}`)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Link to={`/suppliers/${supplier.id}/edit`} className="btn btn-sm">
                        {t('common.edit')}
                      </Link>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(supplier.id)}
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

export default SupplierList;
