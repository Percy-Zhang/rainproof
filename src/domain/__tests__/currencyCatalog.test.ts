import {
  createCurrencySearchIndex,
  filterCurrencySearchOptions,
  getAvailableCurrencyCodes,
  getDefaultEnabledCurrencyCodes,
  getCurrencyName,
  uniqueCurrencyCodes,
} from '../currencyCatalog';

describe('currency catalog', () => {
  it('includes common currencies from runtime support or fallback data', () => {
    const codes = getAvailableCurrencyCodes();

    expect(codes).toContain('AUD');
    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');
  });

  it('enables the detected default and USD by default', () => {
    expect(getDefaultEnabledCurrencyCodes('AUD')).toEqual(['AUD', 'USD']);
    expect(getDefaultEnabledCurrencyCodes('USD')).toEqual(['USD']);
  });

  it('normalizes and de-duplicates currency codes', () => {
    expect(uniqueCurrencyCodes(['aud', 'AUD', 'usd', null, undefined])).toEqual(['AUD', 'USD']);
  });

  it('has full fallback names for common currencies', () => {
    expect(getCurrencyName('AUD')).toMatch(/Australian Dollar|Australian dollar/);
    expect(getCurrencyName('USD')).toMatch(/United States Dollar|US Dollar|US dollar/);
  });

  it('searches currencies by code, full name, symbol, and aliases', () => {
    const indexedOptions = createCurrencySearchIndex([
      { code: 'AUD', label: 'Australian Dollar', symbol: '$' },
      { code: 'USD', label: 'United States Dollar', symbol: '$' },
      { code: 'GBP', label: 'British Pound', symbol: 'GBP' },
      { code: 'JPY', label: 'Japanese Yen', symbol: 'JPY' },
      { code: 'EUR', label: 'Euro', symbol: 'EUR' },
    ]);

    expect(filterCurrencySearchOptions(indexedOptions, 'austr').map((option) => option.code)).toEqual(['AUD']);
    expect(filterCurrencySearchOptions(indexedOptions, 'american').map((option) => option.code)).toEqual(['USD']);
    expect(filterCurrencySearchOptions(indexedOptions, 'sterling').map((option) => option.code)).toEqual(['GBP']);
    expect(filterCurrencySearchOptions(indexedOptions, 'japan').map((option) => option.code)).toEqual(['JPY']);
    expect(filterCurrencySearchOptions(indexedOptions, 'euro').map((option) => option.code)).toEqual(['EUR']);
  });
});
