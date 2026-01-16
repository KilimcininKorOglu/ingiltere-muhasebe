import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * TaxYearStep Component
 * 
 * Displays and confirms UK tax year dates (6 April - 5 April).
 * For limited companies, allows setting a different company year end.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 */
const TaxYearStep = ({ data, updateData }) => {
  const { t, i18n } = useTranslation('onboarding');

  /**
   * Calculate current tax year dates
   */
  const taxYearDates = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();

    // Tax year starts on April 6
    // If we're before April 6, we're in the previous tax year
    let startYear = currentYear;
    if (currentMonth < 3 || (currentMonth === 3 && currentDay < 6)) {
      startYear = currentYear - 1;
    }

    const startDate = new Date(startYear, 3, 6); // April 6
    const endDate = new Date(startYear + 1, 3, 5); // April 5 next year

    // Format dates based on language
    const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return {
      startYear,
      endYear: startYear + 1,
      startDate: dateFormatter.format(startDate),
      endDate: dateFormatter.format(endDate),
      taxYearLabel: `${startYear}/${(startYear + 1).toString().slice(-2)}`,
    };
  }, [i18n.language]);

  /**
   * Handle tax year confirmation
   */
  const handleConfirmTaxYear = useCallback(() => {
    updateData({ taxYearConfirmed: true });
  }, [updateData]);

  /**
   * Handle company year end change (for limited companies)
   */
  const handleCompanyYearEndChange = useCallback((e) => {
    updateData({ companyYearEnd: e.target.value });
  }, [updateData]);

  const isLimitedCompany = data.businessType === 'limited_company';

  return (
    <div className="onboarding-step onboarding-step--tax-year">
      <h3 className="onboarding-step__title">{t('taxYear.title')}</h3>
      <p className="onboarding-step__subtitle">{t('taxYear.subtitle')}</p>

      {/* Current Tax Year Display */}
      <div className="onboarding-step__tax-year-display">
        <div className="onboarding-step__tax-year-header">
          <span className="onboarding-step__tax-year-label">{t('taxYear.currentYear')}</span>
          <span className="onboarding-step__tax-year-value">{taxYearDates.taxYearLabel}</span>
        </div>
        
        <div className="onboarding-step__tax-year-dates">
          <div className="onboarding-step__tax-date">
            <span className="onboarding-step__tax-date-label">{t('taxYear.startDate.label')}</span>
            <span className="onboarding-step__tax-date-value">{taxYearDates.startDate}</span>
          </div>
          <div className="onboarding-step__tax-date-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="onboarding-step__tax-date">
            <span className="onboarding-step__tax-date-label">{t('taxYear.endDate.label')}</span>
            <span className="onboarding-step__tax-date-value">{taxYearDates.endDate}</span>
          </div>
        </div>
      </div>

      {/* Fiscal Year Info Box */}
      <div className="onboarding-step__info-box onboarding-step__info-box--large">
        <h4 className="onboarding-step__info-title">{t('taxYear.fiscalYearInfo.title')}</h4>
        <p className="onboarding-step__info-description">
          {t('taxYear.fiscalYearInfo.description')}
        </p>
        <p className="onboarding-step__info-example">
          {t('taxYear.fiscalYearInfo.example')}
        </p>
      </div>

      {/* Company Year End (for limited companies only) */}
      {isLimitedCompany && (
        <div className="onboarding-step__form-section">
          <div className="onboarding-step__field">
            <h4 className="onboarding-step__field-title">{t('taxYear.companyYearEnd.title')}</h4>
            <p className="onboarding-step__field-description">
              {t('taxYear.companyYearEnd.description')}
            </p>
            <label htmlFor="company-year-end" className="onboarding-step__label">
              {t('taxYear.companyYearEnd.label')}
            </label>
            <input
              id="company-year-end"
              type="date"
              className="onboarding-step__input"
              value={data.companyYearEnd || ''}
              onChange={handleCompanyYearEndChange}
              aria-describedby="company-year-end-hint"
            />
            <p id="company-year-end-hint" className="onboarding-step__field-hint">
              {t('taxYear.companyYearEnd.hint')}
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Visual */}
      <div className="onboarding-step__confirmation">
        <div className="onboarding-step__confirmation-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="10" width="36" height="32" rx="2" />
            <path d="M6 18h36" />
            <path d="M14 6v8" />
            <path d="M34 6v8" />
            <path d="M16 26l6 6 10-12" stroke="#22c55e" strokeWidth="3" />
          </svg>
        </div>
        <p className="onboarding-step__confirmation-text">
          {t('taxYear.dateRange', { 
            startDate: t('taxYear.startDate.value'), 
            endDate: t('taxYear.endDate.value') 
          })}
        </p>
      </div>
    </div>
  );
};

TaxYearStep.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
};

export default TaxYearStep;
