import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import helpContent from '../data/helpContent.json';

/**
 * Custom hook for managing help panel state and functionality.
 * Provides help panel open/close state, current page context,
 * search functionality, and keyboard shortcut support.
 * 
 * @param {Object} options - Hook options
 * @param {string} [options.currentPage='dashboard'] - Current page identifier for context-aware help
 * @returns {Object} Help panel state and methods
 */
const useHelp = ({ currentPage = 'dashboard' } = {}) => {
  const { t } = useTranslation('help');
  
  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pageHelp');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  /**
   * Open the help panel
   */
  const openHelp = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * Close the help panel
   */
  const closeHelp = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  /**
   * Toggle the help panel
   */
  const toggleHelp = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  /**
   * Get page-specific help content
   */
  const pageHelpContent = useMemo(() => {
    const page = helpContent.pages[currentPage];
    if (!page) {
      return null;
    }
    
    return {
      id: page.id,
      title: t(`pageHelp.${currentPage}.title`),
      sections: page.sections.map(section => ({
        id: section.id,
        title: t(section.titleKey.replace('help:', '')),
        content: t(section.contentKey.replace('help:', '')),
      })),
    };
  }, [currentPage, t]);

  /**
   * Get quick tips
   */
  const quickTips = useMemo(() => {
    return helpContent.quickTips.map(tip => ({
      id: tip.id,
      title: t(tip.titleKey.replace('help:', '')),
      content: t(tip.contentKey.replace('help:', '')),
      icon: tip.icon,
    }));
  }, [t]);

  /**
   * Search help content
   * @param {string} query - Search query
   */
  const search = useCallback((query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const results = [];

    helpContent.searchableContent.forEach(item => {
      // Check if query matches keywords
      const keywordMatch = item.keywords.some(keyword => 
        keyword.toLowerCase().includes(normalizedQuery)
      );
      
      // Check if query matches title or content
      const title = t(item.titleKey.replace('help:', ''));
      const content = t(item.contentKey.replace('help:', ''));
      const titleMatch = title.toLowerCase().includes(normalizedQuery);
      const contentMatch = content.toLowerCase().includes(normalizedQuery);

      if (keywordMatch || titleMatch || contentMatch) {
        results.push({
          id: item.id,
          type: item.type,
          page: item.page,
          title,
          content,
          relevance: titleMatch ? 3 : (keywordMatch ? 2 : 1),
        });
      }
    });

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    setSearchResults(results);
  }, [t]);

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  /**
   * Handle F1 keyboard shortcut
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        toggleHelp();
      }
      
      // Close on Escape when panel is open
      if (event.key === 'Escape' && isOpen) {
        closeHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, toggleHelp, closeHelp]);

  return {
    // State
    isOpen,
    activeTab,
    searchQuery,
    searchResults,
    pageHelpContent,
    quickTips,
    currentPage,
    
    // Actions
    openHelp,
    closeHelp,
    toggleHelp,
    setActiveTab,
    search,
    clearSearch,
  };
};

export default useHelp;
