import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Business type options
 */
const BUSINESS_TYPES = ['sole_trader', 'limited_company', 'partnership'];

/**
 * BusinessTypeStep Component
 * 
 * Allows users to select their business type (Sole Trader, Limited Company, or Partnership).
 * This selection affects subsequent steps and UI customization.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Object} props.errors - Validation errors
 */
const BusinessTypeStep = ({ data, updateData, errors }) => {
  const { t } = useTranslation('onboarding');

  /**
   * Handle business type selection
   */
  const handleSelect = useCallback((type) => {
    updateData({ businessType: type });
  }, [updateData]);

  /**
   * Get icon for business type
   */
  const getIcon = (type) => {
    switch (type) {
      case 'sole_trader':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="24" cy="14" r="8" />
            <path d="M12 42c0-8 5-14 12-14s12 6 12 14" />
          </svg>
        );
      case 'limited_company':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="8" y="16" width="32" height="26" rx="2" />
            <path d="M16 16V10a8 8 0 0116 0v6" />
            <rect x="18" y="26" width="12" height="8" />
          </svg>
        );
      case 'partnership':
        return (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="16" cy="14" r="6" />
            <circle cx="32" cy="14" r="6" />
            <path d="M6 38c0-6 4-10 10-10s10 4 10 10" />
            <path d="M22 38c0-6 4-10 10-10s10 4 10 10" />
          </svg>
        );
      default:
        return null;
    }
  };

  /**
   * Get translation key prefix for business type
   */
  const getTypeKey = (type) => {
    switch (type) {
      case 'sole_trader':
        return 'soleTrader';
      case 'limited_company':
        return 'limitedCompany';
      case 'partnership':
        return 'partnership';
      default:
        return type;
    }
  };

  return (
    <div className="onboarding-step onboarding-step--business-type">
      <h3 className="onboarding-step__title">{t('businessType.title')}</h3>
      <p className="onboarding-step__subtitle">{t('businessType.subtitle')}</p>

      <div 
        className="onboarding-step__options" 
        role="radiogroup" 
        aria-labelledby="business-type-title"
        aria-describedby={errors.businessType ? 'business-type-error' : undefined}
      >
        {BUSINESS_TYPES.map((type) => {
          const typeKey = getTypeKey(type);
          const isSelected = data.businessType === type;
          
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`onboarding-step__option ${isSelected ? 'onboarding-step__option--selected' : ''}`}
              onClick={() => handleSelect(type)}
            >
              <div className="onboarding-step__option-icon">
                {getIcon(type)}
              </div>
              <div className="onboarding-step__option-content">
                <h4 className="onboarding-step__option-title">
                  {t(`businessType.${typeKey}.title`)}
                </h4>
                <p className="onboarding-step__option-description">
                  {t(`businessType.${typeKey}.description`)}
                </p>
                <p className="onboarding-step__option-examples">
                  {t(`businessType.${typeKey}.examples`)}
                </p>
              </div>
              {isSelected && (
                <div className="onboarding-step__option-check" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {errors.businessType && (
        <p id="business-type-error" className="onboarding-step__error" role="alert">
          {errors.businessType}
        </p>
      )}

      <p className="onboarding-step__hint">{t('businessType.notSure')}</p>
    </div>
  );
};

BusinessTypeStep.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  errors: PropTypes.object,
};

BusinessTypeStep.defaultProps = {
  errors: {},
};

export default BusinessTypeStep;
