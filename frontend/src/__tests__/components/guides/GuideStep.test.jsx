import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import GuideStep from '../../../components/guides/GuideStep';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('GuideStep Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should render step number and title', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
        />
      );
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Sign in to HMRC Online Services');
    });

    it('should render description', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
        />
      );
      
      expect(screen.getByText(/Access the HMRC online services portal/)).toBeInTheDocument();
    });

    it('should render sub-steps when provided', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          subSteps={[
            'guides.vat.step1.sub1',
            'guides.vat.step1.sub2',
          ]}
        />
      );
      
      expect(screen.getByText(/Go to www.gov.uk/)).toBeInTheDocument();
      expect(screen.getByText(/Click 'Sign in'/)).toBeInTheDocument();
    });

    it('should render tip when provided', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          tipKey="guides.vat.step1.tip"
        />
      );
      
      expect(screen.getByText(/Tip/)).toBeInTheDocument();
      expect(screen.getByText(/forgotten your Government Gateway/)).toBeInTheDocument();
    });

    it('should render warning when provided', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={4}
          titleKey="guides.vat.step4.title"
          descriptionKey="guides.vat.step4.description"
          warningKey="guides.vat.step4.warning"
        />
      );
      
      expect(screen.getByText(/Warning/)).toBeInTheDocument();
      expect(screen.getByText(/Double-check all figures/)).toBeInTheDocument();
    });

    it('should render field mappings table when provided', () => {
      const fieldMappings = [
        {
          hmrcFieldKey: 'guides.vat.fields.box1',
          appField: 'vatDueSales',
          descriptionKey: 'guides.vat.fields.box1Desc',
        },
      ];
      
      renderWithI18n(
        <GuideStep
          stepNumber={4}
          titleKey="guides.vat.step4.title"
          descriptionKey="guides.vat.step4.description"
          fieldMappings={fieldMappings}
        />
      );
      
      expect(screen.getByText('Field Mappings')).toBeInTheDocument();
      expect(screen.getByText('HMRC Field')).toBeInTheDocument();
      expect(screen.getByText('App Value')).toBeInTheDocument();
      expect(screen.getByText(/Box 1/)).toBeInTheDocument();
      expect(screen.getByText('vatDueSales')).toBeInTheDocument();
    });

    it('should render screenshot when provided', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          screenshotSrc="/test-image.svg"
          screenshotAltKey="guides.vat.step1.screenshotAlt"
        />
      );
      
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/test-image.svg');
      expect(img).toHaveAttribute('alt', 'HMRC Government Gateway login page');
    });
  });

  describe('expand/collapse', () => {
    it('should show content when expanded', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          isExpanded={true}
        />
      );
      
      expect(screen.getByText(/Access the HMRC online services portal/)).toBeInTheDocument();
    });

    it('should hide content when collapsed', () => {
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          isExpanded={false}
        />
      );
      
      expect(screen.queryByText(/Access the HMRC online services portal/)).not.toBeInTheDocument();
    });

    it('should call onToggle when header is clicked', () => {
      const handleToggle = vi.fn();
      
      renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          onToggle={handleToggle}
        />
      );
      
      const header = screen.getByRole('button');
      fireEvent.click(header);
      
      expect(handleToggle).toHaveBeenCalledWith(1);
    });
  });

  describe('accessibility', () => {
    it('should have proper step number aria-hidden', () => {
      const { container } = renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
        />
      );
      
      const stepNumber = container.querySelector('.guide-step__number');
      expect(stepNumber).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have data-step attribute', () => {
      const { container } = renderWithI18n(
        <GuideStep
          stepNumber={3}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
        />
      );
      
      const step = container.querySelector('.guide-step');
      expect(step).toHaveAttribute('data-step', '3');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(
        <GuideStep
          stepNumber={1}
          titleKey="guides.vat.step1.title"
          descriptionKey="guides.vat.step1.description"
          className="custom-class"
        />
      );
      
      const step = container.querySelector('.guide-step');
      expect(step).toHaveClass('custom-class');
    });
  });
});
