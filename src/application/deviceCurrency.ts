import { getLocales } from 'expo-localization';

import { getDefaultCurrencyFromLocales } from '../domain/currency';
import type { CurrencyCode } from '../domain/types';

export function getDeviceDefaultCurrencyCode(fallback: CurrencyCode = 'USD'): CurrencyCode {
  try {
    return getDefaultCurrencyFromLocales(getLocales(), fallback);
  } catch {
    return fallback;
  }
}
