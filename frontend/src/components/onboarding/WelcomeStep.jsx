import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * WelcomeStep Component
 * 
 * The first step of the onboarding wizard.
 * Introduces users to the app and what it helps with.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Function} props.onNext - Function to go to next step
 */
const WelcomeStep = ({ data, updateData, onNext }) => {
  const { t } = useTranslation('onboarding');

  return (
    <div className="onboarding-step onboarding-step--welcome">
      <div className="onboarding-step__icon">
        <svg
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="32" cy="32" r="28" />
          <path d="M32 18v14l10 6" />
          <path d="M32 46v2" />
        </svg>
      </div>

      <h3 className="onboarding-step__title">{t('welcome.title')}</h3>
      <p className="onboarding-step__subtitle">{t('welcome.subtitle')}</p>
      
      <p className="onboarding-step__description">{t('welcome.description')}</p>

      <div className="onboarding-step__features">
        <h4 className="onboarding-step__features-title">{t('welcome.features.title')}</h4>
        <ul className="onboarding-step__features-list">
          <li className="onboarding-step__feature">
            <svg className="onboarding-step__feature-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('welcome.features.trackIncome')}</span>
          </li>
          <li className="onboarding-step__feature">
            <svg className="onboarding-step__feature-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('welcome.features.manageInvoices')}</span>
          </li>
          <li className="onboarding-step__feature">
            <svg className="onboarding-step__feature-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('welcome.features.vatReturns')}</span>
          </li>
          <li className="onboarding-step__feature">
            <svg className="onboarding-step__feature-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('welcome.features.taxReports')}</span>
          </li>
          <li className="onboarding-step__feature">
            <svg className="onboarding-step__feature-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t('welcome.features.bankReconciliation')}</span>
          </li>
        </ul>
      </div>

      <p className="onboarding-step__call-to-action">{t('welcome.letsBegin')}</p>
      
      <div className="onboarding-step__time-estimate">
        <svg className="onboarding-step__time-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        <span>{t('welcome.estimatedTime')}</span>
      </div>

      <button
        type="button"
        className="onboarding-step__cta-button"
        onClick={onNext}
      >
        {t('wizard.getStarted')}
      </button>
    </div>
  );
};

WelcomeStep.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

export default WelcomeStep;
