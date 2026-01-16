/**
 * WarningBanner Component
 * Displays non-blocking warning banners with internationalization support.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WARNING_SEVERITY } from '../../services/warningService';

/**
 * Icon components for different severity levels
 */
const Icons = {
  info: () => (
    <svg 
      className="warning-banner__icon" 
      viewBox="0 0 20 20" 
      fill="currentColor"
      aria-hidden="true"
    >
      <path 
        fillRule="evenodd" 
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
        clipRule="evenodd" 
      />
    </svg>
  ),
  warning: () => (
    <svg 
      className="warning-banner__icon" 
      viewBox="0 0 20 20" 
      fill="currentColor"
      aria-hidden="true"
    >
      <path 
        fillRule="evenodd" 
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
        clipRule="evenodd" 
      />
    </svg>
  ),
  error: () => (
    <svg 
      className="warning-banner__icon" 
      viewBox="0 0 20 20" 
      fill="currentColor"
      aria-hidden="true"
    >
      <path 
        fillRule="evenodd" 
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
        clipRule="evenodd" 
      />
    </svg>
  ),
  critical: () => (
    <svg 
      className="warning-banner__icon" 
      viewBox="0 0 20 20" 
      fill="currentColor"
      aria-hidden="true"
    >
      <path 
        fillRule="evenodd" 
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
        clipRule="evenodd" 
      />
    </svg>
  ),
};

/**
 * Close button icon
 */
const CloseIcon = () => (
  <svg 
    className="warning-banner__close-icon" 
    viewBox="0 0 20 20" 
    fill="currentColor"
    aria-hidden="true"
  >
    <path 
      fillRule="evenodd" 
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
      clipRule="evenodd" 
    />
  </svg>
);

/**
 * WarningBanner Component
 * 
 * Displays a non-blocking warning banner with optional dismiss functionality.
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.warning] - Warning object from warningService
 * @param {string} [props.severity='warning'] - Warning severity
 * @param {string} [props.messageKey] - Translation key for message
 * @param {Object} [props.messageParams] - Parameters for translation
 * @param {string} [props.message] - Direct message text
 * @param {boolean} [props.dismissible=true] - Whether banner can be dismissed
 * @param {Function} [props.onDismiss] - Callback when dismissed
 * @param {string} [props.actionKey] - Translation key for action button
 * @param {Function} [props.onAction] - Action button click handler
 * @param {boolean} [props.showIcon=true] - Whether to show the icon
 * @param {string} [props.className] - Additional CSS class names
 * @param {number} [props.autoHideMs] - Auto-hide after milliseconds
 */
