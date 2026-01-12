import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: '📊', label: t('nav.dashboard') },
    { path: '/transactions', icon: '💰', label: t('nav.transactions') },
    { path: '/invoices', icon: '📄', label: t('nav.invoices') },
    { path: '/customers', icon: '👥', label: t('nav.customers') },
    { path: '/suppliers', icon: '🏭', label: t('nav.suppliers') },
    { path: '/employees', icon: '👔', label: t('nav.employees') },
    { path: '/payroll', icon: '💵', label: t('nav.payroll') },
    { path: '/vat', icon: '🧾', label: t('nav.vat') },
    { path: '/reports', icon: '📈', label: t('nav.reports') },
    { path: '/bank', icon: '🏦', label: t('nav.bank') },
    { path: '/settings', icon: '⚙️', label: t('nav.settings') },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">UK Accounting</h1>
      </div>

      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="user-name">{user?.businessName || user?.email}</span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
