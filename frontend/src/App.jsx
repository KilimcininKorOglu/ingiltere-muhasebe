import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import HelpPanel from './components/help/HelpPanel';
import useHelp from './hooks/useHelp';

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
  const help = useHelp({ currentPage: 'dashboard' });

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('dashboard.title')}</h1>
        <nav className="app-nav">
          <LanguageSwitcher variant="buttons" />
          <button
            type="button"
            className="help-button"
            onClick={help.openHelp}
            aria-label={t('help:panel.title')}
            title={t('help:panel.openShortcut')}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
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

      <HelpPanel
        isOpen={help.isOpen}
        onClose={help.closeHelp}
        activeTab={help.activeTab}
        onTabChange={help.setActiveTab}
        searchQuery={help.searchQuery}
        searchResults={help.searchResults}
        onSearch={help.search}
        onClearSearch={help.clearSearch}
        pageHelpContent={help.pageHelpContent}
        quickTips={help.quickTips}
      />
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
