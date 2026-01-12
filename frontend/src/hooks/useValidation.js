/**
 * useValidation Hook
 * Custom hook for real-time form validation with i18n support.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { validateValue, validateForm, hasErrors } from '../utils/validators';

/**
 * Field validation state
 * @typedef {Object} FieldValidation
 * @property {boolean} isValid - Whether the field is valid
 * @property {boolean} isDirty - Whether the field has been modified
 * @property {boolean} isTouched - Whether the field has been touched (focused and blurred)
 * @property {string[]} errors - Array of translated error messages
 * @property {Object[]} rawErrors - Array of raw error objects with keys and params
 */

/**
 * Validation hook options
 * @typedef {Object} ValidationOptions
 * @property {Object} schema - Validation schema mapping field names to rules
 * @property {Object} [initialValues] - Initial form values
 * @property {boolean} [validateOnChange=true] - Whether to validate on value change
 * @property {boolean} [validateOnBlur=true] - Whether to validate on blur
 * @property {number} [debounceMs=300] - Debounce delay for validation in milliseconds
 * @property {Function} [onValidationChange] - Callback when validation state changes
 */

/**
 * Default options for validation hook
 */
const DEFAULT_OPTIONS = {
  validateOnChange: true,
  validateOnBlur: true,
  debounceMs: 300,
};

/**
 * Custom hook for form validation
 * @param {ValidationOptions} options - Validation options
 * @returns {Object} Validation state and helpers
 */
