import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Tooltip from '../../../components/ui/Tooltip';

describe('Tooltip Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render children correctly', () => {
      render(
        <Tooltip content="Test tooltip">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
    });

    it('should not render tooltip content initially', () => {
      render(
        <Tooltip content="Test tooltip content">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should return children directly when no content provided', () => {
      render(
        <Tooltip content="">
          <button>Just a button</button>
        </Tooltip>
      );

      expect(screen.getByRole('button', { name: 'Just a button' })).toBeInTheDocument();
    });
  });

  describe('hover behavior', () => {
    it('should show tooltip on mouse enter after delay', async () => {
      render(
        <Tooltip content="Test tooltip content" delay={0}>
          <button>Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Hover me' });
      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <Tooltip content="Test tooltip content" delay={0}>
          <button>Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Hover me' });
      
      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('focus behavior', () => {
    it('should show tooltip on focus', async () => {
      render(
        <Tooltip content="Focus tooltip" delay={0}>
          <button>Focus me</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Focus me' });
      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on blur', async () => {
      render(
        <Tooltip content="Focus tooltip" delay={0}>
          <button>Focus me</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Focus me' });
      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      fireEvent.blur(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard behavior', () => {
    it('should close tooltip on Escape key', async () => {
      render(
        <Tooltip content="Escape tooltip" delay={0}>
          <button>Press Escape</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Press Escape' });
      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      fireEvent.keyDown(trigger, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('disabled state', () => {
    it('should not show tooltip when disabled', async () => {
      render(
        <Tooltip content="Disabled tooltip" disabled delay={0}>
          <button>Disabled tooltip</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Disabled tooltip' });
      fireEvent.mouseEnter(trigger);

      // Give it some time to ensure it doesn't appear
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('position prop', () => {
    it('should apply correct position class for top', async () => {
      render(
        <Tooltip content="Top tooltip" position="top" delay={0}>
          <button>Top</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('tooltip--top');
      });
    });

    it('should apply correct position class for bottom', async () => {
      render(
        <Tooltip content="Bottom tooltip" position="bottom" delay={0}>
          <button>Bottom</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('tooltip--bottom');
      });
    });

    it('should apply correct position class for left', async () => {
      render(
        <Tooltip content="Left tooltip" position="left" delay={0}>
          <button>Left</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('tooltip--left');
      });
    });

    it('should apply correct position class for right', async () => {
      render(
        <Tooltip content="Right tooltip" position="right" delay={0}>
          <button>Right</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('tooltip--right');
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-describedby when visible', async () => {
      render(
        <Tooltip content="Accessible tooltip" id="test-tooltip" delay={0}>
          <button>Accessible</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Accessible' });
      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('id', 'test-tooltip');
        // Check the trigger is associated with tooltip
        const triggerWrapper = trigger.parentElement;
        expect(triggerWrapper).toHaveAttribute('aria-describedby', 'test-tooltip');
      });
    });

    it('should generate unique id if not provided', async () => {
      render(
        <Tooltip content="Auto id tooltip" delay={0}>
          <button>Auto ID</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('id');
        expect(tooltip.id).toMatch(/^tooltip-/);
      });
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      render(
        <Tooltip content="Custom class" className="my-custom-class">
          <button>Custom</button>
        </Tooltip>
      );

      const wrapper = screen.getByRole('button').closest('.tooltip-wrapper');
      expect(wrapper).toHaveClass('my-custom-class');
    });
  });

  describe('touch behavior', () => {
    it('should toggle tooltip on touch', async () => {
      render(
        <Tooltip content="Touch tooltip" delay={0}>
          <button>Touch me</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Touch me' });
      
      // First touch should show
      fireEvent.touchStart(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      // Second touch should hide
      fireEvent.touchStart(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });
});
