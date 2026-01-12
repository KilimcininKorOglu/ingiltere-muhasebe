import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * HelpIcon Component
 * 
 * A help icon (question mark) that shows detailed explanations in a popover.
 * Provides more extensive help content than basic tooltips.
 * Works on all devices with click/tap to toggle.
 * 
 * @param {Object} props - Component props
 * @param {string} props.content - The help content to display
 * @param {string} [props.title] - Optional title for the help popover
 * @param {string} [props.position='right'] - Preferred position: 'top', 'bottom', 'left', 'right'
 * @param {string} [props.size='medium'] - Icon size: 'small', 'medium', 'large'
 * @param {string} [props.className] - Additional CSS class names
 * @param {boolean} [props.inline] - Whether to display inline with text
 * @param {string} [props.id] - Unique ID for accessibility
 */
const HelpIcon = ({
  content,
  title,
  position = 'right',
  size = 'medium',
  className = '',
  inline = false,
  id,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const [popoverStyle, setPopoverStyle] = useState({});
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const helpId = id || `help-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Calculate the best position for the popover based on viewport constraints
   */
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current || !popoverRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const padding = 8;

    let finalPosition = position;
    let style = {};

    const spaceTop = buttonRect.top;
    const spaceBottom = viewportHeight - buttonRect.bottom;
    const spaceLeft = buttonRect.left;
    const spaceRight = viewportWidth - buttonRect.right;

    const positionFits = {
      top: spaceTop >= popoverRect.height + padding,
      bottom: spaceBottom >= popoverRect.height + padding,
      left: spaceLeft >= popoverRect.width + padding,
      right: spaceRight >= popoverRect.width + padding,
    };

    if (!positionFits[position]) {
      if (position === 'right' && positionFits.left) {
        finalPosition = 'left';
      } else if (position === 'left' && positionFits.right) {
        finalPosition = 'right';
      } else if (position === 'top' && positionFits.bottom) {
        finalPosition = 'bottom';
      } else if (position === 'bottom' && positionFits.top) {
        finalPosition = 'top';
      } else {
        const spaces = { top: spaceTop, bottom: spaceBottom, left: spaceLeft, right: spaceRight };
        finalPosition = Object.entries(spaces).sort(([, a], [, b]) => b - a)[0][0];
      }
    }

    const buttonCenterX = buttonRect.left + buttonRect.width / 2 + scrollX;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2 + scrollY;

    switch (finalPosition) {
      case 'top':
        style = {
          left: Math.max(padding, Math.min(buttonCenterX - popoverRect.width / 2, viewportWidth - popoverRect.width - padding + scrollX)),
          top: buttonRect.top + scrollY - popoverRect.height - 8,
        };
        break;
      case 'bottom':
        style = {
          left: Math.max(padding, Math.min(buttonCenterX - popoverRect.width / 2, viewportWidth - popoverRect.width - padding + scrollX)),
          top: buttonRect.bottom + scrollY + 8,
        };
        break;
      case 'left':
        style = {
          left: buttonRect.left + scrollX - popoverRect.width - 8,
          top: Math.max(padding, Math.min(buttonCenterY - popoverRect.height / 2, viewportHeight - popoverRect.height - padding + scrollY)),
        };
        break;
      case 'right':
        style = {
          left: buttonRect.right + scrollX + 8,
          top: Math.max(padding, Math.min(buttonCenterY - popoverRect.height / 2, viewportHeight - popoverRect.height - padding + scrollY)),
        };
        break;
      default:
        break;
    }

    setActualPosition(finalPosition);
    setPopoverStyle(style);
  }, [position]);

  /**
   * Toggle the popover visibility
   */
  const togglePopover = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  /**
   * Close the popover
   */
  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Recalculate position when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(calculatePosition);
    }
  }, [isOpen, calculatePosition]);

  // Handle window resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, calculatePosition]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        closePopover();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, closePopover]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      closePopover();
      buttonRef.current?.focus();
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      togglePopover(e);
    }
  }, [isOpen, closePopover, togglePopover]);

  if (!content) {
    return null;
  }

  const sizeClasses = {
    small: 'help-icon--small',
    medium: 'help-icon--medium',
    large: 'help-icon--large',
  };

  return (
    <div className={`help-icon-wrapper ${inline ? 'help-icon-wrapper--inline' : ''} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`help-icon ${sizeClasses[size] || sizeClasses.medium}`}
        onClick={togglePopover}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? helpId : undefined}
        aria-label={t('tooltips:helpIcon.ariaLabel', 'Click for more information')}
        title={t('tooltips:helpIcon.title', 'Help')}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="help-icon__svg"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          id={helpId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={title ? `${helpId}-title` : undefined}
          className={`help-popover help-popover--${actualPosition}`}
          style={popoverStyle}
        >
          <div className="help-popover__inner">
            {title && (
              <div className="help-popover__header">
                <h4 id={`${helpId}-title`} className="help-popover__title">
                  {title}
                </h4>
                <button
                  type="button"
                  className="help-popover__close"
                  onClick={closePopover}
                  aria-label={t('tooltips:helpIcon.close', 'Close')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            <div className="help-popover__content">
              {content}
            </div>
          </div>
          <div className={`help-popover__arrow help-popover__arrow--${actualPosition}`} />
        </div>
      )}
    </div>
  );
};

HelpIcon.propTypes = {
  content: PropTypes.string.isRequired,
  title: PropTypes.string,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  className: PropTypes.string,
  inline: PropTypes.bool,
  id: PropTypes.string,
};

export default HelpIcon;
