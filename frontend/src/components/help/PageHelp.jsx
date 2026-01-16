import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * PageHelp Component
 * 
 * Displays context-aware help content for the current page.
 * Shows expandable/collapsible sections for different topics.
 * 
 * @param {Object} props - Component props
 * @param {Object|null} props.content - Page help content object
 * @param {string} [props.className] - Additional CSS class names
 */
const PageHelp = ({ content, className = '' }) => {
  const { t } = useTranslation('help');
  const [expandedSections, setExpandedSections] = useState(new Set());

  /**
   * Toggle section expansion
   * @param {string} sectionId - Section ID to toggle
   */
  const toggleSection = useCallback((sectionId) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  /**
   * Expand all sections
   */
  const expandAll = useCallback(() => {
    if (content?.sections) {
      setExpandedSections(new Set(content.sections.map(s => s.id)));
    }
  }, [content]);

  /**
   * Collapse all sections
   */
  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  /**
   * Handle keyboard navigation
   * @param {React.KeyboardEvent} event - Keyboard event
   * @param {string} sectionId - Section ID
   */
  const handleKeyDown = useCallback(
    (event, sectionId) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSection(sectionId);
      }
    },
    [toggleSection]
  );

  // No content available
  if (!content) {
    return (
      <div className={`page-help page-help--empty ${className}`}>
        <p className="page-help__no-content">{t('pageHelp.noContent')}</p>
      </div>
    );
  }

  const allExpanded = content.sections.length > 0 && 
    content.sections.every(s => expandedSections.has(s.id));

  return (
    <div className={`page-help ${className}`}>
      <div className="page-help__header">
        <h3 className="page-help__title">{content.title}</h3>
        {content.sections.length > 1 && (
          <button
            type="button"
            className="page-help__toggle-all"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      <div className="page-help__sections" role="list">
        {content.sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          
          return (
            <div
              key={section.id}
              className={`page-help__section ${isExpanded ? 'page-help__section--expanded' : ''}`}
              role="listitem"
            >
              <button
                type="button"
                className="page-help__section-header"
                onClick={() => toggleSection(section.id)}
                onKeyDown={(e) => handleKeyDown(e, section.id)}
                aria-expanded={isExpanded}
                aria-controls={`section-content-${section.id}`}
              >
                <span className="page-help__section-title">{section.title}</span>
                <svg 
                  className={`page-help__section-icon ${isExpanded ? 'page-help__section-icon--expanded' : ''}`}
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              
              <div
                id={`section-content-${section.id}`}
                className="page-help__section-content"
                role="region"
                aria-hidden={!isExpanded}
              >
                <p>{section.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PageHelp;
