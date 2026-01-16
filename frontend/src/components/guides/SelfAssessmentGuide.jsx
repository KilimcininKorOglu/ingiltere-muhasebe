import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import GuideStep from './GuideStep';

// Import screenshot placeholders
import hmrcLoginImg from '../../assets/guides/hmrc-login-placeholder.svg';
import saAccountImg from '../../assets/guides/sa-account-placeholder.svg';
import saReturnFormImg from '../../assets/guides/sa-return-form-placeholder.svg';
import saSubmitImg from '../../assets/guides/sa-submit-placeholder.svg';

/**
 * SelfAssessmentGuide Component
 * 
 * Comprehensive guide for filing Self Assessment tax returns through HMRC.
 * Provides step-by-step instructions with screenshots and field mappings.
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.saData] - Pre-populated Self Assessment data from the app
 * @param {string} [props.className] - Additional CSS class names
 */
const SelfAssessmentGuide = ({ saData = null, className = '' }) => {
  const { t } = useTranslation();
  const [expandedSteps, setExpandedSteps] = useState(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));

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
    setExpandedSteps(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // Self-employment field mappings
  const selfEmploymentFieldMappings = [
    {
      hmrcFieldKey: 'guides.sa.fields.turnover',
      appField: 'businessTurnover',
      descriptionKey: 'guides.sa.fields.turnoverDesc',
    },
    {
      hmrcFieldKey: 'guides.sa.fields.expenses',
      appField: 'allowableExpenses',
      descriptionKey: 'guides.sa.fields.expensesDesc',
    },
    {
      hmrcFieldKey: 'guides.sa.fields.netProfit',
      appField: 'netBusinessProfit',
      descriptionKey: 'guides.sa.fields.netProfitDesc',
    },
  ];

  // Income field mappings
  const incomeFieldMappings = [
    {
      hmrcFieldKey: 'guides.sa.fields.employmentIncome',
      appField: 'totalEmploymentIncome',
      descriptionKey: 'guides.sa.fields.employmentIncomeDesc',
    },
    {
      hmrcFieldKey: 'guides.sa.fields.selfEmploymentIncome',
      appField: 'totalSelfEmploymentIncome',
      descriptionKey: 'guides.sa.fields.selfEmploymentIncomeDesc',
    },
    {
      hmrcFieldKey: 'guides.sa.fields.rentalIncome',
      appField: 'totalRentalIncome',
      descriptionKey: 'guides.sa.fields.rentalIncomeDesc',
    },
    {
      hmrcFieldKey: 'guides.sa.fields.dividends',
      appField: 'totalDividends',
      descriptionKey: 'guides.sa.fields.dividendsDesc',
    },
    {
      hmrcFieldKey: 'guides.sa.fields.savingsInterest',
      appField: 'totalSavingsInterest',
      descriptionKey: 'guides.sa.fields.savingsInterestDesc',
    },
  ];

  return (
    <div className={`filing-guide filing-guide--sa ${className}`}>
      <header className="filing-guide__header">
        <h2 className="filing-guide__title">
          {t('guides.sa.title')}
        </h2>
        <p className="filing-guide__intro">
          {t('guides.sa.intro')}
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
          <li>{t('guides.sa.prereq1')}</li>
          <li>{t('guides.sa.prereq2')}</li>
          <li>{t('guides.sa.prereq3')}</li>
          <li>{t('guides.sa.prereq4')}</li>
          <li>{t('guides.sa.prereq5')}</li>
        </ul>
      </section>

      {/* Show current SA data if available */}
      {saData && (
        <section className="filing-guide__current-data">
          <h3>{t('guides.sa.yourSaData')}</h3>
          <div className="filing-guide__data-summary">
            <div className="filing-guide__data-item">
              <span className="filing-guide__data-label">{t('guides.sa.fields.totalIncome')}:</span>
              <span className="filing-guide__data-value">£{saData.totalIncome?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="filing-guide__data-item">
              <span className="filing-guide__data-label">{t('guides.sa.fields.taxDue')}:</span>
              <span className="filing-guide__data-value">£{saData.taxDue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </section>
      )}

      {/* Step-by-step guide */}
      <div className="filing-guide__steps">
        <GuideStep
          stepNumber={1}
          titleKey="guides.sa.step1.title"
          descriptionKey="guides.sa.step1.description"
          screenshotSrc={hmrcLoginImg}
          screenshotAltKey="guides.sa.step1.screenshotAlt"
          subSteps={[
            'guides.sa.step1.sub1',
            'guides.sa.step1.sub2',
            'guides.sa.step1.sub3',
          ]}
          tipKey="guides.sa.step1.tip"
          isExpanded={expandedSteps.has(1)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={2}
          titleKey="guides.sa.step2.title"
          descriptionKey="guides.sa.step2.description"
          screenshotSrc={saAccountImg}
          screenshotAltKey="guides.sa.step2.screenshotAlt"
          subSteps={[
            'guides.sa.step2.sub1',
            'guides.sa.step2.sub2',
          ]}
          isExpanded={expandedSteps.has(2)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={3}
          titleKey="guides.sa.step3.title"
          descriptionKey="guides.sa.step3.description"
          subSteps={[
            'guides.sa.step3.sub1',
            'guides.sa.step3.sub2',
            'guides.sa.step3.sub3',
            'guides.sa.step3.sub4',
          ]}
          tipKey="guides.sa.step3.tip"
          isExpanded={expandedSteps.has(3)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={4}
          titleKey="guides.sa.step4.title"
          descriptionKey="guides.sa.step4.description"
          screenshotSrc={saReturnFormImg}
          screenshotAltKey="guides.sa.step4.screenshotAlt"
          subSteps={[
            'guides.sa.step4.sub1',
            'guides.sa.step4.sub2',
            'guides.sa.step4.sub3',
          ]}
          isExpanded={expandedSteps.has(4)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={5}
          titleKey="guides.sa.step5.title"
          descriptionKey="guides.sa.step5.description"
          fieldMappings={incomeFieldMappings}
          warningKey="guides.sa.step5.warning"
          isExpanded={expandedSteps.has(5)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={6}
          titleKey="guides.sa.step6.title"
          descriptionKey="guides.sa.step6.description"
          fieldMappings={selfEmploymentFieldMappings}
          tipKey="guides.sa.step6.tip"
          isExpanded={expandedSteps.has(6)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={7}
          titleKey="guides.sa.step7.title"
          descriptionKey="guides.sa.step7.description"
          subSteps={[
            'guides.sa.step7.sub1',
            'guides.sa.step7.sub2',
            'guides.sa.step7.sub3',
          ]}
          isExpanded={expandedSteps.has(7)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={8}
          titleKey="guides.sa.step8.title"
          descriptionKey="guides.sa.step8.description"
          screenshotSrc={saSubmitImg}
          screenshotAltKey="guides.sa.step8.screenshotAlt"
          subSteps={[
            'guides.sa.step8.sub1',
            'guides.sa.step8.sub2',
            'guides.sa.step8.sub3',
          ]}
          warningKey="guides.sa.step8.warning"
          isExpanded={expandedSteps.has(8)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={9}
          titleKey="guides.sa.step9.title"
          descriptionKey="guides.sa.step9.description"
          subSteps={[
            'guides.sa.step9.sub1',
            'guides.sa.step9.sub2',
            'guides.sa.step9.sub3',
            'guides.sa.step9.sub4',
          ]}
          tipKey="guides.sa.step9.tip"
          isExpanded={expandedSteps.has(9)}
          onToggle={handleStepToggle}
        />
      </div>

      {/* Deadline reminder */}
      <section className="filing-guide__deadline">
        <h3>{t('guides.sa.deadlineTitle')}</h3>
        <p>{t('guides.sa.deadlineInfo')}</p>
        <ul>
          <li>{t('guides.sa.deadlinePaper')}</li>
          <li>{t('guides.sa.deadlineOnline')}</li>
          <li>{t('guides.sa.deadlinePayment')}</li>
        </ul>
      </section>

      {/* Payment on Account info */}
      <section className="filing-guide__info">
        <h3>{t('guides.sa.paymentOnAccountTitle')}</h3>
        <p>{t('guides.sa.paymentOnAccountInfo')}</p>
      </section>

      {/* Support links */}
      <section className="filing-guide__support">
        <h3>{t('guides.common.needHelp')}</h3>
        <ul>
          <li>
            <a 
              href="https://www.gov.uk/self-assessment-tax-returns" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('guides.sa.hmrcSaGuide')}
            </a>
          </li>
          <li>
            <a 
              href="https://www.gov.uk/government/organisations/hm-revenue-customs/contact/self-assessment" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('guides.sa.hmrcSaContact')}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
};

SelfAssessmentGuide.propTypes = {
  saData: PropTypes.shape({
    totalIncome: PropTypes.number,
    taxDue: PropTypes.number,
    businessTurnover: PropTypes.number,
    allowableExpenses: PropTypes.number,
    netBusinessProfit: PropTypes.number,
    totalEmploymentIncome: PropTypes.number,
    totalSelfEmploymentIncome: PropTypes.number,
    totalRentalIncome: PropTypes.number,
    totalDividends: PropTypes.number,
    totalSavingsInterest: PropTypes.number,
  }),
  className: PropTypes.string,
};

export default SelfAssessmentGuide;
