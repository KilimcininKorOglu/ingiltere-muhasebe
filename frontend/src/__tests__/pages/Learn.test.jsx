import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import Learn from '../../pages/Learn';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

// Mock window.scrollTo
const mockScrollTo = vi.fn();
Object.defineProperty(window, 'scrollTo', {
  value: mockScrollTo,
  writable: true,
});

describe('Learn Page', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    mockScrollTo.mockClear();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      renderWithI18n(<Learn />);
      
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should render page title', () => {
      renderWithI18n(<Learn />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Learn About UK Taxes');
    });

    it('should render page description', () => {
      renderWithI18n(<Learn />);
      
      expect(screen.getByText(/Comprehensive guides to help you understand/i)).toBeInTheDocument();
    });

    it('should render welcome message', () => {
      renderWithI18n(<Learn />);
      
      expect(screen.getByText(/New to UK taxes/i)).toBeInTheDocument();
    });

    it('should render article list by default', () => {
      renderWithI18n(<Learn />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should render all 6 articles', () => {
      renderWithI18n(<Learn />);
      
      const cards = screen.getAllByRole('listitem');
      expect(cards).toHaveLength(6);
    });
  });

  describe('article navigation', () => {
    it('should show article detail when article card is clicked', async () => {
      renderWithI18n(<Learn />);
      
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.click(firstCard);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to articles/i })).toBeInTheDocument();
      });
    });

    it('should scroll to top when article is opened', async () => {
      renderWithI18n(<Learn />);
      
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.click(firstCard);
      
      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      });
    });

    it('should return to article list when back button is clicked', async () => {
      renderWithI18n(<Learn />);
      
      // Click on an article
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.click(firstCard);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to articles/i })).toBeInTheDocument();
      });
      
      // Click back button
      fireEvent.click(screen.getByRole('button', { name: /back to articles/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Learn About UK Taxes');
      });
    });

    it('should hide page header when viewing article', async () => {
      renderWithI18n(<Learn />);
      
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.click(firstCard);
      
      await waitFor(() => {
        expect(screen.queryByText(/Comprehensive guides to help you understand/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('category filtering', () => {
    it('should render category filter buttons', () => {
      renderWithI18n(<Learn />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should filter articles when category is selected', async () => {
      renderWithI18n(<Learn />);
      
      const taxTab = screen.getByRole('tab', { name: /taxes/i });
      fireEvent.click(taxTab);
      
      await waitFor(() => {
        const cards = screen.getAllByRole('listitem');
        expect(cards.length).toBeLessThan(6); // Should be filtered
      });
    });

    it('should show all articles when All Topics is selected', async () => {
      renderWithI18n(<Learn />);
      
      // First filter by tax
      const taxTab = screen.getByRole('tab', { name: /taxes/i });
      fireEvent.click(taxTab);
      
      // Then select all
      const allTab = screen.getByRole('tab', { name: /all topics/i });
      fireEvent.click(allTab);
      
      await waitFor(() => {
        const cards = screen.getAllByRole('listitem');
        expect(cards).toHaveLength(6);
      });
    });
  });

  describe('defaultArticle prop', () => {
    it('should show specified article when defaultArticle is provided', () => {
      renderWithI18n(<Learn defaultArticle="vat-explained" />);
      
      expect(screen.getByRole('button', { name: /back to articles/i })).toBeInTheDocument();
    });
  });

  describe('bilingual support', () => {
    it('should display Turkish page title when language is Turkish', async () => {
      await i18n.changeLanguage('tr');
      
      renderWithI18n(<Learn />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('İngiltere Vergileri Hakkında Bilgi Edinin');
      });
    });

    it('should display Turkish article titles', async () => {
      await i18n.changeLanguage('tr');
      
      renderWithI18n(<Learn />);
      
      await waitFor(() => {
        expect(screen.getByText("İngiltere'de KDV'yi Anlamak")).toBeInTheDocument();
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = renderWithI18n(<Learn className="custom-class" />);
      
      const page = container.querySelector('.learn-page');
      expect(page).toHaveClass('custom-class');
    });
  });

  describe('related articles', () => {
    it('should navigate to related article when clicked', async () => {
      renderWithI18n(<Learn />);
      
      // Click on VAT article
      const vatCard = screen.getByText('Understanding VAT in the UK').closest('[role="listitem"]');
      fireEvent.click(vatCard);
      
      await waitFor(() => {
        expect(screen.getByText('Related Articles')).toBeInTheDocument();
      });
      
      // Click on related article
      const relatedButtons = document.querySelectorAll('.article__related-card');
      if (relatedButtons.length > 0) {
        fireEvent.click(relatedButtons[0]);
        
        await waitFor(() => {
          // Should navigate to the related article
          expect(mockScrollTo).toHaveBeenCalledTimes(2);
        });
      }
    });
  });
});
