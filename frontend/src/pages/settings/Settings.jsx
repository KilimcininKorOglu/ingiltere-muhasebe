import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import { authService, taxRatesService } from '../../services/api';
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
  const [taxRates, setTaxRates] = useState({});
  const [rawTaxRates, setRawTaxRates] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedTaxYear, setSelectedTaxYear] = useState('');
  const [editingRate, setEditingRate] = useState(null);
  const [editValue, setEditValue] = useState('');

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

  useEffect(() => {
    const fetchTaxRates = async () => {
      try {
        const yearsRes = await taxRatesService.getYears();
        // Support both old format (availableYears array of objects) and new format (taxYears array of strings)
        const taxYearsData = yearsRes.data?.data?.taxYears || [];
        const availableYears = yearsRes.data?.data?.availableYears || [];
        const years = taxYearsData.length > 0 
          ? taxYearsData 
          : availableYears.map((y) => typeof y === 'string' ? y : y.year);
        setTaxYears(years);
        if (years.length > 0 && !selectedTaxYear) {
          setSelectedTaxYear(years[0]);
        }
      } catch (error) {
        console.error('Failed to fetch tax years:', error);
      }
    };
    fetchTaxRates();
  }, []);

  useEffect(() => {
    const fetchRatesForYear = async () => {
      if (!selectedTaxYear) return;
      try {
        const ratesRes = await taxRatesService.getAll({ taxYear: selectedTaxYear });
        
        // Check for old format (config-based nested structure)
        const oldFormatData = ratesRes.data?.data?.taxRates?.[selectedTaxYear];
        if (oldFormatData) {
          setTaxRates(oldFormatData);
          setRawTaxRates([]);
          return;
        }
        
        // New format: flat array from database - transform to category-based structure
        const ratesArray = ratesRes.data?.data?.rates || [];
        setRawTaxRates(ratesArray);
        const transformed = transformRatesToCategories(ratesArray);
        setTaxRates(transformed);
      } catch (error) {
        console.error('Failed to fetch tax rates:', error);
      }
    };
    fetchRatesForYear();
  }, [selectedTaxYear]);

  // Transform flat rates array to category-based structure for UI
  const transformRatesToCategories = (rates) => {
    const result = {
      vat: { thresholds: {}, rates: {} },
      incomeTax: { personalAllowance: {}, bands: [] },
      nationalInsurance: { class1: { employee: { thresholds: {}, rates: {} }, employer: { rates: {} } } },
      corporationTax: { rates: {} }
    };

    rates.forEach(rate => {
      // Convert value from pence to pounds for thresholds, basis points to decimal for rates
      const displayValue = rate.rateType === 'threshold' 
        ? rate.value / 100 
        : rate.value / 10000;

      switch (rate.category) {
        case 'vat':
          if (rate.rateType === 'threshold') {
            result.vat.thresholds[rate.name] = { amount: displayValue };
          } else {
            result.vat.rates[rate.name] = { rate: displayValue };
          }
          break;
        case 'income_tax':
          if (rate.name === 'personal_allowance') {
            result.incomeTax.personalAllowance = { amount: displayValue };
          } else if (rate.rateType === 'rate') {
            result.incomeTax.bands.push({
              name: rate.name,
              rate: displayValue,
              description: { en: rate.description, tr: rate.description }
            });
          }
          break;
        case 'national_insurance':
          if (rate.rateType === 'threshold') {
            if (rate.name === 'primary_threshold') {
              result.nationalInsurance.class1.employee.thresholds.primaryThreshold = { annual: displayValue };
            } else if (rate.name === 'upper_earnings_limit') {
              result.nationalInsurance.class1.employee.thresholds.upperEarningsLimit = { annual: displayValue };
            }
          } else if (rate.rateType === 'rate') {
            if (rate.name === 'employee_main') {
              result.nationalInsurance.class1.employee.rates.mainRate = displayValue;
            } else if (rate.name === 'employer') {
              result.nationalInsurance.class1.employer.rates.mainRate = displayValue;
            }
          }
          break;
        case 'corporation_tax':
          if (rate.rateType === 'rate') {
            if (rate.name === 'small_profits') {
              result.corporationTax.rates.small = { rate: displayValue };
            } else if (rate.name === 'main') {
              result.corporationTax.rates.main = { rate: displayValue };
            }
          } else if (rate.rateType === 'threshold') {
            if (rate.name === 'small_profits_limit') {
              if (!result.corporationTax.rates.small) result.corporationTax.rates.small = {};
              result.corporationTax.rates.small.profitsThreshold = displayValue;
            }
          }
          break;
      }
    });

    return result;
  };

  // Start editing a tax rate
  const startEditRate = (rate) => {
    setEditingRate(rate.id);
    // Convert from storage format to display format
    const displayValue = rate.rateType === 'threshold' 
      ? rate.value / 100  // pence to pounds
      : rate.value / 100; // basis points to percentage
    setEditValue(displayValue.toString());
  };

  // Cancel editing
  const cancelEditRate = () => {
    setEditingRate(null);
    setEditValue('');
  };

  // Save edited rate
  const saveEditRate = async (rate) => {
    try {
      const numValue = parseFloat(editValue);
      if (isNaN(numValue)) {
        alert('Geçerli bir sayı giriniz');
        return;
      }

      // Convert from display format to storage format
      const storageValue = rate.rateType === 'threshold'
        ? Math.round(numValue * 100)  // pounds to pence
        : Math.round(numValue * 100); // percentage to basis points

      await taxRatesService.update(rate.id, { value: storageValue });

      // Update local state
      const updatedRates = rawTaxRates.map(r => 
        r.id === rate.id ? { ...r, value: storageValue } : r
      );
      setRawTaxRates(updatedRates);
      setTaxRates(transformRatesToCategories(updatedRates));
      
      setEditingRate(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update tax rate:', error);
      alert('Güncelleme başarısız: ' + (error.response?.data?.error?.message || error.message));
    }
  };

  // Get raw rate by category and name
  const getRawRate = (category, name, rateType = 'threshold') => {
    return rawTaxRates.find(r => r.category === category && r.name === name && r.rateType === rateType);
  };

  // Render editable cell
  const renderEditableCell = (rate, prefix = '£', suffix = '') => {
    if (!rate) return <td>-</td>;
    
    const displayValue = rate.rateType === 'threshold' 
      ? rate.value / 100 
      : rate.value / 100;

    if (editingRate === rate.id) {
      return (
        <td className="editing-cell">
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditRate(rate);
              if (e.key === 'Escape') cancelEditRate();
            }}
            autoFocus
          />
          <button className="btn-save-small" onClick={() => saveEditRate(rate)}>&#10003;</button>
          <button className="btn-cancel-small" onClick={cancelEditRate}>&#10005;</button>
        </td>
      );
    }

    return (
      <td className="editable-cell" onClick={() => startEditRate(rate)}>
        {prefix}{displayValue.toLocaleString()}{suffix}
        <span className="edit-icon">&#9998;</span>
      </td>
    );
  };

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
    { id: 'taxRates', label: t('settings.taxRates') },
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

          {activeTab === 'taxRates' && (
            <div className="settings-section">
              <h2>{t('settings.taxRates')}</h2>
              <p className="section-description">{t('settings.taxRatesDesc')}</p>

              <div className="form-group">
                <label>{t('settings.taxYear')}</label>
                <select
                  value={selectedTaxYear}
                  onChange={(e) => setSelectedTaxYear(e.target.value)}
                >
                  {taxYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {taxRates.vat && (
                <div className="tax-category">
                  <h3>{t('settings.categoryVat')}</h3>
                  <table className="tax-rates-table">
                    <thead>
                      <tr>
                        <th>{t('settings.rateName')}</th>
                        <th>{t('settings.rateValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t('settings.rateRegistration')}</td>
                        {renderEditableCell(getRawRate('vat', 'registration', 'threshold'), '£', '')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateDeregistration')}</td>
                        {renderEditableCell(getRawRate('vat', 'deregistration', 'threshold'), '£', '')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateStandard')}</td>
                        {renderEditableCell(getRawRate('vat', 'standard', 'rate'), '', '%')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateReduced')}</td>
                        {renderEditableCell(getRawRate('vat', 'reduced', 'rate'), '', '%')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateZero')}</td>
                        {renderEditableCell(getRawRate('vat', 'zero', 'rate'), '', '%')}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {taxRates.incomeTax && (
                <div className="tax-category">
                  <h3>{t('settings.categoryIncomeTax')}</h3>
                  <table className="tax-rates-table">
                    <thead>
                      <tr>
                        <th>{t('settings.rateName')}</th>
                        <th>{t('settings.rateValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t('settings.ratePersonalAllowance')}</td>
                        {renderEditableCell(getRawRate('income_tax', 'personal_allowance', 'threshold'), '£', '')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateBasic')}</td>
                        {renderEditableCell(getRawRate('income_tax', 'basic', 'rate'), '', '%')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateHigher')}</td>
                        {renderEditableCell(getRawRate('income_tax', 'higher', 'rate'), '', '%')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateAdditional')}</td>
                        {renderEditableCell(getRawRate('income_tax', 'additional', 'rate'), '', '%')}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {taxRates.nationalInsurance && (
                <div className="tax-category">
                  <h3>{t('settings.categoryNI')}</h3>
                  <table className="tax-rates-table">
                    <thead>
                      <tr>
                        <th>{t('settings.rateName')}</th>
                        <th>{t('settings.rateValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t('settings.ratePrimaryThreshold')}</td>
                        {renderEditableCell(getRawRate('national_insurance', 'primary_threshold', 'threshold'), '£', '')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateUpperEarnings')}</td>
                        {renderEditableCell(getRawRate('national_insurance', 'upper_earnings_limit', 'threshold'), '£', '')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateEmployeeMain')}</td>
                        {renderEditableCell(getRawRate('national_insurance', 'employee_main', 'rate'), '', '%')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateEmployer')}</td>
                        {renderEditableCell(getRawRate('national_insurance', 'employer', 'rate'), '', '%')}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {taxRates.corporationTax && (
                <div className="tax-category">
                  <h3>{t('settings.categoryCorporationTax')}</h3>
                  <table className="tax-rates-table">
                    <thead>
                      <tr>
                        <th>{t('settings.rateName')}</th>
                        <th>{t('settings.rateValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{t('settings.rateSmallProfits')}</td>
                        {renderEditableCell(getRawRate('corporation_tax', 'small_profits', 'rate'), '', '%')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateSmallProfitsLimit')}</td>
                        {renderEditableCell(getRawRate('corporation_tax', 'small_profits_limit', 'threshold'), '£', '')}
                      </tr>
                      <tr>
                        <td>{t('settings.rateMain')}</td>
                        {renderEditableCell(getRawRate('corporation_tax', 'main', 'rate'), '', '%')}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <p className="info-note">
                {i18n.language === 'tr' 
                  ? 'Vergi oranları veritabanında saklanmaktadır. HMRC güncellemelerini uygulamak için veritabanındaki değerleri güncelleyiniz.'
                  : 'Tax rates are stored in the database. Update database values to apply HMRC changes.'}
              </p>
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
