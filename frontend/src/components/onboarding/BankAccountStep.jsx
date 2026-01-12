import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Account type options
 */
const ACCOUNT_TYPES = ['current', 'savings', 'business'];

/**
 * Currency options
 */
const CURRENCIES = ['GBP', 'EUR', 'USD'];

/**
 * BankAccountStep Component
 * 
 * Optional step to add a bank account.
 * Users can skip this step and add accounts later.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Current onboarding data
 * @param {Function} props.updateData - Function to update data
 * @param {Object} props.errors - Validation errors
 */
const BankAccountStep = ({ data, updateData, errors }) => {
  const { t } = useTranslation('onboarding');
  
  // Track whether user wants to add a bank account
  const [showForm, setShowForm] = useState(!!data.bankAccount);
  
  // Local bank account form state
  const [bankData, setBankData] = useState(data.bankAccount || {
    accountName: '',
    bankName: '',
    accountType: 'current',
    sortCode: '',
    accountNumber: '',
    openingBalance: '',
    currency: 'GBP',
  });

  /**
   * Handle showing the form
   */
  const handleShowForm = useCallback(() => {
    setShowForm(true);
  }, []);

  /**
   * Handle skipping bank account
   */
  const handleSkip = useCallback(() => {
    setShowForm(false);
    updateData({ bankAccount: null });
  }, [updateData]);

  /**
   * Handle bank form field change
   */
  const handleChange = useCallback((field) => (e) => {
    const value = e.target.value;
    const newData = { ...bankData, [field]: value };
    setBankData(newData);
    updateData({ bankAccount: newData });
  }, [bankData, updateData]);

  /**
   * Format sort code with dashes (XX-XX-XX)
   */
  const handleSortCodeChange = useCallback((e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 6) {
      value = value.slice(0, 6);
    }
    // Format with dashes
    if (value.length > 4) {
      value = `${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4)}`;
    } else if (value.length > 2) {
      value = `${value.slice(0, 2)}-${value.slice(2)}`;
    }
    const newData = { ...bankData, sortCode: value };
    setBankData(newData);
    updateData({ bankAccount: newData });
  }, [bankData, updateData]);

  /**
   * Handle account number change (8 digits only)
   */
  const handleAccountNumberChange = useCallback((e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 8) {
      value = value.slice(0, 8);
    }
    const newData = { ...bankData, accountNumber: value };
    setBankData(newData);
    updateData({ bankAccount: newData });
  }, [bankData, updateData]);

  return (
    <div className="onboarding-step onboarding-step--bank-account">
      <h3 className="onboarding-step__title">{t('bankAccount.title')}</h3>
      <p className="onboarding-step__subtitle">{t('bankAccount.subtitle')}</p>

      {/* Optional notice */}
      <div className="onboarding-step__optional-notice">
        <svg className="onboarding-step__optional-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span>{t('bankAccount.optional')}</span>
      </div>

      {!showForm ? (
        <>
          {/* Benefits */}
          <div className="onboarding-step__benefits">
            <h4 className="onboarding-step__benefits-title">{t('bankAccount.benefits.title')}</h4>
            <ul className="onboarding-step__benefits-list">
              <li className="onboarding-step__benefit">
                <svg className="onboarding-step__benefit-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('bankAccount.benefits.reconciliation')}</span>
              </li>
              <li className="onboarding-step__benefit">
                <svg className="onboarding-step__benefit-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('bankAccount.benefits.accuracy')}</span>
              </li>
              <li className="onboarding-step__benefit">
                <svg className="onboarding-step__benefit-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{t('bankAccount.benefits.reports')}</span>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="onboarding-step__actions">
            <button
              type="button"
              className="onboarding-step__action-button onboarding-step__action-button--primary"
              onClick={handleShowForm}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {t('bankAccount.addAccount')}
            </button>
          </div>
        </>
      ) : (
        <div className="onboarding-step__form">
          {/* Bank Account Form */}
          <div className="onboarding-step__form-section">
            <div className="onboarding-step__field">
              <label htmlFor="account-name" className="onboarding-step__label">
                {t('bankAccount.accountName.label')}
              </label>
              <input
                id="account-name"
                type="text"
                className="onboarding-step__input"
                placeholder={t('bankAccount.accountName.placeholder')}
                value={bankData.accountName}
                onChange={handleChange('accountName')}
                aria-describedby="account-name-hint"
              />
              <p id="account-name-hint" className="onboarding-step__field-hint">
                {t('bankAccount.accountName.hint')}
              </p>
            </div>

            <div className="onboarding-step__field">
              <label htmlFor="bank-name" className="onboarding-step__label">
                {t('bankAccount.bankName.label')}
              </label>
              <input
                id="bank-name"
                type="text"
                className="onboarding-step__input"
                placeholder={t('bankAccount.bankName.placeholder')}
                value={bankData.bankName}
                onChange={handleChange('bankName')}
                aria-describedby="bank-name-hint"
              />
              <p id="bank-name-hint" className="onboarding-step__field-hint">
                {t('bankAccount.bankName.hint')}
              </p>
            </div>

            <div className="onboarding-step__field">
              <label htmlFor="account-type" className="onboarding-step__label">
                {t('bankAccount.accountType.label')}
              </label>
              <select
                id="account-type"
                className="onboarding-step__select"
                value={bankData.accountType}
                onChange={handleChange('accountType')}
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`bankAccount.accountType.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="onboarding-step__field-row">
              <div className="onboarding-step__field onboarding-step__field--half">
                <label htmlFor="sort-code" className="onboarding-step__label">
                  {t('bankAccount.sortCode.label')}
                </label>
                <input
                  id="sort-code"
                  type="text"
                  className="onboarding-step__input"
                  placeholder={t('bankAccount.sortCode.placeholder')}
                  value={bankData.sortCode}
                  onChange={handleSortCodeChange}
                  aria-describedby="sort-code-hint"
                  maxLength={8}
                />
                <p id="sort-code-hint" className="onboarding-step__field-hint">
                  {t('bankAccount.sortCode.hint')}
                </p>
              </div>

              <div className="onboarding-step__field onboarding-step__field--half">
                <label htmlFor="account-number" className="onboarding-step__label">
                  {t('bankAccount.accountNumber.label')}
                </label>
                <input
                  id="account-number"
                  type="text"
                  className="onboarding-step__input"
                  placeholder={t('bankAccount.accountNumber.placeholder')}
                  value={bankData.accountNumber}
                  onChange={handleAccountNumberChange}
                  aria-describedby="account-number-hint"
                  maxLength={8}
                />
                <p id="account-number-hint" className="onboarding-step__field-hint">
                  {t('bankAccount.accountNumber.hint')}
                </p>
              </div>
            </div>

            <div className="onboarding-step__field-row">
              <div className="onboarding-step__field onboarding-step__field--half">
                <label htmlFor="opening-balance" className="onboarding-step__label">
                  {t('bankAccount.openingBalance.label')}
                </label>
                <input
                  id="opening-balance"
                  type="number"
                  step="0.01"
                  className="onboarding-step__input"
                  placeholder={t('bankAccount.openingBalance.placeholder')}
                  value={bankData.openingBalance}
                  onChange={handleChange('openingBalance')}
                  aria-describedby="opening-balance-hint"
                />
                <p id="opening-balance-hint" className="onboarding-step__field-hint">
                  {t('bankAccount.openingBalance.hint')}
                </p>
              </div>

              <div className="onboarding-step__field onboarding-step__field--half">
                <label htmlFor="currency" className="onboarding-step__label">
                  {t('bankAccount.currency.label')}
                </label>
                <select
                  id="currency"
                  className="onboarding-step__select"
                  value={bankData.currency}
                  onChange={handleChange('currency')}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {t(`bankAccount.currency.${currency.toLowerCase()}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Skip button */}
          <button
            type="button"
            className="onboarding-step__skip-form-button"
            onClick={handleSkip}
          >
            {t('bankAccount.skipForNow')}
          </button>
        </div>
      )}
    </div>
  );
};

BankAccountStep.propTypes = {
  data: PropTypes.object.isRequired,
  updateData: PropTypes.func.isRequired,
  errors: PropTypes.object,
};

BankAccountStep.defaultProps = {
  errors: {},
};

export default BankAccountStep;
