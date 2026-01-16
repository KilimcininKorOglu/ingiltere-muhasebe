import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import useValidation from '../../hooks/useValidation';

// Wrapper component with i18n provider
const wrapper = ({ children }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// Wait for i18n to be ready
const waitForI18n = async () => {
  if (!i18n.isInitialized) {
    await new Promise(resolve => {
      i18n.on('initialized', resolve);
    });
  }
  await i18n.changeLanguage('en');
};

describe('useValidation Hook', () => {
  beforeEach(async () => {
    await waitForI18n();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with empty values', () => {
      const { result } = renderHook(
        () => useValidation({ schema: {} }),
        { wrapper }
      );

      expect(result.current.values).toEqual({});
      expect(result.current.fieldErrors).toEqual({});
      expect(result.current.isFormValid).toBe(true);
    });

    it('should initialize with provided initial values', () => {
      const initialValues = { email: 'test@example.com', name: 'John' };

      const { result } = renderHook(
        () => useValidation({ schema: {}, initialValues }),
        { wrapper }
      );

      expect(result.current.values).toEqual(initialValues);
    });
  });

  describe('handleChange', () => {
    it('should update field value', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });

      expect(result.current.values.email).toBe('test@example.com');
    });

    it('should mark field as dirty after change', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleChange('email', 'test@example.com');
      });

      expect(result.current.dirtyFields.email).toBe(true);
    });

    it('should validate on change when validateOnChange is true', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'required' }, { type: 'email' }] },
          validateOnChange: true,
          debounceMs: 0,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleChange('email', 'invalid-email');
      });

      // Fast forward past debounce
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.fieldErrors.email).toBeDefined();
    });
  });

  describe('handleBlur', () => {
    it('should mark field as touched on blur', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.touchedFields.email).toBe(true);
    });

    it('should validate on blur when validateOnBlur is true', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'required' }] },
          initialValues: { email: '' },
          validateOnBlur: true,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.fieldErrors.email).toBeDefined();
    });
  });

  describe('getFieldState', () => {
    it('should return correct field state', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { name: [{ type: 'required' }] },
          initialValues: { name: '' },
        }),
        { wrapper }
      );

      // Initially not dirty or touched
      let fieldState = result.current.getFieldState('name');
      expect(fieldState.isDirty).toBe(false);
      expect(fieldState.isTouched).toBe(false);
      expect(fieldState.isValid).toBe(true);

      // After change and blur
      act(() => {
        result.current.handleChange('name', 'test');
        result.current.handleBlur('name');
      });

      fieldState = result.current.getFieldState('name');
      expect(fieldState.isDirty).toBe(true);
      expect(fieldState.isTouched).toBe(true);
    });

    it('should translate error messages', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'required' }, { type: 'email' }] },
          initialValues: { email: '' },
          validateOnBlur: true,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
      });

      const fieldState = result.current.getFieldState('email');
      expect(fieldState.errors).toContain('This field is required');
    });
  });

  describe('getInputProps', () => {
    it('should return props for input elements', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { name: [{ type: 'required' }] },
          initialValues: { name: 'John' },
        }),
        { wrapper }
      );

      const inputProps = result.current.getInputProps('name');

      expect(inputProps.value).toBe('John');
      expect(typeof inputProps.onChange).toBe('function');
      expect(typeof inputProps.onBlur).toBe('function');
      expect(typeof inputProps.onFocus).toBe('function');
    });

    it('should set aria-invalid when field has errors and is touched', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { name: [{ type: 'required' }] },
          initialValues: { name: '' },
          validateOnBlur: true,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('name');
      });

      const inputProps = result.current.getInputProps('name');
      expect(inputProps['aria-invalid']).toBe(true);
    });
  });

  describe('validateAll', () => {
    it('should validate all fields', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: {
            email: [{ type: 'required' }, { type: 'email' }],
            name: [{ type: 'required' }],
          },
          initialValues: { email: '', name: '' },
        }),
        { wrapper }
      );

      let errors;
      act(() => {
        errors = result.current.validateAll();
      });

      expect(errors.email).toBeDefined();
      expect(errors.name).toBeDefined();
    });

    it('should mark all fields as touched', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: {
            email: [{ type: 'email' }],
            name: [{ type: 'required' }],
          },
        }),
        { wrapper }
      );

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.touchedFields.email).toBe(true);
      expect(result.current.touchedFields.name).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial values', () => {
      const initialValues = { email: 'initial@example.com' };

      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
          initialValues,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleChange('email', 'changed@example.com');
        result.current.handleBlur('email');
      });

      expect(result.current.values.email).toBe('changed@example.com');

      act(() => {
        result.current.reset();
      });

      expect(result.current.values.email).toBe('initial@example.com');
      expect(result.current.touchedFields).toEqual({});
      expect(result.current.dirtyFields).toEqual({});
      expect(result.current.fieldErrors).toEqual({});
    });
  });

  describe('setFieldValue', () => {
    it('should set field value', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { name: [{ type: 'required' }] },
        }),
        { wrapper }
      );

      act(() => {
        result.current.setFieldValue('name', 'John');
      });

      expect(result.current.values.name).toBe('John');
    });

    it('should validate when shouldValidate is true', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
        }),
        { wrapper }
      );

      act(() => {
        result.current.setFieldValue('email', 'invalid-email', true);
      });

      expect(result.current.fieldErrors.email).toBeDefined();
    });

    it('should not validate when shouldValidate is false', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
        }),
        { wrapper }
      );

      act(() => {
        result.current.setFieldValue('email', 'invalid-email', false);
      });

      expect(result.current.fieldErrors.email).toBeUndefined();
    });
  });

  describe('clearFieldErrors', () => {
    it('should clear errors for a specific field', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'required' }] },
          initialValues: { email: '' },
          validateOnBlur: true,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.fieldErrors.email).toBeDefined();

      act(() => {
        result.current.clearFieldErrors('email');
      });

      expect(result.current.fieldErrors.email).toBeUndefined();
    });
  });

  describe('clearAllErrors', () => {
    it('should clear all errors', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: {
            email: [{ type: 'required' }],
            name: [{ type: 'required' }],
          },
          initialValues: { email: '', name: '' },
          validateOnBlur: true,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
        result.current.handleBlur('name');
      });

      expect(Object.keys(result.current.fieldErrors).length).toBeGreaterThan(0);

      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.fieldErrors).toEqual({});
    });
  });

  describe('isFormValid', () => {
    it('should return true when no errors', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'email' }] },
          initialValues: { email: 'test@example.com' },
        }),
        { wrapper }
      );

      expect(result.current.isFormValid).toBe(true);
    });

    it('should return false when errors exist', () => {
      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'required' }] },
          initialValues: { email: '' },
          validateOnBlur: true,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(result.current.isFormValid).toBe(false);
    });
  });

  describe('onValidationChange callback', () => {
    it('should call onValidationChange when validation state changes', () => {
      const onValidationChange = vi.fn();

      const { result } = renderHook(
        () => useValidation({
          schema: { email: [{ type: 'required' }] },
          initialValues: { email: '' },
          validateOnBlur: true,
          onValidationChange,
        }),
        { wrapper }
      );

      act(() => {
        result.current.handleBlur('email');
      });

      expect(onValidationChange).toHaveBeenCalledWith('email', expect.any(Array));
    });
  });
});
