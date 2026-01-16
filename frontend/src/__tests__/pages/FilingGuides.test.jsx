import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import FilingGuides from '../../pages/FilingGuides';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('FilingGuides Page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('HMRC Filing Guides');
    });

    it('should render page description', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByText(/Step-by-step instructions for manually submitting your tax returns/)).toBeInTheDocument();
    });

    it('should render disclaimer', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByText(/These guides are for informational purposes only/)).toBeInTheDocument();
    });

    it('should render all three guide tabs', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByRole('tab', { name: /VAT Return/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Corporation Tax/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Self Assessment/ })).toBeInTheDocument();
    });

    it('should render quick links section', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByText('Quick Links')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /HMRC Online Services Login/ })).toBeInTheDocument();
      // Use getAllByRole because there are multiple "Contact HMRC" links in guides
      const contactLinks = screen.getAllByRole('link', { name: /Contact HMRC/ });
      expect(contactLinks.length).toBeGreaterThan(0);
    });
  });

  describe('tab navigation', () => {
    it('should show VAT guide by default', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByRole('tab', { name: /VAT Return/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('VAT Return Filing Guide')).toBeInTheDocument();
    });

    it('should show Corporation Tax guide when CT tab is clicked', async () => {
      renderWithI18n(<FilingGuides />);
      
      const ctTab = screen.getByRole('tab', { name: /Corporation Tax/ });
      fireEvent.click(ctTab);
      
      await waitFor(() => {
        expect(ctTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Corporation Tax (CT600) Filing Guide')).toBeInTheDocument();
      });
    });

    it('should show Self Assessment guide when SA tab is clicked', async () => {
      renderWithI18n(<FilingGuides />);
      
      const saTab = screen.getByRole('tab', { name: /Self Assessment/ });
      fireEvent.click(saTab);
      
      await waitFor(() => {
        expect(saTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Self Assessment Filing Guide')).toBeInTheDocument();
      });
    });
  });

  describe('defaultGuide prop', () => {
    it('should show VAT guide when defaultGuide is vat', () => {
      renderWithI18n(<FilingGuides defaultGuide="vat" />);
      
      expect(screen.getByText('VAT Return Filing Guide')).toBeInTheDocument();
    });

    it('should show CT guide when defaultGuide is ct', () => {
      renderWithI18n(<FilingGuides defaultGuide="ct" />);
      
      expect(screen.getByText('Corporation Tax (CT600) Filing Guide')).toBeInTheDocument();
    });

    it('should show SA guide when defaultGuide is sa', () => {
      renderWithI18n(<FilingGuides defaultGuide="sa" />);
      
      expect(screen.getByText('Self Assessment Filing Guide')).toBeInTheDocument();
    });
  });

  describe('taxData prop', () => {
    it('should pass VAT data to VatFilingGuide', () => {
      const taxData = {
        vat: {
          vatDueSales: 1234.56,
          netVatDue: 987.65,
        },
      };
      
      renderWithI18n(<FilingGuides taxData={taxData} defaultGuide="vat" />);
      
      expect(screen.getByText('Your VAT Data Summary')).toBeInTheDocument();
      expect(screen.getByText('£1234.56')).toBeInTheDocument();
    });

    it('should pass CT data to CorporationTaxGuide', () => {
      const taxData = {
        ct: {
          totalTurnover: 500000.00,
          corporationTaxPayable: 12500.00,
        },
      };
      
      renderWithI18n(<FilingGuides taxData={taxData} defaultGuide="ct" />);
      
      expect(screen.getByText('Your Corporation Tax Data Summary')).toBeInTheDocument();
      expect(screen.getByText('£500000.00')).toBeInTheDocument();
    });

    it('should pass SA data to SelfAssessmentGuide', () => {
      const taxData = {
        sa: {
          totalIncome: 75000.00,
          taxDue: 15000.00,
        },
      };
      
      renderWithI18n(<FilingGuides taxData={taxData} defaultGuide="sa" />);
      
      expect(screen.getByText('Your Self Assessment Data Summary')).toBeInTheDocument();
      expect(screen.getByText('£75000.00')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper tablist role', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have proper tabpanel role', () => {
      renderWithI18n(<FilingGuides />);
      
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('should associate tabs with panels via aria-controls', () => {
      renderWithI18n(<FilingGuides />);
      
      const vatTab = screen.getByRole('tab', { name: /VAT Return/ });
      expect(vatTab).toHaveAttribute('aria-controls', 'panel-vat');
    });
  });

  describe('i18n', () => {
    it('should switch to Turkish translations', async () => {
      renderWithI18n(<FilingGuides />);
      
      await i18n.changeLanguage('tr');
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('HMRC Beyanname Kılavuzları');
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(<FilingGuides className="custom-class" />);
      
      const page = container.querySelector('.filing-guides-page');
      expect(page).toHaveClass('custom-class');
    });
  });
});
