/**
 * Unit Tests for Pagination Utility
 */

const {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  parsePaginationParams,
  parseSortParams,
  createPaginationResult,
  buildPaginationMeta,
  buildLimitOffsetClause,
  buildOrderByClause
} = require('../utils/pagination');

describe('Pagination Utility', () => {
  describe('Constants', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PAGE).toBe(1);
      expect(DEFAULT_LIMIT).toBe(20);
      expect(MAX_LIMIT).toBe(100);
      expect(MIN_LIMIT).toBe(1);
    });
  });

  describe('parsePaginationParams', () => {
    it('should return default values for empty query', () => {
      const result = parsePaginationParams({});
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should parse valid page and limit values', () => {
      const result = parsePaginationParams({ page: '3', limit: '25' });
      
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50); // (3-1) * 25
    });

    it('should use default for invalid page values', () => {
      expect(parsePaginationParams({ page: '0' }).page).toBe(1);
      expect(parsePaginationParams({ page: '-1' }).page).toBe(1);
      expect(parsePaginationParams({ page: 'abc' }).page).toBe(1);
      expect(parsePaginationParams({ page: '' }).page).toBe(1);
    });

    it('should use default for invalid limit values', () => {
      expect(parsePaginationParams({ limit: '0' }).limit).toBe(20);
      expect(parsePaginationParams({ limit: '-5' }).limit).toBe(20);
      expect(parsePaginationParams({ limit: 'xyz' }).limit).toBe(20);
    });

    it('should cap limit at maxLimit', () => {
      const result = parsePaginationParams({ limit: '200' });
      expect(result.limit).toBe(100);
    });

    it('should use custom default limit from options', () => {
      const result = parsePaginationParams({}, { defaultLimit: 50 });
      expect(result.limit).toBe(50);
    });

    it('should use custom max limit from options', () => {
      const result = parsePaginationParams({ limit: '500' }, { maxLimit: 200 });
      expect(result.limit).toBe(200);
    });

    it('should calculate correct offset', () => {
      expect(parsePaginationParams({ page: '1', limit: '10' }).offset).toBe(0);
      expect(parsePaginationParams({ page: '2', limit: '10' }).offset).toBe(10);
      expect(parsePaginationParams({ page: '5', limit: '20' }).offset).toBe(80);
    });
  });

  describe('parseSortParams', () => {
    const validFields = ['createdAt', 'amount', 'name', 'status'];

    it('should return default values when no sort params provided', () => {
      const result = parseSortParams({}, { validFields });
      
      expect(result.sortBy).toBe('createdAt'); // First valid field
      expect(result.sortOrder).toBe('DESC');
    });

    it('should parse valid sort parameters', () => {
      const result = parseSortParams(
        { sortBy: 'amount', sortOrder: 'ASC' },
        { validFields }
      );
      
      expect(result.sortBy).toBe('amount');
      expect(result.sortOrder).toBe('ASC');
    });

    it('should use default field for invalid sortBy', () => {
      const result = parseSortParams(
        { sortBy: 'invalidField' },
        { validFields, defaultField: 'name' }
      );
      
      expect(result.sortBy).toBe('name');
    });

    it('should normalize sortOrder to uppercase', () => {
      const result = parseSortParams(
        { sortOrder: 'asc' },
        { validFields }
      );
      
      expect(result.sortOrder).toBe('ASC');
    });

    it('should use default order for invalid sortOrder', () => {
      const result = parseSortParams(
        { sortOrder: 'invalid' },
        { validFields }
      );
      
      expect(result.sortOrder).toBe('DESC');
    });

    it('should use custom default order from options', () => {
      const result = parseSortParams({}, { validFields, defaultOrder: 'ASC' });
      
      expect(result.sortOrder).toBe('ASC');
    });

    it('should prevent SQL injection by validating sortBy', () => {
      const result = parseSortParams(
        { sortBy: 'name; DROP TABLE users;--' },
        { validFields }
      );
      
      expect(result.sortBy).toBe('createdAt'); // Falls back to default
    });
  });

  describe('createPaginationResult', () => {
    it('should create correct pagination result', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = createPaginationResult(data, 50, { page: 2, limit: 10 });
      
      expect(result.data).toEqual(data);
      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
    });

    it('should handle first page', () => {
      const result = createPaginationResult([], 100, { page: 1, limit: 10 });
      
      expect(result.hasPrevPage).toBe(false);
      expect(result.hasNextPage).toBe(true);
    });

    it('should handle last page', () => {
      const result = createPaginationResult([], 100, { page: 10, limit: 10 });
      
      expect(result.hasPrevPage).toBe(true);
      expect(result.hasNextPage).toBe(false);
    });

    it('should handle single page', () => {
      const result = createPaginationResult([], 5, { page: 1, limit: 10 });
      
      expect(result.totalPages).toBe(1);
      expect(result.hasPrevPage).toBe(false);
      expect(result.hasNextPage).toBe(false);
    });

    it('should handle empty results', () => {
      const result = createPaginationResult([], 0, { page: 1, limit: 10 });
      
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });
  });

  describe('buildPaginationMeta', () => {
    it('should build correct metadata', () => {
      const result = buildPaginationMeta(100, { page: 3, limit: 10 });
      
      expect(result.total).toBe(100);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
    });
  });

  describe('buildLimitOffsetClause', () => {
    it('should build correct SQL clause', () => {
      const result = buildLimitOffsetClause({ limit: 20, offset: 40 });
      
      expect(result).toBe('LIMIT 20 OFFSET 40');
    });

    it('should handle zero offset', () => {
      const result = buildLimitOffsetClause({ limit: 10, offset: 0 });
      
      expect(result).toBe('LIMIT 10 OFFSET 0');
    });
  });

  describe('buildOrderByClause', () => {
    it('should build correct SQL clause for DESC', () => {
      const result = buildOrderByClause({ sortBy: 'createdAt', sortOrder: 'DESC' });
      
      expect(result).toBe('ORDER BY createdAt DESC');
    });

    it('should build correct SQL clause for ASC', () => {
      const result = buildOrderByClause({ sortBy: 'amount', sortOrder: 'ASC' });
      
      expect(result).toBe('ORDER BY amount ASC');
    });
  });
});
