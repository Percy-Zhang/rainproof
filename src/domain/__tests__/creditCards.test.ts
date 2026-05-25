import {
  formatCreditCardBalanceLabel,
  getCreditCardAvailableCredit,
  getCreditCardBalanceSummary,
  getCreditCardPortfolioSummary,
  getCreditCardUtilization,
} from '../creditCards';
import type { Account, AccountBalance } from '../types';

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: overrides.id ?? 'acct-card',
    name: overrides.name ?? 'Rewards card',
    nickname: '',
    type: overrides.type ?? 'credit_card',
    currencyCode: overrides.currencyCode ?? 'AUD',
    openingBalanceMinor: 0,
    creditLimitMinor: overrides.creditLimitMinor ?? null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'card-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: overrides.isArchived ?? false,
    createdAt: '',
    updatedAt: '',
  };
}

function balance(balanceMinor: number, overrides: Partial<Account> = {}): AccountBalance {
  return {
    account: account(overrides),
    balanceMinor,
  };
}

describe('credit card helpers', () => {
  it('formats owed, credit, and zero balances for credit cards', () => {
    expect(formatCreditCardBalanceLabel(balance(-85000))).toBe('Owed: $850.00');
    expect(formatCreditCardBalanceLabel(balance(5000))).toBe('Credit: $50.00');
    expect(formatCreditCardBalanceLabel(balance(0))).toBe('No balance');
  });

  it('keeps normal account balance labels unchanged', () => {
    expect(formatCreditCardBalanceLabel(balance(-85000, { type: 'checking' }))).toBe('-$850.00');
  });

  it('calculates available credit, utilization, and over-limit state', () => {
    const summary = getCreditCardBalanceSummary(balance(-85000, { creditLimitMinor: 100000 }));

    expect(summary).toEqual(expect.objectContaining({
      owedMinor: 85000,
      creditMinor: 0,
      availableCreditMinor: 15000,
      overLimitMinor: 0,
      utilization: 0.85,
    }));
    expect(getCreditCardAvailableCredit(balance(-85000, { creditLimitMinor: 100000 }))).toBe(15000);
    expect(getCreditCardUtilization(balance(-85000, { creditLimitMinor: 100000 }))).toBe(0.85);
  });

  it('handles over-limit and missing or zero limits safely', () => {
    expect(getCreditCardBalanceSummary(balance(-125000, { creditLimitMinor: 100000 }))).toEqual(
      expect.objectContaining({
        availableCreditMinor: -25000,
        overLimitMinor: 25000,
        utilization: 1.25,
      }),
    );
    expect(getCreditCardAvailableCredit(balance(-85000))).toBeNull();
    expect(getCreditCardUtilization(balance(-85000, { creditLimitMinor: 0 }))).toBeNull();
  });

  it('groups portfolio summaries by currency without combining currencies', () => {
    const summaries = getCreditCardPortfolioSummary([
      balance(-85000, { id: 'aud-1', name: 'AUD card', currencyCode: 'AUD', creditLimitMinor: 100000 }),
      balance(-20000, { id: 'aud-2', name: 'No-limit AUD card', currencyCode: 'AUD' }),
      balance(5000, { id: 'aud-3', name: 'Credit AUD card', currencyCode: 'AUD', creditLimitMinor: 50000 }),
      balance(-30000, { id: 'usd-1', name: 'USD card', currencyCode: 'USD', creditLimitMinor: 100000 }),
      balance(-99999, { id: 'archived', name: 'Archived card', isArchived: true, creditLimitMinor: 99999 }),
      balance(25000, { id: 'checking', name: 'Checking', type: 'checking' }),
    ]);

    expect(summaries).toEqual([
      expect.objectContaining({
        currencyCode: 'AUD',
        totalOwedMinor: 105000,
        totalCreditMinor: 5000,
        totalCreditLimitMinor: 150000,
        totalAvailableCreditMinor: 65000,
        utilization: 85000 / 150000,
        cards: expect.arrayContaining([
          expect.objectContaining({ account: expect.objectContaining({ id: 'aud-1' }) }),
          expect.objectContaining({ account: expect.objectContaining({ id: 'aud-2' }) }),
          expect.objectContaining({ account: expect.objectContaining({ id: 'aud-3' }) }),
        ]),
      }),
      expect.objectContaining({
        currencyCode: 'USD',
        totalOwedMinor: 30000,
        totalCreditLimitMinor: 100000,
        totalAvailableCreditMinor: 70000,
        utilization: 0.3,
      }),
    ]);
  });
});
