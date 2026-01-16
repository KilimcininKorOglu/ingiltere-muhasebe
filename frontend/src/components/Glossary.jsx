import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import glossaryData from '../data/glossary.json';

/**
 * GlossaryItem Component
 * Displays a single glossary term with its translations and explanations
 * 
 * @param {Object} props - Component props
 * @param {Object} props.term - The glossary term object
 * @param {boolean} props.isExpanded - Whether the item is expanded
 * @param {Function} props.onToggle - Toggle expansion callback
 * @param {string} props.currentLanguage - Current language code
 */
const GlossaryItem = ({ term, isExpanded, onToggle, currentLanguage }) => {
  const isTurkish = currentLanguage === 'tr';

  return (
    <div className="glossary-item">
      <button
        className={`glossary-item__header ${isExpanded ? 'glossary-item__header--expanded' : ''}`}
        onClick={onToggle}
        aria-expanded={isExpanded}
        type="button"
      >
        <span className="glossary-item__term">
          <strong>{term.term}</strong>
          {isTurkish && term.translationTr !== term.term && (
            <span className="glossary-item__translation"> ({term.translationTr})</span>
          )}
        </span>
        <span className="glossary-item__toggle" aria-hidden="true">
          {isExpanded ? '−' : '+'}
        </span>
      </button>
      
      {isExpanded && (
        <div className="glossary-item__content">
          <div className="glossary-item__full-name">
            <div className="glossary-item__label">
              {isTurkish ? 'Tam Adı:' : 'Full Name:'}
            </div>
            <div className="glossary-item__value">
              {isTurkish ? term.fullTurkish : term.fullEnglish}
            </div>
          </div>
          
          <div className="glossary-item__explanation">
            <div className="glossary-item__label">
              {isTurkish ? 'Açıklama:' : 'Explanation:'}
            </div>
            <div className="glossary-item__value">
              {isTurkish ? term.explanationTr : term.explanation}
            </div>
          </div>
          
          {/* Show both languages for reference */}
          <div className="glossary-item__bilingual">
            <details className="glossary-item__other-language">
              <summary>
                {isTurkish ? 'English' : 'Türkçe'}
              </summary>
              <div className="glossary-item__other-content">
                <p><strong>{isTurkish ? 'Full Name:' : 'Tam Adı:'}</strong> {isTurkish ? term.fullEnglish : term.fullTurkish}</p>
                <p><strong>{isTurkish ? 'Explanation:' : 'Açıklama:'}</strong> {isTurkish ? term.explanation : term.explanationTr}</p>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Glossary Component
 * 
 * A bilingual glossary component that displays UK financial and tax terminology
 * with explanations in both English and Turkish.
 * 
 * Features:
 * - Search/filter functionality
 * - Category filtering
 * - Expandable term details
 * - Bilingual support (EN/TR)
 * 
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS class names
 * @param {string} [props.initialCategory] - Initial category filter
 */
const Glossary = ({ className = '', initialCategory = '' }) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language;
  const isTurkish = currentLanguage === 'tr';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [expandedItems, setExpandedItems] = useState(new Set());

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
  }, []);

  /**
   * Handle category filter change
   */
  const handleCategoryChange = useCallback((event) => {
    setSelectedCategory(event.target.value);
  }, []);

  /**
   * Toggle item expansion
   */
  const handleToggleItem = useCallback((termId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(termId)) {
        newSet.delete(termId);
      } else {
        newSet.add(termId);
      }
      return newSet;
    });
  }, []);

  /**
   * Expand all items
   */
  const handleExpandAll = useCallback(() => {
    const allIds = new Set(glossaryData.terms.map((term) => term.id));
    setExpandedItems(allIds);
  }, []);

  /**
   * Collapse all items
   */
  const handleCollapseAll = useCallback(() => {
    setExpandedItems(new Set());
  }, []);

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('');
  }, []);

  /**
   * Filter terms based on search query and category
   */
  const filteredTerms = useMemo(() => {
    return glossaryData.terms.filter((term) => {
      // Category filter
      if (selectedCategory && term.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          term.term,
          term.translationTr,
          term.fullEnglish,
          term.fullTurkish,
          term.explanation,
          term.explanationTr,
        ];
        
        return searchFields.some((field) => 
          field && field.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [searchQuery, selectedCategory]);

  /**
   * Get category display name
   */
  const getCategoryName = useCallback((category) => {
    return isTurkish ? category.nameTr : category.nameEn;
  }, [isTurkish]);

  return (
    <div className={`glossary ${className}`}>
      <header className="glossary__header">
        <h2 className="glossary__title">
          {isTurkish ? 'Finansal ve Vergi Terimleri Sözlüğü' : 'Financial and Tax Terminology Glossary'}
        </h2>
        <p className="glossary__description">
          {isTurkish 
            ? 'İngiltere finansal ve vergi terimlerini açıklamalarıyla birlikte bulun.'
            : 'Find UK financial and tax terms with their explanations.'}
        </p>
      </header>

      <div className="glossary__controls">
        <div className="glossary__search">
          <label htmlFor="glossary-search" className="glossary__label">
            {t('common.search')}:
          </label>
          <input
            id="glossary-search"
            type="text"
            className="glossary__search-input"
            placeholder={isTurkish ? 'Terim ara...' : 'Search terms...'}
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label={isTurkish ? 'Terim ara' : 'Search terms'}
          />
        </div>

        <div className="glossary__filter">
          <label htmlFor="glossary-category" className="glossary__label">
            {t('common.filter')}:
          </label>
          <select
            id="glossary-category"
            className="glossary__category-select"
            value={selectedCategory}
            onChange={handleCategoryChange}
            aria-label={isTurkish ? 'Kategoriye göre filtrele' : 'Filter by category'}
          >
            <option value="">
              {isTurkish ? 'Tüm Kategoriler' : 'All Categories'}
            </option>
            {glossaryData.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {getCategoryName(category)}
              </option>
            ))}
          </select>
        </div>

        <div className="glossary__actions">
          <button
            type="button"
            className="glossary__action-button"
            onClick={handleExpandAll}
            aria-label={isTurkish ? 'Tümünü genişlet' : 'Expand all'}
          >
            {isTurkish ? 'Tümünü Genişlet' : 'Expand All'}
          </button>
          <button
            type="button"
            className="glossary__action-button"
            onClick={handleCollapseAll}
            aria-label={isTurkish ? 'Tümünü daralt' : 'Collapse all'}
          >
            {isTurkish ? 'Tümünü Daralt' : 'Collapse All'}
          </button>
          {(searchQuery || selectedCategory) && (
            <button
              type="button"
              className="glossary__action-button glossary__action-button--clear"
              onClick={handleClearFilters}
              aria-label={isTurkish ? 'Filtreleri temizle' : 'Clear filters'}
            >
              {t('common.clear')}
            </button>
          )}
        </div>
      </div>

      <div className="glossary__results-info">
        <span>
          {isTurkish 
            ? `${filteredTerms.length} terim bulundu`
            : `${filteredTerms.length} terms found`}
        </span>
      </div>

      <div className="glossary__list" role="list">
        {filteredTerms.length > 0 ? (
          filteredTerms.map((term) => (
            <GlossaryItem
              key={term.id}
              term={term}
              isExpanded={expandedItems.has(term.id)}
              onToggle={() => handleToggleItem(term.id)}
              currentLanguage={currentLanguage}
            />
          ))
        ) : (
          <div className="glossary__empty">
            <p>
              {isTurkish 
                ? 'Arama kriterlerinize uygun terim bulunamadı.'
                : 'No terms found matching your search criteria.'}
            </p>
            <button
              type="button"
              className="glossary__action-button"
              onClick={handleClearFilters}
            >
              {t('common.clear')} {t('common.filter')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Glossary;
