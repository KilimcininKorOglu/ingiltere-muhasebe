import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import WelcomeStep from './WelcomeStep';
import BusinessTypeStep from './BusinessTypeStep';
import VatStatusStep from './VatStatusStep';
import TaxYearStep from './TaxYearStep';
import CompanyDetailsStep from './CompanyDetailsStep';
import BankAccountStep from './BankAccountStep';
import FeatureTour from './FeatureTour';
import GettingStartedChecklist from './GettingStartedChecklist';

/**
 * Step configuration for the onboarding wizard.
 * Each step has a key that maps to a component.
 */
const WIZARD_STEPS = [
  { key: 'welcome', component: WelcomeStep },
  { key: 'businessType', component: BusinessTypeStep },
  { key: 'vatStatus', component: VatStatusStep },
  { key: 'taxYear', component: TaxYearStep },
  { key: 'companyDetails', component: CompanyDetailsStep },
  { key: 'bankAccount', component: BankAccountStep },
  { key: 'tour', component: FeatureTour },
  { key: 'checklist', component: GettingStartedChecklist },
];

/**
 * Default onboarding data structure
 */
const DEFAULT_ONBOARDING_DATA = {
  businessType: null,
  isVatRegistered: false,
  vatNumber: '',
  vatScheme: 'standard',
  taxYearConfirmed: false,
  companyYearEnd: '',
  businessName: '',
  tradingName: '',
  companyNumber: '',
  utr: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  businessEmail: '',
  businessPhone: '',
  website: '',
  bankAccount: null,
};

/**
 * LocalStorage key for persisting onboarding progress
 */
const STORAGE_KEY = 'onboardingProgress';

/**
 * OnboardingWizard Component
 * 
 * A step-by-step wizard that guides new users through initial account setup.
 * Supports progress saving, skipping with reminders, and different paths
 * based on business type.
 * 
 * @param {Object} props - Component props
 * @param {Function} [props.onComplete] - Callback when onboarding is completed
 * @param {Function} [props.onSkip] - Callback when onboarding is skipped
 * @param {number} [props.initialStep=0] - Initial step to start from
 * @param {Object} [props.initialData] - Initial data to populate the wizard
 * @param {boolean} [props.isOpen=true] - Whether the wizard is open
 * @param {Function} [props.onClose] - Callback when wizard is closed
 */
