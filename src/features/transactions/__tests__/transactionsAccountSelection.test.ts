import { getTransactionsInitialSelectedAccountIds } from '../useTransactionsViewModel';
import { shouldCollapseTransactionsAccountSelector } from '../transactionsSearchFocus';
import type { Account } from '../../../domain/types';

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: `Account ${id}`,
    nickname: '',
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
    ...overrides,
  };
}

describe('transactions account selection helpers', () => {
  it('keeps the previous all-account default when no dashboard default is provided', () => {
    expect(getTransactionsInitialSelectedAccountIds([account('a1'), account('a2')])).toEqual(['a1', 'a2']);
  });

  it('initializes from dashboard defaults when provided', () => {
    expect(getTransactionsInitialSelectedAccountIds(
      [account('a1'), account('a2'), account('a3')],
      ['a2', 'a3'],
    )).toEqual(['a2', 'a3']);
  });

  it('filters dashboard defaults to accounts that still exist in Transactions', () => {
    expect(getTransactionsInitialSelectedAccountIds(
      [account('a1'), account('a2')],
      ['a2', 'missing'],
    )).toEqual(['a2']);
  });

  it('preserves an explicitly empty dashboard default', () => {
    expect(getTransactionsInitialSelectedAccountIds([account('a1')], [])).toEqual([]);
  });

  it('does not select archived accounts by default', () => {
    expect(getTransactionsInitialSelectedAccountIds([
      account('active'),
      account('closed', { isArchived: true }),
    ])).toEqual(['active']);
  });

  it('collapses the account selector only while search is focused and the keyboard is visible', () => {
    expect(shouldCollapseTransactionsAccountSelector({ searchFocused: true, keyboardVisible: true })).toBe(true);
    expect(shouldCollapseTransactionsAccountSelector({ searchFocused: true, keyboardVisible: false })).toBe(false);
    expect(shouldCollapseTransactionsAccountSelector({ searchFocused: false, keyboardVisible: true })).toBe(false);
  });
});
