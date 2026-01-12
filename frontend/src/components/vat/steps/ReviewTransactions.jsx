import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import useFormatters from '../../../hooks/useFormatters';

/**
 * ReviewTransactions Step Component
 * 
 * Displays all transactions in the VAT period for review.
 * Highlights transactions with missing VAT information
 * and allows quick fixes.
 */
const ReviewTransactions = ({ data, updateData }) => {
  const { t } = useTranslation('vat');
  const { formatCurrency, formatDate, formatPercentage } = useFormatters();
  
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editVatRate, setEditVatRate] = useState('');

  const transactions = data.transactions || [];

  const vatRateOptions = [
    { value: 20, label: '20% (Standard)' },
    { value: 5, label: '5% (Reduced)' },
    { value: 0, label: '0% (Zero-rated)' },
    { value: null, label: t('wizard.reviewTransactions.exempt') },
  ];

  const transactionsWithIssues = useMemo(() => {
    return transactions.filter(
      (tx) => tx.vatRate === null || tx.vatRate === undefined
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    switch (filter) {
      case 'income':
        filtered = filtered.filter((tx) => tx.type === 'income');
        break;
      case 'expense':
        filtered = filtered.filter((tx) => tx.type === 'expense');
        break;
      case 'issues':
        filtered = filtered.filter(
          (tx) => tx.vatRate === null || tx.vatRate === undefined
        );
        break;
      default:
        break;
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date) - new Date(b.date);
          break;
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case 'type':
          comparison = (a.type || '').localeCompare(b.type || '');
          break;
        default:
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, filter, sortBy, sortOrder]);

  const summary = useMemo(() => {
    const income = transactions.filter((tx) => tx.type === 'income');
    const expenses = transactions.filter((tx) => tx.type === 'expense');

    return {
      totalTransactions: transactions.length,
      incomeCount: income.length,
      incomeTotal: income.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      incomeVat: income.reduce((sum, tx) => sum + (tx.vatAmount || 0), 0),
      expenseCount: expenses.length,
      expenseTotal: expenses.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      expenseVat: expenses.reduce((sum, tx) => sum + (tx.vatAmount || 0), 0),
      issuesCount: transactionsWithIssues.length,
    };
  }, [transactions, transactionsWithIssues]);

  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }, [sortBy]);

  const handleEditVatRate = useCallback((transaction) => {
    setEditingTransaction(transaction.id);
    setEditVatRate(transaction.vatRate?.toString() || '');
  }, []);

  const handleSaveVatRate = useCallback((transactionId) => {
    const updatedTransactions = transactions.map((tx) => {
      if (tx.id === transactionId) {
        const newVatRate = editVatRate === '' ? null : parseFloat(editVatRate);
        const newVatAmount = newVatRate !== null ? (tx.amount * newVatRate) / 100 : 0;
        return {
          ...tx,
          vatRate: newVatRate,
          vatAmount: newVatAmount,
        };
      }
      return tx;
    });

    updateData({ transactions: updatedTransactions });
    setEditingTransaction(null);
    setEditVatRate('');
  }, [transactions, editVatRate, updateData]);

  const handleCancelEdit = useCallback(() => {
    setEditingTransaction(null);
    setEditVatRate('');
  }, []);

  const getSortIcon = (column) => {
    if (sortBy !== column) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="vat-step review-transactions">
      <h3 className="vat-step__title">{t('wizard.reviewTransactions.title')}</h3>
      <p className="vat-step__description">{t('wizard.reviewTransactions.description')}</p>

      <div className="review-transactions__summary">
        <div className="review-transactions__summary-card">
          <span className="review-transactions__summary-label">{t('wizard.reviewTransactions.totalTransactions')}</span>
          <span className="review-transactions__summary-value">{summary.totalTransactions}</span>
        </div>
        <div className="review-transactions__summary-card review-transactions__summary-card--income">
          <span className="review-transactions__summary-label">{t('wizard.reviewTransactions.income')}</span>
          <span className="review-transactions__summary-value">{formatCurrency(summary.incomeTotal)}</span>
          <span className="review-transactions__summary-sub">
            {summary.incomeCount} {t('wizard.reviewTransactions.transactions')} | VAT: {formatCurrency(summary.incomeVat)}
          </span>
        </div>
        <div className="review-transactions__summary-card review-transactions__summary-card--expense">
          <span className="review-transactions__summary-label">{t('wizard.reviewTransactions.expenses')}</span>
          <span className="review-transactions__summary-value">{formatCurrency(summary.expenseTotal)}</span>
          <span className="review-transactions__summary-sub">
            {summary.expenseCount} {t('wizard.reviewTransactions.transactions')} | VAT: {formatCurrency(summary.expenseVat)}
          </span>
        </div>
        {summary.issuesCount > 0 && (
          <div className="review-transactions__summary-card review-transactions__summary-card--warning">
            <span className="review-transactions__summary-label">{t('wizard.reviewTransactions.issues')}</span>
            <span className="review-transactions__summary-value">{summary.issuesCount}</span>
            <span className="review-transactions__summary-sub">{t('wizard.reviewTransactions.needsAttention')}</span>
          </div>
        )}
      </div>

      <div className="review-transactions__filters">
        <div className="review-transactions__filter-group">
          <label htmlFor="filter" className="review-transactions__filter-label">
            {t('wizard.reviewTransactions.filter')}
          </label>
          <select
            id="filter"
            className="review-transactions__filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t('wizard.reviewTransactions.filterAll')}</option>
            <option value="income">{t('wizard.reviewTransactions.filterIncome')}</option>
            <option value="expense">{t('wizard.reviewTransactions.filterExpense')}</option>
            <option value="issues">{t('wizard.reviewTransactions.filterIssues')}</option>
          </select>
        </div>
      </div>

      <div className="review-transactions__table-container">
        <table className="review-transactions__table">
          <thead>
            <tr>
              <th onClick={() => handleSort('date')} className="review-transactions__th--sortable">
                {t('wizard.reviewTransactions.date')} {getSortIcon('date')}
              </th>
              <th>{t('wizard.reviewTransactions.description')}</th>
              <th onClick={() => handleSort('type')} className="review-transactions__th--sortable">
                {t('wizard.reviewTransactions.type')} {getSortIcon('type')}
              </th>
              <th onClick={() => handleSort('amount')} className="review-transactions__th--sortable">
                {t('wizard.reviewTransactions.amount')} {getSortIcon('amount')}
              </th>
              <th>{t('wizard.reviewTransactions.vatRate')}</th>
              <th>{t('wizard.reviewTransactions.vatAmount')}</th>
              <th>{t('wizard.reviewTransactions.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="7" className="review-transactions__empty">
                  {t('wizard.reviewTransactions.noTransactions')}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`review-transactions__row ${
                    tx.vatRate === null || tx.vatRate === undefined
                      ? 'review-transactions__row--warning'
                      : ''
                  }`}
                >
                  <td>{formatDate(tx.date)}</td>
                  <td className="review-transactions__description">{tx.description}</td>
                  <td>
                    <span className={`review-transactions__type review-transactions__type--${tx.type}`}>
                      {t(`wizard.reviewTransactions.${tx.type}`)}
                    </span>
                  </td>
                  <td className="review-transactions__amount">{formatCurrency(tx.amount)}</td>
                  <td>
                    {editingTransaction === tx.id ? (
                      <select
                        className="review-transactions__vat-select"
                        value={editVatRate}
                        onChange={(e) => setEditVatRate(e.target.value)}
                      >
                        <option value="">{t('wizard.reviewTransactions.selectVatRate')}</option>
                        {vatRateOptions.map((option) => (
                          <option key={option.value ?? 'null'} value={option.value ?? ''}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : tx.vatRate !== null && tx.vatRate !== undefined ? (
                      formatPercentage(tx.vatRate / 100)
                    ) : (
                      <span className="review-transactions__missing">
                        {t('wizard.reviewTransactions.missingVat')}
                      </span>
                    )}
                  </td>
                  <td className="review-transactions__vat-amount">
                    {formatCurrency(tx.vatAmount || 0)}
                  </td>
                  <td>
                    {editingTransaction === tx.id ? (
                      <div className="review-transactions__edit-actions">
                        <button
                          type="button"
                          className="review-transactions__action-btn review-transactions__action-btn--save"
                          onClick={() => handleSaveVatRate(tx.id)}
                          aria-label={t('wizard.reviewTransactions.save')}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="review-transactions__action-btn review-transactions__action-btn--cancel"
                          onClick={handleCancelEdit}
                          aria-label={t('wizard.reviewTransactions.cancel')}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="review-transactions__action-btn"
                        onClick={() => handleEditVatRate(tx)}
                        aria-label={t('wizard.reviewTransactions.editVatRate')}
                      >
                        ✎
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredTransactions.length > 0 && (
        <div className="review-transactions__footer">
          <span className="review-transactions__count">
            {t('wizard.reviewTransactions.showing', { 
              count: filteredTransactions.length, 
              total: transactions.length 
            })}
          </span>
        </div>
      )}
    </div>
  );
};

ReviewTransactions.propTypes = {
  data: PropTypes.shape({
    transactions: PropTypes.array,
  }).isRequired,
  updateData: PropTypes.func.isRequired,
};

export default ReviewTransactions;
