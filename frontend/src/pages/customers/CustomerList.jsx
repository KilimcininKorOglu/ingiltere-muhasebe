import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { customerService } from '../../services/api';
import { Plus, Search, Pencil, Trash2, Users, Mail, Phone, Building2, MapPin } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('customers.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('customers.subtitle') || 'Musteri kayitlarini yonetin'}</p>
        </div>
        <Link
          to="/customers/new"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('customers.addCustomer')}
        </Link>
      </div>

      {/* Search */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">{t('customers.noCustomers')}</p>
          <Link
            to="/customers/new"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('customers.addFirst')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/50">
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('customers.name')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('customers.email')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('customers.phone')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('customers.vatNumber')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('customers.address')}</th>
                  <th className="text-right text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-zinc-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-white font-medium">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300 font-mono text-sm">{customer.vatNumber || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300">
                      {customer.address ? `${customer.address.city || ''}, ${customer.address.postcode || ''}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/customers/${customer.id}/edit`}
                          className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{customer.name}</h3>
                      {customer.vatNumber && (
                        <span className="text-xs text-zinc-500 font-mono">{customer.vatNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/customers/${customer.id}/edit`}
                      className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {customer.email && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Mail className="w-4 h-4" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address?.city && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MapPin className="w-4 h-4" />
                      <span>{customer.address.city}, {customer.address.postcode || ''}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Results count */}
          <div className="text-center text-sm text-zinc-500">
            {filteredCustomers.length} {t('common.results')}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerList;
