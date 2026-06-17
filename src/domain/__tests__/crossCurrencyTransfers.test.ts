import {
  buildCrossCurrencyTransferLines,
  formatCrossCurrencyTransferRateLabel,
  getCrossCurrencyTransferRate,
  isCrossCurrencyTransferAccountPair,
  isCrossCurrencyTransferLinePair,
} from '../crossCurrencyTransfers';
import type { Account } from '../types';

const accounts: Account[] = [
  account('aud', 'Everyday', 'AUD'),
  account('usd', 'USD checking', 'USD'),
  account('savings', 'Savings', 'AUD'),
];

function account(id: string, name: string, currencyCode: string): Account {
  return {
    id,
    name,
    nickname: '',
    type: 'checking',
    currencyCode,
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
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

describe('cross-currency transfer helpers', () => {
  it('builds source and destination transfer lines from sent and received amounts', () => {
    const lines = buildCrossCurrencyTransferLines({
      accounts,
      sourceAccountId: 'aud',
      targetAccountId: 'usd',
      sourceAmountMinor: 15000,
      targetAmountMinor: 9750,
      sourceLineId: 'source-line',
      targetLineId: 'target-line',
    });

    expect(lines).toEqual([
      {
        id: 'source-line',
        accountId: 'aud',
        amountMinor: -15000,
        currencyCode: 'AUD',
        transferPeerAccountId: 'usd',
      },
      {
        id: 'target-line',
        accountId: 'usd',
        amountMinor: 9750,
        currencyCode: 'USD',
        transferPeerAccountId: 'aud',
      },
    ]);
    expect(isCrossCurrencyTransferLinePair(lines)).toBe(true);
    expect(isCrossCurrencyTransferAccountPair({
      accounts,
      sourceAccountId: 'aud',
      targetAccountId: 'usd',
    })).toBe(true);
  });

  it('derives the display exchange rate from the entered received amount', () => {
    expect(
      getCrossCurrencyTransferRate({
        sourceAmountMinor: 15000,
        sourceCurrencyCode: 'AUD',
        targetAmountMinor: 9750,
        targetCurrencyCode: 'USD',
      }),
    ).toEqual({
      baseCurrencyCode: 'AUD',
      quoteCurrencyCode: 'USD',
      rateDecimal: '0.65',
    });
    expect(
      formatCrossCurrencyTransferRateLabel({
        sourceAmountMinor: 15000,
        sourceCurrencyCode: 'AUD',
        targetAmountMinor: 9750,
        targetCurrencyCode: 'USD',
      }),
    ).toBe('1 AUD = 0.65 USD');
  });

  it('rejects missing accounts, same accounts, same currencies, and empty amounts', () => {
    expect(() =>
      buildCrossCurrencyTransferLines({
        accounts,
        sourceAccountId: 'missing',
        targetAccountId: 'usd',
        sourceAmountMinor: 15000,
        targetAmountMinor: 9750,
      }),
    ).toThrow('Choose source and destination accounts.');
    expect(() =>
      buildCrossCurrencyTransferLines({
        accounts,
        sourceAccountId: 'aud',
        targetAccountId: 'aud',
        sourceAmountMinor: 15000,
        targetAmountMinor: 9750,
      }),
    ).toThrow('Source and destination accounts must be different.');
    expect(() =>
      buildCrossCurrencyTransferLines({
        accounts,
        sourceAccountId: 'aud',
        targetAccountId: 'savings',
        sourceAmountMinor: 15000,
        targetAmountMinor: 15000,
      }),
    ).toThrow('Cross-currency transfers require accounts with different currencies.');
    expect(() =>
      buildCrossCurrencyTransferLines({
        accounts,
        sourceAccountId: 'aud',
        targetAccountId: 'usd',
        sourceAmountMinor: 0,
        targetAmountMinor: 9750,
      }),
    ).toThrow('Sent amount must be greater than zero.');
  });
});
