import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * CompanyDetailsStep Component
 * 
 * Collects business name, address, and contact information.
 * Shows company-specific fields for limited companies.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Object} props.errors - Validation errors
 */
const CompanyDetailsStep = ({ data, updateData, errors }) => {
  const { t } = useTranslation('onboarding');

  /**
   * Handle input change
   */
  const handleChange = useCallback((field) => (e) => {
    updateData({ [field]: e.target.value });
  }, [updateData]);

  const isLimitedCompany = data.businessType === 'limited_company';

  return (
    <div className="onboarding-step onboarding-step--company-details">
      <h3 className="onboarding-step__title">{t('companyDetails.title')}</h3>
      <p className="onboarding-step__subtitle">{t('companyDetails.subtitle')}</p>

      <div className="onboarding-step__form">
        {/* Business Name Section */}
        <div className="onboarding-step__form-section">
          <div className="onboarding-step__field">
            <label htmlFor="business-name" className="onboarding-step__label onboarding-step__label--required">
              {t('companyDetails.businessName.label')}
            </label>
            <input
              id="business-name"
              type="text"
              className={`onboarding-step__input ${errors.businessName ? 'onboarding-step__input--error' : ''}`}
              placeholder={t('companyDetails.businessName.placeholder')}
              value={data.businessName || ''}
              onChange={handleChange('businessName')}
              aria-describedby="business-name-hint business-name-error"
              required
            />
            <p id="business-name-hint" className="onboarding-step__field-hint">
              {t('companyDetails.businessName.hint')}
            </p>
            {errors.businessName && (
              <p id="business-name-error" className="onboarding-step__error" role="alert">
                {errors.businessName}
              </p>
            )}
          </div>

          <div className="onboarding-step__field">
            <label htmlFor="trading-name" className="onboarding-step__label">
              {t('companyDetails.tradingName.label')}
            </label>
            <input
              id="trading-name"
              type="text"
              className="onboarding-step__input"
              placeholder={t('companyDetails.tradingName.placeholder')}
              value={data.tradingName || ''}
              onChange={handleChange('tradingName')}
              aria-describedby="trading-name-hint"
            />
            <p id="trading-name-hint" className="onboarding-step__field-hint">
              {t('companyDetails.tradingName.hint')}
            </p>
          </div>

          {/* Company Number (Limited Companies only) */}
          {isLimitedCompany && (
            <div className="onboarding-step__field">
              <label htmlFor="company-number" className="onboarding-step__label">
                {t('companyDetails.companyNumber.label')}
              </label>
              <input
                id="company-number"
                type="text"
                className={`onboarding-step__input ${errors.companyNumber ? 'onboarding-step__input--error' : ''}`}
                placeholder={t('companyDetails.companyNumber.placeholder')}
                value={data.companyNumber || ''}
                onChange={handleChange('companyNumber')}
                aria-describedby="company-number-hint company-number-error"
                maxLength={8}
              />
              <p id="company-number-hint" className="onboarding-step__field-hint">
                {t('companyDetails.companyNumber.hint')}
              </p>
              {errors.companyNumber && (
                <p id="company-number-error" className="onboarding-step__error" role="alert">
                  {errors.companyNumber}
                </p>
              )}
            </div>
          )}

          {/* UTR */}
          <div className="onboarding-step__field">
            <label htmlFor="utr" className="onboarding-step__label">
              {t('companyDetails.utr.label')}
            </label>
            <input
              id="utr"
              type="text"
              className={`onboarding-step__input ${errors.utr ? 'onboarding-step__input--error' : ''}`}
              placeholder={t('companyDetails.utr.placeholder')}
              value={data.utr || ''}
              onChange={handleChange('utr')}
              aria-describedby="utr-hint utr-error"
              maxLength={10}
            />
            <p id="utr-hint" className="onboarding-step__field-hint">
              {t('companyDetails.utr.hint')}
            </p>
            {errors.utr && (
              <p id="utr-error" className="onboarding-step__error" role="alert">
                {errors.utr}
              </p>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="onboarding-step__form-section">
          <h4 className="onboarding-step__section-title">{t('companyDetails.address.title')}</h4>
          
          <div className="onboarding-step__field">
            <label htmlFor="address-line1" className="onboarding-step__label onboarding-step__label--required">
              {t('companyDetails.address.line1.label')}
            </label>
            <input
              id="address-line1"
              type="text"
              className={`onboarding-step__input ${errors.addressLine1 ? 'onboarding-step__input--error' : ''}`}
              placeholder={t('companyDetails.address.line1.placeholder')}
              value={data.addressLine1 || ''}
              onChange={handleChange('addressLine1')}
              required
            />
            {errors.addressLine1 && (
              <p className="onboarding-step__error" role="alert">
                {errors.addressLine1}
              </p>
            )}
          </div>

          <div className="onboarding-step__field">
            <label htmlFor="address-line2" className="onboarding-step__label">
              {t('companyDetails.address.line2.label')}
            </label>
            <input
              id="address-line2"
              type="text"
              className="onboarding-step__input"
              placeholder={t('companyDetails.address.line2.placeholder')}
              value={data.addressLine2 || ''}
              onChange={handleChange('addressLine2')}
            />
          </div>

          <div className="onboarding-step__field-row">
            <div className="onboarding-step__field onboarding-step__field--half">
              <label htmlFor="city" className="onboarding-step__label">
                {t('companyDetails.address.city.label')}
              </label>
              <input
                id="city"
                type="text"
                className="onboarding-step__input"
                placeholder={t('companyDetails.address.city.placeholder')}
                value={data.city || ''}
                onChange={handleChange('city')}
              />
            </div>

            <div className="onboarding-step__field onboarding-step__field--half">
              <label htmlFor="county" className="onboarding-step__label">
                {t('companyDetails.address.county.label')}
              </label>
              <input
                id="county"
                type="text"
                className="onboarding-step__input"
                placeholder={t('companyDetails.address.county.placeholder')}
                value={data.county || ''}
                onChange={handleChange('county')}
              />
            </div>
          </div>

          <div className="onboarding-step__field onboarding-step__field--half">
            <label htmlFor="postcode" className="onboarding-step__label onboarding-step__label--required">
              {t('companyDetails.address.postcode.label')}
            </label>
            <input
              id="postcode"
              type="text"
              className={`onboarding-step__input ${errors.postcode ? 'onboarding-step__input--error' : ''}`}
              placeholder={t('companyDetails.address.postcode.placeholder')}
              value={data.postcode || ''}
              onChange={handleChange('postcode')}
              required
            />
            {errors.postcode && (
              <p className="onboarding-step__error" role="alert">
                {errors.postcode}
              </p>
            )}
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="onboarding-step__form-section">
          <h4 className="onboarding-step__section-title">{t('companyDetails.contact.title')}</h4>
          
          <div className="onboarding-step__field">
            <label htmlFor="business-email" className="onboarding-step__label">
              {t('companyDetails.contact.email.label')}
            </label>
            <input
              id="business-email"
              type="email"
              className="onboarding-step__input"
              placeholder={t('companyDetails.contact.email.placeholder')}
              value={data.businessEmail || ''}
              onChange={handleChange('businessEmail')}
            />
          </div>

          <div className="onboarding-step__field">
            <label htmlFor="business-phone" className="onboarding-step__label">
              {t('companyDetails.contact.phone.label')}
            </label>
            <input
              id="business-phone"
              type="tel"
              className="onboarding-step__input"
              placeholder={t('companyDetails.contact.phone.placeholder')}
              value={data.businessPhone || ''}
              onChange={handleChange('businessPhone')}
            />
          </div>

          <div className="onboarding-step__field">
            <label htmlFor="website" className="onboarding-step__label">
              {t('companyDetails.contact.website.label')}
            </label>
            <input
              id="website"
              type="url"
              className="onboarding-step__input"
              placeholder={t('companyDetails.contact.website.placeholder')}
              value={data.website || ''}
              onChange={handleChange('website')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

CompanyDetailsStep.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  errors: PropTypes.object,
};

CompanyDetailsStep.defaultProps = {
  errors: {},
};

export default CompanyDetailsStep;
