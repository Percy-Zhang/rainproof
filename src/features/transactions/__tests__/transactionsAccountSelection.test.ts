import { getTransactionsInitialSelectedAccountIds } from '../useTransactionsViewModel';
import { shouldKeepTransactionsSearchVisible } from '../transactionsSearchFocus';
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

  it('keeps the search visible while search is focused, keyboard is visible, or text is active', () => {
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: true,
      searchFocused: true,
      searchQuery: '',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: false,
      searchFocused: true,
      searchQuery: '',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: true,
      searchFocused: false,
      searchQuery: '',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: false,
      searchFocused: false,
      searchQuery: 'coffee',
    })).toBe(true);
    expect(shouldKeepTransactionsSearchVisible({
      keyboardVisible: false,
      searchFocused: false,
      searchQuery: '   ',
    })).toBe(false);
  });
});
