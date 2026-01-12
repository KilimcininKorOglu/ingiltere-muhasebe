/**
 * ComplianceAlert Component
 * Displays compliance-related alerts for UK tax and regulatory requirements.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WARNING_SEVERITY, WARNING_CATEGORY } from '../../services/warningService';

/**
 * Compliance alert priority mapping
 */
const PRIORITY_ORDER = {
  [WARNING_SEVERITY.CRITICAL]: 0,
  [WARNING_SEVERITY.ERROR]: 1,
  [WARNING_SEVERITY.WARNING]: 2,
  [WARNING_SEVERITY.INFO]: 3,
};

/**
 * Icon components for compliance categories
 */
const CategoryIcons = {
  compliance: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
      />
    </svg>
  ),
  tax: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
      />
    </svg>
  ),
  vat: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </svg>
  ),
  deadline: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </svg>
  ),
  threshold: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
      />
    </svg>
  ),
  dataQuality: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
      />
    </svg>
  ),
  pattern: () => (
    <svg 
      className="compliance-alert__icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
      />
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
      />
    </svg>
  ),
};

/**
 * Default icon for unknown categories
 */
const DefaultIcon = () => (
  <svg 
    className="compliance-alert__icon" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    aria-hidden="true"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    />
  </svg>
);

/**
 * ComplianceAlert Component
 * 
 * Displays a compliance alert with category-specific styling and actions.
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.alert] - Alert object from warningService
 * @param {string} [props.category] - Alert category
 * @param {string} [props.severity] - Alert severity
 * @param {string} [props.messageKey] - Translation key for message
 * @param {Object} [props.messageParams] - Parameters for translation
 * @param {string} [props.message] - Direct message text
 * @param {string} [props.title] - Alert title
 * @param {string} [props.titleKey] - Translation key for title
 * @param {boolean} [props.dismissible=true] - Whether alert can be dismissed
 * @param {Function} [props.onDismiss] - Callback when dismissed
 * @param {string} [props.actionKey] - Translation key for action button
 * @param {Function} [props.onAction] - Action button click handler
 * @param {string} [props.learnMoreKey] - Translation key for learn more link
 * @param {string} [props.learnMoreUrl] - URL for learn more link
 * @param {string} [props.className] - Additional CSS class names
 */
