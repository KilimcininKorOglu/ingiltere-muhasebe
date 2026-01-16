import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import useHelp from '../../hooks/useHelp';

// Wrapper component with i18n provider
const wrapper = ({ children }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
);

describe('useHelp Hook', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should initialize with panel closed', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.isOpen).toBe(false);
    });

    it('should initialize with pageHelp tab active', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.activeTab).toBe('pageHelp');
    });

    it('should initialize with empty search query', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
    });

    it('should default to dashboard page', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.currentPage).toBe('dashboard');
    });
  });

  describe('open/close functionality', () => {
    it('should open help panel', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.openHelp();
      });
      
      expect(result.current.isOpen).toBe(true);
    });

    it('should close help panel', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.openHelp();
      });
      
      act(() => {
        result.current.closeHelp();
      });
      
      expect(result.current.isOpen).toBe(false);
    });

    it('should toggle help panel', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.toggleHelp();
      });
      
      expect(result.current.isOpen).toBe(true);
      
      act(() => {
        result.current.toggleHelp();
      });
      
      expect(result.current.isOpen).toBe(false);
    });

    it('should clear search when closing panel', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.openHelp();
        result.current.search('test query');
      });
      
      expect(result.current.searchQuery).toBe('test query');
      
      act(() => {
        result.current.closeHelp();
      });
      
      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe('tab management', () => {
    it('should change active tab', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.setActiveTab('quickTips');
      });
      
      expect(result.current.activeTab).toBe('quickTips');
    });

    it('should allow switching between all tabs', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      const tabs = ['pageHelp', 'quickTips', 'search'];
      
      tabs.forEach(tab => {
        act(() => {
          result.current.setActiveTab(tab);
        });
        
        expect(result.current.activeTab).toBe(tab);
      });
    });
  });

  describe('page help content', () => {
    it('should return page help content for dashboard', () => {
      const { result } = renderHook(() => useHelp({ currentPage: 'dashboard' }), { wrapper });
      
      expect(result.current.pageHelpContent).toBeDefined();
      expect(result.current.pageHelpContent.id).toBe('dashboard');
      expect(result.current.pageHelpContent.sections).toBeDefined();
      expect(result.current.pageHelpContent.sections.length).toBeGreaterThan(0);
    });

    it('should return page help content for invoices', () => {
      const { result } = renderHook(() => useHelp({ currentPage: 'invoices' }), { wrapper });
      
      expect(result.current.pageHelpContent).toBeDefined();
      expect(result.current.pageHelpContent.id).toBe('invoices');
    });

    it('should return null for unknown pages', () => {
      const { result } = renderHook(() => useHelp({ currentPage: 'unknownpage' }), { wrapper });
      
      expect(result.current.pageHelpContent).toBeNull();
    });
  });

  describe('quick tips', () => {
    it('should return quick tips array', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.quickTips).toBeDefined();
      expect(Array.isArray(result.current.quickTips)).toBe(true);
      expect(result.current.quickTips.length).toBeGreaterThan(0);
    });

    it('should return tips with title and content', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      result.current.quickTips.forEach(tip => {
        expect(tip.id).toBeDefined();
        expect(tip.title).toBeDefined();
        expect(tip.content).toBeDefined();
      });
    });
  });

  describe('search functionality', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.search('invoice');
      });
      
      expect(result.current.searchQuery).toBe('invoice');
    });

    it('should return search results for valid query', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.search('invoice');
      });
      
      expect(result.current.searchResults.length).toBeGreaterThan(0);
    });

    it('should return empty results for no matches', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.search('xyznonexistent123');
      });
      
      expect(result.current.searchResults).toEqual([]);
    });

    it('should clear search results for empty query', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.search('invoice');
      });
      
      expect(result.current.searchResults.length).toBeGreaterThan(0);
      
      act(() => {
        result.current.search('');
      });
      
      expect(result.current.searchResults).toEqual([]);
    });

    it('should clear search with clearSearch function', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.search('invoice');
      });
      
      act(() => {
        result.current.clearSearch();
      });
      
      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
    });

    it('should search by keywords', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.search('HMRC');
      });
      
      expect(result.current.searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('keyboard shortcuts', () => {
    it('should toggle panel on F1 key press', async () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.isOpen).toBe(false);
      
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'F1' });
        window.dispatchEvent(event);
      });
      
      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });
    });

    it('should close panel on Escape key when open', async () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      act(() => {
        result.current.openHelp();
      });
      
      expect(result.current.isOpen).toBe(true);
      
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);
      });
      
      await waitFor(() => {
        expect(result.current.isOpen).toBe(false);
      });
    });

    it('should not close panel on Escape when already closed', () => {
      const { result } = renderHook(() => useHelp(), { wrapper });
      
      expect(result.current.isOpen).toBe(false);
      
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);
      });
      
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('bilingual support', () => {
    it('should return content in Turkish when language is changed', async () => {
      const { result } = renderHook(() => useHelp({ currentPage: 'dashboard' }), { wrapper });
      
      await act(async () => {
        await i18n.changeLanguage('tr');
      });
      
      // Force re-render to get updated translations
      const { result: resultTr } = renderHook(() => useHelp({ currentPage: 'dashboard' }), { wrapper });
      
      expect(resultTr.current.pageHelpContent.title).toContain('Kontrol Paneli');
    });
  });
});
