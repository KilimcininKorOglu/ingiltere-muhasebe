/**
 * Category Routes
 * API routes for UK chart of accounts categories.
 * Categories are system-defined and read-only.
 * All routes are prefixed with /api/categories
 * 
 * @module routes/categories
 */

const express = require('express');
const router = express.Router();

const {
  list,
  getById,
  getByCode,
  listByType,
  getTree,
  getTopLevel,
  search,
  getStats,
  getTypes
} = require('../controllers/categoryController');

const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/categories/types
 * @desc    Get valid category types with labels
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: [{ value: string, label: { en: string, tr: string } }] }
 */
router.get('/types', authenticate, getTypes);

/**
 * @route   GET /api/categories/stats
 * @desc    Get category counts by type
 * @header  Authorization: Bearer <token>
 * @access  Private
 * @returns { success: true, data: { asset: number, liability: number, equity: number, income: number, expense: number } }
 */
router.get('/stats', authenticate, getStats);

/**
 * @route   GET /api/categories/tree
 * @desc    Get category tree (hierarchical structure)
 * @header  Authorization: Bearer <token>
 * @query   activeOnly - Only return active categories (default: true)
 * @access  Private
 * @returns { success: true, data: CategoryTree[] }
 */
router.get('/tree', authenticate, getTree);

/**
 * @route   GET /api/categories/top-level
 * @desc    Get top-level categories (no parent)
 * @header  Authorization: Bearer <token>
 * @query   activeOnly - Only return active categories (default: true)
 * @access  Private
 * @returns { success: true, data: CategoryData[] }
 */
router.get('/top-level', authenticate, getTopLevel);

/**
 * @route   GET /api/categories/search
 * @desc    Search categories by name, code, or description
 * @header  Authorization: Bearer <token>
 * @query   q - Search query string (required)
 * @query   activeOnly - Only return active categories (default: true)
 * @access  Private
 * @returns { success: true, data: CategoryData[] }
 */
router.get('/search', authenticate, search);

/**
 * @route   GET /api/categories/type/:type
 * @desc    Get categories by type
 * @header  Authorization: Bearer <token>
 * @param   type - Category type (asset, liability, equity, income, expense)
 * @query   activeOnly - Only return active categories (default: true)
 * @access  Private
 * @returns { success: true, data: CategoryData[] }
 */
router.get('/type/:type', authenticate, listByType);

/**
 * @route   GET /api/categories/code/:code
 * @desc    Get a category by code
 * @header  Authorization: Bearer <token>
 * @param   code - Category code (e.g., 1000, 4100)
 * @access  Private
 * @returns { success: true, data: CategoryData }
 */
router.get('/code/:code', authenticate, getByCode);

/**
 * @route   GET /api/categories
 * @desc    List all categories with pagination and filtering
 * @header  Authorization: Bearer <token>
 * @query   type - Filter by category type
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 100)
 * @query   activeOnly - Only return active categories (default: true)
 * @query   sortBy - Sort field (code, name, type, displayOrder, createdAt)
 * @query   sortOrder - Sort order (ASC, DESC)
 * @access  Private
 * @returns { success: true, data: { categories: CategoryData[], total: number, page: number, limit: number } }
 */
router.get('/', authenticate, list);

/**
 * @route   GET /api/categories/:id
 * @desc    Get a category by ID
 * @header  Authorization: Bearer <token>
 * @param   id - Category ID
 * @access  Private
 * @returns { success: true, data: CategoryData }
 */
router.get('/:id', authenticate, getById);

module.exports = router;
