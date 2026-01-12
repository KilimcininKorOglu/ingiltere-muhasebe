/**
 * UK VAT Rates Reference Data
 * 
 * Contains all current UK VAT rates with bilingual descriptions (English/Turkish)
 * to help users understand which rate applies to their products/services.
 * 
 * Last updated: January 2026
 * Reference: https://www.gov.uk/vat-rates
 */

const vatRates = [
  {
    id: 'standard',
    code: 'S',
    rate: 20,
    name: {
      en: 'Standard Rate',
      tr: 'Standart Oran'
    },
    description: {
      en: 'The standard VAT rate applies to most goods and services unless they qualify for a reduced rate, zero rate, or exemption.',
      tr: 'Standart KDV oranı, indirimli oran, sıfır oran veya muafiyet için uygun olmadıkça çoğu mal ve hizmete uygulanır.'
    },
    examples: {
      en: [
        'Most goods sold in shops',
        'Most services (consulting, professional services)',
        'Alcohol and tobacco products',
        'Hot takeaway food and drinks',
        'Confectionery, ice cream, soft drinks',
        'Hiring or selling vehicles',
        'Admission to entertainment venues',
        'Electrical and gas appliances',
        'Clothing and footwear (except children\'s)',
        'Restaurant meals'
      ],
      tr: [
        'Mağazalarda satılan çoğu ürün',
        'Çoğu hizmet (danışmanlık, profesyonel hizmetler)',
        'Alkol ve tütün ürünleri',
        'Sıcak paket servis yiyecek ve içecekler',
        'Şekerleme, dondurma, meşrubatlar',
        'Araç kiralama veya satışı',
        'Eğlence mekanlarına giriş',
        'Elektrikli ve gazlı ev aletleri',
        'Giyim ve ayakkabı (çocuk giyimi hariç)',
        'Restoran yemekleri'
      ]
    },
    validFrom: '2011-01-04',
    validTo: null,
    isActive: true
  },
  {
    id: 'reduced',
    code: 'R',
    rate: 5,
    name: {
      en: 'Reduced Rate',
      tr: 'İndirimli Oran'
    },
    description: {
      en: 'The reduced VAT rate applies to specific goods and services as determined by UK legislation.',
      tr: 'İndirimli KDV oranı, İngiltere mevzuatı tarafından belirlenen belirli mal ve hizmetlere uygulanır.'
    },
    examples: {
      en: [
        'Domestic fuel and power (electricity, gas, heating oil)',
        'Installation of energy-saving materials',
        'Women\'s sanitary products',
        'Children\'s car seats',
        'Smoking cessation products',
        'Contraceptive products',
        'Mobility aids for the elderly',
        'Residential property renovations (empty for 2+ years)',
        'Converting residential property',
        'Installing energy-saving insulation'
      ],
      tr: [
        'Ev yakıtı ve enerjisi (elektrik, gaz, ısıtma yağı)',
        'Enerji tasarruflu malzemelerin montajı',
        'Kadın hijyen ürünleri',
        'Çocuk araba koltukları',
        'Sigara bırakma ürünleri',
        'Doğum kontrol ürünleri',
        'Yaşlılar için hareket yardımcıları',
        'Konut mülk renovasyonları (2+ yıl boş)',
        'Konut mülkünün dönüştürülmesi',
        'Enerji tasarruflu yalıtım montajı'
      ]
    },
    validFrom: '1997-09-01',
    validTo: null,
    isActive: true
  },
  {
    id: 'zero',
    code: 'Z',
    rate: 0,
    name: {
      en: 'Zero Rate',
      tr: 'Sıfır Oran'
    },
    description: {
      en: 'Zero-rated items are still VAT taxable but at 0%. Businesses can reclaim VAT on related purchases. This differs from exempt items.',
      tr: 'Sıfır oranlı ürünler hala KDV\'ye tabidir ancak %0 oranında. İşletmeler ilgili alımlardan KDV iadesi alabilir. Bu, muaf ürünlerden farklıdır.'
    },
    examples: {
      en: [
        'Most food (not catering, hot takeaways)',
        'Books, newspapers, magazines',
        'Children\'s clothing and footwear',
        'Public transport (bus, train, metro)',
        'Prescription medicines and medical equipment',
        'Exports of goods to non-EU countries',
        'New residential construction (first sale)',
        'Charitable donations of goods',
        'Equipment for disabled people',
        'Water and sewerage services (household)'
      ],
      tr: [
        'Çoğu gıda (catering ve sıcak paket servis hariç)',
        'Kitaplar, gazeteler, dergiler',
        'Çocuk giyim ve ayakkabıları',
        'Toplu taşıma (otobüs, tren, metro)',
        'Reçeteli ilaçlar ve tıbbi ekipman',
        'AB dışı ülkelere mal ihracatı',
        'Yeni konut inşaatı (ilk satış)',
        'Hayır amaçlı mal bağışları',
        'Engelli kişiler için ekipman',
        'Su ve kanalizasyon hizmetleri (ev)'
      ]
    },
    validFrom: '1973-04-01',
    validTo: null,
    isActive: true
  },
  {
    id: 'exempt',
    code: 'E',
    rate: 0,
    name: {
      en: 'Exempt',
      tr: 'Muaf'
    },
    description: {
      en: 'Exempt supplies are not subject to VAT and businesses cannot reclaim VAT on related purchases. This differs from zero-rated items.',
      tr: 'Muaf tedarikler KDV\'ye tabi değildir ve işletmeler ilgili alımlardan KDV iadesi alamaz. Bu, sıfır oranlı ürünlerden farklıdır.'
    },
    examples: {
      en: [
        'Insurance services',
        'Financial services (banking, loans)',
        'Education and training (by eligible bodies)',
        'Health services by registered practitioners',
        'Postal services by Royal Mail',
        'Betting, gaming, and lotteries',
        'Subscriptions to trade unions and professional bodies',
        'Funeral services',
        'Rent on residential property',
        'Sale of land and buildings (with exceptions)'
      ],
      tr: [
        'Sigorta hizmetleri',
        'Finansal hizmetler (bankacılık, krediler)',
        'Eğitim ve öğretim (yetkili kurumlarca)',
        'Kayıtlı sağlık profesyonellerinin sağlık hizmetleri',
        'Royal Mail tarafından posta hizmetleri',
        'Bahis, oyun ve piyangolar',
        'Sendika ve meslek kuruluşlarına üyelik',
        'Cenaze hizmetleri',
        'Konut mülk kirası',
        'Arazi ve bina satışı (istisnalarla)'
      ]
    },
    validFrom: '1973-04-01',
    validTo: null,
    isActive: true
  },
  {
    id: 'outside-scope',
    code: 'O',
    rate: null,
    name: {
      en: 'Outside the Scope',
      tr: 'Kapsam Dışı'
    },
    description: {
      en: 'Some transactions are outside the scope of UK VAT. These are neither taxable nor exempt - they simply fall outside the VAT system.',
      tr: 'Bazı işlemler İngiltere KDV\'sinin kapsamı dışındadır. Bunlar ne vergiye tabi ne de muaftır - sadece KDV sistemi dışında kalırlar.'
    },
    examples: {
      en: [
        'Wages and salaries',
        'Dividends and interest payments',
        'Statutory fees (e.g., MOT, congestion charge)',
        'Donations with no goods/services in return',
        'Out-of-scope services to overseas customers',
        'Insurance claim payments',
        'Intra-group transfers',
        'Non-business activities',
        'Hobby income (below VAT threshold)',
        'Government grants (with no supply attached)'
      ],
      tr: [
        'Ücretler ve maaşlar',
        'Temettüler ve faiz ödemeleri',
        'Yasal ücretler (örn., MOT, trafik sıkışıklık ücreti)',
        'Karşılığında mal/hizmet olmayan bağışlar',
        'Yurtdışı müşterilere kapsam dışı hizmetler',
        'Sigorta tazminat ödemeleri',
        'Grup içi transferler',
        'Ticari olmayan faaliyetler',
        'Hobi geliri (KDV eşiğinin altında)',
        'Devlet hibeleri (tedarik eklenmemiş)'
      ]
    },
    validFrom: null,
    validTo: null,
    isActive: true
  }
];

