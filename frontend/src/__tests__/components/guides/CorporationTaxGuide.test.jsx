import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import CorporationTaxGuide from '../../../components/guides/CorporationTaxGuide';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('CorporationTaxGuide Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should render the guide title', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Corporation Tax (CT600) Filing Guide');
    });

    it('should render introduction text', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByText(/Company Tax Return \(CT600\)/)).toBeInTheDocument();
    });

    it('should render prerequisites section', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByText('Before You Start')).toBeInTheDocument();
      expect(screen.getByText(/Unique Taxpayer Reference \(UTR\)/)).toBeInTheDocument();
    });

    it('should render all 8 steps', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByText('Sign in to HMRC Online Services')).toBeInTheDocument();
      expect(screen.getByText('Access Corporation Tax Services')).toBeInTheDocument();
      expect(screen.getByText('Prepare Your CT600 Return')).toBeInTheDocument();
      expect(screen.getByText('Start Your CT600 Return')).toBeInTheDocument();
      expect(screen.getByText('Enter Financial Information')).toBeInTheDocument();
      expect(screen.getByText('Attach Accounts and Computations')).toBeInTheDocument();
      expect(screen.getByText('Review and Submit')).toBeInTheDocument();
      expect(screen.getByText('Pay Corporation Tax')).toBeInTheDocument();
    });

    it('should render deadline section with multiple deadlines', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByText('Corporation Tax Deadlines')).toBeInTheDocument();
      expect(screen.getByText(/CT600 Return: 12 months/)).toBeInTheDocument();
      expect(screen.getByText(/Tax Payment: 9 months and 1 day/)).toBeInTheDocument();
    });

    it('should render support links', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByText('Need Help?')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'HMRC Company Tax Returns Guide' })).toHaveAttribute('href', 'https://www.gov.uk/company-tax-returns');
    });
  });

  describe('CT data display', () => {
    it('should display CT data summary when ctData is provided', () => {
      const ctData = {
        totalTurnover: 500000.00,
        corporationTaxPayable: 12500.00,
      };
      
      renderWithI18n(<CorporationTaxGuide ctData={ctData} />);
      
      expect(screen.getByText('Your Corporation Tax Data Summary')).toBeInTheDocument();
      expect(screen.getByText('£500000.00')).toBeInTheDocument();
      expect(screen.getByText('£12500.00')).toBeInTheDocument();
    });

    it('should not display CT data summary when ctData is null', () => {
      renderWithI18n(<CorporationTaxGuide ctData={null} />);
      
      expect(screen.queryByText('Your Corporation Tax Data Summary')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse functionality', () => {
    it('should expand all steps when Expand All is clicked', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      // First collapse all
      const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseBtn);
      
      // Then expand all
      const expandBtn = screen.getByRole('button', { name: 'Expand All' });
      fireEvent.click(expandBtn);
      
      // Step descriptions should be visible
      expect(screen.getByText(/Access the HMRC online services portal/)).toBeInTheDocument();
    });

    it('should collapse all steps when Collapse All is clicked', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseBtn);
      
      // Step descriptions should be hidden
      expect(screen.queryByText(/Access the HMRC online services portal/)).not.toBeInTheDocument();
    });
  });

  describe('field mappings', () => {
    it('should display CT600 field mappings', () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      expect(screen.getByText('Total turnover')).toBeInTheDocument();
      expect(screen.getByText('totalTurnover')).toBeInTheDocument();
    });
  });

  describe('i18n', () => {
    it('should switch to Turkish translations', async () => {
      renderWithI18n(<CorporationTaxGuide />);
      
      await i18n.changeLanguage('tr');
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Kurumlar Vergisi (CT600) Beyanname Kılavuzu');
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(<CorporationTaxGuide className="custom-class" />);
      
      const guide = container.querySelector('.filing-guide--ct');
      expect(guide).toHaveClass('custom-class');
    });
  });
});
