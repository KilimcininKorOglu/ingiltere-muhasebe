import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getSupportedLanguageCodes } from '../i18n/config';

/**
 * LanguageSwitcher Component
 * 
 * Provides a dropdown or button group for switching between supported languages.
 * Language preference is automatically persisted to localStorage by i18next.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.variant='dropdown'] - Display variant: 'dropdown' or 'buttons'
 * @param {string} [props.className] - Additional CSS class names
 * @param {boolean} [props.showNativeName=true] - Show language name in its native form
 * @param {Function} [props.onLanguageChange] - Callback when language changes
 */
const LanguageSwitcher = ({
  variant = 'dropdown',
  className = '',
  showNativeName = true,
  onLanguageChange,
}) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language;
  const supportedLanguages = getSupportedLanguageCodes();

  /**
   * Handle language change
   * @param {string} langCode - Language code to switch to
   */
  const handleLanguageChange = useCallback(
    async (langCode) => {
      if (langCode === currentLanguage) return;
      
      await i18n.changeLanguage(langCode);
      
      // Call the optional callback if provided
      if (onLanguageChange) {
        onLanguageChange(langCode);
      }
    },
    [currentLanguage, i18n, onLanguageChange]
  );

  /**
   * Handle dropdown selection
   * @param {React.ChangeEvent<HTMLSelectElement>} event - Change event
   */
  const handleSelectChange = useCallback(
    (event) => {
      handleLanguageChange(event.target.value);
    },
    [handleLanguageChange]
  );

  /**
   * Get display name for a language
   * @param {string} langCode - Language code
   * @returns {string} Display name
   */
  const getDisplayName = (langCode) => {
    const langInfo = SUPPORTED_LANGUAGES[langCode];
    return showNativeName ? langInfo?.nativeName : langInfo?.name;
  };

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={`language-switcher language-switcher--dropdown ${className}`}>
        <label htmlFor="language-select" className="language-switcher__label">
          {t('settings.language')}:
        </label>
        <select
          id="language-select"
          value={currentLanguage}
          onChange={handleSelectChange}
          className="language-switcher__select"
          aria-label={t('language.select')}
        >
          {supportedLanguages.map((langCode) => (
            <option key={langCode} value={langCode}>
              {getDisplayName(langCode)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Buttons variant
  return (
    <div
      className={`language-switcher language-switcher--buttons ${className}`}
      role="group"
      aria-label={t('language.select')}
    >
      {supportedLanguages.map((langCode) => (
        <button
          key={langCode}
          type="button"
          onClick={() => handleLanguageChange(langCode)}
          className={`language-switcher__button ${
            currentLanguage === langCode ? 'language-switcher__button--active' : ''
          }`}
          aria-pressed={currentLanguage === langCode}
          aria-label={t('language.switchTo', { language: getDisplayName(langCode) })}
        >
          {langCode.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
