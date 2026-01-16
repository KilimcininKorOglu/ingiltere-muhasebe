import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import ArticleList from '../../../components/learn/ArticleList';

// Mock articles for testing
const mockArticles = [
  {
    id: 'vat-explained',
    slug: 'vat-explained',
    titleKey: 'vatExplained.title',
    summaryKey: 'vatExplained.summary',
    category: 'tax',
    icon: '📊',
    readTime: 8,
  },
  {
    id: 'corporation-tax',
    slug: 'corporation-tax',
    titleKey: 'corporationTax.title',
    summaryKey: 'corporationTax.summary',
    category: 'tax',
    icon: '🏢',
    readTime: 10,
  },
  {
    id: 'expenses',
    slug: 'expenses',
    titleKey: 'expenses.title',
    summaryKey: 'expenses.summary',
    category: 'accounting',
    icon: '🧾',
    readTime: 8,
  },
  {
    id: 'tax-calendar',
    slug: 'tax-calendar',
    titleKey: 'taxCalendar.title',
    summaryKey: 'taxCalendar.summary',
    category: 'planning',
    icon: '📅',
    readTime: 6,
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

describe('ArticleList Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should render all article cards', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      const cards = screen.getAllByRole('listitem');
      expect(cards).toHaveLength(4);
    });

    it('should display article titles', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      expect(screen.getByText('Understanding VAT in the UK')).toBeInTheDocument();
      expect(screen.getByText('Corporation Tax for Limited Companies')).toBeInTheDocument();
    });

    it('should display article icons', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      expect(screen.getByText('📊')).toBeInTheDocument();
      expect(screen.getByText('🏢')).toBeInTheDocument();
      expect(screen.getByText('🧾')).toBeInTheDocument();
      expect(screen.getByText('📅')).toBeInTheDocument();
    });

    it('should display read time for each article', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      // Two articles have 8 min read time
      const eightMinReadTimes = screen.getAllByText('8 min read');
      expect(eightMinReadTimes.length).toBe(2);
      expect(screen.getByText('10 min read')).toBeInTheDocument();
      expect(screen.getByText('6 min read')).toBeInTheDocument();
    });

    it('should display article count', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      expect(screen.getByText('4 articles')).toBeInTheDocument();
    });
  });

  describe('category filtering', () => {
    it('should render category filter buttons when onCategoryChange is provided', () => {
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="all"
        />
      );
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /all topics/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /taxes/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /accounting/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /planning/i })).toBeInTheDocument();
    });

    it('should call onCategoryChange when category button is clicked', () => {
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="all"
        />
      );
      
      fireEvent.click(screen.getByRole('tab', { name: /taxes/i }));
      
      expect(onCategoryChange).toHaveBeenCalledWith('tax');
    });

    it('should filter articles by category', () => {
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="tax"
        />
      );
      
      const cards = screen.getAllByRole('listitem');
      expect(cards).toHaveLength(2); // Only tax articles
    });

    it('should show empty state when no articles match category', () => {
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={[]} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="all"
        />
      );
      
      expect(screen.getByText(/no articles found/i)).toBeInTheDocument();
    });
  });

  describe('article click', () => {
    it('should call onArticleClick when article card is clicked', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.click(firstCard);
      
      expect(onArticleClick).toHaveBeenCalledWith(mockArticles[0]);
    });

    it('should call onArticleClick when Enter key is pressed on article card', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.keyDown(firstCard, { key: 'Enter' });
      
      expect(onArticleClick).toHaveBeenCalledWith(mockArticles[0]);
    });

    it('should call onArticleClick when Space key is pressed on article card', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      const firstCard = screen.getAllByRole('listitem')[0];
      fireEvent.keyDown(firstCard, { key: ' ' });
      
      expect(onArticleClick).toHaveBeenCalledWith(mockArticles[0]);
    });
  });

  describe('accessibility', () => {
    it('should have proper tablist role for category filters', () => {
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="all"
        />
      );
      
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label');
    });

    it('should mark selected category as selected', () => {
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="tax"
        />
      );
      
      const taxTab = screen.getByRole('tab', { name: /taxes/i });
      expect(taxTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should have focusable article cards', () => {
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      const firstCard = screen.getAllByRole('listitem')[0];
      expect(firstCard).toHaveAttribute('tabindex', '0');
    });
  });

  describe('bilingual support', () => {
    it('should display Turkish translations when language is Turkish', async () => {
      await i18n.changeLanguage('tr');
      
      const onArticleClick = vi.fn();
      renderWithI18n(
        <ArticleList articles={mockArticles} onArticleClick={onArticleClick} />
      );
      
      await waitFor(() => {
        expect(screen.getByText("İngiltere'de KDV'yi Anlamak")).toBeInTheDocument();
      });
    });

    it('should display Turkish category labels', async () => {
      await i18n.changeLanguage('tr');
      
      const onArticleClick = vi.fn();
      const onCategoryChange = vi.fn();
      renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          onCategoryChange={onCategoryChange}
          selectedCategory="all"
        />
      );
      
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tüm konular/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /vergiler/i })).toBeInTheDocument();
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const onArticleClick = vi.fn();
      const { container } = renderWithI18n(
        <ArticleList 
          articles={mockArticles} 
          onArticleClick={onArticleClick}
          className="custom-class"
        />
      );
      
      const list = container.querySelector('.article-list');
      expect(list).toHaveClass('custom-class');
    });
  });
});
