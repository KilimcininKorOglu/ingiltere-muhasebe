import { useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * HelpSearch Component
 * 
 * Provides a search input for searching across all help content.
 * Displays search results with highlighted matches.
 * 
 * @param {Object} props - Component props
 * @param {string} props.query - Current search query
 * @param {Array} props.results - Search results array
 * @param {Function} props.onSearch - Callback when search query changes
 * @param {Function} props.onClear - Callback to clear search
 * @param {Function} [props.onResultClick] - Callback when a result is clicked
 * @param {string} [props.className] - Additional CSS class names
 */
const HelpSearch = ({
  query,
  results,
  onSearch,
  onClear,
  onResultClick,
  className = '',
}) => {
  const { t } = useTranslation('help');
  const inputRef = useRef(null);

  /**
   * Handle input change
   * @param {React.ChangeEvent<HTMLInputElement>} event - Change event
   */
  const handleInputChange = useCallback(
    (event) => {
      onSearch(event.target.value);
    },
    [onSearch]
  );

  /**
   * Handle clear button click
   */
  const handleClear = useCallback(() => {
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  /**
   * Handle result click
   * @param {Object} result - The clicked result
   */
  const handleResultClick = useCallback(
    (result) => {
      if (onResultClick) {
        onResultClick(result);
      }
    },
    [onResultClick]
  );

  /**
   * Handle keyboard navigation in results
   * @param {React.KeyboardEvent} event - Keyboard event
   * @param {Object} result - The result item
   */
  const handleResultKeyDown = useCallback(
    (event, result) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleResultClick(result);
      }
    },
    [handleResultClick]
  );

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Highlight matching text in content
   * @param {string} text - Text to highlight
   * @param {string} searchQuery - Query to highlight
   * @returns {JSX.Element} Text with highlighted matches
   */
  const highlightMatch = (text, searchQuery) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchQuery.toLowerCase()) {
        return (
          <mark key={index} className="help-search__highlight">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  /**
   * Get truncated content preview
   * @param {string} content - Full content
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated content
   */
  const getContentPreview = (content, maxLength = 150) => {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className={`help-search ${className}`}>
      <div className="help-search__input-wrapper">
        <svg 
          className="help-search__icon" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="help-search__input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={handleInputChange}
          aria-label={t('search.placeholder')}
        />
        {query && (
          <button
            type="button"
            className="help-search__clear-btn"
            onClick={handleClear}
            aria-label={t('search.clearSearch')}
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
        )}
      </div>

      {query && (
        <div className="help-search__results" role="listbox" aria-label="Search results">
          {results.length > 0 ? (
            <>
              <div className="help-search__results-count">
                {t('search.resultsCount', { count: results.length })}
              </div>
              <ul className="help-search__results-list">
                {results.map((result) => (
                  <li
                    key={result.id}
                    className="help-search__result-item"
                    role="option"
                    tabIndex={0}
                    onClick={() => handleResultClick(result)}
                    onKeyDown={(e) => handleResultKeyDown(e, result)}
                  >
                    <div className="help-search__result-header">
                      <span className="help-search__result-title">
                        {highlightMatch(result.title, query)}
                      </span>
                      <span className={`help-search__result-type help-search__result-type--${result.type}`}>
                        {result.type === 'page' ? result.page : 'tip'}
                      </span>
                    </div>
                    <p className="help-search__result-content">
                      {highlightMatch(getContentPreview(result.content), query)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="help-search__no-results">
              {t('search.noResults', { query })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HelpSearch;
