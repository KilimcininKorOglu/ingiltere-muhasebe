import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import WarningBanner, { WarningBannerList } from '../../components/validation/WarningBanner';
import { WARNING_SEVERITY, WARNING_CATEGORY } from '../../services/warningService';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('WarningBanner Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should not render when no message is provided', () => {
      const { container } = renderWithI18n(<WarningBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('should render with a direct message', () => {
      renderWithI18n(<WarningBanner message="Test warning message" />);
      expect(screen.getByText('Test warning message')).toBeInTheDocument();
    });

    it('should render with a message key', () => {
      renderWithI18n(
        <WarningBanner messageKey="validation.required" />
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should render from warning object', () => {
      const warning = {
        id: 'test-1',
        messageKey: 'validation.required',
        severity: WARNING_SEVERITY.WARNING,
      };

      renderWithI18n(<WarningBanner warning={warning} />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });
  });

  describe('severity styling', () => {
    it('should apply warning styling by default', () => {
      const { container } = renderWithI18n(
        <WarningBanner message="Test message" />
      );
      expect(container.firstChild).toHaveClass('warning-banner--warning');
    });

    it('should apply info styling', () => {
      const { container } = renderWithI18n(
        <WarningBanner message="Test message" severity={WARNING_SEVERITY.INFO} />
      );
      expect(container.firstChild).toHaveClass('warning-banner--info');
    });

    it('should apply error styling', () => {
      const { container } = renderWithI18n(
        <WarningBanner message="Test message" severity={WARNING_SEVERITY.ERROR} />
      );
      expect(container.firstChild).toHaveClass('warning-banner--error');
    });

    it('should apply critical styling', () => {
      const { container } = renderWithI18n(
        <WarningBanner message="Test message" severity={WARNING_SEVERITY.CRITICAL} />
      );
      expect(container.firstChild).toHaveClass('warning-banner--critical');
    });
  });

  describe('dismiss functionality', () => {
    it('should show dismiss button when dismissible', () => {
      renderWithI18n(<WarningBanner message="Test message" dismissible={true} />);
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('should not show dismiss button when not dismissible', () => {
      renderWithI18n(<WarningBanner message="Test message" dismissible={false} />);
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      const warning = { id: 'test-1', messageKey: 'validation.required', dismissible: true };

      renderWithI18n(<WarningBanner warning={warning} onDismiss={onDismiss} />);
      
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onDismiss).toHaveBeenCalledWith('test-1');
    });

    it('should hide banner after dismiss', () => {
      const { container } = renderWithI18n(
        <WarningBanner message="Test message" dismissible={true} />
      );
      
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(container.firstChild).toBeNull();
    });
  });

  describe('action button', () => {
    it('should show action button when actionKey is provided', () => {
      renderWithI18n(
        <WarningBanner 
          message="Test message" 
          actionKey="actions.registerForVat" 
        />
      );
      expect(screen.getByText('Register for VAT')).toBeInTheDocument();
    });

    it('should call onAction when action button is clicked', () => {
      const onAction = vi.fn();
      const warning = { 
        id: 'test-1', 
        messageKey: 'validation.required',
        actionKey: 'actions.fixNow',
      };

      renderWithI18n(
        <WarningBanner warning={warning} onAction={onAction} />
      );
      
      fireEvent.click(screen.getByText('Fix Now'));
      expect(onAction).toHaveBeenCalledWith(warning);
    });
  });

  describe('accessibility', () => {
    it('should have alert role for critical severity', () => {
      renderWithI18n(
        <WarningBanner message="Critical message" severity={WARNING_SEVERITY.CRITICAL} />
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have status role for info severity', () => {
      renderWithI18n(
        <WarningBanner message="Info message" severity={WARNING_SEVERITY.INFO} />
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});

describe('WarningBannerList Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should not render when no warnings are provided', () => {
    const { container } = renderWithI18n(<WarningBannerList warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render multiple warning banners', () => {
    const warnings = [
      { id: 'w1', messageKey: 'validation.required', severity: WARNING_SEVERITY.WARNING },
      { id: 'w2', messageKey: 'validation.invalidEmail', severity: WARNING_SEVERITY.ERROR },
    ];

    renderWithI18n(<WarningBannerList warnings={warnings} />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('should limit visible warnings when maxVisible is set', () => {
    const warnings = [
      { id: 'w1', messageKey: 'validation.required', severity: WARNING_SEVERITY.WARNING },
      { id: 'w2', messageKey: 'validation.invalidEmail', severity: WARNING_SEVERITY.WARNING },
      { id: 'w3', messageKey: 'validation.minLength', params: { min: 8 }, severity: WARNING_SEVERITY.WARNING },
    ];

    renderWithI18n(<WarningBannerList warnings={warnings} maxVisible={2} />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(screen.queryByText('Must be at least 8 characters')).not.toBeInTheDocument();
  });

  it('should call onDismiss for individual warnings', () => {
    const onDismiss = vi.fn();
    const warnings = [
      { id: 'w1', messageKey: 'validation.required', severity: WARNING_SEVERITY.WARNING, dismissible: true },
    ];

    renderWithI18n(<WarningBannerList warnings={warnings} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledWith('w1');
  });
});
