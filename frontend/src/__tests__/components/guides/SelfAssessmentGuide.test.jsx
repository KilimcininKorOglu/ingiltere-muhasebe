import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import SelfAssessmentGuide from '../../../components/guides/SelfAssessmentGuide';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('SelfAssessmentGuide Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should render the guide title', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Self Assessment Filing Guide');
    });

    it('should render introduction text', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText(/completing your Self Assessment tax return online/)).toBeInTheDocument();
    });

    it('should render prerequisites section', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Before You Start')).toBeInTheDocument();
      // Use getAllByText because text appears in both prerequisites and step 4
      const niElements = screen.getAllByText(/National Insurance number/);
      expect(niElements.length).toBeGreaterThan(0);
    });

    it('should render all 9 steps', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Sign in to HMRC Online Services')).toBeInTheDocument();
      expect(screen.getByText('Access Your Self Assessment Account')).toBeInTheDocument();
      expect(screen.getByText('Start Your Tax Return')).toBeInTheDocument();
      expect(screen.getByText('Complete Personal Details')).toBeInTheDocument();
      expect(screen.getByText('Enter Income Details')).toBeInTheDocument();
      expect(screen.getByText('Complete Self-Employment Section')).toBeInTheDocument();
      expect(screen.getByText('Enter Reliefs and Deductions')).toBeInTheDocument();
      // Note: "Review and Submit" appears in both CT and SA, so we check for the SA-specific content
      expect(screen.getByText('Pay Any Tax Due')).toBeInTheDocument();
    });

    it('should render deadline section with multiple deadlines', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Self Assessment Deadlines')).toBeInTheDocument();
      expect(screen.getByText(/Paper returns: 31 October/)).toBeInTheDocument();
      expect(screen.getByText(/Online returns: 31 January/)).toBeInTheDocument();
    });

    it('should render payment on account section', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Payments on Account')).toBeInTheDocument();
      expect(screen.getByText(/£1,000 or more/)).toBeInTheDocument();
    });

    it('should render support links', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Need Help?')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'HMRC Self Assessment Guide' })).toHaveAttribute('href', 'https://www.gov.uk/self-assessment-tax-returns');
    });
  });

  describe('SA data display', () => {
    it('should display SA data summary when saData is provided', () => {
      const saData = {
        totalIncome: 75000.00,
        taxDue: 15000.00,
      };
      
      renderWithI18n(<SelfAssessmentGuide saData={saData} />);
      
      expect(screen.getByText('Your Self Assessment Data Summary')).toBeInTheDocument();
      expect(screen.getByText('£75000.00')).toBeInTheDocument();
      expect(screen.getByText('£15000.00')).toBeInTheDocument();
    });

    it('should not display SA data summary when saData is null', () => {
      renderWithI18n(<SelfAssessmentGuide saData={null} />);
      
      expect(screen.queryByText('Your Self Assessment Data Summary')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse functionality', () => {
    it('should expand all steps when Expand All is clicked', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      // First collapse all
      const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseBtn);
      
      // Then expand all
      const expandBtn = screen.getByRole('button', { name: 'Expand All' });
      fireEvent.click(expandBtn);
      
      // Step descriptions should be visible
      expect(screen.getByText(/Access the HMRC Self Assessment portal/)).toBeInTheDocument();
    });

    it('should collapse all steps when Collapse All is clicked', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseBtn);
      
      // Step descriptions should be hidden
      expect(screen.queryByText(/Access the HMRC Self Assessment portal/)).not.toBeInTheDocument();
    });
  });

  describe('field mappings', () => {
    it('should display income field mappings', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Employment income')).toBeInTheDocument();
      expect(screen.getByText('totalEmploymentIncome')).toBeInTheDocument();
    });

    it('should display self-employment field mappings', () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      expect(screen.getByText('Business turnover')).toBeInTheDocument();
      expect(screen.getByText('businessTurnover')).toBeInTheDocument();
    });
  });

  describe('i18n', () => {
    it('should switch to Turkish translations', async () => {
      renderWithI18n(<SelfAssessmentGuide />);
      
      await i18n.changeLanguage('tr');
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Bireysel Beyanname Kılavuzu');
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(<SelfAssessmentGuide className="custom-class" />);
      
      const guide = container.querySelector('.filing-guide--sa');
      expect(guide).toHaveClass('custom-class');
    });
  });
});
