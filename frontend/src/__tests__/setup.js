import '@testing-library/jest-dom';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../locales/en/translation.json';
import enGuides from '../locales/en/guides.json';
import enOnboarding from '../locales/en/onboarding.json';
import enVat from '../locales/en/vat.json';
import enHelp from '../locales/en/help.json';
import enWarnings from '../locales/en/warnings.json';
import enTooltips from '../locales/en/tooltips.json';
import enArticles from '../locales/en/articles.json';
import trTranslation from '../locales/tr/translation.json';
import trGuides from '../locales/tr/guides.json';
import trOnboarding from '../locales/tr/onboarding.json';
import trVat from '../locales/tr/vat.json';
import trHelp from '../locales/tr/help.json';
import trWarnings from '../locales/tr/warnings.json';
import trTooltips from '../locales/tr/tooltips.json';
import trArticles from '../locales/tr/articles.json';

// Initialize i18n for tests with all resources loaded synchronously
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: {
          translation: { ...enTranslation, ...enGuides, ...enOnboarding, ...enHelp, ...enWarnings, ...enTooltips, ...enArticles },
          guides: enGuides,
          onboarding: enOnboarding,
          vat: enVat,
          help: enHelp,
          warnings: enWarnings,
          tooltips: enTooltips,
          articles: enArticles,
        },
        tr: {
          translation: { ...trTranslation, ...trGuides, ...trOnboarding, ...trHelp, ...trWarnings, ...trTooltips, ...trArticles },
          guides: trGuides,
          onboarding: trOnboarding,
          vat: trVat,
          help: trHelp,
          warnings: trWarnings,
          tooltips: trTooltips,
          articles: trArticles,
        },
      },
      lng: 'en',
      fallbackLng: 'en',
      ns: ['translation', 'guides', 'onboarding', 'vat', 'help', 'warnings', 'tooltips', 'articles'],
      defaultNS: 'translation',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Clear localStorage between tests
  localStorage.clear();
  // Reset language to English after each test
  i18n.changeLanguage('en');
});

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
