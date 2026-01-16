import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import Glossary from '../../components/Glossary';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('Glossary Component', () => {
  beforeEach(async () => {
    // Reset to English before each test
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render the glossary component', () => {
      renderWithI18n(<Glossary />);
      
      expect(screen.getByText('Financial and Tax Terminology Glossary')).toBeInTheDocument();
    });

    it('should display the search input', () => {
      renderWithI18n(<Glossary />);
      
      const searchInput = screen.getByRole('textbox', { name: /search terms/i });
      expect(searchInput).toBeInTheDocument();
    });

    it('should display category filter dropdown', () => {
      renderWithI18n(<Glossary />);
      
      const categorySelect = screen.getByRole('combobox', { name: /filter by category/i });
      expect(categorySelect).toBeInTheDocument();
    });

    it('should display expand and collapse buttons', () => {
      renderWithI18n(<Glossary />);
      
      expect(screen.getByRole('button', { name: /expand all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /collapse all/i })).toBeInTheDocument();
    });

    it('should display terms count', () => {
      renderWithI18n(<Glossary />);
      
      expect(screen.getByText(/terms found/i)).toBeInTheDocument();
    });

    it('should render glossary terms', () => {
      renderWithI18n(<Glossary />);
      
      // Check for a known term
      expect(screen.getByText('VAT')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should filter terms based on search query', async () => {
      renderWithI18n(<Glossary />);
      
      const searchInput = screen.getByRole('textbox', { name: /search terms/i });
      fireEvent.change(searchInput, { target: { value: 'VAT' } });

      await waitFor(() => {
        expect(screen.getByText('VAT')).toBeInTheDocument();
        // Should not find terms that don't match
        expect(screen.queryByText(/Sole Trader/i)).not.toBeInTheDocument();
      });
    });

    it('should search in Turkish translations', async () => {
      renderWithI18n(<Glossary />);
      
      const searchInput = screen.getByRole('textbox', { name: /search terms/i });
      fireEvent.change(searchInput, { target: { value: 'KDV' } });

      await waitFor(() => {
        expect(screen.getByText('VAT')).toBeInTheDocument();
      });
    });

    it('should show no results message when no matches', async () => {
      renderWithI18n(<Glossary />);
      
      const searchInput = screen.getByRole('textbox', { name: /search terms/i });
      fireEvent.change(searchInput, { target: { value: 'xyznonexistent123' } });

      await waitFor(() => {
        expect(screen.getByText(/no terms found matching your search criteria/i)).toBeInTheDocument();
      });
    });

    it('should search in explanations', async () => {
      renderWithI18n(<Glossary />);
      
      const searchInput = screen.getByRole('textbox', { name: /search terms/i });
      fireEvent.change(searchInput, { target: { value: 'consumption tax' } });

      await waitFor(() => {
        expect(screen.getByText('VAT')).toBeInTheDocument();
      });
    });
  });

  describe('category filter', () => {
    it('should filter by category', async () => {
      renderWithI18n(<Glossary />);
      
      const categorySelect = screen.getByRole('combobox', { name: /filter by category/i });
      fireEvent.change(categorySelect, { target: { value: 'tax' } });

      await waitFor(() => {
        expect(screen.getByText('VAT')).toBeInTheDocument();
        // Banking terms should not be visible when filtering by tax
        expect(screen.queryByText(/Direct Debit/i)).not.toBeInTheDocument();
      });
    });

    it('should show all categories option', () => {
      renderWithI18n(<Glossary />);
      
      const categorySelect = screen.getByRole('combobox', { name: /filter by category/i });
      const options = within(categorySelect).getAllByRole('option');
      
      expect(options[0]).toHaveTextContent('All Categories');
    });

    it('should display clear button when filter is applied', async () => {
      renderWithI18n(<Glossary />);
      
      const categorySelect = screen.getByRole('combobox', { name: /filter by category/i });
      fireEvent.change(categorySelect, { target: { value: 'tax' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
    });
  });

  describe('expand/collapse functionality', () => {
    it('should expand a term when clicked', async () => {
      renderWithI18n(<Glossary />);
      
      // Find VAT term button and click it
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      fireEvent.click(vatButton);

      await waitFor(() => {
        expect(screen.getByText('Value Added Tax')).toBeInTheDocument();
      });
    });

    it('should collapse a term when clicked again', async () => {
      renderWithI18n(<Glossary />);
      
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      
      // Expand
      fireEvent.click(vatButton);
      await waitFor(() => {
        expect(screen.getByText('Value Added Tax')).toBeInTheDocument();
      });
      
      // Collapse
      fireEvent.click(vatButton);
      await waitFor(() => {
        expect(screen.queryByText('Value Added Tax')).not.toBeInTheDocument();
      });
    });

    it('should expand all terms when Expand All is clicked', async () => {
      renderWithI18n(<Glossary />);
      
      const expandAllButton = screen.getByRole('button', { name: /expand all/i });
      fireEvent.click(expandAllButton);

      await waitFor(() => {
        // Check for multiple expanded terms
        expect(screen.getByText('Value Added Tax')).toBeInTheDocument();
        // Balance Sheet appears multiple times (term and full name), use getAllByText
        expect(screen.getAllByText('Balance Sheet').length).toBeGreaterThan(1);
      });
    });

    it('should collapse all terms when Collapse All is clicked', async () => {
      renderWithI18n(<Glossary />);
      
      // First expand all
      const expandAllButton = screen.getByRole('button', { name: /expand all/i });
      fireEvent.click(expandAllButton);
      
      await waitFor(() => {
        expect(screen.getByText('Value Added Tax')).toBeInTheDocument();
      });
      
      // Then collapse all
      const collapseAllButton = screen.getByRole('button', { name: /collapse all/i });
      fireEvent.click(collapseAllButton);

      await waitFor(() => {
        expect(screen.queryByText('Value Added Tax')).not.toBeInTheDocument();
      });
    });
  });

  describe('Turkish language support', () => {
    it('should display Turkish title when language is Turkish', async () => {
      await i18n.changeLanguage('tr');
      renderWithI18n(<Glossary />);
      
      expect(screen.getByText('Finansal ve Vergi Terimleri Sözlüğü')).toBeInTheDocument();
    });

    it('should display Turkish translations for terms', async () => {
      await i18n.changeLanguage('tr');
      renderWithI18n(<Glossary />);
      
      // VAT should show KDV translation
      const vatItem = screen.getByRole('button', { name: /VAT.*KDV/i });
      expect(vatItem).toBeInTheDocument();
    });

    it('should show Turkish category names', async () => {
      await i18n.changeLanguage('tr');
      renderWithI18n(<Glossary />);
      
      const categorySelect = screen.getByRole('combobox', { name: /kategoriye göre filtrele/i });
      const options = within(categorySelect).getAllByRole('option');
      
      expect(options[0]).toHaveTextContent('Tüm Kategoriler');
    });

    it('should show Turkish explanation when term is expanded', async () => {
      await i18n.changeLanguage('tr');
      renderWithI18n(<Glossary />);
      
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      fireEvent.click(vatButton);

      await waitFor(() => {
        expect(screen.getByText('Katma Değer Vergisi')).toBeInTheDocument();
      });
    });
  });

  describe('bilingual details', () => {
    it('should show option to view other language', async () => {
      renderWithI18n(<Glossary />);
      
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      fireEvent.click(vatButton);

      await waitFor(() => {
        expect(screen.getByText('Türkçe')).toBeInTheDocument();
      });
    });

    it('should show English option when language is Turkish', async () => {
      await i18n.changeLanguage('tr');
      renderWithI18n(<Glossary />);
      
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      fireEvent.click(vatButton);

      await waitFor(() => {
        expect(screen.getByText('English')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-expanded on term buttons', () => {
      renderWithI18n(<Glossary />);
      
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      expect(vatButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when term is expanded', async () => {
      renderWithI18n(<Glossary />);
      
      const vatButton = screen.getByRole('button', { name: /VAT/i });
      fireEvent.click(vatButton);

      await waitFor(() => {
        expect(vatButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have proper labels on form elements', () => {
      renderWithI18n(<Glossary />);
      
      expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter/i)).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(<Glossary className="custom-class" />);
      
      const glossary = container.querySelector('.glossary');
      expect(glossary).toHaveClass('custom-class');
    });
  });

  describe('initialCategory prop', () => {
    it('should start with initial category selected', () => {
      renderWithI18n(<Glossary initialCategory="tax" />);
      
      const categorySelect = screen.getByRole('combobox', { name: /filter by category/i });
      expect(categorySelect.value).toBe('tax');
    });
  });

  describe('clear filters', () => {
    it('should clear search and category when clear filters is clicked', async () => {
      renderWithI18n(<Glossary />);
      
      const searchInput = screen.getByRole('textbox', { name: /search terms/i });
      const categorySelect = screen.getByRole('combobox', { name: /filter by category/i });
      
      fireEvent.change(searchInput, { target: { value: 'VAT' } });
      fireEvent.change(categorySelect, { target: { value: 'tax' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(searchInput.value).toBe('');
        expect(categorySelect.value).toBe('');
      });
    });
  });
});
