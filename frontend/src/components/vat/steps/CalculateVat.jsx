import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import useFormatters from '../../../hooks/useFormatters';

/**
 * CalculateVat Step Component
 * 
 * Shows the calculated VAT values for each box (1-9)
 * with explanations of what each box means.
 */
const CalculateVat = ({ data, onCalculateVat }) => {
  const { t } = useTranslation('vat');
  const { formatCurrency, formatDate } = useFormatters();

  const vatReturn = data.vatReturn;

  const boxes = useMemo(() => {
    if (!vatReturn) return [];

    return [
      {
        number: 1,
        label: t('wizard.calculateVat.box1Label'),
        description: t('wizard.calculateVat.box1Description'),
        value: vatReturn.box1,
        type: 'currency',
      },
      {
        number: 2,
        label: t('wizard.calculateVat.box2Label'),
        description: t('wizard.calculateVat.box2Description'),
        value: vatReturn.box2,
        type: 'currency',
      },
      {
        number: 3,
        label: t('wizard.calculateVat.box3Label'),
        description: t('wizard.calculateVat.box3Description'),
        value: vatReturn.box3,
        type: 'currency',
        isTotal: true,
      },
      {
        number: 4,
        label: t('wizard.calculateVat.box4Label'),
        description: t('wizard.calculateVat.box4Description'),
        value: vatReturn.box4,
        type: 'currency',
      },
      {
        number: 5,
        label: t('wizard.calculateVat.box5Label'),
        description: t('wizard.calculateVat.box5Description'),
        value: vatReturn.box5,
        type: 'currency',
        isNetVat: true,
      },
      {
        number: 6,
        label: t('wizard.calculateVat.box6Label'),
        description: t('wizard.calculateVat.box6Description'),
        value: vatReturn.box6,
        type: 'currency',
      },
      {
        number: 7,
        label: t('wizard.calculateVat.box7Label'),
        description: t('wizard.calculateVat.box7Description'),
        value: vatReturn.box7,
        type: 'currency',
      },
      {
        number: 8,
        label: t('wizard.calculateVat.box8Label'),
        description: t('wizard.calculateVat.box8Description'),
        value: vatReturn.box8,
        type: 'currency',
      },
      {
        number: 9,
        label: t('wizard.calculateVat.box9Label'),
        description: t('wizard.calculateVat.box9Description'),
        value: vatReturn.box9,
        type: 'currency',
      },
    ];
  }, [vatReturn, t]);

  const formatValue = (value, type) => {
    if (type === 'currency') {
      return formatCurrency(value);
    }
    return value;
  };

  if (!vatReturn) {
    return (
      <div className="vat-step calculate-vat">
        <h3 className="vat-step__title">{t('wizard.calculateVat.title')}</h3>
        <p className="vat-step__description">{t('wizard.calculateVat.description')}</p>

        <div className="calculate-vat__not-calculated">
          <p>{t('wizard.calculateVat.notCalculated')}</p>
          <button
            type="button"
            className="calculate-vat__calculate-btn"
            onClick={onCalculateVat}
          >
            {t('wizard.calculateVat.calculateNow')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vat-step calculate-vat">
      <h3 className="vat-step__title">{t('wizard.calculateVat.title')}</h3>
      <p className="vat-step__description">{t('wizard.calculateVat.description')}</p>

      <div className="calculate-vat__period">
        <span className="calculate-vat__period-label">{t('wizard.calculateVat.period')}</span>
        <span className="calculate-vat__period-value">
          {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
        </span>
      </div>

      <div className="calculate-vat__boxes">
        {boxes.map((box) => (
          <div
            key={box.number}
            className={`calculate-vat__box ${
              box.isTotal ? 'calculate-vat__box--total' : ''
            } ${box.isNetVat ? 'calculate-vat__box--net' : ''}`}
          >
            <div className="calculate-vat__box-header">
              <span className="calculate-vat__box-number">{t('wizard.calculateVat.box', { number: box.number })}</span>
              <span className="calculate-vat__box-label">{box.label}</span>
            </div>
            <div className="calculate-vat__box-value">
              {formatValue(box.value, box.type)}
            </div>
            <p className="calculate-vat__box-description">{box.description}</p>
          </div>
        ))}
      </div>

      <div className="calculate-vat__summary">
        <div className={`calculate-vat__net-result ${
          vatReturn.box5 >= 0 ? 'calculate-vat__net-result--owe' : 'calculate-vat__net-result--reclaim'
        }`}>
          <span className="calculate-vat__net-label">
            {vatReturn.box5 >= 0 
              ? t('wizard.calculateVat.youOwe') 
              : t('wizard.calculateVat.youReclaim')}
          </span>
          <span className="calculate-vat__net-value">
            {formatCurrency(Math.abs(vatReturn.box5))}
          </span>
        </div>
      </div>

      {vatReturn.outputVatBreakdown && vatReturn.outputVatBreakdown.length > 0 && (
        <div className="calculate-vat__breakdown">
          <h4 className="calculate-vat__breakdown-title">{t('wizard.calculateVat.outputVatBreakdown')}</h4>
          <table className="calculate-vat__breakdown-table">
            <thead>
              <tr>
                <th>{t('wizard.calculateVat.vatRate')}</th>
                <th>{t('wizard.calculateVat.transactions')}</th>
                <th>{t('wizard.calculateVat.netAmount')}</th>
                <th>{t('wizard.calculateVat.vatAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {vatReturn.outputVatBreakdown.map((row) => (
                <tr key={row.rate}>
                  <td>{row.rate}%</td>
                  <td>{row.count}</td>
                  <td>{formatCurrency(row.netAmount)}</td>
                  <td>{formatCurrency(row.vatAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vatReturn.inputVatBreakdown && vatReturn.inputVatBreakdown.length > 0 && (
        <div className="calculate-vat__breakdown">
          <h4 className="calculate-vat__breakdown-title">{t('wizard.calculateVat.inputVatBreakdown')}</h4>
          <table className="calculate-vat__breakdown-table">
            <thead>
              <tr>
                <th>{t('wizard.calculateVat.vatRate')}</th>
                <th>{t('wizard.calculateVat.transactions')}</th>
                <th>{t('wizard.calculateVat.netAmount')}</th>
                <th>{t('wizard.calculateVat.vatAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {vatReturn.inputVatBreakdown.map((row) => (
                <tr key={row.rate}>
                  <td>{row.rate}%</td>
                  <td>{row.count}</td>
                  <td>{formatCurrency(row.netAmount)}</td>
                  <td>{formatCurrency(row.vatAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="calculate-vat__info">
        <p className="calculate-vat__info-text">
          {t('wizard.calculateVat.roundingNote')}
        </p>
      </div>
    </div>
  );
};

CalculateVat.propTypes = {
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
      outputVatBreakdown: PropTypes.array,
      inputVatBreakdown: PropTypes.array,
    }),
  }).isRequired,
  onCalculateVat: PropTypes.func,
};

export default CalculateVat;
