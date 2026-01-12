import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import QuickTips from '../../../components/help/QuickTips';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

// Mock tips
const mockTips = [
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    content: 'Press F1 at any time to open help.',
    icon: 'keyboard',
  },
  {
    id: 'language-switch',
    title: 'Switching Languages',
    content: 'Switch between English and Turkish.',
    icon: 'language',
  },
  {
    id: 'tax-deadlines',
    title: 'UK Tax Deadlines',
    content: 'Keep track of important HMRC deadlines.',
    icon: 'calendar',
  },
  {
    id: 'export-data',
    title: 'Exporting Your Data',
    content: 'Export your financial data in various formats.',
    icon: 'download',
  },
];

describe('QuickTips Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      renderWithI18n(<QuickTips tips={mockTips} />);
      
      expect(screen.getByText('Quick Tips')).toBeInTheDocument();
    });

    it('should render all tip titles', () => {
      renderWithI18n(<QuickTips tips={mockTips} />);
      
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Switching Languages')).toBeInTheDocument();
      expect(screen.getByText('UK Tax Deadlines')).toBeInTheDocument();
      expect(screen.getByText('Exporting Your Data')).toBeInTheDocument();
    });

    it('should render all tip content', () => {
      renderWithI18n(<QuickTips tips={mockTips} />);
      
      expect(screen.getByText('Press F1 at any time to open help.')).toBeInTheDocument();
      expect(screen.getByText('Switch between English and Turkish.')).toBeInTheDocument();
      expect(screen.getByText('Keep track of important HMRC deadlines.')).toBeInTheDocument();
      expect(screen.getByText('Export your financial data in various formats.')).toBeInTheDocument();
    });

    it('should return null when tips is empty', () => {
      const { container } = renderWithI18n(<QuickTips tips={[]} />);
      
      expect(container.querySelector('.quick-tips')).not.toBeInTheDocument();
    });

    it('should return null when tips is null', () => {
      const { container } = renderWithI18n(<QuickTips tips={null} />);
      
      expect(container.querySelector('.quick-tips')).not.toBeInTheDocument();
    });

    it('should return null when tips is undefined', () => {
      const { container } = renderWithI18n(<QuickTips tips={undefined} />);
      
      expect(container.querySelector('.quick-tips')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderWithI18n(<QuickTips tips={mockTips} className="custom-class" />);
      
      expect(container.querySelector('.quick-tips')).toHaveClass('custom-class');
    });
  });

  describe('icons', () => {
    it('should render icon wrappers for each tip', () => {
      const { container } = renderWithI18n(<QuickTips tips={mockTips} />);
      
      const iconWrappers = container.querySelectorAll('.quick-tips__icon-wrapper');
      expect(iconWrappers).toHaveLength(mockTips.length);
    });

    it('should render SVG icons inside wrappers', () => {
      const { container } = renderWithI18n(<QuickTips tips={mockTips} />);
      
      const icons = container.querySelectorAll('.quick-tips__icon-wrapper svg');
      expect(icons).toHaveLength(mockTips.length);
    });

    it('should render default icon for unknown icon type', () => {
      const tipsWithUnknownIcon = [
        {
          id: 'test',
          title: 'Test Tip',
          content: 'Test content',
          icon: 'unknownicon',
        },
      ];
      const { container } = renderWithI18n(<QuickTips tips={tipsWithUnknownIcon} />);
      
      const iconWrapper = container.querySelector('.quick-tips__icon-wrapper');
      expect(iconWrapper.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper list role', () => {
      renderWithI18n(<QuickTips tips={mockTips} />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should have proper listitem role for each tip', () => {
      renderWithI18n(<QuickTips tips={mockTips} />);
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(mockTips.length);
    });

    it('should have aria-hidden on icons', () => {
      const { container } = renderWithI18n(<QuickTips tips={mockTips} />);
      
      const icons = container.querySelectorAll('.quick-tips__icon-wrapper svg');
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('structure', () => {
    it('should have proper structure with title element', () => {
      renderWithI18n(<QuickTips tips={mockTips} />);
      
      const title = screen.getByText('Quick Tips');
      expect(title.tagName).toBe('H3');
    });

    it('should have proper structure for each tip item', () => {
      const { container } = renderWithI18n(<QuickTips tips={mockTips} />);
      
      const tipItems = container.querySelectorAll('.quick-tips__item');
      tipItems.forEach(item => {
        expect(item.querySelector('.quick-tips__icon-wrapper')).toBeInTheDocument();
        expect(item.querySelector('.quick-tips__content')).toBeInTheDocument();
        expect(item.querySelector('.quick-tips__item-title')).toBeInTheDocument();
        expect(item.querySelector('.quick-tips__item-text')).toBeInTheDocument();
      });
    });
  });

  describe('styling', () => {
    it('should apply correct CSS classes to elements', () => {
      const { container } = renderWithI18n(<QuickTips tips={mockTips} />);
      
      expect(container.querySelector('.quick-tips')).toBeInTheDocument();
      expect(container.querySelector('.quick-tips__title')).toBeInTheDocument();
      expect(container.querySelector('.quick-tips__list')).toBeInTheDocument();
      expect(container.querySelector('.quick-tips__item')).toBeInTheDocument();
    });
  });
});