export const useValidation = (options) => {
  const { t } = useTranslation(['warnings', 'translation']);
  const {
    schema,
    initialValues = {},
    validateOnChange = DEFAULT_OPTIONS.validateOnChange,
    validateOnBlur = DEFAULT_OPTIONS.validateOnBlur,
    debounceMs = DEFAULT_OPTIONS.debounceMs,
    onValidationChange,
  } = options;

  // Form values state
  const [values, setValues] = useState(initialValues);
  
  // Track which fields have been touched (focused and blurred)
  const [touchedFields, setTouchedFields] = useState({});
  
  // Track which fields have been modified
  const [dirtyFields, setDirtyFields] = useState({});
  
  // Validation errors state
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Debounce timer refs
  const debounceTimers = useRef({});

  /**
   * Translate error messages
   * @param {Object[]} errors - Array of error objects
   * @returns {string[]} Array of translated error messages
   */
  const translateErrors = useCallback((errors) => {
    return errors.map(error => t(error.errorKey, error.params || {}));
  }, [t]);

  /**
   * Validate a single field
   * @param {string} fieldName - Field name to validate
   * @param {*} value - Field value
   * @returns {Object[]} Array of validation errors
   */
  const validateField = useCallback((fieldName, value) => {
    const rules = schema[fieldName];
    if (!rules) return [];
    
    return validateValue(value, rules);
  }, [schema]);

  /**
   * Update field errors and trigger callback
   * @param {string} fieldName - Field name
   * @param {Object[]} errors - Validation errors
   */
  const updateFieldErrors = useCallback((fieldName, errors) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      if (errors.length > 0) {
        newErrors[fieldName] = errors;
      } else {
        delete newErrors[fieldName];
      }
      
      // Call onValidationChange callback
      if (onValidationChange) {
        onValidationChange(fieldName, errors);
      }
      
      return newErrors;
    });
  }, [onValidationChange]);

  /**
   * Debounced validation for a field
   * @param {string} fieldName - Field name to validate
   * @param {*} value - Field value
   */
  const debouncedValidate = useCallback((fieldName, value) => {
    // Clear existing timer for this field
    if (debounceTimers.current[fieldName]) {
      clearTimeout(debounceTimers.current[fieldName]);
    }
    
    // Set new timer
    debounceTimers.current[fieldName] = setTimeout(() => {
      const errors = validateField(fieldName, value);
      updateFieldErrors(fieldName, errors);
    }, debounceMs);
  }, [validateField, updateFieldErrors, debounceMs]);

  /**
   * Handle field value change
   * @param {string} fieldName - Field name
   * @param {*} value - New value
   */
  const handleChange = useCallback((fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    setDirtyFields(prev => ({ ...prev, [fieldName]: true }));
    
    if (validateOnChange) {
      debouncedValidate(fieldName, value);
    }
  }, [validateOnChange, debouncedValidate]);

  /**
   * Handle field blur
   * @param {string} fieldName - Field name
   */
  const handleBlur = useCallback((fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
    
    if (validateOnBlur) {
      // Clear any pending debounced validation
      if (debounceTimers.current[fieldName]) {
        clearTimeout(debounceTimers.current[fieldName]);
      }
      
      // Validate immediately on blur
      const errors = validateField(fieldName, values[fieldName]);
      updateFieldErrors(fieldName, errors);
    }
  }, [validateOnBlur, validateField, values, updateFieldErrors]);

  /**
   * Handle field focus
   * @param {string} fieldName - Field name
   */
  const handleFocus = useCallback(() => {
    // Can be used for tracking or clearing errors on focus
  }, []);

  /**
   * Validate entire form
   * @returns {Object} Validation errors by field
   */
  const validateAll = useCallback(() => {
    const errors = validateForm(values, schema);
    setFieldErrors(errors);
    
    // Mark all fields as touched
    const allTouched = Object.keys(schema).reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});
    setTouchedFields(allTouched);
    
    return errors;
  }, [values, schema]);

  /**
   * Check if form is valid
   * @returns {boolean} True if form is valid
   */
  const isFormValid = useMemo(() => {
    return !hasErrors(fieldErrors);
  }, [fieldErrors]);

  /**
   * Get field validation state
   * @param {string} fieldName - Field name
   * @returns {FieldValidation} Field validation state
   */
  const getFieldState = useCallback((fieldName) => {
    const errors = fieldErrors[fieldName] || [];
    return {
      isValid: errors.length === 0,
      isDirty: Boolean(dirtyFields[fieldName]),
      isTouched: Boolean(touchedFields[fieldName]),
      errors: translateErrors(errors),
      rawErrors: errors,
    };
  }, [fieldErrors, dirtyFields, touchedFields, translateErrors]);

  /**
   * Get input props for a field
   * Convenient for spreading on input elements
   * @param {string} fieldName - Field name
   * @returns {Object} Input props
   */
  const getInputProps = useCallback((fieldName) => {
    const fieldState = getFieldState(fieldName);
    return {
      value: values[fieldName] || '',
      onChange: (e) => handleChange(fieldName, e.target.value),
      onBlur: () => handleBlur(fieldName),
      onFocus: () => handleFocus(fieldName),
      'aria-invalid': fieldState.isTouched && !fieldState.isValid,
      'aria-describedby': fieldState.errors.length > 0 ? `${fieldName}-error` : undefined,
    };
  }, [values, handleChange, handleBlur, handleFocus, getFieldState]);

  /**
   * Reset form to initial state
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setTouchedFields({});
    setDirtyFields({});
    setFieldErrors({});
    
    // Clear all debounce timers
    Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    debounceTimers.current = {};
  }, [initialValues]);

  /**
   * Set field value manually
   * @param {string} fieldName - Field name
   * @param {*} value - New value
   * @param {boolean} shouldValidate - Whether to validate after setting
   */
  const setFieldValue = useCallback((fieldName, value, shouldValidate = true) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    if (shouldValidate) {
      const errors = validateField(fieldName, value);
      updateFieldErrors(fieldName, errors);
    }
  }, [validateField, updateFieldErrors]);

  /**
   * Set field touched manually
   * @param {string} fieldName - Field name
   * @param {boolean} touched - Touched state
   */
  const setFieldTouched = useCallback((fieldName, touched = true) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: touched }));
  }, []);

  /**
   * Clear field errors
   * @param {string} fieldName - Field name
   */
  const clearFieldErrors = useCallback((fieldName) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return {
    // State
    values,
    fieldErrors,
    touchedFields,
    dirtyFields,
    isFormValid,
    
    // Field helpers
    getFieldState,
    getInputProps,
    
    // Handlers
    handleChange,
    handleBlur,
    handleFocus,
    
    // Actions
    validateField,
    validateAll,
    reset,
    setFieldValue,
    setFieldTouched,
    clearFieldErrors,
    clearAllErrors,
    setValues,
  };
};

export default useValidation;
