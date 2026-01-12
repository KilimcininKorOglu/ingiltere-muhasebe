/**
 * Category Controller
 * Handles HTTP requests for category (chart of accounts) data.
 * Categories are system-defined and read-only.
 * 
 * @module controllers/categoryController
 */

const { 
  getAllCategories,
  findById,
  findByCode,
  getByType,
  getTopLevelCategories,
  getCategoryTree,
  searchCategories,
  getTypeCounts,
  CATEGORY_TYPES
} = require('../database/models/Category');
const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');
const { localizeCategory, localizeCategories, getRequestLanguage } = require('../middleware/localization');
const { t, tBilingual, getCategoryTypeLabel } = require('../utils/i18n');

/**
 * Gets all categories with optional filtering and pagination.
 * GET /api/categories
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.type] - Filter by category type (asset, liability, equity, income, expense)
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=100] - Items per page
 * @param {boolean} [req.query.activeOnly=true] - Only return active categories
 * @param {string} [req.query.sortBy=displayOrder] - Sort field
 * @param {string} [req.query.sortOrder=ASC] - Sort order (ASC, DESC)
 * @param {Object} res - Express response object
 */
async function list(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    
    const {
      type,
      page = 1,
      limit = 100,
      activeOnly = 'true',
      sortBy = 'displayOrder',
      sortOrder = 'ASC'
    } = req.query;

    // Validate type filter if provided
    if (type && !CATEGORY_TYPES.includes(type)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: tBilingual('category.invalidType', { types: CATEGORY_TYPES.join(', ') })
        }
      });
    }

    const result = getAllCategories({
      type,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      activeOnly: activeOnly === 'true',
      sortBy,
      sortOrder
    });

    // Localize categories
    const localizedCategories = localizeCategories(result.categories, lang, multilingual);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...result,
        categories: localizedCategories
      },
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('List categories error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets a category by ID.
 * GET /api/categories/:id
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Category ID
 * @param {Object} res - Express response object
 */
async function getById(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    const { id } = req.params;

    const category = findById(parseInt(id, 10));

    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: tBilingual('category.notFound')
        }
      });
    }

    // Sanitize booleans and localize
    const sanitizedCategory = {
      ...category,
      isSystem: Boolean(category.isSystem),
      isActive: Boolean(category.isActive),
      vatApplicable: Boolean(category.vatApplicable)
    };

    const localizedCategory = localizeCategory(sanitizedCategory, lang, multilingual);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: localizedCategory,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get category by ID error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets a category by code.
 * GET /api/categories/code/:code
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.code - Category code
 * @param {Object} res - Express response object
 */
async function getByCode(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    const { code } = req.params;

    const category = findByCode(code);

    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'RES_NOT_FOUND',
          message: tBilingual('category.codeNotFound', { code })
        }
      });
    }

    // Sanitize booleans and localize
    const sanitizedCategory = {
      ...category,
      isSystem: Boolean(category.isSystem),
      isActive: Boolean(category.isActive),
      vatApplicable: Boolean(category.vatApplicable)
    };

    const localizedCategory = localizeCategory(sanitizedCategory, lang, multilingual);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: localizedCategory,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get category by code error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets categories by type.
 * GET /api/categories/type/:type
 * 
 * @param {Object} req - Express request object
 * @param {string} req.params.type - Category type
 * @param {Object} res - Express response object
 */
async function listByType(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    const { type } = req.params;
    const { activeOnly = 'true' } = req.query;

    if (!CATEGORY_TYPES.includes(type)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: tBilingual('category.invalidType', { types: CATEGORY_TYPES.join(', ') })
        }
      });
    }

    const categories = getByType(type, activeOnly === 'true');
    const localizedCategories = localizeCategories(categories, lang, multilingual);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: localizedCategories,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: localizedCategories.length
      }
    });

  } catch (error) {
    console.error('Get categories by type error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets the category tree (hierarchical structure).
 * GET /api/categories/tree
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTree(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    const { activeOnly = 'true' } = req.query;

    const tree = getCategoryTree(activeOnly === 'true');
    
    // Recursively localize tree
    function localizeTreeNode(node) {
      const localized = localizeCategory(node, lang, multilingual);
      if (localized.children && Array.isArray(localized.children)) {
        localized.children = localized.children.map(localizeTreeNode);
      }
      return localized;
    }
    
    const localizedTree = tree.map(localizeTreeNode);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: localizedTree,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get category tree error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets top-level categories (no parent).
 * GET /api/categories/top-level
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTopLevel(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    const { activeOnly = 'true' } = req.query;

    const categories = getTopLevelCategories(activeOnly === 'true');
    const localizedCategories = localizeCategories(categories, lang, multilingual);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: localizedCategories,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        count: localizedCategories.length
      }
    });

  } catch (error) {
    console.error('Get top-level categories error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Searches categories by name, code, or description.
 * GET /api/categories/search
 * 
 * @param {Object} req - Express request object
 * @param {string} req.query.q - Search query
 * @param {Object} res - Express response object
 */
async function search(req, res) {
  try {
    const lang = getRequestLanguage(req);
    const multilingual = req.query.multilingual === 'true';
    const { q, activeOnly = 'true' } = req.query;

    if (!q || !q.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: tBilingual('category.searchRequired')
        }
      });
    }

    const categories = searchCategories(q.trim(), activeOnly === 'true');
    const localizedCategories = localizeCategories(categories, lang, multilingual);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: localizedCategories,
      meta: {
        language: lang,
        timestamp: new Date().toISOString(),
        searchTerm: q.trim(),
        count: localizedCategories.length
      }
    });

  } catch (error) {
    console.error('Search categories error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets category counts by type.
 * GET /api/categories/stats
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getStats(req, res) {
  try {
    const lang = getRequestLanguage(req);

    const counts = getTypeCounts();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get category stats error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

/**
 * Gets valid category types.
 * GET /api/categories/types
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTypes(req, res) {
  try {
    const lang = getRequestLanguage(req);

    const typesWithLabels = CATEGORY_TYPES.map(type => ({
      value: type,
      label: {
        en: getCategoryTypeLabel(type, 'en'),
        tr: getCategoryTypeLabel(type, 'tr')
      }
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: typesWithLabels,
      meta: {
        language: lang,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get category types error:', error);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.SYS_INTERNAL_ERROR.code,
        message: ERROR_CODES.SYS_INTERNAL_ERROR.message
      }
    });
  }
}

module.exports = {
  list,
  getById,
  getByCode,
  listByType,
  getTree,
  getTopLevel,
  search,
  getStats,
  getTypes
};
