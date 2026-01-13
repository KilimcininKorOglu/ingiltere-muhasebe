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
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearData, setNewYearData] = useState({ fromYear: '', toYear: '', effectiveFrom: '', effectiveTo: '' });
  const [addingYear, setAddingYear] = useState(false);

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

  // Render editable cell with data-label
  const renderEditableCell = (rate, prefix = '£', suffix = '', dataLabel = '') => {
    if (!rate) return <td data-label={dataLabel}>-</td>;
    
    const displayValue = rate.rateType === 'threshold' 
      ? rate.value / 100 
      : rate.value / 100;

    if (editingRate === rate.id) {
      return (
        <td className="editing-cell" data-label={dataLabel}>
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
      <td className="editable-cell" data-label={dataLabel} onClick={() => startEditRate(rate)}>
        {prefix}{displayValue.toLocaleString()}{suffix}
        <span className="edit-icon">&#9998;</span>
      </td>
    );
  };

  // Tax rate descriptions for tooltips
  const rateDescriptions = {
    vat: {
      registration: {
        tr: 'Son 12 ayda bu tutarı aşan ciroya sahip işletmeler KDV kaydı yaptırmalıdır',
        en: 'Businesses with turnover exceeding this amount in the last 12 months must register for VAT'
      },
      deregistration: {
        tr: 'Cironuz bu tutarın altına düşerse KDV kaydınızı iptal ettirebilirsiniz',
        en: 'You can deregister for VAT if your turnover falls below this amount'
      },
      standard: {
        tr: 'Çoğu mal ve hizmet için uygulanan standart KDV oranı',
        en: 'Standard VAT rate applied to most goods and services'
      },
      reduced: {
        tr: 'Ev enerjisi, çocuk araba koltukları vb. için indirimli oran',
        en: 'Reduced rate for home energy, child car seats, etc.'
      },
      zero: {
        tr: 'Gıda, kitap, çocuk giysileri vb. için sıfır oran',
        en: 'Zero rate for food, books, children\'s clothing, etc.'
      }
    },
    income_tax: {
      personal_allowance: {
        tr: 'Yıllık gelirin bu tutarına kadar vergi ödenmez',
        en: 'No tax is paid on annual income up to this amount'
      },
      basic: {
        tr: 'Kişisel ödenek sonrası £37,700\'e kadar gelire uygulanan oran',
        en: 'Rate applied to income up to £37,700 after personal allowance'
      },
      higher: {
        tr: '£37,701 - £125,140 arası gelire uygulanan oran',
        en: 'Rate applied to income between £37,701 and £125,140'
      },
      additional: {
        tr: '£125,140 üzeri gelire uygulanan en yüksek oran',
        en: 'Highest rate applied to income over £125,140'
      }
    },
    national_insurance: {
      primary_threshold: {
        tr: 'Çalışan NI katkı payı bu eşiğin üzerindeki kazançlardan başlar',
        en: 'Employee NI contributions start on earnings above this threshold'
      },
      upper_earnings_limit: {
        tr: 'Bu limitin üzerinde daha düşük NI oranı uygulanır',
        en: 'A lower NI rate applies above this limit'
      },
      employee_main: {
        tr: 'Birincil eşik ile üst kazanç limiti arasındaki kazançlara uygulanan çalışan NI oranı',
        en: 'Employee NI rate on earnings between primary threshold and upper earnings limit'
      },
      employer: {
        tr: 'İkincil eşik üzerindeki kazançlara uygulanan işveren NI oranı',
        en: 'Employer NI rate on earnings above secondary threshold'
      }
    },
    corporation_tax: {
      small_profits: {
        tr: '£50,000\'a kadar kârlara uygulanan küçük işletme oranı',
        en: 'Small business rate applied to profits up to £50,000'
      },
      small_profits_limit: {
        tr: 'Bu tutara kadar kârlar küçük kâr oranından vergilendirilir',
        en: 'Profits up to this amount are taxed at the small profits rate'
      },
      main: {
        tr: '£250,000 üzeri kârlara uygulanan ana kurumlar vergisi oranı',
        en: 'Main corporation tax rate applied to profits over £250,000'
      }
    }
  };

  // Get description for a rate
  const getRateDescription = (category, name) => {
    const lang = i18n.language;
    return rateDescriptions[category]?.[name]?.[lang] || rateDescriptions[category]?.[name]?.['en'] || '';
  };

  // Render rate name with tooltip
  const renderRateName = (label, category, name) => {
    const description = getRateDescription(category, name);
    return (
      <td className="rate-name-cell">
        <span className="rate-name">{label}</span>
        {description && (
          <span className="rate-info" title={description}>ⓘ</span>
        )}
      </td>
    );
  };

  // Generate next tax year string (e.g., "2025-26" -> "2026-27")
  const getNextTaxYear = () => {
    if (taxYears.length === 0) return '2025-26';
    const lastYear = taxYears[0]; // Already sorted descending
    const [startYear] = lastYear.split('-').map(Number);
    const nextStart = startYear + 1;
    const nextEnd = (nextStart + 1) % 100;
    return `${nextStart}-${nextEnd.toString().padStart(2, '0')}`;
  };

  // Open add year modal with defaults
  const openAddYearModal = () => {
    const nextYear = getNextTaxYear();
    const [startYear] = nextYear.split('-').map(Number);
    setNewYearData({
      fromYear: taxYears[0] || '2024-25',
      toYear: nextYear,
      effectiveFrom: `${startYear}-04-06`,
      effectiveTo: `${startYear + 1}-04-05`
    });
    setShowAddYearModal(true);
  };

  // Add new tax year by copying from existing
  const handleAddTaxYear = async () => {
    if (!newYearData.fromYear || !newYearData.toYear || !newYearData.effectiveFrom) {
      alert(i18n.language === 'tr' ? 'Tüm alanları doldurunuz' : 'Please fill all fields');
      return;
    }

    if (taxYears.includes(newYearData.toYear)) {
      alert(i18n.language === 'tr' ? 'Bu vergi yılı zaten mevcut' : 'This tax year already exists');
      return;
    }

    setAddingYear(true);
    try {
      await taxRatesService.copyYear({
        fromYear: newYearData.fromYear,
        toYear: newYearData.toYear,
        effectiveFrom: newYearData.effectiveFrom,
        effectiveTo: newYearData.effectiveTo
      });

      // Refresh tax years
      const yearsRes = await taxRatesService.getYears();
      const taxYearsData = yearsRes.data?.data?.taxYears || [];
      setTaxYears(taxYearsData);
      setSelectedTaxYear(newYearData.toYear);
      setShowAddYearModal(false);
    } catch (error) {
      console.error('Failed to add tax year:', error);
      alert((i18n.language === 'tr' ? 'Vergi yılı eklenemedi: ' : 'Failed to add tax year: ') + 
        (error.response?.data?.error?.message || error.message));
    } finally {
      setAddingYear(false);
    }
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

              <div className="form-group tax-year-selector">
                <label>{t('settings.taxYear')}</label>
                <div className="tax-year-controls">
                  <select
                    value={selectedTaxYear}
                    onChange={(e) => setSelectedTaxYear(e.target.value)}
                  >
                    {taxYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-add-year"
                    onClick={openAddYearModal}
                  >
                    + {i18n.language === 'tr' ? 'Yeni Yıl' : 'New Year'}
                  </button>
                </div>
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
                        {renderRateName(t('settings.rateRegistration'), 'vat', 'registration')}
                        {renderEditableCell(getRawRate('vat', 'registration', 'threshold'), '£', '', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateDeregistration'), 'vat', 'deregistration')}
                        {renderEditableCell(getRawRate('vat', 'deregistration', 'threshold'), '£', '', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateStandard'), 'vat', 'standard')}
                        {renderEditableCell(getRawRate('vat', 'standard', 'rate'), '', '%', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateReduced'), 'vat', 'reduced')}
                        {renderEditableCell(getRawRate('vat', 'reduced', 'rate'), '', '%', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateZero'), 'vat', 'zero')}
                        {renderEditableCell(getRawRate('vat', 'zero', 'rate'), '', '%', t('settings.rateValue'))}
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
                        {renderRateName(t('settings.ratePersonalAllowance'), 'income_tax', 'personal_allowance')}
                        {renderEditableCell(getRawRate('income_tax', 'personal_allowance', 'threshold'), '£', '', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateBasic'), 'income_tax', 'basic')}
                        {renderEditableCell(getRawRate('income_tax', 'basic', 'rate'), '', '%', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateHigher'), 'income_tax', 'higher')}
                        {renderEditableCell(getRawRate('income_tax', 'higher', 'rate'), '', '%', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateAdditional'), 'income_tax', 'additional')}
                        {renderEditableCell(getRawRate('income_tax', 'additional', 'rate'), '', '%', t('settings.rateValue'))}
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
                        {renderRateName(t('settings.ratePrimaryThreshold'), 'national_insurance', 'primary_threshold')}
                        {renderEditableCell(getRawRate('national_insurance', 'primary_threshold', 'threshold'), '£', '', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateUpperEarnings'), 'national_insurance', 'upper_earnings_limit')}
                        {renderEditableCell(getRawRate('national_insurance', 'upper_earnings_limit', 'threshold'), '£', '', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateEmployeeMain'), 'national_insurance', 'employee_main')}
                        {renderEditableCell(getRawRate('national_insurance', 'employee_main', 'rate'), '', '%', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateEmployer'), 'national_insurance', 'employer')}
                        {renderEditableCell(getRawRate('national_insurance', 'employer', 'rate'), '', '%', t('settings.rateValue'))}
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
                        {renderRateName(t('settings.rateSmallProfits'), 'corporation_tax', 'small_profits')}
                        {renderEditableCell(getRawRate('corporation_tax', 'small_profits', 'rate'), '', '%', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateSmallProfitsLimit'), 'corporation_tax', 'small_profits_limit')}
                        {renderEditableCell(getRawRate('corporation_tax', 'small_profits_limit', 'threshold'), '£', '', t('settings.rateValue'))}
                      </tr>
                      <tr>
                        {renderRateName(t('settings.rateMain'), 'corporation_tax', 'main')}
                        {renderEditableCell(getRawRate('corporation_tax', 'main', 'rate'), '', '%', t('settings.rateValue'))}
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

      {showAddYearModal && (
        <div className="modal-overlay" onClick={() => setShowAddYearModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{i18n.language === 'tr' ? 'Yeni Vergi Yılı Ekle' : 'Add New Tax Year'}</h3>
            
            <div className="form-group">
              <label>{i18n.language === 'tr' ? 'Kopyalanacak Yıl' : 'Copy From Year'}</label>
              <select 
                value={newYearData.fromYear}
                onChange={(e) => setNewYearData(prev => ({ ...prev, fromYear: e.target.value }))}
              >
                {taxYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{i18n.language === 'tr' ? 'Yeni Vergi Yılı' : 'New Tax Year'}</label>
              <input
                type="text"
                value={newYearData.toYear}
                onChange={(e) => setNewYearData(prev => ({ ...prev, toYear: e.target.value }))}
                placeholder="2026-27"
              />
            </div>

            <div className="form-group">
              <label>{i18n.language === 'tr' ? 'Başlangıç Tarihi' : 'Effective From'}</label>
              <input
                type="date"
                value={newYearData.effectiveFrom}
                onChange={(e) => setNewYearData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>{i18n.language === 'tr' ? 'Bitiş Tarihi' : 'Effective To'}</label>
              <input
                type="date"
                value={newYearData.effectiveTo}
                onChange={(e) => setNewYearData(prev => ({ ...prev, effectiveTo: e.target.value }))}
              />
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowAddYearModal(false)}
              >
                {i18n.language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleAddTaxYear}
                disabled={addingYear}
              >
                {addingYear 
                  ? (i18n.language === 'tr' ? 'Ekleniyor...' : 'Adding...') 
                  : (i18n.language === 'tr' ? 'Ekle' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
