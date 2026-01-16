import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Article Component
 * 
 * Displays a full article with sections, examples, tables, and external links.
 * Supports bilingual content through i18n.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.article - Article data object
 * @param {Function} props.onBack - Callback to go back to article list
 * @param {Function} [props.onRelatedClick] - Callback when a related article is clicked
 * @param {string} [props.className] - Additional CSS class names
 */
const Article = ({
  article,
  onBack,
  onRelatedClick,
  className = '',
}) => {
  const { t } = useTranslation('articles');

  if (!article) {
    return (
      <div className={`article article--empty ${className}`}>
        <p>{t('articleNotFound')}</p>
        <button type="button" onClick={onBack} className="article__back-btn">
          {t('backToArticles')}
        </button>
      </div>
    );
  }

  const articleKey = article.id.replace(/-/g, '');
  const titleMap = {
    'vatexplained': 'vatExplained',
    'corporationtax': 'corporationTax',
    'selfassessment': 'selfAssessment',
    'paye': 'paye',
    'expenses': 'expenses',
    'taxcalendar': 'taxCalendar',
  };
  const translationKey = titleMap[articleKey] || articleKey;

  /**
   * Render a section based on its type
   * @param {Object} section - Section data
   * @returns {JSX.Element} Rendered section
   */
  const renderSection = (section) => {
    const sectionKey = `${translationKey}.sections.${section.id}`;
    const sectionTitle = t(`${sectionKey}.title`, { defaultValue: '' });
    const sectionContent = t(`${sectionKey}.content`, { defaultValue: '' });

    switch (section.type) {
      case 'intro':
        return (
          <section key={section.id} className="article__intro">
            <p className="article__intro-text">{sectionContent}</p>
          </section>
        );

      case 'highlight':
        return (
          <aside key={section.id} className="article__highlight">
            <div className="article__highlight-icon" aria-hidden="true">💡</div>
            <div className="article__highlight-content">
              {sectionTitle && <strong className="article__highlight-title">{sectionTitle}</strong>}
              <p>{sectionContent}</p>
            </div>
          </aside>
        );

      case 'example':
        return (
          <div key={section.id} className="article__example">
            <div className="article__example-header">
              <span className="article__example-icon" aria-hidden="true">📝</span>
              <span className="article__example-label">{t('exampleLabel')}</span>
            </div>
            <div className="article__example-content">
              {sectionTitle && <h4 className="article__example-title">{sectionTitle}</h4>}
              <p>{sectionContent}</p>
            </div>
          </div>
        );

      case 'list':
        const listItems = t(`${sectionKey}.items`, { returnObjects: true, defaultValue: [] });
        return (
          <section key={section.id} className="article__section">
            {sectionTitle && <h3 className="article__section-title">{sectionTitle}</h3>}
            {sectionContent && <p className="article__section-intro">{sectionContent}</p>}
            {Array.isArray(listItems) && listItems.length > 0 && (
              <ul className="article__list">
                {listItems.map((item, index) => (
                  <li key={index} className="article__list-item">{item}</li>
                ))}
              </ul>
            )}
          </section>
        );

      case 'month':
        return (
          <section key={section.id} className="article__month">
            <h4 className="article__month-title">{sectionTitle}</h4>
            <p className="article__month-content">{sectionContent}</p>
          </section>
        );

      case 'summary':
        return (
          <section key={section.id} className="article__summary">
            <h3 className="article__summary-title">{t('summaryTitle')}</h3>
            <p className="article__summary-content">{sectionContent}</p>
          </section>
        );

      case 'content':
      default:
        const tableData = section.hasTable 
          ? t(`${sectionKey}.table`, { returnObjects: true, defaultValue: null })
          : null;

        return (
          <section key={section.id} className="article__section">
            {sectionTitle && <h3 className="article__section-title">{sectionTitle}</h3>}
            <p className="article__section-content">{sectionContent}</p>
            
            {tableData && tableData.headers && tableData.rows && (
              <div className="article__table-wrapper">
                <table className="article__table">
                  <thead>
                    <tr>
                      {tableData.headers.map((header, index) => (
                        <th key={index}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
    }
  };

  return (
    <article className={`article ${className}`}>
      {/* Back button */}
      <nav className="article__nav">
        <button 
          type="button" 
          onClick={onBack} 
          className="article__back-btn"
          aria-label={t('backToArticles')}
        >
          <span aria-hidden="true">←</span>
          {t('backToArticles')}
        </button>
      </nav>

      {/* Article header */}
      <header className="article__header">
        <div className="article__meta">
          <span className="article__icon" aria-hidden="true">{article.icon}</span>
          <span className="article__category">{t(`categories.${article.category}`)}</span>
          <span className="article__separator" aria-hidden="true">•</span>
          <span className="article__read-time">
            {t('readTime', { minutes: article.readTime })}
          </span>
        </div>
        <h1 className="article__title">{t(article.titleKey)}</h1>
        <p className="article__summary">{t(article.summaryKey)}</p>
      </header>

      {/* Article content */}
      <div className="article__body">
        {article.sections.map(renderSection)}
      </div>

      {/* External links */}
      {article.externalLinks && article.externalLinks.length > 0 && (
        <section className="article__external-links">
          <h3 className="article__external-links-title">{t('usefulLinks')}</h3>
          <ul className="article__links-list">
            {article.externalLinks.map((link, index) => (
              <li key={index}>
                <a 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="article__external-link"
                >
                  <span className="article__link-icon" aria-hidden="true">🔗</span>
                  {t(link.titleKey)}
                  <span className="article__link-external" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Related articles */}
      {article.relatedArticles && article.relatedArticles.length > 0 && onRelatedClick && (
        <section className="article__related">
          <h3 className="article__related-title">{t('relatedArticles')}</h3>
          <div className="article__related-grid">
            {article.relatedArticles.map((relatedSlug) => {
              const relatedKey = relatedSlug.replace(/-/g, '');
              const relatedTranslationKey = titleMap[relatedKey] || relatedKey;
              return (
                <button
                  key={relatedSlug}
                  type="button"
                  className="article__related-card"
                  onClick={() => onRelatedClick(relatedSlug)}
                >
                  <span className="article__related-card-title">
                    {t(`${relatedTranslationKey}.title`)}
                  </span>
                  <span className="article__related-card-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <footer className="article__footer">
        <div className="article__disclaimer">
          <span className="article__disclaimer-icon" aria-hidden="true">⚠️</span>
          <p>{t('disclaimer')}</p>
        </div>
        <div className="article__last-updated">
          {t('lastUpdated', { date: article.lastUpdated })}
        </div>
      </footer>
    </article>
  );
};

Article.propTypes = {
  article: PropTypes.shape({
    id: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    readTime: PropTypes.number.isRequired,
    lastUpdated: PropTypes.string,
    titleKey: PropTypes.string.isRequired,
    summaryKey: PropTypes.string.isRequired,
    sections: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        hasTable: PropTypes.bool,
      })
    ).isRequired,
    externalLinks: PropTypes.arrayOf(
      PropTypes.shape({
        titleKey: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired,
      })
    ),
    relatedArticles: PropTypes.arrayOf(PropTypes.string),
  }),
  onBack: PropTypes.func.isRequired,
  onRelatedClick: PropTypes.func,
  className: PropTypes.string,
};

export default Article;
