/**
 * Category model for UK chart of accounts management.
 * Provides CRUD operations and validation for category data.
 * 
 * @module models/Category
 */

const { query, queryOne, execute, transaction, openDatabase } = require('../index');
const { VALID_CATEGORY_TYPES } = require('../migrations/002_create_categories_table');

/**
 * Valid category type values.
 */
const CATEGORY_TYPES = VALID_CATEGORY_TYPES;

/**
 * Category field definitions with validation rules.
 * @typedef {Object} CategoryFieldDefinition
 * @property {string} type - Data type
 * @property {boolean} required - Whether field is required
 * @property {number} [maxLength] - Maximum length for string fields
 * @property {function} [validate] - Custom validation function
 */

/**
 * Category field definitions for validation.
 * @type {Object.<string, CategoryFieldDefinition>}
 */
const fieldDefinitions = {
  code: {
    type: 'string',
    required: true,
    maxLength: 20,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'code is required';
      }
      // Allow alphanumeric and dashes
      if (!/^[A-Za-z0-9\-]+$/.test(value.trim())) {
        return 'code can only contain letters, numbers, and dashes';
      }
      return null;
    }
  },
  name: {
    type: 'string',
    required: true,
    maxLength: 255,
    validate: (value) => {
      if (!value || value.trim().length < 2) {
        return 'name must be at least 2 characters long';
      }
      return null;
    }
  },
  nameTr: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  type: {
    type: 'string',
    required: true,
    validate: (value) => {
      if (!CATEGORY_TYPES.includes(value)) {
        return `Invalid type. Must be one of: ${CATEGORY_TYPES.join(', ')}`;
      }
      return null;
    }
  },
  parentId: {
    type: 'number',
    required: false,
    validate: (value) => {
      if (value !== null && value !== undefined && (!Number.isInteger(value) || value <= 0)) {
        return 'parentId must be a positive integer or null';
      }
      return null;
    }
  },
  isSystem: {
    type: 'boolean',
    required: false,
    default: false
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true
  },
  displayOrder: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && !Number.isInteger(value)) {
        return 'displayOrder must be an integer';
      }
      return null;
    }
  },
  vatApplicable: {
    type: 'boolean',
    required: false,
    default: false
  },
  defaultVatRate: {
    type: 'number',
    required: false,
    default: 0,
    validate: (value) => {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 10000)) {
        return 'defaultVatRate must be between 0 and 10000 (representing 0% to 100%)';
      }
      return null;
    }
  }
};

/**
 * Category data object
 * @typedef {Object} CategoryData
 * @property {number} [id] - Category ID (auto-generated)
 * @property {string} code - Unique category code
 * @property {string} name - Category name in English
 * @property {string} [nameTr] - Category name in Turkish
 * @property {string} [description] - Category description
 * @property {string} type - Category type (asset, liability, equity, income, expense)
 * @property {number} [parentId] - Parent category ID for hierarchy
 * @property {boolean} [isSystem] - Whether this is a system category
 * @property {boolean} [isActive] - Whether the category is active
 * @property {number} [displayOrder] - Display order
 * @property {boolean} [vatApplicable] - Whether VAT is applicable
 * @property {number} [defaultVatRate] - Default VAT rate in basis points
 * @property {string} [createdAt] - Creation timestamp
 * @property {string} [updatedAt] - Last update timestamp
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Object.<string, string>} errors - Field-specific error messages
 */

/**
 * Validates category data against field definitions.
 * 
 * @param {Partial<CategoryData>} categoryData - Category data to validate
 * @param {boolean} [isUpdate=false] - Whether this is an update operation
 * @returns {ValidationResult} Validation result
 */
