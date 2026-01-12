/**
 * Unit Tests for Localization Middleware
 * Tests language detection, request helpers, and category localization.
 */

const { 
  localization,
  getRequestLanguage,
  createLocalizedError,
  createLocalizedSuccess,
  localizeCategory,
  localizeCategories,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} = require('../../middleware/localization');

// Mock Express request/response
const mockRequest = (options = {}) => ({
  query: options.query || {},
  headers: options.headers || {},
  user: options.user || null
});

const mockResponse = () => {
  const res = {};
  res.setHeader = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Localization Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('localization()', () => {
    it('should set default language when no preference specified', () => {
      const middleware = localization();
      const req = mockRequest();
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('en');
      expect(req.localeSource).toBe('default');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect language from query parameter', () => {
      const middleware = localization();
      const req = mockRequest({ query: { lang: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('tr');
      expect(req.localeSource).toBe('query');
    });

    it('should detect language from Accept-Language header', () => {
      const middleware = localization();
      const req = mockRequest({ headers: { 'accept-language': 'tr-TR,tr;q=0.9' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('tr');
      expect(req.localeSource).toBe('header');
    });

    it('should detect language from user preference', () => {
      const middleware = localization();
      const req = mockRequest({ user: { preferredLanguage: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('tr');
      expect(req.localeSource).toBe('user');
    });

    it('should prioritize query param over user preference', () => {
      const middleware = localization();
      const req = mockRequest({ 
        query: { lang: 'en' },
        user: { preferredLanguage: 'tr' }
      });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('en');
      expect(req.localeSource).toBe('query');
    });

    it('should prioritize query param over Accept-Language header', () => {
      const middleware = localization();
      const req = mockRequest({ 
        query: { lang: 'en' },
        headers: { 'accept-language': 'tr-TR' }
      });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('en');
      expect(req.localeSource).toBe('query');
    });

    it('should prioritize user preference over Accept-Language header', () => {
      const middleware = localization();
      const req = mockRequest({ 
        user: { preferredLanguage: 'tr' },
        headers: { 'accept-language': 'en-US' }
      });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('tr');
      expect(req.localeSource).toBe('user');
    });

    it('should set Content-Language header by default', () => {
      const middleware = localization();
      const req = mockRequest({ query: { lang: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(res.setHeader).toHaveBeenCalledWith('Content-Language', 'tr');
    });

    it('should skip Content-Language header when setHeader is false', () => {
      const middleware = localization({ setHeader: false });
      const req = mockRequest({ query: { lang: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should attach t() function to request', () => {
      const middleware = localization();
      const req = mockRequest({ query: { lang: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(typeof req.t).toBe('function');
      expect(req.t('common.success')).toBe('İşlem başarılı');
    });

    it('should attach tBilingual() function to request', () => {
      const middleware = localization();
      const req = mockRequest();
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(typeof req.tBilingual).toBe('function');
      const result = req.tBilingual('common.success');
      expect(result).toHaveProperty('en');
      expect(result).toHaveProperty('tr');
    });

    it('should attach getCategoryName() function to request', () => {
      const middleware = localization();
      const req = mockRequest({ query: { lang: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(typeof req.getCategoryName).toBe('function');
      // getCategoryName uses translation files, returns null for codes not in translations
      expect(req.getCategoryName('1000')).toBe('Nakit');
    });

    it('should attach getCategoryTypeLabel() function to request', () => {
      const middleware = localization();
      const req = mockRequest({ query: { lang: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(typeof req.getCategoryTypeLabel).toBe('function');
      expect(req.getCategoryTypeLabel('asset')).toBe('Varlık');
    });

    it('should use custom query parameter name', () => {
      const middleware = localization({ queryParam: 'language' });
      const req = mockRequest({ query: { language: 'tr' } });
      const res = mockResponse();
      
      middleware(req, res, mockNext);
      
      expect(req.locale).toBe('tr');
    });
  });

  describe('getRequestLanguage()', () => {
    it('should return locale if already set', () => {
      const req = { locale: 'tr' };
      expect(getRequestLanguage(req)).toBe('tr');
    });

    it('should detect from query param', () => {
      const req = mockRequest({ query: { lang: 'tr' } });
      expect(getRequestLanguage(req)).toBe('tr');
    });

    it('should detect from user preference', () => {
      const req = mockRequest({ user: { preferredLanguage: 'tr' } });
      expect(getRequestLanguage(req)).toBe('tr');
    });

    it('should detect from Accept-Language header', () => {
      const req = mockRequest({ headers: { 'accept-language': 'tr-TR' } });
      expect(getRequestLanguage(req)).toBe('tr');
    });

    it('should return default for no preference', () => {
      const req = mockRequest();
      expect(getRequestLanguage(req)).toBe('en');
    });
  });

  describe('createLocalizedError()', () => {
    it('should create error response with bilingual message', () => {
      const result = createLocalizedError('common.notFound');
      
      expect(result.success).toBe(false);
      expect(result.error.message).toHaveProperty('en');
      expect(result.error.message).toHaveProperty('tr');
    });

    it('should include error code when provided', () => {
      const result = createLocalizedError('common.notFound', {}, 'RES_NOT_FOUND');
      
      expect(result.error.code).toBe('RES_NOT_FOUND');
    });

    it('should interpolate parameters', () => {
      const result = createLocalizedError('category.codeNotFound', { code: 'ABC' });
      
      expect(result.error.message.en).toContain('ABC');
      expect(result.error.message.tr).toContain('ABC');
    });
  });

  describe('createLocalizedSuccess()', () => {
    it('should create success response with bilingual message', () => {
      const result = createLocalizedSuccess('common.success');
      
      expect(result.success).toBe(true);
      expect(result.message).toHaveProperty('en');
      expect(result.message).toHaveProperty('tr');
    });

    it('should include data when provided', () => {
      const data = { id: 1, name: 'Test' };
      const result = createLocalizedSuccess('common.success', data);
      
      expect(result.data).toEqual(data);
    });
  });

  describe('localizeCategory()', () => {
    const mockCategory = {
      id: 1,
      code: '1000',
      name: 'Assets',
      nameTr: 'Varlıklar',
      type: 'asset'
    };

    it('should localize category name to English', () => {
      const result = localizeCategory(mockCategory, 'en');
      expect(result.name).toBe('Assets');
    });

    it('should localize category name to Turkish', () => {
      const result = localizeCategory(mockCategory, 'tr');
      expect(result.name).toBe('Varlıklar');
    });

    it('should include both nameEn and nameTr when includeAllNames is true', () => {
      const result = localizeCategory(mockCategory, 'en', true);
      expect(result.nameEn).toBe('Assets');
      expect(result.nameTr).toBe('Varlıklar');
    });

    it('should handle null category', () => {
      expect(localizeCategory(null)).toBe(null);
    });

    it('should fallback to name for Turkish if nameTr not available', () => {
      const category = {
        id: 999,
        code: '9999',
        name: 'Custom Category'
      };
      const result = localizeCategory(category, 'tr');
      expect(result.name).toBe('Custom Category');
    });
  });

  describe('localizeCategories()', () => {
    const mockCategories = [
      { id: 1, code: '1000', name: 'Assets', nameTr: 'Varlıklar' },
      { id: 2, code: '4000', name: 'Sales Revenue', nameTr: 'Satış Geliri' }
    ];

    it('should localize array of categories', () => {
      const result = localizeCategories(mockCategories, 'tr');
      expect(result[0].name).toBe('Varlıklar');
      expect(result[1].name).toBe('Satış Geliri');
    });

    it('should handle empty array', () => {
      expect(localizeCategories([], 'en')).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(localizeCategories(null, 'en')).toBe(null);
      expect(localizeCategories(undefined, 'en')).toBe(undefined);
    });
  });

  describe('Constants', () => {
    it('should export SUPPORTED_LANGUAGES', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('tr');
    });

    it('should export DEFAULT_LANGUAGE', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });
  });
});
