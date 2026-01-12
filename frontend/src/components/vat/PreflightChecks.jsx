import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * PreflightChecks Component
 * 
 * Displays the results of pre-flight checks before VAT return processing.
 * Shows warnings and issues that should be addressed before filing.
 */
const PreflightChecks = ({ results, onContinue, onFix }) => {
  const { t } = useTranslation('vat');

  const hasWarnings = results.some((r) => r.severity === 'warning' && !r.passed);
  const hasErrors = results.some((r) => r.severity === 'error' && !r.passed);
  const allPassed = results.every((r) => r.passed);

  const getSeverityIcon = (severity, passed) => {
    if (passed) return '✓';
    switch (severity) {
      case 'error':
        return '✕';
      case 'warning':
        return '!';
      case 'info':
        return 'i';
      default:
        return '•';
    }
  };

  const getSeverityClass = (severity, passed) => {
    if (passed) return 'preflight-check--success';
    switch (severity) {
      case 'error':
        return 'preflight-check--error';
      case 'warning':
        return 'preflight-check--warning';
      case 'info':
        return 'preflight-check--info';
      default:
        return '';
    }
  };

  return (
    <div className="preflight-checks" role="dialog" aria-labelledby="preflight-title">
      <div className="preflight-checks__overlay" />
      <div className="preflight-checks__content">
        <header className="preflight-checks__header">
          <h3 id="preflight-title" className="preflight-checks__title">
            {t('wizard.preflight.title')}
          </h3>
          <p className="preflight-checks__description">
            {t('wizard.preflight.description')}
          </p>
        </header>

        <div className="preflight-checks__results">
          {results.map((check) => (
            <div
              key={check.id}
              className={`preflight-check ${getSeverityClass(check.severity, check.passed)}`}
            >
              <span className="preflight-check__icon" aria-hidden="true">
                {getSeverityIcon(check.severity, check.passed)}
              </span>
              <span className="preflight-check__message">{check.message}</span>
              {check.count > 0 && !check.passed && (
                <span className="preflight-check__count">
                  ({check.count})
                </span>
              )}
            </div>
          ))}
        </div>

        {allPassed && (
          <div className="preflight-checks__success">
            <span className="preflight-checks__success-icon" aria-hidden="true">✓</span>
            <span>{t('wizard.preflight.allChecksPassed')}</span>
          </div>
        )}

        {!allPassed && (
          <div className="preflight-checks__warning-notice">
            {hasErrors ? (
              <p>{t('wizard.preflight.hasErrors')}</p>
            ) : hasWarnings ? (
              <p>{t('wizard.preflight.hasWarnings')}</p>
            ) : (
              <p>{t('wizard.preflight.hasInfo')}</p>
            )}
          </div>
        )}

        <footer className="preflight-checks__footer">
          <button
            type="button"
            className="preflight-checks__button preflight-checks__button--secondary"
            onClick={onFix}
          >
            {t('wizard.preflight.fixIssues')}
          </button>
          <button
            type="button"
            className="preflight-checks__button preflight-checks__button--primary"
            onClick={onContinue}
            disabled={hasErrors}
          >
            {t('wizard.preflight.continue')}
          </button>
        </footer>
      </div>
    </div>
  );
};

PreflightChecks.propTypes = {
  results: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      passed: PropTypes.bool.isRequired,
      severity: PropTypes.oneOf(['success', 'info', 'warning', 'error']).isRequired,
      message: PropTypes.string.isRequired,
      count: PropTypes.number,
    })
  ).isRequired,
  onContinue: PropTypes.func.isRequired,
  onFix: PropTypes.func.isRequired,
};

export default PreflightChecks;
