import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * VAT scheme options
 */
const VAT_SCHEMES = ['standard', 'flatRate', 'cashAccounting', 'annualAccounting'];

/**
 * VatStatusStep Component
 * 
 * Allows users to indicate their VAT registration status and enter VAT details.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Object} props.errors - Validation errors
 */
const VatStatusStep = ({ data, updateData, errors }) => {
  const { t } = useTranslation('onboarding');

  /**
   * Handle VAT registration status change
   */
  const handleVatStatusChange = useCallback((isRegistered) => {
    updateData({
      isVatRegistered: isRegistered,
      // Clear VAT number if not registered
      vatNumber: isRegistered ? data.vatNumber : '',
    });
  }, [updateData, data.vatNumber]);

  /**
   * Handle VAT number input change
   */
  const handleVatNumberChange = useCallback((e) => {
    const value = e.target.value.toUpperCase();
    updateData({ vatNumber: value });
  }, [updateData]);

  /**
   * Handle VAT scheme change
   */
  const handleVatSchemeChange = useCallback((e) => {
    updateData({ vatScheme: e.target.value });
  }, [updateData]);

  /**
   * Format VAT number input
   */
  const formatVatNumber = (value) => {
    // Remove non-alphanumeric characters except spaces
    return value.replace(/[^A-Z0-9\s]/gi, '');
  };

  return (
    <div className="onboarding-step onboarding-step--vat-status">
      <h3 className="onboarding-step__title">{t('vatStatus.title')}</h3>
      <p className="onboarding-step__subtitle">{t('vatStatus.subtitle')}</p>

      {/* VAT Registration Status Options */}
      <div 
        className="onboarding-step__options onboarding-step__options--compact" 
        role="radiogroup" 
        aria-labelledby="vat-status-title"
      >
        <button
          type="button"
          role="radio"
          aria-checked={data.isVatRegistered === true}
          className={`onboarding-step__option ${data.isVatRegistered === true ? 'onboarding-step__option--selected' : ''}`}
          onClick={() => handleVatStatusChange(true)}
        >
          <div className="onboarding-step__option-icon">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="8" y="12" width="32" height="24" rx="2" />
              <path d="M16 20h16" />
              <path d="M16 28h8" />
              <circle cx="36" cy="28" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="onboarding-step__option-content">
            <h4 className="onboarding-step__option-title">
              {t('vatStatus.registered.title')}
            </h4>
            <p className="onboarding-step__option-description">
              {t('vatStatus.registered.description')}
            </p>
          </div>
          {data.isVatRegistered === true && (
            <div className="onboarding-step__option-check" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={data.isVatRegistered === false}
          className={`onboarding-step__option ${data.isVatRegistered === false ? 'onboarding-step__option--selected' : ''}`}
          onClick={() => handleVatStatusChange(false)}
        >
          <div className="onboarding-step__option-icon">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="8" y="12" width="32" height="24" rx="2" />
              <path d="M12 36L36 12" />
            </svg>
          </div>
          <div className="onboarding-step__option-content">
            <h4 className="onboarding-step__option-title">
              {t('vatStatus.notRegistered.title')}
            </h4>
            <p className="onboarding-step__option-description">
              {t('vatStatus.notRegistered.description')}
            </p>
          </div>
          {data.isVatRegistered === false && (
            <div className="onboarding-step__option-check" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {/* VAT Details (shown when registered) */}
      {data.isVatRegistered && (
        <div className="onboarding-step__form-section">
          {/* VAT Number Input */}
          <div className="onboarding-step__field">
            <label htmlFor="vat-number" className="onboarding-step__label">
              {t('vatStatus.vatNumber.label')}
            </label>
            <input
              id="vat-number"
              type="text"
              className={`onboarding-step__input ${errors.vatNumber ? 'onboarding-step__input--error' : ''}`}
              placeholder={t('vatStatus.vatNumber.placeholder')}
              value={data.vatNumber || ''}
              onChange={handleVatNumberChange}
              aria-describedby="vat-number-hint vat-number-error"
              maxLength={12}
            />
            <p id="vat-number-hint" className="onboarding-step__field-hint">
              {t('vatStatus.vatNumber.hint')}
            </p>
            {errors.vatNumber && (
              <p id="vat-number-error" className="onboarding-step__error" role="alert">
                {errors.vatNumber}
              </p>
            )}
          </div>

          {/* VAT Scheme Select */}
          <div className="onboarding-step__field">
            <label htmlFor="vat-scheme" className="onboarding-step__label">
              {t('vatStatus.vatScheme.label')}
            </label>
            <select
              id="vat-scheme"
              className="onboarding-step__select"
              value={data.vatScheme || 'standard'}
              onChange={handleVatSchemeChange}
            >
              {VAT_SCHEMES.map((scheme) => (
                <option key={scheme} value={scheme}>
                  {t(`vatStatus.vatScheme.${scheme}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="onboarding-step__info-box">
        <svg className="onboarding-step__info-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <div className="onboarding-step__info-content">
          <p>{t('vatStatus.info.threshold')}</p>
          <p>{t('vatStatus.info.voluntaryRegistration')}</p>
        </div>
      </div>
    </div>
  );
};

VatStatusStep.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  errors: PropTypes.object,
};

VatStatusStep.defaultProps = {
  errors: {},
};

export default VatStatusStep;
