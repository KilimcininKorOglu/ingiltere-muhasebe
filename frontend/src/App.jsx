import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';

// Import i18n configuration (must be imported before using translations)
import './i18n';

/**
 * Loading fallback component for Suspense
 */
const LoadingFallback = () => (
  <div className="loading-fallback">
    <div className="loading-spinner" aria-label="Loading...">
      Loading...
    </div>
  </div>
);

/**
 * Main App Content component
 * This is separated to ensure translations are loaded before rendering
 */
const AppContent = () => {
  const { t } = useTranslation();

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('dashboard.title')}</h1>
        <nav className="app-nav">
          <LanguageSwitcher variant="buttons" />
        </nav>
      </header>

      <main className="app-main">
        <section className="welcome-section">
          <h2>{t('dashboard.welcome', { name: 'User' })}</h2>
          <p>{t('settings.languageDescription')}</p>
        </section>

        <section className="demo-section">
          <h3>{t('dashboard.recentTransactions')}</h3>
          <ul>
            <li>{t('dashboard.totalRevenue')}</li>
            <li>{t('dashboard.totalExpenses')}</li>
            <li>{t('dashboard.netProfit')}</li>
          </ul>
        </section>

        <section className="actions-section">
          <h3>{t('common.loading')}</h3>
          <div className="button-group">
            <button type="button">{t('common.save')}</button>
            <button type="button">{t('common.cancel')}</button>
            <button type="button">{t('common.delete')}</button>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <LanguageSwitcher variant="dropdown" />
      </footer>
    </div>
  );
};

/**
 * App Component
 * Root component that wraps the application with Suspense for i18n loading
 */
const App = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AppContent />
    </Suspense>
  );
};

export default App;
