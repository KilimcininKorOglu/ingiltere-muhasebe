import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * ArticleList Component
 * 
 * Displays a grid of article cards with titles, summaries, and metadata.
 * Supports filtering by category and searching.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.articles - Array of article objects
 * @param {Function} props.onArticleClick - Callback when an article card is clicked
 * @param {string} [props.selectedCategory] - Currently selected category filter
 * @param {Function} [props.onCategoryChange] - Callback when category filter changes
 * @param {string} [props.className] - Additional CSS class names
 */
const ArticleList = ({
  articles,
  onArticleClick,
  selectedCategory = 'all',
  onCategoryChange,
  className = '',
}) => {
  const { t } = useTranslation('articles');

  const categories = [
    { id: 'all', labelKey: 'categories.all', icon: '📚' },
    { id: 'tax', labelKey: 'categories.tax', icon: '💷' },
    { id: 'accounting', labelKey: 'categories.accounting', icon: '📊' },
    { id: 'planning', labelKey: 'categories.planning', icon: '📅' },
  ];

  const filteredArticles = selectedCategory === 'all'
    ? articles
    : articles.filter(article => article.category === selectedCategory);

  /**
   * Handle article card click
   * @param {Object} article - Clicked article
   */
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    }
  };

  /**
   * Handle article card keyboard navigation
   * @param {React.KeyboardEvent} event - Keyboard event
   * @param {Object} article - Article to navigate to
   */
  const handleArticleKeyDown = (event, article) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleArticleClick(article);
    }
  };

  return (
    <div className={`article-list ${className}`}>
      {/* Category filters */}
      {onCategoryChange && (
        <nav 
          className="article-list__filters" 
          role="tablist" 
          aria-label={t('filters.ariaLabel')}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              className={`article-list__filter-btn ${
                selectedCategory === category.id ? 'article-list__filter-btn--active' : ''
              }`}
              onClick={() => onCategoryChange(category.id)}
              aria-selected={selectedCategory === category.id}
              aria-controls="article-grid"
            >
              <span className="article-list__filter-icon" aria-hidden="true">
                {category.icon}
              </span>
              <span className="article-list__filter-label">
                {t(category.labelKey)}
              </span>
            </button>
          ))}
        </nav>
      )}

      {/* Article count */}
      <div className="article-list__count" aria-live="polite">
        {t('articleCount', { count: filteredArticles.length })}
      </div>

      {/* Article grid */}
      <div 
        className="article-list__grid" 
        id="article-grid"
        role="list"
      >
        {filteredArticles.length === 0 ? (
          <div className="article-list__empty">
            <span className="article-list__empty-icon" aria-hidden="true">📭</span>
            <p>{t('noArticles')}</p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <article
              key={article.id}
              className="article-list__card"
              role="listitem"
              tabIndex={0}
              onClick={() => handleArticleClick(article)}
              onKeyDown={(e) => handleArticleKeyDown(e, article)}
              aria-label={t(article.titleKey)}
            >
              <div className="article-list__card-header">
                <span className="article-list__card-icon" aria-hidden="true">
                  {article.icon}
                </span>
                <span className="article-list__card-category">
                  {t(`categories.${article.category}`)}
                </span>
              </div>
              
              <h3 className="article-list__card-title">
                {t(article.titleKey)}
              </h3>
              
              <p className="article-list__card-summary">
                {t(article.summaryKey)}
              </p>
              
              <div className="article-list__card-meta">
                <span className="article-list__card-read-time">
                  <span aria-hidden="true">⏱️</span>
                  {t('readTime', { minutes: article.readTime })}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

ArticleList.propTypes = {
  articles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      slug: PropTypes.string.isRequired,
      titleKey: PropTypes.string.isRequired,
      summaryKey: PropTypes.string.isRequired,
      category: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      readTime: PropTypes.number.isRequired,
    })
  ).isRequired,
  onArticleClick: PropTypes.func.isRequired,
  selectedCategory: PropTypes.string,
  onCategoryChange: PropTypes.func,
  className: PropTypes.string,
};

export default ArticleList;
