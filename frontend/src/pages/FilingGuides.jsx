import { useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import VatFilingGuide from '../components/guides/VatFilingGuide';
import CorporationTaxGuide from '../components/guides/CorporationTaxGuide';
import SelfAssessmentGuide from '../components/guides/SelfAssessmentGuide';

/**
 * FilingGuides Page Component
 * 
 * Main page for HMRC filing guides. Provides tabbed navigation between
 * different tax filing guides (VAT, Corporation Tax, Self Assessment).
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.taxData] - Pre-populated tax data from the app
 * @param {string} [props.defaultGuide] - Default guide to show ('vat', 'ct', 'sa')
 * @param {string} [props.className] - Additional CSS class names
 */
const FilingGuides = ({ 
  taxData = null, 
  defaultGuide = 'vat',
  className = '' 
}) => {
  const { t } = useTranslation();
  const [activeGuide, setActiveGuide] = useState(defaultGuide);

  const guides = [
    {
      id: 'vat',
      labelKey: 'guides.tabs.vat',
      icon: '📋',
    },
    {
      id: 'ct',
      labelKey: 'guides.tabs.ct',
      icon: '🏢',
    },
    {
      id: 'sa',
      labelKey: 'guides.tabs.sa',
      icon: '👤',
    },
  ];

  const renderActiveGuide = () => {
    switch (activeGuide) {
      case 'vat':
        return <VatFilingGuide vatData={taxData?.vat} />;
      case 'ct':
        return <CorporationTaxGuide ctData={taxData?.ct} />;
      case 'sa':
        return <SelfAssessmentGuide saData={taxData?.sa} />;
      default:
        return <VatFilingGuide vatData={taxData?.vat} />;
    }
  };

  return (
    <div className={`filing-guides-page ${className}`}>
      <header className="filing-guides-page__header">
        <h1 className="filing-guides-page__title">
          {t('guides.pageTitle')}
        </h1>
        <p className="filing-guides-page__description">
          {t('guides.pageDescription')}
        </p>
      </header>

      {/* Important disclaimer */}
      <div className="filing-guides-page__disclaimer">
        <span className="filing-guides-page__disclaimer-icon" aria-hidden="true">⚠️</span>
        <p>{t('guides.disclaimer')}</p>
      </div>

      {/* Guide tabs */}
      <nav className="filing-guides-page__tabs" role="tablist" aria-label={t('guides.selectGuide')}>
        {guides.map((guide) => (
          <button
            key={guide.id}
            type="button"
            role="tab"
            id={`tab-${guide.id}`}
            aria-selected={activeGuide === guide.id}
            aria-controls={`panel-${guide.id}`}
            className={`filing-guides-page__tab ${
              activeGuide === guide.id ? 'filing-guides-page__tab--active' : ''
            }`}
            onClick={() => setActiveGuide(guide.id)}
          >
            <span className="filing-guides-page__tab-icon" aria-hidden="true">
              {guide.icon}
            </span>
            <span className="filing-guides-page__tab-label">
              {t(guide.labelKey)}
            </span>
          </button>
        ))}
      </nav>

      {/* Guide content */}
      <div 
        className="filing-guides-page__content"
        role="tabpanel"
        id={`panel-${activeGuide}`}
        aria-labelledby={`tab-${activeGuide}`}
      >
        <Suspense fallback={<div className="filing-guides-page__loading">{t('common.loading')}</div>}>
          {renderActiveGuide()}
        </Suspense>
      </div>

      {/* Quick links */}
      <section className="filing-guides-page__quick-links">
        <h2>{t('guides.quickLinks')}</h2>
        <div className="filing-guides-page__links-grid">
          <a 
            href="https://www.gov.uk/log-in-register-hmrc-online-services" 
            target="_blank" 
            rel="noopener noreferrer"
            className="filing-guides-page__link-card"
          >
            <span className="filing-guides-page__link-icon" aria-hidden="true">🔐</span>
            <span className="filing-guides-page__link-text">{t('guides.links.hmrcLogin')}</span>
          </a>
          <a 
            href="https://www.gov.uk/government/organisations/hm-revenue-customs/contact" 
            target="_blank" 
            rel="noopener noreferrer"
            className="filing-guides-page__link-card"
          >
            <span className="filing-guides-page__link-icon" aria-hidden="true">📞</span>
            <span className="filing-guides-page__link-text">{t('guides.links.hmrcContact')}</span>
          </a>
          <a 
            href="https://www.gov.uk/self-assessment-tax-return-forms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="filing-guides-page__link-card"
          >
            <span className="filing-guides-page__link-icon" aria-hidden="true">📄</span>
            <span className="filing-guides-page__link-text">{t('guides.links.taxForms')}</span>
          </a>
          <a 
            href="https://www.gov.uk/tax-appeals" 
            target="_blank" 
            rel="noopener noreferrer"
            className="filing-guides-page__link-card"
          >
            <span className="filing-guides-page__link-icon" aria-hidden="true">⚖️</span>
            <span className="filing-guides-page__link-text">{t('guides.links.taxAppeals')}</span>
          </a>
        </div>
      </section>
    </div>
  );
};

FilingGuides.propTypes = {
  taxData: PropTypes.shape({
    vat: PropTypes.object,
    ct: PropTypes.object,
    sa: PropTypes.object,
  }),
  defaultGuide: PropTypes.oneOf(['vat', 'ct', 'sa']),
  className: PropTypes.string,
};

export default FilingGuides;
