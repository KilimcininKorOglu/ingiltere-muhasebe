import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * SelectPeriod Step Component
 * 
 * Allows users to select the VAT return period (quarter/month).
 * Provides quick selection for standard quarterly periods.
 */
const SelectPeriod = ({ data, updateData, onPeriodSelected }) => {
  const { t } = useTranslation('vat');
  
  const [periodType, setPeriodType] = useState('quarterly');
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [customStartDate, setCustomStartDate] = useState(data.periodStart || '');
  const [customEndDate, setCustomEndDate] = useState(data.periodEnd || '');

  const currentYear = new Date().getFullYear();

  const quarterlyPeriods = useMemo(() => {
    const periods = [];
    
    for (let year = currentYear; year >= currentYear - 1; year--) {
      // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
      const quarters = [
        { quarter: 4, start: `${year}-10-01`, end: `${year}-12-31`, label: `Q4 ${year} (Oct-Dec)` },
        { quarter: 3, start: `${year}-07-01`, end: `${year}-09-30`, label: `Q3 ${year} (Jul-Sep)` },
        { quarter: 2, start: `${year}-04-01`, end: `${year}-06-30`, label: `Q2 ${year} (Apr-Jun)` },
        { quarter: 1, start: `${year}-01-01`, end: `${year}-03-31`, label: `Q1 ${year} (Jan-Mar)` },
      ];
      
      quarters.forEach((q) => {
        // Only show past or current quarters
        const endDate = new Date(q.end);
        if (endDate <= new Date()) {
          periods.push({
            ...q,
            id: `${year}-Q${q.quarter}`,
          });
        }
      });
    }
    
    return periods;
  }, [currentYear]);

  const handleQuarterSelect = useCallback((period) => {
    setSelectedQuarter(period.id);
    updateData({
      periodStart: period.start,
      periodEnd: period.end,
    });
    
    if (onPeriodSelected) {
      onPeriodSelected(period.start, period.end);
    }
  }, [updateData, onPeriodSelected]);

  const handleCustomPeriodSubmit = useCallback(() => {
    if (customStartDate && customEndDate) {
      updateData({
        periodStart: customStartDate,
        periodEnd: customEndDate,
      });
      
      if (onPeriodSelected) {
        onPeriodSelected(customStartDate, customEndDate);
      }
    }
  }, [customStartDate, customEndDate, updateData, onPeriodSelected]);

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="vat-step select-period">
      <h3 className="vat-step__title">{t('wizard.selectPeriod.title')}</h3>
      <p className="vat-step__description">{t('wizard.selectPeriod.description')}</p>

      <div className="select-period__type-toggle">
        <button
          type="button"
          className={`select-period__type-btn ${periodType === 'quarterly' ? 'select-period__type-btn--active' : ''}`}
          onClick={() => setPeriodType('quarterly')}
        >
          {t('wizard.selectPeriod.quarterly')}
        </button>
        <button
          type="button"
          className={`select-period__type-btn ${periodType === 'custom' ? 'select-period__type-btn--active' : ''}`}
          onClick={() => setPeriodType('custom')}
        >
          {t('wizard.selectPeriod.custom')}
        </button>
      </div>

      {periodType === 'quarterly' && (
        <div className="select-period__quarters">
          <p className="select-period__quarters-label">{t('wizard.selectPeriod.selectQuarter')}</p>
          <div className="select-period__quarters-grid">
            {quarterlyPeriods.map((period) => (
              <button
                key={period.id}
                type="button"
                className={`select-period__quarter-btn ${
                  selectedQuarter === period.id ? 'select-period__quarter-btn--selected' : ''
                }`}
                onClick={() => handleQuarterSelect(period)}
              >
                <span className="select-period__quarter-label">{period.label}</span>
                <span className="select-period__quarter-dates">
                  {formatDateForDisplay(period.start)} - {formatDateForDisplay(period.end)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {periodType === 'custom' && (
        <div className="select-period__custom">
          <div className="select-period__custom-fields">
            <div className="select-period__field">
              <label htmlFor="periodStart" className="select-period__label">
                {t('wizard.selectPeriod.startDate')}
              </label>
              <input
                type="date"
                id="periodStart"
                className="select-period__input"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate || undefined}
              />
            </div>
            <div className="select-period__field">
              <label htmlFor="periodEnd" className="select-period__label">
                {t('wizard.selectPeriod.endDate')}
              </label>
              <input
                type="date"
                id="periodEnd"
                className="select-period__input"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate || undefined}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <button
            type="button"
            className="select-period__apply-btn"
            onClick={handleCustomPeriodSubmit}
            disabled={!customStartDate || !customEndDate}
          >
            {t('wizard.selectPeriod.applyPeriod')}
          </button>
        </div>
      )}

      {data.periodStart && data.periodEnd && (
        <div className="select-period__selected">
          <span className="select-period__selected-label">{t('wizard.selectPeriod.selectedPeriod')}</span>
          <span className="select-period__selected-value">
            {formatDateForDisplay(data.periodStart)} - {formatDateForDisplay(data.periodEnd)}
          </span>
        </div>
      )}
    </div>
  );
};

SelectPeriod.propTypes = {
  data: PropTypes.shape({
    periodStart: PropTypes.string,
    periodEnd: PropTypes.string,
  }).isRequired,
  updateData: PropTypes.func.isRequired,
  onPeriodSelected: PropTypes.func,
};

export default SelectPeriod;
