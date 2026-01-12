/**
 * Pagination Utility
 * Provides reusable pagination helpers for API endpoints.
 * 
 * @module utils/pagination
 */

/**
 * Default pagination configuration.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

/**
 * Pagination parameters.
 * @typedef {Object} PaginationParams
 * @property {number} page - Current page number (1-indexed)
 * @property {number} limit - Number of items per page
 * @property {number} offset - Calculated offset for SQL queries
 */

/**
 * Pagination result.
 * @typedef {Object} PaginationResult
 * @template T
 * @property {T[]} data - Array of items for the current page
 * @property {number} total - Total number of items across all pages
 * @property {number} page - Current page number
 * @property {number} limit - Items per page
 * @property {number} totalPages - Total number of pages
 * @property {boolean} hasNextPage - Whether there's a next page
 * @property {boolean} hasPrevPage - Whether there's a previous page
 */

/**
 * Sort parameters.
 * @typedef {Object} SortParams
 * @property {string} sortBy - Field to sort by
 * @property {'ASC'|'DESC'} sortOrder - Sort direction
 */

/**
 * Parses and validates pagination parameters from query string.
 * 
 * @param {Object} query - Query parameters object
 * @param {string|number} [query.page] - Page number (1-indexed)
 * @param {string|number} [query.limit] - Items per page
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.defaultLimit=20] - Default limit if not specified
 * @param {number} [options.maxLimit=100] - Maximum allowed limit
 * @returns {PaginationParams} Validated pagination parameters
 */
function parsePaginationParams(query, options = {}) {
  const { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = options;

  // Parse and validate page
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  // Parse and validate limit
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < MIN_LIMIT) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parses and validates sort parameters from query string.
 * 
 * @param {Object} query - Query parameters object
 * @param {string} [query.sortBy] - Field to sort by
 * @param {string} [query.sortOrder] - Sort direction (ASC or DESC)
 * @param {Object} options - Sort configuration
 * @param {string[]} options.validFields - List of valid sort field names
 * @param {string} [options.defaultField] - Default sort field
 * @param {string} [options.defaultOrder='DESC'] - Default sort order
 * @returns {SortParams} Validated sort parameters
 */
function parseSortParams(query, options) {
  const { 
    validFields, 
    defaultField = validFields[0], 
    defaultOrder = 'DESC' 
  } = options;

  // Validate sortBy field to prevent SQL injection
  let sortBy = query.sortBy;
  if (!sortBy || !validFields.includes(sortBy)) {
    sortBy = defaultField;
  }

  // Validate sortOrder
  let sortOrder = query.sortOrder?.toUpperCase();
  if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
    sortOrder = defaultOrder;
  }

  return { sortBy, sortOrder };
}

/**
 * Creates a pagination result object from raw data.
 * 
 * @template T
 * @param {T[]} data - Array of items for current page
 * @param {number} total - Total number of items
 * @param {PaginationParams} params - Pagination parameters used
 * @returns {PaginationResult<T>} Formatted pagination result
 */
function createPaginationResult(data, total, params) {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}

/**
 * Builds pagination metadata for API responses.
 * 
 * @param {number} total - Total number of items
 * @param {PaginationParams} params - Pagination parameters
 * @returns {Object} Pagination metadata for response
 */
function buildPaginationMeta(total, params) {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}

/**
 * Builds SQL LIMIT and OFFSET clause string.
 * 
 * @param {PaginationParams} params - Pagination parameters
 * @returns {string} SQL LIMIT OFFSET clause
 */
function buildLimitOffsetClause(params) {
  return `LIMIT ${params.limit} OFFSET ${params.offset}`;
}

/**
 * Builds SQL ORDER BY clause string.
 * 
 * @param {SortParams} params - Sort parameters
 * @returns {string} SQL ORDER BY clause
 */
function buildOrderByClause(params) {
  return `ORDER BY ${params.sortBy} ${params.sortOrder}`;
}

module.exports = {
  // Constants
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  
  // Parser functions
  parsePaginationParams,
  parseSortParams,
  
  // Result builders
  createPaginationResult,
  buildPaginationMeta,
  
  // SQL helpers
  buildLimitOffsetClause,
  buildOrderByClause
};