function validateCategoryData(categoryData, isUpdate = false) {
  const errors = {};

  for (const [fieldName, definition] of Object.entries(fieldDefinitions)) {
    const value = categoryData[fieldName];

    // Check required fields (only for create operations or if field is provided)
    if (definition.required && !isUpdate) {
      if (value === undefined || value === null || value === '') {
        errors[fieldName] = `${fieldName} is required`;
        continue;
      }
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type validation
    if (definition.type === 'string' && typeof value !== 'string') {
      errors[fieldName] = `${fieldName} must be a string`;
      continue;
    }

    if (definition.type === 'number' && typeof value !== 'number') {
      errors[fieldName] = `${fieldName} must be a number`;
      continue;
    }

    if (definition.type === 'boolean' && typeof value !== 'boolean') {
      errors[fieldName] = `${fieldName} must be a boolean`;
      continue;
    }

    // Length validation
    if (definition.maxLength && typeof value === 'string' && value.length > definition.maxLength) {
      errors[fieldName] = `${fieldName} must not exceed ${definition.maxLength} characters`;
      continue;
    }

    // Custom validation
    if (definition.validate) {
      const validationError = definition.validate(value);
      if (validationError) {
        errors[fieldName] = validationError;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Sanitizes category data for output.
 * Converts SQLite integers to booleans where appropriate.
 * 
 * @param {CategoryData} category - Category data object
 * @returns {CategoryData} Sanitized category data
 */
function sanitizeCategory(category) {
  if (!category) return null;

  const sanitized = { ...category };
  
  // Convert SQLite integers to booleans
  if (sanitized.isSystem !== undefined) {
    sanitized.isSystem = Boolean(sanitized.isSystem);
  }
  if (sanitized.isActive !== undefined) {
    sanitized.isActive = Boolean(sanitized.isActive);
  }
  if (sanitized.vatApplicable !== undefined) {
    sanitized.vatApplicable = Boolean(sanitized.vatApplicable);
  }
  
  return sanitized;
}

/**
 * Creates a new category in the database.
 * 
 * @param {CategoryData} categoryData - Category data to create
 * @returns {{success: boolean, data?: CategoryData, errors?: Object.<string, string>}}
 */
function createCategory(categoryData) {
  // Validate input data
  const validation = validateCategoryData(categoryData, false);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if code already exists
  const existingCategory = findByCode(categoryData.code);
  if (existingCategory) {
    return { success: false, errors: { code: 'Category code already exists' } };
  }

  // Validate parent category exists if provided
  if (categoryData.parentId) {
    const parentCategory = findById(categoryData.parentId);
    if (!parentCategory) {
      return { success: false, errors: { parentId: 'Parent category not found' } };
    }
  }

  try {
    // Prepare the insert data
    const insertData = {
      code: categoryData.code.trim().toUpperCase(),
      name: categoryData.name.trim(),
      nameTr: categoryData.nameTr?.trim() || null,
      description: categoryData.description?.trim() || null,
      type: categoryData.type,
      parentId: categoryData.parentId || null,
      isSystem: categoryData.isSystem ? 1 : 0,
      isActive: categoryData.isActive !== false ? 1 : 0,
      displayOrder: categoryData.displayOrder || 0,
      vatApplicable: categoryData.vatApplicable ? 1 : 0,
      defaultVatRate: categoryData.defaultVatRate || 0
    };

    const result = execute(`
      INSERT INTO categories (
        code, name, nameTr, description, type,
        parentId, isSystem, isActive, displayOrder,
        vatApplicable, defaultVatRate
      ) VALUES (
        @code, @name, @nameTr, @description, @type,
        @parentId, @isSystem, @isActive, @displayOrder,
        @vatApplicable, @defaultVatRate
      )
    `, insertData);

    // Fetch the created category
    const createdCategory = findById(result.lastInsertRowid);
    return { success: true, data: sanitizeCategory(createdCategory) };

  } catch (error) {
    console.error('Error creating category:', error.message);
    return { success: false, errors: { general: 'Failed to create category' } };
  }
}

/**
 * Creates multiple categories in a transaction.
 * 
 * @param {CategoryData[]} categories - Array of category data to create
 * @returns {{success: boolean, created: number, errors: string[]}}
 */
function createManyCategories(categories) {
  const db = openDatabase();
  const results = {
    success: true,
    created: 0,
    errors: []
  };

  try {
    db.transaction(() => {
      for (const categoryData of categories) {
        const validation = validateCategoryData(categoryData, false);
        if (!validation.isValid) {
          results.errors.push(`Category ${categoryData.code}: ${Object.values(validation.errors).join(', ')}`);
          continue;
        }

        const insertData = {
          code: categoryData.code.trim().toUpperCase(),
          name: categoryData.name.trim(),
          nameTr: categoryData.nameTr?.trim() || null,
          description: categoryData.description?.trim() || null,
          type: categoryData.type,
          parentId: categoryData.parentId || null,
          isSystem: categoryData.isSystem ? 1 : 0,
          isActive: categoryData.isActive !== false ? 1 : 0,
          displayOrder: categoryData.displayOrder || 0,
          vatApplicable: categoryData.vatApplicable ? 1 : 0,
          defaultVatRate: categoryData.defaultVatRate || 0
        };

        db.prepare(`
          INSERT INTO categories (
            code, name, nameTr, description, type,
            parentId, isSystem, isActive, displayOrder,
            vatApplicable, defaultVatRate
          ) VALUES (
            @code, @name, @nameTr, @description, @type,
            @parentId, @isSystem, @isActive, @displayOrder,
            @vatApplicable, @defaultVatRate
          )
        `).run(insertData);

        results.created++;
      }
    })();
  } catch (error) {
    console.error('Error creating categories:', error.message);
    results.success = false;
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Finds a category by ID.
 * 
 * @param {number} id - Category ID
 * @returns {CategoryData|null} Category data or null if not found
 */
function findById(id) {
  const category = queryOne('SELECT * FROM categories WHERE id = ?', [id]);
  return category || null;
}

/**
 * Finds a category by code.
 * 
 * @param {string} code - Category code
 * @returns {CategoryData|null} Category data or null if not found
 */
function findByCode(code) {
  if (!code) return null;
  const category = queryOne(
    'SELECT * FROM categories WHERE code = ?',
    [code.trim().toUpperCase()]
  );
  return category || null;
}

/**
 * Gets all categories (paginated).
 * 
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=100] - Items per page
 * @param {string} [options.type] - Filter by type
 * @param {boolean} [options.activeOnly=false] - Only return active categories
 * @param {string} [options.sortBy='displayOrder'] - Sort field
 * @param {string} [options.sortOrder='ASC'] - Sort order
 * @returns {{categories: CategoryData[], total: number, page: number, limit: number}}
 */
function getAllCategories({ page = 1, limit = 100, type, activeOnly = false, sortBy = 'displayOrder', sortOrder = 'ASC' } = {}) {
  const offset = (page - 1) * limit;
  
  // Validate sortBy to prevent SQL injection
  const validSortFields = ['code', 'name', 'type', 'displayOrder', 'createdAt'];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'displayOrder';
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (type && CATEGORY_TYPES.includes(type)) {
    whereClause += ' AND type = ?';
    params.push(type);
  }
  
  if (activeOnly) {
    whereClause += ' AND isActive = 1';
  }
  
  const categories = query(
    `SELECT * FROM categories ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder}, code ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const totalResult = queryOne(
    `SELECT COUNT(*) as count FROM categories ${whereClause}`,
    params
  );
  const total = totalResult?.count || 0;

  return {
    categories: categories.map(sanitizeCategory),
    total,
    page,
    limit
  };
}

/**
 * Gets categories by type.
 * 
 * @param {string} type - Category type
 * @param {boolean} [activeOnly=true] - Only return active categories
 * @returns {CategoryData[]} Array of categories
 */
function getByType(type, activeOnly = true) {
  if (!CATEGORY_TYPES.includes(type)) {
    return [];
  }
  
  let sql = 'SELECT * FROM categories WHERE type = ?';
  const params = [type];
  
  if (activeOnly) {
    sql += ' AND isActive = 1';
  }
  
  sql += ' ORDER BY displayOrder ASC, code ASC';
  
  const categories = query(sql, params);
  return categories.map(sanitizeCategory);
}

/**
 * Gets child categories of a parent.
 * 
 * @param {number} parentId - Parent category ID
 * @param {boolean} [activeOnly=true] - Only return active categories
 * @returns {CategoryData[]} Array of child categories
 */
function getChildren(parentId, activeOnly = true) {
  let sql = 'SELECT * FROM categories WHERE parentId = ?';
  const params = [parentId];
  
  if (activeOnly) {
    sql += ' AND isActive = 1';
  }
  
  sql += ' ORDER BY displayOrder ASC, code ASC';
  
  const categories = query(sql, params);
  return categories.map(sanitizeCategory);
}

/**
 * Gets top-level categories (no parent).
 * 
 * @param {boolean} [activeOnly=true] - Only return active categories
 * @returns {CategoryData[]} Array of top-level categories
 */
function getTopLevelCategories(activeOnly = true) {
  let sql = 'SELECT * FROM categories WHERE parentId IS NULL';
  
  if (activeOnly) {
    sql += ' AND isActive = 1';
  }
  
  sql += ' ORDER BY type, displayOrder ASC, code ASC';
  
  const categories = query(sql);
  return categories.map(sanitizeCategory);
}

/**
 * Gets full category tree with children.
 * 
 * @param {boolean} [activeOnly=true] - Only return active categories
 * @returns {CategoryData[]} Array of categories with children property
 */
function getCategoryTree(activeOnly = true) {
  const allCategories = activeOnly
    ? query('SELECT * FROM categories WHERE isActive = 1 ORDER BY type, displayOrder ASC, code ASC')
    : query('SELECT * FROM categories ORDER BY type, displayOrder ASC, code ASC');
  
  const categoriesMap = new Map();
  const rootCategories = [];
  
  // First pass: create map and sanitize
  for (const cat of allCategories) {
    const sanitized = sanitizeCategory(cat);
    sanitized.children = [];
    categoriesMap.set(cat.id, sanitized);
  }
  
  // Second pass: build tree
  for (const cat of allCategories) {
    const sanitized = categoriesMap.get(cat.id);
    if (cat.parentId && categoriesMap.has(cat.parentId)) {
      categoriesMap.get(cat.parentId).children.push(sanitized);
    } else {
      rootCategories.push(sanitized);
    }
  }
  
  return rootCategories;
}

/**
 * Updates a category's data.
 * 
 * @param {number} id - Category ID
 * @param {Partial<CategoryData>} categoryData - Data to update
 * @returns {{success: boolean, data?: CategoryData, errors?: Object.<string, string>}}
 */
function updateCategory(id, categoryData) {
  // Validate input data
  const validation = validateCategoryData(categoryData, true);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  // Check if category exists
  const existingCategory = findById(id);
  if (!existingCategory) {
    return { success: false, errors: { general: 'Category not found' } };
  }

  // Prevent modification of system categories (except isActive)
  if (existingCategory.isSystem && Object.keys(categoryData).some(k => k !== 'isActive')) {
    return { success: false, errors: { general: 'System categories cannot be modified' } };
  }

  // Check if code is being changed and is already taken
  if (categoryData.code && 
      categoryData.code.trim().toUpperCase() !== existingCategory.code) {
    const codeCategory = findByCode(categoryData.code);
    if (codeCategory) {
      return { success: false, errors: { code: 'Category code already exists' } };
    }
  }

  // Validate parent category
  if (categoryData.parentId !== undefined) {
    if (categoryData.parentId === id) {
      return { success: false, errors: { parentId: 'Category cannot be its own parent' } };
    }
    if (categoryData.parentId) {
      const parentCategory = findById(categoryData.parentId);
      if (!parentCategory) {
        return { success: false, errors: { parentId: 'Parent category not found' } };
      }
    }
  }

  try {
    // Build update fields dynamically
    const updateFields = [];
    const updateParams = { id };

    if (categoryData.code !== undefined) {
      updateFields.push('code = @code');
      updateParams.code = categoryData.code.trim().toUpperCase();
    }

    if (categoryData.name !== undefined) {
      updateFields.push('name = @name');
      updateParams.name = categoryData.name.trim();
    }

    if (categoryData.nameTr !== undefined) {
      updateFields.push('nameTr = @nameTr');
      updateParams.nameTr = categoryData.nameTr?.trim() || null;
    }

    if (categoryData.description !== undefined) {
      updateFields.push('description = @description');
      updateParams.description = categoryData.description?.trim() || null;
    }

    if (categoryData.type !== undefined) {
      updateFields.push('type = @type');
      updateParams.type = categoryData.type;
    }

    if (categoryData.parentId !== undefined) {
      updateFields.push('parentId = @parentId');
      updateParams.parentId = categoryData.parentId || null;
    }

    if (categoryData.isActive !== undefined) {
      updateFields.push('isActive = @isActive');
      updateParams.isActive = categoryData.isActive ? 1 : 0;
    }

    if (categoryData.displayOrder !== undefined) {
      updateFields.push('displayOrder = @displayOrder');
      updateParams.displayOrder = categoryData.displayOrder;
    }

    if (categoryData.vatApplicable !== undefined) {
      updateFields.push('vatApplicable = @vatApplicable');
      updateParams.vatApplicable = categoryData.vatApplicable ? 1 : 0;
    }

    if (categoryData.defaultVatRate !== undefined) {
      updateFields.push('defaultVatRate = @defaultVatRate');
      updateParams.defaultVatRate = categoryData.defaultVatRate;
    }

    // Always update the updatedAt timestamp
    updateFields.push("updatedAt = datetime('now')");

    if (updateFields.length === 1) {
      // Only updatedAt field, nothing to update
      return { success: true, data: sanitizeCategory(existingCategory) };
    }

    execute(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE id = @id`,
      updateParams
    );

    // Fetch the updated category
    const updatedCategory = findById(id);
    return { success: true, data: sanitizeCategory(updatedCategory) };

  } catch (error) {
    console.error('Error updating category:', error.message);
    return { success: false, errors: { general: 'Failed to update category' } };
  }
}

/**
 * Deletes a category by ID.
 * System categories cannot be deleted.
 * 
 * @param {number} id - Category ID
 * @returns {{success: boolean, error?: string}}
 */
function deleteCategory(id) {
  const existingCategory = findById(id);
  if (!existingCategory) {
    return { success: false, error: 'Category not found' };
  }

  if (existingCategory.isSystem) {
    return { success: false, error: 'System categories cannot be deleted' };
  }

  // Check for child categories
  const children = getChildren(id, false);
  if (children.length > 0) {
    return { success: false, error: 'Cannot delete category with child categories' };
  }

  try {
    execute('DELETE FROM categories WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting category:', error.message);
    return { success: false, error: 'Failed to delete category' };
  }
}

/**
 * Toggles category active status.
 * 
 * @param {number} id - Category ID
 * @returns {{success: boolean, data?: CategoryData, error?: string}}
 */
function toggleActive(id) {
  const existingCategory = findById(id);
  if (!existingCategory) {
    return { success: false, error: 'Category not found' };
  }

  try {
    const newStatus = existingCategory.isActive ? 0 : 1;
    execute(
      `UPDATE categories SET isActive = @isActive, updatedAt = datetime('now') WHERE id = @id`,
      { id, isActive: newStatus }
    );

    const updatedCategory = findById(id);
    return { success: true, data: sanitizeCategory(updatedCategory) };
  } catch (error) {
    console.error('Error toggling category status:', error.message);
    return { success: false, error: 'Failed to toggle category status' };
  }
}

/**
 * Searches categories by name or code.
 * 
 * @param {string} searchTerm - Search term
 * @param {boolean} [activeOnly=true] - Only return active categories
 * @returns {CategoryData[]} Array of matching categories
 */
function searchCategories(searchTerm, activeOnly = true) {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }
  const term = `%${searchTerm.trim()}%`;
  
  let sql = `SELECT * FROM categories 
     WHERE (name LIKE ? OR nameTr LIKE ? OR code LIKE ? OR description LIKE ?)`;
  
  if (activeOnly) {
    sql += ' AND isActive = 1';
  }
  
  sql += ' ORDER BY displayOrder ASC, code ASC';
  
  const categories = query(sql, [term, term, term, term]);
  return categories.map(sanitizeCategory);
}

/**
 * Gets category count by type.
 * 
 * @returns {Object.<string, number>} Type counts
 */
function getTypeCounts() {
  const results = query(
    `SELECT type, COUNT(*) as count FROM categories 
     WHERE isActive = 1
     GROUP BY type`
  );
  
  const counts = {};
  for (const type of CATEGORY_TYPES) {
    counts[type] = 0;
  }
  for (const row of results) {
    counts[row.type] = row.count;
  }
  return counts;
}

module.exports = {
  // CRUD operations
  createCategory,
  createManyCategories,
  findById,
  findByCode,
  getAllCategories,
  updateCategory,
  deleteCategory,
  
  // Query operations
  getByType,
  getChildren,
  getTopLevelCategories,
  getCategoryTree,
  searchCategories,
  getTypeCounts,
  
  // Status operations
  toggleActive,
  
  // Utilities
  sanitizeCategory,
  
  // Validation
  validateCategoryData,
  fieldDefinitions,
  
  // Constants
  CATEGORY_TYPES
};