const WarningBanner = ({
  warning,
  severity,
  messageKey,
  messageParams = {},
  message,
  dismissible = true,
  onDismiss,
  actionKey,
  onAction,
  showIcon = true,
  className = '',
  autoHideMs,
}) => {
  const { t } = useTranslation(['warnings', 'translation']);
  const [isVisible, setIsVisible] = useState(true);
  
  // Extract values from warning object if provided
  const effectiveSeverity = warning?.severity || severity || WARNING_SEVERITY.WARNING;
  const effectiveMessageKey = warning?.messageKey || messageKey;
  const effectiveMessageParams = warning?.params || messageParams;
  const effectiveMessage = message || (effectiveMessageKey ? t(effectiveMessageKey, effectiveMessageParams) : '');
  const effectiveDismissible = warning?.dismissible !== undefined ? warning.dismissible : dismissible;
  const effectiveActionKey = warning?.actionKey || actionKey;
  
  /**
   * Handle dismiss action
   */
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss(warning?.id);
    }
  }, [onDismiss, warning?.id]);
  
  /**
   * Handle action button click
   */
  const handleAction = useCallback(() => {
    if (onAction) {
      onAction(warning);
    } else if (warning?.onAction) {
      warning.onAction();
    }
  }, [onAction, warning]);
  
  // Auto-hide effect
  useEffect(() => {
    if (autoHideMs && autoHideMs > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideMs);
      
      return () => clearTimeout(timer);
    }
  }, [autoHideMs, handleDismiss]);
  
  // Reset visibility when warning changes
  useEffect(() => {
    setIsVisible(true);
  }, [warning?.id, effectiveMessage]);
  
  // Don't render if not visible or no message
  if (!isVisible || !effectiveMessage) {
    return null;
  }
  
  const Icon = Icons[effectiveSeverity] || Icons.warning;
  const ariaRole = effectiveSeverity === WARNING_SEVERITY.CRITICAL || effectiveSeverity === WARNING_SEVERITY.ERROR 
    ? 'alert' 
    : 'status';
  
  return (
    <div
      className={`warning-banner warning-banner--${effectiveSeverity} ${className}`}
      role={ariaRole}
      aria-live={ariaRole === 'alert' ? 'assertive' : 'polite'}
    >
      <div className="warning-banner__content">
        {showIcon && <Icon />}
        <span className="warning-banner__message">{effectiveMessage}</span>
      </div>
      
      <div className="warning-banner__actions">
        {effectiveActionKey && (
          <button
            type="button"
            className="warning-banner__action-button"
            onClick={handleAction}
          >
            {t(effectiveActionKey)}
          </button>
        )}
        
        {effectiveDismissible && (
          <button
            type="button"
            className="warning-banner__dismiss-button"
            onClick={handleDismiss}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * WarningBannerList Component
 * 
 * Displays a list of warning banners.
 * 
 * @param {Object} props - Component props
 * @param {Object[]} [props.warnings] - Array of warning objects
 * @param {Function} [props.onDismiss] - Callback when a warning is dismissed
 * @param {Function} [props.onAction] - Callback when a warning action is clicked
 * @param {string} [props.className] - Additional CSS class names
 * @param {number} [props.maxVisible] - Maximum number of warnings to show
 */
export const WarningBannerList = ({
  warnings = [],
  onDismiss,
  onAction,
  className = '',
  maxVisible,
}) => {
  const { t } = useTranslation(['warnings', 'translation']);
  const [expandedView, setExpandedView] = useState(false);
  
  if (warnings.length === 0) {
    return null;
  }
  
  const visibleWarnings = maxVisible && !expandedView 
    ? warnings.slice(0, maxVisible) 
    : warnings;
  const hiddenCount = maxVisible ? warnings.length - maxVisible : 0;
  
  return (
    <div className={`warning-banner-list ${className}`}>
      {visibleWarnings.map(warning => (
        <WarningBanner
          key={warning.id}
          warning={warning}
          onDismiss={onDismiss}
          onAction={onAction}
        />
      ))}
      
      {hiddenCount > 0 && !expandedView && (
        <button
          type="button"
          className="warning-banner-list__expand"
          onClick={() => setExpandedView(true)}
        >
          {t('warnings.showMore', { count: hiddenCount })}
        </button>
      )}
      
      {expandedView && hiddenCount > 0 && (
        <button
          type="button"
          className="warning-banner-list__collapse"
          onClick={() => setExpandedView(false)}
        >
          {t('warnings.showLess')}
        </button>
      )}
    </div>
  );
};

/**
 * CSS styles for WarningBanner components
 */
export const WarningBannerStyles = `
.warning-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.4;
  animation: warning-banner-slide-in 0.3s ease-out;
}

@keyframes warning-banner-slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.warning-banner__content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.warning-banner__icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.warning-banner__message {
  flex: 1;
}

.warning-banner__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
}

.warning-banner__action-button {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  border: none;
}

.warning-banner__action-button:hover {
  opacity: 0.8;
}

.warning-banner__dismiss-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.warning-banner__dismiss-button:hover {
  opacity: 1;
}

.warning-banner__close-icon {
  width: 1rem;
  height: 1rem;
}

/* Info severity */
.warning-banner--info {
  background-color: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.warning-banner--info .warning-banner__icon {
  color: #3b82f6;
}

.warning-banner--info .warning-banner__action-button {
  background-color: #3b82f6;
  color: white;
}

.warning-banner--info .warning-banner__dismiss-button {
  color: #1e40af;
}

/* Warning severity */
.warning-banner--warning {
  background-color: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.warning-banner--warning .warning-banner__icon {
  color: #f59e0b;
}

.warning-banner--warning .warning-banner__action-button {
  background-color: #f59e0b;
  color: white;
}

.warning-banner--warning .warning-banner__dismiss-button {
  color: #92400e;
}

/* Error severity */
.warning-banner--error {
  background-color: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.warning-banner--error .warning-banner__icon {
  color: #dc2626;
}

.warning-banner--error .warning-banner__action-button {
  background-color: #dc2626;
  color: white;
}

.warning-banner--error .warning-banner__dismiss-button {
  color: #991b1b;
}

/* Critical severity */
.warning-banner--critical {
  background-color: #450a0a;
  color: #fecaca;
  border: 1px solid #7f1d1d;
}

.warning-banner--critical .warning-banner__icon {
  color: #fca5a5;
}

.warning-banner--critical .warning-banner__action-button {
  background-color: #fecaca;
  color: #450a0a;
}

.warning-banner--critical .warning-banner__dismiss-button {
  color: #fecaca;
}

/* Warning Banner List */
.warning-banner-list {
  display: flex;
  flex-direction: column;
}

.warning-banner-list__expand,
.warning-banner-list__collapse {
  align-self: center;
  padding: 0.5rem 1rem;
  margin-top: 0.25rem;
  background: transparent;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.warning-banner-list__expand:hover,
.warning-banner-list__collapse:hover {
  background-color: #f3f4f6;
  color: #374151;
}
`;

export default WarningBanner;
