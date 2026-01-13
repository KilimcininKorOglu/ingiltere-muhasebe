import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supplierService } from '../../services/api';
import { Plus, Search, Pencil, Trash2, Truck, Mail, Phone, MapPin } from 'lucide-react';

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

  const getStatusStyle = (status) => {
    return status === 'active'
      ? 'bg-emerald-500/20 text-emerald-400'
      : 'bg-zinc-600 text-zinc-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('suppliers.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('suppliers.subtitle')}</p>
        </div>
        <Link
          to="/suppliers/new"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('suppliers.addSupplier')}
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
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-12 text-center">
          <Truck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">{t('suppliers.noSuppliers')}</p>
          <Link
            to="/suppliers/new"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('suppliers.addFirst')}
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/50">
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('suppliers.name')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('suppliers.email')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('suppliers.phone')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('suppliers.vatNumber')}</th>
                  <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('suppliers.status')}</th>
                  <th className="text-right text-xs font-medium text-zinc-400 uppercase tracking-wider px-6 py-4">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-zinc-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <Truck className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-white font-medium">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">{supplier.email || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300">{supplier.phone || supplier.phoneNumber || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300 font-mono text-sm">{supplier.vatNumber || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(supplier.status || 'active')}`}>
                        {t(`suppliers.${supplier.status || 'active'}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/suppliers/${supplier.id}/edit`}
                          className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(supplier.id)}
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
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Truck className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{supplier.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(supplier.status || 'active')}`}>
                        {t(`suppliers.${supplier.status || 'active'}`)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/suppliers/${supplier.id}/edit`}
                      className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Mail className="w-4 h-4" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  {(supplier.phone || supplier.phoneNumber) && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone className="w-4 h-4" />
                      <span>{supplier.phone || supplier.phoneNumber}</span>
                    </div>
                  )}
                  {supplier.city && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MapPin className="w-4 h-4" />
                      <span>{supplier.city}, {supplier.postcode || ''}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Results count */}
          <div className="text-center text-sm text-zinc-500">
            {filteredSuppliers.length} {t('common.results')}
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierList;
