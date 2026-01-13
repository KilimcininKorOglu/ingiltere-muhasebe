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
  const [taxYears, setTaxYears] = useState([]);
  const [selectedTaxYear, setSelectedTaxYear] = useState('');

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
          return;
        }
        
        // New format: flat array from database - transform to category-based structure
        const ratesArray = ratesRes.data?.data?.rates || [];
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
                        <td>£{taxRates.vat.thresholds?.registration?.amount?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateDeregistration')}</td>
                        <td>£{taxRates.vat.thresholds?.deregistration?.amount?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateStandard')}</td>
                        <td>{(taxRates.vat.rates?.standard?.rate * 100)}%</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateReduced')}</td>
                        <td>{(taxRates.vat.rates?.reduced?.rate * 100)}%</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateZero')}</td>
                        <td>{(taxRates.vat.rates?.zero?.rate * 100)}%</td>
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
                        <td>£{taxRates.incomeTax.personalAllowance?.amount?.toLocaleString()}</td>
                      </tr>
                      {taxRates.incomeTax.bands?.map((band, idx) => (
                        <tr key={idx}>
                          <td>{band.description?.[i18n.language] || band.name}</td>
                          <td>{(band.rate * 100)}%</td>
                        </tr>
                      ))}
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
                        <td>£{taxRates.nationalInsurance.class1?.employee?.thresholds?.primaryThreshold?.annual?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateUpperEarnings')}</td>
                        <td>£{taxRates.nationalInsurance.class1?.employee?.thresholds?.upperEarningsLimit?.annual?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateEmployeeMain')}</td>
                        <td>{(taxRates.nationalInsurance.class1?.employee?.rates?.mainRate * 100)}%</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateEmployer')}</td>
                        <td>{(taxRates.nationalInsurance.class1?.employer?.rates?.mainRate * 100)}%</td>
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
                        <td>{(taxRates.corporationTax.rates?.small?.rate * 100)}%</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateSmallProfitsLimit')}</td>
                        <td>£{taxRates.corporationTax.rates?.small?.profitsThreshold?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>{t('settings.rateMain')}</td>
                        <td>{(taxRates.corporationTax.rates?.main?.rate * 100)}%</td>
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
