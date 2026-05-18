import {
  getDefaultCurrencyFromLocales,
  getEffectiveDisplayCurrency,
} from '../currency';

describe('currency defaults', () => {
  it('uses the device locale currency when available', () => {
    expect(getDefaultCurrencyFromLocales([{ currencyCode: 'aud' }])).toBe('AUD');
  });

  it('falls back to language currency then USD', () => {
    expect(getDefaultCurrencyFromLocales([{ currencyCode: null, languageCurrencyCode: 'eur' }])).toBe('EUR');
    expect(getDefaultCurrencyFromLocales([{ currencyCode: null, languageCurrencyCode: null }])).toBe('USD');
  });

  it('uses the single account currency when the default currency is automatic', () => {
    expect(
      getEffectiveDisplayCurrency({
        defaultCurrencyCode: 'USD',
        defaultCurrencyMode: 'auto',
        accountCurrencyCodes: ['aud'],
      }),
    ).toBe('AUD');
  });

  it('keeps a manual default currency even when account currencies differ', () => {
    expect(
      getEffectiveDisplayCurrency({
        defaultCurrencyCode: 'USD',
        defaultCurrencyMode: 'manual',
        accountCurrencyCodes: ['AUD'],
      }),
    ).toBe('USD');
  });

  it('keeps the configured fallback for empty or multi-currency account sets', () => {
    expect(
      getEffectiveDisplayCurrency({
        defaultCurrencyCode: 'USD',
        defaultCurrencyMode: 'auto',
        accountCurrencyCodes: [],
      }),
    ).toBe('USD');
    expect(
      getEffectiveDisplayCurrency({
        defaultCurrencyCode: 'USD',
        defaultCurrencyMode: 'auto',
        accountCurrencyCodes: ['AUD', 'EUR'],
      }),
    ).toBe('USD');
  });
});
