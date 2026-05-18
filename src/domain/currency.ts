import { uniqueCurrencyCodes } from './currencyCatalog';
import { normalizeCurrencyCode } from './money';
import type { CurrencyCode, DefaultCurrencyMode } from './types';

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

export function normalizeDefaultCurrencyMode(value: string | null | undefined): DefaultCurrencyMode {
  return value === 'manual' ? 'manual' : 'auto';
}

export function getEffectiveDisplayCurrency({
  defaultCurrencyCode,
  defaultCurrencyMode,
  accountCurrencyCodes,
  fallbackCurrencyCode = 'USD',
}: {
  defaultCurrencyCode: string | null | undefined;
  defaultCurrencyMode?: DefaultCurrencyMode | string | null;
  accountCurrencyCodes: (string | null | undefined)[];
  fallbackCurrencyCode?: CurrencyCode;
}): CurrencyCode {
  const normalizedDefaultCurrencyCode = normalizeCurrencyCode(defaultCurrencyCode, fallbackCurrencyCode);
  if (normalizeDefaultCurrencyMode(defaultCurrencyMode) === 'manual') {
    return normalizedDefaultCurrencyCode;
  }

  const uniqueAccountCurrencyCodes = uniqueCurrencyCodes(accountCurrencyCodes);
  return uniqueAccountCurrencyCodes.length === 1 ? uniqueAccountCurrencyCodes[0] : normalizedDefaultCurrencyCode;
}