/**
 * VAT Rate Thresholds and Important Figures
 * Updated for 2025/2026 tax year
 */
const vatThresholds = {
  registrationThreshold: {
    amount: 90000,
    currency: 'GBP',
    description: {
      en: 'You must register for VAT if your taxable turnover exceeds this threshold in a 12-month period.',
      tr: 'Vergiye tabi cironuz 12 aylık dönemde bu eşiği aşarsa KDV\'ye kayıt yaptırmanız gerekir.'
    },
    effectiveFrom: '2024-04-01'
  },
  deregistrationThreshold: {
    amount: 88000,
    currency: 'GBP',
    description: {
      en: 'You may deregister from VAT if your taxable turnover falls below this threshold.',
      tr: 'Vergiye tabi cironuz bu eşiğin altına düşerse KDV kaydınızı silebilirsiniz.'
    },
    effectiveFrom: '2024-04-01'
  },
  flatRateScheme: {
    description: {
      en: 'A simplified VAT scheme for small businesses with turnover up to £150,000.',
      tr: 'Cirosu 150.000 £\'a kadar olan küçük işletmeler için basitleştirilmiş KDV planı.'
    },
    turnoverLimit: 150000,
    eligibilityLimit: 150000,
    currency: 'GBP'
  }
};

/**
 * Get all VAT rates
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {Array} Array of VAT rate objects
 */
