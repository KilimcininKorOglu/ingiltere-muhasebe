/**
 * ValidationMessage Component
 * Displays real-time validation messages with internationalization support.
 */

import { useTranslation } from 'react-i18next';

/**
 * Validation message types
 */
// eslint-disable-next-line react-refresh/only-export-components
export const MESSAGE_TYPE = {
  ERROR: 'error',
  WARNING: 'warning',
  SUCCESS: 'success',
  INFO: 'info',
};

/**
 * Icon components for different message types
 */
const Icons = {
  error: () => (
    <svg 
      className="validation-message__icon" 
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
  warning: () => (
    <svg 
      className="validation-message__icon" 
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
  success: () => (
    <svg 
      className="validation-message__icon" 
      viewBox="0 0 20 20" 
      fill="currentColor"
      aria-hidden="true"
    >
      <path 
        fillRule="evenodd" 
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
        clipRule="evenodd" 
      />
    </svg>
  ),
  info: () => (
    <svg 
      className="validation-message__icon" 
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
};

/**
 * ValidationMessage Component
 * 
 * Displays a validation message with an icon and translated text.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.type='error'] - Message type (error, warning, success, info)
 * @param {string} [props.message] - Direct message text
 * @param {string} [props.messageKey] - Translation key for the message
 * @param {Object} [props.messageParams] - Parameters for translation interpolation
 * @param {string[]} [props.messages] - Array of message texts
 * @param {Object[]} [props.errors] - Array of error objects with errorKey and params
 * @param {boolean} [props.showIcon=true] - Whether to show the icon
 * @param {string} [props.className] - Additional CSS class names
 * @param {string} [props.id] - ID for aria-describedby reference
 * @param {string} [props.role] - ARIA role (defaults based on type)
 */
const ValidationMessage = ({
  type = MESSAGE_TYPE.ERROR,
  message,
  messageKey,
  messageParams = {},
  messages = [],
  errors = [],
  showIcon = true,
  className = '',
  id,
  role,
}) => {
  const { t } = useTranslation(['warnings', 'translation']);
  
  // Determine the ARIA role based on message type
  const ariaRole = role || (type === MESSAGE_TYPE.ERROR ? 'alert' : 'status');
  
  // Build list of messages to display
  const displayMessages = [];
  
  // Add single message
  if (message) {
    displayMessages.push(message);
  }
  
  // Add translated message from key
  if (messageKey) {
    displayMessages.push(t(messageKey, messageParams));
  }
  
  // Add messages array
  if (messages.length > 0) {
    displayMessages.push(...messages);
  }
  
  // Add translated error messages from error objects
  if (errors.length > 0) {
    errors.forEach(error => {
      if (error.errorKey) {
        displayMessages.push(t(error.errorKey, error.params || {}));
      }
    });
  }
  
  // Don't render if no messages
  if (displayMessages.length === 0) {
    return null;
  }
  
  const Icon = Icons[type];
  
  return (
    <div
      id={id}
      className={`validation-message validation-message--${type} ${className}`}
      role={ariaRole}
      aria-live={type === MESSAGE_TYPE.ERROR ? 'assertive' : 'polite'}
    >
      {showIcon && Icon && <Icon />}
      <div className="validation-message__content">
        {displayMessages.length === 1 ? (
          <span className="validation-message__text">{displayMessages[0]}</span>
        ) : (
          <ul className="validation-message__list">
            {displayMessages.map((msg, index) => (
              <li key={index} className="validation-message__list-item">
                {msg}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * CSS styles for ValidationMessage component
 * Should be included in index.css or a dedicated stylesheet
 */
export const ValidationMessageStyles = `
.validation-message {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.4;
  margin-top: 0.25rem;
}

.validation-message__icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  margin-top: 0.125rem;
}

.validation-message__content {
  flex: 1;
}

.validation-message__text {
  display: block;
}

.validation-message__list {
  margin: 0;
  padding-left: 1rem;
  list-style-type: disc;
}

.validation-message__list-item {
  margin-bottom: 0.25rem;
}

.validation-message__list-item:last-child {
  margin-bottom: 0;
}

/* Error type */
.validation-message--error {
  background-color: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.validation-message--error .validation-message__icon {
  color: #dc2626;
}

/* Warning type */
.validation-message--warning {
  background-color: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.validation-message--warning .validation-message__icon {
  color: #f59e0b;
}

/* Success type */
.validation-message--success {
  background-color: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.validation-message--success .validation-message__icon {
  color: #22c55e;
}

/* Info type */
.validation-message--info {
  background-color: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.validation-message--info .validation-message__icon {
  color: #3b82f6;
}
`;

export { Icons };
export default ValidationMessage;
