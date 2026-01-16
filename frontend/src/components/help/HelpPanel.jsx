import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import HelpSearch from './HelpSearch';
import PageHelp from './PageHelp';
import QuickTips from './QuickTips';

/**
 * HelpPanel Component
 * 
 * A slide-out panel that provides context-aware help content.
 * Features tabbed navigation, search functionality, and keyboard shortcuts.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {Function} props.onClose - Callback to close the panel
 * @param {string} props.activeTab - Currently active tab
 * @param {Function} props.onTabChange - Callback when tab changes
 * @param {string} props.searchQuery - Current search query
 * @param {Array} props.searchResults - Search results
 * @param {Function} props.onSearch - Callback when search query changes
 * @param {Function} props.onClearSearch - Callback to clear search
 * @param {Object|null} props.pageHelpContent - Page-specific help content
 * @param {Array} props.quickTips - Quick tips array
 * @param {string} [props.className] - Additional CSS class names
 */
const HelpPanel = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  searchQuery,
  searchResults,
  onSearch,
  onClearSearch,
  pageHelpContent,
  quickTips,
  className = '',
}) => {
  const { t } = useTranslation('help');
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  /**
   * Handle tab click
   * @param {string} tab - Tab identifier
   */
  const handleTabClick = useCallback(
    (tab) => {
      onTabChange(tab);
    },
    [onTabChange]
  );

  /**
   * Handle tab keyboard navigation
   * @param {React.KeyboardEvent} event - Keyboard event
   * @param {string} tab - Tab identifier
   */
  const handleTabKeyDown = useCallback(
    (event, tab) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleTabClick(tab);
      }
    },
    [handleTabClick]
  );

  /**
   * Handle search result click - switch to appropriate tab
   * @param {Object} result - Clicked search result
   */
  const handleSearchResultClick = useCallback(
    (result) => {
      if (result.type === 'page') {
        onTabChange('pageHelp');
      } else if (result.type === 'tip') {
        onTabChange('quickTips');
      }
      onClearSearch();
    },
    [onTabChange, onClearSearch]
  );

  /**
   * Focus management when panel opens
   */
  useEffect(() => {
    if (isOpen) {
      // Focus the close button when panel opens
      closeButtonRef.current?.focus();
      
      // Prevent body scroll when panel is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /**
   * Trap focus within the panel when open
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleTabTrap = (event) => {
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabTrap);
    return () => {
      document.removeEventListener('keydown', handleTabTrap);
    };
  }, [isOpen]);

  const tabs = [
    { id: 'pageHelp', label: t('tabs.pageHelp') },
    { id: 'quickTips', label: t('tabs.quickTips') },
    { id: 'search', label: t('tabs.search') },
  ];

  return (
    <>
      {/* Overlay */}
      <div 
        className={`help-panel__overlay ${isOpen ? 'help-panel__overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        className={`help-panel ${isOpen ? 'help-panel--open' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('panel.title')}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <header className="help-panel__header">
          <h2 className="help-panel__title">{t('panel.title')}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="help-panel__close-btn"
            onClick={onClose}
            aria-label={t('panel.close')}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <nav className="help-panel__tabs" role="tablist" aria-label="Help sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`help-panel__tab ${activeTab === tab.id ? 'help-panel__tab--active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab panels */}
        <div className="help-panel__content">
          {/* Page Help Tab */}
          <div
            role="tabpanel"
            id="tabpanel-pageHelp"
            aria-labelledby="tab-pageHelp"
            className={`help-panel__tabpanel ${activeTab === 'pageHelp' ? 'help-panel__tabpanel--active' : ''}`}
            hidden={activeTab !== 'pageHelp'}
          >
            <PageHelp content={pageHelpContent} />
          </div>

          {/* Quick Tips Tab */}
          <div
            role="tabpanel"
            id="tabpanel-quickTips"
            aria-labelledby="tab-quickTips"
            className={`help-panel__tabpanel ${activeTab === 'quickTips' ? 'help-panel__tabpanel--active' : ''}`}
            hidden={activeTab !== 'quickTips'}
          >
            <QuickTips tips={quickTips} />
          </div>

          {/* Search Tab */}
          <div
            role="tabpanel"
            id="tabpanel-search"
            aria-labelledby="tab-search"
            className={`help-panel__tabpanel ${activeTab === 'search' ? 'help-panel__tabpanel--active' : ''}`}
            hidden={activeTab !== 'search'}
          >
            <HelpSearch
              query={searchQuery}
              results={searchResults}
              onSearch={onSearch}
              onClear={onClearSearch}
              onResultClick={handleSearchResultClick}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="help-panel__footer">
          <span className="help-panel__shortcut-hint">
            {t('panel.openShortcut')}
          </span>
        </footer>
      </aside>
    </>
  );
};

export default HelpPanel;
