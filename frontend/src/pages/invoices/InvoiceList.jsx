import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { invoiceService } from '../../services/api';
import Header from '../../components/layout/Header';
import '../transactions/Transactions.css';
import './Invoices.css';

const InvoiceList = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
      };
      const response = await invoiceService.getAll(params);
      const data = response.data?.data || response.data;
      const invList = data?.invoices || data;
      setInvoices(Array.isArray(invList) ? invList : []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await invoiceService.updateStatus(id, status);
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.error?.message?.en || 'Status update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await invoiceService.delete(id);
      fetchInvoices();
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
    return dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  };

  return (
    <div className="page-container">
      <Header title={t('invoices.title')}>
        <Link to="/invoices/new" className="btn btn-primary">
          + {t('invoices.createInvoice')}
        </Link>
      </Header>

      <div className="filters-bar">
        <div className="filter-group">
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">{t('invoices.allStatuses')}</option>
            <option value="draft">{t('invoices.draft')}</option>
            <option value="sent">{t('invoices.sent')}</option>
            <option value="paid">{t('invoices.paid')}</option>
            <option value="overdue">{t('invoices.overdue')}</option>
            <option value="cancelled">{t('invoices.cancelled')}</option>
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
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <p>{t('invoices.noInvoices')}</p>
          <Link to="/invoices/new" className="btn btn-primary">
            {t('invoices.createFirst')}
          </Link>
        </div>
      ) : (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('invoices.invoiceNumber')}</th>
                  <th>{t('invoices.customer')}</th>
                  <th>{t('invoices.issueDate')}</th>
                  <th>{t('invoices.dueDate')}</th>
                  <th>{t('invoices.status')}</th>
                  <th>{t('invoices.amount')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`} className="invoice-link">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td>{inv.customer?.name || '-'}</td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td>
                      <span className={`badge ${inv.status}`}>
                        {t(`invoices.${inv.status}`)}
                      </span>
                    </td>
                    <td>{formatCurrency(inv.totalAmount)}</td>
                    <td>
                      <div className="action-buttons">
                        {inv.status === 'draft' && (
                          <button
                            className="btn btn-sm"
                            onClick={() => handleStatusChange(inv.id, 'sent')}
                          >
                            {t('invoices.send')}
                          </button>
                        )}
                        {inv.status === 'sent' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleStatusChange(inv.id, 'paid')}
                          >
                            {t('invoices.markPaid')}
                          </button>
                        )}
                        <Link to={`/invoices/${inv.id}/edit`} className="btn btn-sm">
                          {t('common.edit')}
                        </Link>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(inv.id)}
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

export default InvoiceList;
