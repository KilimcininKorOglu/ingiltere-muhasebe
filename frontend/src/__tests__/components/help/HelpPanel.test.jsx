import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import HelpPanel from '../../../components/help/HelpPanel';

// Mock page help content
const mockPageHelpContent = {
  id: 'dashboard',
  title: 'Dashboard Help',
  sections: [
    {
      id: 'overview',
      title: 'Dashboard Overview',
      content: 'This is the dashboard overview content.',
    },
    {
      id: 'metrics',
      title: 'Financial Metrics',
      content: 'This is the financial metrics content.',
    },
  ],
};

// Mock quick tips
const mockQuickTips = [
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    content: 'Press F1 to open help.',
    icon: 'keyboard',
  },
  {
    id: 'language-switch',
    title: 'Switching Languages',
    content: 'Switch between English and Turkish.',
    icon: 'language',
  },
];

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

// Default props for HelpPanel
const getDefaultProps = (overrides = {}) => ({
  isOpen: false,
  onClose: vi.fn(),
  activeTab: 'pageHelp',
  onTabChange: vi.fn(),
  searchQuery: '',
  searchResults: [],
  onSearch: vi.fn(),
  onClearSearch: vi.fn(),
  pageHelpContent: mockPageHelpContent,
  quickTips: mockQuickTips,
  ...overrides,
});

describe('HelpPanel Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const props = getDefaultProps();
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
    });

    it('should be hidden when isOpen is false', () => {
      const props = getDefaultProps({ isOpen: false });
      renderWithI18n(<HelpPanel {...props} />);
      
      const panel = screen.getByRole('dialog', { hidden: true });
      expect(panel).toHaveAttribute('aria-hidden', 'true');
      expect(panel).not.toHaveClass('help-panel--open');
    });

    it('should be visible when isOpen is true', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      const panel = screen.getByRole('dialog');
      expect(panel).toHaveAttribute('aria-hidden', 'false');
      expect(panel).toHaveClass('help-panel--open');
    });

    it('should render title', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('should render close button', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('should render all three tabs', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByRole('tab', { name: /this page/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /quick tips/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /search/i })).toBeInTheDocument();
    });

    it('should highlight active tab', () => {
      const props = getDefaultProps({ isOpen: true, activeTab: 'pageHelp' });
      renderWithI18n(<HelpPanel {...props} />);
      
      const activeTab = screen.getByRole('tab', { name: /this page/i });
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
      expect(activeTab).toHaveClass('help-panel__tab--active');
    });

    it('should call onTabChange when tab is clicked', () => {
      const onTabChange = vi.fn();
      const props = getDefaultProps({ isOpen: true, onTabChange });
      renderWithI18n(<HelpPanel {...props} />);
      
      fireEvent.click(screen.getByRole('tab', { name: /quick tips/i }));
      
      expect(onTabChange).toHaveBeenCalledWith('quickTips');
    });
  });

  describe('close functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const props = getDefaultProps({ isOpen: true, onClose });
      renderWithI18n(<HelpPanel {...props} />);
      
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when overlay is clicked', () => {
      const onClose = vi.fn();
      const props = getDefaultProps({ isOpen: true, onClose });
      const { container } = renderWithI18n(<HelpPanel {...props} />);
      
      const overlay = container.querySelector('.help-panel__overlay');
      fireEvent.click(overlay);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('page help tab content', () => {
    it('should display page help content when pageHelp tab is active', () => {
      const props = getDefaultProps({ isOpen: true, activeTab: 'pageHelp' });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      expect(screen.getByText('Financial Metrics')).toBeInTheDocument();
    });
  });

  describe('quick tips tab content', () => {
    it('should display quick tips when quickTips tab is active', () => {
      const props = getDefaultProps({ isOpen: true, activeTab: 'quickTips' });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Switching Languages')).toBeInTheDocument();
    });
  });

  describe('search tab content', () => {
    it('should display search input when search tab is active', () => {
      const props = getDefaultProps({ isOpen: true, activeTab: 'search' });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByPlaceholderText(/search help/i)).toBeInTheDocument();
    });

    it('should call onSearch when searching', () => {
      const onSearch = vi.fn();
      const props = getDefaultProps({ isOpen: true, activeTab: 'search', onSearch });
      renderWithI18n(<HelpPanel {...props} />);
      
      const input = screen.getByPlaceholderText(/search help/i);
      fireEvent.change(input, { target: { value: 'invoice' } });
      
      expect(onSearch).toHaveBeenCalledWith('invoice');
    });

    it('should display search results', () => {
      const searchResults = [
        {
          id: 'invoices-creating',
          type: 'page',
          page: 'invoices',
          title: 'Creating Invoices',
          content: 'Learn how to create bills.',
        },
      ];
      const props = getDefaultProps({
        isOpen: true,
        activeTab: 'search',
        searchQuery: 'bills',
        searchResults,
      });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByText('Creating Invoices')).toBeInTheDocument();
    });

    it('should display no results message when no matches', () => {
      const props = getDefaultProps({
        isOpen: true,
        activeTab: 'search',
        searchQuery: 'xyznonexistent',
        searchResults: [],
      });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('should display keyboard shortcut hint', () => {
      const props = getDefaultProps({ isOpen: true, activeTab: 'search' });
      renderWithI18n(<HelpPanel {...props} />);
      
      expect(screen.getByText('Press F1 to open help')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria attributes on dialog', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Help');
    });

    it('should have proper tab roles', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('should have proper tabpanel roles', () => {
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      const tabpanels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(tabpanels.length).toBeGreaterThan(0);
    });
  });

  describe('bilingual support', () => {
    it('should display Turkish translations when language is Turkish', async () => {
      await i18n.changeLanguage('tr');
      
      const props = getDefaultProps({ isOpen: true });
      renderWithI18n(<HelpPanel {...props} />);
      
      await waitFor(() => {
        expect(screen.getByText('Yardım')).toBeInTheDocument();
      });
    });
  });
});
