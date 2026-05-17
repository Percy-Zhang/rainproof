import type { TransactionLinkType } from '../../domain/types';

export const transactionLinkTypeLabels: Record<TransactionLinkType, string> = {
  refund: 'Refund for a purchase',
  reimbursement: 'Paid back for something I paid',
  shared_expense_contribution: 'Contribution toward shared expense',
};

export const transactionLinkTypeOptions: { value: TransactionLinkType; label: string }[] = [
  { value: 'refund', label: transactionLinkTypeLabels.refund },
  { value: 'reimbursement', label: transactionLinkTypeLabels.reimbursement },
  {
    value: 'shared_expense_contribution',
    label: transactionLinkTypeLabels.shared_expense_contribution,
  },
];

export function getTransactionLinkTypeShortLabel(linkType: TransactionLinkType): string {
  if (linkType === 'refund') {
    return 'Refund';
  }

  if (linkType === 'reimbursement') {
    return 'Reimbursement';
  }

  return 'Contribution';
}
