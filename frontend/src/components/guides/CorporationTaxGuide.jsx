import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import GuideStep from './GuideStep';

// Import screenshot placeholders
import hmrcLoginImg from '../../assets/guides/hmrc-login-placeholder.svg';
import ctAccountImg from '../../assets/guides/ct-account-placeholder.svg';
import ct600FormImg from '../../assets/guides/ct600-form-placeholder.svg';
import ctSubmitImg from '../../assets/guides/ct-submit-placeholder.svg';

/**
 * CorporationTaxGuide Component
 * 
 * Comprehensive guide for filing Corporation Tax (CT600) returns through HMRC.
 * Provides step-by-step instructions with screenshots and field mappings.
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.ctData] - Pre-populated Corporation Tax data from the app
 * @param {string} [props.className] - Additional CSS class names
 */
const CorporationTaxGuide = ({ ctData = null, className = '' }) => {
  const { t } = useTranslation();
  const [expandedSteps, setExpandedSteps] = useState(new Set([1, 2, 3, 4, 5, 6, 7, 8]));

  const handleStepToggle = (stepNumber) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedSteps(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // CT600 key field mappings
  const ct600FieldMappings = [
    {
      hmrcFieldKey: 'guides.ct.fields.turnover',
      appField: 'totalTurnover',
      descriptionKey: 'guides.ct.fields.turnoverDesc',
    },
    {
      hmrcFieldKey: 'guides.ct.fields.tradingProfits',
      appField: 'tradingProfits',
      descriptionKey: 'guides.ct.fields.tradingProfitsDesc',
    },
    {
      hmrcFieldKey: 'guides.ct.fields.netTradingProfits',
      appField: 'netTradingProfits',
      descriptionKey: 'guides.ct.fields.netTradingProfitsDesc',
    },
    {
      hmrcFieldKey: 'guides.ct.fields.chargableProfits',
      appField: 'chargeableProfits',
      descriptionKey: 'guides.ct.fields.chargableProfitsDesc',
    },
    {
      hmrcFieldKey: 'guides.ct.fields.ctPayable',
      appField: 'corporationTaxPayable',
      descriptionKey: 'guides.ct.fields.ctPayableDesc',
    },
    {
      hmrcFieldKey: 'guides.ct.fields.taxRefund',
      appField: 'taxRefundDue',
      descriptionKey: 'guides.ct.fields.taxRefundDesc',
    },
  ];

  return (
    <div className={`filing-guide filing-guide--ct ${className}`}>
      <header className="filing-guide__header">
        <h2 className="filing-guide__title">
          {t('guides.ct.title')}
        </h2>
        <p className="filing-guide__intro">
          {t('guides.ct.intro')}
        </p>
        
        <div className="filing-guide__actions">
          <button 
            type="button" 
            onClick={expandAll}
            className="filing-guide__action-btn"
          >
            {t('guides.common.expandAll')}
          </button>
          <button 
            type="button" 
            onClick={collapseAll}
            className="filing-guide__action-btn"
          >
            {t('guides.common.collapseAll')}
          </button>
        </div>
      </header>

      {/* Pre-requisites section */}
      <section className="filing-guide__prerequisites">
        <h3>{t('guides.common.prerequisites')}</h3>
        <ul>
          <li>{t('guides.ct.prereq1')}</li>
          <li>{t('guides.ct.prereq2')}</li>
          <li>{t('guides.ct.prereq3')}</li>
          <li>{t('guides.ct.prereq4')}</li>
          <li>{t('guides.ct.prereq5')}</li>
        </ul>
      </section>

      {/* Show current CT data if available */}
      {ctData && (
        <section className="filing-guide__current-data">
          <h3>{t('guides.ct.yourCtData')}</h3>
          <div className="filing-guide__data-summary">
            <div className="filing-guide__data-item">
              <span className="filing-guide__data-label">{t('guides.ct.fields.turnover')}:</span>
              <span className="filing-guide__data-value">£{ctData.totalTurnover?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="filing-guide__data-item">
              <span className="filing-guide__data-label">{t('guides.ct.fields.ctPayable')}:</span>
              <span className="filing-guide__data-value">£{ctData.corporationTaxPayable?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </section>
      )}

      {/* Step-by-step guide */}
      <div className="filing-guide__steps">
        <GuideStep
          stepNumber={1}
          titleKey="guides.ct.step1.title"
          descriptionKey="guides.ct.step1.description"
          screenshotSrc={hmrcLoginImg}
          screenshotAltKey="guides.ct.step1.screenshotAlt"
          subSteps={[
            'guides.ct.step1.sub1',
            'guides.ct.step1.sub2',
            'guides.ct.step1.sub3',
          ]}
          tipKey="guides.ct.step1.tip"
          isExpanded={expandedSteps.has(1)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={2}
          titleKey="guides.ct.step2.title"
          descriptionKey="guides.ct.step2.description"
          screenshotSrc={ctAccountImg}
          screenshotAltKey="guides.ct.step2.screenshotAlt"
          subSteps={[
            'guides.ct.step2.sub1',
            'guides.ct.step2.sub2',
            'guides.ct.step2.sub3',
          ]}
          isExpanded={expandedSteps.has(2)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={3}
          titleKey="guides.ct.step3.title"
          descriptionKey="guides.ct.step3.description"
          subSteps={[
            'guides.ct.step3.sub1',
            'guides.ct.step3.sub2',
            'guides.ct.step3.sub3',
          ]}
          warningKey="guides.ct.step3.warning"
          isExpanded={expandedSteps.has(3)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={4}
          titleKey="guides.ct.step4.title"
          descriptionKey="guides.ct.step4.description"
          screenshotSrc={ct600FormImg}
          screenshotAltKey="guides.ct.step4.screenshotAlt"
          subSteps={[
            'guides.ct.step4.sub1',
            'guides.ct.step4.sub2',
            'guides.ct.step4.sub3',
            'guides.ct.step4.sub4',
          ]}
          isExpanded={expandedSteps.has(4)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={5}
          titleKey="guides.ct.step5.title"
          descriptionKey="guides.ct.step5.description"
          fieldMappings={ct600FieldMappings}
          tipKey="guides.ct.step5.tip"
          isExpanded={expandedSteps.has(5)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={6}
          titleKey="guides.ct.step6.title"
          descriptionKey="guides.ct.step6.description"
          subSteps={[
            'guides.ct.step6.sub1',
            'guides.ct.step6.sub2',
            'guides.ct.step6.sub3',
          ]}
          warningKey="guides.ct.step6.warning"
          isExpanded={expandedSteps.has(6)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={7}
          titleKey="guides.ct.step7.title"
          descriptionKey="guides.ct.step7.description"
          screenshotSrc={ctSubmitImg}
          screenshotAltKey="guides.ct.step7.screenshotAlt"
          subSteps={[
            'guides.ct.step7.sub1',
            'guides.ct.step7.sub2',
            'guides.ct.step7.sub3',
          ]}
          tipKey="guides.ct.step7.tip"
          isExpanded={expandedSteps.has(7)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={8}
          titleKey="guides.ct.step8.title"
          descriptionKey="guides.ct.step8.description"
          subSteps={[
            'guides.ct.step8.sub1',
            'guides.ct.step8.sub2',
            'guides.ct.step8.sub3',
            'guides.ct.step8.sub4',
          ]}
          tipKey="guides.ct.step8.tip"
          isExpanded={expandedSteps.has(8)}
          onToggle={handleStepToggle}
        />
      </div>

      {/* Deadline reminder */}
      <section className="filing-guide__deadline">
        <h3>{t('guides.ct.deadlineTitle')}</h3>
        <p>{t('guides.ct.deadlineInfo')}</p>
        <ul>
          <li>{t('guides.ct.deadlineReturn')}</li>
          <li>{t('guides.ct.deadlinePayment')}</li>
        </ul>
      </section>

      {/* Support links */}
      <section className="filing-guide__support">
        <h3>{t('guides.common.needHelp')}</h3>
        <ul>
          <li>
            <a 
              href="https://www.gov.uk/company-tax-returns" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('guides.ct.hmrcCtGuide')}
            </a>
          </li>
          <li>
            <a 
              href="https://www.gov.uk/government/organisations/hm-revenue-customs/contact/corporation-tax-enquiries" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('guides.ct.hmrcCtContact')}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
};

CorporationTaxGuide.propTypes = {
  ctData: PropTypes.shape({
    totalTurnover: PropTypes.number,
    tradingProfits: PropTypes.number,
    netTradingProfits: PropTypes.number,
    chargeableProfits: PropTypes.number,
    corporationTaxPayable: PropTypes.number,
    taxRefundDue: PropTypes.number,
  }),
  className: PropTypes.string,
};

export default CorporationTaxGuide;
