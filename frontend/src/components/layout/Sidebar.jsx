import { useState, useEffect, createContext, useContext } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Users,
  Factory,
  UserCircle,
  Wallet,
  Calculator,
  BarChart3,
  Landmark,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Globe
} from 'lucide-react';

export const SidebarContext = createContext({ collapsed: false, setCollapsed: () => {} });

export const useSidebar = () => useContext(SidebarContext);

const Sidebar = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'tr' : 'en');
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/transactions', icon: Receipt, label: t('nav.transactions') },
    { path: '/invoices', icon: FileText, label: t('nav.invoices') },
    { path: '/customers', icon: Users, label: t('nav.customers') },
    { path: '/suppliers', icon: Factory, label: t('nav.suppliers') },
    { path: '/employees', icon: UserCircle, label: t('nav.employees') },
    { path: '/payroll', icon: Wallet, label: t('nav.payroll') },
    { path: '/vat', icon: Calculator, label: t('nav.vat') },
    { path: '/reports', icon: BarChart3, label: t('nav.reports') },
    { path: '/bank', icon: Landmark, label: t('nav.bank') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-dark-800 border border-dark-600 text-dark-300 lg:hidden hover:bg-dark-700 hover:text-white transition-colors"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          flex flex-col
          bg-dark-900 border-r border-dark-700/50
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-dark-700/50 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-lg">£</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm tracking-tight">UK Accounting</span>
              <span className="text-dark-500 text-xs">Finance Manager</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `
                      group flex items-center gap-3 px-3 py-2.5 rounded-xl
                      transition-all duration-200
                      ${isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-dark-400 hover:text-white hover:bg-dark-800 border border-transparent'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      size={20}
                      className="flex-shrink-0 transition-transform group-hover:scale-110"
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-dark-700/50 space-y-2">
          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className={`
              flex items-center gap-3 w-full px-3 py-2 rounded-xl
              text-dark-400 hover:text-white hover:bg-dark-800
              transition-colors
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? (i18n.language === 'en' ? 'Turkce' : 'English') : undefined}
          >
            <Globe size={18} />
            {!collapsed && (
              <span className="text-sm">{i18n.language === 'en' ? 'TR' : 'EN'}</span>
            )}
          </button>

          {/* User info */}
          {!collapsed && user && (
            <div className="px-3 py-2 rounded-xl bg-dark-800/50">
              <p className="text-xs text-dark-500 truncate">
                {user.businessName || user.email}
              </p>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 w-full px-3 py-2 rounded-xl
              text-dark-400 hover:text-red-400 hover:bg-red-500/10
              transition-colors
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? t('auth.logout') : undefined}
          >
            <LogOut size={18} />
            {!collapsed && (
              <span className="text-sm">{t('auth.logout')}</span>
            )}
          </button>

          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full py-2 rounded-xl text-dark-500 hover:text-white hover:bg-dark-800 transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
