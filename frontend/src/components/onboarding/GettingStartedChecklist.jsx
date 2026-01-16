import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Checklist items with their completion conditions
 */
const CHECKLIST_ITEMS = [
  { key: 'profile', field: 'businessName' },
  { key: 'bankAccount', field: 'bankAccount' },
  { key: 'firstTransaction', field: null }, // Requires external data
  { key: 'firstInvoice', field: null }, // Requires external data
  { key: 'setupVat', field: 'isVatRegistered', condition: (data) => !data.isVatRegistered || !!data.vatNumber },
  { key: 'inviteAccountant', field: null }, // Future feature
];

/**
 * GettingStartedChecklist Component
 * 
 * Shows a checklist of next steps after completing the wizard.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Function} props.onComplete - Function to complete onboarding
 */
const GettingStartedChecklist = ({ data, updateData, onComplete }) => {
  const { t } = useTranslation('onboarding');

  /**
   * Calculate which items are completed based on onboarding data
   */
  const completionStatus = useMemo(() => {
    return CHECKLIST_ITEMS.map((item) => {
      if (item.condition) {
        return item.condition(data);
      }
      if (item.field) {
        return !!data[item.field];
      }
      return false;
    });
  }, [data]);

  /**
   * Count completed items
   */
  const completedCount = useMemo(() => {
    return completionStatus.filter(Boolean).length;
  }, [completionStatus]);

  /**
   * Check if all items are completed
   */
  const allComplete = completedCount === CHECKLIST_ITEMS.length;

  /**
   * Handle going to dashboard
   */
  const handleGoToDashboard = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  /**
   * Handle doing this later
   */
  const handleDoLater = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  /**
   * Get icon based on completion status
   */
  const getStatusIcon = (isComplete) => {
    if (isComplete) {
      return (
        <svg className="onboarding-checklist__item-icon onboarding-checklist__item-icon--complete" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="onboarding-checklist__item-icon onboarding-checklist__item-icon--pending" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
      </svg>
    );
  };

  return (
    <div className="onboarding-step onboarding-step--checklist">
      <h3 className="onboarding-step__title">{t('checklist.title')}</h3>
      <p className="onboarding-step__subtitle">{t('checklist.subtitle')}</p>

      {/* Progress summary */}
      <div className="onboarding-checklist__progress">
        <div className="onboarding-checklist__progress-bar">
          <div
            className="onboarding-checklist__progress-fill"
            style={{ width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` }}
          />
        </div>
        <span className="onboarding-checklist__progress-text">
          {allComplete
            ? t('checklist.allDone')
            : t('checklist.completed', { count: completedCount, total: CHECKLIST_ITEMS.length })}
        </span>
      </div>

      {/* Checklist items */}
      <ul className="onboarding-checklist__list" role="list">
        {CHECKLIST_ITEMS.map((item, index) => {
          const isComplete = completionStatus[index];
          return (
            <li
              key={item.key}
              className={`onboarding-checklist__item ${
                isComplete ? 'onboarding-checklist__item--complete' : ''
              }`}
            >
              {getStatusIcon(isComplete)}
              <div className="onboarding-checklist__item-content">
                <span className="onboarding-checklist__item-title">
                  {t(`checklist.items.${item.key}.title`)}
                </span>
                <span className="onboarding-checklist__item-description">
                  {t(`checklist.items.${item.key}.description`)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Celebration animation if all complete */}
      {allComplete && (
        <div className="onboarding-checklist__celebration" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M32 4l6 18h18l-14 10 5 18-15-11-15 11 5-18-14-10h18l6-18z" fill="#fbbf24" />
          </svg>
        </div>
      )}

      {/* Action buttons */}
      <div className="onboarding-checklist__actions">
        <button
          type="button"
          className="onboarding-step__cta-button"
          onClick={handleGoToDashboard}
        >
          {t('checklist.goToDashboard')}
        </button>
        {!allComplete && (
          <button
            type="button"
            className="onboarding-checklist__later-button"
            onClick={handleDoLater}
          >
            {t('checklist.doThisLater')}
          </button>
        )}
      </div>
    </div>
  );
};

GettingStartedChecklist.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
};

export default GettingStartedChecklist;
