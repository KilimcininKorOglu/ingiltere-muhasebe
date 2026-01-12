import { useTranslation } from 'react-i18next';

/**
 * Icon components for quick tips
 */
const icons = {
  keyboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
    </svg>
  ),
  language: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

/**
 * QuickTips Component
 * 
 * Displays a list of quick tips with icons.
 * Tips are shown as cards with title, icon, and content.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.tips - Array of tip objects
 * @param {string} [props.className] - Additional CSS class names
 */
const QuickTips = ({ tips, className = '' }) => {
  const { t } = useTranslation('help');

  if (!tips || tips.length === 0) {
    return null;
  }

  /**
   * Get icon component for a tip
   * @param {string} iconName - Name of the icon
   * @returns {JSX.Element} Icon component
   */
  const getIcon = (iconName) => {
    return icons[iconName] || icons.default;
  };

  return (
    <div className={`quick-tips ${className}`}>
      <h3 className="quick-tips__title">{t('quickTips.title')}</h3>
      
      <ul className="quick-tips__list" role="list">
        {tips.map((tip) => (
          <li key={tip.id} className="quick-tips__item" role="listitem">
            <div className="quick-tips__icon-wrapper">
              {getIcon(tip.icon)}
            </div>
            <div className="quick-tips__content">
              <h4 className="quick-tips__item-title">{tip.title}</h4>
              <p className="quick-tips__item-text">{tip.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QuickTips;
