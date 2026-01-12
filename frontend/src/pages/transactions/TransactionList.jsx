import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { transactionService, categoryService } from '../../services/api';
import Header from '../../components/layout/Header';
import './Transactions.css';

const TransactionList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    type: '',
    categoryId: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters]);

  const fetchCategories = async () => {
    try {
      const response = await categoryService.getAll();
      const data = response.data?.data?.categories || response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategories([]);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
      };
      const response = await transactionService.getAll(params);
      const data = response.data?.data || response.data;
      const txList = data?.transactions || data;
      setTransactions(Array.isArray(txList) ? txList : []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await transactionService.delete(id);
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Delete failed');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    <div className="page-container">
      <Header title={t('transactions.title')}>
        <Link to="/transactions/new" className="btn btn-primary">
          + {t('transactions.addTransaction')}
        </Link>
      </Header>

      <div className="filters-bar">
        <div className="filter-group">
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
          >
            <option value="">{t('transactions.allTypes')}</option>
            <option value="income">{t('transactions.income')}</option>
            <option value="expense">{t('transactions.expense')}</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            name="categoryId"
            value={filters.categoryId}
            onChange={handleFilterChange}
          >
            <option value="">{t('transactions.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name || cat.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            placeholder={t('common.startDate')}
          />
        </div>

        <div className="filter-group">
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            placeholder={t('common.endDate')}
          />
        </div>

        <div className="filter-group">
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder={t('common.search')}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>{t('transactions.noTransactions')}</p>
          <Link to="/transactions/new" className="btn btn-primary">
            {t('transactions.addFirst')}
          </Link>
        </div>
      ) : (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('transactions.description')}</th>
                  <th>{t('transactions.category')}</th>
                  <th>{t('transactions.type')}</th>
                  <th>{t('transactions.amount')}</th>
                  <th>{t('transactions.vat')}</th>
                  <th>{t('transactions.total')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.date)}</td>
                    <td>{tx.description}</td>
                    <td>{tx.category?.name || tx.category?.nameEn || '-'}</td>
                    <td>
                      <span className={`badge ${tx.type}`}>
                        {t(`transactions.${tx.type}`)}
                      </span>
                    </td>
                    <td>{formatCurrency(tx.amount)}</td>
                    <td>{tx.vatRate}%</td>
                    <td className={tx.type === 'income' ? 'text-success' : 'text-danger'}>
                      {formatCurrency(tx.totalAmount)}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <Link to={`/transactions/${tx.id}/edit`} className="btn btn-sm">
                          {t('common.edit')}
                        </Link>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(tx.id)}
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

          <div className="pagination">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              {t('common.previous')}
            </button>
            <span>
              {t('common.page')} {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              {t('common.next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionList;
