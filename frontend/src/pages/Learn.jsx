import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import ArticleList from '../components/learn/ArticleList';
import Article from '../components/learn/Article';
import helpContent from '../data/helpContent.json';

// Import article data files
import vatExplainedData from '../data/articles/vat-explained.json';
import corporationTaxData from '../data/articles/corporation-tax.json';
import selfAssessmentData from '../data/articles/self-assessment.json';
import payeData from '../data/articles/paye.json';
import expensesData from '../data/articles/expenses.json';
import taxCalendarData from '../data/articles/tax-calendar.json';

// Map article slugs to their full data
const articleDataMap = {
  'vat-explained': vatExplainedData,
  'corporation-tax': corporationTaxData,
  'self-assessment': selfAssessmentData,
  'paye': payeData,
  'expenses': expensesData,
  'tax-calendar': taxCalendarData,
};

/**
 * Learn Page Component
 * 
 * Main page for UK tax educational content. Provides a list of articles
 * and detailed article views for learning about UK tax concepts.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.defaultArticle] - Default article slug to show
 * @param {string} [props.className] - Additional CSS class names
 */
const Learn = ({ 
  defaultArticle = null,
  className = '' 
}) => {
  const { t } = useTranslation('articles');
  const [selectedArticle, setSelectedArticle] = useState(defaultArticle);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get article metadata from helpContent for the list view
  const articles = useMemo(() => {
    return helpContent.articles.map(article => ({
      ...article,
      ...articleDataMap[article.slug],
    }));
  }, []);

  /**
   * Handle article selection from the list
   * @param {Object} article - Selected article
   */
  const handleArticleClick = useCallback((article) => {
    setSelectedArticle(article.slug);
    // Scroll to top when viewing article
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /**
   * Handle going back to the article list
   */
  const handleBack = useCallback(() => {
    setSelectedArticle(null);
  }, []);

  /**
   * Handle clicking a related article
   * @param {string} slug - Related article slug
   */
  const handleRelatedClick = useCallback((slug) => {
    setSelectedArticle(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /**
   * Handle category filter change
   * @param {string} category - Selected category
   */
  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  // Get the full article data for the selected article
  const currentArticle = useMemo(() => {
    if (!selectedArticle) return null;
    const metadata = articles.find(a => a.slug === selectedArticle);
    const fullData = articleDataMap[selectedArticle];
    if (!metadata || !fullData) return null;
    return { ...metadata, ...fullData };
  }, [selectedArticle, articles]);

  return (
    <div className={`learn-page ${className}`}>
      {/* Page header - only show when in list view */}
      {!selectedArticle && (
        <header className="learn-page__header">
          <h1 className="learn-page__title">{t('pageTitle')}</h1>
          <p className="learn-page__description">{t('pageDescription')}</p>
          
          {/* Welcome message for new users */}
          <div className="learn-page__welcome">
            <span className="learn-page__welcome-icon" aria-hidden="true">🎓</span>
            <p>{t('welcomeMessage')}</p>
          </div>
        </header>
      )}

      {/* Content area */}
      <main className="learn-page__content">
        {selectedArticle ? (
          <Article
            article={currentArticle}
            onBack={handleBack}
            onRelatedClick={handleRelatedClick}
          />
        ) : (
          <ArticleList
            articles={articles}
            onArticleClick={handleArticleClick}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />
        )}
      </main>
    </div>
  );
};

Learn.propTypes = {
  defaultArticle: PropTypes.string,
  className: PropTypes.string,
};

export default Learn;
