import type { TransactionDisplayEntry } from '../aggregates';
import {
  formatTransactionShortDate,
  getTransactionAccountLabel,
  getTransactionCategoryIcon,
  getTransactionItemTitle,
  getTransactionRelationLabel,
  getTransactionRelationParts,
  getTransactionSubcategoryLabel,
} from '../transactionDisplay';
import type { Account, Transaction, TransactionLine } from '../types';

const baseTransaction: Transaction = {
  id: 'tx-1',
  kind: 'expense',
  title: 'Market run',
  datetime: new Date(2026, 4, 18, 9, 30).toISOString(),
  notes: '',
  labels: [],
  groupId: '',
  createdAt: '',
  updatedAt: '',
};

const baseLine: TransactionLine = {
  id: 'line-1',
  transactionId: 'tx-1',
  accountId: 'account-1',
  amountMinor: -4500,
  currencyCode: 'AUD',
  categoryId: 'food',
  subcategoryId: 'Groceries',
  externalParty: '',
  transferPeerAccountId: '',
  note: '',
  createdAt: '',
};

const account: Account = {
  id: 'account-1',
  name: 'Everyday Checking',
  nickname: 'Daily',
  type: 'checking',
  currencyCode: 'AUD',
  openingBalanceMinor: 0,
  notes: '',
  institutionName: '',
  includeInRainyDay: true,
  themeColor: '#1876A8',
  iconName: 'business-outline',
  showOnDashboard: true,
  sortOrder: 0,
  isArchived: false,
  createdAt: '',
  updatedAt: '',
};

const savingsAccount: Account = {
  ...account,
  id: 'account-2',
  name: 'Savings',
  nickname: 'Rainy',
};

function entry(overrides: Partial<TransactionDisplayEntry> = {}): TransactionDisplayEntry {
  return {
    id: 'tx-1',
    accountId: 'account-1',
    transaction: baseTransaction,
    lines: [baseLine],
    amountMinor: -4500,
    currencyCode: 'AUD',
    ...overrides,
  };
}

describe('transaction display helpers', () => {
  it('uses Transfer instead of a category for transfers', () => {
    expect(
      getTransactionSubcategoryLabel(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, categoryId: 'other', subcategoryId: 'Cash' }],
        }),
      ),
    ).toBe('Transfer');
  });

  it('uses the transaction line subcategory for normal rows', () => {
    expect(getTransactionSubcategoryLabel(entry())).toBe('Groceries');
  });

  it('uses category metadata icons and supports old subcategory names', () => {
    expect(getTransactionCategoryIcon(entry())).toBe('basket-outline');
  });

  it('formats compact dashboard dates as month then day', () => {
    expect(formatTransactionShortDate(baseTransaction.datetime)).toBe('May 18');
  });

  it('uses the account display name including nickname', () => {
    expect(getTransactionAccountLabel(entry(), [account])).toBe('Daily');
  });

  it('shows one account for income and expense relation labels', () => {
    expect(getTransactionRelationLabel(entry(), [account])).toBe('Daily');
  });

  it('shows source to target for outgoing transfers', () => {
    expect(
      getTransactionRelationLabel(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: -2500, transferPeerAccountId: 'account-2' }],
        }),
        [account, savingsAccount],
      ),
    ).toBe('Daily \u2192 Rainy');
  });

  it('shows source to target for incoming transfers', () => {
    expect(
      getTransactionRelationLabel(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: 2500, transferPeerAccountId: 'account-2' }],
        }),
        [account, savingsAccount],
      ),
    ).toBe('Rainy \u2192 Daily');
  });

  it('marks only the source transfer account for source-account context', () => {
    expect(
      getTransactionRelationParts(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: -2500, transferPeerAccountId: 'account-2' }],
        }),
        [account, savingsAccount],
        'account-1',
      ),
    ).toEqual(expect.objectContaining({ sourceLabel: 'Daily', targetLabel: 'Rainy', highlightSide: 'source' }));
  });

  it('marks only the target transfer account for target-account context', () => {
    expect(
      getTransactionRelationParts(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: 2500, transferPeerAccountId: 'account-2' }],
        }),
        [account, savingsAccount],
        'account-1',
      ),
    ).toEqual(expect.objectContaining({ sourceLabel: 'Rainy', targetLabel: 'Daily', highlightSide: 'target' }));
  });

  it('marks the source account for a negative transfer row without account context', () => {
    expect(
      getTransactionRelationParts(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: -2500, transferPeerAccountId: 'account-2' }],
        }),
        [account, savingsAccount],
      ).highlightSide,
    ).toBe('source');
  });

  it('marks the target account for a positive transfer row without account context', () => {
    expect(
      getTransactionRelationParts(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: 2500, transferPeerAccountId: 'account-2' }],
        }),
        [account, savingsAccount],
      ).highlightSide,
    ).toBe('target');
  });

  it('falls back to outside my accounts for transfer peers outside Rainproof', () => {
    expect(
      getTransactionRelationLabel(
        entry({
          transaction: { ...baseTransaction, kind: 'transfer' },
          lines: [{ ...baseLine, amountMinor: -2500, externalParty: '' }],
        }),
        [account],
      ),
    ).toBe('Daily \u2192 Outside my accounts');
  });

  it('falls back safely when item title is blank', () => {
    expect(
      getTransactionItemTitle(
        entry({
          transaction: { ...baseTransaction, title: '   ' },
        }),
      ),
    ).toBe('Groceries');
  });
});
