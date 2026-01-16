import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import SelectPeriod from './steps/SelectPeriod';
import ReviewTransactions from './steps/ReviewTransactions';
import CalculateVat from './steps/CalculateVat';
import ReviewVerify from './steps/ReviewVerify';
import FilingInstructions from './steps/FilingInstructions';
import PreflightChecks from './PreflightChecks';

const WIZARD_STEPS = [
  { key: 'selectPeriod', component: SelectPeriod },
  { key: 'reviewTransactions', component: ReviewTransactions },
  { key: 'calculateVat', component: CalculateVat },
  { key: 'reviewVerify', component: ReviewVerify },
  { key: 'filingInstructions', component: FilingInstructions },
];

const DEFAULT_VAT_DATA = {
  periodStart: '',
  periodEnd: '',
  transactions: [],
  vatReturn: null,
  previousPeriod: null,
  warnings: [],
  isSubmitted: false,
};

const STORAGE_KEY = 'vatReturnWizardProgress';

/**
 * VatReturnWizard Component
 * 
 * A step-by-step wizard for preparing and filing VAT returns.
 * Guides users through transaction review, VAT calculation,
 * verification, and provides HMRC filing instructions.
 */
const VatReturnWizard = ({
  onComplete,
  onCancel,
  initialData = null,
  isOpen = true,
  vatReturnsApi = null,
  transactionsApi = null,
}) => {
  const { t } = useTranslation('vat');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState(() => {
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        return { ...DEFAULT_VAT_DATA, ...parsed.data };
      } catch {
        // Ignore parse errors
      }
    }
    return { ...DEFAULT_VAT_DATA, ...initialData };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreflightChecks, setShowPreflightChecks] = useState(false);
  const [preflightResults, setPreflightResults] = useState(null);

  useEffect(() => {
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress && !initialData) {
      try {
        const parsed = JSON.parse(savedProgress);
        if (parsed.step > 0) {
          setCurrentStep(parsed.step);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [initialData]);

  useEffect(() => {
    const progress = {
      step: currentStep,
      data: data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [currentStep, data]);

  const updateData = useCallback((stepData) => {
    setData((prev) => ({ ...prev, ...stepData }));
    setError(null);
  }, []);

  const runPreflightChecks = useCallback(async () => {
    if (!data.periodStart || !data.periodEnd) {
      return { passed: false, results: [] };
    }

    const checks = [];
    
    // Check for transactions without VAT rate
    const transactionsWithoutVat = data.transactions.filter(
      (tx) => tx.vatRate === null || tx.vatRate === undefined
    );
    checks.push({
      id: 'transactionsWithoutVat',
      passed: transactionsWithoutVat.length === 0,
      count: transactionsWithoutVat.length,
      severity: transactionsWithoutVat.length > 0 ? 'warning' : 'success',
      message: transactionsWithoutVat.length > 0
        ? t('wizard.preflight.transactionsWithoutVat', { count: transactionsWithoutVat.length })
        : t('wizard.preflight.allTransactionsHaveVat'),
    });

    // Check for unpaid invoices marked as sent
    const unpaidSentInvoices = data.transactions.filter(
      (tx) => tx.type === 'invoice' && tx.status === 'sent' && !tx.isPaid
    );
    checks.push({
      id: 'unpaidInvoices',
      passed: unpaidSentInvoices.length === 0,
      count: unpaidSentInvoices.length,
      severity: unpaidSentInvoices.length > 0 ? 'info' : 'success',
      message: unpaidSentInvoices.length > 0
        ? t('wizard.preflight.unpaidInvoices', { count: unpaidSentInvoices.length })
        : t('wizard.preflight.allInvoicesPaid'),
    });

    // Check for bank reconciliation
    const unreconciledTransactions = data.transactions.filter(
      (tx) => !tx.isReconciled
    );
    checks.push({
      id: 'reconciliation',
      passed: unreconciledTransactions.length === 0,
      count: unreconciledTransactions.length,
      severity: unreconciledTransactions.length > 5 ? 'warning' : 'info',
      message: unreconciledTransactions.length > 0
        ? t('wizard.preflight.unreconciledTransactions', { count: unreconciledTransactions.length })
        : t('wizard.preflight.allTransactionsReconciled'),
    });

    const allPassed = checks.every((check) => check.passed);
    
    return { passed: allPassed, results: checks };
  }, [data, t]);

  const handlePeriodSelected = useCallback(async (periodStart, periodEnd) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let transactions = [];
      let previousPeriod = null;

      if (transactionsApi) {
        const response = await transactionsApi.getTransactions({
          startDate: periodStart,
          endDate: periodEnd,
        });
        transactions = response.data || [];
      }

      if (vatReturnsApi) {
        const previousReturns = await vatReturnsApi.getVatReturns({
          limit: 1,
          endDateBefore: periodStart,
        });
        if (previousReturns.data && previousReturns.data.length > 0) {
          previousPeriod = previousReturns.data[0];
        }
      }

      updateData({
        periodStart,
        periodEnd,
        transactions,
        previousPeriod,
      });

      setShowPreflightChecks(true);
      const preflightResult = await runPreflightChecks();
      setPreflightResults(preflightResult);

    } catch (err) {
      setError(err.message || t('wizard.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [transactionsApi, vatReturnsApi, updateData, runPreflightChecks, t]);

  const calculateVatReturn = useCallback(async () => {
    if (!data.periodStart || !data.periodEnd) {
      return null;
    }

    const outputVatTransactions = data.transactions.filter((tx) => tx.type === 'income');
    const inputVatTransactions = data.transactions.filter((tx) => tx.type === 'expense');

    const box1 = outputVatTransactions.reduce((sum, tx) => sum + (tx.vatAmount || 0), 0);
    const box2 = 0; // EC acquisitions - placeholder for Phase 1
    const box3 = box1 + box2;
    const box4 = inputVatTransactions.reduce((sum, tx) => sum + (tx.vatAmount || 0), 0);
    const box5 = box3 - box4;
    const box6 = outputVatTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const box7 = inputVatTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const box8 = 0; // EC supplies - placeholder for Phase 1
    const box9 = 0; // EC acquisitions - placeholder for Phase 1

    const vatReturn = {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      box1: Math.round(box1),
      box2: Math.round(box2),
      box3: Math.round(box3),
      box4: Math.round(box4),
      box5: Math.round(box5),
      box6: Math.round(box6),
      box7: Math.round(box7),
      box8: Math.round(box8),
      box9: Math.round(box9),
      status: 'draft',
      transactionCount: data.transactions.length,
      outputVatBreakdown: calculateVatBreakdown(outputVatTransactions),
      inputVatBreakdown: calculateVatBreakdown(inputVatTransactions),
    };

    return vatReturn;
  }, [data]);

  const calculateVatBreakdown = (transactions) => {
    const breakdown = {};
    
    transactions.forEach((tx) => {
      const rate = tx.vatRate || 0;
      if (!breakdown[rate]) {
        breakdown[rate] = {
          rate,
          count: 0,
          netAmount: 0,
          vatAmount: 0,
        };
      }
      breakdown[rate].count += 1;
      breakdown[rate].netAmount += tx.amount || 0;
      breakdown[rate].vatAmount += tx.vatAmount || 0;
    });

    return Object.values(breakdown).sort((a, b) => b.rate - a.rate);
  };

  const handleCalculateVat = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const vatReturn = await calculateVatReturn();
      updateData({ vatReturn });
    } catch (err) {
      setError(err.message || t('wizard.errors.calculationFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [calculateVatReturn, updateData, t]);

  const handleSaveVatReturn = useCallback(async () => {
    if (!data.vatReturn) {
      setError(t('wizard.errors.noVatReturn'));
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (vatReturnsApi) {
        await vatReturnsApi.createVatReturn(data.vatReturn);
      }
      updateData({ isSubmitted: true });
      return true;
    } catch (err) {
      setError(err.message || t('wizard.errors.saveFailed'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [data.vatReturn, vatReturnsApi, updateData, t]);

  const goToNextStep = useCallback(async () => {
    const currentStepConfig = WIZARD_STEPS[currentStep];

    if (currentStepConfig.key === 'calculateVat' && !data.vatReturn) {
      await handleCalculateVat();
    }

    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      if (onComplete) {
        onComplete(data);
      }
    }
  }, [currentStep, data, handleCalculateVat, onComplete]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handlePreflightContinue = useCallback(() => {
    setShowPreflightChecks(false);
    goToNextStep();
  }, [goToNextStep]);

  const handlePreflightFix = useCallback(() => {
    setShowPreflightChecks(false);
  }, []);

  const progressPercentage = useMemo(() => {
    return ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  }, [currentStep]);

  if (!isOpen) {
    return null;
  }

  const currentStepConfig = WIZARD_STEPS[currentStep];
  const CurrentStepComponent = currentStepConfig.component;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className="vat-wizard" role="dialog" aria-modal="true" aria-labelledby="vat-wizard-title">
      {showPreflightChecks && preflightResults && (
        <PreflightChecks
          results={preflightResults.results}
          onContinue={handlePreflightContinue}
          onFix={handlePreflightFix}
        />
      )}

      <div className="vat-wizard__container">
        <header className="vat-wizard__header">
          <h2 id="vat-wizard-title" className="vat-wizard__title">
            {t('wizard.title')}
          </h2>
          
          <div className="vat-wizard__progress" aria-label={t('wizard.progress', { current: currentStep + 1, total: WIZARD_STEPS.length })}>
            <div className="vat-wizard__progress-bar">
              <div
                className="vat-wizard__progress-fill"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="vat-wizard__progress-text">
              {t('wizard.progress', { current: currentStep + 1, total: WIZARD_STEPS.length })}
            </span>
          </div>

          <nav className="vat-wizard__steps" aria-label="VAT return steps">
            {WIZARD_STEPS.map((step, index) => (
              <div
                key={step.key}
                className={`vat-wizard__step-indicator ${
                  index === currentStep
                    ? 'vat-wizard__step-indicator--active'
                    : index < currentStep
                    ? 'vat-wizard__step-indicator--completed'
                    : ''
                }`}
                aria-current={index === currentStep ? 'step' : undefined}
              >
                <span className="vat-wizard__step-number">{index + 1}</span>
                <span className="vat-wizard__step-name">{t(`wizard.steps.${step.key}`)}</span>
              </div>
            ))}
          </nav>
        </header>

        {error && (
          <div className="vat-wizard__error" role="alert">
            <span className="vat-wizard__error-icon">!</span>
            <span className="vat-wizard__error-message">{error}</span>
            <button
              type="button"
              className="vat-wizard__error-dismiss"
              onClick={() => setError(null)}
              aria-label={t('wizard.dismissError')}
            >
              x
            </button>
          </div>
        )}

        <main className="vat-wizard__content">
          {isLoading ? (
            <div className="vat-wizard__loading">
              <div className="vat-wizard__spinner" aria-hidden="true" />
              <span>{t('wizard.loading')}</span>
            </div>
          ) : (
            <CurrentStepComponent
              data={data}
              updateData={updateData}
              onPeriodSelected={handlePeriodSelected}
              onCalculateVat={handleCalculateVat}
              onSaveVatReturn={handleSaveVatReturn}
              isLoading={isLoading}
            />
          )}
        </main>

        <footer className="vat-wizard__footer">
          <div className="vat-wizard__footer-left">
            {!isFirstStep && (
              <button
                type="button"
                className="vat-wizard__button vat-wizard__button--secondary"
                onClick={goToPreviousStep}
                disabled={isLoading}
              >
                {t('wizard.back')}
              </button>
            )}
          </div>
          
          <div className="vat-wizard__footer-center">
            <button
              type="button"
              className="vat-wizard__cancel-button"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t('wizard.cancel')}
            </button>
          </div>
          
          <div className="vat-wizard__footer-right">
            <button
              type="button"
              className="vat-wizard__button vat-wizard__button--primary"
              onClick={goToNextStep}
              disabled={isLoading || (currentStepConfig.key === 'selectPeriod' && !data.periodStart)}
            >
              {isLastStep ? t('wizard.finish') : t('wizard.next')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

VatReturnWizard.propTypes = {
  onComplete: PropTypes.func,
  onCancel: PropTypes.func,
  initialData: PropTypes.object,
  isOpen: PropTypes.bool,
  vatReturnsApi: PropTypes.shape({
    getVatReturns: PropTypes.func,
    createVatReturn: PropTypes.func,
  }),
  transactionsApi: PropTypes.shape({
    getTransactions: PropTypes.func,
  }),
};

export default VatReturnWizard;
