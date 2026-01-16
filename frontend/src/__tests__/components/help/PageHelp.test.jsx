import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import PageHelp from '../../../components/help/PageHelp';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

// Mock content
const mockContent = {
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
    {
      id: 'transactions',
      title: 'Recent Transactions',
      content: 'This is the recent transactions content.',
    },
  ],
};

describe('PageHelp Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument();
    });

    it('should render all section titles', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
      expect(screen.getByText('Financial Metrics')).toBeInTheDocument();
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });

    it('should render no content message when content is null', () => {
      renderWithI18n(<PageHelp content={null} />);
      
      expect(screen.getByText(/no help content available/i)).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderWithI18n(<PageHelp content={mockContent} className="custom-class" />);
      
      expect(container.querySelector('.page-help')).toHaveClass('custom-class');
    });
  });

  describe('expand/collapse functionality', () => {
    it('should start with all sections collapsed', () => {
      const { container } = renderWithI18n(<PageHelp content={mockContent} />);
      
      const expandedSections = container.querySelectorAll('.page-help__section--expanded');
      expect(expandedSections).toHaveLength(0);
    });

    it('should expand section when header is clicked', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const sectionHeader = screen.getByText('Dashboard Overview').closest('button');
      fireEvent.click(sectionHeader);
      
      expect(sectionHeader).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse section when header is clicked again', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const sectionHeader = screen.getByText('Dashboard Overview').closest('button');
      
      // Expand
      fireEvent.click(sectionHeader);
      expect(sectionHeader).toHaveAttribute('aria-expanded', 'true');
      
      // Collapse
      fireEvent.click(sectionHeader);
      expect(sectionHeader).toHaveAttribute('aria-expanded', 'false');
    });

    it('should allow multiple sections to be expanded', () => {
      const { container } = renderWithI18n(<PageHelp content={mockContent} />);
      
      // Expand first section
      fireEvent.click(screen.getByText('Dashboard Overview').closest('button'));
      
      // Expand second section
      fireEvent.click(screen.getByText('Financial Metrics').closest('button'));
      
      const expandedSections = container.querySelectorAll('.page-help__section--expanded');
      expect(expandedSections).toHaveLength(2);
    });

    it('should expand section on Enter key', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const sectionHeader = screen.getByText('Dashboard Overview').closest('button');
      fireEvent.keyDown(sectionHeader, { key: 'Enter' });
      
      expect(sectionHeader).toHaveAttribute('aria-expanded', 'true');
    });

    it('should expand section on Space key', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const sectionHeader = screen.getByText('Dashboard Overview').closest('button');
      fireEvent.keyDown(sectionHeader, { key: ' ' });
      
      expect(sectionHeader).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('expand/collapse all', () => {
    it('should render expand all button when multiple sections exist', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      expect(screen.getByText(/expand all/i)).toBeInTheDocument();
    });

    it('should not render expand all button for single section', () => {
      const singleSectionContent = {
        ...mockContent,
        sections: [mockContent.sections[0]],
      };
      renderWithI18n(<PageHelp content={singleSectionContent} />);
      
      expect(screen.queryByText(/expand all/i)).not.toBeInTheDocument();
    });

    it('should expand all sections when expand all is clicked', () => {
      const { container } = renderWithI18n(<PageHelp content={mockContent} />);
      
      fireEvent.click(screen.getByText(/expand all/i));
      
      const expandedSections = container.querySelectorAll('.page-help__section--expanded');
      expect(expandedSections).toHaveLength(mockContent.sections.length);
    });

    it('should show collapse all after expanding all', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      fireEvent.click(screen.getByText(/expand all/i));
      
      expect(screen.getByText(/collapse all/i)).toBeInTheDocument();
    });

    it('should collapse all sections when collapse all is clicked', () => {
      const { container } = renderWithI18n(<PageHelp content={mockContent} />);
      
      // Expand all
      fireEvent.click(screen.getByText(/expand all/i));
      
      // Collapse all
      fireEvent.click(screen.getByText(/collapse all/i));
      
      const expandedSections = container.querySelectorAll('.page-help__section--expanded');
      expect(expandedSections).toHaveLength(0);
    });
  });

  describe('accessibility', () => {
    it('should have proper list role for sections', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should have proper listitem role for each section', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(mockContent.sections.length);
    });

    it('should have aria-expanded on section headers', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const sectionHeader = screen.getByText('Dashboard Overview').closest('button');
      expect(sectionHeader).toHaveAttribute('aria-expanded');
    });

    it('should have aria-controls linking header to content', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const sectionHeader = screen.getByText('Dashboard Overview').closest('button');
      expect(sectionHeader).toHaveAttribute('aria-controls', 'section-content-overview');
    });

    it('should have region role for section content', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      const regions = screen.getAllByRole('region', { hidden: true });
      expect(regions.length).toBe(mockContent.sections.length);
    });

    it('should have aria-hidden on collapsed section content', () => {
      const { container } = renderWithI18n(<PageHelp content={mockContent} />);
      
      const regions = container.querySelectorAll('.page-help__section-content');
      regions.forEach(region => {
        expect(region).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('content display', () => {
    it('should display section content when expanded', () => {
      renderWithI18n(<PageHelp content={mockContent} />);
      
      // Expand first section
      fireEvent.click(screen.getByText('Dashboard Overview').closest('button'));
      
      expect(screen.getByText('This is the dashboard overview content.')).toBeInTheDocument();
    });
  });
});
