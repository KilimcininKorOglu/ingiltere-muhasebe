import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * GuideStep Component
 * 
 * Displays a single step in a filing guide with optional screenshot,
 * field mapping information, and helpful tips.
 * 
 * @param {Object} props - Component props
 * @param {number} props.stepNumber - The step number to display
 * @param {string} props.titleKey - i18n key for the step title
 * @param {string} props.descriptionKey - i18n key for the step description
 * @param {string} [props.screenshotSrc] - Path to the screenshot image
 * @param {string} [props.screenshotAltKey] - i18n key for screenshot alt text
 * @param {Array} [props.fieldMappings] - Array of field mapping objects
 * @param {string} [props.tipKey] - i18n key for an optional tip
 * @param {string} [props.warningKey] - i18n key for an optional warning
 * @param {Array} [props.subSteps] - Array of i18n keys for sub-steps
 * @param {boolean} [props.isExpanded] - Whether the step details are expanded
 * @param {Function} [props.onToggle] - Callback when step is toggled
 * @param {string} [props.className] - Additional CSS class names
 */
const GuideStep = ({
  stepNumber,
  titleKey,
  descriptionKey,
  screenshotSrc,
  screenshotAltKey,
  fieldMappings = [],
  tipKey,
  warningKey,
  subSteps = [],
  isExpanded = true,
  onToggle,
  className = '',
}) => {
  const { t } = useTranslation();

  const handleToggle = () => {
    if (onToggle) {
      onToggle(stepNumber);
    }
  };

  return (
    <div className={`guide-step ${className}`} data-step={stepNumber}>
      <div 
        className="guide-step__header"
        onClick={handleToggle}
        onKeyDown={(e) => e.key === 'Enter' && handleToggle()}
        role={onToggle ? 'button' : undefined}
        tabIndex={onToggle ? 0 : undefined}
        aria-expanded={onToggle ? isExpanded : undefined}
      >
        <span className="guide-step__number" aria-hidden="true">
          {stepNumber}
        </span>
        <h3 className="guide-step__title">
          {t(titleKey)}
        </h3>
      </div>

      {isExpanded && (
        <div className="guide-step__content">
          <p className="guide-step__description">
            {t(descriptionKey)}
          </p>

          {/* Screenshot section */}
          {screenshotSrc && (
            <div className="guide-step__screenshot">
              <img 
                src={screenshotSrc} 
                alt={screenshotAltKey ? t(screenshotAltKey) : t(titleKey)}
                className="guide-step__image"
                loading="lazy"
              />
              <span className="guide-step__screenshot-caption">
                {t('guides.common.clickToEnlarge')}
              </span>
            </div>
          )}

          {/* Field mappings section */}
          {fieldMappings.length > 0 && (
            <div className="guide-step__field-mappings">
              <h4 className="guide-step__mappings-title">
                {t('guides.common.fieldMappings')}
              </h4>
              <table className="guide-step__mappings-table">
                <thead>
                  <tr>
                    <th>{t('guides.common.hmrcField')}</th>
                    <th>{t('guides.common.appValue')}</th>
                    <th>{t('guides.common.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMappings.map((mapping, index) => (
                    <tr key={index}>
                      <td className="guide-step__mapping-field">
                        {t(mapping.hmrcFieldKey)}
                      </td>
                      <td className="guide-step__mapping-value">
                        <code>{mapping.appField}</code>
                      </td>
                      <td className="guide-step__mapping-desc">
                        {t(mapping.descriptionKey)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-steps section */}
          {subSteps.length > 0 && (
            <ol className="guide-step__sub-steps">
              {subSteps.map((subStepKey, index) => (
                <li key={index} className="guide-step__sub-step">
                  {t(subStepKey)}
                </li>
              ))}
            </ol>
          )}

          {/* Tip section */}
          {tipKey && (
            <div className="guide-step__tip">
              <span className="guide-step__tip-icon" aria-hidden="true">💡</span>
              <span className="guide-step__tip-label">{t('guides.common.tip')}:</span>
              <span className="guide-step__tip-text">{t(tipKey)}</span>
            </div>
          )}

          {/* Warning section */}
          {warningKey && (
            <div className="guide-step__warning">
              <span className="guide-step__warning-icon" aria-hidden="true">⚠️</span>
              <span className="guide-step__warning-label">{t('guides.common.warning')}:</span>
              <span className="guide-step__warning-text">{t(warningKey)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

GuideStep.propTypes = {
  stepNumber: PropTypes.number.isRequired,
  titleKey: PropTypes.string.isRequired,
  descriptionKey: PropTypes.string.isRequired,
  screenshotSrc: PropTypes.string,
  screenshotAltKey: PropTypes.string,
  fieldMappings: PropTypes.arrayOf(
    PropTypes.shape({
      hmrcFieldKey: PropTypes.string.isRequired,
      appField: PropTypes.string.isRequired,
      descriptionKey: PropTypes.string.isRequired,
    })
  ),
  tipKey: PropTypes.string,
  warningKey: PropTypes.string,
  subSteps: PropTypes.arrayOf(PropTypes.string),
  isExpanded: PropTypes.bool,
  onToggle: PropTypes.func,
  className: PropTypes.string,
};

export default GuideStep;
