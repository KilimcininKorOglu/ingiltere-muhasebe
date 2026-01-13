import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import { authService } from '../../services/api';
import api from '../../services/api';
import '../transactions/Transactions.css';
import './Settings.css';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    language: i18n.language || 'en',
    currency: 'GBP',
    dateFormat: 'DD/MM/YYYY',
    vatScheme: 'standard',
    vatNumber: '',
    businessName: '',
    businessAddress: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await authService.me();
        const user = response.data?.data?.user || response.data?.user || response.data;
        if (user) {
          setSettings((prev) => ({
            ...prev,
            businessName: user.businessName || '',
            businessAddress: user.businessAddress || '',
            vatNumber: user.vatNumber || '',
            vatScheme: user.vatScheme || 'standard',
            currency: user.currency || 'GBP',
            dateFormat: user.dateFormat || 'DD/MM/YYYY',
          }));
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setSettings((prev) => ({ ...prev, language: lang }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/me', {
        businessName: settings.businessName,
        businessAddress: settings.businessAddress,
        vatNumber: settings.vatNumber,
        vatScheme: settings.vatScheme,
        currency: settings.currency,
        dateFormat: settings.dateFormat,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: t('settings.general') },
    { id: 'business', label: t('settings.business') },
    { id: 'vat', label: t('settings.vatSettings') },
  ];

  return (
    <div className="page-container">
      <Header title={t('settings.title')} />

      <div className="settings-container">
        <div className="settings-sidebar">
          <ul className="settings-tabs">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h2>{t('settings.general')}</h2>

              <div className="form-group">
                <label>{t('settings.language')}</label>
                <div className="language-buttons">
                  <button
                    className={`lang-btn ${settings.language === 'en' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    English
                  </button>
                  <button
                    className={`lang-btn ${settings.language === 'tr' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('tr')}
                  >
                    Türkçe
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>{t('settings.currency')}</label>
                <select name="currency" value={settings.currency} onChange={handleChange}>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('settings.dateFormat')}</label>
                <select name="dateFormat" value={settings.dateFormat} onChange={handleChange}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'business' && (
            <div className="settings-section">
              <h2>{t('settings.business')}</h2>

              <div className="form-group">
                <label>{t('settings.businessName')}</label>
                <input
                  type="text"
                  name="businessName"
                  value={settings.businessName}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>{t('settings.businessAddress')}</label>
                <textarea
                  name="businessAddress"
                  value={settings.businessAddress}
                  onChange={handleChange}
                  rows={4}
                />
              </div>
            </div>
          )}

          {activeTab === 'vat' && (
            <div className="settings-section">
              <h2>{t('settings.vatSettings')}</h2>

              <div className="form-group">
                <label>{t('settings.vatNumber')}</label>
                <input
                  type="text"
                  name="vatNumber"
                  value={settings.vatNumber}
                  onChange={handleChange}
                  placeholder="GB123456789"
                />
              </div>

              <div className="form-group">
                <label>{t('settings.vatScheme')}</label>
                <div className="scheme-options">
                  <div
                    className={`scheme-option ${settings.vatScheme === 'standard' ? 'active' : ''}`}
                    onClick={() => setSettings((prev) => ({ ...prev, vatScheme: 'standard' }))}
                  >
                    <div className="scheme-option-header">
                      <span className="scheme-option-title">{t('settings.standardScheme')}</span>
                      {settings.vatScheme === 'standard' && <span className="scheme-check">✓</span>}
                    </div>
                    <p className="scheme-option-desc">{t('settings.standardSchemeDesc')}</p>
                  </div>
                  <div
                    className={`scheme-option ${settings.vatScheme === 'flat_rate' ? 'active' : ''}`}
                    onClick={() => setSettings((prev) => ({ ...prev, vatScheme: 'flat_rate' }))}
                  >
                    <div className="scheme-option-header">
                      <span className="scheme-option-title">{t('settings.flatRateScheme')}</span>
                      {settings.vatScheme === 'flat_rate' && <span className="scheme-check">✓</span>}
                    </div>
                    <p className="scheme-option-desc">{t('settings.flatRateSchemeDesc')}</p>
                  </div>
                  <div
                    className={`scheme-option ${settings.vatScheme === 'cash' ? 'active' : ''}`}
                    onClick={() => setSettings((prev) => ({ ...prev, vatScheme: 'cash' }))}
                  >
                    <div className="scheme-option-header">
                      <span className="scheme-option-title">{t('settings.cashScheme')}</span>
                      {settings.vatScheme === 'cash' && <span className="scheme-check">✓</span>}
                    </div>
                    <p className="scheme-option-desc">{t('settings.cashSchemeDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            {saved && <span className="save-success">{t('settings.saved')}</span>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
