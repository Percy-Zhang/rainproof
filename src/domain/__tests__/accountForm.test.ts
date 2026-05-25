import {
  getDefaultAccountIcon,
  normalizeAccountIconName,
} from '../accountThemes';
import {
  getAccountTypeLabel,
  getInstitutionSuggestions,
  manualAccountTypes,
  parseOptionalCreditLimit,
  parseOptionalOpeningBalance,
} from '../accountForm';
import type { Account } from '../types';

function account(id: string, institutionName: string): Account {
  return {
    id,
    name: id,
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName,
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

describe('account form helpers', () => {
  it('treats blank opening balance as zero', () => {
    expect(parseOptionalOpeningBalance('')).toBe(0);
    expect(parseOptionalOpeningBalance('   ')).toBe(0);
    expect(parseOptionalOpeningBalance('12.34')).toBe(1234);
  });

  it('treats blank, zero, and negative credit limits as unset', () => {
    expect(parseOptionalCreditLimit('')).toBeNull();
    expect(parseOptionalCreditLimit('0')).toBeNull();
    expect(parseOptionalCreditLimit('-25')).toBeNull();
    expect(parseOptionalCreditLimit('2500.00')).toBe(250000);
  });

  it('does not expose brokerage account type yet', () => {
    expect(manualAccountTypes).toEqual(['checking', 'savings', 'cash', 'credit_card']);
    expect(manualAccountTypes).not.toContain('brokerage');
  });

  it('formats account type labels with capitalized words', () => {
    expect(getAccountTypeLabel('checking')).toBe('Checking');
    expect(getAccountTypeLabel('credit_card')).toBe('Credit Card');
  });

  it('suggests matching institutions without duplicates', () => {
    expect(
      getInstitutionSuggestions(
        [
          account('a1', 'Commonwealth Bank'),
          account('a2', 'Commonwealth Bank'),
          account('a3', 'Chase'),
          account('a4', ''),
        ],
        'comm',
      ),
    ).toEqual(['Commonwealth Bank']);
  });

  it('defaults and validates account icons by account type', () => {
    expect(getDefaultAccountIcon('savings')).toBe('umbrella-outline');
    expect(getDefaultAccountIcon('cash')).toBe('cash-outline');
    expect(normalizeAccountIconName('', 'credit_card')).toBe('card-outline');
    expect(normalizeAccountIconName('globe-outline', 'checking')).toBe('globe-outline');
    expect(normalizeAccountIconName('unknown-icon', 'checking')).toBe('business-outline');
  });
});
