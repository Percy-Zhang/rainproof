import {
  getTransactionLinkTypeShortLabel,
  transactionLinkTypeLabels,
  transactionLinkTypeOptions,
} from '../TransactionLinkLabels';

describe('transaction link labels', () => {
  it('keeps the user-facing link type options stable', () => {
    expect(transactionLinkTypeOptions).toEqual([
      { value: 'refund', label: 'Refund for a purchase' },
      { value: 'reimbursement', label: 'Paid back for something I paid' },
      { value: 'shared_expense_contribution', label: 'Contribution toward shared expense' },
    ]);
  });

  it('formats compact link type labels', () => {
    expect(getTransactionLinkTypeShortLabel('refund')).toBe('Refund');
    expect(getTransactionLinkTypeShortLabel('reimbursement')).toBe('Reimbursement');
    expect(getTransactionLinkTypeShortLabel('shared_expense_contribution')).toBe('Contribution');
  });

  it('keeps the option labels in sync with the label map', () => {
    for (const option of transactionLinkTypeOptions) {
      expect(option.label).toBe(transactionLinkTypeLabels[option.value]);
    }
  });
});
