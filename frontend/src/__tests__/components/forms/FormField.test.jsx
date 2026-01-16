import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import FormField from '../../../components/forms/FormField';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('FormField Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('basic rendering', () => {
    it('should render label and input', () => {
      renderWithI18n(<FormField name="testField" label="Test Label" />);

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render with required indicator', () => {
      renderWithI18n(<FormField name="testField" label="Required Field" required />);

      const label = screen.getByText('Required Field');
      expect(label).toHaveClass('form-field__label--required');
    });

    it('should render placeholder', () => {
      renderWithI18n(
        <FormField name="testField" label="With Placeholder" placeholder="Enter value..." />
      );

      expect(screen.getByPlaceholderText('Enter value...')).toBeInTheDocument();
    });
  });

  describe('input types', () => {
    it('should render text input by default', () => {
      renderWithI18n(<FormField name="text" label="Text" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render email input', () => {
      renderWithI18n(<FormField name="email" label="Email" type="email" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should render number input', () => {
      renderWithI18n(<FormField name="amount" label="Amount" type="number" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should render select element', () => {
      renderWithI18n(
        <FormField name="select" label="Select" type="select">
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </FormField>
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('should render textarea', () => {
      renderWithI18n(<FormField name="notes" label="Notes" type="textarea" />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render checkbox', () => {
      renderWithI18n(<FormField name="agree" label="Agree" type="checkbox" />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should render radio', () => {
      renderWithI18n(<FormField name="option" label="Option" type="radio" />);

      expect(screen.getByRole('radio')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should display error message', () => {
      renderWithI18n(
        <FormField name="field" label="Field" error="This field is required" />
      );

      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should apply error class to input', () => {
      renderWithI18n(
        <FormField name="field" label="Field" error="Error" />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('form-field__input--error');
    });

    it('should set aria-invalid when there is an error', () => {
      renderWithI18n(
        <FormField name="field" label="Field" error="Error" />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error with input via aria-describedby', () => {
      renderWithI18n(
        <FormField name="field" label="Field" error="Error message" />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby');
      
      const errorId = input.getAttribute('aria-describedby');
      expect(screen.getByRole('alert')).toHaveAttribute('id', errorId);
    });
  });

  describe('hint text', () => {
    it('should display hint text', () => {
      renderWithI18n(
        <FormField name="field" label="Field" hint="This is a helpful hint" />
      );

      expect(screen.getByText('This is a helpful hint')).toBeInTheDocument();
    });

    it('should associate hint with input via aria-describedby', () => {
      renderWithI18n(
        <FormField name="field" label="Field" hint="Helpful hint" />
      );

      const input = screen.getByRole('textbox');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
    });
  });

  describe('tooltip integration', () => {
    it('should show help icon for fields with tooltips', () => {
      renderWithI18n(
        <FormField name="vatNumber" label="VAT Number" tooltipKey="company.vatNumber" />
      );

      // Find help icon button
      const helpIcon = screen.getByLabelText('Click for more information');
      expect(helpIcon).toBeInTheDocument();
    });

    it('should not show help icon when showHelpIcon is false', () => {
      renderWithI18n(
        <FormField 
          name="vatNumber" 
          label="VAT Number" 
          tooltipKey="company.vatNumber"
          showHelpIcon={false}
        />
      );

      expect(screen.queryByLabelText('Click for more information')).not.toBeInTheDocument();
    });

    it('should show detailed tooltip content in popover when help icon is clicked', async () => {
      renderWithI18n(
        <FormField name="vatNumber" label="VAT Number" tooltipKey="company.vatNumber" />
      );

      const helpIcon = screen.getByLabelText('Click for more information');
      fireEvent.click(helpIcon);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // Should contain detailed tooltip content about VAT numbers
        expect(screen.getByText(/UK VAT numbers start with 'GB'/i)).toBeInTheDocument();
      });
    });

    it('should auto-detect tooltip key from common field names', () => {
      renderWithI18n(<FormField name="sortCode" label="Sort Code" />);

      // Should show help icon because sortCode maps to bank.sortCode
      const helpIcon = screen.getByLabelText('Click for more information');
      expect(helpIcon).toBeInTheDocument();
    });
  });

  describe('controlled input', () => {
    it('should handle value changes', () => {
      const handleChange = vi.fn();
      renderWithI18n(
        <FormField 
          name="field" 
          label="Field" 
          value="initial" 
          onChange={handleChange} 
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('initial');

      fireEvent.change(input, { target: { value: 'updated' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('should handle blur events', () => {
      const handleBlur = vi.fn();
      renderWithI18n(
        <FormField name="field" label="Field" onBlur={handleBlur} />
      );

      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });

    it('should handle checkbox checked state', () => {
      const handleChange = vi.fn();
      renderWithI18n(
        <FormField 
          name="checkbox" 
          label="Checkbox" 
          type="checkbox" 
          value={true} 
          onChange={handleChange} 
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      renderWithI18n(<FormField name="field" label="Field" disabled />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should disable select when disabled', () => {
      renderWithI18n(
        <FormField name="select" label="Select" type="select" disabled>
          <option value="1">Option 1</option>
        </FormField>
      );

      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(
        <FormField name="field" label="Field" className="custom-field" />
      );

      expect(container.querySelector('.form-field')).toHaveClass('custom-field');
    });
  });

  describe('inputProps', () => {
    it('should pass additional props to input', () => {
      renderWithI18n(
        <FormField 
          name="field" 
          label="Field" 
          inputProps={{ maxLength: 10, autoComplete: 'off' }} 
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '10');
      expect(input).toHaveAttribute('autoComplete', 'off');
    });

    it('should pass rows prop to textarea', () => {
      renderWithI18n(
        <FormField 
          name="notes" 
          label="Notes" 
          type="textarea" 
          inputProps={{ rows: 5 }} 
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '5');
    });
  });

  describe('bilingual support', () => {
    it('should show Turkish tooltip content when language is Turkish', async () => {
      await i18n.changeLanguage('tr');

      renderWithI18n(
        <FormField name="vatNumber" label="KDV Numarası" tooltipKey="company.vatNumber" />
      );

      const helpIcon = screen.getByLabelText(/tıklayın/i);
      fireEvent.click(helpIcon);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // Should contain Turkish tooltip content
        expect(screen.getByText(/İngiltere KDV numaraları 'GB' ile başlar/i)).toBeInTheDocument();
      });
    });
  });
});
