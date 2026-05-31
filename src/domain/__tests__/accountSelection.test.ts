import {
  getAccountSelectionBalanceLabel,
  getAccountSelectionSummary,
  getInitialSelectedAccountIds,
  getSelectableAccountIds,
} from '../accountSelection';
import type { Account } from '../types';

function account(id: string, currencyCode = 'AUD', overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    nickname: '',
    type: 'checking',
    currencyCode,
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

describe('account selection helpers', () => {
  it('allows dashboard-hidden active accounts as local selectable accounts', () => {
    expect(getSelectableAccountIds([
      account('visible'),
      account('hidden', 'AUD', { showOnDashboard: false }),
      account('closed', 'AUD', { isArchived: true }),
    ])).toEqual(['visible', 'hidden']);
  });

  it('filters defaults to active selectable accounts', () => {
    expect(getInitialSelectedAccountIds([
      account('visible'),
      account('hidden', 'USD', { showOnDashboard: false }),
      account('closed', 'AUD', { isArchived: true }),
    ], ['hidden', 'closed', 'missing'])).toEqual(['hidden']);
  });

  it('builds a compact multi-account summary with currencies', () => {
    expect(getAccountSelectionSummary([
      account('Daily', 'AUD'),
      account('Travel', 'USD'),
      account('Savings', 'AUD'),
    ], ['Daily', 'Travel', 'Savings'])).toEqual({
      headline: 'Daily + 2 more',
      detail: '3 accounts - AUD, USD',
    });
  });

  it('builds a clear empty summary', () => {
    expect(getAccountSelectionSummary([account('Daily')], [])).toEqual({
      headline: 'No accounts selected',
      detail: 'No accounts selected',
    });
  });

  it('formats account selection balances in each account currency', () => {
    expect(getAccountSelectionBalanceLabel(account('Travel', 'USD'), 12345)).toBe('USD $123.45');
  });

  it('falls back to the account currency when no balance is available', () => {
    expect(getAccountSelectionBalanceLabel(account('Travel', 'USD'))).toBe('USD');
  });
});