const OnboardingWizard = ({
  onComplete,
  onSkip,
  initialStep = 0,
  initialData = null,
  isOpen = true,
  onClose,
}) => {
  const { t } = useTranslation('onboarding');
  
  // Current step index
  const [currentStep, setCurrentStep] = useState(initialStep);
  
  // Onboarding data collected from all steps
  const [data, setData] = useState(() => {
    // Try to restore from localStorage
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        return { ...DEFAULT_ONBOARDING_DATA, ...parsed.data };
      } catch {
        // Ignore parse errors
      }
    }
    return { ...DEFAULT_ONBOARDING_DATA, ...initialData };
  });
  
  // Track if user is confirming skip
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  
  // Track step validation errors
  const [stepErrors, setStepErrors] = useState({});

  /**
   * Restore step from localStorage on mount
   */
  useEffect(() => {
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress && initialStep === 0) {
      try {
        const parsed = JSON.parse(savedProgress);
        if (parsed.step > 0) {
          setCurrentStep(parsed.step);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [initialStep]);

  /**
   * Save progress to localStorage whenever data or step changes
   */
  useEffect(() => {
    const progress = {
      step: currentStep,
      data: data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [currentStep, data]);

  /**
   * Update data from a step
   */
  const updateData = useCallback((stepData) => {
    setData((prev) => ({ ...prev, ...stepData }));
    // Clear errors for updated fields
    setStepErrors({});
  }, []);

  /**
   * Validate current step before proceeding
   * Returns true if valid, false otherwise
   */
  const validateCurrentStep = useCallback(() => {
    const step = WIZARD_STEPS[currentStep];
    const errors = {};

    switch (step.key) {
      case 'businessType':
        if (!data.businessType) {
          errors.businessType = t('validation.businessTypeRequired');
        }
        break;
      case 'vatStatus':
        if (data.isVatRegistered && !data.vatNumber) {
          errors.vatNumber = t('validation.vatNumberRequired');
        }
        if (data.isVatRegistered && data.vatNumber && !/^GB\d{9}$/i.test(data.vatNumber.replace(/\s/g, ''))) {
          errors.vatNumber = t('validation.invalidVatNumber');
        }
        break;
      case 'companyDetails':
        if (!data.businessName) {
          errors.businessName = t('validation.businessNameRequired');
        }
        if (!data.addressLine1) {
          errors.addressLine1 = t('validation.addressRequired');
        }
        if (!data.postcode) {
          errors.postcode = t('validation.postcodeRequired');
        }
        // Simple UK postcode validation
        if (data.postcode && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(data.postcode)) {
          errors.postcode = t('validation.invalidPostcode');
        }
        break;
      default:
        // No validation for other steps
        break;
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStep, data, t]);

  /**
   * Determine if a step should be shown based on business type
   */
  const shouldShowStep = useCallback((stepKey) => {
    // Company number field is only for limited companies
    // but the step itself is always shown
    return true;
  }, []);

  /**
   * Get the filtered list of steps based on business type
   */
  const getVisibleSteps = useCallback(() => {
    return WIZARD_STEPS.filter((step) => shouldShowStep(step.key));
  }, [shouldShowStep]);

  /**
   * Navigate to the next step
   */
  const goToNextStep = useCallback(() => {
    if (!validateCurrentStep()) {
      return;
    }

    const visibleSteps = getVisibleSteps();
    const currentVisibleIndex = visibleSteps.findIndex(
      (step) => step.key === WIZARD_STEPS[currentStep].key
    );

    if (currentVisibleIndex < visibleSteps.length - 1) {
      const nextStepKey = visibleSteps[currentVisibleIndex + 1].key;
      const nextStepIndex = WIZARD_STEPS.findIndex((step) => step.key === nextStepKey);
      setCurrentStep(nextStepIndex);
    } else {
      // Last step - complete onboarding
      // Clear saved progress
      localStorage.removeItem(STORAGE_KEY);
      
      if (onComplete) {
        onComplete(data);
      }
    }
  }, [currentStep, validateCurrentStep, getVisibleSteps, data, onComplete]);

  /**
   * Navigate to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    const visibleSteps = getVisibleSteps();
    const currentVisibleIndex = visibleSteps.findIndex(
      (step) => step.key === WIZARD_STEPS[currentStep].key
    );

    if (currentVisibleIndex > 0) {
      const prevStepKey = visibleSteps[currentVisibleIndex - 1].key;
      const prevStepIndex = WIZARD_STEPS.findIndex((step) => step.key === prevStepKey);
      setCurrentStep(prevStepIndex);
    }
  }, [currentStep, getVisibleSteps]);

  /**
   * Handle onboarding completion
   */
  const handleComplete = useCallback(() => {
    // Clear saved progress
    localStorage.removeItem(STORAGE_KEY);
    
    if (onComplete) {
      onComplete(data);
    }
  }, [data, onComplete]);

  /**
   * Handle skip button click
   */
  const handleSkipClick = useCallback(() => {
    setShowSkipConfirm(true);
  }, []);

  /**
   * Confirm skip
   */
  const confirmSkip = useCallback(() => {
    // Save partial progress but mark as skipped
    const progress = {
      step: currentStep,
      data: data,
      skipped: true,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    
    setShowSkipConfirm(false);
    
    if (onSkip) {
      onSkip(data);
    }
  }, [currentStep, data, onSkip]);

  /**
   * Cancel skip
   */
  const cancelSkip = useCallback(() => {
    setShowSkipConfirm(false);
  }, []);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const visibleSteps = getVisibleSteps();
  const currentStepConfig = WIZARD_STEPS[currentStep];
  const CurrentStepComponent = currentStepConfig.component;
  
  const currentVisibleIndex = visibleSteps.findIndex(
    (step) => step.key === currentStepConfig.key
  );
  
  const isFirstStep = currentVisibleIndex === 0;
  const isLastStep = currentVisibleIndex === visibleSteps.length - 1;
  const isChecklistStep = currentStepConfig.key === 'checklist';

  return (
    <div className="onboarding-wizard" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      {/* Skip confirmation dialog */}
      {showSkipConfirm && (
        <div className="onboarding-wizard__overlay">
          <div className="onboarding-wizard__confirm-dialog" role="alertdialog" aria-labelledby="skip-confirm-title">
            <h3 id="skip-confirm-title">{t('wizard.skip')}</h3>
            <p>{t('wizard.skipConfirm')}</p>
            <div className="onboarding-wizard__confirm-actions">
              <button
                type="button"
                className="onboarding-wizard__button onboarding-wizard__button--secondary"
                onClick={cancelSkip}
              >
                {t('wizard.back')}
              </button>
              <button
                type="button"
                className="onboarding-wizard__button onboarding-wizard__button--danger"
                onClick={confirmSkip}
              >
                {t('wizard.skip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main wizard content */}
      <div className="onboarding-wizard__container">
        {/* Header with progress */}
        <header className="onboarding-wizard__header">
          <h2 id="onboarding-title" className="onboarding-wizard__title">
            {t('wizard.title')}
          </h2>
          
          {/* Progress indicator */}
          <div className="onboarding-wizard__progress" aria-label={t('wizard.progress', { current: currentVisibleIndex + 1, total: visibleSteps.length })}>
            <div className="onboarding-wizard__progress-bar">
              <div
                className="onboarding-wizard__progress-fill"
                style={{ width: `${((currentVisibleIndex + 1) / visibleSteps.length) * 100}%` }}
              />
            </div>
            <span className="onboarding-wizard__progress-text">
              {t('wizard.progress', { current: currentVisibleIndex + 1, total: visibleSteps.length })}
            </span>
          </div>

          {/* Step indicators */}
          <nav className="onboarding-wizard__steps" aria-label="Onboarding steps">
            {visibleSteps.map((step, index) => (
              <div
                key={step.key}
                className={`onboarding-wizard__step-indicator ${
                  index === currentVisibleIndex
                    ? 'onboarding-wizard__step-indicator--active'
                    : index < currentVisibleIndex
                    ? 'onboarding-wizard__step-indicator--completed'
                    : ''
                }`}
                aria-current={index === currentVisibleIndex ? 'step' : undefined}
              >
                <span className="onboarding-wizard__step-number">{index + 1}</span>
                <span className="onboarding-wizard__step-name">{t(`steps.${step.key}`)}</span>
              </div>
            ))}
          </nav>
        </header>

        {/* Step content */}
        <main className="onboarding-wizard__content">
          <CurrentStepComponent
            data={data}
            updateData={updateData}
            errors={stepErrors}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            onComplete={handleComplete}
          />
        </main>

        {/* Footer with navigation */}
        {!isChecklistStep && (
          <footer className="onboarding-wizard__footer">
            <div className="onboarding-wizard__footer-left">
              {!isFirstStep && (
                <button
                  type="button"
                  className="onboarding-wizard__button onboarding-wizard__button--secondary"
                  onClick={goToPreviousStep}
                >
                  {t('wizard.back')}
                </button>
              )}
            </div>
            
            <div className="onboarding-wizard__footer-center">
              <button
                type="button"
                className="onboarding-wizard__skip-button"
                onClick={handleSkipClick}
              >
                {t('wizard.skip')}
              </button>
            </div>
            
            <div className="onboarding-wizard__footer-right">
              <button
                type="button"
                className="onboarding-wizard__button onboarding-wizard__button--primary"
                onClick={goToNextStep}
              >
                {isLastStep ? t('wizard.finish') : t('wizard.next')}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

OnboardingWizard.propTypes = {
  onComplete: PropTypes.func,
  onSkip: PropTypes.func,
  initialStep: PropTypes.number,
  initialData: PropTypes.object,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default OnboardingWizard;
