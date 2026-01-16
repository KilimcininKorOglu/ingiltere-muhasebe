import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Tooltip from '../ui/Tooltip';
import HelpIcon from '../ui/HelpIcon';

/**
 * FormField Component
 * 
 * A form field wrapper that integrates with the tooltip system.
 * Provides consistent styling, tooltip support, and help icons for form inputs.
 * 
 * @param {Object} props - Component props
 * @param {string} props.name - The field name (used for tooltip lookup and htmlFor)
 * @param {string} props.label - The label text
 * @param {string} [props.type='text'] - Input type or 'select', 'textarea'
 * @param {string} [props.tooltipKey] - Override tooltip key (defaults to using name)
 * @param {boolean} [props.showHelpIcon=true] - Whether to show the help icon
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {string} [props.error] - Error message to display
 * @param {string} [props.hint] - Hint text to display
 * @param {string} [props.placeholder] - Input placeholder
 * @param {string} [props.value] - Input value (controlled)
 * @param {Function} [props.onChange] - Change handler
 * @param {Function} [props.onBlur] - Blur handler
 * @param {boolean} [props.disabled] - Whether input is disabled
 * @param {React.ReactNode} [props.children] - For select options or custom content
 * @param {string} [props.className] - Additional CSS class names
 * @param {Object} [props.inputProps] - Additional props to pass to the input element
 */
const FormField = ({
  name,
  label,
  type = 'text',
  tooltipKey,
  showHelpIcon = true,
  required = false,
  error,
  hint,
  placeholder,
  value,
  onChange,
  onBlur,
  disabled = false,
  children,
  className = '',
  inputProps = {},
}) => {
  const { t } = useTranslation('tooltips');
  
  // Build the tooltip key path based on field name
  const getTooltipPath = () => {
    if (tooltipKey) return tooltipKey;
    
    // Try to infer tooltip path from name (e.g., 'invoice.dueDate' or just 'dueDate')
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
      return name;
    }
    
    // Common field name mappings
    const fieldMappings = {
      // Invoice fields
      invoiceNumber: 'invoice.invoiceNumber',
      invoiceDate: 'invoice.invoiceDate',
      dueDate: 'invoice.dueDate',
      poNumber: 'invoice.reference',
      // Transaction fields
      vatRate: 'transaction.vatRate',
      amount: 'transaction.amount',
      transactionDate: 'transaction.date',
      // Company fields
      vatNumber: 'company.vatNumber',
      companyNumber: 'company.companyNumber',
      utr: 'company.utr',
      nino: 'company.nino',
      payeReference: 'company.payeReference',
      fiscalYearEnd: 'company.fiscalYearEnd',
      vatScheme: 'company.vatScheme',
      accountingMethod: 'company.accountingMethod',
      sicCode: 'company.sicCode',
      // Bank fields
      sortCode: 'bank.sortCode',
      accountNumber: 'bank.accountNumber',
      iban: 'bank.iban',
      bic: 'bank.bic',
      // General fields
      email: 'general.email',
      phone: 'general.phone',
      address: 'general.address',
      postcode: 'general.postcode',
      currency: 'general.currency',
      date: 'general.date',
      // Employee fields
      firstName: 'employee.firstName',
      lastName: 'employee.lastName',
      startDate: 'employee.startDate',
      salary: 'employee.salary',
      taxCode: 'employee.taxCode',
      pensionContribution: 'employee.pensionContribution',
      // Expense fields
      vendor: 'expense.vendor',
      receipt: 'expense.receipt',
      billable: 'expense.billable',
      // Payment fields
      paymentDate: 'payment.paymentDate',
      paymentMethod: 'payment.paymentMethod',
      bankAccount: 'payment.bankAccount',
      transactionId: 'payment.transactionId',
      // Tax fields
      taxYear: 'tax.taxYear',
      vatPeriod: 'tax.vatPeriod',
      outputVat: 'tax.outputVat',
      inputVat: 'tax.inputVat',
    };
    
    return fieldMappings[name] || null;
  };

  const tooltipPath = getTooltipPath();
  const shortTooltip = tooltipPath ? t(`${tooltipPath}.short`, { defaultValue: '' }) : '';
  const detailedTooltip = tooltipPath ? t(`${tooltipPath}.detailed`, { defaultValue: '' }) : '';
  
  // Determine field type classes
  const isCheckbox = type === 'checkbox';
  const isRadio = type === 'radio';
  const isSelect = type === 'select';
  const isTextarea = type === 'textarea';
  
  const fieldTypeClass = isCheckbox ? 'form-field--checkbox' : isRadio ? 'form-field--radio' : '';

  const inputId = `field-${name}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  /**
   * Render the appropriate input element based on type
   */
  const renderInput = () => {
    const commonProps = {
      id: inputId,
      name,
      disabled,
      'aria-invalid': !!error,
      'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
      ...inputProps,
    };

    if (isSelect) {
      return (
        <select
          {...commonProps}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={`form-field__select ${error ? 'form-field__input--error' : ''}`}
        >
          {children}
        </select>
      );
    }

    if (isTextarea) {
      return (
        <textarea
          {...commonProps}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`form-field__input ${error ? 'form-field__input--error' : ''}`}
          rows={inputProps.rows || 3}
        />
      );
    }

    if (isCheckbox || isRadio) {
      return (
        <input
          {...commonProps}
          type={type}
          checked={value}
          onChange={onChange}
          onBlur={onBlur}
          className="form-field__input"
        />
      );
    }

    return (
      <input
        {...commonProps}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`form-field__input ${error ? 'form-field__input--error' : ''}`}
      />
    );
  };

  /**
   * Render label with optional tooltip
   */
  const renderLabel = () => {
    const labelContent = (
      <label
        htmlFor={inputId}
        className={`form-field__label ${required ? 'form-field__label--required' : ''}`}
      >
        {label}
      </label>
    );

    // For checkbox/radio, return just the label without tooltip wrapper
    if (isCheckbox || isRadio) {
      return labelContent;
    }

    // Wrap label in tooltip if we have short tooltip content
    if (shortTooltip) {
      return (
        <Tooltip content={shortTooltip} position="top">
          {labelContent}
        </Tooltip>
      );
    }

    return labelContent;
  };

  // For checkbox and radio, use a different layout
  if (isCheckbox || isRadio) {
    return (
      <div className={`form-field ${fieldTypeClass} ${className}`}>
        {renderInput()}
        <div className="form-field__label-wrapper">
          {renderLabel()}
          {showHelpIcon && detailedTooltip && (
            <HelpIcon
              content={detailedTooltip}
              title={label}
              size="small"
              inline
            />
          )}
        </div>
        {hint && (
          <p id={hintId} className="form-field__hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="form-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`form-field ${className}`}>
      <div className="form-field__label-wrapper">
        {renderLabel()}
        {showHelpIcon && detailedTooltip && (
          <HelpIcon
            content={detailedTooltip}
            title={label}
            size="small"
            inline
          />
        )}
      </div>
      {renderInput()}
      {hint && (
        <p id={hintId} className="form-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="form-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

FormField.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.oneOf([
    'text', 'email', 'password', 'number', 'tel', 'url', 'date',
    'select', 'textarea', 'checkbox', 'radio',
  ]),
  tooltipKey: PropTypes.string,
  showHelpIcon: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  hint: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
  inputProps: PropTypes.object,
};

export default FormField;