function getAllVatRates(language = 'en') {
  const validLanguages = ['en', 'tr'];
  const lang = validLanguages.includes(language) ? language : 'en';
  
  return vatRates.map(rate => ({
    id: rate.id,
    code: rate.code,
    rate: rate.rate,
    name: rate.name[lang],
    description: rate.description[lang],
    examples: rate.examples[lang],
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    isActive: rate.isActive
  }));
}

/**
 * Get all VAT rates with all languages
 * @returns {Array} Array of VAT rate objects with all language data
 */
function getAllVatRatesMultilingual() {
  return vatRates;
}

/**
 * Get a specific VAT rate by ID
 * @param {string} id - The VAT rate ID
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {Object|null} VAT rate object or null if not found
 */
function getVatRateById(id, language = 'en') {
  const validLanguages = ['en', 'tr'];
  const lang = validLanguages.includes(language) ? language : 'en';
  
  const rate = vatRates.find(r => r.id === id);
  if (!rate) return null;
  
  return {
    id: rate.id,
    code: rate.code,
    rate: rate.rate,
    name: rate.name[lang],
    description: rate.description[lang],
    examples: rate.examples[lang],
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    isActive: rate.isActive
  };
}

/**
 * Get a specific VAT rate by code
 * @param {string} code - The VAT rate code (S, R, Z, E, O)
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {Object|null} VAT rate object or null if not found
 */
function getVatRateByCode(code, language = 'en') {
  const validLanguages = ['en', 'tr'];
  const lang = validLanguages.includes(language) ? language : 'en';
  
  const rate = vatRates.find(r => r.code === code.toUpperCase());
  if (!rate) return null;
  
  return {
    id: rate.id,
    code: rate.code,
    rate: rate.rate,
    name: rate.name[lang],
    description: rate.description[lang],
    examples: rate.examples[lang],
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    isActive: rate.isActive
  };
}

/**
 * Get only active VAT rates
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {Array} Array of active VAT rate objects
 */
function getActiveVatRates(language = 'en') {
  return getAllVatRates(language).filter(rate => rate.isActive);
}

/**
 * Get VAT thresholds
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {Object} VAT thresholds object
 */
function getVatThresholds(language = 'en') {
  const validLanguages = ['en', 'tr'];
  const lang = validLanguages.includes(language) ? language : 'en';
  
  return {
    registrationThreshold: {
      amount: vatThresholds.registrationThreshold.amount,
      currency: vatThresholds.registrationThreshold.currency,
      description: vatThresholds.registrationThreshold.description[lang],
      effectiveFrom: vatThresholds.registrationThreshold.effectiveFrom
    },
    deregistrationThreshold: {
      amount: vatThresholds.deregistrationThreshold.amount,
      currency: vatThresholds.deregistrationThreshold.currency,
      description: vatThresholds.deregistrationThreshold.description[lang],
      effectiveFrom: vatThresholds.deregistrationThreshold.effectiveFrom
    },
    flatRateScheme: {
      description: vatThresholds.flatRateScheme.description[lang],
      turnoverLimit: vatThresholds.flatRateScheme.turnoverLimit,
      eligibilityLimit: vatThresholds.flatRateScheme.eligibilityLimit,
      currency: vatThresholds.flatRateScheme.currency
    }
  };
}

/**
 * Search VAT rates by example keyword
 * @param {string} keyword - Search keyword
 * @param {string} language - Language code ('en' or 'tr')
 * @returns {Array} Array of matching VAT rates with matched examples
 */
function searchVatRatesByExample(keyword, language = 'en') {
  const validLanguages = ['en', 'tr'];
  const lang = validLanguages.includes(language) ? language : 'en';
  const searchTerm = keyword.toLowerCase();
  
  const results = [];
  
  vatRates.forEach(rate => {
    const matchingExamples = rate.examples[lang].filter(example => 
      example.toLowerCase().includes(searchTerm)
    );
    
    if (matchingExamples.length > 0) {
      results.push({
        id: rate.id,
        code: rate.code,
        rate: rate.rate,
        name: rate.name[lang],
        description: rate.description[lang],
        matchingExamples,
        isActive: rate.isActive
      });
    }
  });
  
  return results;
}

/**
 * Supported languages
 */
const supportedLanguages = ['en', 'tr'];

module.exports = {
  vatRates,
  vatThresholds,
  getAllVatRates,
  getAllVatRatesMultilingual,
  getVatRateById,
  getVatRateByCode,
  getActiveVatRates,
  getVatThresholds,
  searchVatRatesByExample,
  supportedLanguages
};
