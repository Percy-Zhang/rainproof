import type { TransactionDisplayEntry } from '../aggregates';
import {
  formatTransactionShortDate,
  getSplitLineChildDisplayText,
  getTransactionAccountLabel,
  getTransactionCategoryColor,
  getTransactionCategoryIcon,
  getTransactionItemTitle,
  getTransactionRelationLabel,
  getTransactionRelationParts,
  getTransactionSplitDisplayMetadata,
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

  it('chooses the largest split line as the primary display category', () => {
    const splitEntry = entry({
      lines: [
        { ...baseLine, id: 'small', amountMinor: -1500, categoryId: 'food', subcategoryId: 'groceries' },
        { ...baseLine, id: 'large', amountMinor: -3000, categoryId: 'housing', subcategoryId: 'rent' },
        { ...baseLine, id: 'medium', amountMinor: -2000, categoryId: 'transport', subcategoryId: 'fuel' },
      ],
      amountMinor: -6500,
    });

    expect(getTransactionSubcategoryLabel(splitEntry)).toBe('Rent');
    expect(getTransactionCategoryIcon(splitEntry)).toBe('key-outline');
    expect(getTransactionCategoryColor(splitEntry)).toBe('#256F9C');
  });

  it('keeps split primary display deterministic for tied line amounts', () => {
    const splitEntry = entry({
      lines: [
        { ...baseLine, id: 'first', amountMinor: -2000, categoryId: 'food', subcategoryId: 'groceries' },
        { ...baseLine, id: 'second', amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent' },
      ],
      amountMinor: -4000,
    });

    expect(getTransactionSubcategoryLabel(splitEntry)).toBe('Groceries');
  });

  it('returns compact split metadata for split income and expenses', () => {
    const splitEntry = entry({
      lines: [
        { ...baseLine, id: 'food-line', amountMinor: -1500 },
        { ...baseLine, id: 'housing-line', amountMinor: -3000, categoryId: 'housing', subcategoryId: 'rent' },
        { ...baseLine, id: 'transport-line', amountMinor: -2000, categoryId: 'transport', subcategoryId: 'fuel' },
      ],
      amountMinor: -6500,
    });

    expect(getTransactionSplitDisplayMetadata(splitEntry)).toEqual(
      expect.objectContaining({
        isSplit: true,
        splitLineCount: 3,
        splitLines: splitEntry.lines,
        primaryCategoryId: 'housing',
        primarySubcategoryId: 'rent',
        splitLabel: undefined,
      }),
    );
    expect(getTransactionSplitDisplayMetadata(entry())).toEqual(
      expect.objectContaining({
        isSplit: false,
        splitLineCount: 0,
        splitLines: [],
        splitLabel: undefined,
      }),
    );

    const splitIncomeEntry = entry({
      transaction: { ...baseTransaction, kind: 'income' },
      lines: [
        { ...baseLine, id: 'salary-line', amountMinor: 1500, categoryId: 'income', subcategoryId: 'salary' },
        { ...baseLine, id: 'bonus-line', amountMinor: 3000, categoryId: 'income', subcategoryId: 'bonus' },
      ],
      amountMinor: 4500,
    });

    expect(getTransactionSplitDisplayMetadata(splitIncomeEntry)).toEqual(
      expect.objectContaining({
        isSplit: true,
        splitLineCount: 2,
        primaryCategoryId: 'income',
        primarySubcategoryId: 'bonus',
      }),
    );
  });

  it('returns mixed split metadata with both income and expense lines', () => {
    const splitEntry = entry({
      transaction: { ...baseTransaction, kind: 'income' },
      lines: [
        { ...baseLine, id: 'salary-line', amountMinor: 230000, categoryId: 'income', subcategoryId: 'salary' },
        { ...baseLine, id: 'tax-line', amountMinor: -60000, categoryId: 'tax', subcategoryId: 'withholding' },
      ],
      amountMinor: 170000,
    });

    expect(getTransactionSplitDisplayMetadata(splitEntry)).toEqual(
      expect.objectContaining({
        isSplit: true,
        splitLineCount: 2,
        splitLines: splitEntry.lines,
        primaryCategoryId: 'income',
        primarySubcategoryId: 'salary',
      }),
    );
  });

  it('uses subcategory name as the split child row title', () => {
    expect(
      getSplitLineChildDisplayText(
        { ...baseLine, categoryId: 'food', subcategoryId: 'groceries', note: 'Weekly food shop' },
        'Woolworths',
      ),
    ).toEqual({
      title: 'Groceries',
      secondaryText: 'Weekly food shop',
    });
  });

  it('falls back to category name for split child row title when no subcategory exists', () => {
    expect(
      getSplitLineChildDisplayText(
        { ...baseLine, categoryId: 'income', subcategoryId: '', note: 'Base pay' },
        'Apple Pay',
      ),
    ).toEqual({
      title: 'Income',
      secondaryText: 'Base pay',
    });
  });

  it('uses parent title as split child secondary text when the line note is empty', () => {
    expect(
      getSplitLineChildDisplayText(
        { ...baseLine, categoryId: 'income', subcategoryId: 'bonus', note: '' },
        'Apple Pay',
      ),
    ).toEqual({
      title: 'Bonus',
      secondaryText: 'Apple Pay',
    });
  });

  it('omits duplicate split child secondary text', () => {
    expect(
      getSplitLineChildDisplayText(
        { ...baseLine, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' },
        'Bonus',
      ),
    ).toEqual({
      title: 'Bonus',
      secondaryText: undefined,
    });
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
