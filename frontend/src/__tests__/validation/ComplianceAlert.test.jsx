import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import ComplianceAlert, { ComplianceAlertPanel } from '../../components/validation/ComplianceAlert';
import { WARNING_SEVERITY, WARNING_CATEGORY } from '../../services/warningService';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('ComplianceAlert Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should not render when no message is provided', () => {
      const { container } = renderWithI18n(<ComplianceAlert />);
      expect(container.firstChild).toBeNull();
    });

    it('should render with a direct message', () => {
      renderWithI18n(<ComplianceAlert message="Test compliance alert" />);
      expect(screen.getByText('Test compliance alert')).toBeInTheDocument();
    });

    it('should render from alert object', () => {
      const alert = {
        id: 'test-1',
        messageKey: 'compliance.vatRegistrationRequired',
        params: { threshold: 90000 },
        severity: WARNING_SEVERITY.CRITICAL,
        category: WARNING_CATEGORY.COMPLIANCE,
      };

      renderWithI18n(<ComplianceAlert alert={alert} />);
      expect(screen.getByText(/VAT registration is now mandatory/)).toBeInTheDocument();
    });

    it('should display severity badge', () => {
      renderWithI18n(
        <ComplianceAlert 
          message="Test message" 
          severity={WARNING_SEVERITY.WARNING}
        />
      );
      // Look for the severity badge - either translated text or class
      const alertElement = screen.getByText('Test message').closest('.compliance-alert');
      expect(alertElement).toHaveClass('compliance-alert--warning');
    });
  });

  describe('severity styling', () => {
    it('should apply warning styling by default', () => {
      const { container } = renderWithI18n(
        <ComplianceAlert message="Test message" />
      );
      expect(container.firstChild).toHaveClass('compliance-alert--warning');
    });

    it('should apply critical styling', () => {
      const { container } = renderWithI18n(
        <ComplianceAlert message="Test message" severity={WARNING_SEVERITY.CRITICAL} />
      );
      expect(container.firstChild).toHaveClass('compliance-alert--critical');
    });

    it('should apply error styling', () => {
      const { container } = renderWithI18n(
        <ComplianceAlert message="Test message" severity={WARNING_SEVERITY.ERROR} />
      );
      expect(container.firstChild).toHaveClass('compliance-alert--error');
    });
  });

  describe('category styling', () => {
    it('should apply category class', () => {
      const { container } = renderWithI18n(
        <ComplianceAlert 
          message="Test message" 
          category={WARNING_CATEGORY.TAX}
        />
      );
      expect(container.firstChild).toHaveClass('compliance-alert--tax');
    });
  });

  describe('dismiss functionality', () => {
    it('should show dismiss button when dismissible', () => {
      renderWithI18n(
        <ComplianceAlert message="Test message" dismissible={true} />
      );
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('should not show dismiss button when not dismissible', () => {
      renderWithI18n(
        <ComplianceAlert message="Test message" dismissible={false} />
      );
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      const alert = { 
        id: 'test-1', 
        messageKey: 'validation.required',
        dismissible: true,
      };

      renderWithI18n(<ComplianceAlert alert={alert} onDismiss={onDismiss} />);
      
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onDismiss).toHaveBeenCalledWith('test-1');
    });
  });

  describe('action button', () => {
    it('should show action button when actionKey is provided', () => {
      renderWithI18n(
        <ComplianceAlert 
          message="Test message" 
          actionKey="actions.registerForVat" 
        />
      );
      expect(screen.getByText('Register for VAT')).toBeInTheDocument();
    });

    it('should call onAction when action button is clicked', () => {
      const onAction = vi.fn();
      const alert = { 
        id: 'test-1', 
        messageKey: 'validation.required',
        actionKey: 'actions.fixNow',
      };

      renderWithI18n(
        <ComplianceAlert alert={alert} onAction={onAction} />
      );
      
      fireEvent.click(screen.getByText('Fix Now'));
      expect(onAction).toHaveBeenCalledWith(alert);
    });
  });

  describe('learn more link', () => {
    it('should show learn more link when learnMoreUrl is provided', () => {
      renderWithI18n(
        <ComplianceAlert 
          message="Test message" 
          learnMoreUrl="https://example.com"
        />
      );
      // The link should have the correct href
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('accessibility', () => {
    it('should have alert role for critical severity', () => {
      renderWithI18n(
        <ComplianceAlert message="Critical message" severity={WARNING_SEVERITY.CRITICAL} />
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have status role for info severity', () => {
      renderWithI18n(
        <ComplianceAlert message="Info message" severity={WARNING_SEVERITY.INFO} />
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});

describe('ComplianceAlertPanel Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should not render when no alerts are provided', () => {
    const { container } = renderWithI18n(<ComplianceAlertPanel alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render multiple compliance alerts', () => {
    const alerts = [
      { 
        id: 'a1', 
        messageKey: 'compliance.vatRegistrationRequired',
        params: { threshold: 90000 },
        severity: WARNING_SEVERITY.CRITICAL,
        category: WARNING_CATEGORY.COMPLIANCE,
      },
      { 
        id: 'a2', 
        messageKey: 'compliance.missingReceipt',
        params: { amount: 50 },
        severity: WARNING_SEVERITY.WARNING,
        category: WARNING_CATEGORY.COMPLIANCE,
      },
    ];

    renderWithI18n(<ComplianceAlertPanel alerts={alerts} />);
    expect(screen.getByText(/VAT registration is now mandatory/)).toBeInTheDocument();
    expect(screen.getByText(/Receipt is missing/)).toBeInTheDocument();
  });

  it('should show panel title with count', () => {
    const alerts = [
      { 
        id: 'a1', 
        messageKey: 'validation.required',
        severity: WARNING_SEVERITY.WARNING,
      },
      { 
        id: 'a2', 
        messageKey: 'validation.invalidEmail',
        severity: WARNING_SEVERITY.WARNING,
      },
    ];

    const { container } = renderWithI18n(<ComplianceAlertPanel alerts={alerts} />);
    // Check for panel title element and count
    expect(container.querySelector('.compliance-alert-panel__title')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should sort alerts by severity with critical first', () => {
    const alerts = [
      { 
        id: 'a1', 
        messageKey: 'validation.required',
        severity: WARNING_SEVERITY.INFO,
      },
      { 
        id: 'a2', 
        messageKey: 'validation.invalidEmail',
        severity: WARNING_SEVERITY.CRITICAL,
      },
    ];

    const { container } = renderWithI18n(<ComplianceAlertPanel alerts={alerts} />);
    const alertElements = container.querySelectorAll('.compliance-alert');
    
    // Critical should come first
    expect(alertElements[0]).toHaveClass('compliance-alert--critical');
    expect(alertElements[1]).toHaveClass('compliance-alert--info');
  });

  it('should call onDismiss for individual alerts', () => {
    const onDismiss = vi.fn();
    const alerts = [
      { 
        id: 'a1', 
        messageKey: 'validation.required',
        severity: WARNING_SEVERITY.WARNING,
        dismissible: true,
      },
    ];

    renderWithI18n(<ComplianceAlertPanel alerts={alerts} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledWith('a1');
  });
});
