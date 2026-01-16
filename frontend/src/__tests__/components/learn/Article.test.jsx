import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import Article from '../../../components/learn/Article';

// Mock article data for testing
const mockArticle = {
  id: 'vat-explained',
  slug: 'vat-explained',
  category: 'tax',
  icon: '📊',
  readTime: 8,
  lastUpdated: '2025-01-01',
  titleKey: 'vatExplained.title',
  summaryKey: 'vatExplained.summary',
  sections: [
    { id: 'intro', type: 'intro' },
    { id: 'what-is-vat', type: 'content' },
    { id: 'vat-rates', type: 'content', hasTable: true },
    { id: 'threshold', type: 'highlight' },
    { id: 'quarterly-example', type: 'example' },
    { id: 'common-mistakes', type: 'list' },
    { id: 'summary', type: 'summary' },
  ],
  externalLinks: [
    {
      titleKey: 'vatExplained.links.hmrcVat',
      url: 'https://www.gov.uk/vat-registration',
    },
    {
      titleKey: 'vatExplained.links.vatRates',
      url: 'https://www.gov.uk/vat-rates',
    },
  ],
  relatedArticles: ['corporation-tax', 'expenses'],
};

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('Article Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should render article title', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Understanding VAT in the UK');
    });

    it('should render article icon', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText('📊')).toBeInTheDocument();
    });

    it('should render article category', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText('Taxes')).toBeInTheDocument();
    });

    it('should render read time', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText('8 min read')).toBeInTheDocument();
    });

    it('should render back button', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByRole('button', { name: /back to articles/i })).toBeInTheDocument();
    });

    it('should render article summary', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText(/Learn how Value Added Tax works/i)).toBeInTheDocument();
    });
  });

  describe('sections', () => {
    it('should render intro section', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      // Intro section should have intro content
      const introSection = document.querySelector('.article__intro');
      expect(introSection).toBeInTheDocument();
    });

    it('should render highlight sections', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      const highlightSection = document.querySelector('.article__highlight');
      expect(highlightSection).toBeInTheDocument();
    });

    it('should render example sections', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      const exampleSection = document.querySelector('.article__example');
      expect(exampleSection).toBeInTheDocument();
    });

    it('should render summary section', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });
  });

  describe('external links', () => {
    it('should render external links section', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText('Useful Links')).toBeInTheDocument();
    });

    it('should render external link buttons', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      const links = screen.getAllByRole('link');
      const externalLinks = links.filter(link => 
        link.getAttribute('target') === '_blank'
      );
      expect(externalLinks.length).toBeGreaterThan(0);
    });

    it('should have proper external link attributes', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      const links = screen.getAllByRole('link');
      const externalLink = links.find(link => 
        link.getAttribute('target') === '_blank'
      );
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('related articles', () => {
    it('should render related articles section when onRelatedClick is provided', () => {
      const onBack = vi.fn();
      const onRelatedClick = vi.fn();
      renderWithI18n(
        <Article 
          article={mockArticle} 
          onBack={onBack} 
          onRelatedClick={onRelatedClick}
        />
      );
      
      expect(screen.getByText('Related Articles')).toBeInTheDocument();
    });

    it('should call onRelatedClick when related article is clicked', () => {
      const onBack = vi.fn();
      const onRelatedClick = vi.fn();
      renderWithI18n(
        <Article 
          article={mockArticle} 
          onBack={onBack} 
          onRelatedClick={onRelatedClick}
        />
      );
      
      const relatedButtons = document.querySelectorAll('.article__related-card');
      fireEvent.click(relatedButtons[0]);
      
      expect(onRelatedClick).toHaveBeenCalledWith('corporation-tax');
    });
  });

  describe('back button', () => {
    it('should call onBack when back button is clicked', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      fireEvent.click(screen.getByRole('button', { name: /back to articles/i }));
      
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('footer', () => {
    it('should render disclaimer', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText(/informational purposes only/i)).toBeInTheDocument();
    });

    it('should render last updated date', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      expect(screen.getByText(/Last updated: 2025-01-01/i)).toBeInTheDocument();
    });
  });

  describe('null article handling', () => {
    it('should show not found message when article is null', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={null} onBack={onBack} />);
      
      expect(screen.getByText('Article not found.')).toBeInTheDocument();
    });

    it('should show back button when article is null', () => {
      const onBack = vi.fn();
      renderWithI18n(<Article article={null} onBack={onBack} />);
      
      expect(screen.getByRole('button', { name: /back to articles/i })).toBeInTheDocument();
    });
  });

  describe('bilingual support', () => {
    it('should display Turkish translations when language is Turkish', async () => {
      await i18n.changeLanguage('tr');
      
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("İngiltere'de KDV'yi Anlamak");
      });
    });

    it('should display Turkish category label', async () => {
      await i18n.changeLanguage('tr');
      
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Vergiler')).toBeInTheDocument();
      });
    });

    it('should display Turkish UI labels', async () => {
      await i18n.changeLanguage('tr');
      
      const onBack = vi.fn();
      renderWithI18n(<Article article={mockArticle} onBack={onBack} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /makalelere dön/i })).toBeInTheDocument();
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const onBack = vi.fn();
      renderWithI18n(
        <Article 
          article={mockArticle} 
          onBack={onBack}
          className="custom-class"
        />
      );
      
      const article = screen.getByRole('article');
      expect(article).toHaveClass('custom-class');
    });
  });
});
