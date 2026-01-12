import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import HelpIcon from '../../../components/ui/HelpIcon';

// Helper to render with i18n provider
const renderWithI18n = (component) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  );
};

describe('HelpIcon Component', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('rendering', () => {
    it('should render help icon button', () => {
      renderWithI18n(<HelpIcon content="Help content" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('help-icon');
    });

    it('should not render when content is empty', () => {
      const { container } = renderWithI18n(<HelpIcon content="" />);
      expect(container).toBeEmptyDOMElement();
    });

    it('should have proper aria-label', () => {
      renderWithI18n(<HelpIcon content="Help content" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Click for more information');
    });

    it('should have title attribute', () => {
      renderWithI18n(<HelpIcon content="Help content" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Help');
    });
  });

  describe('size variants', () => {
    it('should apply small size class', () => {
      renderWithI18n(<HelpIcon content="Content" size="small" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('help-icon--small');
    });

    it('should apply medium size class by default', () => {
      renderWithI18n(<HelpIcon content="Content" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('help-icon--medium');
    });

    it('should apply large size class', () => {
      renderWithI18n(<HelpIcon content="Content" size="large" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('help-icon--large');
    });
  });

  describe('popover behavior', () => {
    it('should show popover on click', async () => {
      renderWithI18n(<HelpIcon content="Popover content" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Popover content')).toBeInTheDocument();
      });
    });

    it('should toggle popover on multiple clicks', async () => {
      renderWithI18n(<HelpIcon content="Toggle content" />);

      const button = screen.getByRole('button');

      // First click shows
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Second click hides
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should display title in popover header when provided', async () => {
      renderWithI18n(<HelpIcon content="Content" title="Help Title" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Help Title')).toBeInTheDocument();
      });
    });

    it('should show close button when title is provided', async () => {
      renderWithI18n(<HelpIcon content="Content" title="Title" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close');
        expect(closeButton).toBeInTheDocument();
      });
    });

    it('should close popover when close button is clicked', async () => {
      renderWithI18n(<HelpIcon content="Content" title="Title" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard behavior', () => {
    it('should open popover on Enter key', async () => {
      renderWithI18n(<HelpIcon content="Keyboard content" />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should open popover on Space key', async () => {
      renderWithI18n(<HelpIcon content="Keyboard content" />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should close popover on Escape key', async () => {
      renderWithI18n(<HelpIcon content="Escape content" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(button, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('position prop', () => {
    it('should apply right position class by default', async () => {
      renderWithI18n(<HelpIcon content="Position test" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const popover = screen.getByRole('dialog');
        expect(popover).toHaveClass('help-popover--right');
      });
    });

    it('should apply top position class', async () => {
      renderWithI18n(<HelpIcon content="Top position" position="top" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const popover = screen.getByRole('dialog');
        expect(popover).toHaveClass('help-popover--top');
      });
    });

    it('should apply bottom position class', async () => {
      renderWithI18n(<HelpIcon content="Bottom position" position="bottom" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const popover = screen.getByRole('dialog');
        expect(popover).toHaveClass('help-popover--bottom');
      });
    });

    it('should apply left position class', async () => {
      renderWithI18n(<HelpIcon content="Left position" position="left" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const popover = screen.getByRole('dialog');
        expect(popover).toHaveClass('help-popover--left');
      });
    });
  });

  describe('inline prop', () => {
    it('should apply inline class when inline is true', () => {
      renderWithI18n(<HelpIcon content="Inline content" inline />);

      const wrapper = screen.getByRole('button').parentElement;
      expect(wrapper).toHaveClass('help-icon-wrapper--inline');
    });

    it('should not apply inline class when inline is false', () => {
      renderWithI18n(<HelpIcon content="Not inline" inline={false} />);

      const wrapper = screen.getByRole('button').parentElement;
      expect(wrapper).not.toHaveClass('help-icon-wrapper--inline');
    });
  });

  describe('accessibility', () => {
    it('should have aria-expanded attribute', async () => {
      renderWithI18n(<HelpIcon content="Accessibility test" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should associate button with popover via aria-describedby', async () => {
      renderWithI18n(<HelpIcon content="Associated content" id="my-help" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const popover = screen.getByRole('dialog');
        expect(popover).toHaveAttribute('id', 'my-help');
        expect(button).toHaveAttribute('aria-describedby', 'my-help');
      });
    });

    it('should have proper dialog role on popover', async () => {
      renderWithI18n(<HelpIcon content="Dialog content" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'false');
      });
    });

    it('should have labelledby for title when provided', async () => {
      renderWithI18n(<HelpIcon content="Content" title="My Title" id="titled-help" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby', 'titled-help-title');
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      renderWithI18n(<HelpIcon content="Custom class" className="custom-help" />);

      const wrapper = screen.getByRole('button').parentElement;
      expect(wrapper).toHaveClass('custom-help');
    });
  });

  describe('click outside behavior', () => {
    it('should close popover when clicking outside', async () => {
      renderWithI18n(
        <div>
          <HelpIcon content="Click outside test" />
          <button>Outside button</button>
        </div>
      );

      const helpButton = screen.getAllByRole('button')[0];
      fireEvent.click(helpButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const outsideButton = screen.getByText('Outside button');
      fireEvent.mouseDown(outsideButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
