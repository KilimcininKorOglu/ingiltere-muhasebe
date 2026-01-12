import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import GuideStep from './GuideStep';

// Import screenshot placeholders (these would be actual HMRC portal screenshots)
import hmrcLoginImg from '../../assets/guides/hmrc-login-placeholder.svg';
import vatAccountImg from '../../assets/guides/vat-account-placeholder.svg';
import vatReturnFormImg from '../../assets/guides/vat-return-form-placeholder.svg';
import vatSubmitImg from '../../assets/guides/vat-submit-placeholder.svg';

/**
 * VatFilingGuide Component
 * 
 * Comprehensive guide for filing VAT returns through the HMRC portal.
 * Provides step-by-step instructions with screenshots and field mappings.
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.vatData] - Pre-populated VAT data from the app
 * @param {string} [props.className] - Additional CSS class names
 */
const VatFilingGuide = ({ vatData = null, className = '' }) => {
  const { t } = useTranslation();
  const [expandedSteps, setExpandedSteps] = useState(new Set([1, 2, 3, 4, 5, 6, 7]));

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
    setExpandedSteps(new Set([1, 2, 3, 4, 5, 6, 7]));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // VAT Return field mappings (Box 1-9)
  const vatFieldMappings = [
    {
      hmrcFieldKey: 'guides.vat.fields.box1',
      appField: 'vatDueSales',
      descriptionKey: 'guides.vat.fields.box1Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box2',
      appField: 'vatDueAcquisitions',
      descriptionKey: 'guides.vat.fields.box2Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box3',
      appField: 'totalVatDue',
      descriptionKey: 'guides.vat.fields.box3Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box4',
      appField: 'vatReclaimedCurrPeriod',
      descriptionKey: 'guides.vat.fields.box4Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box5',
      appField: 'netVatDue',
      descriptionKey: 'guides.vat.fields.box5Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box6',
      appField: 'totalValueSalesExVat',
      descriptionKey: 'guides.vat.fields.box6Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box7',
      appField: 'totalValuePurchasesExVat',
      descriptionKey: 'guides.vat.fields.box7Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box8',
      appField: 'totalValueGoodsSuppliedExVat',
      descriptionKey: 'guides.vat.fields.box8Desc',
    },
    {
      hmrcFieldKey: 'guides.vat.fields.box9',
      appField: 'totalAcquisitionsExVat',
      descriptionKey: 'guides.vat.fields.box9Desc',
    },
  ];

  return (
    <div className={`filing-guide filing-guide--vat ${className}`}>
      <header className="filing-guide__header">
        <h2 className="filing-guide__title">
          {t('guides.vat.title')}
        </h2>
        <p className="filing-guide__intro">
          {t('guides.vat.intro')}
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
          <li>{t('guides.vat.prereq1')}</li>
          <li>{t('guides.vat.prereq2')}</li>
          <li>{t('guides.vat.prereq3')}</li>
          <li>{t('guides.vat.prereq4')}</li>
        </ul>
      </section>

      {/* Show current VAT data if available */}
      {vatData && (
        <section className="filing-guide__current-data">
          <h3>{t('guides.vat.yourVatData')}</h3>
          <div className="filing-guide__data-summary">
            <div className="filing-guide__data-item">
              <span className="filing-guide__data-label">{t('guides.vat.fields.box1')}:</span>
              <span className="filing-guide__data-value">£{vatData.vatDueSales?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="filing-guide__data-item">
              <span className="filing-guide__data-label">{t('guides.vat.fields.box5')}:</span>
              <span className="filing-guide__data-value">£{vatData.netVatDue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </section>
      )}

      {/* Step-by-step guide */}
      <div className="filing-guide__steps">
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          screenshotSrc={hmrcLoginImg}
          screenshotAltKey="guides.vat.step1.screenshotAlt"
          subSteps={[
            'guides.vat.step1.sub1',
            'guides.vat.step1.sub2',
            'guides.vat.step1.sub3',
          ]}
          tipKey="guides.vat.step1.tip"
          isExpanded={expandedSteps.has(1)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={2}
          titleKey="guides.vat.step2.title"
          descriptionKey="guides.vat.step2.description"
          screenshotSrc={vatAccountImg}
          screenshotAltKey="guides.vat.step2.screenshotAlt"
          subSteps={[
            'guides.vat.step2.sub1',
            'guides.vat.step2.sub2',
          ]}
          isExpanded={expandedSteps.has(2)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={3}
          titleKey="guides.vat.step3.title"
          descriptionKey="guides.vat.step3.description"
          subSteps={[
            'guides.vat.step3.sub1',
            'guides.vat.step3.sub2',
            'guides.vat.step3.sub3',
          ]}
          tipKey="guides.vat.step3.tip"
          isExpanded={expandedSteps.has(3)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={4}
          titleKey="guides.vat.step4.title"
          descriptionKey="guides.vat.step4.description"
          screenshotSrc={vatReturnFormImg}
          screenshotAltKey="guides.vat.step4.screenshotAlt"
          fieldMappings={vatFieldMappings}
          warningKey="guides.vat.step4.warning"
          isExpanded={expandedSteps.has(4)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={5}
          titleKey="guides.vat.step5.title"
          descriptionKey="guides.vat.step5.description"
          subSteps={[
            'guides.vat.step5.sub1',
            'guides.vat.step5.sub2',
            'guides.vat.step5.sub3',
          ]}
          warningKey="guides.vat.step5.warning"
          isExpanded={expandedSteps.has(5)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={6}
          titleKey="guides.vat.step6.title"
          descriptionKey="guides.vat.step6.description"
          screenshotSrc={vatSubmitImg}
          screenshotAltKey="guides.vat.step6.screenshotAlt"
          subSteps={[
            'guides.vat.step6.sub1',
            'guides.vat.step6.sub2',
          ]}
          tipKey="guides.vat.step6.tip"
          isExpanded={expandedSteps.has(6)}
          onToggle={handleStepToggle}
        />

        <GuideStep
          stepNumber={7}
          titleKey="guides.vat.step7.title"
          descriptionKey="guides.vat.step7.description"
          subSteps={[
            'guides.vat.step7.sub1',
            'guides.vat.step7.sub2',
            'guides.vat.step7.sub3',
          ]}
          tipKey="guides.vat.step7.tip"
          isExpanded={expandedSteps.has(7)}
          onToggle={handleStepToggle}
        />
      </div>

      {/* Deadline reminder */}
      <section className="filing-guide__deadline">
        <h3>{t('guides.vat.deadlineTitle')}</h3>
        <p>{t('guides.vat.deadlineInfo')}</p>
      </section>

      {/* Support links */}
      <section className="filing-guide__support">
        <h3>{t('guides.common.needHelp')}</h3>
        <ul>
          <li>
            <a 
              href="https://www.gov.uk/vat-returns" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('guides.vat.hmrcVatGuide')}
            </a>
          </li>
          <li>
            <a 
              href="https://www.gov.uk/government/organisations/hm-revenue-customs/contact/vat-enquiries" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('guides.vat.hmrcVatContact')}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
};

VatFilingGuide.propTypes = {
  vatData: PropTypes.shape({
    vatDueSales: PropTypes.number,
    vatDueAcquisitions: PropTypes.number,
    totalVatDue: PropTypes.number,
    vatReclaimedCurrPeriod: PropTypes.number,
    netVatDue: PropTypes.number,
    totalValueSalesExVat: PropTypes.number,
    totalValuePurchasesExVat: PropTypes.number,
    totalValueGoodsSuppliedExVat: PropTypes.number,
    totalAcquisitionsExVat: PropTypes.number,
  }),
  className: PropTypes.string,
};

export default VatFilingGuide;
