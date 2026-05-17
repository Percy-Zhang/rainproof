import { uniqueCurrencyCodes } from './currencyCatalog';
import { normalizeCurrencyCode } from './money';
import type { CurrencyCode } from './types';

type LocaleCurrencyCandidate = {
  currencyCode?: string | null;
  languageCurrencyCode?: string | null;
};

export function getDefaultCurrencyFromLocales(
  locales: LocaleCurrencyCandidate[],
  fallback: CurrencyCode = 'USD',
): CurrencyCode {
  for (const locale of locales) {
    const direct = normalizeCurrencyCode(locale.currencyCode, '');
    if (direct) {
      return direct;
    }

    const language = normalizeCurrencyCode(locale.languageCurrencyCode, '');
    if (language) {
      return language;
    }
  }

  return normalizeCurrencyCode(fallback);
}

export function getCurrenciesInUse(currencies: (string | null | undefined)[]): CurrencyCode[] {
  return uniqueCurrencyCodes(currencies);
}
