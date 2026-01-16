import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('LanguageSwitcher Component', () => {
  beforeEach(async () => {
    // Reset to English before each test
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('dropdown variant', () => {
    it('should render dropdown select element', () => {
      renderWithI18n(<LanguageSwitcher variant="dropdown" />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should show all supported languages as options', () => {
      renderWithI18n(<LanguageSwitcher variant="dropdown" />);
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('English');
      expect(options[1]).toHaveTextContent('Türkçe');
    });

    it('should have current language selected', () => {
      renderWithI18n(<LanguageSwitcher variant="dropdown" />);
      
      const select = screen.getByRole('combobox');
      expect(select.value).toBe('en');
    });

    it('should change language when option is selected', async () => {
      renderWithI18n(<LanguageSwitcher variant="dropdown" />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'tr' } });

      await waitFor(() => {
        expect(i18n.language).toBe('tr');
      });
    });

    it('should display label with current language text', () => {
      renderWithI18n(<LanguageSwitcher variant="dropdown" />);
      
      expect(screen.getByText('Language:')).toBeInTheDocument();
    });
  });

  describe('buttons variant', () => {
    it('should render buttons for each language', () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('should mark current language button as active', () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" />);
      
      const englishButton = screen.getByRole('button', { name: /english/i });
      expect(englishButton).toHaveAttribute('aria-pressed', 'true');
      expect(englishButton).toHaveClass('language-switcher__button--active');
    });

    it('should change language when button is clicked', async () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" />);
      
      const turkishButton = screen.getByRole('button', { name: /türkçe/i });
      fireEvent.click(turkishButton);

      await waitFor(() => {
        expect(i18n.language).toBe('tr');
      });
    });

    it('should not change language when clicking already active button', async () => {
      const onLanguageChange = vi.fn();
      renderWithI18n(
        <LanguageSwitcher variant="buttons" onLanguageChange={onLanguageChange} />
      );
      
      const englishButton = screen.getByRole('button', { name: /english/i });
      fireEvent.click(englishButton);

      // Should not call the callback since language is already English
      expect(onLanguageChange).not.toHaveBeenCalled();
    });
  });

  describe('onLanguageChange callback', () => {
    it('should call onLanguageChange callback when language changes', async () => {
      const onLanguageChange = vi.fn();
      renderWithI18n(
        <LanguageSwitcher variant="buttons" onLanguageChange={onLanguageChange} />
      );
      
      const turkishButton = screen.getByRole('button', { name: /türkçe/i });
      fireEvent.click(turkishButton);

      await waitFor(() => {
        expect(onLanguageChange).toHaveBeenCalledWith('tr');
      });
    });
  });

  describe('showNativeName prop', () => {
    it('should show native names when showNativeName is true', () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" showNativeName={true} />);
      
      expect(screen.getByRole('button', { name: /türkçe/i })).toBeInTheDocument();
    });

    it('should show English names when showNativeName is false', () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" showNativeName={false} />);
      
      expect(screen.getByRole('button', { name: /turkish/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-label for dropdown', () => {
      renderWithI18n(<LanguageSwitcher variant="dropdown" />);
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label', 'Select Language');
    });

    it('should have proper role for button group', () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" />);
      
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', 'Select Language');
    });

    it('should have aria-pressed on buttons', () => {
      renderWithI18n(<LanguageSwitcher variant="buttons" />);
      
      const buttons = screen.getAllByRole('button');
      const activeButton = buttons.find((btn) => btn.getAttribute('aria-pressed') === 'true');
      const inactiveButton = buttons.find((btn) => btn.getAttribute('aria-pressed') === 'false');

      expect(activeButton).toBeInTheDocument();
      expect(inactiveButton).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className to dropdown variant', () => {
      const { container } = renderWithI18n(
        <LanguageSwitcher variant="dropdown" className="custom-class" />
      );
      
      const wrapper = container.querySelector('.language-switcher');
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should apply custom className to buttons variant', () => {
      const { container } = renderWithI18n(
        <LanguageSwitcher variant="buttons" className="custom-class" />
      );
      
      const wrapper = container.querySelector('.language-switcher');
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});
