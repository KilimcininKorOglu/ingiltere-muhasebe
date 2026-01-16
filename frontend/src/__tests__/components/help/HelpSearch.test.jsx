import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import HelpSearch from '../../../components/help/HelpSearch';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

// Default props
const getDefaultProps = (overrides = {}) => ({
  query: '',
  results: [],
  onSearch: vi.fn(),
  onClear: vi.fn(),
  onResultClick: vi.fn(),
  ...overrides,
});

describe('HelpSearch Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render search input', () => {
      const props = getDefaultProps();
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByPlaceholderText(/search help/i)).toBeInTheDocument();
    });

    it('should render search icon', () => {
      const props = getDefaultProps();
      const { container } = renderWithI18n(<HelpSearch {...props} />);
      
      expect(container.querySelector('.help-search__icon')).toBeInTheDocument();
    });

    it('should not render clear button when query is empty', () => {
      const props = getDefaultProps({ query: '' });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });

    it('should render clear button when query is not empty', () => {
      const props = getDefaultProps({ query: 'invoice' });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });
  });

  describe('search input', () => {
    it('should call onSearch when input changes', () => {
      const onSearch = vi.fn();
      const props = getDefaultProps({ onSearch });
      renderWithI18n(<HelpSearch {...props} />);
      
      const input = screen.getByPlaceholderText(/search help/i);
      fireEvent.change(input, { target: { value: 'test query' } });
      
      expect(onSearch).toHaveBeenCalledWith('test query');
    });

    it('should display current query value', () => {
      const props = getDefaultProps({ query: 'current search' });
      renderWithI18n(<HelpSearch {...props} />);
      
      const input = screen.getByPlaceholderText(/search help/i);
      expect(input.value).toBe('current search');
    });

    it('should have proper aria-label', () => {
      const props = getDefaultProps();
      renderWithI18n(<HelpSearch {...props} />);
      
      const input = screen.getByPlaceholderText(/search help/i);
      expect(input).toHaveAttribute('aria-label');
    });
  });

  describe('clear button', () => {
    it('should call onClear when clear button is clicked', () => {
      const onClear = vi.fn();
      const props = getDefaultProps({ query: 'test', onClear });
      renderWithI18n(<HelpSearch {...props} />);
      
      fireEvent.click(screen.getByRole('button', { name: /clear/i }));
      
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('search results', () => {
    it('should not render results when query is empty', () => {
      const props = getDefaultProps({ query: '' });
      const { container } = renderWithI18n(<HelpSearch {...props} />);
      
      expect(container.querySelector('.help-search__results')).not.toBeInTheDocument();
    });

    it('should render results when query is not empty and results exist', () => {
      const results = [
        {
          id: 'test-1',
          type: 'page',
          page: 'dashboard',
          title: 'Dashboard Overview',
          content: 'Test content for searching',
        },
      ];
      const props = getDefaultProps({ query: 'search', results });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    });

    it('should render results count', () => {
      const results = [
        { id: 'test-1', type: 'page', page: 'dashboard', title: 'Result 1', content: 'Content 1' },
        { id: 'test-2', type: 'page', page: 'invoices', title: 'Result 2', content: 'Content 2' },
      ];
      const props = getDefaultProps({ query: 'test', results });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
    });

    it('should render no results message when query exists but no results', () => {
      const props = getDefaultProps({ query: 'nonexistent', results: [] });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    it('should call onResultClick when result is clicked', () => {
      const onResultClick = vi.fn();
      const results = [
        { id: 'result-1', type: 'page', page: 'dashboard', title: 'Dashboard Help', content: 'Content about searching' },
      ];
      const props = getDefaultProps({ query: 'searching', results, onResultClick });
      renderWithI18n(<HelpSearch {...props} />);
      
      fireEvent.click(screen.getByText('Dashboard Help'));
      
      expect(onResultClick).toHaveBeenCalledWith(results[0]);
    });

    it('should call onResultClick on Enter key', () => {
      const onResultClick = vi.fn();
      const results = [
        { id: 'result-1', type: 'page', page: 'dashboard', title: 'Dashboard Help', content: 'Content' },
      ];
      const props = getDefaultProps({ query: 'help', results, onResultClick });
      renderWithI18n(<HelpSearch {...props} />);
      
      const resultItem = screen.getByRole('option');
      fireEvent.keyDown(resultItem, { key: 'Enter' });
      
      expect(onResultClick).toHaveBeenCalled();
    });

    it('should display result type badge', () => {
      const results = [
        { id: 'result-1', type: 'page', page: 'dashboard', title: 'Dashboard Help', content: 'Content' },
      ];
      const props = getDefaultProps({ query: 'help', results });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    it('should display tip type badge for tip results', () => {
      const results = [
        { id: 'tip-1', type: 'tip', title: 'Quick Tip', content: 'Tip content about help' },
      ];
      const props = getDefaultProps({ query: 'help', results });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByText('tip')).toBeInTheDocument();
    });
  });

  describe('highlighting', () => {
    it('should highlight matching text in title', () => {
      const results = [
        { id: 'test-1', type: 'page', page: 'dashboard', title: 'Invoice Management', content: 'Content' },
      ];
      const props = getDefaultProps({ query: 'invoice', results });
      const { container } = renderWithI18n(<HelpSearch {...props} />);
      
      expect(container.querySelector('.help-search__highlight')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper listbox role for results', () => {
      const results = [
        { id: 'test-1', type: 'page', page: 'dashboard', title: 'Test', content: 'Content' },
      ];
      const props = getDefaultProps({ query: 'test', results });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have proper option role for result items', () => {
      const results = [
        { id: 'test-1', type: 'page', page: 'dashboard', title: 'Test', content: 'Content' },
      ];
      const props = getDefaultProps({ query: 'test', results });
      renderWithI18n(<HelpSearch {...props} />);
      
      expect(screen.getByRole('option')).toBeInTheDocument();
    });
  });
});
