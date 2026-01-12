import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import ValidationMessage, { MESSAGE_TYPE } from '../../components/validation/ValidationMessage';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('ValidationMessage Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should not render when no messages are provided', () => {
      const { container } = renderWithI18n(<ValidationMessage />);
      expect(container.firstChild).toBeNull();
    });

    it('should render a single message', () => {
      renderWithI18n(<ValidationMessage message="Test error message" />);
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should render message from translation key', () => {
      renderWithI18n(
        <ValidationMessage messageKey="validation.required" />
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('should render multiple messages as a list', () => {
      renderWithI18n(
        <ValidationMessage messages={['Error 1', 'Error 2', 'Error 3']} />
      );
      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('Error 2')).toBeInTheDocument();
      expect(screen.getByText('Error 3')).toBeInTheDocument();
    });

    it('should render errors array with translation keys', () => {
      renderWithI18n(
        <ValidationMessage
          errors={[
            { errorKey: 'validation.required' },
            { errorKey: 'validation.invalidEmail' },
          ]}
        />
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  describe('message types', () => {
    it('should apply error styling by default', () => {
      const { container } = renderWithI18n(
        <ValidationMessage message="Error message" />
      );
      expect(container.firstChild).toHaveClass('validation-message--error');
    });

    it('should apply warning styling', () => {
      const { container } = renderWithI18n(
        <ValidationMessage type={MESSAGE_TYPE.WARNING} message="Warning message" />
      );
      expect(container.firstChild).toHaveClass('validation-message--warning');
    });

    it('should apply success styling', () => {
      const { container } = renderWithI18n(
        <ValidationMessage type={MESSAGE_TYPE.SUCCESS} message="Success message" />
      );
      expect(container.firstChild).toHaveClass('validation-message--success');
    });

    it('should apply info styling', () => {
      const { container } = renderWithI18n(
        <ValidationMessage type={MESSAGE_TYPE.INFO} message="Info message" />
      );
      expect(container.firstChild).toHaveClass('validation-message--info');
    });
  });

  describe('icon display', () => {
    it('should show icon by default', () => {
      const { container } = renderWithI18n(
        <ValidationMessage message="Test message" />
      );
      expect(container.querySelector('.validation-message__icon')).toBeInTheDocument();
    });

    it('should hide icon when showIcon is false', () => {
      const { container } = renderWithI18n(
        <ValidationMessage message="Test message" showIcon={false} />
      );
      expect(container.querySelector('.validation-message__icon')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have alert role for error type', () => {
      renderWithI18n(<ValidationMessage message="Error message" type={MESSAGE_TYPE.ERROR} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have status role for other types', () => {
      renderWithI18n(<ValidationMessage message="Info message" type={MESSAGE_TYPE.INFO} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should use custom role when provided', () => {
      renderWithI18n(<ValidationMessage message="Test message" role="log" />);
      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('should use provided id', () => {
      const { container } = renderWithI18n(
        <ValidationMessage message="Test message" id="custom-id" />
      );
      expect(container.firstChild).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(
        <ValidationMessage message="Test message" className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('interpolation', () => {
    it('should interpolate message params', () => {
      renderWithI18n(
        <ValidationMessage
          messageKey="validation.minLength"
          messageParams={{ min: 8 }}
        />
      );
      expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
    });
  });
});
