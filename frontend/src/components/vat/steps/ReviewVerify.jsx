import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import useFormatters from '../../../hooks/useFormatters';

/**
 * ReviewVerify Step Component
 * 
 * Final review of VAT return before saving.
 * Shows comparison with previous period and warnings for unusual values.
 */
const ReviewVerify = ({ data, onSaveVatReturn }) => {
  const { t } = useTranslation('vat');
  const { formatCurrency, formatDate, formatPercentage } = useFormatters();

  const vatReturn = data.vatReturn;
  const previousPeriod = data.previousPeriod;

  const comparison = useMemo(() => {
    if (!vatReturn || !previousPeriod) return null;

    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    return {
      box1: {
        current: vatReturn.box1,
        previous: previousPeriod.box1,
        change: calculateChange(vatReturn.box1, previousPeriod.box1),
      },
      box4: {
        current: vatReturn.box4,
        previous: previousPeriod.box4,
        change: calculateChange(vatReturn.box4, previousPeriod.box4),
      },
      box5: {
        current: vatReturn.box5,
        previous: previousPeriod.box5,
        change: calculateChange(vatReturn.box5, previousPeriod.box5),
      },
      box6: {
        current: vatReturn.box6,
        previous: previousPeriod.box6,
        change: calculateChange(vatReturn.box6, previousPeriod.box6),
      },
      box7: {
        current: vatReturn.box7,
        previous: previousPeriod.box7,
        change: calculateChange(vatReturn.box7, previousPeriod.box7),
      },
    };
  }, [vatReturn, previousPeriod]);

  const warnings = useMemo(() => {
    if (!vatReturn) return [];

    const warningsList = [];

    if (vatReturn.box5 < -10000) {
      warningsList.push({
        id: 'large-reclaim',
        severity: 'warning',
        message: t('wizard.reviewVerify.warnings.largeReclaim'),
      });
    }

    if (comparison) {
      if (Math.abs(comparison.box6.change) > 50) {
        warningsList.push({
          id: 'sales-change',
          severity: 'info',
          message: t('wizard.reviewVerify.warnings.significantSalesChange', {
            change: formatPercentage(Math.abs(comparison.box6.change) / 100),
          }),
        });
      }

      if (Math.abs(comparison.box7.change) > 50) {
        warningsList.push({
          id: 'purchases-change',
          severity: 'info',
          message: t('wizard.reviewVerify.warnings.significantPurchasesChange', {
            change: formatPercentage(Math.abs(comparison.box7.change) / 100),
          }),
        });
      }
    }

    if (vatReturn.box4 > vatReturn.box1 * 1.5) {
      warningsList.push({
        id: 'high-input-vat',
        severity: 'info',
        message: t('wizard.reviewVerify.warnings.highInputVat'),
      });
    }

    return warningsList;
  }, [vatReturn, comparison, t, formatPercentage]);

  const getChangeIndicator = (change) => {
    if (change > 0) return { icon: '↑', class: 'increase' };
    if (change < 0) return { icon: '↓', class: 'decrease' };
    return { icon: '→', class: 'unchanged' };
  };

  if (!vatReturn) {
    return (
      <div className="vat-step review-verify">
        <h3 className="vat-step__title">{t('wizard.reviewVerify.title')}</h3>
        <p className="vat-step__error">{t('wizard.reviewVerify.noVatReturn')}</p>
      </div>
    );
  }

  return (
    <div className="vat-step review-verify">
      <h3 className="vat-step__title">{t('wizard.reviewVerify.title')}</h3>
      <p className="vat-step__description">{t('wizard.reviewVerify.description')}</p>

      <div className="review-verify__period">
        <h4>{t('wizard.reviewVerify.returnDetails')}</h4>
        <div className="review-verify__detail-row">
          <span className="review-verify__detail-label">{t('wizard.reviewVerify.period')}</span>
          <span className="review-verify__detail-value">
            {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
          </span>
        </div>
        <div className="review-verify__detail-row">
          <span className="review-verify__detail-label">{t('wizard.reviewVerify.transactionCount')}</span>
          <span className="review-verify__detail-value">{vatReturn.transactionCount}</span>
        </div>
        <div className="review-verify__detail-row">
          <span className="review-verify__detail-label">{t('wizard.reviewVerify.status')}</span>
          <span className="review-verify__detail-value review-verify__status">
            {t(`wizard.reviewVerify.statusDraft`)}
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="review-verify__warnings">
          <h4>{t('wizard.reviewVerify.warningsTitle')}</h4>
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className={`review-verify__warning review-verify__warning--${warning.severity}`}
            >
              <span className="review-verify__warning-icon">
                {warning.severity === 'warning' ? '!' : 'i'}
              </span>
              <span className="review-verify__warning-message">{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="review-verify__summary">
        <h4>{t('wizard.reviewVerify.summaryTitle')}</h4>
        <table className="review-verify__summary-table">
          <thead>
            <tr>
              <th>{t('wizard.reviewVerify.box')}</th>
              <th>{t('wizard.reviewVerify.description')}</th>
              <th>{t('wizard.reviewVerify.amount')}</th>
              {comparison && <th>{t('wizard.reviewVerify.previousPeriod')}</th>}
              {comparison && <th>{t('wizard.reviewVerify.change')}</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{t('wizard.calculateVat.box1Label')}</td>
              <td className="review-verify__amount">{formatCurrency(vatReturn.box1)}</td>
              {comparison && <td className="review-verify__amount">{formatCurrency(comparison.box1.previous)}</td>}
              {comparison && (
                <td className={`review-verify__change review-verify__change--${getChangeIndicator(comparison.box1.change).class}`}>
                  {getChangeIndicator(comparison.box1.change).icon} {formatPercentage(Math.abs(comparison.box1.change) / 100)}
                </td>
              )}
            </tr>
            <tr>
              <td>4</td>
              <td>{t('wizard.calculateVat.box4Label')}</td>
              <td className="review-verify__amount">{formatCurrency(vatReturn.box4)}</td>
              {comparison && <td className="review-verify__amount">{formatCurrency(comparison.box4.previous)}</td>}
              {comparison && (
                <td className={`review-verify__change review-verify__change--${getChangeIndicator(comparison.box4.change).class}`}>
                  {getChangeIndicator(comparison.box4.change).icon} {formatPercentage(Math.abs(comparison.box4.change) / 100)}
                </td>
              )}
            </tr>
            <tr className="review-verify__summary-row--highlight">
              <td>5</td>
              <td>{t('wizard.calculateVat.box5Label')}</td>
              <td className="review-verify__amount">{formatCurrency(vatReturn.box5)}</td>
              {comparison && <td className="review-verify__amount">{formatCurrency(comparison.box5.previous)}</td>}
              {comparison && (
                <td className={`review-verify__change review-verify__change--${getChangeIndicator(comparison.box5.change).class}`}>
                  {getChangeIndicator(comparison.box5.change).icon} {formatPercentage(Math.abs(comparison.box5.change) / 100)}
                </td>
              )}
            </tr>
            <tr>
              <td>6</td>
              <td>{t('wizard.calculateVat.box6Label')}</td>
              <td className="review-verify__amount">{formatCurrency(vatReturn.box6)}</td>
              {comparison && <td className="review-verify__amount">{formatCurrency(comparison.box6.previous)}</td>}
              {comparison && (
                <td className={`review-verify__change review-verify__change--${getChangeIndicator(comparison.box6.change).class}`}>
                  {getChangeIndicator(comparison.box6.change).icon} {formatPercentage(Math.abs(comparison.box6.change) / 100)}
                </td>
              )}
            </tr>
            <tr>
              <td>7</td>
              <td>{t('wizard.calculateVat.box7Label')}</td>
              <td className="review-verify__amount">{formatCurrency(vatReturn.box7)}</td>
              {comparison && <td className="review-verify__amount">{formatCurrency(comparison.box7.previous)}</td>}
              {comparison && (
                <td className={`review-verify__change review-verify__change--${getChangeIndicator(comparison.box7.change).class}`}>
                  {getChangeIndicator(comparison.box7.change).icon} {formatPercentage(Math.abs(comparison.box7.change) / 100)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="review-verify__net-result">
        <div className={`review-verify__net-box ${
          vatReturn.box5 >= 0 ? 'review-verify__net-box--owe' : 'review-verify__net-box--reclaim'
        }`}>
          <span className="review-verify__net-label">
            {vatReturn.box5 >= 0
              ? t('wizard.calculateVat.youOwe')
              : t('wizard.calculateVat.youReclaim')}
          </span>
          <span className="review-verify__net-value">
            {formatCurrency(Math.abs(vatReturn.box5))}
          </span>
        </div>
      </div>

      <div className="review-verify__actions">
        <div className="review-verify__confirm">
          <p className="review-verify__confirm-text">
            {t('wizard.reviewVerify.confirmText')}
          </p>
          <button
            type="button"
            className="review-verify__save-btn"
            onClick={onSaveVatReturn}
          >
            {t('wizard.reviewVerify.saveVatReturn')}
          </button>
        </div>
      </div>

      <div className="review-verify__disclaimer">
        <p>{t('wizard.reviewVerify.disclaimer')}</p>
      </div>
    </div>
  );
};

ReviewVerify.propTypes = {
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
      transactionCount: PropTypes.number,
    }),
    previousPeriod: PropTypes.shape({
      box1: PropTypes.number,
      box4: PropTypes.number,
      box5: PropTypes.number,
      box6: PropTypes.number,
      box7: PropTypes.number,
    }),
  }).isRequired,
  onSaveVatReturn: PropTypes.func,
};

export default ReviewVerify;
