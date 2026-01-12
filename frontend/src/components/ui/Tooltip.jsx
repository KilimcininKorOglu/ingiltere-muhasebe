import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Tooltip Component
 * 
 * A responsive tooltip component that provides contextual help information.
 * Works on all devices with hover on desktop and touch/tap on mobile.
 * Uses intelligent positioning to avoid obstructing the UI.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The trigger element to wrap
 * @param {string} props.content - The tooltip text content
 * @param {string} [props.position='top'] - Preferred position: 'top', 'bottom', 'left', 'right'
 * @param {number} [props.delay=300] - Delay before showing tooltip (ms)
 * @param {string} [props.className] - Additional CSS class names
 * @param {boolean} [props.disabled] - Whether the tooltip is disabled
 * @param {string} [props.id] - Unique ID for accessibility
 */
const Tooltip = ({
  children,
  content,
  position = 'top',
  delay = 300,
  className = '',
  disabled = false,
  id,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);
  const tooltipId = id || `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Calculate the best position for the tooltip based on viewport constraints
   */
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const padding = 8; // Minimum distance from viewport edge

    let finalPosition = position;
    let style = {};

    // Check if preferred position fits, otherwise find alternative
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    // Determine if preferred position has enough space
    const positionFits = {
      top: spaceTop >= tooltipRect.height + padding,
      bottom: spaceBottom >= tooltipRect.height + padding,
      left: spaceLeft >= tooltipRect.width + padding,
      right: spaceRight >= tooltipRect.width + padding,
    };

    // If preferred position doesn't fit, find an alternative
    if (!positionFits[position]) {
      if (position === 'top' && positionFits.bottom) {
        finalPosition = 'bottom';
      } else if (position === 'bottom' && positionFits.top) {
        finalPosition = 'top';
      } else if (position === 'left' && positionFits.right) {
        finalPosition = 'right';
      } else if (position === 'right' && positionFits.left) {
        finalPosition = 'left';
      } else {
        // Default to the position with most space
        const spaces = { top: spaceTop, bottom: spaceBottom, left: spaceLeft, right: spaceRight };
        finalPosition = Object.entries(spaces).sort(([, a], [, b]) => b - a)[0][0];
      }
    }

    // Calculate position coordinates
    const triggerCenterX = triggerRect.left + triggerRect.width / 2 + scrollX;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2 + scrollY;

    switch (finalPosition) {
      case 'top':
        style = {
          left: Math.max(padding, Math.min(triggerCenterX - tooltipRect.width / 2, viewportWidth - tooltipRect.width - padding + scrollX)),
          top: triggerRect.top + scrollY - tooltipRect.height - 8,
        };
        break;
      case 'bottom':
        style = {
          left: Math.max(padding, Math.min(triggerCenterX - tooltipRect.width / 2, viewportWidth - tooltipRect.width - padding + scrollX)),
          top: triggerRect.bottom + scrollY + 8,
        };
        break;
      case 'left':
        style = {
          left: triggerRect.left + scrollX - tooltipRect.width - 8,
          top: Math.max(padding, Math.min(triggerCenterY - tooltipRect.height / 2, viewportHeight - tooltipRect.height - padding + scrollY)),
        };
        break;
      case 'right':
        style = {
          left: triggerRect.right + scrollX + 8,
          top: Math.max(padding, Math.min(triggerCenterY - tooltipRect.height / 2, viewportHeight - tooltipRect.height - padding + scrollY)),
        };
        break;
      default:
        break;
    }

    setActualPosition(finalPosition);
    setTooltipStyle(style);
  }, [position]);

  /**
   * Show the tooltip after delay
   */
  const showTooltip = useCallback(() => {
    if (disabled || !content) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled, content]);

  /**
   * Hide the tooltip and clear timeout
   */
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  /**
   * Toggle tooltip visibility (for touch devices)
   */
  const toggleTooltip = useCallback((e) => {
    if (disabled || !content) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (isVisible) {
      hideTooltip();
    } else {
      setIsVisible(true);
    }
  }, [disabled, content, isVisible, hideTooltip]);

  // Recalculate position when visible
  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(calculatePosition);
    }
  }, [isVisible, calculatePosition]);

  // Handle window resize and scroll
  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible, calculatePosition]);

  // Close tooltip when clicking outside (for mobile)
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e) => {
      if (
        triggerRef.current && 
        !triggerRef.current.contains(e.target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target)
      ) {
        hideTooltip();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible, hideTooltip]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isVisible) {
      hideTooltip();
      e.preventDefault();
    }
  }, [isVisible, hideTooltip]);

  if (!content) {
    return children;
  }

  return (
    <div className={`tooltip-wrapper ${className}`}>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onTouchStart={toggleTooltip}
        onKeyDown={handleKeyDown}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={`tooltip tooltip--${actualPosition}`}
          style={tooltipStyle}
          aria-hidden={!isVisible}
        >
          <div className="tooltip__content">
            {content}
          </div>
          <div className={`tooltip__arrow tooltip__arrow--${actualPosition}`} />
        </div>
      )}
    </div>
  );
};

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.string,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  delay: PropTypes.number,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  id: PropTypes.string,
};

export default Tooltip;
