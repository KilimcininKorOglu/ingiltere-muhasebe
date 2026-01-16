import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import VatFilingGuide from '../../../components/guides/VatFilingGuide';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('VatFilingGuide Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should render the guide title', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('VAT Return Filing Guide');
    });

    it('should render introduction text', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByText(/walks you through the process of submitting your VAT return/)).toBeInTheDocument();
    });

    it('should render prerequisites section', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByText('Before You Start')).toBeInTheDocument();
      // Use getAllByText because text appears in both prerequisites and step 1
      const gatewayElements = screen.getAllByText(/Government Gateway user ID/);
      expect(gatewayElements.length).toBeGreaterThan(0);
    });

    it('should render all 7 steps', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByText('Sign in to HMRC Online Services')).toBeInTheDocument();
      expect(screen.getByText('Navigate to Your VAT Account')).toBeInTheDocument();
      expect(screen.getByText('Start Your VAT Return')).toBeInTheDocument();
      expect(screen.getByText('Enter Your VAT Figures')).toBeInTheDocument();
      expect(screen.getByText('Review Your VAT Return')).toBeInTheDocument();
      expect(screen.getByText('Submit Your VAT Return')).toBeInTheDocument();
      expect(screen.getByText('Make Payment or Claim Refund')).toBeInTheDocument();
    });

    it('should render deadline section', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByText('VAT Return Deadline')).toBeInTheDocument();
      expect(screen.getByText(/1 calendar month and 7 days/)).toBeInTheDocument();
    });

    it('should render support links', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByText('Need Help?')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'HMRC VAT Returns Guide' })).toHaveAttribute('href', 'https://www.gov.uk/vat-returns');
    });
  });

  describe('VAT data display', () => {
    it('should display VAT data summary when vatData is provided', () => {
      const vatData = {
        vatDueSales: 1234.56,
        netVatDue: 987.65,
      };
      
      renderWithI18n(<VatFilingGuide vatData={vatData} />);
      
      expect(screen.getByText('Your VAT Data Summary')).toBeInTheDocument();
      expect(screen.getByText('£1234.56')).toBeInTheDocument();
      expect(screen.getByText('£987.65')).toBeInTheDocument();
    });

    it('should not display VAT data summary when vatData is null', () => {
      renderWithI18n(<VatFilingGuide vatData={null} />);
      
      expect(screen.queryByText('Your VAT Data Summary')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse functionality', () => {
    it('should expand all steps when Expand All is clicked', () => {
      renderWithI18n(<VatFilingGuide />);
      
      // First collapse all
      const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseBtn);
      
      // Then expand all
      const expandBtn = screen.getByRole('button', { name: 'Expand All' });
      fireEvent.click(expandBtn);
      
      // All step descriptions should be visible
      expect(screen.getByText(/Access the HMRC online services portal/)).toBeInTheDocument();
    });

    it('should collapse all steps when Collapse All is clicked', () => {
      renderWithI18n(<VatFilingGuide />);
      
      const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseBtn);
      
      // Step descriptions should be hidden
      expect(screen.queryByText(/Access the HMRC online services portal/)).not.toBeInTheDocument();
    });
  });

  describe('field mappings', () => {
    it('should display VAT Box 1-9 field mappings in step 4', () => {
      renderWithI18n(<VatFilingGuide />);
      
      expect(screen.getByText(/Box 1 - VAT due on sales/)).toBeInTheDocument();
      expect(screen.getByText('vatDueSales')).toBeInTheDocument();
    });
  });

  describe('i18n', () => {
    it('should switch to Turkish translations', async () => {
      renderWithI18n(<VatFilingGuide />);
      
      await i18n.changeLanguage('tr');
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('KDV Beyanname Kılavuzu');
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(<VatFilingGuide className="custom-class" />);
      
      const guide = container.querySelector('.filing-guide--vat');
      expect(guide).toHaveClass('custom-class');
    });
  });
});
