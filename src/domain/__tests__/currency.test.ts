import { getDefaultCurrencyFromLocales } from '../currency';

describe('currency defaults', () => {
  it('uses the device locale currency when available', () => {
    expect(getDefaultCurrencyFromLocales([{ currencyCode: 'aud' }])).toBe('AUD');
  });

  it('falls back to language currency then USD', () => {
    expect(getDefaultCurrencyFromLocales([{ currencyCode: null, languageCurrencyCode: 'eur' }])).toBe('EUR');
    expect(getDefaultCurrencyFromLocales([{ currencyCode: null, languageCurrencyCode: null }])).toBe('USD');
  });
});
