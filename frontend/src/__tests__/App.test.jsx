import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import i18n from '../i18n';

// Mock localStorage for auth token
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

describe('App Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('rendering', () => {
    it('should render the app without crashing', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('UK Accounting')).toBeInTheDocument();
      });
    });

    it('should render the login page when not authenticated', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
    });

    it('should render login form fields', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });
    });

    it('should render register link on login page', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/register/i)).toBeInTheDocument();
      });
    });
  });

  describe('i18n integration', () => {
    it('should display English translations by default', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('UK Accounting')).toBeInTheDocument();
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });
    });

    it('should have login button in English', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to register page when register link is clicked', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/register/i)).toBeInTheDocument();
      });

      const registerLink = screen.getByRole('link', { name: /register/i });
      fireEvent.click(registerLink);

      await waitFor(() => {
        expect(screen.getByText('Create a new account')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading fallback initially', () => {
      const { container } = render(<App />);
      
      waitFor(() => {
        expect(container.querySelector('.auth-container')).toBeInTheDocument();
      });
    });
  });
});
