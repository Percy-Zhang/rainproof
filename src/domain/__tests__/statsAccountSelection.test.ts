import {
  getStatsInitialSelectedAccountIds,
  getStatsSelectedAccountIdsForCurrency,
  getStatsSelectedCurrencyCodes,
  resolveStatsCurrencyScope,
} from '../statsAccountSelection';
import type { Account } from '../types';

function account(id: string, currencyCode: string, overrides: Partial<Account> = {}): Account {
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

describe('stats account selection helpers', () => {
  const accounts = [
    account('aud-1', 'AUD'),
    account('usd-1', 'USD'),
    account('aud-2', 'AUD'),
  ];

  it('keeps the previous all-account default when no dashboard default is provided', () => {
    expect(getStatsInitialSelectedAccountIds(accounts)).toEqual(['aud-1', 'usd-1', 'aud-2']);
  });

  it('initializes from dashboard defaults and ignores missing accounts', () => {
    expect(getStatsInitialSelectedAccountIds(accounts, ['usd-1', 'missing'])).toEqual(['usd-1']);
  });

  it('preserves an explicitly empty dashboard default', () => {
    expect(getStatsInitialSelectedAccountIds(accounts, [])).toEqual([]);
  });

  it('does not initialize archived accounts', () => {
    expect(getStatsInitialSelectedAccountIds([
      account('active', 'AUD'),
      account('closed', 'AUD', { isArchived: true }),
    ])).toEqual(['active']);
  });

  it('derives currencies from selected accounts without combining currencies', () => {
    expect(getStatsSelectedCurrencyCodes(accounts, ['aud-2', 'usd-1', 'aud-1'])).toEqual(['AUD', 'USD']);
  });

  it('resolves one selected currency automatically', () => {
    expect(resolveStatsCurrencyScope({
      fallbackCurrencyCode: 'AUD',
      requestedCurrencyCode: 'USD',
      selectedCurrencyCodes: ['AUD'],
    })).toBe('AUD');
  });

  it('keeps a requested currency only when it belongs to selected accounts', () => {
    expect(resolveStatsCurrencyScope({
      fallbackCurrencyCode: 'AUD',
      requestedCurrencyCode: 'USD',
      selectedCurrencyCodes: ['AUD', 'USD'],
    })).toBe('USD');
  });

  it('falls back safely when no accounts are selected', () => {
    expect(resolveStatsCurrencyScope({
      fallbackCurrencyCode: 'AUD',
      requestedCurrencyCode: 'USD',
      selectedCurrencyCodes: [],
    })).toBe('AUD');
  });

  it('scopes report account ids to the active derived currency', () => {
    expect(getStatsSelectedAccountIdsForCurrency({
      accounts,
      currencyCode: 'AUD',
      selectedAccountIds: ['aud-1', 'usd-1', 'aud-2'],
    })).toEqual(['aud-1', 'aud-2']);
  });
});
