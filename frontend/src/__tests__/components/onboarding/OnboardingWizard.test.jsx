import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from '../../../i18n';

// Import components
import OnboardingWizard from '../../../components/onboarding/OnboardingWizard';
import WelcomeStep from '../../../components/onboarding/WelcomeStep';
import BusinessTypeStep from '../../../components/onboarding/BusinessTypeStep';
import VatStatusStep from '../../../components/onboarding/VatStatusStep';
import TaxYearStep from '../../../components/onboarding/TaxYearStep';
import CompanyDetailsStep from '../../../components/onboarding/CompanyDetailsStep';
import BankAccountStep from '../../../components/onboarding/BankAccountStep';
import FeatureTour from '../../../components/onboarding/FeatureTour';
import GettingStartedChecklist from '../../../components/onboarding/GettingStartedChecklist';

describe('OnboardingWizard Components', () => {
  beforeEach(async () => {
    // Reset to English before each test
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('WelcomeStep', () => {
    it('should render welcome message', () => {
      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <WelcomeStep
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      expect(screen.getByText(/Welcome to UK Pre-Accounting/i)).toBeInTheDocument();
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
    });

    it('should display feature list', () => {
      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <WelcomeStep
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      expect(screen.getByText(/Track income and expenses/i)).toBeInTheDocument();
      expect(screen.getByText(/Create and manage invoices/i)).toBeInTheDocument();
    });

    it('should call onNext when Get Started is clicked', () => {
      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <WelcomeStep
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      fireEvent.click(screen.getByText(/Get Started/i));
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('BusinessTypeStep', () => {
    it('should render business type options', () => {
      const mockData = { businessType: null };
      const mockUpdateData = vi.fn();

      render(
        <BusinessTypeStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByText(/Sole Trader/i)).toBeInTheDocument();
      // Use getAllByText since description also mentions "Limited Company"
      expect(screen.getAllByText(/Limited Company/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Partnership/i)).toBeInTheDocument();
    });

    it('should call updateData when a business type is selected', () => {
      const mockData = { businessType: null };
      const mockUpdateData = vi.fn();

      render(
        <BusinessTypeStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      fireEvent.click(screen.getByText(/Sole Trader/i));
      expect(mockUpdateData).toHaveBeenCalledWith({ businessType: 'sole_trader' });
    });

    it('should show selected state for chosen business type', () => {
      const mockData = { businessType: 'limited_company' };
      const mockUpdateData = vi.fn();

      render(
        <BusinessTypeStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      const limitedCompanyOption = screen.getByRole('radio', { name: /Limited Company/i });
      expect(limitedCompanyOption).toHaveAttribute('aria-checked', 'true');
    });

    it('should display error when provided', () => {
      const mockData = { businessType: null };
      const mockUpdateData = vi.fn();
      const errors = { businessType: 'Please select a business type' };

      render(
        <BusinessTypeStep
          data={mockData}
          updateData={mockUpdateData}
          errors={errors}
        />
      );

      expect(screen.getByText(/Please select a business type/i)).toBeInTheDocument();
    });
  });

  describe('VatStatusStep', () => {
    it('should render VAT registration options', () => {
      const mockData = { isVatRegistered: false, vatNumber: '' };
      const mockUpdateData = vi.fn();

      render(
        <VatStatusStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByText(/Yes, I'm VAT registered/i)).toBeInTheDocument();
      expect(screen.getByText(/No, I'm not VAT registered/i)).toBeInTheDocument();
    });

    it('should show VAT number field when VAT registered', () => {
      const mockData = { isVatRegistered: true, vatNumber: '', vatScheme: 'standard' };
      const mockUpdateData = vi.fn();

      render(
        <VatStatusStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/VAT Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/VAT Scheme/i)).toBeInTheDocument();
    });

    it('should not show VAT number field when not VAT registered', () => {
      const mockData = { isVatRegistered: false, vatNumber: '' };
      const mockUpdateData = vi.fn();

      render(
        <VatStatusStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.queryByLabelText(/VAT Number/i)).not.toBeInTheDocument();
    });

    it('should update VAT number when input changes', () => {
      const mockData = { isVatRegistered: true, vatNumber: '', vatScheme: 'standard' };
      const mockUpdateData = vi.fn();

      render(
        <VatStatusStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      const input = screen.getByLabelText(/VAT Number/i);
      fireEvent.change(input, { target: { value: 'GB123456789' } });
      expect(mockUpdateData).toHaveBeenCalledWith({ vatNumber: 'GB123456789' });
    });
  });

  describe('TaxYearStep', () => {
    it('should render tax year information', () => {
      const mockData = { businessType: 'sole_trader' };
      const mockUpdateData = vi.fn();

      render(
        <TaxYearStep
          data={mockData}
          updateData={mockUpdateData}
        />
      );

      expect(screen.getByText(/Confirm your tax year dates/i)).toBeInTheDocument();
      // Use getAllByText since the phrase appears in multiple places
      expect(screen.getAllByText(/6 April to 5 April/i)[0]).toBeInTheDocument();
    });

    it('should show company year end option for limited companies', () => {
      const mockData = { businessType: 'limited_company', companyYearEnd: '' };
      const mockUpdateData = vi.fn();

      render(
        <TaxYearStep
          data={mockData}
          updateData={mockUpdateData}
        />
      );

      // Use getAllByText since Company Year End appears multiple times
      expect(screen.getAllByText(/Company Year End/i)[0]).toBeInTheDocument();
    });

    it('should not show company year end option for sole traders', () => {
      const mockData = { businessType: 'sole_trader' };
      const mockUpdateData = vi.fn();

      render(
        <TaxYearStep
          data={mockData}
          updateData={mockUpdateData}
        />
      );

      expect(screen.queryByText(/Company Year End Date/i)).not.toBeInTheDocument();
    });
  });

  describe('CompanyDetailsStep', () => {
    it('should render company details form', () => {
      const mockData = { businessType: 'limited_company' };
      const mockUpdateData = vi.fn();

      render(
        <CompanyDetailsStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/Business Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Address Line 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Postcode/i)).toBeInTheDocument();
    });

    it('should show company number field for limited companies', () => {
      const mockData = { businessType: 'limited_company' };
      const mockUpdateData = vi.fn();

      render(
        <CompanyDetailsStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/Company Registration Number/i)).toBeInTheDocument();
    });

    it('should not show company number field for sole traders', () => {
      const mockData = { businessType: 'sole_trader' };
      const mockUpdateData = vi.fn();

      render(
        <CompanyDetailsStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.queryByLabelText(/Company Registration Number/i)).not.toBeInTheDocument();
    });

    it('should display validation errors', () => {
      const mockData = { businessType: 'sole_trader' };
      const mockUpdateData = vi.fn();
      const errors = {
        businessName: 'Please enter your business name',
        postcode: 'Please enter a valid UK postcode',
      };

      render(
        <CompanyDetailsStep
          data={mockData}
          updateData={mockUpdateData}
          errors={errors}
        />
      );

      expect(screen.getByText(/Please enter your business name/i)).toBeInTheDocument();
      expect(screen.getByText(/Please enter a valid UK postcode/i)).toBeInTheDocument();
    });
  });

  describe('BankAccountStep', () => {
    it('should render optional notice', () => {
      const mockData = { bankAccount: null };
      const mockUpdateData = vi.fn();

      render(
        <BankAccountStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByText(/This step is optional/i)).toBeInTheDocument();
    });

    it('should show benefits when no bank account added yet', () => {
      const mockData = { bankAccount: null };
      const mockUpdateData = vi.fn();

      render(
        <BankAccountStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByText(/Why add a bank account/i)).toBeInTheDocument();
      expect(screen.getByText(/Add Bank Account/i)).toBeInTheDocument();
    });

    it('should show form when Add Bank Account is clicked', () => {
      const mockData = { bankAccount: null };
      const mockUpdateData = vi.fn();

      render(
        <BankAccountStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      fireEvent.click(screen.getByText(/Add Bank Account/i));
      expect(screen.getByLabelText(/Account Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sort Code/i)).toBeInTheDocument();
    });
  });

  describe('FeatureTour', () => {
    it('should render tour features', () => {
      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <FeatureTour
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      // Use getAllByText since these appear multiple times (nav and cards)
      expect(screen.getAllByText(/Dashboard/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Transactions/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Invoices/i)[0]).toBeInTheDocument();
    });

    it('should allow clicking on feature cards', () => {
      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <FeatureTour
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      const invoicesCard = screen.getAllByText(/Invoices/i)[0];
      fireEvent.click(invoicesCard);
      
      // Should show invoices description
      expect(screen.getByText(/Create professional invoices/i)).toBeInTheDocument();
    });

    it('should call onNext when continue is clicked', () => {
      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <FeatureTour
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      fireEvent.click(screen.getByText(/Continue to Checklist/i));
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('GettingStartedChecklist', () => {
    it('should render checklist items', () => {
      const mockData = { businessName: '', bankAccount: null };
      const mockUpdateData = vi.fn();
      const mockOnComplete = vi.fn();

      render(
        <GettingStartedChecklist
          data={mockData}
          updateData={mockUpdateData}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText(/Complete your profile/i)).toBeInTheDocument();
      expect(screen.getByText(/Add a bank account/i)).toBeInTheDocument();
      expect(screen.getByText(/Record your first transaction/i)).toBeInTheDocument();
    });

    it('should show completed status for completed items', () => {
      const mockData = { 
        businessName: 'My Business', 
        bankAccount: { accountName: 'Test' } 
      };
      const mockUpdateData = vi.fn();
      const mockOnComplete = vi.fn();

      render(
        <GettingStartedChecklist
          data={mockData}
          updateData={mockUpdateData}
          onComplete={mockOnComplete}
        />
      );

      // Should show some items as completed (profile, bankAccount, and setupVat which defaults to true)
      expect(screen.getByText(/3 of 6 completed/i)).toBeInTheDocument();
    });

    it('should call onComplete when Go to Dashboard is clicked', () => {
      const mockData = { businessName: '', bankAccount: null };
      const mockUpdateData = vi.fn();
      const mockOnComplete = vi.fn();

      render(
        <GettingStartedChecklist
          data={mockData}
          updateData={mockUpdateData}
          onComplete={mockOnComplete}
        />
      );

      fireEvent.click(screen.getByText(/Go to Dashboard/i));
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('OnboardingWizard Integration', () => {
    it('should render the wizard when isOpen is true', () => {
      render(<OnboardingWizard isOpen={true} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Use getAllByText since the title appears in multiple places
      expect(screen.getAllByText(/Welcome to UK Pre-Accounting/i)[0]).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<OnboardingWizard isOpen={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should show progress indicator', () => {
      render(<OnboardingWizard isOpen={true} />);
      
      expect(screen.getByText(/Step 1 of 8/i)).toBeInTheDocument();
    });

    it('should navigate to next step when Get Started is clicked', async () => {
      render(<OnboardingWizard isOpen={true} />);
      
      fireEvent.click(screen.getByText(/Get Started/i));
      
      await waitFor(() => {
        expect(screen.getByText(/What type of business do you have/i)).toBeInTheDocument();
      });
    });

    it('should show skip confirmation when skip is clicked', async () => {
      render(<OnboardingWizard isOpen={true} />);
      
      // Navigate to a step with skip button visible
      fireEvent.click(screen.getByText(/Get Started/i));
      
      await waitFor(() => {
        const skipButton = screen.getByText(/Skip for now/i);
        fireEvent.click(skipButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to skip/i)).toBeInTheDocument();
      });
    });
  });

  describe('Bilingual Support', () => {
    it('should display Turkish translations when language is changed', async () => {
      await i18n.changeLanguage('tr');

      const mockData = {};
      const mockUpdateData = vi.fn();
      const mockOnNext = vi.fn();

      render(
        <WelcomeStep
          data={mockData}
          updateData={mockUpdateData}
          onNext={mockOnNext}
        />
      );

      expect(screen.getByText(/UK Ön Muhasebe'ye Hoş Geldiniz/i)).toBeInTheDocument();
      expect(screen.getByText(/Başlayalım/i)).toBeInTheDocument();
    });

    it('should display Turkish business type options', async () => {
      await i18n.changeLanguage('tr');

      const mockData = { businessType: null };
      const mockUpdateData = vi.fn();

      render(
        <BusinessTypeStep
          data={mockData}
          updateData={mockUpdateData}
          errors={{}}
        />
      );

      expect(screen.getByText(/Serbest Meslek/i)).toBeInTheDocument();
      // Use getAllByText since the description also contains "Limited Şirket"
      expect(screen.getAllByText(/Limited Şirket/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Ortaklık/i)).toBeInTheDocument();
    });
  });
});
