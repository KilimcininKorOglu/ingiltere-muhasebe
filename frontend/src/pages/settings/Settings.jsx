import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { authService, taxRatesService } from '../../services/api';
import api from '../../services/api';
import { Settings as SettingsIcon, Building2, Receipt, Calculator, Globe, Loader2, Check, Save, Plus, Pencil, X, Info } from 'lucide-react';

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
        const oldFormatData = ratesRes.data?.data?.taxRates?.[selectedTaxYear];
        if (oldFormatData) {
          setTaxRates(oldFormatData);
          setRawTaxRates([]);
          return;
        }
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

  const transformRatesToCategories = (rates) => {
    const result = {
      vat: { thresholds: {}, rates: {} },
      incomeTax: { personalAllowance: {}, bands: [] },
      nationalInsurance: { class1: { employee: { thresholds: {}, rates: {} }, employer: { rates: {} } } },
      corporationTax: { rates: {} }
    };

    rates.forEach(rate => {
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

  const startEditRate = (rate) => {
    setEditingRate(rate.id);
    const displayValue = rate.rateType === 'threshold' 
      ? rate.value / 100
      : rate.value / 100;
    setEditValue(displayValue.toString());
  };

  const cancelEditRate = () => {
    setEditingRate(null);
    setEditValue('');
  };

  const saveEditRate = async (rate) => {
    try {
      const numValue = parseFloat(editValue);
      if (isNaN(numValue)) {
        alert('Please enter a valid number');
        return;
      }

      const storageValue = rate.rateType === 'threshold'
        ? Math.round(numValue * 100)
        : Math.round(numValue * 100);

      await taxRatesService.update(rate.id, { value: storageValue });

      const updatedRates = rawTaxRates.map(r => 
        r.id === rate.id ? { ...r, value: storageValue } : r
      );
      setRawTaxRates(updatedRates);
      setTaxRates(transformRatesToCategories(updatedRates));
      
      setEditingRate(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update tax rate:', error);
      alert('Update failed: ' + (error.response?.data?.error?.message || error.message));
    }
  };

  const getRawRate = (category, name, rateType = 'threshold') => {
    return rawTaxRates.find(r => r.category === category && r.name === name && r.rateType === rateType);
  };

  const getNextTaxYear = () => {
    if (taxYears.length === 0) return '2025-26';
    const lastYear = taxYears[0];
    const [startYear] = lastYear.split('-').map(Number);
    const nextStart = startYear + 1;
    const nextEnd = (nextStart + 1) % 100;
    return `${nextStart}-${nextEnd.toString().padStart(2, '0')}`;
  };

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

  const handleAddTaxYear = async () => {
    if (!newYearData.fromYear || !newYearData.toYear || !newYearData.effectiveFrom) {
      alert(t('common.fillAllFields'));
      return;
    }

    if (taxYears.includes(newYearData.toYear)) {
      alert(t('settings.yearExists'));
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

      const yearsRes = await taxRatesService.getYears();
      const taxYearsData = yearsRes.data?.data?.taxYears || [];
      setTaxYears(taxYearsData);
      setSelectedTaxYear(newYearData.toYear);
      setShowAddYearModal(false);
    } catch (error) {
      console.error('Failed to add tax year:', error);
      alert(t('settings.addYearFailed') + ': ' + (error.response?.data?.error?.message || error.message));
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
    { id: 'general', label: t('settings.general'), icon: Globe },
    { id: 'business', label: t('settings.business'), icon: Building2 },
    { id: 'vat', label: t('settings.vatSettings'), icon: Receipt },
    { id: 'taxRates', label: t('settings.taxRates'), icon: Calculator },
  ];

  const inputClass = "w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-zinc-300 mb-1.5";

  const renderEditableRate = (rate, prefix = '£', suffix = '') => {
    if (!rate) return <span className="text-zinc-500">-</span>;
    
    const displayValue = rate.rateType === 'threshold' 
      ? rate.value / 100 
      : rate.value / 100;

    if (editingRate === rate.id) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditRate(rate);
              if (e.key === 'Escape') cancelEditRate();
            }}
            className="w-24 px-2 py-1 bg-zinc-900 border border-emerald-500 rounded text-white text-sm focus:outline-none"
            autoFocus
          />
          <button onClick={() => saveEditRate(rate)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={cancelEditRate} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => startEditRate(rate)}
        className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900/50 hover:bg-zinc-700/50 rounded-lg text-white transition-colors group"
      >
        <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>
        <Pencil className="w-3 h-3 text-zinc-500 group-hover:text-emerald-400" />
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? t('common.saving') : saved ? t('settings.saved') : t('common.save')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-4">
            <div className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-zinc-300 hover:bg-zinc-700/50 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">{t('settings.general')}</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className={labelClass}>{t('settings.language')}</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                        settings.language === 'en'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-900/50 text-zinc-300 border border-zinc-700 hover:bg-zinc-700/50'
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => handleLanguageChange('tr')}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                        settings.language === 'tr'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-900/50 text-zinc-300 border border-zinc-700 hover:bg-zinc-700/50'
                      }`}
                    >
                      Turkce
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t('settings.currency')}</label>
                  <select name="currency" value={settings.currency} onChange={handleChange} className={inputClass}>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{t('settings.dateFormat')}</label>
                  <select name="dateFormat" value={settings.dateFormat} onChange={handleChange} className={inputClass}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Business Settings */}
          {activeTab === 'business' && (
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">{t('settings.business')}</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className={labelClass}>{t('settings.businessName')}</label>
                  <input
                    type="text"
                    name="businessName"
                    value={settings.businessName}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('settings.businessAddress')}</label>
                  <textarea
                    name="businessAddress"
                    value={settings.businessAddress}
                    onChange={handleChange}
                    rows={4}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* VAT Settings */}
          {activeTab === 'vat' && (
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">{t('settings.vatSettings')}</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className={labelClass}>{t('settings.vatNumber')}</label>
                  <input
                    type="text"
                    name="vatNumber"
                    value={settings.vatNumber}
                    onChange={handleChange}
                    placeholder="GB123456789"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('settings.vatScheme')}</label>
                  <div className="space-y-3">
                    {[
                      { id: 'standard', title: t('settings.standardScheme'), desc: t('settings.standardSchemeDesc') },
                      { id: 'flat_rate', title: t('settings.flatRateScheme'), desc: t('settings.flatRateSchemeDesc') },
                      { id: 'cash', title: t('settings.cashScheme'), desc: t('settings.cashSchemeDesc') },
                    ].map((scheme) => (
                      <button
                        key={scheme.id}
                        onClick={() => setSettings((prev) => ({ ...prev, vatScheme: scheme.id }))}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          settings.vatScheme === scheme.id
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${settings.vatScheme === scheme.id ? 'text-emerald-400' : 'text-white'}`}>
                            {scheme.title}
                          </span>
                          {settings.vatScheme === scheme.id && <Check className="w-5 h-5 text-emerald-400" />}
                        </div>
                        <p className="text-sm text-zinc-400">{scheme.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tax Rates */}
          {activeTab === 'taxRates' && (
            <div className="space-y-6">
              <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{t('settings.taxRates')}</h2>
                      <p className="text-sm text-zinc-400">{t('settings.taxRatesDesc')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <label className="text-sm text-zinc-400">{t('settings.taxYear')}</label>
                  <select
                    value={selectedTaxYear}
                    onChange={(e) => setSelectedTaxYear(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {taxYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <button
                    onClick={openAddYearModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t('settings.newYear')}
                  </button>
                </div>

                {/* VAT Rates */}
                {taxRates.vat && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">{t('settings.categoryVat')}</h3>
                    <div className="bg-zinc-900/50 rounded-lg divide-y divide-zinc-700">
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateRegistration')}</span>
                        {renderEditableRate(getRawRate('vat', 'registration', 'threshold'), '£')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateDeregistration')}</span>
                        {renderEditableRate(getRawRate('vat', 'deregistration', 'threshold'), '£')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateStandard')}</span>
                        {renderEditableRate(getRawRate('vat', 'standard', 'rate'), '', '%')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateReduced')}</span>
                        {renderEditableRate(getRawRate('vat', 'reduced', 'rate'), '', '%')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Income Tax */}
                {taxRates.incomeTax && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">{t('settings.categoryIncomeTax')}</h3>
                    <div className="bg-zinc-900/50 rounded-lg divide-y divide-zinc-700">
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.ratePersonalAllowance')}</span>
                        {renderEditableRate(getRawRate('income_tax', 'personal_allowance', 'threshold'), '£')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateBasic')}</span>
                        {renderEditableRate(getRawRate('income_tax', 'basic', 'rate'), '', '%')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateHigher')}</span>
                        {renderEditableRate(getRawRate('income_tax', 'higher', 'rate'), '', '%')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateAdditional')}</span>
                        {renderEditableRate(getRawRate('income_tax', 'additional', 'rate'), '', '%')}
                      </div>
                    </div>
                  </div>
                )}

                {/* National Insurance */}
                {taxRates.nationalInsurance && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">{t('settings.categoryNI')}</h3>
                    <div className="bg-zinc-900/50 rounded-lg divide-y divide-zinc-700">
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.ratePrimaryThreshold')}</span>
                        {renderEditableRate(getRawRate('national_insurance', 'primary_threshold', 'threshold'), '£')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateUpperEarnings')}</span>
                        {renderEditableRate(getRawRate('national_insurance', 'upper_earnings_limit', 'threshold'), '£')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateEmployeeMain')}</span>
                        {renderEditableRate(getRawRate('national_insurance', 'employee_main', 'rate'), '', '%')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateEmployer')}</span>
                        {renderEditableRate(getRawRate('national_insurance', 'employer', 'rate'), '', '%')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Corporation Tax */}
                {taxRates.corporationTax && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">{t('settings.categoryCorporationTax')}</h3>
                    <div className="bg-zinc-900/50 rounded-lg divide-y divide-zinc-700">
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateSmallProfits')}</span>
                        {renderEditableRate(getRawRate('corporation_tax', 'small_profits', 'rate'), '', '%')}
                      </div>
                      <div className="flex items-center justify-between p-3">
                        <span className="text-zinc-300">{t('settings.rateMain')}</span>
                        {renderEditableRate(getRawRate('corporation_tax', 'main', 'rate'), '', '%')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Year Modal */}
      {showAddYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddYearModal(false)}>
          <div className="bg-zinc-800 rounded-xl border border-zinc-700 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">{t('settings.addNewYear')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className={labelClass}>{t('settings.copyFromYear')}</label>
                <select
                  value={newYearData.fromYear}
                  onChange={(e) => setNewYearData(prev => ({ ...prev, fromYear: e.target.value }))}
                  className={inputClass}
                >
                  {taxYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>{t('settings.newTaxYear')}</label>
                <input
                  type="text"
                  value={newYearData.toYear}
                  onChange={(e) => setNewYearData(prev => ({ ...prev, toYear: e.target.value }))}
                  placeholder="2026-27"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>{t('settings.effectiveFrom')}</label>
                <input
                  type="date"
                  value={newYearData.effectiveFrom}
                  onChange={(e) => setNewYearData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>{t('settings.effectiveTo')}</label>
                <input
                  type="date"
                  value={newYearData.effectiveTo}
                  onChange={(e) => setNewYearData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddYearModal(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddTaxYear}
                disabled={addingYear}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors"
              >
                {addingYear && <Loader2 className="w-4 h-4 animate-spin" />}
                {addingYear ? t('common.adding') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
