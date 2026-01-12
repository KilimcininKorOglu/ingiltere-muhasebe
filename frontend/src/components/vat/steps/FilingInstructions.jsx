import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import useFormatters from '../../../hooks/useFormatters';

/**
 * FilingInstructions Step Component
 * 
 * Provides step-by-step instructions for filing the VAT return with HMRC.
 * Includes links to HMRC portal and box value mapping.
 */
const FilingInstructions = ({ data }) => {
  const { t } = useTranslation('vat');
  const { formatCurrency, formatDate } = useFormatters();

  const vatReturn = data.vatReturn;

  const hmrcPortalUrl = 'https://www.gov.uk/vat-returns';
  const hmrcLoginUrl = 'https://www.gov.uk/log-in-register-hmrc-online-services';

  const filingSteps = [
    {
      number: 1,
      title: t('wizard.filingInstructions.step1Title'),
      description: t('wizard.filingInstructions.step1Description'),
      link: hmrcLoginUrl,
      linkText: t('wizard.filingInstructions.goToHmrc'),
    },
    {
      number: 2,
      title: t('wizard.filingInstructions.step2Title'),
      description: t('wizard.filingInstructions.step2Description'),
    },
    {
      number: 3,
      title: t('wizard.filingInstructions.step3Title'),
      description: t('wizard.filingInstructions.step3Description'),
    },
    {
      number: 4,
      title: t('wizard.filingInstructions.step4Title'),
      description: t('wizard.filingInstructions.step4Description'),
    },
    {
      number: 5,
      title: t('wizard.filingInstructions.step5Title'),
      description: t('wizard.filingInstructions.step5Description'),
    },
    {
      number: 6,
      title: t('wizard.filingInstructions.step6Title'),
      description: t('wizard.filingInstructions.step6Description'),
    },
  ];

  const boxMappings = vatReturn ? [
    { box: 1, label: t('wizard.calculateVat.box1Label'), value: vatReturn.box1 },
    { box: 2, label: t('wizard.calculateVat.box2Label'), value: vatReturn.box2 },
    { box: 3, label: t('wizard.calculateVat.box3Label'), value: vatReturn.box3 },
    { box: 4, label: t('wizard.calculateVat.box4Label'), value: vatReturn.box4 },
    { box: 5, label: t('wizard.calculateVat.box5Label'), value: vatReturn.box5 },
    { box: 6, label: t('wizard.calculateVat.box6Label'), value: vatReturn.box6 },
    { box: 7, label: t('wizard.calculateVat.box7Label'), value: vatReturn.box7 },
    { box: 8, label: t('wizard.calculateVat.box8Label'), value: vatReturn.box8 },
    { box: 9, label: t('wizard.calculateVat.box9Label'), value: vatReturn.box9 },
  ] : [];

  const handlePrint = () => {
    window.print();
  };

  const handleCopyValues = () => {
    const text = boxMappings
      .map((box) => `Box ${box.box}: ${formatCurrency(box.value)}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="vat-step filing-instructions">
      <h3 className="vat-step__title">{t('wizard.filingInstructions.title')}</h3>
      <p className="vat-step__description">{t('wizard.filingInstructions.description')}</p>

      {data.isSubmitted && (
        <div className="filing-instructions__success">
          <span className="filing-instructions__success-icon">✓</span>
          <div className="filing-instructions__success-content">
            <h4>{t('wizard.filingInstructions.vatReturnSaved')}</h4>
            <p>{t('wizard.filingInstructions.savedDescription')}</p>
          </div>
        </div>
      )}

      {vatReturn && (
        <div className="filing-instructions__period-info">
          <h4>{t('wizard.filingInstructions.periodInfo')}</h4>
          <p>
            <strong>{t('wizard.reviewVerify.period')}:</strong>{' '}
            {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
          </p>
          <p>
            <strong>{t('wizard.filingInstructions.netVat')}:</strong>{' '}
            <span className={vatReturn.box5 >= 0 ? 'filing-instructions__owe' : 'filing-instructions__reclaim'}>
              {vatReturn.box5 >= 0 ? t('wizard.filingInstructions.toPay') : t('wizard.filingInstructions.toReclaim')}:{' '}
              {formatCurrency(Math.abs(vatReturn.box5))}
            </span>
          </p>
        </div>
      )}

      <div className="filing-instructions__steps">
        <h4>{t('wizard.filingInstructions.stepsTitle')}</h4>
        <ol className="filing-instructions__step-list">
          {filingSteps.map((step) => (
            <li key={step.number} className="filing-instructions__step">
              <div className="filing-instructions__step-number">{step.number}</div>
              <div className="filing-instructions__step-content">
                <h5 className="filing-instructions__step-title">{step.title}</h5>
                <p className="filing-instructions__step-description">{step.description}</p>
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="filing-instructions__step-link"
                  >
                    {step.linkText} →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {vatReturn && (
        <div className="filing-instructions__box-values">
          <div className="filing-instructions__box-header">
            <h4>{t('wizard.filingInstructions.boxValuesTitle')}</h4>
            <div className="filing-instructions__box-actions">
              <button
                type="button"
                className="filing-instructions__action-btn"
                onClick={handleCopyValues}
              >
                {t('wizard.filingInstructions.copyValues')}
              </button>
              <button
                type="button"
                className="filing-instructions__action-btn"
                onClick={handlePrint}
              >
                {t('wizard.filingInstructions.print')}
              </button>
            </div>
          </div>
          <p className="filing-instructions__box-description">
            {t('wizard.filingInstructions.boxValuesDescription')}
          </p>
          <table className="filing-instructions__box-table">
            <thead>
              <tr>
                <th>{t('wizard.filingInstructions.hmrcBox')}</th>
                <th>{t('wizard.filingInstructions.description')}</th>
                <th>{t('wizard.filingInstructions.enterValue')}</th>
              </tr>
            </thead>
            <tbody>
              {boxMappings.map((box) => (
                <tr key={box.box} className={box.box === 5 ? 'filing-instructions__box-row--highlight' : ''}>
                  <td className="filing-instructions__box-number-cell">Box {box.box}</td>
                  <td>{box.label}</td>
                  <td className="filing-instructions__box-value">{formatCurrency(box.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="filing-instructions__deadlines">
        <h4>{t('wizard.filingInstructions.deadlinesTitle')}</h4>
        <div className="filing-instructions__deadline-info">
          <p>{t('wizard.filingInstructions.deadlinesDescription')}</p>
          <ul>
            <li>{t('wizard.filingInstructions.filingDeadline')}</li>
            <li>{t('wizard.filingInstructions.paymentDeadline')}</li>
          </ul>
        </div>
      </div>

      <div className="filing-instructions__help">
        <h4>{t('wizard.filingInstructions.needHelp')}</h4>
        <p>{t('wizard.filingInstructions.helpDescription')}</p>
        <ul className="filing-instructions__help-links">
          <li>
            <a href={hmrcPortalUrl} target="_blank" rel="noopener noreferrer">
              {t('wizard.filingInstructions.hmrcVatReturns')}
            </a>
          </li>
          <li>
            <a href="https://www.gov.uk/vat-rates" target="_blank" rel="noopener noreferrer">
              {t('wizard.filingInstructions.vatRatesGuide')}
            </a>
          </li>
          <li>
            <a href="https://www.gov.uk/pay-vat" target="_blank" rel="noopener noreferrer">
              {t('wizard.filingInstructions.payVat')}
            </a>
          </li>
        </ul>
      </div>

      <div className="filing-instructions__disclaimer">
        <p>
          <strong>{t('wizard.filingInstructions.important')}:</strong>{' '}
          {t('wizard.filingInstructions.disclaimerText')}
        </p>
      </div>
    </div>
  );
};

FilingInstructions.propTypes = {
  data: PropTypes.shape({
    vatReturn: PropTypes.shape({
      periodStart: PropTypes.string,
      periodEnd: PropTypes.string,
      box1: PropTypes.number,
      box2: PropTypes.number,
      box3: PropTypes.number,
      box4: PropTypes.number,
      box5: PropTypes.number,
      box6: PropTypes.number,
      box7: PropTypes.number,
      box8: PropTypes.number,
      box9: PropTypes.number,
    }),
    isSubmitted: PropTypes.bool,
  }).isRequired,
};

export default FilingInstructions;