const ComplianceAlert = ({
  alert,
  category,
  severity,
  messageKey,
  messageParams = {},
  message,
  title,
  titleKey,
  dismissible = true,
  onDismiss,
  actionKey,
  onAction,
  learnMoreKey,
  learnMoreUrl,
  className = '',
}) => {
  const { t } = useTranslation(['warnings', 'translation']);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Extract values from alert object if provided
  const effectiveCategory = alert?.category || category || WARNING_CATEGORY.COMPLIANCE;
  const effectiveSeverity = alert?.severity || severity || WARNING_SEVERITY.WARNING;
  const effectiveMessageKey = alert?.messageKey || messageKey;
  const effectiveMessageParams = alert?.params || messageParams;
  const effectiveMessage = message || (effectiveMessageKey ? t(effectiveMessageKey, effectiveMessageParams) : '');
  const effectiveTitle = title || (titleKey ? t(titleKey) : t(`warnings.categories.${effectiveCategory}`));
  const effectiveDismissible = alert?.dismissible !== undefined ? alert.dismissible : dismissible;
  const effectiveActionKey = alert?.actionKey || actionKey;
  
  /**
   * Handle dismiss action
   */
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss(alert?.id);
    }
  }, [onDismiss, alert?.id]);
  
  /**
   * Handle action button click
   */
  const handleAction = useCallback(() => {
    if (onAction) {
      onAction(alert);
    } else if (alert?.onAction) {
      alert.onAction();
    }
  }, [onAction, alert]);
  
  /**
   * Toggle expanded state
   */
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  // Reset dismissed state when alert changes
  useEffect(() => {
    setIsDismissed(false);
  }, [alert?.id, effectiveMessage]);
  
  // Don't render if dismissed or no message
  if (isDismissed || !effectiveMessage) {
    return null;
  }
  
  const Icon = CategoryIcons[effectiveCategory] || DefaultIcon;
  const isCritical = effectiveSeverity === WARNING_SEVERITY.CRITICAL;
  const ariaRole = isCritical || effectiveSeverity === WARNING_SEVERITY.ERROR ? 'alert' : 'status';
  
  return (
    <div
      className={`compliance-alert compliance-alert--${effectiveSeverity} compliance-alert--${effectiveCategory} ${className}`}
      role={ariaRole}
      aria-live={ariaRole === 'alert' ? 'assertive' : 'polite'}
    >
      <div className="compliance-alert__header">
        <div className="compliance-alert__header-content">
          <Icon />
          <div className="compliance-alert__title-area">
            <h4 className="compliance-alert__title">{effectiveTitle}</h4>
            <span className={`compliance-alert__badge compliance-alert__badge--${effectiveSeverity}`}>
              {t(`warnings.severity.${effectiveSeverity}`)}
            </span>
          </div>
        </div>
        
        <div className="compliance-alert__header-actions">
          {effectiveDismissible && (
            <button
              type="button"
              className="compliance-alert__dismiss"
              onClick={handleDismiss}
              aria-label={t('common.close')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path 
                  fillRule="evenodd" 
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className={`compliance-alert__body ${isExpanded ? 'compliance-alert__body--expanded' : ''}`}>
        <p className="compliance-alert__message">{effectiveMessage}</p>
        
        <div className="compliance-alert__actions">
          {effectiveActionKey && (
            <button
              type="button"
              className="compliance-alert__action-button"
              onClick={handleAction}
            >
              {t(effectiveActionKey)}
            </button>
          )}
          
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              className="compliance-alert__learn-more"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t(learnMoreKey || 'warnings.actions.learnMore')}
            </a>
          )}
        </div>
      </div>
      
      {alert?.details && (
        <>
          <button
            type="button"
            className="compliance-alert__expand-toggle"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
          >
            {t(isExpanded ? 'common.showLess' : 'common.showMore')}
            <svg 
              className={`compliance-alert__expand-icon ${isExpanded ? 'compliance-alert__expand-icon--rotated' : ''}`}
              viewBox="0 0 20 20" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
          
          {isExpanded && (
            <div className="compliance-alert__details">
              {alert.details}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * ComplianceAlertPanel Component
 * 
 * Displays a panel of compliance alerts organized by severity.
 * 
 * @param {Object} props - Component props
 * @param {Object[]} [props.alerts] - Array of alert objects
 * @param {Function} [props.onDismiss] - Callback when an alert is dismissed
 * @param {Function} [props.onAction] - Callback when an alert action is clicked
 * @param {boolean} [props.groupByCategory=false] - Whether to group alerts by category
 * @param {string} [props.className] - Additional CSS class names
 */
export const ComplianceAlertPanel = ({
  alerts = [],
  onDismiss,
  onAction,
  groupByCategory = false,
  className = '',
}) => {
  const { t } = useTranslation(['warnings', 'translation']);
  
  if (alerts.length === 0) {
    return null;
  }
  
  // Sort alerts by severity
  const sortedAlerts = [...alerts].sort((a, b) => 
    PRIORITY_ORDER[a.severity] - PRIORITY_ORDER[b.severity]
  );
  
  if (groupByCategory) {
    // Group alerts by category
    const groupedAlerts = sortedAlerts.reduce((acc, alert) => {
      const category = alert.category || WARNING_CATEGORY.COMPLIANCE;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(alert);
      return acc;
    }, {});
    
    return (
      <div className={`compliance-alert-panel ${className}`}>
        <h3 className="compliance-alert-panel__title">
          {t('warnings.complianceAlerts')}
        </h3>
        
        {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => (
          <div key={category} className="compliance-alert-panel__group">
            <h4 className="compliance-alert-panel__group-title">
              {t(`warnings.categories.${category}`)}
            </h4>
            
            {categoryAlerts.map(alert => (
              <ComplianceAlert
                key={alert.id}
                alert={alert}
                onDismiss={onDismiss}
                onAction={onAction}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className={`compliance-alert-panel ${className}`}>
      <h3 className="compliance-alert-panel__title">
        {t('warnings.complianceAlerts')}
        <span className="compliance-alert-panel__count">{alerts.length}</span>
      </h3>
      
      {sortedAlerts.map(alert => (
        <ComplianceAlert
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
          onAction={onAction}
        />
      ))}
    </div>
  );
};

/**
 * CSS styles for ComplianceAlert components
 */
export const ComplianceAlertStyles = `
.compliance-alert {
  border-radius: 8px;
  margin-bottom: 1rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.compliance-alert__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
}

.compliance-alert__header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.compliance-alert__icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.compliance-alert__title-area {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.compliance-alert__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.compliance-alert__badge {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.compliance-alert__header-actions {
  display: flex;
  align-items: center;
}

.compliance-alert__dismiss {
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

.compliance-alert__dismiss:hover {
  opacity: 1;
}

.compliance-alert__dismiss svg {
  width: 1rem;
  height: 1rem;
}

.compliance-alert__body {
  padding: 0 1rem 1rem;
}

.compliance-alert__message {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
}

.compliance-alert__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.compliance-alert__action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.compliance-alert__action-button:hover {
  opacity: 0.9;
}

.compliance-alert__learn-more {
  font-size: 0.75rem;
  text-decoration: underline;
  opacity: 0.8;
}

.compliance-alert__learn-more:hover {
  opacity: 1;
}

.compliance-alert__expand-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  padding: 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.compliance-alert__expand-toggle:hover {
  opacity: 1;
}

.compliance-alert__expand-icon {
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s;
}

.compliance-alert__expand-icon--rotated {
  transform: rotate(180deg);
}

.compliance-alert__details {
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  line-height: 1.5;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

/* Severity-based styling */
.compliance-alert--info {
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
}

.compliance-alert--info .compliance-alert__header {
  background-color: #dbeafe;
}

.compliance-alert--info .compliance-alert__icon,
.compliance-alert--info .compliance-alert__title {
  color: #1e40af;
}

.compliance-alert--info .compliance-alert__badge--info {
  background-color: #3b82f6;
  color: white;
}

.compliance-alert--info .compliance-alert__action-button {
  background-color: #3b82f6;
  color: white;
}

.compliance-alert--info .compliance-alert__dismiss,
.compliance-alert--info .compliance-alert__learn-more {
  color: #1e40af;
}

/* Warning severity */
.compliance-alert--warning {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
}

.compliance-alert--warning .compliance-alert__header {
  background-color: #fef3c7;
}

.compliance-alert--warning .compliance-alert__icon,
.compliance-alert--warning .compliance-alert__title {
  color: #92400e;
}

.compliance-alert--warning .compliance-alert__badge--warning {
  background-color: #f59e0b;
  color: white;
}

.compliance-alert--warning .compliance-alert__action-button {
  background-color: #f59e0b;
  color: white;
}

.compliance-alert--warning .compliance-alert__dismiss,
.compliance-alert--warning .compliance-alert__learn-more {
  color: #92400e;
}

/* Error severity */
.compliance-alert--error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
}

.compliance-alert--error .compliance-alert__header {
  background-color: #fee2e2;
}

.compliance-alert--error .compliance-alert__icon,
.compliance-alert--error .compliance-alert__title {
  color: #991b1b;
}

.compliance-alert--error .compliance-alert__badge--error {
  background-color: #dc2626;
  color: white;
}

.compliance-alert--error .compliance-alert__action-button {
  background-color: #dc2626;
  color: white;
}

.compliance-alert--error .compliance-alert__dismiss,
.compliance-alert--error .compliance-alert__learn-more {
  color: #991b1b;
}

/* Critical severity */
.compliance-alert--critical {
  background-color: #450a0a;
  border: 1px solid #7f1d1d;
  color: #fecaca;
}

.compliance-alert--critical .compliance-alert__header {
  background-color: #7f1d1d;
}

.compliance-alert--critical .compliance-alert__icon,
.compliance-alert--critical .compliance-alert__title {
  color: #fecaca;
}

.compliance-alert--critical .compliance-alert__badge--critical {
  background-color: #fecaca;
  color: #450a0a;
}

.compliance-alert--critical .compliance-alert__message {
  color: #fca5a5;
}

.compliance-alert--critical .compliance-alert__action-button {
  background-color: #fecaca;
  color: #450a0a;
}

.compliance-alert--critical .compliance-alert__dismiss,
.compliance-alert--critical .compliance-alert__learn-more {
  color: #fecaca;
}

/* Compliance Alert Panel */
.compliance-alert-panel {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 8px;
}

.compliance-alert-panel__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}

.compliance-alert-panel__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  background-color: #6b7280;
  color: white;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.compliance-alert-panel__group {
  margin-bottom: 1.5rem;
}

.compliance-alert-panel__group:last-child {
  margin-bottom: 0;
}

.compliance-alert-panel__group-title {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
`;

export default ComplianceAlert;
