import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Features to display in the tour
 */
const TOUR_FEATURES = [
  'dashboard',
  'transactions',
  'invoices',
  'vat',
  'reports',
  'bank',
];

/**
 * FeatureTour Component
 * 
 * A brief tour of main features including dashboard, transactions, and invoices.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Function} props.onNext - Function to go to next step
 */
const FeatureTour = ({ data, updateData, onNext }) => {
  const { t } = useTranslation('onboarding');
  
  // Track currently highlighted feature
  const [activeFeature, setActiveFeature] = useState(0);

  /**
   * Handle feature selection
   */
  const handleFeatureClick = useCallback((index) => {
    setActiveFeature(index);
  }, []);

  /**
   * Get icon for feature
   */
  const getFeatureIcon = (feature) => {
    switch (feature) {
      case 'dashboard':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="6" y="6" width="16" height="16" rx="2" />
            <rect x="26" y="6" width="16" height="8" rx="2" />
            <rect x="26" y="18" width="16" height="24" rx="2" />
            <rect x="6" y="26" width="16" height="16" rx="2" />
          </svg>
        );
      case 'transactions':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="6" y="10" width="36" height="28" rx="2" />
            <path d="M6 18h36" />
            <path d="M14 26h10" />
            <path d="M14 32h6" />
            <path d="M30 26h4" />
            <path d="M30 32h4" />
          </svg>
        );
      case 'invoices':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="8" y="4" width="32" height="40" rx="2" />
            <path d="M14 14h20" />
            <path d="M14 22h20" />
            <path d="M14 30h12" />
            <path d="M30 30h4" />
            <path d="M14 38h8" />
          </svg>
        );
      case 'vat':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="8" y="8" width="32" height="32" rx="2" />
            <path d="M16 24l6 6 10-12" />
          </svg>
        );
      case 'reports':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 40V12" />
            <path d="M8 40h32" />
            <path d="M16 40V24" />
            <path d="M24 40V16" />
            <path d="M32 40V28" />
          </svg>
        );
      case 'bank':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 18l18-10 18 10" />
            <rect x="6" y="18" width="36" height="4" />
            <rect x="10" y="22" width="6" height="16" />
            <rect x="21" y="22" width="6" height="16" />
            <rect x="32" y="22" width="6" height="16" />
            <rect x="6" y="38" width="36" height="4" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-step onboarding-step--tour">
      <h3 className="onboarding-step__title">{t('tour.title')}</h3>
      <p className="onboarding-step__subtitle">{t('tour.subtitle')}</p>

      <div className="onboarding-step__tour-container">
        {/* Feature Navigation */}
        <nav className="onboarding-step__tour-nav" aria-label="Feature tour navigation">
          {TOUR_FEATURES.map((feature, index) => (
            <button
              key={feature}
              type="button"
              className={`onboarding-step__tour-nav-item ${
                activeFeature === index ? 'onboarding-step__tour-nav-item--active' : ''
              }`}
              onClick={() => handleFeatureClick(index)}
              aria-current={activeFeature === index ? 'true' : undefined}
            >
              <span className="onboarding-step__tour-nav-number">{index + 1}</span>
              <span className="onboarding-step__tour-nav-title">{t(`tour.${feature}.title`)}</span>
            </button>
          ))}
        </nav>

        {/* Feature Display */}
        <div className="onboarding-step__tour-content">
          <div className="onboarding-step__tour-feature">
            <div className="onboarding-step__tour-icon">
              {getFeatureIcon(TOUR_FEATURES[activeFeature])}
            </div>
            <div className="onboarding-step__tour-details">
              <h4 className="onboarding-step__tour-feature-title">
                {t(`tour.${TOUR_FEATURES[activeFeature]}.title`)}
              </h4>
              <p className="onboarding-step__tour-feature-description">
                {t(`tour.${TOUR_FEATURES[activeFeature]}.description`)}
              </p>
            </div>
          </div>

          {/* Feature cards grid */}
          <div className="onboarding-step__tour-cards">
            {TOUR_FEATURES.map((feature, index) => (
              <div
                key={feature}
                className={`onboarding-step__tour-card ${
                  activeFeature === index ? 'onboarding-step__tour-card--active' : ''
                }`}
                onClick={() => handleFeatureClick(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleFeatureClick(index);
                  }
                }}
              >
                <div className="onboarding-step__tour-card-icon">
                  {getFeatureIcon(feature)}
                </div>
                <span className="onboarding-step__tour-card-title">
                  {t(`tour.${feature}.title`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="onboarding-step__cta-button"
        onClick={onNext}
      >
        {t('tour.continue')}
      </button>
    </div>
  );
};

FeatureTour.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

export default FeatureTour;
